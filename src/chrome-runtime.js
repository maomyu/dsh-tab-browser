import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { MacKeyring } from './mac-keyring.js'

const exec = promisify(execFile)
const runtime = fileURLToPath(new URL('../runtime/', import.meta.url))
const IMAGE = 'dsh-tab-chrome:0.2.2'
const PROFILE_DIR = '/home/chrome/.config/dsh-google-chrome'
const COOKIE_SOCKET = '/tmp/dsh-chrome-cookie-import.sock'
const COLIMA_PROFILE = 'dsh-chrome'
const CONTEXT = process.platform === 'darwin' ? `colima-${COLIMA_PROFILE}` : 'default'

function executable(name) {
  return ['/opt/homebrew/bin', '/usr/local/bin'].map(dir => join(dir, name)).find(file => existsSync(file)) ?? name
}

async function run(file, args, timeout = 10_000) {
  try {
    const { stdout } = await exec(file, args, { timeout, maxBuffer: 2 * 1024 * 1024 })
    return stdout.trim()
  } catch (error) {
    const message = String(error.stderr ?? '').trim().split('\n').at(-1)?.slice(0, 250)
    throw new Error(message || `${file.split('/').at(-1)} ${error.code ?? '未完成'}`)
  }
}

export class ChromeRuntime {
  constructor(profile = 'desktop') {
    const dshHome = resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'))
    const id = createHash('sha256').update(`${dshHome}\0${profile}`).digest('hex').slice(0, 20)
    this.name = `dsh-chrome-${id}`
    this.profileVolume = `dsh-chrome-profile-${id}`
    this.dockerBin = executable('docker')
    this.keyring = new MacKeyring(id)
    this.started = false
  }

  docker(args, timeout) {
    return run(this.dockerBin, this.dockerArgs(args), timeout)
  }

  dockerArgs(args) {
    return this.dockerSocket ? ['--host', this.dockerSocket, ...args] : ['--context', CONTEXT, ...args]
  }

  async ensureDocker() {
    this.dockerSocket = undefined
    const local = () => this.docker(['context', 'inspect', CONTEXT, '--format', '{{.Endpoints.docker.Host}}'])
    const colima = executable('colima')
    let socket = await local().catch(() => '')
    const running = socket.startsWith('unix://') && await this.docker(['info', '--format', '{{.ServerVersion}}']).catch(() => '')
    if (!running) {
      if (process.platform !== 'darwin') throw new Error('请先启动本机 Docker，再重试。')
      try {
        await run(colima, ['start', '--profile', COLIMA_PROFILE, '--activate=false',
          '--cpus', '2', '--memory', '4', '--disk', '25', '--mount', 'none'], 600_000)
      } catch (error) {
        throw new Error(`无法启动 Chrome 的本机 Colima 环境。${error.message}`)
      }
      socket = await local().catch(() => '')
    }
    if (!socket.startsWith('unix://')) throw new Error('Chrome 需要连接本机 Docker。')
    this.dockerSocket = socket
    if (process.platform === 'darwin') {
      // Some Colima images ship a resolver symlink whose systemd service is absent.
      await run(colima, ['ssh', '--profile', COLIMA_PROFILE, '--', 'sudo', 'sh', '-c',
        'if [ -L /etc/resolv.conf ] && [ ! -e /etc/resolv.conf ]; then rm /etc/resolv.conf && printf "nameserver 192.168.5.2\\n" > /etc/resolv.conf; fi'])
    }
  }

