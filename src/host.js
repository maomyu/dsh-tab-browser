import { ChromeRuntime } from './chrome-runtime.js'
import { openViewer } from './viewer-server.js'
import { MAX_COOKIE_FILE, prepareCookieImport } from './cookie-import.js'

const CONNECT = '/api/dsh-tab-browser/connect'
const IMPORT = '/api/dsh-tab-browser/cookies'

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
    const ensureViewer = () => pending ??= connect().finally(() => { pending = undefined })

    scope.effect(() => scope.connection.fetch.register({
      path: CONNECT, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('x-dsh-chrome') !== '1') return new Response(null, { status: 403 })
        if (closing) return new Response(null, { status: 503 })
        let target
        try { target = browserTarget(await request.json(), new URL(request.url).origin) }
        catch { return Response.json({ error: '网页地址无效。' }, { status: 400 }) }
        try {
          const url = await ensureViewer()
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

    scope.effect(() => scope.connection.fetch.register({
      path: IMPORT, methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        if (request.headers.get('x-dsh-chrome') !== '1') return new Response(null, { status: 403 })
        if (closing) return new Response(null, { status: 503 })
        const noStore = { 'Cache-Control': 'no-store' }
        let plan
        try {
          const body = await request.arrayBuffer()
          if (body.byteLength > MAX_COOKIE_FILE) throw new Error()
          plan = prepareCookieImport(JSON.parse(new TextDecoder().decode(body)))
          browserTarget({ url: plan.origin }, new URL(request.url).origin)
        } catch {
          return Response.json({ error: 'Cookie 文件无效或超出大小限制。' }, { status: 400, headers: noStore })
        }
        const work = navigation.catch(() => {}).then(async () => {
          if (!viewer) await ensureViewer()
          await chrome.importCookies(plan.cookies)
          return chrome.open(plan.origin).then(() => true, () => false)
        })
        navigation = work
        try {
          const opened = await work
          return Response.json({ count: plan.cookies.length, opened }, { headers: noStore })
        } catch {
          return Response.json({ error: '独立 Chrome 无法导入 Cookie。' }, { status: 503, headers: noStore })
        }
      },
    }), 'dsh-tab-browser: import cookies')

    scope.effect(() => async () => {
      closing = true
      await pending?.catch(() => {})
      await navigation.catch(() => {})
      await viewer?.close()
      await chrome.stop()
    }, 'dsh-tab-browser: close local browser')
  })
}
