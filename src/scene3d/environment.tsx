import { useMemo } from 'react'
import { BUILDING, COFFEE_TABLE, MEETING_TABLE, SOFA, SPARE_DESKS, type Vec3 } from '../office3d-layout.ts'
import { Armchair, Bookshelf, CoffeeTable, FlagPole, Fridge, GalonDispenser, Gerobak, MeetingTable, PantryCounter, Plant, RBox, Sofa, StreetLamp, Television, Tree, WallClock, WorkDesk } from './props.tsx'
import { asphalt, carpet, grass, pavingStones, tileFloor, woodFloor } from './textures.ts'

// The building (floors, walls, windows, furniture) and its surroundings (yard, sidewalk,
// street food carts, the flag and the road). Walls facing the camera are kept low, like a
// cut-away dollhouse, so the inside stays visible from any angle the controls allow.

const WALL = '#efe6d6'
const WALL_TOP = '#d9cdb8'
const WALL_HEIGHT = 2.6
const THICK = 0.25

function Floor({ position, size, map, color = '#ffffff', roughness = 0.8 }: { position: Vec3; size: [number, number]; map?: ReturnType<typeof woodFloor>; color?: string; roughness?: number }) {
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={size}/>
    <meshStandardMaterial map={map} color={color} roughness={roughness}/>
  </mesh>
}

function Wall({ from, to, height = WALL_HEIGHT }: { from: [number, number]; to: [number, number]; height?: number }) {
  const [x1, z1] = from
  const [x2, z2] = to
  const length = Math.hypot(x2 - x1, z2 - z1)
  const angle = Math.atan2(z2 - z1, x2 - x1)
  return <group position={[(x1 + x2) / 2, 0, (z1 + z2) / 2]} rotation={[0, -angle, 0]}>
    <RBox position={[0, height / 2, 0]} size={[length + THICK, height, THICK]} radius={0.02} color={WALL} roughness={0.9}/>
    <RBox position={[0, height + 0.02, 0]} size={[length + THICK + 0.02, 0.05, THICK + 0.04]} radius={0.01} color={WALL_TOP}/>
  </group>
}

function Window({ position, width = 1.8 }: { position: Vec3; width?: number }) {
  return <group position={position}>
    <RBox position={[0, 0, 0]} size={[width + 0.12, 1.22, 0.12]} radius={0.02} color="#5a4636"/>
    <mesh position={[0, 0, 0.065]}><planeGeometry args={[width, 1.1]}/><meshStandardMaterial color="#9fd3ea" emissive="#6fb6d6" emissiveIntensity={0.35} roughness={0.05} metalness={0.2}/></mesh>
    <RBox position={[0, 0, 0.08]} size={[0.05, 1.1, 0.03]} radius={0.01} color="#5a4636"/>
  </group>
}