  async start() {
    const inspect = () => this.docker(['container', 'inspect', this.name, '--format',
      '{{.State.Running}} {{index .Config.Labels "dsh-tab-chrome.profile"}} {{.Config.Image}}']).catch(() => '')
    if (this.started && await inspect() === `true ${this.profileVolume} ${IMAGE}`) return
    await this.ensureDocker()
    const state = await inspect()
    const [running, volume, currentImage] = state.split(' ')
    let unlocked = false
    if (state && volume !== this.profileVolume) {
      throw new Error('Chrome 容器名称与本机另一个容器冲突。')
    }
    if (running !== 'true' || currentImage !== IMAGE) {
      const image = await this.docker(['image', 'inspect', IMAGE, '--format', '{{.Id}}']).catch(() => '')
      if (!image) {
        try { await this.docker(['build', '--tag', IMAGE, runtime], 900_000) }
        catch (error) { throw new Error(`Chrome 下载或构建失败。${error.message}`) }
      }
      if (running === 'true') {
        this.started = true
        await this.stop({ graceful: false })
      } else if (state) {
        await this.docker(['container', 'rm', this.name])
      }
      const savedPassword = await this.keyring.read()
      try {
        await this.docker(['run', '--detach', '--rm', '--init', '--name', this.name, '--hostname', this.name,
          '--label', `dsh-tab-chrome.profile=${this.profileVolume}`, '--shm-size', '768m', '--cap-drop', 'ALL',
          '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${join(runtime, 'seccomp.json')}`,
          '--mount', `type=volume,source=${this.profileVolume},target=/home/chrome`, IMAGE,
          ...(savedPassword ? ['--unlock-keyring'] : [])], 45_000)
        if (savedPassword) unlocked = await this.keyringCommand('send', savedPassword)
      } finally {
        savedPassword?.fill(0)
      }
    }
    this.started = true
    try {
      const singletonReady = unlocked ? ` && test -S ${PROFILE_DIR}/SingletonSocket` : ''
      for (let attempt = 0; attempt < 40; attempt++) {
        const ready = await this.docker(['exec', this.name, 'sh', '-c',
          `test -S /tmp/.X11-unix/X19 && test -S ${COOKIE_SOCKET} && nc -z 127.0.0.1 5900 && pgrep -x chrome >/dev/null${singletonReady}`]).then(() => true, () => false)
        if (ready) return
        await delay(500)
      }
      throw new Error('Chrome 启动超时。请检查 Colima 与 Chrome 容器状态后重试。')
    } catch (error) {
      await this.stop()
      throw error
    }
  }

  connectDisplay() {
    return spawn(this.dockerBin, this.dockerArgs(['exec', '-i', this.name, 'nc', '-N', '127.0.0.1', '5900']),
      { stdio: ['pipe', 'pipe', 'ignore'] })
  }

  async open(url) {
    await this.docker(['exec', this.name, 'google-chrome-stable', `--user-data-dir=${PROFILE_DIR}`, '--new-tab', url])
  }

  keyringCommand(action, password) {
    return new Promise(resolve => {
      const child = execFile(this.dockerBin, this.dockerArgs(['exec', '-i', this.name,
        'python3', '/usr/local/bin/chrome-keyring.py', action]), { timeout: 24_000, maxBuffer: 1024 }, error => resolve(!error))
      child.stdin.on('error', () => {})
      child.stdin.end(password)
    })
  }

  async importCookies(cookies) {
    const result = await new Promise((resolve, reject) => {
      const child = execFile(this.dockerBin, this.dockerArgs(['exec', '-i', this.name,
        'python3', '/usr/local/bin/chrome-cookie-pipe.py', '--import']), { timeout: 30_000, maxBuffer: 1024 }, (error, stdout) => {
        if (error) reject(new Error('Chrome 无法导入 Cookie。'))
        else resolve(stdout.trim())
      })
      child.stdin.on('error', () => {})
      child.stdin.end(JSON.stringify(cookies) + '\n')
    })
    if (result !== 'ok') throw new Error('Chrome 无法导入 Cookie。')
  }

  async stop({ graceful = true } = {}) {
    if (!this.started) return
    this.started = false
    try {
      // Chrome flushes its persistent cookie store before exiting.
      const closed = graceful && await this.docker(['exec', this.name,
        'python3', '/usr/local/bin/chrome-cookie-pipe.py', '--shutdown'], 7_000).then(() => true, () => false)
      if (!closed) {
        await this.docker(['exec', this.name, 'sh', '-c', 'kill -TERM "$(pgrep -ox chrome)"'], 3_000)
      }
      await this.docker(['wait', this.name], 12_000)
    } catch {
      await this.docker(['stop', '--time', '4', this.name], 8_000).catch(() => {})
    }
  }
}
