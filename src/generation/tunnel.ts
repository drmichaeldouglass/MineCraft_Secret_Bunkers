import { add, type Bounds, type Door, type Exit, type ExitKind, type Heading, type Laser, type Passage, type Turret, type Vec } from "../core/types.js";
import { random } from "../core/rules.js";
/** Secret escape tunnels: a lined service tunnel from a facility's lowest-security deck to a
 *  remote surface exit. Pure and seeded; the runtime surveys the candidate sites and builds the
 *  chosen one. All coordinates are relative to the facility origin, y relative to its surface pad. */

/** Every exit, with how tall its template stands and how far above the ground its ladder reaches:
 *  0 ends in the floor, 1 comes up through a well's rim. */
export interface ExitDesign { label: string; height: number; ladderTop: number }
export const EXITS: Record<ExitKind, ExitDesign> = {
  rock_face: { label: "rock-face door behind the mountain", height: 5, ladderTop: 3 },
  utility_shed: { label: "utility shed", height: 5, ladderTop: 0 },
  forest_cabin: { label: "forest cabin", height: 7, ladderTop: 0 },
  well: { label: "old well", height: 5, ladderTop: 1 },
  hidden_hatch: { label: "hidden hatch", height: 2, ladderTop: 0 },
  mine_headframe: { label: "abandoned mine", height: 7, ladderTop: 0 },
};
/** Exits that stand at a remote site, each built from its own template. */
export const REMOTE: ExitKind[] = ["utility_shed", "forest_cabin", "well", "hidden_hatch", "mine_headframe"];
/** Every exit template is this wide and deep, with the ladder coming up through its centre. */
export const EXIT_SIZE = 7;
/** Half-width of the levelled square around the ladder: the template plus a one-block margin. */
export const SITE = 4;
/** An exit site may be cut or filled this far to level it; rougher ground is passed over. */
export const EXIT_CUT = 4, EXIT_FILL = 4;
/** The tunnel runs at B1: floor lining at -9, interior -8..-6, roof lining at -5. Ground over it
 *  must stand at least this high for two blocks of cover, and an exit this high at most. */
export const MIN_COVER = -3, MAX_RISE = 30;
/** Where the tunnel turns: a small chamber just behind the bunker, under the back of the mountain. */
export const JUNCTION = { x: 13, z: 38 };
/** Legs longer than this are carved as separate pieces, so no single build step is too heavy. */
const PIECE = 12;

export interface Candidate { heading: Heading; x: number; z: number; rank: number }
/** Remote sites the survey considers: three distances in each direction away from the entrance.
 *  Every site is clear of the mountain, so the two never touch. */
export function exitCandidates(): Candidate[] {
  return [0, 1, 2].flatMap(rank => [
    { heading: "south" as const, x: 13, z: 50+rank*8, rank },
    { heading: "east" as const, x: 46+rank*8, z: JUNCTION.z, rank },
    { heading: "west" as const, x: -20-rank*8, z: JUNCTION.z, rank },
  ]);
}
/** Columns sampled over an exit site, every two blocks across the levelled square. */
export function siteColumns(c: { x: number; z: number }): [number, number][] {
  const out: [number, number][] = [];
  for (let dx = -SITE; dx <= SITE; dx += 2) for (let dz = -SITE; dz <= SITE; dz += 2) out.push([c.x+dx, c.z+dz]);
  return out;
}
/** Columns sampled along the tunnel's centre line from the junction to the exit. */
export function routeColumns(c: Candidate): [number, number][] {
  const out: [number, number][] = [];
  if (c.heading === "south") for (let z = JUNCTION.z; z <= c.z; z += 3) out.push([13, z]);
  else for (let x = JUNCTION.x, s = c.heading === "east" ? 1 : -1; s*(c.x-x) >= 0; x += 3*s) out.push([x, JUNCTION.z]);
  return out;
}

export interface SiteSample { floor: number; liquid: boolean; ground: string; canopy: boolean }
export interface CandidateSurvey extends Candidate {
  /** One per site column; undefined where the ground could not be read. */
  samples: (SiteSample | undefined)[];
  /** Lowest ground over the tunnel wherever the pad or the mountain does not already cover it. */
  routeLow: number;
}
/** Where the tunnel comes up. level and ground are absent for the rock-face exit. */
export interface ExitSite { kind: ExitKind; heading?: Heading; x?: number; z?: number; level?: number; ground?: string; cut?: number; fill?: number }

