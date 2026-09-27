import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { officeStateBadge } from './office-state.ts'
import { loadSnapshot, type RequestState } from './request-state.ts'
import type { ActivitySnapshot, CalendarSnapshot, ChannelSnapshot, KnowledgeSnapshot, OfficeSnapshot, OfficeRoom, OfficeStation, RuntimeSnapshot, Source, TaskBoardSnapshot } from './types.ts'

const navigation = ['Dashboard', 'Agents', 'Office', 'Task Board', 'Calendar', 'Activity', 'Knowledge'] as const
type Page = typeof navigation[number]

function Value<T>({ source, empty = 'Unknown' }: { source?: Source<T>; empty?: string }) {
  if (!source || source.availability === 'unavailable') return <span className="muted">Not Available</span>
  const value = source.data
  return <>{typeof value === 'string' ? value || empty : empty}</>
}

function RuntimeBadge({ source }: { source?: Source<string> }) {
  const state = source?.availability === 'available' ? source.data : 'Not Available'
  const tone = state === 'Running' ? 'good' : state === 'Not Available' ? 'muted' : 'unknown'
  return <span className={`badge ${tone}`}>{state}</span>
}

export function PixelCharacter({ avatar }: { avatar: string }) {
  return <span className={`pixel-character ${avatar}`} aria-hidden="true"><span className="character-hair"/><span className="character-head"><i/><b/></span><span className="character-torso"/><span className="character-arm left"/><span className="character-arm right"/><span className="character-leg left"/><span className="character-leg right"/></span>
}

function officeStateLabel(station: OfficeStation): string {
  return station.state === 'Idle' ? 'Idle · managed placement' : station.state
}

export function Dashboard({ runtime, pending = false }: { runtime: RuntimeSnapshot | null; pending?: boolean }) {
  if (pending) return <section className="empty-state loading-state"><h2>Loading</h2><p>Reading runtime signals...</p></section>
  const defaultProfile = runtime?.profiles.data.find((profile) => profile.name === 'default')
  return <><section className="hero"><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>Mission control, <em>without the noise.</em></h1><p>Runtime signals are live reads, cached server-side for 10 seconds.</p></section>
    <section className="stats">
      <article><span>Lead gateway</span><RuntimeBadge source={runtime?.gateways.default}/></article>
      <article><span>Engineer gateway</span><RuntimeBadge source={runtime?.gateways.leadEngineer}/></article>
      <article><span>OpenCode</span><strong><Value source={runtime?.openCode}/></strong></article>
      <article><span>Lead model</span><strong>{runtime?.profiles.availability === 'unavailable' ? 'Not Available' : defaultProfile?.model ?? 'Unknown'}</strong></article>
    </section>
    <section className="panel"><div><p className="eyebrow">RUNTIME SOURCES</p><h2>Signal integrity</h2></div><p>Profiles: {runtime?.profiles.availability === 'available' ? `${runtime.profiles.data.length} discovered` : 'Not Available'}. No work or activity state is inferred from gateway status.</p></section>
  </>
}

export function Agents({ runtime, pending = false }: { runtime: RuntimeSnapshot | null; pending?: boolean }) {
  if (pending) return <section className="empty-state loading-state"><h2>Loading</h2><p>Reading runtime details...</p></section>
  const profiles = runtime?.profiles.availability === 'available' ? runtime.profiles.data : []
  const lead = profiles.find((item) => item.name === 'default')
  const engineer = profiles.find((item) => item.name === 'leadengineer')
  const profileField = (value: string | undefined) => runtime?.profiles.availability === 'unavailable' ? 'Not Available' : value ?? 'Unknown'
  const openCodeVersion = runtime?.openCode.availability === 'unavailable' ? 'Not Available' : runtime?.openCode.data ?? 'Unknown'
  const rows = [
    ['Lead Agent', 'Declarative role', profileField(lead?.name), profileField(lead?.model), runtime?.gateways.default],
    ['Lead Engineer', 'Declarative role', profileField(engineer?.name), profileField(engineer?.model), runtime?.gateways.leadEngineer],
    ['OpenCode', 'Declarative role', 'Unknown', openCodeVersion, undefined],
  ] as const
  return <><section className="page-title"><p className="eyebrow">ORGANIZATION</p><h1>Agent chain</h1><p>Role labels are declared architecture. Runtime details below are independently discovered.</p></section><section className="chain">Lead Agent <i>→</i> Lead Engineer <i>→</i> OpenCode</section>
    <section className="agent-list">{rows.map(([role, label, profile, version, gateway]) => <article className="agent" key={role}><div><p className="eyebrow">{label}</p><h2>{role}</h2></div><dl><div><dt>Profile</dt><dd>{profile}</dd></div><div><dt>Model / version</dt><dd>{version}</dd></div><div><dt>Gateway</dt><dd>{gateway ? <RuntimeBadge source={gateway}/> : <span className="muted">Not Available</span>}</dd></div></dl></article>)}</section>
  </>
}

