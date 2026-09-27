import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const CACHE_MS = 10_000

export type Availability = 'available' | 'unavailable'
export type GatewayState = 'Running' | 'Stopped' | 'Unknown'

export interface Profile { name: string; model: string }
export interface Source<T> {
  availability: Availability
  data: T
  error?: { code: 'COMMAND_FAILED' | 'TIMEOUT'; message: string }
}
export interface RuntimeSnapshot {
  profiles: Source<Profile[]>
  gateways: { default: Source<GatewayState>; leadEngineer: Source<GatewayState> }
  openCode: Source<string>
  fetchedAt: string
}
export interface Task { title: string; status: string; id?: string; assignee?: string }
export interface ScheduledJob { name: string; schedule: string; nextRun?: string; status?: string }
export interface Session { title: string; preview: string; lastActive: string; id?: string; actor?: string; active?: boolean }
export interface Skill { name: string; category: string; source: string; trust: string; status: 'enabled' }
export interface TaskBoardSnapshot { tasks: Source<Task[]>; fetchedAt: string }
export interface CalendarSnapshot { jobs: Source<ScheduledJob[]>; fetchedAt: string }
export interface ActivitySnapshot { sessions: Source<Session[]>; fetchedAt: string }
export interface KnowledgeSnapshot { skills: Source<Skill[]>; fetchedAt: string }
export interface Channel { name: string; status: 'Configured' | 'Connected' }
export interface ChannelSnapshot { channels: Source<Channel[]>; activeSessions?: number; fetchedAt: string }
export type OfficeState = 'Idle' | 'Working' | 'Reviewing' | 'Collaborating' | 'Offline' | 'Unknown'
export type OfficeRoom = 'Workspace' | 'Lounge'
export interface OfficeStation {
  name: 'Lead Agent' | 'Lead Engineer' | 'OpenCode'
  role: string
  avatar: string
  workstation: string
  room: OfficeRoom
  roomPosition: string
  state: OfficeState
  currentTask: string
  recentActivity: string
  provenance: string
  freshness: string
}
export interface OfficeSnapshot { stations: OfficeStation[]; summary: OfficeSummary; fetchedAt: string }
export interface OfficeSummary { declared: number; active: number; idle: number; offline: number; unknown: number; gatewaysReachable: number; gatewaysDeclared: number }
export interface ExplicitOfficeState { station: OfficeStation['name']; state: 'Working' | 'Reviewing' | 'Collaborating'; expiresAt: string }
export interface OfficeBuildOptions { now?: string | number; explicitStates?: ExplicitOfficeState[] }

type Run = (file: string, args: string[]) => Promise<string>
let cache: { snapshot: RuntimeSnapshot; expires: number } | undefined
let taskBoardCache: { snapshot: TaskBoardSnapshot; expires: number } | undefined
let calendarCache: { snapshot: CalendarSnapshot; expires: number } | undefined
let activityCache: { snapshot: ActivitySnapshot; expires: number } | undefined
let knowledgeCache: { snapshot: KnowledgeSnapshot; expires: number } | undefined
let channelCache: { snapshot: ChannelSnapshot; expires: number } | undefined

export function parseProfiles(output: string): Profile[] {
  const lines = stripAnsi(output).split('\n')
  if (!lines.some((line) => /\bProfile\b/.test(line) && /\bModel\b/.test(line))) throw new Error('Unrecognized profile output.')
  const profiles = lines.flatMap((line) => {
    const match = line.replace(/^[^\w]*|\s+$/g, '').match(/^(\S+)\s{2,}(\S+)/)
    return match && match[1] !== 'Profile' ? [{ name: match[1], model: match[2] }] : []
  })
  if (profiles.length === 0) throw new Error('Unrecognized profile output.')
  return profiles
}

export function parseGatewayStatus(output: string): GatewayState {
  if (/\b(stopped|inactive|not running)\b/i.test(output)) return 'Stopped'
  if (/\b(running|active)\b/i.test(output)) return 'Running'
  return 'Unknown'
}

