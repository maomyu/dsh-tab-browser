import { useEffect, useRef, useState } from 'react'
import { LocalChrome } from './local-chrome.jsx'

const ID = 'dsh-tab-browser'
const SLOT = 'sidebar.right.pane.tab'
let lastViewer
let navigations = new WeakMap()
const messages = {
  zh: {
    browser: '浏览器', title: 'Google Chrome', description: '在侧栏浏览网页',
    start: '启动 Chrome', retry: '重试', waiting: '正在启动 Chrome…',
    firstRun: '首次启动需要下载浏览器。Chrome 使用独立的浏览器资料。',
    local: '请在本机 DSH 桌面版或本机 Web 界面打开。',
    failed: 'Chrome 启动失败。',
    localMode: '本机 Chrome', isolatedMode: '独立 Chrome', browserMode: '浏览器来源',
    localInstructions: '在平时用的 Chrome 里选中已登录的网页，打开「DSH 本机 Chrome」扩展，粘贴连接码并点「共享当前网页」。',
    localConnected: '正在共享本机 Chrome 网页', stopSharing: '结束共享',
    pairCode: '连接码', copyCode: '复制连接码', copiedCode: '已复制', renewCode: '重新生成连接码',
    pairing: '正在生成连接码…', localFailed: '本机 Chrome 连接失败。',
  },
  en: {
    browser: 'Browser', title: 'Google Chrome', description: 'Browse the web in the sidebar',
    start: 'Start Chrome', retry: 'Try again', waiting: 'Starting Chrome…',
    firstRun: 'The first launch downloads Chrome. This browser uses its own profile.',
    local: 'Open this tab in the local DSH desktop app or a local DSH web session.',
    failed: 'Chrome could not start.',
    localMode: 'Local Chrome', isolatedMode: 'Separate Chrome', browserMode: 'Browser source',
    localInstructions: 'Select a signed-in page in Chrome. Open the DSH Local Chrome extension, paste the code and share the current page.',
    localConnected: 'Sharing a page from local Chrome', stopSharing: 'Stop sharing',
    pairCode: 'Connection code', copyCode: 'Copy code', copiedCode: 'Copied', renewCode: 'Get a new code',
    pairing: 'Generating a connection code…', localFailed: 'Local Chrome could not connect.',
  },
}

function localClient() {
  return window.dshDesktop?.protocolVersion === 1 || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
}

function parseViewer(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password ||
      !/^\/[A-Za-z0-9_-]{43}\/$/u.test(url.pathname) || url.search || url.hash) throw new Error()
  return url
}

function ChromeTab({ tab, t }) {
  const { revision, params } = tab.navigation
  const url = params?.url
  const [viewer, setViewer] = useState(lastViewer)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const frame = useRef(null)
  const request = useRef(null)
  const local = localClient()

  async function connect({ target, newPage = false, reconnect = false } = {}) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    if (reconnect) setViewer(null)
    setStarting(true)
    setError('')
    try {
      const response = await fetch(new URL('api/dsh-tab-browser/connect', document.baseURI), {
        method: 'POST', headers: { 'X-DSH-Chrome': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, newPage }), signal: controller.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : t('failed'))
      if (controller.signal.aborted) return
      const next = parseViewer(result.url)
      if (reconnect || lastViewer?.url.href !== next.href) {
        lastViewer = { url: next, generation: (lastViewer?.generation ?? 0) + 1 }
      }
      setViewer(lastViewer)
    } catch (error) {
      if (!controller.signal.aborted) {
        setViewer(null)
        lastViewer = undefined
        setError(error?.message || t('failed'))
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setStarting(false)
      }
    }
  }

  useEffect(() => () => {
    request.current?.abort()
    request.current = null
  }, [])
  useEffect(() => {
    if (!local || !tab.visible) return
    const previous = navigations.get(tab.signal)
    if (previous === revision && (lastViewer || request.current)) return
    navigations.set(tab.signal, revision)
    if (typeof url === 'string' && previous !== revision) void connect({ target: url })
    else if (lastViewer && previous !== undefined && previous !== revision) void connect({ newPage: true })
    else if (!lastViewer) void connect()
  }, [local, tab.visible, tab.signal, revision, url])
  useEffect(() => {
    if (!viewer) return
    const reconnect = event => {
      if (event.source === frame.current?.contentWindow && event.origin === viewer.url.origin &&
          event.data?.type === 'dsh-chrome-reconnect') void connect({ reconnect: true })
    }
    window.addEventListener('message', reconnect)
    return () => window.removeEventListener('message', reconnect)
  }, [viewer])

  return <div data-dsh-tab-chrome="">
    {viewer ? <iframe key={viewer.generation} ref={frame} title="Google Chrome" src={viewer.url.href}
      sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" /> :
      <section className="chrome-start">
        <h2>{t('title')}</h2>
        <p>{t(local ? 'description' : 'local')}</p>
        {local && <>
          <button type="button" onClick={() => connect({ target: url })} disabled={starting}>{t(starting ? 'waiting' : error ? 'retry' : 'start')}</button>
          {error ? <p role="alert">{error}</p> : <p className="chrome-note">{t('firstRun')}</p>}
        </>}
      </section>}
  </div>
}

