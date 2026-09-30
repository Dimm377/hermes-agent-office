import { describe, expect, it } from 'vitest'
import { AISLE_Z, BUILDING, DESKS, ENTRANCE_X, IDLE_STOPS, IDLE_STOP_MS, LOUNGE_LANE_X, LOUNGE_SEATS, MEETING_SEATS, PAN_BOUNDS, SIDE_LANE_X, SIDEWALK_Z, clampTarget, idleStop, placementFor, walkPath } from './office3d-layout.ts'
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

describe('3D office movement', () => {
  it('walks via the aisle instead of through desks', () => {
    expect(walkPath([-7.2, -4.25], [-2, -4.25])).toEqual([[-7.2, AISLE_Z], [-2, AISLE_Z], [-2, -4.25]])
    // Lounge spots are reached via the lounge lane, past the TV cabinet.
    expect(walkPath([-7.2, -4.25], [4, -3.55])).toEqual([[-7.2, AISLE_Z], [LOUNGE_LANE_X, AISLE_Z], [LOUNGE_LANE_X, -3.55], [4, -3.55]])
    expect(walkPath([1, 1], [1.1, 1.1])).toEqual([[1.1, 1.1]])
  })

  it('keeps the panned view inside the grounds', () => {
    expect(clampTarget(100, -100)).toEqual([PAN_BOUNDS.maxX, PAN_BOUNDS.minZ])
    expect(clampTarget(1, 2)).toEqual([1, 2])
  })
})

describe('idle agents', () => {
  it('leave and enter the building through the entrance', () => {
    const out = walkPath([4, -3.55], [-4, 6.3])
    expect(out).toContainEqual([ENTRANCE_X, AISLE_Z])
    expect(out).toContainEqual([ENTRANCE_X, SIDEWALK_Z])
    expect(out.at(-1)).toEqual([-4, 6.3])
    const back = walkPath([-4, 6.3], [8.35, -0.4])
    expect(back).toContainEqual([ENTRANCE_X, SIDEWALK_Z])
    expect(back.findIndex(([x, z]) => x === ENTRANCE_X && z === SIDEWALK_Z)).toBeLessThan(back.findIndex(([x, z]) => x === ENTRANCE_X && z === AISLE_Z))
    // Every waypoint outside is on the sidewalk side, never through the front wall.
    for (const [x, z] of out) if (z > BUILDING.maxZ - 0.3 && z < BUILDING.maxZ + 0.3) expect(x).toBe(ENTRANCE_X)
  })

  it('reach the street food in the gang by the side lane, not through the building wall', () => {
    const bakso = IDLE_STOPS.find((stop) => stop.key === 'bakso')!.spots[0].position
    const path = walkPath([8.35, -0.4], [bakso[0], bakso[2]])
    expect(path).toContainEqual([ENTRANCE_X, SIDEWALK_Z])
    expect(path).toContainEqual([SIDE_LANE_X, SIDEWALK_Z])
    expect(path).toContainEqual([SIDE_LANE_X, bakso[2]])
    for (const [x, z] of path) expect(x < BUILDING.minX || z > BUILDING.maxZ || (x === ENTRANCE_X) || z === AISLE_Z || x === 8.35).toBe(true)
    const kopi = IDLE_STOPS.find((stop) => stop.key === 'kopi')!.spots[1].position
    expect(walkPath([bakso[0], bakso[2]], [kopi[0], kopi[2]])).toEqual([[SIDE_LANE_X, bakso[2]], [SIDE_LANE_X, kopi[2]], [kopi[0], kopi[2]]])
    for (const stop of IDLE_STOPS.filter((item) => ['bakso', 'kopi'].includes(item.key))) for (const { position } of stop.spots) expect(position[0]).toBeLessThan(SIDE_LANE_X)
  })

  it('rotate between stops over time, each seat on its own spot', () => {
    const seen = new Set<string>()
    for (let step = 0; step < 8; step += 1) seen.add(idleStop(1, step * IDLE_STOP_MS).stop.key)
    expect(seen).toEqual(new Set(IDLE_STOPS.map((stop) => stop.key)))
    for (let step = 0; step < 8; step += 1) {
      const spots = [1, 2, 3].map((seat) => idleStop(seat, step * IDLE_STOP_MS).placement.position.join(','))
      expect(new Set(spots).size).toBe(3)
    }
    expect(idleStop(1, 5)).toEqual(idleStop(1, IDLE_STOP_MS - 1))
  })
})
