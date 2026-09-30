import { describe, expect, it } from 'vitest'
import { DESKS, LOUNGE_SEATS, MEETING_SEATS, placementFor } from './office3d-layout.ts'
import type { OfficeStation } from './types.ts'

const station = (overrides: Partial<OfficeStation>): OfficeStation => ({
  name: 'Lead Agent', role: 'Lead Agent', avatar: 'lead-agent', workstation: 'Command desk', room: 'Workspace', roomPosition: 'assigned-desk',
  state: 'Working', currentTask: '', recentActivity: '', activity: '', seat: 1, provenance: '', freshness: '', ...overrides,
})

describe('3D office placement', () => {
  it('puts working agents at their own desk, seated', () => {
    const placement = placementFor(station({ seat: 2, state: 'Working' }))
    expect(placement.position[0]).toBe(DESKS[1][0])
    expect(placement.position[2]).toBeLessThan(DESKS[1][2])
    expect(placement.seated).toBe(true)
  })

  it('walks collaborating agents to the meeting table and idle agents to the lounge', () => {
    expect(placementFor(station({ state: 'Collaborating', roomPosition: 'meeting-area', seat: 3 })).position).toEqual(MEETING_SEATS[2])
    expect(placementFor(station({ state: 'Idle', room: 'Lounge', roomPosition: 'lounge-seat-2', seat: 2 }))).toMatchObject({ position: LOUNGE_SEATS[1], seated: true })
  })

  it('keeps offline and unknown agents standing at their desk and clamps odd seats', () => {
    expect(placementFor(station({ state: 'Offline', roomPosition: 'offline-station', seat: 1 })).seated).toBe(false)
    expect(placementFor(station({ state: 'Unknown', roomPosition: 'neutral-presence', seat: 9 })).position[0]).toBe(DESKS[2][0])
  })
})