const modeKey = 'dsh-tab-browser.mode'

function BrowserTab({ useTabInfo, t }) {
  const { tab } = useTabInfo()
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(modeKey) === 'isolated' ? 'isolated' : 'local' }
    catch { return 'local' }
  })
  function select(next) {
    setMode(next)
    try { localStorage.setItem(modeKey, next) } catch { /* DSH may restrict storage. */ }
  }
  if (!localClient()) return <ChromeTab tab={tab} t={t} />
  return <div data-dsh-chrome-mode="">
    <div className="dsh-chrome-modes" role="group" aria-label={t('browserMode')}>
      <button type="button" aria-pressed={mode === 'local'} onClick={() => select('local')}>{t('localMode')}</button>
      <button type="button" aria-pressed={mode === 'isolated'} onClick={() => select('isolated')}>{t('isolatedMode')}</button>
    </div>
    {mode === 'local' ? <LocalChrome tab={tab} t={t} parseViewer={parseViewer} /> : <ChromeTab tab={tab} t={t} />}
  </div>
}

const css = `
[data-dsh-tab-chrome]{display:flex;flex:1;width:100%;height:100%;min-height:0;min-width:0;box-sizing:border-box;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
[data-dsh-tab-chrome] iframe{display:block;flex:1;width:100%;height:100%;min-width:0;min-height:0;border:0}
[data-dsh-tab-chrome] .chrome-start{margin:auto;display:grid;gap:10px;justify-items:start;padding:24px;max-width:360px;white-space:normal}
[data-dsh-tab-chrome] h2{font-size:25px;line-height:1.2;font-weight:600;margin:0 0 3px}
[data-dsh-tab-chrome] p{margin:0;font-size:13px;line-height:1.5;overflow-wrap:anywhere}
[data-dsh-tab-chrome] .chrome-note{color:var(--dsw-alias-label-secondary);font-size:12px}
[data-dsh-tab-chrome] button{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font:inherit;font-size:13px;padding:8px 14px;cursor:pointer}
[data-dsh-tab-chrome] button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
[data-dsh-tab-chrome] button:disabled{cursor:wait;opacity:.65}
[data-dsh-chrome-mode],.dsh-local-chrome{display:flex;flex-direction:column;flex:1;width:100%;height:100%;min-height:0;min-width:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
[data-dsh-chrome-mode] button{cursor:pointer;padding:5px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;font-size:12px}
[data-dsh-chrome-mode] button[aria-pressed=true]{background:var(--dsw-alias-interactive-bg-hover);font-weight:600}
[data-dsh-chrome-mode] button:disabled{cursor:wait;opacity:.65}
.dsh-chrome-modes,.dsh-local-tools{display:flex;align-items:center;gap:6px;padding:6px 8px;flex:none;font-size:12px}
.dsh-local-tools{justify-content:space-between;padding-top:0;color:var(--dsw-alias-label-secondary)}
.dsh-local-setup{flex:none;padding:10px 14px 14px;white-space:normal;max-width:540px}
.dsh-local-setup h2{margin:0 0 8px;font-size:17px}
.dsh-local-setup p,.dsh-local-error{margin:0 0 10px;font-size:13px;line-height:1.5}
.dsh-local-error{padding:0 14px}
.dsh-chrome-code{display:flex;gap:6px;margin:0 0 8px}
.dsh-chrome-code input{flex:1;min-width:0;padding:5px 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:inherit;font-size:12px}
.dsh-chrome-code button{flex:none}
.dsh-local-chrome iframe{display:block;flex:1;width:100%;min-width:0;min-height:0;border:0}
`

export const inject = ['sidebarRightTabs', 'slots', 'locale']

export function apply(ctx) {
  const namespace = 'dshChromeTab'
  const t = ctx.locale.bind(namespace)
  ctx.effect(() => ctx.locale.register(namespace, messages), `${ID}: copy`)
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: ID, kind: 'browser', priority: 'extension', title: () => t('browser'),
    guide: [{ id: 'new', commandId: 'browser.new', order: 30, title: () => t('browser'), description: () => t('description') }],
  }), `${ID}: tab`)
  ctx.effect(() => ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, key: ID, locale: namespace }, BrowserTab)), `${ID}: body`)
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = css
    document.head.append(style)
    return () => {
      style.remove()
      lastViewer = undefined
      navigations = new WeakMap()
    }
  }, `${ID}: styles`)
}
