import type { GameContent, ZoneId } from '@domain/types'
import { zoneOfItem } from '@domain/zones'
import { playSound } from '@ui/sound/player'
import { Container } from 'pixi.js'
import {
  Particles,
  createCrateBox,
  createPalletLoad,
  createPersonSprite,
  createSack,
  dustPuff,
} from './focus/parts'
import { createBillet } from './focus/recycle/sprites'
import { restPose, walkPose } from './focus/poses'
import { routeVehicleSprite } from './focus/route/sprites'
import type { Spot } from './focus/types'
import { CONNECTORS, type ZoneRect } from './zoneLayout'

type CargoKind = 'sack' | 'billet' | 'pallet' | 'crate'

/**
 * One cross-zone delivery run. Keyed by zone pair (`<from>><to>`) — ui never
 * keys content, and a route only exists where the map paints a link. Paths are
 * world-space waypoints following the links declared in `zoneLayout` /
 * `worldGrounds`: the dirt path alley→forge, the forge lane down to the road,
 * the road band plus the depot/gate driveways. The export truck has no run —
 * its delivery is leaving the map (see `focus/gate`).
 */
export interface CourierRun {
  /** On foot or driving the fleet art of the departure zone. */
  readonly kind: 'walk' | 'drive'
  readonly speed: number
  /** Most couriers drawn for this run no matter how many workers are owned. */
  readonly cap: number
  readonly cargo: CargoKind
  readonly hat: 'straw' | 'cap'
  /**
   * Fleet tier override for a driving run: a hand cart on a dirt footpath never
   * upgrades itself into a box truck, whatever its zone's visual tier says.
   */
  readonly vehicle?: number
  readonly path: readonly Spot[]
  /**
   * World point where delivered cargo lands — the destination zone's visible
   * warehouse stack (see the zone scenes). Defaults to the path end.
   */
  readonly drop?: Spot
}

export const COURIER_RUNS: Record<string, CourierRun> = {
  // Dirt path {x:384, y:100, w:224, h:48}: alley east gate → the forge sack stack.
  // Đẩy xe cút kít theo lối mòn (ghim tier 0 — lối mòn không bao giờ thành xe tải).
  'alley>recycle': {
    kind: 'drive',
    speed: 34,
    cap: 3,
    cargo: 'sack',
    hat: 'cap',
    vehicle: 0,
    path: [
      { x: 388, y: 124 },
      { x: 596, y: 124 },
      { x: 648, y: 112 },
    ],
    drop: { x: 650, y: 112 },
  },
  // Forge south lane {x:700, y:184, w:48, h:196}: the billet stack down to the
  // roadside stack at the lane junction (the route zone's warehouse).
  'recycle>route': {
    kind: 'walk',
    speed: 28,
    cap: 2,
    cargo: 'billet',
    hat: 'straw',
    path: [
      { x: 724, y: 168 },
      { x: 724, y: 374 },
    ],
    drop: { x: 724, y: 372 },
  },
  // Westbound lane of the road band, then down the depot driveway {x:216, y:444, w:36, h:116}
  // into the yard where the pallet stack waits. Đi bộ: driveway là đường DỌC, mà
  // art xe chỉ có hướng đông-tây — chạy xe xuống đây là trôi ngang. Xe chỉ chạy
  // trên đường ngang (band + làn xuất), mọi chặng dọc do người vác.
  'route>depot': {
    kind: 'walk',
    speed: 30,
    cargo: 'pallet',
    hat: 'cap',
    cap: 2,
    path: [
      { x: 724, y: 418 },
      { x: 252, y: 418 },
      { x: 234, y: 436 },
      { x: 234, y: 552 },
      { x: 258, y: 562 },
    ],
    drop: { x: 280, y: 584 },
  },
  // Depot driveway up to the road, east along the south walk, down the gate
  // driveway's east side to the crate stack (world 956, beside the truck dock).
  'depot>gate': {
    kind: 'walk',
    speed: 34,
    cap: 2,
    cargo: 'crate',
    hat: 'cap',
    path: [
      { x: 234, y: 556 },
      { x: 234, y: 447 },
      { x: 240, y: 441 },
      { x: 956, y: 441 },
      { x: 956, y: 552 },
    ],
    drop: { x: 956, y: 560 },
  },
}

/** Cargo offset in front of the carrier (origin per drawer, see `focus/parts`). */
const CARGO_OFFSET: Record<CargoKind, Spot> = {
  sack: { x: 3, y: -12 },
  billet: { x: 4, y: -11 },
  pallet: { x: 3, y: -12 },
  crate: { x: 2, y: -10 },
}

