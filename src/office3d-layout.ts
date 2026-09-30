import type { OfficeStation } from './types.ts'

// Layout of the 3D office (world units ≈ metres, y up, +z towards the street).
// Kept apart from the scene so it can be tested.
//
//   z -5 ┌──────────── back wall ─────────────┐
//        │ agent desks      │  lounge (sofa, TV)│
//        │ spare desks      │  armchairs  pantry│
//        │ meeting table    │       galon, fridge│
//   z  4 └── low front wall ─── entrance ───────┘
//        sidewalk · gerobak bakso & somay · flag
//        road

export type Vec3 = [number, number, number]

export const FLOOR_Y = 0
export const BUILDING = { minX: -9.5, maxX: 9.5, minZ: -5.2, maxZ: 4.2 }
/** Wall between the workspace and the lounge. */
export const PARTITION_X = 0.4

/** Each agent's own desk (seat 1..3) along the back of the workspace. */
export const DESKS: Vec3[] = [[-7.2, 0, -3.5], [-4.6, 0, -3.5], [-2, 0, -3.5]]
/** Unassigned desks that make the workspace feel like an office. */
export const SPARE_DESKS: Vec3[] = [[-5.9, 0, -1], [-3.3, 0, -1]]
/** Walkway in front of the desks; agents walk along it between areas instead of through furniture. */
export const AISLE_Z = 0.4
export const MEETING_TABLE: Vec3 = [-5.2, 0, 2.2]
export const MEETING_SEATS: Vec3[] = [[-6.6, 0, 2.2], [-3.8, 0, 2.2], [-5.2, 0, 0.95]]
export const SOFA: Vec3 = [4.6, 0, -4]
export const LOUNGE_SEATS: Vec3[] = [[4, 0, -3.55], [2.5, 0, -1.9], [6.7, 0, -1.9]]
export const COFFEE_TABLE: Vec3 = [5, 0, -2.5]

export const CAMERA_TARGET: Vec3 = [0.4, 0.6, 1.6]
export const CAMERA_OFFSET: Vec3 = [-3.2, 12.5, 15.5]
/** How far the view may be panned (camera target bounds), so the office never leaves the screen. */
export const PAN_BOUNDS = { minX: -12, maxX: 12, minZ: -7, maxZ: 11 }

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

/**
 * Waypoints from one spot to another via the aisle, so agents walk around desks and tables
 * instead of through them. The last point is always the destination.
 */
export function walkPath(from: [number, number], to: [number, number]): [number, number][] {
  const [fromX, fromZ] = from
  const [toX, toZ] = to
  if (Math.hypot(toX - fromX, toZ - fromZ) < 0.3) return [to]
  const path: [number, number][] = []
  if (Math.abs(fromZ - AISLE_Z) > 0.2) path.push([fromX, AISLE_Z])
  if (Math.abs(fromX - toX) > 0.2) path.push([toX, AISLE_Z])
  path.push(to)
  return path
}

/** Keeps a panned camera target inside the office grounds. */
export function clampTarget(x: number, z: number): [number, number] {
  return [Math.min(Math.max(x, PAN_BOUNDS.minX), PAN_BOUNDS.maxX), Math.min(Math.max(z, PAN_BOUNDS.minZ), PAN_BOUNDS.maxZ)]
}
