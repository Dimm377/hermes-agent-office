import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Vec3 } from '../office3d-layout.ts'
import { merahPutih, screenTexture, signTexture } from './textures.ts'

// Low-poly props built from primitives. Rounded edges and PBR materials keep them from
// looking flat; everything is procedural, so no model files are shipped.

const roundedCache = new Map<string, THREE.BufferGeometry>()
function roundedGeometry(size: Vec3, radius: number) {
  const key = `${size.join(',')}:${radius}`
  let geometry = roundedCache.get(key)
  if (!geometry) {
    geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(radius, ...size.map((value) => value / 2 - 0.001)))
    roundedCache.set(key, geometry)
  }
  return geometry
}

interface MaterialProps { color: string; roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number; opacity?: number; map?: THREE.Texture }

function Material({ color, roughness = 0.7, metalness = 0, emissive, emissiveIntensity = 0.5, opacity, map }: MaterialProps) {
  return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? emissiveIntensity : 0} transparent={opacity !== undefined} opacity={opacity ?? 1} map={map}/>
}

/** Rounded box. */
export function RBox({ position, size, radius = 0.04, rotation, shadow = true, ...material }: { position: Vec3; size: Vec3; radius?: number; rotation?: Vec3; shadow?: boolean } & MaterialProps) {
  return <mesh position={position} rotation={rotation} geometry={roundedGeometry(size, radius)} castShadow={shadow} receiveShadow>
    <Material {...material}/>
  </mesh>
}

export function Cyl({ position, radius, height, rotation, segments = 20, top, ...material }: { position: Vec3; radius: number; height: number; rotation?: Vec3; segments?: number; top?: number } & MaterialProps) {
  return <mesh position={position} rotation={rotation} castShadow receiveShadow>
    <cylinderGeometry args={[top ?? radius, radius, height, segments]}/>
    <Material {...material}/>
  </mesh>
}

function Group({ position = [0, 0, 0], rotation = 0, scale = 1, children }: { position?: Vec3; rotation?: number; scale?: number; children: ReactNode }) {
  return <group position={position} rotation={[0, rotation, 0]} scale={scale}>{children}</group>
}

// ---------------------------------------------------------------------------
// Office furniture

export function OfficeChair({ position, rotation = 0, color = '#2f3a44' }: { position: Vec3; rotation?: number; color?: string }) {
  return <Group position={position} rotation={rotation}>
    <RBox position={[0, 0.48, 0]} size={[0.52, 0.09, 0.5]} radius={0.04} color={color} roughness={0.9}/>
    <RBox position={[0, 0.85, -0.23]} size={[0.5, 0.6, 0.07]} radius={0.04} color={color} roughness={0.9}/>
    <Cyl position={[0, 0.25, 0]} radius={0.035} height={0.42} color="#8b9297" metalness={0.6} roughness={0.3}/>
    {[0, 1, 2, 3, 4].map((spoke) => <RBox key={spoke} position={[Math.sin((spoke / 5) * Math.PI * 2) * 0.2, 0.05, Math.cos((spoke / 5) * Math.PI * 2) * 0.2]} rotation={[0, (spoke / 5) * Math.PI * 2, 0]} size={[0.05, 0.04, 0.42]} radius={0.015} color="#2a2f33"/>)}
  </Group>
}

