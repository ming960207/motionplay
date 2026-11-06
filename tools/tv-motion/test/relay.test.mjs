import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { WebSocket } from 'ws'
import { once } from 'node:events'
import { randomInt } from 'node:crypto'

const port = randomInt(20000, 40000)
const server = spawn(process.execPath, ['server.mjs'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
let serverOutput = ''
server.stdout.on('data', data => { serverOutput += data.toString() })
server.stderr.on('data', data => { serverOutput += data.toString() })
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitReady() {
  for (let i = 0; i < 100; i++) {
    if (serverOutput.includes('listening')) return
    if (server.exitCode !== null) throw new Error('Relay exited: ' + serverOutput)
    await sleep(30)
  }
  throw new Error('Relay start timeout: ' + serverOutput)
}
function nextMessage(ws, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Message timeout')) }, timeout)
    const handler = raw => { cleanup(); resolve(JSON.parse(raw.toString())) }
    const error = err => { cleanup(); reject(err) }
    function cleanup() { clearTimeout(timer); ws.off('message', handler); ws.off('error', error) }
    ws.on('message', handler); ws.on('error', error)
  })
}
async function connect() {
  const ws = new WebSocket('ws://127.0.0.1:' + port)
  await once(ws, 'open')
  return ws
}
test('pairing, motion forwarding, replay rejection and disconnect', async t => {
  t.after(() => server.kill())
  await waitReady()
  const tv = await connect()
  t.after(() => tv.close())
  const created = nextMessage(tv)
  tv.send(JSON.stringify({ type: 'create' }))
  const room = await created
  assert.match(room.code, /^[0-9a-f]{32}$/)
  const phone = await connect()
  t.after(() => phone.close())
  const joined = nextMessage(phone)
  const connected = nextMessage(tv)
  phone.send(JSON.stringify({ type: 'join', code: room.code }))
  assert.equal((await joined).type, 'joined')
  assert.equal((await connected).type, 'connected')
  const motion = { type: 'motion', sequence: 1, timestamp: Date.now(), action: 'JUMP', confidence: 0.9 }
  const forwarded = nextMessage(tv)
  phone.send(JSON.stringify(motion))
  assert.deepEqual(await forwarded, motion)
  const rejected = nextMessage(phone)
  phone.send(JSON.stringify(motion))
  assert.equal((await rejected).type, 'error')
  const limited = nextMessage(phone)
  for (let i = 2; i <= 40; i++) {
    phone.send(JSON.stringify({ ...motion, sequence: i, timestamp: Date.now() }))
  }
  assert.equal((await limited).type, 'error')
  const disconnected = nextMessage(tv)
  phone.close()
  assert.equal((await disconnected).type, 'disconnected')
})
