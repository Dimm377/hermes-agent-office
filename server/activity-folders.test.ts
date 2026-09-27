import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FolderError, folderAgents, hermesRoot, listFolder, readFolderFile, safeRelativePath } from './folders.js'
import { buildOfficeSnapshot, collectAgentActivity, CommandError, parseRecentActivity, type AgentActivitySnapshot } from './mission-control.js'

const at = '2026-09-27T12:00:00.000Z'
const runtime = { profiles: { availability: 'available' as const, data: [] }, gateways: { default: { availability: 'available' as const, data: 'Running' as const }, leadEngineer: { availability: 'available' as const, data: 'Running' as const } }, openCode: { availability: 'available' as const, data: '1' }, fetchedAt: at }
const emptyBoard = { tasks: { availability: 'available' as const, data: [] }, fetchedAt: at }
const emptyActivity = { sessions: { availability: 'available' as const, data: [] }, fetchedAt: at }
const quiet = (profile: string) => ({ profile, availability: 'available' as const, active: false, mentionsOpenCode: false })

describe('live agent activity', () => {
  it('classifies chat replies, cron runs and tool use from agent.log', () => {
    const chat = parseRecentActivity('--- ~/.hermes/logs/agent.log [since=3m] (last 80) ---\n2026-09-27 12:00:01,000 INFO [tg:1] gateway.platforms.telegram: inbound message from user\n2026-09-27 12:00:02,000 INFO [tg:1] run_agent: turn started\n')
    expect(chat).toMatchObject({ active: true, kind: 'chat', label: 'Replying to a chat', lastSeen: '2026-09-27 12:00:02,000' })
    expect(parseRecentActivity('2026-09-27 12:00:01,000 INFO cron.scheduler: running job a1b2\n')).toMatchObject({ kind: 'cron', label: 'Running a scheduled job' })
    expect(parseRecentActivity('2026-09-27 12:00:01,000 INFO tools.terminal: running `opencode run fix`\n')).toMatchObject({ kind: 'tools', mentionsOpenCode: true })
  })

  it('ignores gateway polling noise and CLI housekeeping', () => {
    expect(parseRecentActivity('2026-09-27 12:00:01,000 INFO gateway.run: heartbeat ok\n2026-09-27 12:00:02,000 INFO hermes_cli.status: loaded\n')).toMatchObject({ active: false })
  })

  it('treats a session active in the last minutes as a conversation', () => {
    const sessions = `${'Title'.padEnd(32)} ${'Preview'.padEnd(40)} ${'Last Active'.padEnd(13)} ID\n${'─'.repeat(110)}\n${'Ask about invoices'.padEnd(32)} ${'hi'.padEnd(40)} ${'1m ago'.padEnd(13)} 20260927_120000_abc123\n`
    expect(parseRecentActivity('', sessions)).toMatchObject({ active: true, kind: 'chat' })
    expect(parseRecentActivity('', sessions.replace('1m ago', '2h ago'))).toMatchObject({ active: false })
  })

  it('probes each station profile with fixed commands and treats a missing log as quiet', async () => {
    const calls: string[] = []
    const snapshot = await collectAgentActivity(async (_file, args) => {
      calls.push(args.join(' '))
      if (args.includes('logs') && args[1] === 'leadengineer') throw new CommandError('Command exited with code 1.', 'COMMAND_FAILED', 'Log file not found: x')
      if (args.includes('logs')) return '2026-09-27 12:00:01,000 INFO run_agent: turn started\n'
      return 'No sessions found.\n'
    })
    expect(calls).toContain('-p default logs agent -n 80 --since 3m')
    expect(calls).toContain('-p leadengineer sessions list --limit 3')
    expect(snapshot.agents).toMatchObject([{ profile: 'default', availability: 'available', active: true, kind: 'thinking' }, { profile: 'leadengineer', availability: 'available', active: false }])
  })
})

describe('office placement from live activity', () => {
  const live = (agents: AgentActivitySnapshot['agents']): AgentActivitySnapshot => ({ agents, fetchedAt: at })

  it('moves a chatting or scheduled agent out of the Lounge into the Workspace', () => {
    const office = buildOfficeSnapshot(runtime, emptyBoard, emptyActivity, { now: at, agentActivity: live([
      { profile: 'default', availability: 'available', active: true, kind: 'chat', label: 'Replying to a chat', mentionsOpenCode: false },
      { profile: 'leadengineer', availability: 'available', active: true, kind: 'cron', label: 'Running a scheduled job', mentionsOpenCode: true },
    ]) })
    expect(office.stations).toMatchObject([
      { name: 'Lead Agent', state: 'Collaborating', room: 'Workspace', roomPosition: 'meeting-area', activity: 'Replying to a chat', seat: 1 },
      { name: 'Lead Engineer', state: 'Working', room: 'Workspace', roomPosition: 'assigned-desk', activity: 'Running a scheduled job', seat: 2 },
      { name: 'OpenCode', state: 'Working', room: 'Workspace', activity: 'Building via OpenCode', seat: 3 },
    ])
    expect(office.summary).toMatchObject({ active: 3, idle: 0 })
  })

  it('keeps quiet agents in the Lounge and shows live work even when the gateway is stopped', () => {
    const quietOffice = buildOfficeSnapshot(runtime, emptyBoard, emptyActivity, { now: at, agentActivity: live([quiet('default'), quiet('leadengineer')]) })
    expect(quietOffice.stations.map((station) => [station.state, station.room, station.activity])).toEqual([['Idle', 'Lounge', 'On a break'], ['Idle', 'Lounge', 'On a break'], ['Idle', 'Lounge', 'On a break']])
    const stopped = buildOfficeSnapshot({ ...runtime, gateways: { ...runtime.gateways, leadEngineer: { availability: 'available', data: 'Stopped' } } }, emptyBoard, emptyActivity, { now: at, agentActivity: live([quiet('default'), { profile: 'leadengineer', availability: 'available', active: true, kind: 'tools', label: 'Using tools', mentionsOpenCode: false }]) })
    expect(stopped.stations[1]).toMatchObject({ state: 'Working', room: 'Workspace', activity: 'Using tools' })
  })

  it('labels running Kanban work with the task and never idles on an unavailable probe', () => {
    const board = { tasks: { availability: 'available' as const, data: [{ title: 'Ship v2', status: 'running', assignee: 'default' }] }, fetchedAt: at }
    const office = buildOfficeSnapshot(runtime, board, emptyActivity, { now: at, agentActivity: live([quiet('default'), { profile: 'leadengineer', availability: 'unavailable', active: false, mentionsOpenCode: false }]) })
    expect(office.stations[0]).toMatchObject({ state: 'Working', activity: 'Kanban: Ship v2' })
    expect(office.stations[1].state).toBe('Unknown')
    expect(office.stations[2].state).toBe('Unknown')
  })
})