export function WorkDesk({ position, active, withChair = true }: { position: Vec3; active: boolean; withChair?: boolean }) {
  const screen = useMemo(() => screenTexture(active), [active])
  return <Group position={position}>
    <RBox position={[0, 0.74, 0]} size={[1.9, 0.07, 0.95]} radius={0.03} color="#d9c3a0" roughness={0.6}/>
    <RBox position={[-0.9, 0.37, 0]} size={[0.06, 0.72, 0.85]} radius={0.02} color="#e7e2d8"/>
    <RBox position={[0.9, 0.37, 0]} size={[0.06, 0.72, 0.85]} radius={0.02} color="#e7e2d8"/>
    <RBox position={[0.55, 0.52, 0.02]} size={[0.42, 0.4, 0.8]} radius={0.02} color="#e7e2d8"/>
    {/* Monitor */}
    <RBox position={[0, 1.13, 0.22]} size={[0.86, 0.52, 0.05]} radius={0.02} color="#1c2024" roughness={0.4}/>
    <mesh position={[0, 1.13, 0.194]} rotation={[0, Math.PI, 0]}><planeGeometry args={[0.8, 0.46]}/><meshStandardMaterial map={screen} emissive={active ? '#ffffff' : '#000000'} emissiveMap={screen} emissiveIntensity={active ? 0.9 : 0} roughness={0.3}/></mesh>
    <Cyl position={[0, 0.88, 0.25]} radius={0.03} height={0.22} color="#2a2f33"/>
    <RBox position={[0, 0.785, 0.28]} size={[0.3, 0.02, 0.18]} radius={0.01} color="#2a2f33"/>
    {/* Keyboard, mouse and a mug of kopi */}
    <RBox position={[0, 0.79, -0.18]} size={[0.56, 0.025, 0.18]} radius={0.01} color="#3a4046"/>
    <RBox position={[0.42, 0.79, -0.18]} size={[0.07, 0.03, 0.11]} radius={0.02} color="#3a4046"/>
    <Cyl position={[-0.65, 0.84, -0.1]} radius={0.05} height={0.12} color="#f4efe6"/>
    <Cyl position={[-0.65, 0.901, -0.1]} radius={0.043} height={0.005} color="#3b2415"/>
    {withChair && <OfficeChair position={[0, 0, -0.78]}/>}
  </Group>
}

export function MeetingTable({ position }: { position: Vec3 }) {
  return <Group position={position}>
    <Cyl position={[0, 0.74, 0]} radius={1.05} height={0.08} color="#7a4f33" roughness={0.45} segments={40}/>
    <Cyl position={[0, 0.37, 0]} radius={0.12} height={0.72} color="#2a2f33"/>
    <Cyl position={[0, 0.03, 0]} radius={0.5} height={0.05} color="#2a2f33"/>
    {/* A plate of gorengan for the meeting */}
    <Cyl position={[0.2, 0.8, 0.1]} radius={0.22} height={0.03} color="#f4efe6"/>
    {[0, 1, 2, 3].map((index) => <RBox key={index} position={[0.12 + (index % 2) * 0.14, 0.84, 0.02 + Math.floor(index / 2) * 0.14]} size={[0.12, 0.05, 0.08]} radius={0.02} color="#c98a3c" roughness={0.9}/>)}
  </Group>
}

export function Sofa({ position, rotation = 0, color = '#5b6f8c' }: { position: Vec3; rotation?: number; color?: string }) {
  return <Group position={position} rotation={rotation}>
    <RBox position={[0, 0.28, 0]} size={[2.4, 0.36, 0.9]} radius={0.1} color={color} roughness={0.95}/>
    <RBox position={[0, 0.66, -0.36]} size={[2.4, 0.62, 0.2]} radius={0.1} color={color} roughness={0.95}/>
    <RBox position={[-1.12, 0.52, 0]} size={[0.2, 0.42, 0.9]} radius={0.08} color={color} roughness={0.95}/>
    <RBox position={[1.12, 0.52, 0]} size={[0.2, 0.42, 0.9]} radius={0.08} color={color} roughness={0.95}/>
    {[-0.5, 0.5].map((x) => <RBox key={x} position={[x, 0.5, 0.05]} size={[0.95, 0.14, 0.7]} radius={0.07} color="#6e83a2" roughness={0.95}/>)}
    <RBox position={[-0.7, 0.72, -0.18]} size={[0.38, 0.34, 0.14]} radius={0.07} color="#e0a43a" roughness={0.95}/>
  </Group>
}