export function OfficeDetail({ station, onClose }: { station: OfficeStation; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => { closeRef.current?.focus() }, [])
  const badge = officeStateBadge(station.state)
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { onClose(); return }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    if (!focusable?.length) { event.preventDefault(); return }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target.focus()
    }
  }
  return <section className="office-detail" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="office-detail-title" onKeyDown={onKeyDown}>
    <button className="office-close" ref={closeRef} onClick={onClose} aria-label={`Close ${station.name} details`}>Close</button>
    <div className="detail-avatar"><PixelCharacter avatar={station.avatar}/></div><p className="eyebrow">STATION DETAIL</p><h2 id="office-detail-title">{station.name}</h2><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span>
    <dl className="office-detail-grid"><div><dt>Declared role</dt><dd>{station.role}</dd></div><div><dt>Workstation</dt><dd>{station.workstation}</dd></div><div><dt>Current room</dt><dd>{station.room} / {station.roomPosition}</dd></div><div><dt>Current task</dt><dd>{station.currentTask}</dd></div><div><dt>Recent activity</dt><dd>{station.recentActivity}</dd></div><div><dt>Source / provenance</dt><dd>{station.provenance}</dd></div><div><dt>Freshness</dt><dd>{station.freshness}</dd></div></dl>
  </section>
}

export function Office() {
  const snapshot = useSnapshot<OfficeSnapshot>('/api/office')
  const activitySnapshot = useSnapshot<ActivitySnapshot>('/api/activity')
  const channelsSnapshot = useSnapshot<ChannelSnapshot>('/api/channels')
  const office = snapshot.status === 'ready' ? snapshot.data : undefined
  const activity = activitySnapshot.status === 'ready' ? activitySnapshot.data : undefined
  const channels = channelsSnapshot.status === 'ready' ? channelsSnapshot.data : undefined
  const [selected, setSelected] = useState<OfficeStation | undefined>()
  const selectedTrigger = useRef<HTMLButtonElement>(null)
  const [room, setRoom] = useState<OfficeRoom>('Workspace')
  const stations = office?.stations.filter((station) => station.room === room) ?? []
  const sessions = activity?.sessions
  const channelSource = channels?.channels
  const closeDetail = () => {
    setSelected(undefined)
    selectedTrigger.current?.focus()
  }
  if (snapshot.status === 'pending') return <><section className="page-title office-title"><p className="eyebrow">VISUAL OFFICE / READ-ONLY</p><h1>Office</h1><p>Declared stations show only attributable work. Select a character or desk for its evidence and freshness.</p></section><section className="empty-state loading-state"><h2>Loading</h2><p>Reading office state...</p></section></>
  return <><section className="page-title office-title"><p className="eyebrow">VISUAL OFFICE / READ-ONLY</p><h1>Office</h1><p>Declared stations show only attributable work. Select a character or desk for its evidence and freshness.</p></section>
    <section className="office-dashboard" aria-label="Visual Office">
      <div className="office-main"><div className="room-tabs" role="tablist" aria-label="Office rooms">{(['Workspace', 'Lounge'] as const).map((item) => <button role="tab" aria-selected={room === item} className={room === item ? 'active' : ''} onClick={() => setRoom(item)} key={item}>{item}</button>)}</div>
        <section className={`pixel-room ${room.toLowerCase()}`} aria-label={`${room} room`}><div className="room-label"><span>{room}</span><small>{room === 'Workspace' ? 'DESKS + COLLABORATION' : 'QUIET BREAK AREA'}</small></div><div className="pixel-window window-one" aria-hidden="true"/><div className="pixel-window window-two" aria-hidden="true"/><div className="pixel-door" aria-hidden="true"/>
          {room === 'Workspace' ? <><div className="pixel-shelf" aria-hidden="true"/><div className="pixel-plant plant-one" aria-hidden="true"/><div className="meeting-table" aria-hidden="true"><span>MEET</span></div></> : <><div className="lounge-sofa" aria-hidden="true"/><div className="lounge-chair chair-one" aria-hidden="true"/><div className="lounge-chair chair-two" aria-hidden="true"/><div className="coffee-table" aria-hidden="true"/><div className="pixel-tv" aria-hidden="true"/><div className="pixel-plant plant-two" aria-hidden="true"/></>}
          {stations.map((station, index) => { const badge = officeStateBadge(station.state); return <button className={`pixel-station pixel-station-${index + 1} ${station.roomPosition}`} key={station.name} onClick={(event) => { selectedTrigger.current = event.currentTarget; setSelected(station) }} aria-label={`${station.name}. ${officeStateLabel(station)}. Open station details.`}><span className="pixel-desk" aria-hidden="true"><i/></span><PixelCharacter avatar={station.avatar}/><span className="pixel-station-name">{station.name}</span><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span>{station.state === 'Unknown' && <span className="neutral-label">NEUTRAL PRESENCE</span>}</button> })}
          {room === 'Lounge' && stations.length === 0 && <p className="room-empty">No declared idle presence</p>}
        </section></div>
      <aside className="office-side"><section className="office-summary"><p className="eyebrow">CREW SNAPSHOT</p><strong>{office?.summary.active ?? 0} active work</strong><span>{office?.summary.idle ?? 0} Idle (managed)</span><span>{office?.summary.unknown ?? 0} Unknown / {office?.summary.offline ?? 0} Offline</span><hr/><span>Gateway health: {office ? `${office.summary.gatewaysReachable} of ${office.summary.gatewaysDeclared} reachable` : 'Not Available'}</span></section>
        <section className="office-feed"><p className="eyebrow">LIVE ACTIVITY</p><h2>Unattributed sessions</h2>{sessions?.availability === 'unavailable' ? <p>Not Available</p> : !sessions ? <p>Loading read-only metadata...</p> : sessions.data.length === 0 ? <p>No session metadata available.</p> : sessions.data.slice(0, 3).map((session) => <article key={session.id ?? session.title}><strong>{session.title}</strong><span>{session.lastActive}</span></article>)}<small>Generic session metadata never changes crew state.</small></section>
        <section className="office-feed"><p className="eyebrow">CHANNELS</p><h2>Messaging platforms</h2>{channelSource?.availability === 'unavailable' ? <p>Not Available</p> : !channelSource ? <p>Loading safe status...</p> : channelSource.data.length === 0 ? <p>No configured channels.</p> : channelSource.data.map((channel) => <article key={channel.name}><strong>{channel.name}</strong><span>{channel.status}</span></article>)}{channels?.activeSessions !== undefined && <small>{channels.activeSessions} active session{channels.activeSessions === 1 ? '' : 's'}</small>}</section>
      </aside>
    </section>
    {snapshot.status === 'failed' && <section className="empty-state"><h2>Not Available</h2><p>The office source could not be reached.</p></section>}
    {selected && <OfficeDetail station={selected} onClose={closeDetail}/>} 
  </>
}