describe('profile folders', () => {
  let root: string
  let outside: string
  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), 'mc-hermes-'))
    outside = mkdtempSync(path.join(tmpdir(), 'mc-outside-'))
    writeFileSync(path.join(outside, 'secret.txt'), 'outside')
    writeFileSync(path.join(root, 'SOUL.md'), '# Soul\nBe helpful.\n')
    writeFileSync(path.join(root, 'config.yaml'), 'model: x\nmax_tokens: 4096\napi_key: sk-live-abcdefghijklmnop\n')
    writeFileSync(path.join(root, '.env'), 'OPENAI_API_KEY=sk-should-never-be-read\n')
    writeFileSync(path.join(root, 'state.db'), Buffer.from([0, 1, 2, 3]))
    writeFileSync(path.join(root, 'image.bin'), Buffer.from([0, 0, 0, 1, 2]))
    mkdirSync(path.join(root, 'memories'))
    writeFileSync(path.join(root, 'memories', 'MEMORY.md'), 'remember this')
    mkdirSync(path.join(root, 'profiles', 'leadengineer'), { recursive: true })
    writeFileSync(path.join(root, 'profiles', 'leadengineer', 'SOUL.md'), 'engineer')
    mkdirSync(path.join(root, 'hermes-agent'))
    symlinkSync(outside, path.join(root, 'escape'))
    symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'escape.txt'))
  })
  afterAll(() => { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }) })

  it('resolves the Hermes root like Hermes does', () => {
    expect(hermesRoot({}, '/home/u')).toBe('/home/u/.hermes')
    expect(hermesRoot({ HERMES_HOME: '/home/u/.hermes/profiles/coder' }, '/home/u')).toBe('/home/u/.hermes')
    expect(hermesRoot({ HERMES_HOME: '/opt/data/profiles/coder' }, '/home/u')).toBe('/opt/data')
    expect(hermesRoot({ HERMES_HOME: '/opt/data' }, '/home/u')).toBe('/opt/data')
  })

  it('lists folders first, hides other profiles and the install, and flags sensitive files', async () => {
    const listing = await listFolder('default', '', root)
    expect(listing.entries.map((entry) => entry.name)).toEqual(['escape', 'memories', '.env', 'config.yaml', 'escape.txt', 'image.bin', 'SOUL.md', 'state.db'])
    expect(listing.hiddenCount).toBe(2)
    expect(listing.entries.find((entry) => entry.name === '.env')?.sensitive).toBe(true)
    expect(listing.entries.find((entry) => entry.name === 'state.db')?.sensitive).toBe(true)
    expect((await listFolder('leadengineer', '', root)).entries.map((entry) => entry.name)).toEqual(['SOUL.md'])
  })

  it('reads text with redaction and refuses secrets, binaries and escapes', async () => {
    expect(await readFolderFile('default', 'SOUL.md', root)).toMatchObject({ kind: 'text', content: '# Soul\nBe helpful.\n' })
    const config = await readFolderFile('default', 'config.yaml', root)
    expect(config.content).toContain('max_tokens: 4096')
    expect(config.content).not.toContain('sk-live')
    expect(config.redactions).toBe(1)
    const env = await readFolderFile('default', '.env', root)
    expect(env).toMatchObject({ kind: 'sensitive' })
    expect(env.content).toBeUndefined()
    expect((await readFolderFile('default', 'image.bin', root)).kind).toBe('binary')
    await expect(readFolderFile('default', 'escape.txt', root)).rejects.toMatchObject({ status: 403 })
    await expect(listFolder('default', 'escape', root)).rejects.toMatchObject({ status: 403 })
    await expect(readFolderFile('default', '../etc/passwd', root)).rejects.toMatchObject({ status: 403 })
    await expect(readFolderFile('default', 'profiles/leadengineer/SOUL.md', root)).rejects.toMatchObject({ status: 404 })
    await expect(listFolder('../x', '', root)).rejects.toBeInstanceOf(FolderError)
    expect(safeRelativePath('/memories//')).toBe('memories')
  })

  it('reports which profile folders exist', async () => {
    expect(await folderAgents(['default', 'leadengineer', 'research'], root)).toEqual([
      { profile: 'default', label: 'Lead Agent', available: true },
      { profile: 'leadengineer', label: 'Lead Engineer', available: true },
      { profile: 'research', label: 'research', available: false },
    ])
  })
})
