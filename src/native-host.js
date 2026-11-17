import { MAX_COOKIE_FILE, prepareCookieImport } from './cookie-import.js'
import { NativeChrome } from './native-chrome.js'
import { openPageStreams } from './page-stream.js'

export function registerNativeChrome(scope, isLocal, browserTarget) {
  const engine = new NativeChrome(scope.get('profileContext')?.name)
  let queue = Promise.resolve()
  let streams
  let closing = false
  const enqueue = action => queue = queue.catch(() => {}).then(action)
  engine.onManagerClosed = () => {
    if (!closing) return enqueue(() => engine.changeMode('browser')).catch(() => {})
  }

  scope.effect(() => scope.connection.fetch.register({
    path: '/api/dsh-tab-browser/native', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      if (!isLocal(request)) return new Response(null, {status: 403})
      if (closing) return new Response(null, {status: 503})
      const reply = (data, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}})
      let data, url, importPlan
      try {
        const body = await request.arrayBuffer()
        if (body.byteLength > MAX_COOKIE_FILE + 4096) throw new Error()
        data = JSON.parse(new TextDecoder().decode(body))
        if (typeof data.key !== 'string' || data.key.length < 1 || data.key.length > 256 ||
            !['attach', 'navigate', 'back', 'forward', 'reload', 'release', 'manage', 'openWindow', 'resume', 'import'].includes(data.action)) {
          throw new Error()
        }
        const origin = request.headers.get('host') ? new URL(`http://${request.headers.get('host')}`).origin : new URL(request.url).origin
        if (data.action === 'attach' || data.action === 'navigate') url = browserTarget({url: data.url}, origin)
        if (data.action === 'navigate' && !url) throw new Error()
        if (data.action === 'import') {
          importPlan = prepareCookieImport(data.bundle)
          browserTarget({url: importPlan.origin}, origin)
        }
      } catch {
        return reply({error: '网页地址、请求或 Cookie 文件无效。'}, 400)
      }
      try {
        return await enqueue(async () => {
          if (data.action === 'release') {
            const tab = engine.tabs.get(data.key)
            if (tab) {
              streams?.remove(tab)
              await engine.release(tab)
            }
            return reply({})
          }
          const tab = engine.tab(data.key)
          if (data.action === 'openWindow') {
            if (!tab.url) return reply({error: '请先打开网页。'}, 409)
            await engine.changeMode('manage', tab.url)
          }
          if (data.action === 'manage') await engine.changeMode('manage')
          if (data.action === 'resume') await engine.changeMode('browser')
          if (engine.mode !== 'browser' && !['attach', 'manage', 'openWindow'].includes(data.action)) {
            return reply({error: '请先返回 DSH 浏览。'}, 409)
          }
          if (engine.mode === 'browser') {
            if (data.action === 'import') {
              await engine.start()
              await engine.pipe.send('Storage.setCookies', {cookies: importPlan.cookies})
              await engine.page(tab)
              const opened = await engine.navigate(tab, importPlan.origin).then(() => true, () => false)
              return reply({opened, count: importPlan.cookies.length})
            }
            await engine.start()
            const popup = data.action === 'attach' && typeof data.popup === 'string' && engine.popups.has(data.popup) ? data.popup : undefined
            if (!tab.session && url && !popup) tab.url = url
            await engine.page(tab, popup)
            if (!popup && url && tab.url !== url) await engine.navigate(tab, url)
            if (data.action === 'reload') await engine.pipe.send('Page.reload', {}, tab.session)
            if (data.action === 'back' || data.action === 'forward') await engine.history(tab, data.action === 'back' ? -1 : 1)
            void engine.watching(tab)
          } else if (url && !tab.url) tab.url = url
          streams ??= await openPageStreams(engine)
          return reply({...engine.status(tab), viewer: streams.urlFor(tab)})
        })
      } catch (error) {
        return reply({error: data.action === 'import' ? 'Chrome 无法导入 Cookie。' : error.message}, 503)
      }
    },
  }), 'dsh-tab-browser: native Chrome')
  scope.effect(() => async () => {
    closing = true
    await queue.catch(() => {})
    await streams?.close()
    await engine.closePipe()
  }, 'dsh-tab-browser: close native Chrome')
}
