import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { officeStateBadge } from '../office-state.ts'
import { DESKS, FLOOR_Y, MEETING_TABLE, PALETTE, SKIN, SOFA, placementFor, type Placement, type Vec3 } from '../office3d-layout.ts'
import type { OfficeStation } from '../types.ts'

// 3D view of the same Office snapshot the 2D view renders. Everything is built from simple
// shapes (no model files): positions come from each station's room, roomPosition and seat,
// so the 3D office shows exactly the states the server derived.

function Block({ position, size, color, rotation, emissive }: { position: Vec3; size: Vec3; color: string; rotation?: Vec3; emissive?: string }) {
  return <mesh position={position} rotation={rotation} castShadow receiveShadow>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.6 : 0}/>
  </mesh>
}

function Desk({ position, occupied, anchor }: { position: Vec3; occupied: boolean; anchor: (object: THREE.Object3D | null) => void }) {
  const [x, , z] = position
  return <group position={[x, 0, z]}>
    <Block position={[0, 0.75, 0]} size={[1.9, 0.1, 0.9]} color="#8a5d40"/>
    {[[-0.85, -0.35], [0.85, -0.35], [-0.85, 0.35], [0.85, 0.35]].map(([dx, dz]) => <Block key={`${dx}${dz}`} position={[dx, 0.36, dz]} size={[0.08, 0.72, 0.08]} color="#3b2a20"/>)}
    <Block position={[0, 1.18, 0.15]} size={[0.8, 0.5, 0.06]} color="#1b2522" emissive={occupied ? '#46c8b0' : undefined}/>
    <Block position={[0, 0.9, 0.15]} size={[0.08, 0.2, 0.08]} color="#1b2522"/>
    <Block position={[0, 0.81, -0.2]} size={[0.6, 0.03, 0.2]} color="#2c3a35"/>
    <Block position={[0, 0.45, -0.75]} size={[0.55, 0.08, 0.55]} color="#355049"/>
    <object3D ref={anchor} position={[0, 0.1, 0.62]}/>
  </group>
}

function Room() {
  return <group>
    {/* Floors: workspace and lounge */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.8, FLOOR_Y, 0]} receiveShadow><planeGeometry args={[9.2, 8]}/><meshStandardMaterial color="#46645a"/></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.2, FLOOR_Y + 0.001, 0]} receiveShadow><planeGeometry args={[6.8, 8]}/><meshStandardMaterial color="#6a5a4d"/></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.2, 0.01, -1.3]} receiveShadow><planeGeometry args={[4.6, 3.2]}/><meshStandardMaterial color="#7f9c95"/></mesh>
    {/* Walls */}
    <Block position={[1.2, 1.4, -4.05]} size={[16, 2.8, 0.1]} color="#33493f"/>
    <Block position={[-7.45, 1.4, 0]} size={[0.1, 2.8, 8]} color="#2b3f37"/>
    <Block position={[1.8, 0.35, 1.8]} size={[0.12, 0.7, 4.4]} color="#1a2622"/>
    {/* Windows */}
    {[-5, -1, 4, 7].map((x) => <Block key={x} position={[x, 1.8, -3.98]} size={[1.4, 0.9, 0.05]} color="#4f9aa0" emissive="#2a6d78"/>)}
    {/* Meeting table and stools */}
    <mesh position={[MEETING_TABLE[0], 0.7, MEETING_TABLE[2]]} castShadow receiveShadow><cylinderGeometry args={[0.95, 0.95, 0.1, 28]}/><meshStandardMaterial color="#b98961"/></mesh>
    <Block position={[MEETING_TABLE[0], 0.35, MEETING_TABLE[2]]} size={[0.16, 0.7, 0.16]} color="#3b2a20"/>
    {/* Lounge: sofa, armchairs, coffee table, TV */}
    <Block position={[SOFA[0], 0.3, SOFA[2] - 0.2]} size={[2.6, 0.45, 0.9]} color="#55706c"/>
    <Block position={[SOFA[0], 0.75, SOFA[2] - 0.6]} size={[2.6, 0.7, 0.2]} color="#4a625e"/>
    <Block position={[3.3, 0.3, -0.4]} size={[0.9, 0.45, 0.9]} color="#a77555"/>
    <Block position={[7.1, 0.3, -0.4]} size={[0.9, 0.45, 0.9]} color="#a77555"/>
    <Block position={[5.2, 0.28, -0.9]} size={[1.2, 0.08, 0.7]} color="#bd8c5d"/>
    <Block position={[5.2, 1.6, -3.95]} size={[2, 1.1, 0.08]} color="#16201d" emissive="#1f5f63"/>
    {/* Plants and shelf */}
    {[[-6.9, -3.5], [1.2, 3.4], [7.9, -3.5]].map(([x, z]) => <group key={`${x}${z}`} position={[x, 0, z]}><Block position={[0, 0.2, 0]} size={[0.4, 0.4, 0.4]} color="#a06c47"/><mesh position={[0, 0.7, 0]} castShadow><sphereGeometry args={[0.38, 10, 8]}/><meshStandardMaterial color="#5c9a64"/></mesh></group>)}
    <Block position={[-7.1, 1, -1.2]} size={[0.5, 2, 1.6]} color="#72513b"/>
  </group>
}

