import { inputMessage, maxFrameBytes, pairingAddress, webAddress } from './protocol.js'

let active
let pairing = false

function command(session, method, params) {
  return chrome.debugger.sendCommand(session.target, method, params)
}

function send(session, value) {
  if (session.socket.readyState === WebSocket.OPEN) session.socket.send(JSON.stringify(value))
}

async function stop(session = active) {
  if (!session || active !== session) return
  active = undefined
  clearInterval(session.keepalive)
  session.socket.close()
  if (session.attached) await chrome.debugger.detach(session.target).catch(() => {})
}

function socketReady(socket) {
  return new Promise((resolve, reject) => {
    const failed = () => {
      clearTimeout(timer)
      reject(new Error('连接码已失效或 DSH 未打开。请重新复制连接码。'))
    }
    const timer = setTimeout(failed, 6000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', failed, { once: true })
    socket.addEventListener('close', failed, { once: true })
  })
}

function setWatching(session, watching) {
  session.watching = watching
  session.castChange = session.castChange.catch(() => {}).then(async () => {
    if (active !== session || !session.attached || session.casting === session.watching) return
    if (session.watching) {
      session.metricsKey = ''
      await command(session, 'Page.startScreencast', { format: 'jpeg', quality: 78, maxWidth: 1600, maxHeight: 1200 })
      session.casting = true
    } else {
      await command(session, 'Page.stopScreencast')
      session.casting = false
    }
  }).catch(() => { void stop(session) })
}

function sendInput(session, event) {
  if (!session.attached || !session.watching || !session.viewport) return
  if (event.type === 'text') return command(session, 'Input.insertText', { text: event.text })
  if (event.type === 'key') {
    const { down, key, code, keyCode, modifiers, repeat } = event
    const text = down && (modifiers & 7) === 0 && [...key].length === 1 ? key : undefined
    return command(session, 'Input.dispatchKeyEvent', {
      type: down ? (text ? 'keyDown' : 'rawKeyDown') : 'keyUp', key, code, modifiers,
      windowsVirtualKeyCode: keyCode, autoRepeat: repeat, ...(text ? { text, unmodifiedText: text } : {}),
    })
  }
  const { action, x, y, button, buttons, modifiers, dx, dy, clickCount } = event
  const type = {press: 'mousePressed', release: 'mouseReleased', move: 'mouseMoved', wheel: 'mouseWheel'}[action]
  const { width, height } = session.viewport
  return command(session, 'Input.dispatchMouseEvent', {
    type, x: x * Math.max(0, width - 1), y: y * Math.max(0, height - 1), button, buttons, modifiers,
    ...(action === 'wheel' ? {deltaX: dx, deltaY: dy} : {}),
    ...(clickCount === undefined ? {} : {clickCount}),
  })
}

function receive(session, raw) {
  if (active !== session || typeof raw !== 'string' || raw.length > 20_000) return
  let message
  try { message = JSON.parse(raw) } catch { return }
  if (message?.type === 'watch' && typeof message.visible === 'boolean') {
    setWatching(session, message.visible)
    return
  }
  const event = inputMessage(message)
  const url = message?.type === 'navigate' ? webAddress(message.url) : undefined
  if (!event && !url) return
  session.input = session.input.catch(() => {}).then(() => {
    if (active !== session || !session.attached) return
    if (url) return chrome.tabs.update(session.target.tabId, { url })
    return sendInput(session, event)
  }).catch(() => {})
}

async function share(message) {
  if (pairing || active) throw new Error('请先结束当前共享。')
  pairing = true
  let session
  try {
    const address = pairingAddress(message.address)
    const tab = Number.isInteger(message.tabId) ? await chrome.tabs.get(message.tabId) : undefined
    if (!address || !tab?.active || (tab.url && !webAddress(tab.url))) throw new Error('请先在 Chrome 打开并选中要共享的网页。')
    session = { target: {tabId: tab.id}, socket: new WebSocket(address), casting: false, watching: false,
      castChange: Promise.resolve(), input: Promise.resolve() }
    active = session
    session.socket.addEventListener('message', event => receive(session, event.data))
    session.socket.addEventListener('close', () => { void stop(session) }, { once: true })
    await socketReady(session.socket)
    await chrome.debugger.attach(session.target, '1.3')
    session.attached = true
    if (active !== session) {
      await chrome.debugger.detach(session.target).catch(() => {})
      throw new Error('DSH 已断开，请重新连接。')
    }
    const { frameTree } = await command(session, 'Page.getFrameTree')
    if (!webAddress(frameTree.frame.url)) throw new Error('请先在 Chrome 打开并选中要共享的网页。')
    send(session, {type: 'ready'})
    session.keepalive = setInterval(() => send(session, {type: 'ping'}), 20_000)
    setWatching(session, session.watching === true)
  } catch (error) {
    if (session) await stop(session)
    throw error
  } finally {
    pairing = false
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.url !== chrome.runtime.getURL('popup.html')) return
  if (message?.type === 'status') { reply({active: active?.attached === true}); return }
  if (!['share', 'stop'].includes(message?.type)) return
  const operation = message.type === 'share' ? share(message) : stop()
  operation.then(() => reply({ok: true}), error => reply({error: error.message}))
  return true
})

chrome.debugger.onDetach.addListener(target => {
  if (active?.target.tabId === target.tabId) void stop(active)
})

async function sendFrame(session, { data, metadata }) {
  if (!session.watching || session.frameBusy || session.socket.bufferedAmount > 256 * 1024 || data.length > maxFrameBytes - 256) return
  session.frameBusy = true
  try {
    const key = [metadata.deviceWidth, metadata.deviceHeight, metadata.pageScaleFactor].join(':')
    if (key !== session.metricsKey || !session.viewport) {
      const { cssVisualViewport } = await command(session, 'Page.getLayoutMetrics')
      session.viewport = {width: cssVisualViewport.clientWidth, height: cssVisualViewport.clientHeight}
      session.metricsKey = key
    }
    if (active === session && session.watching) send(session, {type: 'frame', data})
  } finally {
    session.frameBusy = false
  }
}

chrome.debugger.onEvent.addListener((target, method, event) => {
  const session = active
  if (method !== 'Page.screencastFrame' || session?.target.tabId !== target.tabId) return
  void sendFrame(session, event).catch(() => {})
  void command(session, 'Page.screencastFrameAck', {sessionId: event.sessionId}).catch(() => {})
})
