import { spawnSync } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEFAULT_VARS_FILE = '.prod.vars'

const args = process.argv.slice(2)
let varsFile = DEFAULT_VARS_FILE
let envName = ''
let dryRun = false
let varDelimiter = ':'

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]
  if (arg === '--vars-file' && args[i + 1]) {
    varsFile = args[i + 1]
    i += 1
    continue
  }
  if (arg === '--env' && args[i + 1]) {
    envName = args[i + 1]
    i += 1
    continue
  }
  if (arg === '--var-delimiter' && args[i + 1]) {
    varDelimiter = args[i + 1]
    i += 1
    continue
  }
  if (arg === '--dry-run') {
    dryRun = true
  }
}

const parseEnvFile = (content) => {
  const entries = new Map()
  const lines = content.split(/\r?\n/)
  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const line = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed
    const index = line.indexOf('=')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) {
      entries.set(key, value)
    }
  }
  return entries
}

const run = (command, commandArgs) => {
  if (dryRun) {
    process.stdout.write(`dry-run: ${command} ${commandArgs.join(' ')}\n`)
    return
  }
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const fileContent = readFileSync(varsFile, 'utf8')
const entries = parseEnvFile(fileContent)
if (!entries.size) {
  throw new Error(`No variables found in ${varsFile}`)
}

const secrets = new Map()
const vars = new Map()

for (const [key, value] of entries.entries()) {
  if (key.endsWith('_SECRET')) {
    secrets.set(key, value)
  } else {
    vars.set(key, value)
  }
}

run('pnpm', ['build'])

let tempSecretsPath = ''
if (secrets.size) {
  const secretsBody = Array.from(secrets.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  tempSecretsPath = join(tmpdir(), `wrangler-secrets-${Date.now()}.env`)
  writeFileSync(tempSecretsPath, secretsBody, { mode: 0o600 })
  const secretArgs = ['exec', 'wrangler', 'secret', 'bulk', tempSecretsPath]
  if (envName) {
    secretArgs.push('--env', envName)
  }
  run('pnpm', secretArgs)
}

const deployArgs = ['exec', 'wrangler', 'deploy', '--keep-vars']
for (const [key, value] of vars.entries()) {
  deployArgs.push('--var', `${key}${varDelimiter}${value}`)
}
if (envName) {
  deployArgs.push('--env', envName)
}
run('pnpm', deployArgs)

if (tempSecretsPath && !dryRun) {
  unlinkSync(tempSecretsPath)
}
