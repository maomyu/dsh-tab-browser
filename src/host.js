import { ChromeRuntime } from './chrome-runtime.js'
import { openViewer } from './viewer-server.js'

const CONNECT = '/api/dsh-tab-browser/connect'

export function browserTarget(data, applicationOrigin) {
  if (data?.url === undefined) return data?.newPage === true ? 'chrome://newtab/' : undefined
  if (typeof data.url !== 'string' || data.url.length > 16_384) throw new Error('网页地址无效。')
  const url = new URL(data.url)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.origin === applicationOrigin) {
    throw new Error('浏览器 Tab 只接收公开格式的 HTTP(S) 网页地址。')
  }
  return url.href
}

export function apply(ctx) {
  ctx.inject(['connection'], scope => {
    const chrome = new ChromeRuntime(scope.get('profileContext')?.name)
    let pending
    let viewer
    let closing = false
    let navigation = Promise.resolve()

    async function connect() {
      await chrome.start()
      viewer ??= await openViewer(chrome)
      return viewer.url
    }

    scope.effect(() => scope.connection.fetch.register({
      path: CONNECT, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('x-dsh-chrome') !== '1') return new Response(null, { status: 403 })
        if (closing) return new Response(null, { status: 503 })
        let target
        try { target = browserTarget(await request.json(), new URL(request.url).origin) }
        catch { return Response.json({ error: '网页地址无效。' }, { status: 400 }) }
        pending ??= connect().finally(() => { pending = undefined })
        try {
          const url = await pending
          if (target) {
            navigation = navigation.catch(() => {}).then(() => chrome.open(target))
            await navigation
          }
          return Response.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
        } catch (error) {
          return Response.json({ error: error.message }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
        }
      },
    }), 'dsh-tab-browser: connect')

    scope.effect(() => async () => {
      closing = true
      await pending?.catch(() => {})
      await navigation.catch(() => {})
      await viewer?.close()
      await chrome.stop()
    }, 'dsh-tab-browser: close local browser')
  })
}