function parseDefaultProfileGateway(output: string): GatewayState {
  const lines = stripAnsi(output).split('\n')
  const header = lines.find((line) => /\bProfile\b/.test(line) && /\bModel\b/.test(line) && /\bGateway\b/.test(line))
  if (!header) return 'Unknown'
  const gatewayIndex = header.trim().split(/\s{2,}/).findIndex((cell) => cell === 'Gateway')
  if (gatewayIndex < 0) return 'Unknown'
  const defaultRow = lines.map((line) => line.trim().split(/\s{2,}/)).find((cells) => cells[0]?.replace(/^\W+/, '') === 'default')
  const gateway = defaultRow?.[gatewayIndex]?.trim().toLowerCase()
  if (gateway === 'running' || gateway === 'active') return 'Running'
  if (gateway === 'stopped' || gateway === 'inactive' || gateway === 'not running') return 'Stopped'
  return 'Unknown'
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function stripAnsi(output: string): string {
  return output.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g'), '')
}

export function parseTasks(output: string): Task[] {
  const parsed: unknown = JSON.parse(output)
  if (!Array.isArray(parsed)) throw new Error('Kanban response was not an array.')
  const tasks = parsed.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const title = text(record.title) ?? text(record.name)
    const status = text(record.status) ?? text(record.state)
    const id = text(record.id)
    const assignee = text(record.assignee) ?? text(record.assignedTo) ?? text(record.owner)
    return title && status ? [{ title, status, ...(id && /^[A-Za-z0-9_-]+$/.test(id) ? { id } : {}), ...(assignee ? { assignee } : {}) }] : []
  })
  if (parsed.length > 0 && tasks.length === 0) throw new Error('Unrecognized Kanban output.')
  return tasks
}

function tableRows(output: string): { headers: string[]; rows: string[][] } {
  const lines = stripAnsi(output).split('\n')
  const headerLine = lines.find((line) => /[│┃]/.test(line) && /\bName\b/.test(line))
  if (!headerLine) return { headers: [], rows: [] }
  const headers = headerLine.split(/[│┃]/).slice(1, -1).map((cell) => cell.trim().toLowerCase())
  const headerIndex = lines.indexOf(headerLine)
  const rows = lines.slice(headerIndex + 1).flatMap((line) => {
    if (!line.startsWith('│')) return []
    const cells = line.split('│').slice(1, -1).map((cell) => cell.trim())
    return cells.length === headers.length ? [cells] : []
  })
  return { headers, rows }
}

function headerValue(headers: string[], row: string[], names: string[]): string | undefined {
  const index = headers.findIndex((header) => names.includes(header))
  return index === -1 ? undefined : text(row[index])
}

export function parseCronJobs(output: string): ScheduledJob[] {
  if (/^\s*No scheduled jobs\./im.test(stripAnsi(output))) return []
  const { headers, rows } = tableRows(output)
  if (headers.length === 0) throw new Error('Unrecognized cron output.')
  const jobs = rows.flatMap((row) => {
    const name = headerValue(headers, row, ['name', 'title'])
    const schedule = headerValue(headers, row, ['schedule', 'cron'])
    const nextRun = headerValue(headers, row, ['next run', 'next'])
    const status = headerValue(headers, row, ['status'])
    return name && schedule ? [{ name, schedule, ...(nextRun ? { nextRun } : {}), ...(status ? { status } : {}) }] : []
  })
  if (jobs.length === 0) throw new Error('Unrecognized cron output.')
  return jobs
}

export function parseSessions(output: string): Session[] {
  const lines = stripAnsi(output).split('\n')
  const header = lines.find((line) => /Title\s+Preview\s+Last Active\s+ID/.test(line))
  if (!header) throw new Error('Unrecognized session output.')
  const positions = ['Preview', 'Last Active', 'ID'].map((label) => header.indexOf(label))
  if (positions.some((position) => position < 0)) throw new Error('Unrecognized session output.')
  const [previewStart, lastActiveStart, idStart] = positions
  const sessions = lines.slice(lines.indexOf(header) + 1).flatMap((line) => {
    if (!line.trim() || /^[\s─-]+$/.test(line)) return []
    const title = line.slice(0, previewStart).trim()
    const preview = line.slice(previewStart, lastActiveStart).trim()
    const lastActive = line.slice(lastActiveStart, idStart).trim()
    const id = line.slice(idStart).trim()
    if (!title || !preview || !lastActive) return []
    return [{ title, preview, lastActive, ...(id && /^[A-Za-z0-9_-]+$/.test(id) ? { id } : {}) }]
  })
  return sessions
}