export function Armchair({ position, rotation = 0, color }: { position: Vec3; rotation?: number; color: string }) {
  return <Group position={position} rotation={rotation}>
    <RBox position={[0, 0.3, 0]} size={[0.9, 0.4, 0.85]} radius={0.12} color={color} roughness={0.95}/>
    <RBox position={[0, 0.66, -0.34]} size={[0.9, 0.52, 0.18]} radius={0.08} color={color} roughness={0.95}/>
  </Group>
}

export function CoffeeTable({ position }: { position: Vec3 }) {
  return <Group position={position}>
    <RBox position={[0, 0.36, 0]} size={[1.3, 0.07, 0.7]} radius={0.03} color="#8a5a3a" roughness={0.5}/>
    {[[-0.55, -0.27], [0.55, -0.27], [-0.55, 0.27], [0.55, 0.27]].map(([x, z]) => <Cyl key={`${x}${z}`} position={[x, 0.17, z]} radius={0.03} height={0.34} color="#2a2f33"/>)}
    {/* Teh botol and a toples of kerupuk */}
    <Cyl position={[-0.3, 0.48, 0.05]} radius={0.04} height={0.18} color="#3a1f12" opacity={0.85}/>
    <Cyl position={[0.25, 0.49, 0]} radius={0.12} height={0.2} color="#dfe8e6" opacity={0.55} roughness={0.1}/>
    <Cyl position={[0.25, 0.47, 0]} radius={0.1} height={0.14} color="#f1d9a6"/>
  </Group>
}

export function Plant({ position, size = 1 }: { position: Vec3; size?: number }) {
  return <Group position={position} scale={size}>
    <Cyl position={[0, 0.22, 0]} radius={0.2} top={0.26} height={0.44} color="#b0643a" roughness={0.8}/>
    {[[0, 0.75, 0, 0.32], [0.14, 0.95, 0.05, 0.22], [-0.12, 0.92, -0.06, 0.24], [0, 1.12, 0, 0.18]].map(([x, y, z, r]) => <mesh key={`${x}${y}`} position={[x, y, z]} castShadow><icosahedronGeometry args={[r, 1]}/><meshStandardMaterial color="#4f8a4a" roughness={0.85} flatShading/></mesh>)}
  </Group>
}

export function Bookshelf({ position, rotation = 0 }: { position: Vec3; rotation?: number }) {
  const books = useMemo(() => Array.from({ length: 18 }, (_, index) => ({ color: ['#b54b45', '#2f6f8f', '#e0a43a', '#4f8a4a', '#6a4d8d', '#dcd6c8'][index % 6], height: 0.26 + ((index * 7) % 5) * 0.03 })), [])
  return <Group position={position} rotation={rotation}>
    <RBox position={[0, 1, 0]} size={[1.4, 2, 0.4]} radius={0.02} color="#6b4a32"/>
    {[0.35, 0.95, 1.55].map((y, shelf) => books.slice(shelf * 6, shelf * 6 + 6).map((book, index) => <RBox key={`${shelf}-${index}`} position={[-0.5 + index * 0.2, y + book.height / 2, 0.08]} size={[0.14, book.height, 0.26]} radius={0.01} color={book.color}/>))}
  </Group>
}

export function Television({ position }: { position: Vec3 }) {
  return <Group position={position}>
    <RBox position={[0, 0, 0]} size={[2, 1.15, 0.08]} radius={0.03} color="#111416" roughness={0.3}/>
    <mesh position={[0, 0, 0.045]}><planeGeometry args={[1.88, 1.03]}/><meshStandardMaterial color="#1d5a6b" emissive="#2a8aa0" emissiveIntensity={0.55} roughness={0.2}/></mesh>
  </Group>
}

export function WallClock({ position }: { position: Vec3 }) {
  return <Group position={position}>
    <Cyl position={[0, 0, 0]} radius={0.3} height={0.05} rotation={[Math.PI / 2, 0, 0]} color="#f4efe6" segments={28}/>
    <RBox position={[0, 0.07, 0.035]} size={[0.03, 0.18, 0.01]} radius={0.004} color="#1c2024"/>
    <RBox position={[0.06, 0, 0.035]} size={[0.14, 0.025, 0.01]} radius={0.004} color="#1c2024"/>
  </Group>
}

