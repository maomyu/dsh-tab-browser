import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import WebSocket from 'ws'
import { extensionOrigin, inputMessage, pairingAddress } from '../chrome-extension/protocol.js'
import { openLocalChrome } from '../src/local-chrome-server.js'

async function socket(url, origin) {
  const peer = new WebSocket(url, {origin})
  const messages = []
  peer.on('message', data => messages.push(JSON.parse(data)))
  await once(peer, 'open')
  return {peer, messages}
}

async function received(connection, type) {
  let index = connection.messages.findIndex(message => message.type === type)
  while (index < 0) {
    await once(connection.peer, 'message')
    index = connection.messages.findIndex(message => message.type === type)
  }
  return connection.messages.splice(index, 1)[0]
}

test('the extension ID matches its manifest and only loopback pairing codes are accepted', async () => {
  const manifest = JSON.parse(await readFile(new URL('../chrome-extension/manifest.json', import.meta.url), 'utf8'))
  const id = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32)
    .replace(/./g, c => String.fromCharCode(97 + Number.parseInt(c, 16)))
  assert.equal(extensionOrigin, `chrome-extension://${id}`)
  const path = `/chrome/${'a'.repeat(43)}`
  assert.equal(pairingAddress(`ws://127.0.0.1:48391${path}`), `ws://127.0.0.1:48391${path}`)
  for (const url of [`ws://192.168.1.2:48391${path}`, `ws://127.0.0.1:48391${path}?q=1`, `ws://data@127.0.0.1:48391${path}`]) {
    assert.equal(pairingAddress(url), undefined)
  }
  assert.deepEqual(inputMessage({type: 'text', text: '你好', arbitrary: 1}), {type: 'text', text: '你好'})
  assert.equal(inputMessage({type: 'navigate', url: 'chrome://settings/'}), undefined)
})

test('local Chrome pairs once, forwards user input and stops sharing on request', {timeout: 5000}, async t => {
  const bridge = await openLocalChrome()
  t.after(() => bridge.close())
  const first = bridge.describe()
  const second = bridge.describe(true)
  const viewer = new URL('input', first.url)
  const viewerOrigin = viewer.origin
  viewer.protocol = 'ws:'
  await assert.rejects(socket(first.code, extensionOrigin), /403/)
  await assert.rejects(socket(second.code, new URL(first.url).origin), /403/)
  await assert.rejects(socket(viewer, extensionOrigin), /403/)
  const ui = await socket(viewer, viewerOrigin.replace('ws:', 'http:'))
  const chrome = await socket(second.code, extensionOrigin)
  assert.deepEqual(await received(chrome, 'watch'), {type: 'watch', visible: true})
  await assert.rejects(socket(second.code, extensionOrigin), /403/)
  chrome.peer.send('{"type":"ready"}')
  await received(ui, 'ready')
  assert.equal(bridge.describe().linked, true)
  chrome.peer.send('{"type":"frame","data":"/9j/41"}')
  assert.deepEqual(await received(ui, 'frame'), {type: 'frame', data: '/9j/41'})
  ui.peer.send('{"type":"navigate","url":"https://example.com/"}')
  ui.peer.send('{"type":"text","text":"真实输入","method":"Network.getCookies"}')
  assert.deepEqual(await received(chrome, 'text'), {type: 'text', text: '真实输入'})
  assert.equal(chrome.messages.length, 0)
  bridge.navigate('https://example.com')
  assert.deepEqual(await received(chrome, 'navigate'), {type: 'navigate', url: 'https://example.com/'})
  const closed = once(chrome.peer, 'close')
  bridge.endSharing()
  await closed
  await received(ui, 'ended')
  assert.notEqual(bridge.describe().code, second.code)
})