/** Arms hug the load out front — same pose the alley porter and depot hauler use. */
const CARRY_ARM_L = -3.6
const CARRY_ARM_R = 0.8

export interface WalkerCourier {
  readonly container: Container
  /** Carried load, hidden on the empty return trip. */
  readonly cargo: Container
  update(dt: number, particles: Particles): void
}

export interface DriveCourier {
  readonly container: Container
  update(dt: number, particles: Particles): void
}

interface PathPoint extends Spot {
  dist: number
}

interface Path {
  readonly points: readonly PathPoint[]
  readonly total: number
}

function preparePath(path: readonly Spot[]): Path {
  const points: PathPoint[] = []
  let total = 0
  for (const spot of path) {
    const prev = points[points.length - 1]
    if (prev) total += Math.hypot(spot.x - prev.x, spot.y - prev.y)
    points.push({ x: spot.x, y: spot.y, dist: total })
  }
  return { points, total }
}

function samplePath(path: Path, dist: number): Spot & { dx: number; dy: number } {
  const clamped = Math.max(0, Math.min(path.total, dist))
  let index = 0
  while (index < path.points.length - 2 && (path.points[index + 1]?.dist ?? path.total) < clamped) {
    index += 1
  }
  const a = path.points[index]
  const b = path.points[index + 1]
  if (!a || !b) return { x: 0, y: 0, dx: 1, dy: 0 }
  const span = b.dist - a.dist
  const t = span > 0 ? (clamped - a.dist) / span : 0
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: b.x - a.x, dy: b.y - a.y }
}

function createCargo(kind: CargoKind): Container {
  if (kind === 'sack') return createSack(0.9)
  if (kind === 'billet') return createBillet()
  if (kind === 'crate') return createCrateBox(0.95)
  return createPalletLoad(0.9)
}

/**
 * On-foot run: pick the load up at the source end, carry it to the destination
 * end, drop it there (with a puff and the sack sound) and walk back empty.
 * Several couriers on one run start spread along the path so they never move
 * as a conga line.
 */
export function createWalkerCourier(run: CourierRun, variant: number): WalkerCourier {
  const person = createPersonSprite(variant, run.hat)
  const cargo = createCargo(run.cargo)
  const offset = CARGO_OFFSET[run.cargo]
  cargo.position.set(offset.x, offset.y)

  const path = preparePath(run.path)
  let dist = run.cap > 1 ? (path.total * variant) / run.cap : 0
  let dir: 1 | -1 = 1
  let carrying = true
  let pause = 0
  let clock = variant * 1.7
  let dustTimer = 0
  let facing = 1

  const setCarrying = (next: boolean): void => {
    carrying = next
    cargo.visible = next
  }
  setCarrying(dist < path.total)

  person.container.addChild(cargo)

  const update = (dt: number, particles: Particles): void => {
    clock += dt

    if (pause > 0) {
      pause -= dt
      person.body.y = Math.sin(clock * 3) * 0.5
    } else {
      dist += dir * run.speed * dt
      if (dir === 1 && dist >= path.total) {
        dist = path.total
        dir = -1
        pause = 0.5
        if (carrying) {
          setCarrying(false)
          // The load lands on the destination zone's warehouse stack and rests
          // there briefly — the pile itself grows from the zone's real stock.
          const spot = run.drop ?? samplePath(path, dist)
          const jitter = ((variant * 7) % 13) - 6
          particles.spawn(createCargo(run.cargo), spot.x + jitter, spot.y - 9, {
            vx: 0,
            vy: -7,
            life: 0.8,
            gravity: 38,
          })
          playSound('sack-drop')
        }
      } else if (dir === -1 && dist <= 0) {
        dist = 0
        dir = 1
        pause = 0.45
        if (!carrying) {
          setCarrying(true)
          playSound('sack-lift')
        }
      }

      if (pause <= 0) {
        const spot = samplePath(path, dist)
        const dx = spot.dx * dir
        const dy = spot.dy * dir
        if (Math.abs(dx) > 3) facing = dx < 0 ? -1 : 1
        person.face.visible = !(dy < 0 && Math.abs(dy) > Math.abs(dx))
        walkPose(person, clock, { swingArms: !carrying })
        if (carrying) {
          person.armsL.x = CARRY_ARM_L
          person.armsR.x = CARRY_ARM_R
        }
        dustTimer -= dt
        if (dustTimer <= 0) {
          dustTimer = 0.5
          particles.spawn(dustPuff(), spot.x - facing * 4, spot.y + 1, {
            vx: -facing * 10,
            vy: -2,
            life: 0.4,
            gravity: 8,
          })
        }
      } else {
        restPose(person)
        if (carrying) {
          person.armsL.x = CARRY_ARM_L
          person.armsR.x = CARRY_ARM_R
        }
      }
    }

    const spot = samplePath(path, dist)
    person.container.scale.x = facing
    person.container.x = Math.round(spot.x)
    person.container.y = Math.round(spot.y)
  }

  return { container: person.container, cargo, update }
}