function Character({ station, placement, onSelect, anchor }: { station: OfficeStation; placement: Placement; onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void; anchor: (object: THREE.Object3D | null) => void }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const leftLeg = useRef<THREE.Mesh>(null)
  const rightLeg = useRef<THREE.Mesh>(null)
  const leftArm = useRef<THREE.Mesh>(null)
  const rightArm = useRef<THREE.Mesh>(null)
  const colors = PALETTE[station.avatar] ?? PALETTE.opencode
  const offline = station.state === 'Offline'
  const unknown = station.state === 'Unknown'
  const tint = (color: string) => offline ? '#6b6f6d' : color
  const target = useMemo(() => new THREE.Vector3(...placement.position), [placement])
  // Only the first placement is applied as a prop; later changes are walked to in useFrame.
  const [start] = useState<Vec3>(() => placement.position)

  useFrame((state, delta) => {
    const group = root.current
    if (!group) return
    const time = state.clock.elapsedTime
    const toTarget = target.clone().sub(group.position)
    toTarget.y = 0
    const distance = toTarget.length()
    const walking = distance > 0.05
    if (walking) {
      const step = Math.min(distance, delta * 2.4)
      group.position.add(toTarget.normalize().multiplyScalar(step))
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, Math.atan2(toTarget.x, toTarget.z), 0.2)
    } else {
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, placement.facing, 0.12)
    }
    const swing = walking ? Math.sin(time * 10) * 0.6 : 0
    if (leftLeg.current && rightLeg.current) {
      const seated = !walking && placement.seated
      leftLeg.current.rotation.x = seated ? -Math.PI / 2.4 : swing
      rightLeg.current.rotation.x = seated ? -Math.PI / 2.4 : -swing
    }
    if (leftArm.current && rightArm.current) {
      const typing = !walking && (station.state === 'Working' || station.state === 'Reviewing')
      leftArm.current.rotation.x = walking ? -swing : typing ? -1.1 + Math.sin(time * 14) * 0.12 : 0
      rightArm.current.rotation.x = walking ? swing : typing ? -1.1 + Math.cos(time * 14) * 0.12 : 0
    }
    if (body.current) {
      const seatedDrop = !walking && placement.seated ? -0.28 : 0
      const talk = station.state === 'Collaborating' && !walking ? Math.abs(Math.sin(time * 5)) * 0.04 : 0
      const breathe = station.state === 'Idle' ? Math.sin(time * 2) * 0.02 : 0
      body.current.position.y = seatedDrop + talk + breathe
    }
  })

  return <group ref={root} position={start}>
    <group ref={body} onClick={(event) => { event.stopPropagation(); onSelect(station, null) }} onPointerOver={() => { document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = '' }}>
      <mesh ref={leftLeg} position={[-0.12, 0.62, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color={tint(colors.pants)}/></mesh>
      <mesh ref={rightLeg} position={[0.12, 0.62, 0]} castShadow geometry={legGeometry}><meshStandardMaterial color={tint(colors.pants)}/></mesh>
      <Block position={[0, 0.95, 0]} size={[0.5, 0.55, 0.3]} color={tint(colors.shirt)}/>
      <mesh ref={leftArm} position={[-0.32, 1.18, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color={tint(SKIN)}/></mesh>
      <mesh ref={rightArm} position={[0.32, 1.18, 0]} castShadow geometry={armGeometry}><meshStandardMaterial color={tint(SKIN)}/></mesh>
      <Block position={[0, 1.45, 0]} size={[0.42, 0.4, 0.38]} color={tint(SKIN)}/>
      <Block position={[0, 1.7, -0.02]} size={[0.46, 0.14, 0.42]} color={tint(colors.hair)}/>
      <Block position={[-0.1, 1.48, 0.195]} size={[0.06, 0.06, 0.01]} color="#17201e"/>
      <Block position={[0.1, 1.48, 0.195]} size={[0.06, 0.06, 0.01]} color="#17201e"/>
      {unknown && <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.45, 0.55, 24]}/><meshBasicMaterial color="#e9c47b" transparent opacity={0.8}/></mesh>}
      <object3D ref={anchor} position={[0, 2.05, 0]}/>
    </group>
  </group>
}

// Legs and arms pivot at the hip / shoulder: translate the geometry so its top sits at the origin.
const legGeometry = new THREE.BoxGeometry(0.18, 0.62, 0.2).translate(0, -0.31, 0)
const armGeometry = new THREE.BoxGeometry(0.13, 0.5, 0.15).translate(0, -0.25, 0)

type Registry<T> = MutableRefObject<Map<string, T>>

/**
 * Screen-space labels: each frame, project every anchor into the canvas and move its DOM label
 * there directly (no React re-render). Labels live outside the Canvas, so they unmount cleanly
 * and use the page's own styles and focus handling.
 */
function LabelProjector({ anchors, labels }: { anchors: Registry<THREE.Object3D>; labels: Registry<HTMLElement> }) {
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const projected: { element: HTMLElement; x: number; y: number; depth: number; agent: boolean }[] = []
    for (const [key, object] of anchors.current) {
      const element = labels.current.get(key)
      if (!element) continue
      object.getWorldPosition(point).project(camera)
      const visible = point.z < 1 && Math.abs(point.x) <= 1.1 && Math.abs(point.y) <= 1.1
      element.style.visibility = visible ? 'visible' : 'hidden'
      if (visible) projected.push({ element, x: ((point.x + 1) / 2) * size.width, y: ((1 - point.y) / 2) * size.height, depth: point.z, agent: key.startsWith('agent-') })
    }
    // Nearest labels keep their spot; a farther agent label that would overlap one already
    // placed is lifted above it, so every agent stays readable and clickable.
    projected.sort((a, b) => a.depth - b.depth)
    const placed: { left: number; right: number; top: number; bottom: number }[] = []
    for (const label of projected) {
      const width = label.element.offsetWidth
      const height = label.element.offsetHeight
      // Keep the label inside the canvas horizontally, then avoid labels already placed.
      const x = Math.min(Math.max(label.x, width / 2 + 4), size.width - width / 2 - 4)
      let bottom = label.y
      if (label.agent) {
        const left = x - width / 2
        const right = x + width / 2
        for (let guard = 0; guard < 6; guard += 1) {
          const hit = placed.find((box) => left < box.right && right > box.left && bottom - height < box.bottom && bottom > box.top)
          if (!hit) break
          bottom = hit.top - 4
        }
        placed.push({ left, right, top: bottom - height, bottom })
      }
      label.element.style.transform = `translate(${x}px, ${Math.max(bottom, height + 4)}px) translate(-50%, -100%)`
      label.element.style.zIndex = String(Math.round((1 - label.depth) * 10_000))
    }
  })
  return null
}

