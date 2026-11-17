const frame = document.querySelector('#frame')
const keyboard = document.querySelector('#keyboard')
const status = document.querySelector('#status')
const endpoint = new URL('input', location.href)
endpoint.protocol = 'ws:'
const socket = new WebSocket(endpoint.href)

function send(message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function report(message) {
  window.parent.postMessage({type: 'dsh-native-chrome', message}, '*')
}

function placeholder(text) {
  frame.hidden = true
  frame.removeAttribute('src')
  status.hidden = false
  status.textContent = text
}

function disconnected() {
  placeholder('网页连接已结束，可从地址栏重连。')
  report({type: 'offline'})
}

let resizeTimer
function resize() {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const width = Math.max(320, Math.min(1440, innerWidth))
    const height = Math.max(240, Math.min(1000, innerHeight))
    send({type: 'size', width, height})
  }, 80)
}

new ResizeObserver(resize).observe(document.documentElement)
socket.addEventListener('open', resize)
socket.addEventListener('message', event => {
  let message
  try { message = JSON.parse(event.data) } catch { return }
  if (message.type === 'status') {
    if (message.mode === 'manage') placeholder('独立 Chrome 窗口已打开。')
    if (message.mode === 'starting') placeholder('正在恢复网页…')
    if (message.mode === 'browser' && !message.url && frame.hidden) placeholder('')
    report(message)
  } else if (message.type === 'popup') {
    report(message)
  } else if (message.type === 'frame' && typeof message.data === 'string' && message.data.startsWith('/9j/')) {
    if (frame.hidden) report({type: 'ready'})
    frame.src = `data:image/jpeg;base64,${message.data}`
    frame.hidden = false
    status.hidden = true
  } else if (message.type === 'offline') disconnected()
})
socket.addEventListener('close', disconnected)

const mods = event => Number(event.altKey) | Number(event.ctrlKey) << 1 | Number(event.metaKey) << 2 | Number(event.shiftKey) << 3
const buttons = ['left', 'middle', 'right']

function pointer(action, event) {
  const box = frame.getBoundingClientRect()
  if (!box.width || !box.height) return
  const unit = n => Math.min(1, Math.max(0, n))
  const wheel = n => Math.min(4000, Math.max(-4000, n * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? box.height : 1)))
  send({type: 'pointer', action,
    x: unit((event.clientX - box.left) / box.width), y: unit((event.clientY - box.top) / box.height),
    button: buttons[event.button] ?? 'none', buttons: event.buttons & 7, modifiers: mods(event),
    clickCount: event.detail, ...(action === 'wheel' ? {dx: wheel(event.deltaX), dy: wheel(event.deltaY)} : {}),
  })
}

frame.addEventListener('pointerdown', event => {
  if (event.button > 2) return
  event.preventDefault()
  keyboard.focus({preventScroll: true})
  frame.setPointerCapture(event.pointerId)
  pointer('press', event)
})
frame.addEventListener('pointerup', event => pointer('release', event))
frame.addEventListener('contextmenu', event => event.preventDefault())
frame.addEventListener('wheel', event => { event.preventDefault(); pointer('wheel', event) }, {passive: false})
let nextMove
frame.addEventListener('pointermove', event => {
  if (!nextMove) requestAnimationFrame(() => {
    pointer('move', nextMove)
    nextMove = undefined
  })
  nextMove = event
})

function key(down, event) {
  if (event.isComposing || event.key === 'Process' || event.key === 'Dead') return
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') return
  event.preventDefault()
  send({ type: 'key', down, key: event.key, code: event.code, repeat: event.repeat, keyCode: event.keyCode, modifiers: mods(event) })
}
keyboard.addEventListener('keydown', event => key(true, event))
keyboard.addEventListener('keyup', event => key(false, event))
keyboard.addEventListener('compositionend', event => {
  if (event.data) send({type: 'text', text: event.data.slice(0, 4096)})
  keyboard.value = ''
})
keyboard.addEventListener('paste', event => {
  event.preventDefault()
  const text = event.clipboardData?.getData('text/plain')
  if (text) send({type: 'text', text: text.slice(0, 4096)})
})
