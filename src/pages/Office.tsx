import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { officeStateBadge } from '../office-state.ts'
import { usePolling } from '../polling.ts'
import type { ActivitySnapshot, ChannelSnapshot, OfficeRoom, OfficeSnapshot, OfficeStation } from '../types.ts'
import { LoadingState, SourceStatus } from '../ui.tsx'

const ROOMS: OfficeRoom[] = ['Workspace', 'Lounge']

export function PixelCharacter({ avatar }: { avatar: string }) {
  return <span className={`pixel-character ${avatar}`} aria-hidden="true"><span className="character-hair"/><span className="character-head"><i/><b/></span><span className="character-torso"/><span className="character-arm left"/><span className="character-arm right"/><span className="character-leg left"/><span className="character-leg right"/></span>
}

function officeStateLabel(station: OfficeStation): string {
  return station.state === 'Idle' ? 'Idle · managed placement' : station.state
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
  return <div className="office-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="office-detail" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="office-detail-title" onKeyDown={onKeyDown}>
      <button className="office-close" ref={closeRef} onClick={onClose} aria-label={`Close ${station.name} details`}>Close</button>
      <div className="detail-avatar"><PixelCharacter avatar={station.avatar}/></div><p className="eyebrow">STATION DETAIL</p><h2 id="office-detail-title">{station.name}</h2><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span>{station.activity && <p className="detail-activity">{station.activity}</p>}
      <dl className="office-detail-grid"><div><dt>Declared role</dt><dd>{station.role}</dd></div><div><dt>Workstation</dt><dd>{station.workstation}</dd></div><div><dt>Current room</dt><dd>{station.room} / {station.roomPosition}</dd></div><div><dt>Current task</dt><dd>{station.currentTask}</dd></div><div><dt>Recent activity</dt><dd>{station.recentActivity}</dd></div><div><dt>Source / provenance</dt><dd>{station.provenance}</dd></div><div><dt>Freshness</dt><dd>{station.freshness}</dd></div></dl>
    </section>
  </div>
}

const officeHeading = <section className="page-title office-title"><p className="eyebrow">VISUAL OFFICE / READ-ONLY</p><h1>Office</h1><p>Declared stations show only attributable work. Select a character or desk for its evidence and freshness.</p></section>