function useSnapshot<T>(path: string) {
  const [snapshot, setSnapshot] = useState<RequestState<T>>({ status: 'pending' })
  useEffect(() => { void loadSnapshot<T>(path).then(setSnapshot) }, [path])
  return snapshot
}

function SourceStatus({ source, fetchedAt, request }: { source?: Source<unknown>; fetchedAt?: string; request: RequestState<unknown> }) {
  const status = request.status === 'pending' ? 'Connecting' : !source || source.availability === 'unavailable' ? 'Not Available' : 'Live source'
  return <div className="source-status"><span className={source?.availability === 'available' ? 'dot' : 'dot muted-dot'}/><span>{status}</span><span>{fetchedAt ? `REFRESHED ${new Date(fetchedAt).toLocaleTimeString()}` : 'AWAITING REFRESH'}</span></div>
}

function Unavailable({ source, request }: { source?: Source<unknown>; request: RequestState<unknown> }) {
  return request.status === 'failed' || source?.availability === 'unavailable' ? <section className="empty-state"><h2>Not Available</h2><p>{source?.error?.message ?? 'This read-only source could not be reached.'}</p></section> : null
}

function TaskBoard() {
  const snapshot = useSnapshot<TaskBoardSnapshot>('/api/tasks')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const tasks = data?.tasks
  const statuses = tasks?.data.reduce<string[]>((all, task) => all.includes(task.status) ? all : [...all, task.status], []) ?? []
  return <><section className="page-title"><p className="eyebrow">HERMES KANBAN</p><h1>Task board</h1><p>Read-only task status from Hermes Kanban. No task creation, updates, or completion controls are exposed.</p></section><SourceStatus source={tasks} fetchedAt={data?.fetchedAt} request={snapshot}/><Unavailable source={tasks} request={snapshot}/>{tasks?.availability === 'available' && (tasks.data.length === 0 ? <section className="empty-state"><h2>No tasks</h2><p>Hermes returned an empty Kanban task list.</p></section> : <section className="board">{statuses.map((status) => <article key={status}><p className="eyebrow">{status}</p>{tasks.data.filter((task) => task.status === status).map((task) => <div className="task" key={`${task.status}-${task.id ?? task.title}`}><strong>{task.title}</strong>{task.id && <small>{task.id}</small>}</div>)}</article>)}</section>)}</>
}