/**
 * Driving run: the departure zone's fleet art (tier follows its vehicle
 * upgrades) drives the load to the destination end, turns (barrier sound) and
 * comes back. Box trucks at tier 2 hide their load behind the container, which
 * is exactly what a closed truck does.
 */
export function createDriveCourier(run: CourierRun, tier: number, variant: number): DriveCourier {
  const vehicle = routeVehicleSprite(tier, variant)
  const container = vehicle.container

  let load: Container | null = null
  if (tier <= 1) {
    load = createCargo(run.cargo)
    load.scale.set(0.9)
    load.position.set(tier === 0 ? -9 : -10, tier === 0 ? -17.4 : -17.6)
    container.addChild(load)
  }

  const path = preparePath(run.path)
  let dist = run.cap > 1 ? (path.total * variant) / run.cap : 0
  let dir: 1 | -1 = 1
  let pause = 0
  let clock = variant * 2.3
  let dustTimer = 0

  const setLoaded = (loaded: boolean): void => {
    if (load) load.visible = loaded
  }
  setLoaded(dist < path.total)

  const update = (dt: number, particles: Particles): void => {
    clock += dt
    const moving = pause <= 0

    if (pause > 0) {
      pause -= dt
    } else {
      dist += dir * run.speed * dt
      if (dir === 1 && dist >= path.total) {
        dist = path.total
        dir = -1
        pause = 0.8
        setLoaded(false)
        // Unload at the destination warehouse stack, then turn around.
        const spot = run.drop ?? samplePath(path, dist)
        const jitter = ((variant * 5) % 11) - 5
        particles.spawn(createPalletLoad(0.7), spot.x + jitter, spot.y - 4, {
          vx: 0,
          vy: -8,
          life: 0.7,
          gravity: 40,
        })
        playSound('vehicle-turn')
      } else if (dir === -1 && dist <= 0) {
        dist = 0
        dir = 1
        pause = 0.8
        setLoaded(true)
        playSound('vehicle-turn')
      }
    }

    const spot = samplePath(path, dist)
    // Hướng mặt theo CHIỀU ĐI thật (segment × dir) — thiếu `dir` là xe chạy ngược
    // mặt suốt chiều về.
    const travelX = spot.dx * dir
    if (Math.abs(travelX) > 3) {
      container.scale.x = travelX < 0 ? -1 : 1
    }
    for (const wheel of vehicle.wheels) {
      wheel.spin(moving ? run.speed : 0, dt)
    }

    dustTimer -= dt
    if (moving && dustTimer <= 0) {
      dustTimer = 0.36
      const back = travelX < 0 ? 14 : -14
      particles.spawn(dustPuff(), spot.x - back, spot.y + 1, { vx: -back, vy: -2, life: 0.4, gravity: 6 })
    }

    const bump = moving ? Math.sin(clock * 11) * 0.8 : 0
    container.x = Math.round(spot.x)
    container.y = Math.round(spot.y + bump)
  }

  return { container, update }
}

/** Counts fed from the store sync: owned workers per id + zone visual tiers. */
export interface CourierCounts {
  readonly workers: ReadonlyMap<string, number>
  readonly tiers: ReadonlyMap<ZoneId, number>
}

/** One content leg that owns a map run. */
export interface CourierLeg {
  readonly workerId: string
  readonly from: ZoneId
  readonly to: ZoneId
}

/**
 * Transport legs of the content (worker with an `input`) whose output lands in
 * another zone that has a run declared. Content-agnostic consumers (the studio)
 * can build legs by hand from `COURIER_RUNS` keys instead.
 */
export function courierLegsFor(content: GameContent): CourierLeg[] {
  const legs: CourierLeg[] = []
  for (const branch of Object.values(content.branches)) {
    for (const worker of branch.workers) {
      if (!worker.input) continue
      const to = zoneOfItem(content, worker.output.item)
      if (!to) continue
      const from = worker.visual.zone
      if (!COURIER_RUNS[`${from}>${to}`]) continue
      legs.push({ workerId: worker.id, from, to })
    }
  }
  return legs
}

