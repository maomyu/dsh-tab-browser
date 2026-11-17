import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import { get } from 'node:http'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import WebSocket from 'ws'
import { browserTarget } from '../src/host.js'
import { openViewer } from '../src/viewer-server.js'
import { openPageStreams } from '../src/page-stream.js'

test('the built-in browser open passes only HTTP(S) addresses to Chrome', () => {
  assert.equal(browserTarget({ url: 'HTTPS://example.com?q=test' }), 'https://example.com/?q=test')
  assert.equal(browserTarget({ newPage: true }), 'chrome://newtab/')
  assert.equal(browserTarget({}), undefined)
  for (const url of ['file:///Users/demo', 'javascript:alert(1)', 'https://a:b@example.com', 'http://localhost:4731/']) {
    assert.throws(() => browserTarget({ url }, 'http://localhost:4731'))
  }
})

test('only the local viewer capability can open the display stream', async t => {
  let connections = 0
  const view = await openViewer({
    connectDisplay() {
      connections++
      const child = new EventEmitter()
      child.stdin = new PassThrough()
      child.stdout = new PassThrough()
      child.stdin.pipe(child.stdout)
      child.kill = () => child.stdout.destroy()
      return child
    },
  })
  t.after(() => view.close())
  const url = new URL(view.url)
  assert.equal(url.hostname, '127.0.0.1')
  assert.equal((await fetch(url.origin)).status, 404)
  const [untrustedHost] = await once(get(url, { headers: { Host: 'example.test' } }), 'response')
  assert.equal(untrustedHost.statusCode, 404)
  untrustedHost.resume()
  const page = await fetch(url)
  assert.equal(page.status, 200)
  assert.equal(page.headers.get('cache-control'), 'no-store')
  await page.text()
  const rfb = new URL('rfb', url)
  rfb.protocol = 'ws:'
  const wrongOrigin = new WebSocket(rfb, { origin: 'https://example.test' })
  await assert.rejects(once(wrongOrigin, 'open'), /403/u)
  assert.equal(connections, 0)
  const client = new WebSocket(rfb, { origin: url.origin })
  await once(client, 'open')
  client.send(Buffer.from('RFB test'))
  assert.equal((await once(client, 'message'))[0].toString(), 'RFB test')
  client.close()
  await once(client, 'close')
  assert.equal(connections, 1)
})

test('native tabs isolate their streams and only accept browser input messages', async t => {
  const input = []
  const receivedInput = Promise.withResolvers()
  const view = await openPageStreams({
    status: tab => ({type: 'status', title: tab.title}),
    watching: () => {},
    async input(tab, event) {
      input.push([tab.title, event])
      receivedInput.resolve()
    },
  })
  t.after(() => view.close())
  const a = {title: 'first', peers: new Set()}
  const b = {title: 'second', peers: new Set()}
  async function connect(tab) {
    const url = new URL(view.urlFor(tab))
    const socket = new URL('input', url)
    socket.protocol = 'ws:'
    await assert.rejects(once(new WebSocket(socket, {origin: 'https://example.test'}), 'open'), /403/u)
    const peer = new WebSocket(socket, {origin: url.origin})
    const [status] = await once(peer, 'message')
    assert.equal(JSON.parse(status).title, tab.title)
    return peer
  }
  const first = await connect(a)
  const second = await connect(b)
  first.send(JSON.stringify({method: 'Browser.close'}))
  first.send(JSON.stringify({type: 'size', width: 800, height: 600}))
  const received = once(second, 'message')
  b.notify({type: 'popup', url: 'https://example.com/'})
  const [message] = await received
  assert.equal(JSON.parse(message).type, 'popup')
  await receivedInput.promise
  view.remove(a)
  await once(first, 'close')
  assert.deepEqual(input, [['first', {type: 'size', width: 800, height: 600}]])
  assert.equal(second.readyState, WebSocket.OPEN)
})
