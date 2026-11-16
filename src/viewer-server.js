import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createWebSocketStream, WebSocketServer } from 'ws'

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Google Chrome</title><link rel="stylesheet" href="viewer.css"><main id="screen"></main>
<section id="connection" role="status"><span id="status">正在连接 Chrome…</span><button id="retry" hidden>重连</button></section>
<script type="module" src="viewer.js"></script></html>`
const css = `html,body,#screen{width:100%;height:100%;margin:0;overflow:hidden}body{background:#181a1b;color:#e8eaed;font:14px system-ui,sans-serif}
#connection{position:absolute;inset:0;display:grid;align-content:center;justify-items:center;gap:12px;background:#181a1b}
#connection[hidden],button[hidden]{display:none}button{font:inherit;color:inherit;background:#303337;border:1px solid #626569;border-radius:6px;padding:6px 12px;cursor:pointer}`

export async function openViewer(chrome) {
  const js = await readFile(new URL('./viewer.js', import.meta.url))
  const path = `/${randomBytes(32).toString('base64url')}/`
  const frames = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024, perMessageDeflate: false })
  let endpoint
  let active
  const assets = new Map([
    [path, ['text/html; charset=utf-8', html]],
    [`${path}viewer.css`, ['text/css; charset=utf-8', css]],
    [`${path}viewer.js`, ['text/javascript; charset=utf-8', js]],
  ])
  const server = createServer((req, res) => {
    const asset = req.method === 'GET' && req.headers.host === endpoint?.host && assets.get(req.url)
    if (!asset) { res.writeHead(404).end(); return }
    const [type, body] = asset
    res.writeHead(200, {
      'Content-Type': type, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src ws://${endpoint.host}; base-uri 'none'; form-action 'none'; frame-ancestors dsh-app: http://127.0.0.1:* http://localhost:*`,
    }).end(body)
  })
  server.on('upgrade', (req, socket, head) => {
    if (req.headers.host !== endpoint?.host || req.headers.origin !== endpoint?.origin || req.url !== `${path}rfb`) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      return
    }
    frames.handleUpgrade(req, socket, head, ws => {
      active?.terminate()
      active = ws
      const child = chrome.connectDisplay()
      const stream = createWebSocketStream(ws)
      const close = () => {
        if (active === ws) active = undefined
        child.stdin.destroy()
        child.kill()
        ws.terminate()
      }
      child.once('error', close)
      child.once('exit', close)
      child.stdin.on('error', close)
      stream.once('error', close)
      stream.once('close', close)
      child.stdout.pipe(stream)
      stream.pipe(child.stdin)
    })
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  endpoint = new URL(`http://127.0.0.1:${server.address().port}${path}`)
  return {
    url: endpoint.href,
    close: () => new Promise(resolve => {
      active?.terminate()
      frames.close()
      server.close(resolve)
      server.closeAllConnections()
    }),
  }
}