// ---------------------------------------------------------------------------
// Indonesian touches

/** Water dispenser with an upside-down blue galon. */
export function GalonDispenser({ position, rotation = 0 }: { position: Vec3; rotation?: number }) {
  return <Group position={position} rotation={rotation}>
    <RBox position={[0, 0.5, 0]} size={[0.42, 1, 0.42]} radius={0.05} color="#eef0ee" roughness={0.4}/>
    <RBox position={[0, 0.72, 0.19]} size={[0.3, 0.14, 0.06]} radius={0.02} color="#c9ced0"/>
    <Cyl position={[-0.07, 0.72, 0.23]} radius={0.022} height={0.06} rotation={[Math.PI / 2, 0, 0]} color="#d64545"/>
    <Cyl position={[0.07, 0.72, 0.23]} radius={0.022} height={0.06} rotation={[Math.PI / 2, 0, 0]} color="#3d7fd6"/>
    <RBox position={[0, 0.54, 0.16]} size={[0.28, 0.02, 0.14]} radius={0.01} color="#9aa2a6"/>
    {/* The galon: translucent blue, neck down */}
    <Cyl position={[0, 1.33, 0]} radius={0.19} height={0.52} color="#5fb4f2" opacity={0.55} roughness={0.08} segments={24}/>
    <Cyl position={[0, 1.05, 0]} radius={0.06} top={0.17} height={0.1} color="#5fb4f2" opacity={0.6} roughness={0.08}/>
    <Cyl position={[0, 1.6, 0]} radius={0.17} height={0.03} color="#3d8fd6" opacity={0.7}/>
    <Cyl position={[0, 1.3, 0]} radius={0.175} height={0.4} color="#8fd0ff" opacity={0.35} roughness={0.05}/>
  </Group>
}

export function Fridge({ position, rotation = 0 }: { position: Vec3; rotation?: number }) {
  return <Group position={position} rotation={rotation}>
    <RBox position={[0, 0.9, 0]} size={[0.75, 1.8, 0.7]} radius={0.05} color="#dfe3e4" roughness={0.35} metalness={0.2}/>
    <RBox position={[0, 1.3, 0.36]} size={[0.7, 0.02, 0.02]} radius={0.005} color="#9aa2a6"/>
    <RBox position={[0.28, 1.0, 0.37]} size={[0.03, 0.4, 0.03]} radius={0.01} color="#9aa2a6"/>
  </Group>
}

export function PantryCounter({ position, rotation = 0 }: { position: Vec3; rotation?: number }) {
  return <Group position={position} rotation={rotation}>
    <RBox position={[0, 0.45, 0]} size={[2, 0.9, 0.6]} radius={0.02} color="#f2eee6"/>
    <RBox position={[0, 0.92, 0]} size={[2.05, 0.05, 0.65]} radius={0.01} color="#3a3f44" roughness={0.3}/>
    {/* Rice cooker, kopi sachets jar and a kettle */}
    <Cyl position={[-0.6, 1.07, 0]} radius={0.16} height={0.24} color="#f5f5f2"/>
    <Cyl position={[-0.6, 1.2, 0]} radius={0.14} top={0.1} height={0.05} color="#d64545"/>
    <Cyl position={[0.1, 1.05, 0]} radius={0.1} height={0.2} color="#dfe8e6" opacity={0.5}/>
    <Cyl position={[0.1, 1.02, 0]} radius={0.085} height={0.12} color="#6b3b1e"/>
    <Cyl position={[0.62, 1.06, 0]} radius={0.12} top={0.08} height={0.22} color="#b9c0c4" metalness={0.7} roughness={0.25}/>
  </Group>
}

