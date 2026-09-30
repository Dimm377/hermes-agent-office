#!/usr/bin/env node
// Command-line entry point of the installed package: `majujaya [--port <n>]`.
import { existsSync, readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)

const help = `PT AI Maju Jaya · 3D Office ${packageJson.version}
Read-only mission control and 3D office for your Hermes Agent and OpenCode crew.

Usage: majujaya [options]

Options:
  -p, --port <port>  Port to listen on (default 3001, or MAJUJAYA_PORT)
  -v, --version      Print the version
  -h, --help         Show this help

The server listens on 127.0.0.1 only. Open http://127.0.0.1:<port> in a browser;
on a remote machine, forward the port: ssh -L 3001:127.0.0.1:3001 user@host`

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index]
  if (arg === '-h' || arg === '--help') { console.log(help); process.exit(0) }
  if (arg === '-v' || arg === '--version') { console.log(packageJson.version); process.exit(0) }
  if (arg === '-p' || arg === '--port' || arg.startsWith('--port=')) {
    const value = arg.startsWith('--port=') ? arg.slice('--port='.length) : args[(index += 1)]
    const port = Number(value)
    if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error(`Invalid port: ${value ?? '(missing)'}`); process.exit(2) }
    process.env.MAJUJAYA_PORT = String(port)
    continue
  }
  console.error(`Unknown option: ${arg}\n\n${help}`)
  process.exit(2)
}

const server = new URL('../build/server/index.js', import.meta.url)
if (!existsSync(server)) {
  console.error('PT AI Maju Jaya is not built. From a source checkout, run: npm run build')
  process.exit(1)
}
await import(server.href)
