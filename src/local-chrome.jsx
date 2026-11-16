import { useEffect, useRef, useState } from 'react'

function endpoint() {
  return new URL('api/dsh-tab-browser/local', document.baseURI)
}

function localRequest(body, signal) {
  return fetch(endpoint(), {
    method: 'POST', headers: {'X-DSH-Chrome': '1', 'Content-Type': 'application/json'},
    body: JSON.stringify(body), signal,
  })
}

const handled = new WeakMap()

export function LocalChrome({ tab, t, parseViewer }) {
  const [room, setRoom] = useState(null)
  const [state, setState] = useState('waiting')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const iframe = useRef(null)
  const input = useRef(null)
  const request = useRef(null)
  const { revision, params } = tab.navigation
  const target = typeof params?.url === 'string' ? params.url : undefined

  async function load(action, url) {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setCopied(false)
    setError('')
    try {
      const response = await localRequest({action, url}, controller.signal)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || t('localFailed'))
      if (controller.signal.aborted) return
      setRoom({ url: parseViewer(result.url), code: typeof result.code === 'string' ? result.code : '' })
      setState(result.linked ? 'ready' : 'waiting')
    } catch (error) {
      if (!controller.signal.aborted) setError(error.message || t('localFailed'))
    } finally {
      if (request.current === controller) setLoading(false)
    }
  }

  useEffect(() => {
    if (!tab.visible) return
    const navigated = handled.get(tab.signal) !== revision
    handled.set(tab.signal, revision)
    void load('open', navigated ? target : undefined)
    return () => request.current?.abort()
  }, [tab.visible, tab.signal, revision, target])

  useEffect(() => {
    const stop = () => { void localRequest({ action: 'stop' }).catch(() => {}) }
    tab.signal.addEventListener('abort', stop, { once: true })
    return () => tab.signal.removeEventListener('abort', stop)
  }, [tab.signal])

  useEffect(() => {
    if (!room) return
    const onMessage = event => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== room.url.origin || event.data?.type !== 'dsh-local-chrome') return
      if (event.data.state === 'ready') setState('ready')
      if (event.data.state === 'ended') setState('ended')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [room])

  async function copy() {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
    } catch { input.current?.select() }
  }

  async function stop() {
    try {
      const response = await localRequest({action: 'stop'})
      if (!response.ok) throw new Error()
      setState('ended')
    } catch { setError(t('localFailed')) }
  }

  return <div className="dsh-local-chrome">
    {state === 'ready' ? <div className="dsh-local-tools">
      <span>{t('localConnected')}</span><button type="button" onClick={stop}>{t('stopSharing')}</button>
    </div> : <section className="dsh-local-setup">
      <h2>{t('localMode')}</h2>
      <p>{t('localInstructions')}</p>
      {state === 'waiting' && room?.code && <div className="dsh-chrome-code">
        <input ref={input} readOnly spellCheck={false} aria-label={t('pairCode')} value={room.code} />
        <button type="button" onClick={copy}>{t(copied ? 'copiedCode' : 'copyCode')}</button>
      </div>}
      <button type="button" onClick={() => load('renew')} disabled={loading}>{t(loading ? 'pairing' : 'renewCode')}</button>
    </section>}
    {error && <p role="alert" className="dsh-local-error">{error}</p>}
    {tab.visible && room && <iframe title={t('localMode')} src={room.url.href} ref={iframe}
      sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" />}
  </div>
}