/** Merah Putih on a pole; the cloth waves gently. */
export function FlagPole({ position }: { position: Vec3 }) {
  const cloth = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => merahPutih(), [])
  const geometry = useMemo(() => new THREE.PlaneGeometry(1.2, 0.8, 12, 1).translate(0.6, 0, 0), [])
  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array as Float32Array), [geometry])
  useFrame(({ clock }) => {
    const position = geometry.attributes.position
    for (let index = 0; index < position.count; index += 1) {
      const x = base[index * 3]
      position.setZ(index, Math.sin(clock.elapsedTime * 3 + x * 4) * 0.08 * x)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
  })
  return <Group position={position}>
    <Cyl position={[0, 0.1, 0]} radius={0.35} height={0.2} color="#bdb6a8"/>
    <Cyl position={[0, 2.6, 0]} radius={0.04} height={5} color="#d9dde0" metalness={0.6} roughness={0.3}/>
    <mesh position={[0, 5.05, 0]}><sphereGeometry args={[0.07, 12, 8]}/><meshStandardMaterial color="#d8b24a" metalness={0.7} roughness={0.3}/></mesh>
    <mesh ref={cloth} position={[0.04, 4.55, 0]} geometry={geometry} castShadow><meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.8}/></mesh>
  </Group>
}

export function PlasticStool({ position, color }: { position: Vec3; color: string }) {
  return <Group position={position}>
    <Cyl position={[0, 0.42, 0]} radius={0.17} height={0.04} color={color} roughness={0.5}/>
    <Cyl position={[0, 0.21, 0]} radius={0.19} top={0.15} height={0.4} color={color} roughness={0.5} segments={8}/>
  </Group>
}

function Wheel({ position }: { position: Vec3 }) {
  return <group position={position}>
    <Cyl position={[0, 0, 0]} radius={0.3} height={0.06} rotation={[0, 0, Math.PI / 2]} color="#1f2326" segments={20}/>
    <Cyl position={[0, 0, 0]} radius={0.08} height={0.08} rotation={[0, 0, Math.PI / 2]} color="#c9ced0" metalness={0.6}/>
  </group>
}