export function parseSkills(output: string): Skill[] {
  const { headers, rows } = tableRows(output)
  if (!['name', 'category', 'source', 'trust', 'status'].every((header) => headers.includes(header))) throw new Error('Unrecognized skill output.')
  const skills = rows.flatMap((row) => {
    const name = headerValue(headers, row, ['name'])
    const category = headerValue(headers, row, ['category']) ?? ''
    const source = headerValue(headers, row, ['source'])
    const trust = headerValue(headers, row, ['trust'])
    const status = headerValue(headers, row, ['status'])
    return name && source && trust && status === 'enabled' ? [{ name, category, source, trust, status: 'enabled' as const }] : []
  })
  return skills
}

export function parseChannelStatus(output: string): { channels: Channel[]; activeSessions?: number } {
  const lines = stripAnsi(output).split('\n')
  const heading = lines.findIndex((line) => /^[^\w\r\n]*Messaging Platforms\s*$/i.test(line.trim()))
  if (heading < 0) throw new Error('Unrecognized channel output.')
  const allowed = new Map([['telegram', 'Telegram'], ['discord', 'Discord'], ['whatsapp', 'WhatsApp'], ['slack', 'Slack'], ['signal', 'Signal'], ['matrix', 'Matrix'], ['imessage', 'iMessage']])
  const channels = lines.slice(heading + 1).flatMap((line) => {
    const match = line.match(/^\s*(Telegram|Discord|WhatsApp|Slack|Signal|Matrix|iMessage)(?:\s*:\s*|\s+)(?:✓\s*)?(configured|connected)\b/i)
    if (!match) return []
    return [{ name: allowed.get(match[1].toLowerCase())!, status: match[2].toLowerCase() === 'connected' ? 'Connected' as const : 'Configured' as const }]
  })
  const sessionLine = lines.find((line) => /^\s*Active sessions\s*:?[ ]+\d+\s*$/i.test(line))
  const sessionMatch = sessionLine?.match(/(\d+)/)
  return { channels, ...(sessionMatch ? { activeSessions: Number(sessionMatch[1]) } : {}) }
}

function failure<T>(error: unknown, fallback: T): Source<T> {
  const timedOut = error instanceof Error && /timed out|timeout/i.test(error.message)
  return {
    availability: 'unavailable',
    data: fallback,
    error: { code: timedOut ? 'TIMEOUT' : 'COMMAND_FAILED', message: timedOut ? 'Read timed out.' : 'Read command was unavailable.' },
  }
}

async function read<T>(run: Run, file: string, args: string[], parse: (output: string) => T, fallback: T): Promise<Source<T>> {
  try {
    return { availability: 'available', data: parse(await run(file, args)) }
  } catch (error) {
    return failure(error, fallback)
  }
}

async function systemRun(file: string, args: string[]): Promise<string> {
  const { stdout } = await execFile(file, args, { timeout: 8_000, maxBuffer: 64 * 1024 })
  return stdout
}

export async function collectSnapshot(run: Run = systemRun): Promise<RuntimeSnapshot> {
  const [profileData, leadEngineerGateway, openCode] = await Promise.all([
    read(run, 'hermes', ['profile', 'list'], (output) => ({ profiles: parseProfiles(output), gateway: parseDefaultProfileGateway(output) }), { profiles: [], gateway: 'Unknown' as GatewayState }),
    read(run, 'hermes', ['-p', 'leadengineer', 'gateway', 'status'], parseGatewayStatus, 'Unknown'),
    read(run, 'opencode', ['--version'], (text) => text.trim() || 'Unknown', 'Unknown'),
  ])
  const profiles: Source<Profile[]> = { availability: profileData.availability, data: profileData.data.profiles, ...(profileData.error && { error: profileData.error }) }
  const defaultGateway: Source<GatewayState> = { availability: profileData.availability, data: profileData.availability === 'available' ? profileData.data.gateway : 'Unknown', ...(profileData.error && { error: profileData.error }) }
  return { profiles, gateways: { default: defaultGateway, leadEngineer: leadEngineerGateway }, openCode, fetchedAt: new Date().toISOString() }
}

export async function collectTaskBoard(run: Run = systemRun): Promise<TaskBoardSnapshot> {
  const tasks = await read(run, 'hermes', ['kanban', 'list', '--json'], parseTasks, [])
  return { tasks, fetchedAt: new Date().toISOString() }
}

export async function collectCalendar(run: Run = systemRun): Promise<CalendarSnapshot> {
  const jobs = await read(run, 'hermes', ['cron', 'list', '--all'], parseCronJobs, [])
  return { jobs, fetchedAt: new Date().toISOString() }
}

export async function collectActivity(run: Run = systemRun): Promise<ActivitySnapshot> {
  const sessions = await read(run, 'hermes', ['sessions', 'list', '--limit', '20'], parseSessions, [])
  return { sessions, fetchedAt: new Date().toISOString() }
}

