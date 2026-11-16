import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { extensionOrigin, inputMessage, maxFrameBytes, webAddress } from '../chrome-extension/protocol.js'

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>本机 Chrome</title><link rel="stylesheet" href="viewer.css">
<main id="screen"><img id="frame" alt="本机 Chrome 网页" draggable="false" hidden><textarea id="keyboard" aria-label="网页键盘输入" autocomplete="off" spellcheck="false"></textarea><p id="status" role="status">等待 Chrome 扩展共享当前网页…</p></main>
<script type="module" src="viewer.js"></script></html>`

const css = `html,body,#screen{width:100%;height:100%;margin:0;overflow:hidden}
body{background:#181a1b;color:#e8eaed;font:14px system-ui,sans-serif}
#screen{display:grid;grid-template: minmax(0,1fr) / minmax(0,1fr);place-items:center;position:relative}
#frame{display:block;max-width:100%;max-height:100%;width:auto;height:auto;user-select:none;touch-action:none}
#frame[hidden],#status[hidden]{display:none}
#keyboard{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;padding:0;border:0;resize:none}`

const lifetime = 5 * 60 * 1000
const token = () => randomBytes(32).toString('base64url')

export async function openLocalChrome() {
  const script = await readFile(new URL('./local-chrome-viewer.js', import.meta.url))
  const path = `/${token()}/`
  const peers = new Set()
  const sockets = new WebSocketServer({ noServer: true, maxPayload: maxFrameBytes, perMessageDeflate: false })
  let origin
  let host
  let pair
  let chrome
  let ready = false
  let frame
  let closing = false

  const assets = new Map([
    [path, ['text/html; charset=utf-8', html]],
    [`${path}viewer.css`, ['text/css; charset=utf-8', css]],
    [`${path}viewer.js`, ['text/javascript; charset=utf-8', script]],
  ])

  function send(socket, data) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(data)
  }

  function setWatching() {
    if (!peers.size) frame = undefined
    send(chrome, JSON.stringify({type: 'watch', visible: peers.size > 0}))
  }

  function broadcast(data) {
    for (const peer of peers) if (peer.bufferedAmount < 256 * 1024) send(peer, data)
  }

  function endSharing() {
    const previous = chrome
    chrome = undefined
    ready = false
    frame = undefined
    pair = undefined
    previous?.close(1000, 'Sharing ended')
    broadcast('{"type":"ended"}')
  }

  function onChrome(socket) {
    chrome = socket
    pair = undefined
    setWatching()
    socket.on('message', (raw, binary) => {
      if (binary || chrome !== socket) return
      let value
      try { value = JSON.parse(raw.toString()) } catch { return }
      if (value?.type === 'ready') {
        ready = true
        broadcast('{"type":"ready"}')
      } else if (value?.type === 'frame' && ready && peers.size && typeof value.data === 'string' && value.data.startsWith('/9j/')) {
        frame = JSON.stringify({type: 'frame', data: value.data})
        broadcast(frame)
      }
    })
    socket.on('error', () => socket.terminate())
    socket.once('close', () => { if (chrome === socket) endSharing() })
  }

  function onViewer(socket) {
    peers.add(socket)
    if (ready) send(socket, '{"type":"ready"}')
    if (frame) send(socket, frame)
    setWatching()
    socket.on('message', (raw, binary) => {
      if (binary || !ready || raw.length > 20_000) return
      let value
      try { value = inputMessage(JSON.parse(raw.toString())) } catch { return }
      if (value) send(chrome, JSON.stringify(value))
    })
    socket.on('error', () => socket.terminate())
    socket.once('close', () => { peers.delete(socket); setWatching() })
  }

  const server = createServer((request, response) => {
    const asset = request.method === 'GET' && request.headers.host === host && assets.get(request.url)
    if (!asset) { response.writeHead(404).end(); return }
    const [type, body] = asset
    response.writeHead(200, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src ws://${host}; base-uri 'none'; form-action 'none'; frame-ancestors dsh-app: http://127.0.0.1:* http://localhost:*`,
    }).end(body)
  })

  server.on('upgrade', (request, socket, head) => {
    if (!closing && request.headers.host === host) {
      if (request.headers.origin === origin && request.url === `${path}input`) {
        sockets.handleUpgrade(request, socket, head, onViewer)
        return
      }
      if (request.headers.origin === extensionOrigin && pair && Date.now() < pair.expires && request.url === pair.path) {
        sockets.handleUpgrade(request, socket, head, onChrome)
        return
      }
    }
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  host = `127.0.0.1:${server.address().port}`
  origin = `http://${host}`

  return {
    describe(renew = false) {
      if (!chrome && (renew || !pair || Date.now() >= pair.expires)) {
        pair = {path: `/chrome/${token()}`, expires: Date.now() + lifetime}
      }
      return {url: origin + path, code: pair ? `ws://${host}${pair.path}` : null, linked: ready}
    },
    navigate(value) {
      const url = webAddress(value)
      if (ready && url) send(chrome, JSON.stringify({type: 'navigate', url}))
    },
    endSharing,
    close: () => new Promise(resolve => {
      closing = true
      endSharing()
      for (const peer of sockets.clients) peer.terminate()
      sockets.close()
      server.close(resolve)
      server.closeAllConnections()
    }),
  }
}
