export type Availability = 'available' | 'unavailable'
export type GatewayState = 'Running' | 'Stopped' | 'Unknown'
export interface Source<T> { availability: Availability; data: T; error?: { code: string; message: string } }
export interface RuntimeSnapshot {
  profiles: Source<{ name: string; model: string }[]>
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
export interface OfficeSummary { declared: number; active: number; idle: number; offline: number; unknown: number; gatewaysReachable: number; gatewaysDeclared: number }
export interface OfficeSnapshot { stations: OfficeStation[]; summary: OfficeSummary; fetchedAt: string }
export interface CountSource { availability: Availability; total: number }
export interface DashboardSnapshot {
  runtime: RuntimeSnapshot
  tasks: CountSource & { byStatus: Record<string, number>; assigned: number }
  calendar: CountSource & { active: number; paused: number; nextRun?: string }
  activity: CountSource & { latest?: Session }
  knowledge: CountSource & { byCategory: Record<string, number> }
  channels: CountSource & { connected: number; activeSessions?: number }
  office: OfficeSummary
  commands: CommandHealth
  fetchedAt: string
}
export interface CommandLogEntry { command: string; ok: boolean; durationMs: number; at: string; error?: string }
export interface CommandHealth { total: number; failed: number; averageMs: number }
export interface CommandLogSnapshot { entries: CommandLogEntry[]; health: CommandHealth; fetchedAt: string }
export type LogLevel = 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG' | 'OTHER'
export interface LogLine { text: string; level: LogLevel }
export interface LogFile { name: string; label: string; source: Source<LogLine[]> }
export interface LogsSnapshot { files: LogFile[]; fetchedAt: string }