export async function collectKnowledge(run: Run = systemRun): Promise<KnowledgeSnapshot> {
  const skills = await read(run, 'hermes', ['skills', 'list', '--enabled-only'], parseSkills, [])
  return { skills, fetchedAt: new Date().toISOString() }
}

export async function collectChannels(run: Run = systemRun): Promise<ChannelSnapshot> {
  const channelData = await read(run, 'hermes', ['status', '--all'], parseChannelStatus, { channels: [] as Channel[] })
  return {
    channels: { availability: channelData.availability, data: channelData.data.channels, ...(channelData.error && { error: channelData.error }) },
    ...(channelData.availability === 'available' && channelData.data.activeSessions !== undefined ? { activeSessions: channelData.data.activeSessions } : {}),
    fetchedAt: new Date().toISOString(),
  }
}

const officeMetadata = [
  { name: 'Lead Agent', role: 'Lead Agent', avatar: 'lead-agent', workstation: 'Command desk', aliases: ['default', 'lead agent'] },
  { name: 'Lead Engineer', role: 'Lead Engineer', avatar: 'lead-engineer', workstation: 'Engineering desk', aliases: ['leadengineer', 'lead engineer'] },
  { name: 'OpenCode', role: 'OpenCode', avatar: 'opencode', workstation: 'Build terminal', aliases: ['opencode'] },
] as const

export const officeRooms = [
  { id: 'Workspace', label: 'Workspace', description: 'Desks, collaboration, and neutral presence positions.' },
  { id: 'Lounge', label: 'Lounge', description: 'A quiet break and idle room.' },
] as const

function attributedTask(tasks: Task[], aliases: readonly string[]): Task | undefined {
  return tasks.find((task) => task.assignee && aliases.includes(task.assignee.trim().toLowerCase()))
}

function taskState(task: Task | undefined): OfficeState {
  if (!task) return 'Unknown'
  if (task.status.toLowerCase() === 'running') return 'Working'
  if (task.status.toLowerCase() === 'review') return 'Reviewing'
  return 'Unknown'
}

function collaborationState(sessions: Session[], aliases: readonly string[]): OfficeState {
  return sessions.some((session) => session.active === true && session.actor && aliases.includes(session.actor.trim().toLowerCase())) ? 'Collaborating' : 'Unknown'
}

function isFresh(fetchedAt: string, now: number): boolean {
  const timestamp = Date.parse(fetchedAt)
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 30_000
}

function explicitState(metadata: typeof officeMetadata[number], states: ExplicitOfficeState[], now: number): OfficeState | undefined {
  return states.find((record) => record.station === metadata.name && Date.parse(record.expiresAt) > now)?.state
}

function roomForState(state: OfficeState, index: number): Pick<OfficeStation, 'room' | 'roomPosition'> {
  if (state === 'Idle') return { room: 'Lounge', roomPosition: `lounge-seat-${index + 1}` }
  if (state === 'Offline') return { room: 'Workspace', roomPosition: 'offline-station' }
  if (state === 'Reviewing') return { room: 'Workspace', roomPosition: 'review-desk' }
  if (state === 'Collaborating') return { room: 'Workspace', roomPosition: 'meeting-area' }
  if (state === 'Working') return { room: 'Workspace', roomPosition: 'assigned-desk' }
  return { room: 'Workspace', roomPosition: 'neutral-presence' }
}

export function buildOfficeSummary(stations: OfficeStation[], runtime: RuntimeSnapshot): OfficeSummary {
  const gateways = [runtime.gateways.default, runtime.gateways.leadEngineer]
  return {
    declared: stations.length,
    active: stations.filter((station) => ['Working', 'Reviewing', 'Collaborating'].includes(station.state)).length,
    idle: stations.filter((station) => station.state === 'Idle').length,
    offline: stations.filter((station) => station.state === 'Offline').length,
    unknown: stations.filter((station) => station.state === 'Unknown').length,
    gatewaysReachable: gateways.filter((gateway) => gateway.availability === 'available').length,
    gatewaysDeclared: gateways.length,
  }
}

