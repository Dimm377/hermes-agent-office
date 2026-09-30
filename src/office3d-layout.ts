import type { OfficeStation } from './types.ts'

// Layout of the 3D office (world units, y up). Kept apart from the scene so it can be tested.

export type Vec3 = [number, number, number]

export const FLOOR_Y = 0
/** Each agent's own desk (seat 1..3) along the back of the workspace. */
export const DESKS: Vec3[] = [[-5.8, 0, -2.4], [-3, 0, -2.4], [-0.2, 0, -2.4]]
export const MEETING_TABLE: Vec3 = [-3, 0, 1.3]
export const MEETING_SEATS: Vec3[] = [[-4.4, 0, 1.3], [-1.6, 0, 1.3], [-3, 0, 2.7]]
export const SOFA: Vec3 = [5.2, 0, -2.6]
export const LOUNGE_SEATS: Vec3[] = [[5.2, 0, -2.2], [3.3, 0, -0.4], [7.1, 0, -0.4]]

export const PALETTE: Record<string, { hair: string; shirt: string; pants: string }> = {
  'lead-agent': { hair: '#b54b45', shirt: '#e6b34e', pants: '#36475d' },
  'lead-engineer': { hair: '#1d293c', shirt: '#70bdcb', pants: '#374052' },
  opencode: { hair: '#6a4d8d', shirt: '#93ca67', pants: '#344349' },
}
export const SKIN = '#e9b57d'

export interface Placement { position: Vec3; facing: number; seated: boolean }

/** Where a station stands in the 3D office, from the same fields the 2D view uses. */
export function placementFor(station: OfficeStation): Placement {
  const seat = Math.min(Math.max(station.seat, 1), 3) - 1
  if (station.room === 'Lounge') {
    const [x, y, z] = LOUNGE_SEATS[seat]
    return { position: [x, y, z], facing: seat === 0 ? 0 : seat === 1 ? Math.PI / 2 : -Math.PI / 2, seated: true }
  }
  if (station.roomPosition === 'meeting-area') {
    const [x, y, z] = MEETING_SEATS[seat]
    // Face the table.
    return { position: [x, y, z], facing: Math.atan2(MEETING_TABLE[0] - x, MEETING_TABLE[2] - z), seated: false }
  }
  const [x, y, z] = DESKS[seat]
  return { position: [x, y, z - 0.75], facing: 0, seated: station.state === 'Working' || station.state === 'Reviewing' }
}

