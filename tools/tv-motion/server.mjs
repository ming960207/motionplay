import { WebSocketServer, WebSocket } from 'ws'
import { randomBytes } from 'node:crypto'

const port = Number(process.env.PORT ?? 8787)
if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT')
const wss = new WebSocketServer({ port, maxPayload: 2048 })
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

console.log(`MotionPlay relay listening on port ${port}`)