function Calendar() {
  const snapshot = useSnapshot<CalendarSnapshot>('/api/calendar')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const jobs = data?.jobs
  return <><section className="page-title"><p className="eyebrow">HERMES CRON</p><h1>Calendar</h1><p>Scheduled Hermes cron jobs only. General calendar events are not inferred or displayed.</p></section><SourceStatus source={jobs} fetchedAt={data?.fetchedAt} request={snapshot}/><Unavailable source={jobs} request={snapshot}/>{jobs?.availability === 'available' && (jobs.data.length === 0 ? <section className="empty-state"><h2>No scheduled jobs</h2><p>Hermes did not report any cron jobs.</p></section> : <section className="data-list">{jobs.data.map((job) => <article key={`${job.name}-${job.schedule}`}><div><h2>{job.name}</h2><p>{job.schedule}</p></div><dl>{job.nextRun && <div><dt>Next run</dt><dd>{job.nextRun}</dd></div>}{job.status && <div><dt>Status</dt><dd>{job.status}</dd></div>}</dl></article>)}</section>)}</>
}

function Activity() {
  const snapshot = useSnapshot<ActivitySnapshot>('/api/activity')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const sessions = data?.sessions
  return <><section className="page-title"><p className="eyebrow">HERMES SESSIONS</p><h1>Activity</h1><p>Recent session metadata from Hermes. Events and work history are not invented from session data.</p></section><SourceStatus source={sessions} fetchedAt={data?.fetchedAt} request={snapshot}/><Unavailable source={sessions} request={snapshot}/>{sessions?.availability === 'available' && (sessions.data.length === 0 ? <section className="empty-state"><h2>No recent sessions</h2><p>Hermes did not return parseable session metadata.</p></section> : <section className="data-list">{sessions.data.map((session) => <article key={session.id ?? `${session.title}-${session.lastActive}`}><div><h2>{session.title}</h2><p>{session.preview}</p></div><dl><div><dt>Last active</dt><dd>{session.lastActive}</dd></div>{session.id && <div><dt>Session ID</dt><dd>{session.id}</dd></div>}</dl></article>)}</section>)}</>
}

function Knowledge() {
  const snapshot = useSnapshot<KnowledgeSnapshot>('/api/knowledge')
  const data = snapshot.status === 'ready' ? snapshot.data : undefined
  const skills = data?.skills
  return <><section className="page-title"><p className="eyebrow">HERMES SKILLS</p><h1>Knowledge</h1><p>A read-only catalog of enabled Hermes capabilities, limited to fields recognizable in the CLI table.</p></section><SourceStatus source={skills} fetchedAt={data?.fetchedAt} request={snapshot}/><Unavailable source={skills} request={snapshot}/>{skills?.availability === 'available' && (skills.data.length === 0 ? <section className="empty-state"><h2>No enabled skills</h2><p>Hermes did not return recognizable enabled skill rows.</p></section> : <section className="skill-grid">{skills.data.map((skill) => <article key={skill.name}><p className="eyebrow">{skill.category || 'UNCATEGORIZED'}</p><h2>{skill.name}</h2><dl><div><dt>Source</dt><dd>{skill.source}</dd></div><div><dt>Trust</dt><dd>{skill.trust}</dd></div><div><dt>Status</dt><dd>{skill.status}</dd></div></dl></article>)}</section>)}</>
}

export function App() {
  const [page, setPage] = useState<Page>('Dashboard')
  const runtimeSnapshot = useSnapshot<RuntimeSnapshot>('/api/runtime')
  const runtime = runtimeSnapshot.status === 'ready' ? runtimeSnapshot.data : null
  return <div className="app"><aside><a className="brand" href="#dashboard" onClick={() => setPage('Dashboard')}>MC<span>01</span></a><nav>{navigation.map((item) => <button className={page === item ? 'active' : ''} key={item} onClick={() => setPage(item)}>{item}</button>)}</nav><div className="sidebar-note"><span className="dot"/> READ-ONLY MODE</div></aside><main><header><span>MISSION CONTROL / FIRST INCREMENT</span><span>{runtime ? `SYNCED ${new Date(runtime.fetchedAt).toLocaleTimeString()}` : runtimeSnapshot.status === 'failed' ? 'NOT AVAILABLE' : 'CONNECTING...'}</span></header>{runtimeSnapshot.status === 'failed' ? <section className="empty-state"><h2>Not Available</h2><p>This read-only source could not be reached.</p></section> : page === 'Dashboard' ? <Dashboard runtime={runtime} pending={runtimeSnapshot.status === 'pending'}/> : page === 'Agents' ? <Agents runtime={runtime} pending={runtimeSnapshot.status === 'pending'}/> : page === 'Office' ? <Office/> : page === 'Task Board' ? <TaskBoard/> : page === 'Calendar' ? <Calendar/> : page === 'Activity' ? <Activity/> : <Knowledge/>}</main></div>
}
