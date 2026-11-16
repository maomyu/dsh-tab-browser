import { execFile } from 'node:child_process'

const KEYCHAIN = '/usr/bin/security'
const SERVICE = 'com.dshdeck.dsh-tab-browser.keyring'
export const MAX_KEYRING_PASSWORD = 1024

export class MacKeyring {
  constructor(account) {
    this.account = account
    this.supported = process.platform === 'darwin'
  }

  command(args, input) {
    return new Promise(resolve => {
      const child = execFile(KEYCHAIN, args, { timeout: 12_000, maxBuffer: 8192 }, (error, stdout) => {
        resolve({ exit: error?.code ?? 0, stdout })
      })
      child.stdin.on('error', () => {})
      child.stdin.end(input)
    })
  }

  async read() {
    if (!this.supported) return undefined
    const result = await this.command(['find-generic-password', '-s', SERVICE, '-a', this.account, '-w'])
    const value = result.stdout.trim()
    if (result.exit !== 0 || !/^(?:[\da-f]{2}){1,1024}$/u.test(value)) return undefined
    return Buffer.from(value, 'hex')
  }

  async enabled() {
    if (!this.supported) return false
    const result = await this.command(['find-generic-password', '-s', SERVICE, '-a', this.account])
    return result.exit === 0
  }

  async save(password) {
    // The account is a profile hash. Encode the password so it can be sent on
    // stdin without command quoting or placing the secret in process arguments.
    await this.command(['-i'], `add-generic-password -U -s ${SERVICE} -a ${this.account} -w ${password.toString('hex')}\n`)
    const saved = await this.read()
    try {
      return saved?.equals(password) === true
    } finally {
      saved?.fill(0)
    }
  }

  async forget() {
    const result = await this.command(['delete-generic-password', '-s', SERVICE, '-a', this.account])
    return result.exit === 0 || result.exit === 44
  }
}