const CAMERA_TARGET = new THREE.Vector3(0.4, 0.4, -0.6)
const CAMERA_OFFSET = new THREE.Vector3(-0.9, 6.8, 11.1)

function Controls() {
  const { camera, gl, size } = useThree()
  const controls = useRef<OrbitControls | null>(null)
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement)
    orbit.target.copy(CAMERA_TARGET)
    orbit.enablePan = false
    orbit.enableDamping = true
    orbit.minDistance = 6
    orbit.maxDistance = 32
    orbit.minPolarAngle = 0.35
    orbit.maxPolarAngle = 1.25
    orbit.update()
    controls.current = orbit
    return () => { orbit.dispose(); controls.current = null }
  }, [camera, gl])
  // Frame the whole office for the canvas shape: narrow (phone) canvases pull the camera back.
  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1)
    const distance = CAMERA_OFFSET.length() * Math.max(1, 1.45 / aspect)
    // On tall canvases look a little higher so the office sits in the middle, not the top.
    const target = CAMERA_TARGET.clone().setY(aspect < 1 ? 1.8 : CAMERA_TARGET.y)
    camera.position.copy(target).add(CAMERA_OFFSET.clone().setLength(distance))
    camera.lookAt(target)
    controls.current?.target.copy(target)
    controls.current?.update()
  }, [camera, size.width, size.height])
  useFrame(() => controls.current?.update())
  return null
}