export interface Couriers {
  readonly root: Container
  setCounts(counts: CourierCounts): void
  /** Updates only the runs whose bounds intersect the view (matches zone-scene culling). */
  update(dt: number, view: ZoneRect): void
  /** Visible courier count of one run (scene tests / debug readout). */
  crewSize(from: ZoneId, to: ZoneId): number
}

interface Leg {
  readonly workerId: string
  readonly from: ZoneId
  readonly to: ZoneId
  readonly run: CourierRun
  readonly bounds: ZoneRect
}

interface Actor {
  readonly container: Container
  update(dt: number, particles: Particles): void
}

function pathBounds(path: readonly Spot[]): ZoneRect {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const spot of path) {
    minX = Math.min(minX, spot.x)
    minY = Math.min(minY, spot.y)
    maxX = Math.max(maxX, spot.x)
    maxY = Math.max(maxY, spot.y)
  }
  return { x: minX - 30, y: minY - 30, width: maxX - minX + 60, height: maxY - minY + 60 }
}

function intersects(view: ZoneRect, rect: ZoneRect): boolean {
  return (
    view.x < rect.x + rect.width &&
    view.x + view.width > rect.x &&
    view.y < rect.y + rect.height &&
    view.y + view.height > rect.y
  )
}

/**
 * Map-level courier layer: every declared leg gets a run on top of the
 * connectors — sacks alley→forge, billets forge→road, pallets road→depot,
 * crates depot→gate. Purely decorative: it reads worker counts, never touches
 * domain state.
 */
export function createCouriers(courierLegs: readonly CourierLeg[]): Couriers {
  const root = new Container()
  const particles = new Particles()
  root.addChild(particles.container)

  const legs: Leg[] = []
  for (const courierLeg of courierLegs) {
    const run = COURIER_RUNS[`${courierLeg.from}>${courierLeg.to}`]
    if (!run) continue
    legs.push({
      workerId: courierLeg.workerId,
      from: courierLeg.from,
      to: courierLeg.to,
      run,
      bounds: pathBounds(run.path),
    })
  }

  const actorsByWorker = new Map<string, Actor[]>()
  const workers = new Map<string, number>()
  const tiers = new Map<ZoneId, number>()
  let tier = 0

  const setCounts = (counts: CourierCounts): void => {
    workers.clear()
    for (const [workerId, count] of counts.workers) workers.set(workerId, count)
    tiers.clear()
    for (const [zoneId, value] of counts.tiers) tiers.set(zoneId, value)

    const nextTier = Math.max(
      0,
      ...legs
        .filter((leg) => leg.run.kind === 'drive' && leg.run.vehicle === undefined)
        .map((leg) => tiers.get(leg.from) ?? 0),
    )
    if (nextTier !== tier) {
      // New fleet art: rebuild driving couriers instead of patching sprites.
      tier = nextTier
      for (const leg of legs) {
        if (leg.run.kind !== 'drive') continue
        const actors = actorsByWorker.get(leg.workerId) ?? []
        for (const actor of actors) actor.container.destroy({ children: true })
        actorsByWorker.set(leg.workerId, [])
      }
    }
  }

  const update = (dt: number, view: ZoneRect): void => {
    for (const leg of legs) {
      if (!intersects(view, leg.bounds)) continue
      const desired = Math.min(workers.get(leg.workerId) ?? 0, leg.run.cap)
      let actors = actorsByWorker.get(leg.workerId)
      if (!actors) {
        actors = []
        actorsByWorker.set(leg.workerId, actors)
      }
      while (actors.length < desired) {
        const actor: Actor = leg.run.kind === 'drive'
          ? createDriveCourier(leg.run, leg.run.vehicle ?? tier, actors.length)
          : createWalkerCourier(leg.run, actors.length)
        actors.push(actor)
        root.addChild(actor.container)
      }
      for (let i = 0; i < actors.length; i++) {
        const actor = actors[i]
        if (!actor) continue
        actor.container.visible = i < desired
        if (i < desired) actor.update(dt, particles)
      }
    }
    particles.update(dt)
  }

  const crewSize = (from: ZoneId, to: ZoneId): number => {
    let total = 0
    for (const leg of legs) {
      if (leg.from !== from || leg.to !== to) continue
      const actors = actorsByWorker.get(leg.workerId) ?? []
      for (const actor of actors) {
        if (actor.container.visible) total += 1
      }
    }
    return total
  }

  return { root, setCounts, update, crewSize }
}

/** Painted links a courier path may use besides the zone rects themselves. */
export const COURIER_GROUND: readonly ZoneRect[] = [
  ...CONNECTORS,
  // The alley→forge dirt path painted by `worldGrounds` (paintPath call there).
  { x: 384, y: 100, width: 224, height: 48 },
]
