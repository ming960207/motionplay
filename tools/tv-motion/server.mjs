import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PORT ?? 8787)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
const host = process.env.HOST ?? '0.0.0.0'
const publicDir = resolve(fileURLToPath(new URL('../../public/tv-motion/', import.meta.url)))
const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.svg', 'image/svg+xml']
])
const servePage = async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'Allow': 'GET, HEAD' }).end()
    return
  }
  let pathname
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname) }
  catch { response.writeHead(400).end(); return }
  const relative = (pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''))
  const file = resolve(publicDir, relative)
  if (file !== publicDir && !file.startsWith(publicDir + sep)) {
    response.writeHead(404).end()
    return
  }
  try {
    const body = await readFile(file)
    response.writeHead(200, {
      'Content-Type': contentTypes.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch (error) {
    const status = error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500
    response.writeHead(status).end()
  }
}
const tlsCert = process.env.TLS_CERT
const tlsKey = process.env.TLS_KEY
if (Boolean(tlsCert) !== Boolean(tlsKey)) throw new Error('Set both TLS_CERT and TLS_KEY')
const secure = Boolean(tlsCert)
const server = secure
  ? createHttpsServer({ cert: readFileSync(tlsCert), key: readFileSync(tlsKey) }, servePage)
  : createHttpServer(servePage)
const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 })
server.on('upgrade', (request, socket, head) => {
  let pathname
  try { pathname = new URL(request.url, 'http://localhost').pathname }
  catch { socket.destroy(); return }
  if (pathname !== '/' && pathname !== '/motion-ws') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request))
})
const rooms = new Map()
const MAX_ROOMS = 100
const MAX_MOTION_PER_SECOND = 30
const ROOM_TTL_MS = 10 * 60_000
const actions = new Set(['JUMP', 'DUCK', 'LEFT', 'RIGHT', 'NEUTRAL'])
const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)) }
const fail = (ws, message) => send(ws, { type: 'error', message })
wss.on('connection', ws => {
  let room = null
  let role = null
  let lastSequence = -1
  let motionWindowStart = 0
  let motionCount = 0
  ws.on('message', raw => {
    let data
    try { data = JSON.parse(raw.toString()) } catch { fail(ws, 'Invalid JSON'); return }
    if (!data || typeof data !== 'object' || Array.isArray(data)) { fail(ws, 'Invalid message'); return }
    if (data.type === 'create' && !room) {
      if (rooms.size >= MAX_ROOMS) { fail(ws, 'Room capacity reached'); return }
      const code = randomBytes(16).toString('hex')
      room = code; role = 'tv'
      rooms.set(code, { tv: ws, phone: null, created: Date.now() })
      send(ws, { type: 'created', code })
      return
    }
    if (data.type === 'join' && !room) {
      const target = typeof data.code === 'string' ? rooms.get(data.code) : null
      if (!target || target.phone || Date.now() - target.created > ROOM_TTL_MS) { fail(ws, 'Room unavailable'); return }
      room = data.code; role = 'phone'; target.phone = ws
      send(ws, { type: 'joined' }); send(target.tv, { type: 'connected' })
      return
    }
    if (data.type === 'motion' && role === 'phone') {
      const target = rooms.get(room)
      if (!target || target.phone !== ws) { fail(ws, 'Room disconnected'); return }
      if (!Number.isSafeInteger(data.sequence) || data.sequence <= lastSequence ||
          !Number.isFinite(data.timestamp) || Math.abs(Date.now() - data.timestamp) > 5000 ||
          !actions.has(data.action) || typeof data.confidence !== 'number' ||
          !Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1) {
        fail(ws, 'Invalid motion'); return
      }
      const now = Date.now()
      if (now - motionWindowStart >= 1000) { motionWindowStart = now; motionCount = 0 }
      if (++motionCount > MAX_MOTION_PER_SECOND) { fail(ws, 'Motion rate limit exceeded'); return }
      lastSequence = data.sequence
      send(target.tv, { type: 'motion', sequence: data.sequence, timestamp: data.timestamp, action: data.action, confidence: data.confidence })
      return
    }
    fail(ws, 'Unsupported message')
  })
  ws.on('close', () => {
    if (!room) return
    const target = rooms.get(room)
    if (!target) return
    if (role === 'tv') {
      rooms.delete(room)
      if (target.phone) { send(target.phone, { type: 'disconnected' }); target.phone.close() }
    } else if (target.phone === ws) {
      target.phone = null
      send(target.tv, { type: 'disconnected' })
    }
  })
  ws.on('error', error => console.error('WebSocket client error', error))
})
const expiryTimer = setInterval(() => {
  for (const [code, target] of rooms) {
    if (Date.now() - target.created < ROOM_TTL_MS || target.phone) continue
    rooms.delete(code)
    send(target.tv, { type: 'error', message: 'Pairing expired. Reopen the game to retry.' })
    target.tv.close(1000, 'Pairing expired')
  }
}, 30_000)
expiryTimer.unref()

server.listen(port, host, () => console.log(`MotionPlay ${secure ? 'HTTPS' : 'HTTP'} web and relay listening on ${host}:${port}`))

if (secure && process.env.TLS_CA_CERT) {
  const caCert = process.env.TLS_CA_CERT
  const caPort = Number(process.env.CA_PORT ?? 8787)
  if (!Number.isSafeInteger(caPort) || caPort < 1 || caPort > 65535 || caPort === port) throw new Error('Invalid CA_PORT')
  createHttpServer(async (request, response) => {
    let pathname
    try { pathname = new URL(request.url, 'http://localhost').pathname }
    catch { response.writeHead(400).end(); return }
    if (request.method !== 'GET' || pathname !== '/motionplay-local-ca.crt') {
      response.writeHead(404).end()
      return
    }
    try {
      const body = await readFile(caCert)
      response.writeHead(200, {
        'Content-Type': 'application/x-x509-ca-cert',
        'Content-Length': body.length,
        'Content-Disposition': 'attachment; filename="motionplay-local-ca.crt"',
        'X-Content-Type-Options': 'nosniff'
      })
      response.end(body)
    } catch {
      response.writeHead(500).end()
    }
  }).listen(caPort, host, () => console.log(`Local CA download available on http://${host}:${caPort}/motionplay-local-ca.crt`))
}