/** Street-food pushcart; `kind` switches between gerobak bakso and gerobak somay. */
export function Gerobak({ position, rotation = 0, kind }: { position: Vec3; rotation?: number; kind: 'bakso' | 'somay' }) {
  const bakso = kind === 'bakso'
  const sign = useMemo(() => bakso ? signTexture('BAKSO', '#c62828', '#fff4d6', 'MALANG · MANTAP') : signTexture('SOMAY', '#1e5aa8', '#fff4d6', 'BANDUNG · ASLI'), [bakso])
  const body = bakso ? '#f3efe4' : '#f2d27a'
  const trim = bakso ? '#c62828' : '#1e5aa8'
  const steam = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!steam.current) return
    steam.current.children.forEach((puff, index) => {
      const t = (clock.elapsedTime * 0.5 + index / 3) % 1
      puff.position.y = 1.35 + t * 0.9
      puff.scale.setScalar(0.6 + t)
      ;((puff as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - t)
    })
  })
  return <Group position={position} rotation={rotation}>
    {/* Cart body on two wheels, with push handles */}
    <RBox position={[0, 0.72, 0]} size={[1.8, 0.8, 0.8]} radius={0.05} color={body} roughness={0.6}/>
    <RBox position={[0, 0.34, 0]} size={[1.85, 0.06, 0.85]} radius={0.02} color={trim}/>
    <RBox position={[0, 1.14, 0]} size={[1.85, 0.05, 0.85]} radius={0.02} color={trim}/>
    <Wheel position={[-0.5, 0.3, 0.45]}/><Wheel position={[-0.5, 0.3, -0.45]}/>
    <Cyl position={[0.75, 0.15, 0]} radius={0.04} height={0.3} color="#2a2f33"/>
    <RBox position={[-1.15, 0.95, 0]} size={[0.5, 0.05, 0.05]} rotation={[0, 0, -0.35]} radius={0.02} color="#6b4a32"/>
    {/* Glass display case with the goods */}
    <RBox position={[0.35, 1.45, 0]} size={[0.9, 0.55, 0.62]} radius={0.02} color="#d8f0f4" opacity={0.35} roughness={0.05}/>
    {bakso
      ? [0, 1, 2, 3, 4, 5].map((index) => <mesh key={index} position={[0.1 + (index % 3) * 0.22, 1.28, -0.12 + Math.floor(index / 3) * 0.22]}><sphereGeometry args={[0.07, 10, 8]}/><meshStandardMaterial color="#a98367" roughness={0.9}/></mesh>)
      : [0, 1, 2, 3, 4].map((index) => <RBox key={index} position={[0.1 + (index % 3) * 0.22, 1.27, -0.1 + Math.floor(index / 3) * 0.2]} size={[0.14, 0.1, 0.12]} radius={0.03} color={index % 2 ? '#e8d9b0' : '#d9c089'}/>)}
    {/* Steaming pot (dandang) */}
    <Cyl position={[-0.45, 1.36, 0]} radius={0.25} height={0.4} color="#b9c0c4" metalness={0.75} roughness={0.25}/>
    <Cyl position={[-0.45, 1.58, 0]} radius={0.26} height={0.04} color="#9aa2a6" metalness={0.75} roughness={0.25}/>
    <group ref={steam} position={[-0.45, 0, 0]}>
      {[0, 1, 2].map((index) => <mesh key={index}><sphereGeometry args={[0.1, 10, 8]}/><meshStandardMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false}/></mesh>)}
    </group>
    {/* Roof with the painted sign */}
    {[[-0.85, -0.38], [0.85, -0.38], [-0.85, 0.38], [0.85, 0.38]].map(([x, z]) => <Cyl key={`${x}${z}`} position={[x, 1.75, z]} radius={0.025} height={1.2} color="#6b4a32"/>)}
    <RBox position={[0, 2.38, 0]} size={[2.1, 0.08, 1.1]} radius={0.03} color={trim}/>
    <mesh position={[0, 2.12, 0.42]}><planeGeometry args={[1.7, 0.53]}/><meshStandardMaterial map={sign} roughness={0.7}/></mesh>
    <mesh position={[0, 2.12, -0.42]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.7, 0.53]}/><meshStandardMaterial map={sign} roughness={0.7}/></mesh>
    <PlasticStool position={[0.5, 0, 1.1]} color="#d64545"/>
    <PlasticStool position={[-0.3, 0, 1.2]} color="#3d7fd6"/>
  </Group>
}

export function Tree({ position, size = 1 }: { position: Vec3; size?: number }) {
  return <Group position={position} scale={size}>
    <Cyl position={[0, 0.9, 0]} radius={0.16} top={0.12} height={1.8} color="#6b4a32" roughness={0.9}/>
    {[[0, 2.2, 0, 1], [0.5, 1.9, 0.2, 0.7], [-0.45, 2.0, -0.2, 0.75], [0.1, 2.7, 0.1, 0.7]].map(([x, y, z, r]) => <mesh key={`${x}${y}`} position={[x, y, z]} castShadow><icosahedronGeometry args={[r, 1]}/><meshStandardMaterial color="#3f7a3c" roughness={0.9} flatShading/></mesh>)}
  </Group>
}

export function StreetLamp({ position }: { position: Vec3 }) {
  return <Group position={position}>
    <Cyl position={[0, 1.6, 0]} radius={0.06} height={3.2} color="#2f3336" metalness={0.5}/>
    <RBox position={[0.35, 3.15, 0]} size={[0.8, 0.06, 0.06]} radius={0.02} color="#2f3336"/>
    <RBox position={[0.7, 3.05, 0]} size={[0.3, 0.12, 0.2]} radius={0.04} color="#f5e6b8" emissive="#ffd98a" emissiveIntensity={0.8}/>
  </Group>
}
