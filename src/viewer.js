import RFB from '@novnc/novnc'

const screen = document.querySelector('#screen')
const connection = document.querySelector('#connection')
const status = document.querySelector('#status')
const retry = document.querySelector('#retry')

function connect() {
  retry.hidden = true
  status.textContent = '正在连接 Chrome…'
  const endpoint = new URL('rfb', location.href)
  endpoint.protocol = 'ws:'
  const browser = new RFB(screen, endpoint.href)
  browser.scaleViewport = true
  browser.resizeSession = true
  browser.addEventListener('connect', () => { connection.hidden = true })
  browser.addEventListener('disconnect', () => {
    connection.hidden = false
    status.textContent = 'Chrome 连接已结束。'
    retry.hidden = false
  })
}

retry.addEventListener('click', () => window.parent.postMessage({ type: 'dsh-chrome-reconnect' }, '*'))
connect()
