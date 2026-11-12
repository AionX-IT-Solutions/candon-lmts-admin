import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dirname, '..')

delete process.env.ELECTRON_RUN_AS_NODE
delete process.env.ELECTRON_NO_ATTACH_CONSOLE

const child = spawn('npx', ['electron-vite', 'dev'], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
  shell: true
})

child.on('close', (code) => process.exit(code ?? 0))
