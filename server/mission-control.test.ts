import { describe, expect, it } from 'vitest'
import {
  collectActivity,
  collectCalendar,
  collectKnowledge,
  collectSnapshot,
  collectTaskBoard,
  buildOfficeSnapshot,
  buildOfficeSummary,
  parseChannelStatus,
  parseGatewayStatus,
  parseProfiles,
  parseSessions,
  parseSkills,
} from './mission-control.js'

describe('Hermes output parsers', () => {
  it('extracts only profile and model from the profile table', () => {
    expect(parseProfiles(' Profile    Model       Gateway\n ───────\n ◆default  gpt-5.6    running\n  leadengineer  gpt-5.5  running\n')).toEqual([
      { name: 'default', model: 'gpt-5.6' }, { name: 'leadengineer', model: 'gpt-5.5' },
    ])
  })

  it('normalizes gateway state without returning raw output', () => {
    expect(parseGatewayStatus('Active: active (running) since today')).toBe('Running')
    expect(parseGatewayStatus('service stopped')).toBe('Stopped')
    expect(parseGatewayStatus('unexpected')).toBe('Unknown')
  })

  it('gives explicit stopped states precedence over active wording', () => {
    expect(parseGatewayStatus('Service is not running; last known state: active')).toBe('Stopped')
    expect(parseGatewayStatus('inactive (previously running)')).toBe('Stopped')
  })

  it('makes structured unavailable results when a read fails', async () => {
    const snapshot = await collectSnapshot(async () => { throw new Error('not found') })
    expect(snapshot.profiles).toMatchObject({ availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED' } })
    expect(snapshot.openCode.data).toBe('Unknown')
  })

  it('treats unrecognized profile output as unavailable', async () => {
    const snapshot = await collectSnapshot(async (_file, args) => {
      if (args.join(' ') === 'profile list') return 'Hermes profile service is starting.'
      if (args.join(' ') === '-p leadengineer gateway status') return 'running'
      return '1.0.0'
    })

    expect(snapshot.profiles).toMatchObject({ availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED' } })
    expect(snapshot.gateways.default).toMatchObject({ availability: 'unavailable', data: 'Unknown' })
  })

  it('uses the default profile gateway state without invoking a separate default gateway command', async () => {
    const calls: string[][] = []
    const snapshot = await collectSnapshot(async (file, args) => {
      calls.push([file, ...args])
      if (args.join(' ') === 'profile list') return ' Profile    Model       Gateway\n ───────\n ◆default  gpt-5.6    running\n  leadengineer  gpt-5.5  stopped\n'
      if (args.join(' ') === '-p leadengineer gateway status') return 'running'
      return '1.0.0'
    })

    expect(snapshot.gateways.default).toEqual({ availability: 'available', data: 'Running' })
    expect(snapshot.gateways.leadEngineer).toEqual({ availability: 'available', data: 'Running' })
    expect(calls).not.toContainEqual(['hermes', 'gateway', 'status'])
  })
})

describe('Hermes MVP source normalizers', () => {
  it('normalizes only configured messaging platform names and a safe session count', () => {
    expect(parseChannelStatus('System status\nMessaging Platforms\n  Telegram: configured\n  Discord: not configured\n\nActive sessions: 1\nPrivate token: do-not-return\n')).toEqual({
      channels: [{ name: 'Telegram', status: 'Configured' }], activeSessions: 1,
    })
  })

  it('accepts checked platform rows without exposing their trailing provider detail', () => {
    expect(parseChannelStatus('◆ Messaging Platforms\n  Telegram      ✓ configured (home: 100000001)\n  Discord       ✗ not configured\n◆ Sessions\n')).toEqual({
      channels: [{ name: 'Telegram', status: 'Configured' }],
    })
  })

  it('rejects unparseable channel status output', async () => {
    await expect((async () => parseChannelStatus('status is healthy'))()).rejects.toThrow('Unrecognized channel output.')
  })

  it('keeps an empty Kanban array available so the UI can show No tasks', async () => {
    const board = await collectTaskBoard(async () => '[]')
    expect(board.tasks).toEqual({ availability: 'available', data: [] })
  })

  it('keeps Hermes no-jobs output available so the UI can show No scheduled jobs', async () => {
    const calendar = await collectCalendar(async () => "No scheduled jobs.\nCreate one with 'hermes cron create ...' or the /cron command in chat.\n")
    expect(calendar.jobs).toEqual({ availability: 'available', data: [] })
  })

  it('treats malformed or unrecognized source output as unavailable', async () => {
    await expect(Promise.all([
      collectTaskBoard(async () => '[{"unexpected": "value"}]'),
      collectCalendar(async () => 'Cron service is starting.'),
      collectActivity(async () => 'No sessions are currently loaded.'),
      collectKnowledge(async () => 'Skills service is starting.'),
    ])).resolves.toEqual([
      expect.objectContaining({ tasks: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ jobs: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ sessions: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ skills: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
    ])
  })

  it('conservatively normalizes session list metadata', async () => {
    const activity = await collectActivity(async () => 'Title                            Preview                                  Last Active   ID\n──────────────────────────────────────────────────────────────────────────────────────────────────────────────\nExample greeting session 01      halo                                     just now      20260101_000000_example01\n')
    expect(activity.sessions).toEqual({
      availability: 'available',
      data: [{ title: 'Example greeting session 01', preview: 'halo', lastActive: 'just now', id: '20260101_000000_example01' }],
    })
  })

  it('accepts a recognized sessions header with no session rows', () => {
    expect(parseSessions('Title                            Preview                                  Last Active   ID\n──────────────────────────────────────────────────────────────────────────────────────────────────────────────\n')).toEqual([])
  })

  it('normalizes only recognizable enabled skill table rows', async () => {
    const knowledge = await collectKnowledge(async () => '                        Installed Skills (enabled only)                         \n┏━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┓\n┃ Name                    ┃ Category             ┃ Source  ┃ Trust   ┃ Status  ┃\n┡━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━┩\n│ maps                    │ productivity         │ builtin │ builtin │ enabled │\n└─────────────────────────┴──────────────────────┴─────────┴─────────┴─────────┘\n0 hub-installed, 1 builtin, 0 local — 1 enabled shown\n')
    expect(knowledge.skills).toEqual({
      availability: 'available',
      data: [{ name: 'maps', category: 'productivity', source: 'builtin', trust: 'builtin', status: 'enabled' }],
    })
  })

  it('accepts a recognized skills schema with no skill rows', () => {
    expect(parseSkills('┏━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┳━━━━━━━━━┓\n┃ Name                    ┃ Category             ┃ Source  ┃ Trust   ┃ Status  ┃\n┡━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━╇━━━━━━━━━┩\n└─────────────────────────┴──────────────────────┴─────────┴─────────┴─────────┘\n0 hub-installed, 0 builtin, 0 local — 0 enabled shown\n')).toEqual([])
  })

  it('returns structured unavailable states for every new source', async () => {
    const fail = async () => { throw new Error('not found') }
    await expect(Promise.all([collectTaskBoard(fail), collectCalendar(fail), collectActivity(fail), collectKnowledge(fail)])).resolves.toEqual([
      expect.objectContaining({ tasks: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ jobs: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ sessions: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
      expect.objectContaining({ skills: expect.objectContaining({ availability: 'unavailable', data: [] }) }),
    ])
  })
})

describe('Office snapshot', () => {
  const runtime = {
    profiles: { availability: 'available' as const, data: [] },
    gateways: {
      default: { availability: 'available' as const, data: 'Running' as const },
      leadEngineer: { availability: 'available' as const, data: 'Running' as const },
    },
    openCode: { availability: 'available' as const, data: '1.0.0' },
    fetchedAt: '2026-09-27T12:00:00.000Z',
  }

  it('places the no-work crew in Lounge as Mission-Control-managed Idle', () => {
    const office = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })

    expect(office.stations).toMatchObject([
      { name: 'Lead Agent', room: 'Lounge', roomPosition: 'lounge-seat-1', state: 'Idle' },
      { name: 'Lead Engineer', room: 'Lounge', roomPosition: 'lounge-seat-2', state: 'Idle' },
      { name: 'OpenCode', room: 'Lounge', roomPosition: 'lounge-seat-3', state: 'Idle' },
    ])
    expect(office.stations[2].provenance).toContain('OpenCode version availability is not a state signal')
    expect(office.stations[0].provenance).toContain('Mission Control managed-idle placement policy')
    expect(office.summary).toEqual({ declared: 3, active: 0, idle: 3, offline: 0, unknown: 0, gatewaysReachable: 2, gatewaysDeclared: 2 })
  })

  it('uses only station-bound stopped gateways and actor-attributed Kanban tasks for work state', () => {
    const office = buildOfficeSnapshot(runtime, {
      tasks: { availability: 'available', data: [
        { title: 'Unassigned running work', status: 'running' },
        { title: 'Review the office', status: 'review', assignee: 'Lead Engineer' },
      ] },
      fetchedAt: '2026-09-27T12:00:00.000Z',
    }, { sessions: { availability: 'available', data: [] }, fetchedAt: '2026-09-27T12:00:00.000Z' }, { now: runtime.fetchedAt })

    expect(office.stations).toMatchObject([
      { name: 'Lead Agent', role: 'Lead Agent', avatar: 'lead-agent', workstation: 'Command desk', room: 'Lounge', state: 'Idle', currentTask: 'No attributed task', recentActivity: 'No attributed recent activity' },
      { name: 'Lead Engineer', room: 'Workspace', state: 'Reviewing', currentTask: 'Review the office', recentActivity: 'No attributed recent activity' },
      { name: 'OpenCode', room: 'Lounge', state: 'Idle', currentTask: 'No attributed task' },
    ])
  })

  it('returns Unknown when a required managed-idle input is unavailable or stale', () => {
    const unavailable = buildOfficeSnapshot(runtime, { tasks: { availability: 'unavailable', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })
    const stale = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: '2026-09-27T11:58:00.000Z' }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })

    expect(unavailable.stations.map((station) => station.state)).toEqual(['Unknown', 'Unknown', 'Unknown'])
    expect(stale.stations.map((station) => station.state)).toEqual(['Unknown', 'Unknown', 'Unknown'])
  })

  it('maps office states to rooms and keeps unknown agents in a labelled neutral workspace position', () => {
    const office = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })
    expect(office.stations).toMatchObject([
      { name: 'Lead Agent', room: 'Lounge', roomPosition: 'lounge-seat-1' },
      { name: 'Lead Engineer', room: 'Lounge', roomPosition: 'lounge-seat-2' },
      { name: 'OpenCode', room: 'Lounge', roomPosition: 'lounge-seat-3' },
    ])
  })

  it('summarizes only declared office states and reports gateway health separately', () => {
    const office = buildOfficeSnapshot(runtime, { tasks: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { sessions: { availability: 'available', data: [] }, fetchedAt: runtime.fetchedAt }, { now: runtime.fetchedAt })
    expect(buildOfficeSummary(office.stations, runtime)).toEqual({ declared: 3, active: 0, idle: 3, offline: 0, unknown: 0, gatewaysReachable: 2, gatewaysDeclared: 2 })
  })

  it('gives a fresh direct stopped gateway precedence over Kanban and never turns OpenCode version into a work state', () => {
    const office = buildOfficeSnapshot({
      ...runtime,
      gateways: { ...runtime.gateways, default: { availability: 'available', data: 'Stopped' } },
    }, {
      tasks: { availability: 'available', data: [{ title: 'Active lead work', status: 'running', assignee: 'default' }] },
      fetchedAt: '2026-09-27T12:00:00.000Z',
    }, { sessions: { availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED', message: 'Read command was unavailable.' } }, fetchedAt: '2026-09-27T12:00:00.000Z' }, { now: runtime.fetchedAt })

    expect(office.stations[0]).toMatchObject({ name: 'Lead Agent', state: 'Offline', currentTask: 'Active lead work', recentActivity: 'Not Available' })
    expect(office.stations[2]).toMatchObject({ name: 'OpenCode', state: 'Unknown' })
  })

  it('does not turn unassigned work, generic sessions, gateway Running, or a version into active state', () => {
    const office = buildOfficeSnapshot(runtime, {
      tasks: { availability: 'available', data: [{ title: 'Unassigned work', status: 'running' }] }, fetchedAt: runtime.fetchedAt,
    }, {
      sessions: { availability: 'available', data: [{ title: 'Generic session', preview: 'work', lastActive: 'now' }] }, fetchedAt: runtime.fetchedAt,
    }, { now: runtime.fetchedAt })

    expect(office.stations.map((station) => station.state)).toEqual(['Idle', 'Idle', 'Idle'])
  })

  it('uses a fresh explicit overlay before attributed work and expires it', () => {
    const board = { tasks: { availability: 'available' as const, data: [{ title: 'Lead work', status: 'running', assignee: 'default' }] }, fetchedAt: runtime.fetchedAt }
    const activity = { sessions: { availability: 'available' as const, data: [] }, fetchedAt: runtime.fetchedAt }
    const active = buildOfficeSnapshot(runtime, board, activity, { now: runtime.fetchedAt, explicitStates: [{ station: 'Lead Agent', state: 'Reviewing', expiresAt: '2026-09-27T12:00:10.000Z' }] })
    const expired = buildOfficeSnapshot(runtime, board, activity, { now: '2026-09-27T12:00:20.000Z', explicitStates: [{ station: 'Lead Agent', state: 'Reviewing', expiresAt: '2026-09-27T12:00:10.000Z' }] })

    expect(active.stations[0].state).toBe('Reviewing')
    expect(expired.stations[0].state).toBe('Working')
  })
})
