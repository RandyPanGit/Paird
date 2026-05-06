import os from 'os'
import type { ConnectionInfo } from '../shared/types'

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces()
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue
    for (const info of iface) {
      if (info.family === 'IPv4' && !info.internal) {
        if (info.address.startsWith('192.168.') || info.address.startsWith('10.')) {
          return info.address
        }
      }
    }
  }
  return 'localhost'
}

export function getConnectionInfo(port: number): ConnectionInfo {
  const mode = (process.env.CONNECTION_MODE === 'token' ? 'token' : 'lan') as 'lan' | 'token'
  const ip = getLocalIp()
  return {
    mode,
    defaultAddress: `http://${ip}:${port}`,
    requiresToken: false,
  }
}
