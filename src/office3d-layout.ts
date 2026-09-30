import type { OfficeStation } from './types.ts'

// Layout of the 3D office (world units ≈ metres, y up, +z towards the street).
// Kept apart from the scene so it can be tested.
//
//   z -5 ┌──────────── back wall ─────────────┐
//   gang │ agent desks      │  lounge (TV, sofa)│
//  bakso │ spare desks      │  armchairs  pantry│
//   kopi │ meeting table    │       galon, fridge│
//   z  4 └── low front wall ─── entrance ───────┘
//        sidewalk · flag      (street food sits in the gang left of the building)
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
/** The TV hangs on the back wall; the sofa faces it (backrest towards the aisle). */
export const TV: Vec3 = [4.6, 0, -4.8]
export const SOFA: Vec3 = [4.6, 0, -1.3]
export const LOUNGE_SEATS: Vec3[] = [[4, 0, -1.8], [2.5, 0, -2.9], [6.7, 0, -2.9]]
const LOUNGE_FACING = [Math.PI, Math.PI / 2, -Math.PI / 2]
export const COFFEE_TABLE: Vec3 = [4.6, 0, -2.9]
/** Gap in the low front wall, and the walking line along the sidewalk just outside it. */
export const ENTRANCE_X = 5.8
export const SIDEWALK_Z = 5.4
/** Walking line up the gang (alley) along the left outside wall, between the wall and the carts. */
export const SIDE_LANE_X = -10.15
/** Lounge agents step to this lane first, so they pass between the armchair and the TV. */
export const LOUNGE_LANE_X = 3.1
/** Street food parks in the gang, turned so its stools and customers face the building. */
export const BAKSO_CART: Vec3 = [-11.9, 0, -2.3]
export const KOPI_BIKE: Vec3 = [-11.9, 0, 1.6]
export const STALL_ROTATION = Math.PI / 2
export const FLAG: Vec3 = [8.4, 0, 5.6]

export const CAMERA_TARGET: Vec3 = [-1.9, 0.6, 0.4]
export const CAMERA_OFFSET: Vec3 = [-3.4, 13.4, 16.6]
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
    return { position: [x, y, z], facing: LOUNGE_FACING[seat], seated: true }
  }
  if (station.roomPosition === 'meeting-area') {
    const [x, y, z] = MEETING_SEATS[seat]
    // Face the table.
    return { position: [x, y, z], facing: Math.atan2(MEETING_TABLE[0] - x, MEETING_TABLE[2] - z), seated: false }
  }
  const [x, y, z] = DESKS[seat]
  return { position: [x, y, z - 0.75], facing: 0, seated: station.state === 'Working' || station.state === 'Reviewing' }
}

const outside = ([x, z]: [number, number]) => z > BUILDING.maxZ || x < BUILDING.minX || x > BUILDING.maxX
const inGang = ([x]: [number, number]) => x < BUILDING.minX
const inLounge = ([x, z]: [number, number]) => x > 1.5 && x < 7.8 && z < -0.6

/**
 * Waypoints from one spot to another, so agents walk around furniture instead of through it:
 * inside along the aisle (lounge spots via the lounge lane), in or out through the entrance,
 * along the sidewalk, and up the gang's lane to the street food. The last point is always the
 * destination.
 */
export function walkPath(from: [number, number], to: [number, number]): [number, number][] {
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 0.3) return [to]
  const route: [number, number][] = [from]
  const toAisle = (point: [number, number]): [number, number][] => inLounge(point) ? [[LOUNGE_LANE_X, point[1]], [LOUNGE_LANE_X, AISLE_Z]] : [[point[0], AISLE_Z]]
  const toSidewalk = (point: [number, number]): [number, number][] => inGang(point) ? [[SIDE_LANE_X, point[1]], [SIDE_LANE_X, SIDEWALK_Z]] : [[point[0], SIDEWALK_Z]]
  if (!outside(from) && !outside(to)) {
    route.push(...toAisle(from), ...toAisle(to).reverse())
  } else if (inGang(from) && inGang(to)) {
    route.push([SIDE_LANE_X, from[1]], [SIDE_LANE_X, to[1]])
  } else if (outside(from) && outside(to)) {
    route.push(...toSidewalk(from), ...toSidewalk(to).reverse())
  } else if (outside(to)) {
    route.push(...toAisle(from), [ENTRANCE_X, AISLE_Z], [ENTRANCE_X, SIDEWALK_Z], ...toSidewalk(to).reverse())
  } else {
    route.push(...toSidewalk(from), [ENTRANCE_X, SIDEWALK_Z], [ENTRANCE_X, AISLE_Z], ...toAisle(to).reverse())
  }
  route.push(to)
  // Drop the start and any waypoint that does not move the agent somewhere new.
  const path: [number, number][] = []
  let last = from
  for (const point of route.slice(1)) {
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.2) { path.push(point); last = point }
  }
  if (path.length === 0 || path[path.length - 1] !== to) path.push(to)
  return path
}

