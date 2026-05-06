import * as pty from 'node-pty'

type OutputCallback = (data: string) => void
type ExitCallback = () => void

export class PtyBridge {
  private ptyProcess: pty.IPty | null = null
  private outputCallbacks: OutputCallback[] = []
  private exitCallbacks: ExitCallback[] = []

  spawn(workingDir: string): void {
    if (this.ptyProcess) {
      this.kill()
    }

    const command = process.env.AGENT_COMMAND ?? 'claude'

    this.ptyProcess = pty.spawn(command, [], {
      name: 'xterm-color',
      cols: 220,
      rows: 50,
      cwd: workingDir,
      env: process.env as Record<string, string>,
    })

    this.ptyProcess.onData((data) => {
      for (const cb of this.outputCallbacks) cb(data)
    })

    this.ptyProcess.onExit(() => {
      this.ptyProcess = null
      for (const cb of this.exitCallbacks) cb()
    })
  }

  write(data: string): void {
    this.ptyProcess?.write(data)
  }

  resize(cols: number, rows: number): void {
    this.ptyProcess?.resize(cols, rows)
  }

  kill(): void {
    if (this.ptyProcess) {
      this.ptyProcess.kill('SIGTERM')
      this.ptyProcess = null
    }
  }

  onOutput(callback: OutputCallback): void {
    this.outputCallbacks.push(callback)
  }

  onExit(callback: ExitCallback): void {
    this.exitCallbacks.push(callback)
  }

  isAlive(): boolean {
    return this.ptyProcess !== null
  }
}