const SANDY = ["minecraft:sand", "minecraft:red_sand", "minecraft:sandstone", "minecraft:red_sandstone"];
const ROCKY = ["minecraft:stone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:tuff",
  "minecraft:calcite", "minecraft:gravel", "minecraft:deepslate", "minecraft:cobblestone", "minecraft:stone_bricks"];
/** The exit that suits the ground: a cabin among trees, a well in sand, a mine on bare rock,
 *  and on open ground a shed, a hatch or a well chosen by the seed. */
export function exitKind(samples: SiteSample[], seed: number): ExitKind {
  const share = (test: (s: SiteSample) => boolean): number => samples.filter(test).length/samples.length;
  if (share(s => s.canopy) >= 0.3) return "forest_cabin";
  if (share(s => SANDY.includes(s.ground) || s.ground.endsWith("terracotta")) >= 0.5) return "well";
  if (share(s => ROCKY.includes(s.ground)) >= 0.5) return "mine_headframe";
  const open: ExitKind[] = ["utility_shed", "hidden_hatch", "well"];
  return open[Math.floor(random((seed ^ 0x51ed27) >>> 0)()*open.length)];
}
/** Pick the flattest dry site that keeps the tunnel buried, nearer sites and a little seeded
 *  variety breaking ties. With no usable site the tunnel comes up behind the mountain instead,
 *  which the bunker's own earthworks always make possible. */
export function chooseExit(surveys: CandidateSurvey[], originY: number, seed: number, preference?: ExitKind): ExitSite {
  if (preference === "rock_face") return { kind: "rock_face" };
  const rng = random((seed ^ 0x7f4a7c15) >>> 0);
  let best: ExitSite | undefined, score = Infinity;
  for (const s of surveys) {
    const jitter = rng()*1.5;
    if (!s.samples.length || s.samples.some(x => !x || x.liquid)) continue;
    const samples = s.samples as SiteSample[], floors = samples.map(x => x.floor).sort((a, b) => a-b);
    const level = floors[floors.length >> 1], cut = floors[floors.length-1]-level, fill = level-floors[0];
    if (cut > EXIT_CUT || fill > EXIT_FILL) continue;
    if (level < originY+MIN_COVER || level > originY+MAX_RISE || s.routeLow < originY+MIN_COVER) continue;
    const value = cut+fill+s.rank*0.75+jitter;
    if (value >= score) continue;
    const counts = new Map<string, number>();
    for (const x of samples) counts.set(x.ground, (counts.get(x.ground) ?? 0)+1);
    const ground = [...counts].sort((a, b) => b[1]-a[1])[0][0];
    score = value;
    best = { kind: preference ?? exitKind(samples, seed), heading: s.heading, x: s.x, z: s.z, level, ground, cut, fill };
  }
  return best ?? { kind: "rock_face" };
}
/** The site a plan uses when no survey was made: flat ground straight behind the mountain. */
export const DEFAULT_SITE = (originY: number): ExitSite =>
  ({ kind: "utility_shed", heading: "south", x: 13, z: 50, level: originY, ground: "minecraft:grass_block", cut: 0, fill: 0 });