export function Office() {
  const snapshot = usePolling<OfficeSnapshot>('/api/office', 10_000)
  const activitySnapshot = usePolling<ActivitySnapshot>('/api/activity', 15_000)
  const channelsSnapshot = usePolling<ChannelSnapshot>('/api/channels', 30_000)
  const office = snapshot.status === 'ready' ? snapshot.data : undefined
  const activity = activitySnapshot.status === 'ready' ? activitySnapshot.data : undefined
  const channels = channelsSnapshot.status === 'ready' ? channelsSnapshot.data : undefined
  const [selectedName, setSelectedName] = useState<OfficeStation['name'] | undefined>()
  const selectedTrigger = useRef<HTMLButtonElement | null>(null)
  const [chosenRoom, setChosenRoom] = useState<OfficeRoom | undefined>()
  const counts = Object.fromEntries(ROOMS.map((item) => [item, office?.stations.filter((station) => station.room === item).length ?? 0])) as Record<OfficeRoom, number>
  // Until the viewer picks a room, open wherever the crew currently is.
  const room: OfficeRoom = chosenRoom ?? (counts.Workspace === 0 && counts.Lounge > 0 ? 'Lounge' : 'Workspace')
  const stations = office?.stations.filter((station) => station.room === room) ?? []
  const selected = office?.stations.find((station) => station.name === selectedName)
  const desks = (office?.stations ?? []).map((station) => ({ seat: station.seat, workstation: station.workstation, occupied: station.room === 'Workspace' && station.roomPosition !== 'meeting-area' }))
  const sessions = activity?.sessions
  const channelSource = channels?.channels
  const closeDetail = () => {
    setSelectedName(undefined)
    selectedTrigger.current?.focus()
  }
  if (snapshot.status === 'pending') return <>{officeHeading}<LoadingState message="Reading office state..."/></>
  return <>{officeHeading}
    <SourceStatus source={office ? { availability: 'available', data: null } : undefined} fetchedAt={office?.fetchedAt} request={snapshot}/>
    <section className="office-dashboard" aria-label="Visual Office">
      <div className="office-main"><div className="room-tabs" role="tablist" aria-label="Office rooms">{ROOMS.map((item) => <button role="tab" aria-selected={room === item} className={room === item ? 'active' : ''} onClick={() => setChosenRoom(item)} key={item}>{item} <span className="room-count">{counts[item]}</span></button>)}</div>
        <div className="room-scroll"><section className={`pixel-room ${room.toLowerCase()}`} aria-label={`${room} room`}><div className="room-label"><span>{room}</span><small>{room === 'Workspace' ? 'DESKS + COLLABORATION' : 'QUIET BREAK AREA'}</small></div><div className="pixel-window window-one" aria-hidden="true"/><div className="pixel-window window-two" aria-hidden="true"/><div className="pixel-door" aria-hidden="true"/>
          {room === 'Workspace' ? <><div className="pixel-shelf" aria-hidden="true"/><div className="pixel-plant plant-one" aria-hidden="true"/><div className="meeting-table" aria-hidden="true"><span>MEET</span></div>
            {desks.map((desk) => <div className={`ws-desk desk-${desk.seat}${desk.occupied ? ' occupied' : ''}`} key={desk.seat} aria-hidden="true"><i/><span className="desk-plate">{desk.workstation}</span></div>)}</> : <><div className="lounge-sofa" aria-hidden="true"/><div className="lounge-chair chair-one" aria-hidden="true"/><div className="lounge-chair chair-two" aria-hidden="true"/><div className="coffee-table" aria-hidden="true"/><div className="pixel-tv" aria-hidden="true"/><div className="pixel-plant plant-two" aria-hidden="true"/></>}
          {stations.map((station) => { const badge = officeStateBadge(station.state); const busy = ['Working', 'Reviewing', 'Collaborating'].includes(station.state); return <button className={`pixel-station ${station.roomPosition} seat-${station.seat} state-${station.state.toLowerCase()}`} key={station.name} onClick={(event) => { selectedTrigger.current = event.currentTarget; setSelectedName(station.name) }} aria-label={`${station.name}. ${officeStateLabel(station)}${station.activity ? `: ${station.activity}` : ''}. Open station details.`} title={station.activity || officeStateLabel(station)}>{busy && station.activity && <span className="speech" aria-hidden="true">{station.activity}</span>}<span className="pixel-station-name">{station.name}</span><span className={`badge ${badge.tone}`}>{officeStateLabel(station)}</span>{station.state === 'Unknown' && <span className="neutral-label">NEUTRAL PRESENCE</span>}<PixelCharacter avatar={station.avatar}/></button> })}
          {room === 'Lounge' && stations.length === 0 && <p className="room-empty">No declared idle presence</p>}
          {room === 'Workspace' && stations.length === 0 && office && <p className="room-empty">Desks are empty · crew is in the Lounge</p>}
        </section></div><p className="room-hint">Swipe sideways to see the whole room →</p></div>
      <aside className="office-side"><section className="office-summary"><p className="eyebrow">CREW SNAPSHOT</p><strong>{office?.summary.active ?? 0} active work</strong><span>{office?.summary.idle ?? 0} Idle (managed)</span><span>{office?.summary.unknown ?? 0} Unknown / {office?.summary.offline ?? 0} Offline</span><hr/><span>Gateways running: {office ? `${office.summary.gatewaysReachable} of ${office.summary.gatewaysDeclared}` : 'Not Available'}</span></section>
        <section className="office-feed"><p className="eyebrow">LIVE ACTIVITY</p><h2>Unattributed sessions</h2>{sessions?.availability === 'unavailable' ? <p>Not Available</p> : !sessions ? <p>Loading read-only metadata...</p> : sessions.data.length === 0 ? <p>No session metadata available.</p> : sessions.data.slice(0, 3).map((session) => <article key={session.id ?? session.title}><strong>{session.title}</strong><span>{session.lastActive}</span></article>)}<small>Generic session metadata never changes crew state.</small></section>
        <section className="office-feed"><p className="eyebrow">CHANNELS</p><h2>Messaging platforms</h2>{channelSource?.availability === 'unavailable' ? <p>Not Available</p> : !channelSource ? <p>Loading safe status...</p> : channelSource.data.length === 0 ? <p>No configured channels.</p> : channelSource.data.map((channel) => <article key={channel.name}><strong>{channel.name}</strong><span>{channel.status}</span></article>)}{channels?.activeSessions !== undefined && <small>{channels.activeSessions} active session{channels.activeSessions === 1 ? '' : 's'}</small>}</section>
      </aside>
    </section>
    {snapshot.status === 'failed' && <section className="empty-state"><h2>Not Available</h2><p>The office source could not be reached.</p></section>}
    {selected && <OfficeDetail station={selected} onClose={closeDetail}/>}
  </>
}
