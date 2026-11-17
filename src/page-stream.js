import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { inputMessage } from './page-input.js'

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chrome</title><link rel="stylesheet" href="viewer.css">
<img id="frame" alt="" hidden draggable="false"><textarea id="keyboard" aria-label="网页输入" tabindex="-1"></textarea>
<div id="status" role="status">正在打开网页…</div><script src="viewer.js"></script></html>`
const css = `html,body{width:100%;height:100%;margin:0;overflow:hidden}body{display:grid;place-items:center;background:#fff;color:#666;font:14px system-ui,sans-serif}
#frame{display:block;max-width:100%;max-height:100%;width:auto;height:auto;user-select:none;touch-action:none}#frame[hidden],[hidden]{display:none}
#keyboard{position:absolute;left:0;top:0;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none}
@media(prefers-color-scheme:dark){body{background:#171717;color:#a1a1a1}}`

export async function openPageStreams(engine) {
  const script = await readFile(new URL('./page-viewer.js', import.meta.url))
  const assets = new Map([
    ['', ['text/html; charset=utf-8', html]],
    ['viewer.css', ['text/css; charset=utf-8', css]],
    ['viewer.js', ['text/javascript; charset=utf-8', script]],
  ])
  const paths = new Map()
  const streams = new WebSocketServer({noServer: true, maxPayload: 24 * 1024, perMessageDeflate: false})
  let endpoint
  const server = createServer((request, response) => {
    const [, token, name, extra] = (request.url ?? '').split('/')
    const asset = request.method === 'GET' && request.headers.host === endpoint?.host &&
      !extra && paths.has(token) && assets.get(name)
    if (!asset) { response.writeHead(404).end(); return }
    const [type, body] = asset
    response.writeHead(200, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src ws://${endpoint.host}; base-uri 'none'; form-action 'none'; frame-ancestors dsh-app: http://127.0.0.1:* http://localhost:*`,
    }).end(body)
  })
  server.on('upgrade', (request, socket, head) => {
    const [, token, name, extra] = (request.url ?? '').split('/')
    const tab = paths.get(token)
    if (request.headers.host !== endpoint?.host || request.headers.origin !== endpoint?.origin ||
      name !== 'input' || extra !== undefined || !tab) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    streams.handleUpgrade(request, socket, head, peer => {
      tab.peers.add(peer)
      peer.on('error', () => peer.terminate())
      peer.on('close', () => {
        tab.peers.delete(peer)
        void engine.watching(tab)
      })
      peer.on('message', (data, binary) => {
        if (binary) return
        let event
        try { event = inputMessage(JSON.parse(data)) } catch { return }
        if (event) void engine.input(tab, event).catch(() => {})
      })
      peer.send(JSON.stringify(engine.status(tab)))
      void engine.watching(tab)
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  endpoint = new URL(`http://127.0.0.1:${server.address().port}`)
  return {
    urlFor(tab) {
      if (!tab.streamToken) {
        tab.streamToken = randomBytes(32).toString('base64url')
        paths.set(tab.streamToken, tab)
        tab.notify = message => {
          if (!tab.peers.size) return
          const serialized = JSON.stringify(message)
          for (const peer of tab.peers) {
            if (peer.readyState !== WebSocket.OPEN) continue
            if (message.type === 'frame' && peer.bufferedAmount > 256 * 1024) continue
            peer.send(serialized)
          }
        }
      }
      return new URL(`/${tab.streamToken}/`, endpoint).href
    },
    remove(tab) {
      paths.delete(tab.streamToken)
      tab.notify = undefined
      for (const peer of tab.peers) peer.terminate()
    },
    close() {
      for (const peer of streams.clients) peer.terminate()
      streams.close()
      return new Promise(resolve => {
        server.close(resolve)
        server.closeAllConnections()
      })
    },
  }
}