export interface IdleStop { key: string; label: string; spots: Placement[] }
const spot = (x: number, z: number, facing: number, seated = false): Placement => ({ position: [x, 0, z], facing, seated })
/** A spot given in a stall's own coordinates (as if unrotated), placed in the world. */
function stallSpot(stall: Vec3, x: number, z: number, facing: number, seated = false): Placement {
  const cos = Math.cos(STALL_ROTATION)
  const sin = Math.sin(STALL_ROTATION)
  return spot(stall[0] + x * cos + z * sin, stall[2] - x * sin + z * cos, facing + STALL_ROTATION, seated)
}

/**
 * Where idle agents spend their time. Each stop has one spot per seat, so agents that happen to
 * pick the same stop never stand in each other.
 */
export const IDLE_STOPS: IdleStop[] = [
  { key: 'lounge', label: 'Relaxing in the lounge', spots: LOUNGE_SEATS.map(([x, , z], index) => spot(x, z, LOUNGE_FACING[index], true)) },
  { key: 'galon', label: 'Getting water from the galon', spots: [spot(8.35, -0.4, Math.PI / 2), spot(8.2, -1.05, 2.2), spot(8.2, 0.3, 1.1)] },
  // On the gerobak's plastic stools, facing the cart.
  { key: 'bakso', label: 'Eating bakso', spots: [stallSpot(BAKSO_CART, 0.5, 1.1, Math.PI, true), stallSpot(BAKSO_CART, -0.3, 1.2, Math.PI, true), stallSpot(BAKSO_CART, 1.3, 0.9, -2.4)] },
  { key: 'dapur', label: 'In the kitchen', spots: [spot(8.25, 2.6, Math.PI / 2), spot(8.3, 0.65, Math.PI / 2), spot(8.25, 3.3, Math.PI / 2)] },
  { key: 'kopi', label: 'Coffee at the kopi bike', spots: [stallSpot(KOPI_BIKE, -0.5, 0.85, Math.PI), stallSpot(KOPI_BIKE, 0.5, 0.85, Math.PI), stallSpot(KOPI_BIKE, 1.45, 0.3, -Math.PI / 2)] },
  { key: 'jalan', label: 'Taking a stroll', spots: [spot(FLAG[0] - 0.8, FLAG[2] + 0.3, Math.PI / 2), spot(BUILDING.minX + 0.95, -0.9, -Math.PI / 2), spot(1.3, -4.4, Math.PI)] },
]
/** How long an idle agent stays at one stop (walking included). */
export const IDLE_STOP_MS = 32_000
const IDLE_ROUTE = ['lounge', 'galon', 'lounge', 'bakso', 'jalan', 'lounge', 'kopi', 'dapur']

/**
 * The stop an idle agent is at, at a given time. Purely decorative and deterministic: it depends
 * only on the clock and the seat, never on agent data, and seats start at different points of
 * the route so the crew spreads out.
 */
export function idleStop(seat: number, time: number): { stop: IdleStop; placement: Placement } {
  const index = Math.min(Math.max(seat, 1), 3) - 1
  const step = Math.floor(time / IDLE_STOP_MS) + index * 3
  const stop = IDLE_STOPS.find((item) => item.key === IDLE_ROUTE[step % IDLE_ROUTE.length]) ?? IDLE_STOPS[0]
  return { stop, placement: stop.spots[index] }
}

/** Keeps a panned camera target inside the office grounds. */
export function clampTarget(x: number, z: number): [number, number] {
  return [Math.min(Math.max(x, PAN_BOUNDS.minX), PAN_BOUNDS.maxX), Math.min(Math.max(z, PAN_BOUNDS.minZ), PAN_BOUNDS.maxZ)]
}
