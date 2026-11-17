import { useEffect, useRef, useState } from 'react'
import { BrowserToolbar } from './browser-toolbar.jsx'
import { browserAddress, usesDesktopPage } from './browser-navigation.js'
import { webAddress } from './page-input.js'

async function workspaceKey(source, sessionId, signal) {
  signal.throwIfAborted()
  if (source.getSnapshot().phase !== 'ready') {
    await new Promise((resolve, reject) => {
      const abort = () => { stop(); reject(signal.reason) }
      const ready = () => {
        if (source.getSnapshot().phase !== 'ready') return
        stop()
        signal.removeEventListener('abort', abort)
        resolve()
      }
      const stop = source.subscribe(ready)
      signal.addEventListener('abort', abort, {once: true})
      ready()
    })
  }
  const workspace = source.getSnapshot().items.find(item => item.sessionIds.includes(sessionId))
  return workspace ? `cwd:${workspace.path}` : `session:${sessionId}`
}

const empty = {url: '', title: '', back: false, forward: false}

export function DesktopTab({tab, t, navigation, workspace, sessionId, bridge, onSwitch}) {
  const viewport = useRef(null)
  const current = useRef(null)
  const desired = useRef(navigation.url)
  const [state, setState] = useState(empty)
  const [error, setError] = useState(false)
  const [generation, setGeneration] = useState(0)

  function load(target) {
    const url = webAddress(target)
    if (!url || new URL(url).origin === location.origin) return
    desired.current = url
    const guest = current.current
    if (!guest?.ready) return
    setError(false)
    const revision = ++guest.revision
    void guest.element.loadURL(url).catch(failure => {
      if (current.current === guest && revision === guest.revision && failure.code !== 'ERR_ABORTED') {
        setError(true)
      }
    })
  }

  useEffect(() => { load(navigation.url) }, [navigation])

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([tab.signal, controller.signal])
    let lease
    let element
    const dispose = () => {
      if (current.current?.element === element) current.current = null
      element?.remove()
      if (lease) {
        const held = lease
        lease = undefined
        void Promise.resolve(bridge.release(held)).catch(() => {})
      }
    }
    signal.addEventListener('abort', dispose, {once: true})
    void (async () => {
      const key = await workspaceKey(workspace, sessionId, signal)
      signal.throwIfAborted()
      const reservation = await bridge.acquire(key)
      lease = reservation.lease
      if (signal.aborted) {
        dispose()
        return
      }
      element = document.createElement('webview')
      element.className = 'desktop-guest'
      element.setAttribute('name', lease)
      element.setAttribute('partition', reservation.partition)
      element.setAttribute('allowpopups', '')
      element.setAttribute('src', 'about:blank#' + lease)
      const guest = {element, ready: false, revision: 0}
      current.current = guest
      const stopOpen = bridge.onOpenRequested(lease, value => {
        const url = webAddress(value)
        if (!signal.aborted && url && new URL(url).origin !== location.origin) {
          tab.actions.openTab('browser', {params: {url}, revealIfOpened: false})
        }
      })
      signal.addEventListener('abort', stopOpen, {once: true})
      const update = () => {
        const url = webAddress(element.getURL())
        if (!url) return
        setState({url, title: element.getTitle(), back: element.canGoBack(), forward: element.canGoForward()})
      }
      element.addEventListener('dom-ready', () => {
        if (guest.ready) return
        guest.ready = true
        load(desired.current)
      }, {signal})
      for (const event of ['did-navigate', 'page-title-updated', 'did-stop-loading']) {
        element.addEventListener(event, update, {signal})
      }
      element.addEventListener('did-navigate-in-page', event => {
        if (event.isMainFrame) update()
      }, {signal})
      element.addEventListener('did-fail-load', event => {
        if (event.isMainFrame && event.errorCode !== -3) setError(true)
      }, {signal})
      element.addEventListener('render-process-gone', () => {
        controller.abort()
        setError(true)
      }, {signal})
      viewport.current.append(element)
    })().catch(() => {
      if (!signal.aborted) {
        controller.abort()
        setError(true)
      }
    })
    return () => controller.abort()
  }, [bridge, workspace, sessionId, tab.signal, tab.actions, generation])

  const reload = () => current.current?.element.reload()
  useEffect(() => tab.actions.bindCommands({refresh: reload}), [tab.actions])

  return <div data-dsh-tab-chrome="" className="chrome-native">
    <BrowserToolbar t={t} url={state.url || navigation.url} title={state.title}
      canBack={state.back} canForward={state.forward} canReload={Boolean(state.url)}
      onBack={() => current.current?.element.goBack()} onForward={() => current.current?.element.goForward()}
      onReload={reload} onNavigate={url => {
        if (usesDesktopPage(url)) load(url)
        else onSwitch(url)
      }} />
    {error && <div className="chrome-alert" role="alert">
      {t('pageFailed')}
      <button type="button" onClick={() => {
        if (current.current?.ready) load(desired.current)
        else {
          setError(false)
          setGeneration(value => value + 1)
        }
      }}>{t('retry')}</button>
    </div>}
    <div className="desktop-viewport" ref={viewport} />
  </div>
}