function register<T>(registry: Registry<T>, key: string) {
  return (value: T | null) => { if (value) registry.current.set(key, value); else registry.current.delete(key) }
}

export default function Office3D({ stations, onSelect }: { stations: OfficeStation[]; onSelect: (station: OfficeStation, trigger: HTMLElement | null) => void }) {
  const anchors = useRef(new Map<string, THREE.Object3D>())
  const labels = useRef(new Map<string, HTMLElement>())
  const occupiedSeats = new Set(stations.filter((station) => station.room === 'Workspace' && station.roomPosition !== 'meeting-area').map((station) => station.seat))
  const workstations = new Map(stations.map((station) => [station.seat, station.workstation]))
  return <div className="office-3d" role="region" aria-label="3D office. Drag to rotate, scroll to zoom.">
    <Canvas shadows dpr={[1, 2]} camera={{ position: [-0.5, 7.2, 10.5], fov: 42 }} gl={{ antialias: true }}>
      <color attach="background" args={['#1b2823']}/>
      <ambientLight intensity={0.55}/>
      <hemisphereLight args={['#e8f4ee', '#2a3a33', 0.9]}/>
      <directionalLight position={[6, 12, 6]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10}/>
      <Room/>
      {DESKS.map((position, index) => <Desk key={index} position={position} occupied={occupiedSeats.has(index + 1)} anchor={register(anchors, `desk-${index + 1}`)}/>)}
      {stations.map((station) => <Character key={station.name} station={station} placement={placementFor(station)} onSelect={onSelect} anchor={register(anchors, `agent-${station.name}`)}/>)}
      <LabelProjector anchors={anchors} labels={labels}/>
      <Controls/>
    </Canvas>
    <div className="office-3d-labels">
      {DESKS.map((_, index) => <span key={index} ref={register(labels, `desk-${index + 1}`)} className="desk-label-3d">{workstations.get(index + 1) ?? `Desk ${index + 1}`}</span>)}
      {stations.map((station) => {
        const badge = officeStateBadge(station.state)
        const busy = ['Working', 'Reviewing', 'Collaborating'].includes(station.state)
        return <button key={station.name} ref={register(labels, `agent-${station.name}`)} type="button" className={`agent-tag-3d state-${station.state.toLowerCase()}`} onClick={(event) => onSelect(station, event.currentTarget)} aria-label={`${station.name}. ${station.state}.${station.activity ? ` ${station.activity}.` : ''} Open station details.`}>
          {busy && station.activity && <span className="speech speech-3d">{station.activity}</span>}
          <span className="agent-tag-row"><span className="pixel-station-name">{station.name}</span><span className={`badge ${badge.tone}`}>{station.state === 'Idle' ? 'Idle' : station.state}</span></span>
        </button>
      })}
    </div>
  </div>
}
