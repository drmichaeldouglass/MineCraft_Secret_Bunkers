import { add } from "../core/types.js";
import { random } from "../core/rules.js";
import { checkRequest, COMMAND_Y, FLOOR_STEP, secretTunnel, underground } from "./planner.js";
/** The fortified estate: a walled compound around a mansion that stands over a smaller copy of
 *  the command bunker. It reuses the bunker's underground floors, doors, grids, alarms, turrets,
 *  secret tunnel and self-destruct; only the surface is its own. Coordinates are relative to the
 *  facility origin, which is the origin of the bunker beneath. Must match tools/build_assets.py. */
/** The perimeter wall runs round this rectangle, gate in the middle of the north side. */
export const COMPOUND = { x0: -24, x1: 50, z0: -30, z1: 50 };
/** The levelled ground: the compound and a two-block margin outside its wall. */
export const ESTATE_PAD = { x0: COMPOUND.x0 - 2, x1: COMPOUND.x1 + 2, z0: COMPOUND.z0 - 2, z1: COMPOUND.z1 + 2 };
export const WALL_HEIGHT = 5;
/** Main gate: a blast door in the north wall, the same size as the bunker's entrance door. */
export const GATE = { x0: 11, x1: 15 };
/** The driveway from the gate to the mansion's front door. */
export const DRIVE = { x0: 10, x1: 16 };
/** North-west corners of the watchtowers and gate pillars. */
export const TOWERS = [[-23, -29], [45, -29], [-23, 45], [45, 45]];
export const PILLARS = [[6, -31], [18, -31]];
const box = (x, y, z) => ({ x, y, z });
export const BUILDINGS = [
    // Mansion local x = origin x + 4, local z = origin z - 1: its hall holds the bunker's lift pad and ladder.
    { template: "mansion", x: -4, z: 1, size: box(35, 13, 23), role: "mansion" },
    { template: "gatehouse", x: 19, z: -28, size: box(7, 6, 7), role: "gatehouse" },
    { template: "garage", x: -16, z: -24, size: box(9, 6, 15), role: "garage" },
    { template: "helipad", x: 30, z: -26, size: box(13, 2, 13), role: "helipad" },
    { template: "fountain", x: 20, z: -12, size: box(7, 3, 7), role: "garden" },
    { template: "utility", x: 22, z: 34, size: box(9, 6, 7), role: "utility" },
    ...TOWERS.map(([x, z]) => ({ template: "watchtower", x, z, size: box(5, 15, 5), role: "watchtower" })),
    ...PILLARS.map(([x, z]) => ({ template: "gate_pillar", x, z, size: box(3, 8, 3), role: "gate_pillar" })),
];
/** North ends of the garage's three bays, in its east wall at x = -8. */
export const GARAGE_BAYS = [-23, -18, -13];
/** Mansion windows (x of each pair's west pane, relative to the origin), both storeys, both long facades. */
export const WINDOWS = [-2, 3, 22, 27];
/** Exit sites lie beyond the compound wall, so the survey looks farther out than for a bunker. */
export const ESTATE_SEARCH = { ranks: 5, clear: { x0: COMPOUND.x0 - 1, x1: COMPOUND.x1 + 1, z0: COMPOUND.z0 - 1, z1: COMPOUND.z1 + 1 } };
/** Where the tunnel comes up when no remote site will do: a well in the back garden, inside the walls. */
export const GARDEN_EXIT = (level, ground = "minecraft:grass_block") => ({ kind: "well", heading: "south", x: 13, z: 44, level, ground, cut: 0, fill: 0 });
/** The site a plan uses when no survey was made: flat ground south of the compound. */
export const DEFAULT_ESTATE_SITE = (level) => ({ kind: "hidden_hatch", heading: "south", x: 13, z: 58, level, ground: "minecraft:grass_block", cut: 0, fill: 0 });
export function planEstate(origin, levels, seed, defences, id = `sf_${seed >>> 0}`, site = DEFAULT_ESTATE_SITE(origin.y)) {
    checkRequest(origin, levels, seed, 5);
    const rng = random(seed), p = (x, y, z) => add(origin, { x, y, z }), on = defences ? "ACTIVE" : "OFFLINE";
    const f = {
        schema: 1, id, type: "estate", dimension: "minecraft:overworld", seed, origin,
        bounds: { min: p(ESTATE_PAD.x0, -levels * FLOOR_STEP, ESTATE_PAD.z0), max: p(ESTATE_PAD.x1, 24, ESTATE_PAD.z1) },
        state: "NORMAL", phase: "building", buildStep: 0, doors: [], floors: [], lasers: [], lights: [], turrets: [], modules: [],
        zones: { gate: on, perimeter: on, command: defences ? "ALERT_ONLY" : "OFFLINE", tunnel: defences ? "ALERT_ONLY" : "OFFLINE" },
        lasersEnabled: true, consoles: [], charges: [],
    };
    for (const b of BUILDINGS)
        f.modules.push({ template: `estate/${b.template}`, pos: p(b.x, 0, b.z), floor: 0, role: b.role, size: b.size });
    f.floors.push({ name: "Mansion • Grand hall", y: origin.y, clearance: 1, destination: p(13.5, 1, 13.5), panel: p(15, 2, 14) });
    const z0 = COMPOUND.z0;
    // The gate first: like the bunker's entrance, the facility's main door is its first door.
    f.doors.push({ id: "gate", min: p(GATE.x0, 1, z0), max: p(GATE.x1, 4, z0), clearance: 1, open: false, kind: "blast", readers: [p(17, 2, z0 - 1), p(17, 2, z0 + 1)] });
    for (const [door, z] of [["front", 2], ["back", 22]])
        f.doors.push({ id: door, min: p(12, 1, z), max: p(14, 3, z), clearance: 1, open: false, kind: "security", readers: [p(15, 2, z - 1), p(15, 2, z + 1)] });
    // Garage bays and every shuttered window close in a lockdown and open again after it.
    GARAGE_BAYS.forEach((z, i) => f.doors.push({ id: `garage_${i}`, min: p(-8, 1, z), max: p(-8, 3, z + 2), clearance: 4, open: true, kind: "shutter", readers: [] }));
    for (const x of WINDOWS)
        for (const y of [2, 8])
            for (const [side, z] of [["n", 1], ["s", 23]])
                f.doors.push({ id: `window_${side}_${x}_${y}`, min: p(x, y, z), max: p(x + 1, y + 1, z), clearance: 4, open: true, kind: "shutter", readers: [] });
    // Alarm lamps on the gate pillars, the watchtowers, the grand hall and the gatehouse.
    f.lights.push(p(6, 7, -31), p(20, 7, -31), ...TOWERS.map(([x, z]) => p(x, 13, z)), p(13, 5, 6), p(13, 5, 18), p(20, 4, -27));
    underground(f, levels, rng);
    // A grid across the driveway just inside the gate, between the hedges.
    for (const y of [1.4, 2.4])
        f.lasers.push({ a: p(DRIVE.x0 + 0.5, y, -26.5), b: p(DRIVE.x1 + 0.5, y, -26.5), response: "ALERT" });
    // The gatehouse guards the gate; the mansion's study is the estate's defence control room.
    f.consoles.push({ pos: p(24, 2, -26), kind: "security", zone: "gate" }, { pos: p(24, 2, -24), kind: "defence", zone: "gate" }, { pos: p(29, 2, 16), kind: "security", zone: "perimeter" }, { pos: p(29, 2, 18), kind: "defence", zone: "perimeter" });
    if (defences) {
        const turret = (id, pos, zone) => f.turrets.push({ id, pos, zone, enabled: true, damaged: false });
        PILLARS.forEach(([x, z], i) => turret(i ? "gate_east" : "gate_west", p(x + 1.5, 9, z + 1.5), "gate"));
        TOWERS.forEach(([x, z], i) => turret(`tower_${["nw", "ne", "sw", "se"][i]}`, p(x + 2.5, 14, z + 2.5), "perimeter"));
        turret("roof", p(13.5, 13, 12.5), "perimeter");
        turret("command", p(23.5, COMMAND_Y + 2, 13.5), "command");
    }
    // No mountain to come up behind: without a remote site the tunnel ends at a well in the back garden.
    secretTunnel(f, site.kind === "rock_face" ? GARDEN_EXIT(origin.y, site.ground) : site, defences);
    return f;
}