export interface TunnelPlan { exit: Exit; doors: Door[]; lasers: Laser[]; lights: Vec[]; turret?: Turret }
/** Lay out the tunnel from the back of the B1 room south of the core to the chosen exit. */
export function planTunnel(origin: Vec, site: ExitSite, defences: boolean): TunnelPlan {
  const p = (x: number, y: number, z: number): Vec => add(origin, { x, y, z });
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Bounds =>
    ({ min: p(Math.min(x0, x1), y0, Math.min(z0, z1)), max: p(Math.max(x0, x1), y1, Math.max(z0, z1)) });
  // A keycard door just outside the room, then a laser grid: whoever comes in from the far end is caught.
  const doors: Door[] = [{ id: "tunnel", min: p(12, -8, 28), max: p(14, -6, 28), clearance: 1, open: true, kind: "security",
    readers: [p(15, -7, 27), p(15, -7, 29)] }];
  const lasers: Laser[] = [-7.6, -6.6].map(y => ({ a: p(12.5, y, 32.5), b: p(14.5, y, 32.5), response: "ALERT" as const }));
  if (site.kind === "rock_face") {
    // The original route: straight on to a hut dug into the back of the mountain.
    return { doors, lasers, lights: [p(13, -5, 30)], exit: { kind: "rock_face", ladder: p(12, 0, 34), facing: 5, ground: "",
      passages: [{ lining: box(11, -9, 26, 15, -5, 36), interior: box(12, -8, 22, 14, -6, 35) }], lamps: [] } };
  }
  const heading = site.heading ?? "south", x = site.x ?? 13, z = site.z ?? 50, level = site.level ?? origin.y;
  const passages: Passage[] = [
    // From the room's rear wall; the room's own aisle is cleared through to it.
    { lining: box(11, -9, 26, 15, -5, 35), interior: box(12, -8, 22, 14, -6, 35) },
    { lining: box(10, -9, 35, 16, -4, 41), interior: box(11, -8, 36, 15, -5, 40) },
  ];
  const lamps: Vec[] = [p(13, -5, 31)];
  // The leg beyond the junction, in pieces; its far end is capped so the ladder has a wall to hang on.
  const leg = (from: number, to: number, piece: (a: number, b: number, cap: boolean) => Passage): void => {
    const step = Math.sign(to-from);
    for (let a = from; step*(to-a) >= 0; a += step*PIECE) {
      const b = step*(to-(a+step*(PIECE-1))) >= 0 ? a+step*(PIECE-1) : to;
      passages.push(piece(a, b, b === to));
    }
  };
  let facing: number, ladder: Vec;
  if (heading === "south") {
    leg(41, z, (a, b, cap) => ({ lining: box(11, -9, a, 15, -5, b+(cap ? 1 : 0)), interior: box(12, -8, a, 14, -6, b) }));
    for (let at = 47; at < z-2; at += 6) lamps.push(p(13, -5, at));
    ladder = p(13, level-origin.y, z); facing = 2;
  } else {
    const s = heading === "east" ? 1 : -1, start = JUNCTION.x+s*3;
    leg(start, x, (a, b, cap) => ({ lining: box(a, -9, 36, b+(cap ? s : 0), -5, 40), interior: box(a, -8, 37, b, -6, 39) }));
    for (let at = start+s*6; s*(x-2-at) > 0; at += s*6) lamps.push(p(at, -5, JUNCTION.z));
    ladder = p(x, level-origin.y, JUNCTION.z); facing = s > 0 ? 4 : 5;
  }
  // Laser turrets may guard a tunnel junction; missile turrets never go underground.
  const corner = heading === "east" ? [11, 40] : heading === "west" ? [15, 40] : [11, 36];
  const turret = defences ? { id: "tunnel", pos: p(corner[0]+0.5, -7, corner[1]+0.5), zone: "tunnel", enabled: true, damaged: false } : undefined;
  return { doors, lasers, lights: [p(13, -4, JUNCTION.z)], turret,
    exit: { kind: site.kind, heading, ladder, facing, ground: site.ground ?? "minecraft:grass_block", passages, lamps } };
}
/** Where a facility's escape tunnel comes out, for menus: "forest cabin 43 blocks south-east, at x, y, z". */
export function escapeRoute(f: { origin: Vec; exit?: Exit }): string {
  const e = f.exit;
  if (!e) return "hut behind the mountain";
  if (e.kind === "rock_face") return EXITS.rock_face.label;
  const dx = e.ladder.x-(f.origin.x+13), dz = e.ladder.z-f.origin.z;
  const names = ["south", "south-west", "west", "north-west", "north", "north-east", "east", "south-east"];
  const way = names[(Math.round(Math.atan2(-dx, dz)/(Math.PI/4))+8)%8];
  return `${EXITS[e.kind].label} ${Math.round(Math.hypot(dx, dz))} blocks ${way} of the entrance, at ${e.ladder.x}, ${e.ladder.y+1}, ${e.ladder.z}`;
}