function Building() {
  const { minX, maxX, minZ, maxZ } = BUILDING
  const wood = useMemo(() => woodFloor([4, 4]), [])
  const tiles = useMemo(() => tileFloor([3, 5]), [])
  const rug = useMemo(() => carpet('#5b7c8c', [2, 2]), [])
  const meetingRug = useMemo(() => carpet('#8a4b3c', [2, 2]), [])
  return <group>
    {/* Floors: parquet everywhere, tiles in the pantry, rugs in the lounge and meeting area */}
    <Floor position={[0, 0.005, (minZ + maxZ) / 2]} size={[maxX - minX, maxZ - minZ]} map={wood} roughness={0.55}/>
    <Floor position={[8.35, 0.01, 1.4]} size={[2.3, 5.4]} map={tiles} roughness={0.35}/>
    <Floor position={[4.6, 0.012, -2.9]} size={[4.4, 2.8]} map={rug}/>
    <Floor position={[-5.2, 0.012, 2.2]} size={[3.6, 3]} map={meetingRug}/>
    {/* Full-height back and left walls, low walls towards the camera */}
    <Wall from={[minX, minZ]} to={[maxX, minZ]}/>
    <Wall from={[minX, minZ]} to={[minX, maxZ]}/>
    <Wall from={[maxX, minZ]} to={[maxX, maxZ]} height={1.1}/>
    <Wall from={[minX, maxZ]} to={[4.9, maxZ]} height={0.55}/>
    <Wall from={[6.7, maxZ]} to={[maxX, maxZ]} height={0.55}/>
    {/* Glass-topped half wall around the meeting area and a planter row by the lounge */}
    <Wall from={[-3.2, 1]} to={[-3.2, maxZ]} height={0.9}/>
    <RBox position={[-3.2, 1.35, 2.6]} size={[0.06, 0.9, 3.2]} radius={0.01} color="#cfe8ee" opacity={0.3} roughness={0.05}/>
    {[1.3, 2.3, 3.3].map((z) => <Plant key={z} position={[0.9, 0, z]} size={0.8}/>)}
    {/* Windows on the back and left walls */}
    {[-7, -3.6, 1.4, 6.6].map((x) => <Window key={x} position={[x, 1.55, minZ + 0.14]}/>)}
    {[-3, 0.6].map((z) => <group key={z} rotation={[0, Math.PI / 2, 0]} position={[minX + 0.14, 1.55, z]}><Window position={[0, 0, 0]} width={1.6}/></group>)}
    {/* Workspace */}
    {SPARE_DESKS.map((position, index) => <WorkDesk key={index} position={position} active={false}/>)}
    <MeetingTable position={MEETING_TABLE}/>
    <Bookshelf position={[minX + 0.35, 0, -0.9]} rotation={Math.PI / 2}/>
    <Plant position={[minX + 0.5, 0, -4.6]}/>
    <Plant position={[-0.4, 0, -4.7]} size={0.9}/>
    <WallClock position={[-3.6, 2.35, minZ + 0.14]}/>
    {/* Lounge */}
    <Sofa position={SOFA}/>
    <Armchair position={[2.1, 0, -1.9]} rotation={Math.PI / 2} color="#d9784a"/>
    <Armchair position={[7.1, 0, -1.9]} rotation={-Math.PI / 2} color="#3d7fd6"/>
    <CoffeeTable position={COFFEE_TABLE}/>
    <RBox position={[4.6, 0.3, -0.95]} size={[1.8, 0.6, 0.45]} radius={0.03} color="#6b4a32"/>
    <group position={[4.6, 1.25, -0.95]} rotation={[0, Math.PI, 0]}><Television position={[0, 0, 0]}/></group>
    <Plant position={[2.1, 0, -4.6]}/>
    {/* Pantry: galon dispenser, fridge and counter */}
    <GalonDispenser position={[maxX - 0.45, 0, -0.4]} rotation={-Math.PI / 2}/>
    <Fridge position={[maxX - 0.5, 0, 0.6]} rotation={-Math.PI / 2}/>
    <PantryCounter position={[maxX - 0.45, 0, 2.6]} rotation={-Math.PI / 2}/>
  </group>
}

function Outdoors() {
  const lawn = useMemo(() => grass([14, 12]), [])
  const road = useMemo(() => asphalt([8, 1]), [])
  const sidewalk = useMemo(() => pavingStones([14, 2]), [])
  return <group>
    <Floor position={[0, -0.02, 2]} size={[60, 44]} map={lawn} roughness={1}/>
    <Floor position={[0, -0.005, 7.1]} size={[34, 5]} map={sidewalk} roughness={0.9}/>
    <Floor position={[0, -0.01, 12.1]} size={[60, 5]} map={road} roughness={0.95}/>
    {/* Path from the entrance to the sidewalk */}
    <Floor position={[5.8, 0, 4.7]} size={[1.8, 1]} map={sidewalk}/>
    {/* Merah Putih by the entrance */}
    <FlagPole position={[8.4, 0, 5.6]}/>
    {/* Street food on the sidewalk */}
    <Gerobak kind="bakso" position={[-3.5, 0, 7.4]}/>
    <Gerobak kind="somay" position={[1.2, 0, 7.4]}/>
    <StreetLamp position={[-8, 0, 9.3]}/>
    <StreetLamp position={[4, 0, 9.3]}/>
    {[[-12, -7, 1.3], [12.5, -6.5, 1.2], [-13, 2, 1.1], [13, 3, 1.3], [-10.5, 7.5, 1], [12, 8, 1.1], [-2, -8.5, 1.2], [6, -8, 1.1]].map(([x, z, size]) => <Tree key={`${x}${z}`} position={[x, 0, z]} size={size}/>)}
  </group>
}

export function Environment() {
  return <group>
    <Building/>
    <Outdoors/>
  </group>
}