export function buildOfficeSnapshot(runtime: RuntimeSnapshot, board: TaskBoardSnapshot, activity: ActivitySnapshot, options: OfficeBuildOptions = {}): OfficeSnapshot {
  const fetchedAt = new Date().toISOString()
  const now = typeof options.now === 'number' ? options.now : options.now ? Date.parse(options.now) : Date.now()
  const freshRuntime = isFresh(runtime.fetchedAt, now)
  const freshBoard = board.tasks.availability === 'available' && isFresh(board.fetchedAt, now)
  const freshActivity = activity.sessions.availability === 'available' && isFresh(activity.fetchedAt, now)
  const explicitStates = options.explicitStates ?? []
  const stations = officeMetadata.map((metadata, index): OfficeStation => {
    const gateway = index === 0 ? runtime.gateways.default : index === 1 ? runtime.gateways.leadEngineer : undefined
    const task = freshBoard ? attributedTask(board.tasks.data, metadata.aliases) : undefined
    const overlay = explicitState(metadata, explicitStates, now)
    const taskWorkState = taskState(task)
    const collaboration = freshActivity ? collaborationState(activity.sessions.data, metadata.aliases) : 'Unknown'
    const stopped = gateway?.availability === 'available' && gateway.data === 'Stopped'
    const state: OfficeState = stopped ? 'Offline' : overlay ?? (taskWorkState !== 'Unknown' ? taskWorkState : collaboration !== 'Unknown' ? collaboration : freshRuntime && freshBoard && freshActivity ? 'Idle' : 'Unknown')
    const currentTask = board.tasks.availability === 'unavailable' ? 'Not Available' : task?.title ?? 'No attributed task'
    const recentActivity = activity.sessions.availability === 'unavailable' ? 'Not Available' : collaboration === 'Collaborating' ? 'Attributed active collaboration session' : 'No attributed recent activity'
    const runtimeProvenance = gateway ? `Gateway ${gateway.availability === 'available' ? gateway.data : 'Not Available'}` : 'OpenCode version availability is not a state signal'
    const managedIdle = state === 'Idle' ? '; Mission Control managed-idle placement policy (not agent-reported presence)' : ''
    return {
      name: metadata.name,
      role: metadata.role,
      avatar: metadata.avatar,
      workstation: metadata.workstation,
      ...roomForState(state, index),
      state,
      currentTask,
      recentActivity,
      provenance: `${runtimeProvenance}; explicit state records: ${overlay ? 'fresh declared state' : 'none'}; Kanban: ${board.tasks.availability}${freshBoard ? ' fresh' : ' stale or unavailable'}; activity: ${activity.sessions.availability}${freshActivity ? ' fresh' : ' stale or unavailable'}${managedIdle}`,
      freshness: `Runtime ${runtime.fetchedAt}; Kanban ${board.fetchedAt}; activity ${activity.fetchedAt}`,
    }
  })
  return { stations, summary: buildOfficeSummary(stations, runtime), fetchedAt }
}

export async function getSnapshot(now = Date.now()): Promise<RuntimeSnapshot> {
  if (cache && cache.expires > now) return cache.snapshot
  const snapshot = await collectSnapshot()
  cache = { snapshot, expires: now + CACHE_MS }
  return snapshot
}

export function clearSnapshotCache(): void { cache = undefined }

async function cached<T>(current: { snapshot: T; expires: number } | undefined, set: (value: { snapshot: T; expires: number }) => void, collect: () => Promise<T>, now: number): Promise<T> {
  if (current && current.expires > now) return current.snapshot
  const snapshot = await collect()
  set({ snapshot, expires: now + CACHE_MS })
  return snapshot
}

export function getTaskBoard(now = Date.now()): Promise<TaskBoardSnapshot> { return cached(taskBoardCache, (value) => { taskBoardCache = value }, collectTaskBoard, now) }
export function getCalendar(now = Date.now()): Promise<CalendarSnapshot> { return cached(calendarCache, (value) => { calendarCache = value }, collectCalendar, now) }
export function getActivity(now = Date.now()): Promise<ActivitySnapshot> { return cached(activityCache, (value) => { activityCache = value }, collectActivity, now) }
export function getKnowledge(now = Date.now()): Promise<KnowledgeSnapshot> { return cached(knowledgeCache, (value) => { knowledgeCache = value }, collectKnowledge, now) }
export function getChannels(now = Date.now()): Promise<ChannelSnapshot> { return cached(channelCache, (value) => { channelCache = value }, collectChannels, now) }
export async function getOffice(now = Date.now()): Promise<OfficeSnapshot> {
  const [runtime, board, activity] = await Promise.all([getSnapshot(now), getTaskBoard(now), getActivity(now)])
  return buildOfficeSnapshot(runtime, board, activity)
}
