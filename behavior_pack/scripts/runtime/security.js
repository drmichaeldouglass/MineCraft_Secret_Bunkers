import { system, world } from "@minecraft/server";
import { defenceActive, mayOpen, segmentDistance } from "../core/rules.js";
import { distance, inside, NS } from "../core/types.js";
import { facilities, mark, save } from "./store.js";
import { beam, dim, fill, getClearance, lineClear, loaded, nearby, set, sound, tell } from "./world.js";
import { demolish } from "./destruct.js";
import { EXITS } from "../generation/tunnel.js";
const moving = new Map();
/** Two-pixel sub-steps the leaf travels; eight per block of door height, one per tick. */
export const SUBSTEPS = 8;
/** Ticks per block each blast door leaf slides sideways. Must match LEAF_RATE in tools/build_assets.py. */
export const BLAST_RATE = 16;
/** Blast door 'slide' state while its leaves are in motion: still solid, but drawn invisible so the
 *  moving leaves show through. Only the blast door defines this permutation. */
const HIDDEN = 1;
export const LEAF = NS + "blast_door_leaf";
function idFor(door) { return door.kind === "blast" ? "blast_door" : door.kind === "shutter" ? "security_shutter" : "security_door"; }
/** The blast door is drawn in motion by a leaf entity the client slides smoothly;
 *  its blocks only supply collision and the solid door shown at rest. */
const usesLeaf = (door) => door.kind === "blast";
const width = (door) => door.max.x - door.min.x + 1;
/** Steps of a full open or close: the blast door's two leaves each travel half its width. */
export const travel = (door) => usesLeaf(door) ? Math.round(width(door) / 2 * BLAST_RATE) : (door.max.y - door.min.y + 1) * SUBSTEPS;
const leafTag = (f, door) => `sf_door:${f.id}:${door.id}`;
/** Ease in and out, so the heavy leaf starts and stops gently. Must match the client script. */
export const ease = (phase) => phase * phase * (3 - 2 * phase);
/** Blocks each blast door leaf has slid away from the centre seam at a given step. */
export const slid = (door, progress) => ease(progress / travel(door)) * width(door) / 2;
/** A blast door column is passable only once both leaves have slid entirely clear of it,
 *  so a player can never walk through a leaf that is still drawn there. */
function clearOf(door, progress, column) {
    const half = width(door) / 2;
    return slid(door, progress) >= Math.max(half - column, column + 1 - half) - 1e-9;
}
function leafStates(door, progress, column, inMotion) {
    const open = clearOf(door, progress, column);
    return { [NS + "open"]: open, [NS + "slide"]: !open && inMotion ? HIDDEN : 0 };
}
/** Paint the blast door's columns whose state differs between two moments. Returns the number of fills. */
function paintLeafDoor(d, door, from, to, wasMoving, isMoving, all = false) {
    let fills = 0;
    for (let i = 0; i < width(door); i++) {
        const before = leafStates(door, from, i, wasMoving), after = leafStates(door, to, i, isMoving);
        if (!all && before[NS + "open"] === after[NS + "open"] && before[NS + "slide"] === after[NS + "slide"])
            continue;
        const x = door.min.x + i;
        fill(d, { ...door.min, x }, { ...door.max, x }, idFor(door), after);
        fills++;
    }
    return fills;
}
/** Paint one horizontal course of a stepped door: courses below the moving edge are gone,
 *  the edge course shows its offset, and courses above are still solid. */
function paintRow(d, door, row, progress) {
    const y = door.min.y + row, edge = Math.floor(progress / SUBSTEPS);
    fill(d, { ...door.min, y }, { ...door.max, y }, idFor(door), { [NS + "open"]: row < edge, [NS + "slide"]: row === edge ? progress % SUBSTEPS : 0 });
}
/** Repaint only the courses a single step changes. Returns the number of fills. */
function paintStep(d, door, to) {
    const edge = Math.min(door.max.y - door.min.y, Math.floor(to / SUBSTEPS));
    paintRow(d, door, edge, to);
    if (edge > 0) {
        paintRow(d, door, edge - 1, to);
        return 2;
    }
    return 1;
}
function clearLeaves(d, f, door) {
    for (const e of d.getEntities({ type: LEAF, tags: [leafTag(f, door)] }))
        try {
            e.remove();
        }
        catch { /* Already gone. */ }
}
const liveLeaf = (job) => { const e = job.leaf ? world.getEntity(job.leaf) : undefined; return e?.isValid ? e : undefined; };
/** Which way the leaves travel this tick: 1 opening, -1 closing, 0 held. */
const heading = (job) => Math.sign(job.target - job.progress);
/** The client animates the leaf on its own clock from where it was last told it started,
 *  so the slide stays smooth whatever the tick rate or network jitter. The server only
 *  speaks when the leaf starts, stops or reverses. */
function steer(leaf, door, job, motion) {
    leaf.setProperty(NS + "phase", job.progress / travel(door));
    leaf.setProperty(NS + "motion", motion);
    job.motion = motion;
}
function spawnLeaf(d, f, door, job) {
    clearLeaves(d, f, door);
    const leaf = d.spawnEntity(LEAF, { x: (door.min.x + door.max.x + 1) / 2, y: door.min.y, z: door.min.z + 0.5 }, job.progress / travel(door) > 0.5 ? { spawnEvent: NS + "from_open" } : undefined);
    leaf.setRotation({ x: 0, y: 0 });
    leaf.addTag(leafTag(f, door));
    steer(leaf, door, job, heading(job));
    job.leaf = leaf.id;
}
/** Leaves outlive their slide only when a chunk or world unloads mid-travel. */
export function registerDoorEvents() {
    world.afterEvents.entityLoad.subscribe(({ entity }) => {
        try {
            if (entity.typeId === LEAF && ![...moving.values()].some(j => j.leaf === entity.id))
                entity.remove();
        }
        catch { /* Already gone. */ }
    });
}
export function requestDoor(f, door, open) {
    const key = `${f.id}:${door.id}`, running = moving.get(key);
    // Reversing mid-travel resumes from where the leaf actually is.
    const progress = running ? running.progress : (door.open ? travel(door) : 0);
    door.open = open;
    mark(f);
    moving.set(key, { f, door, progress, target: open ? travel(door) : 0, repaint: false, started: false, leaf: running?.leaf, motion: running?.motion, hidden: running?.hidden });
    if (door.kind === "blast")
        sound(f, "blast_door_warning", door.min);
}
export function restoreDoors(f) {
    for (const door of f.doors) {
        const at = door.open ? travel(door) : 0;
        moving.set(`${f.id}:${door.id}`, { f, door, progress: at, target: at, repaint: true, started: true });
    }
}
export function toggleDoor(player, f, door) {
    if (!mayOpen(f.state, getClearance(player), door.clearance)) {
        sound(f, "access_denied", door.min);
        tell(player, f.state === "LOCKDOWN" ? "Lockdown: command clearance required." : `Level ${door.clearance} keycard required.`);
        return;
    }
    sound(f, "access_granted", door.min);
    requestDoor(f, door, !door.open);
}
/** Loose things a closing door may shut on; the game pushes them out of the block. Counting them
 *  let one dropped item or spent arrow in a doorway hold the door open until it despawned. */
const DEBRIS = new Set([LEAF, "minecraft:item", "minecraft:xp_orb", "minecraft:arrow", "minecraft:thrown_trident", "minecraft:snowball", "minecraft:egg"]);
function occupied(d, door) {
    const a = door.min, b = door.max;
    const c = { x: (a.x + b.x + 1) / 2, y: (a.y + b.y + 1) / 2, z: (a.z + b.z + 1) / 2 };
    const reach = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 2 + 4;
    return d.getEntities({ location: c, maxDistance: reach }).some(e => !DEBRIS.has(e.typeId) && inside(e.location, { min: { x: a.x - 0.7, y: a.y - 1.9, z: a.z - 0.7 }, max: { x: b.x + 1.7, y: b.y + 1, z: b.z + 1.7 } }));
}
export function tickDoors() {
    let writes = 0;
    for (const [key, job] of [...moving]) {
        const { f, door } = job, d = dim(f);
        if (writes >= 32)
            break;
        if (!nearby(f) || !loaded(d, door.min) || !loaded(d, door.max))
            continue;
        const height = door.max.y - door.min.y + 1;
        if (job.repaint) {
            if (usesLeaf(door)) {
                // A leaf left over from a slide interrupted by a reload or unload.
                clearLeaves(d, f, door);
                job.leaf = undefined;
                job.hidden = false;
                writes += paintLeafDoor(d, door, job.progress, job.progress, false, false, true);
            }
            else {
                for (let row = 0; row < height; row++)
                    paintRow(d, door, row, job.progress);
                writes += height;
            }
            job.repaint = false;
        }
        if (job.progress === job.target) {
            if (job.leaf || job.hidden) {
                // At rest the door blocks draw the door again, then the leaves can go.
                if (usesLeaf(door))
                    writes += paintLeafDoor(d, door, job.progress, job.progress, true, false);
                clearLeaves(d, f, door);
                job.leaf = undefined;
                job.hidden = false;
            }
            moving.delete(key);
            continue;
        }
        const next = job.progress + heading(job), leaf = usesLeaf(door) ? liveLeaf(job) : undefined;
        // Never materialize a steel door around an entity. Retry while obstructed.
        if (next < job.progress && occupied(d, door)) {
            if (leaf && job.motion !== 0)
                steer(leaf, door, job, 0);
            continue;
        }
        if (!job.started) {
            job.started = true;
            if (door.kind === "blast")
                sound(f, "blast_door_movement", door.min);
        }
        // A new, resumed or reversed leaf gets one tick to reach clients before the blocks move,
        // so the doorway never opens ahead of the leaves the player sees.
        if (usesLeaf(door) && !leaf) {
            spawnLeaf(d, f, door, job);
            continue;
        }
        if (leaf && job.motion !== heading(job)) {
            steer(leaf, door, job, heading(job));
            continue;
        }
        const from = job.progress;
        job.progress = next;
        if (usesLeaf(door)) {
            // The first step hands the picture over to the leaves: the resting door blocks turn invisible.
            writes += paintLeafDoor(d, door, from, next, job.hidden === true, true, !job.hidden);
            job.hidden = true;
        }
        else
            writes += paintStep(d, door, next);
        // Round-robin prevents a blocked door or a distant facility starving others.
        moving.delete(key);
        moving.set(key, job);
    }
}
export function setSecurity(f, state) {
    if (f.state === state)
        return;
    if (f.state === "DESTROYED")
        return;
    if (f.state === "SELF_DESTRUCT" && state !== "DESTROYED")
        return;
    f.state = state;
    for (const door of f.doors) {
        if (state === "SELF_DESTRUCT" || state === "DESTROYED")
            requestDoor(f, door, true);
        else if (state === "LOCKDOWN" || (state === "ALERT" && door.kind !== "shutter"))
            requestDoor(f, door, false);
        else if (state === "NORMAL" && door.kind === "shutter")
            requestDoor(f, door, true);
    }
    mark(f);
    save(f);
    for (const p of world.getAllPlayers())
        if (p.dimension.id === f.dimension && inside(p.location, f.bounds, 10))
            tell(p, `Facility status: §e${state}`);
}
export function armDestruct(f) {
    if (f.state === "DESTROYED" || f.state === "SELF_DESTRUCT")
        return;
    f.countdown = 90;
    setSecurity(f, "SELF_DESTRUCT");
}
export function abortDestruct(f) {
    if (f.state !== "SELF_DESTRUCT" || (f.countdown ?? 0) <= 10)
        return false;
    f.countdown = undefined;
    f.state = "NORMAL";
    for (const door of f.doors)
        requestDoor(f, door, true);
    mark(f);
    save(f);
    return true;
}
let sensorCursor = 0;
/** Where each player stood at the last sensor tick, and in which dimension. */
const previous = new Map();
/** Farther than anyone walks or runs between sensor ticks: a teleport, respawn or elevator ride.
 *  Interpolating across it would sweep an imaginary path through every beam in between. */
const TELEPORT = 8;
export function tickLasers() {
    const players = world.getAllPlayers();
    for (const f of facilities.values()) {
        if (f.phase !== "ready" || !f.lasersEnabled || f.state === "DESTROYED" || f.state === "SELF_DESTRUCT" || !nearby(f))
            continue;
        const d = dim(f), local = players.filter(p => p.dimension.id === f.dimension && inside(p.location, f.bounds));
        // Reading clearance scans a whole inventory; do it once per tick, not once per beam.
        const watched = local.filter(p => getClearance(p) < 4);
        for (let i = 0; i < f.lasers.length; i++) {
            const laser = f.lasers[i];
            if (!local.some(p => distance(p.location, laser.a) < 14))
                continue;
            if (!loaded(d, laser.a) || !loaded(d, laser.b))
                continue;
            if ((i + sensorCursor) % 3 === 0)
                beam(d, laser.a, laser.b, 0.9, 8);
            const obstruction = !lineClear(d, laser.a, laser.b);
            const crossed = watched.some(p => {
                const last = previous.get(p.id), current = p.location;
                const old = last && last.dimension === p.dimension.id && distance(last.location, current) <= TELEPORT ? last.location : current;
                // Interpolate fast movement so walking across between sensor ticks is detected.
                const steps = Math.min(16, Math.max(1, Math.ceil(distance(old, current) / 0.3)));
                for (let j = 0; j <= steps; j++)
                    for (const height of [0.3, 1, 1.7]) {
                        const t = j / steps, v = { x: old.x + (current.x - old.x) * t, y: old.y + (current.y - old.y) * t + height, z: old.z + (current.z - old.z) * t };
                        if (segmentDistance(v, laser.a, laser.b) < 0.4)
                            return true;
                    }
                return false;
            });
            if (obstruction || crossed) {
                if (f.state === "NORMAL" || (f.state === "ALERT" && laser.response === "LOCKDOWN"))
                    setSecurity(f, laser.response);
            }
        }
    }
    previous.clear();
    for (const p of players)
        previous.set(p.id, { dimension: p.dimension.id, location: { ...p.location } });
    sensorCursor++;
}
let alarmPhase = 0;
export function tickAlarms() {
    alarmPhase = (alarmPhase + 1) % 4;
    for (const f of facilities.values()) {
        if (f.phase !== "ready" || !nearby(f))
            continue;
        const d = dim(f), alarm = f.state === "ALERT" || f.state === "LOCKDOWN" || f.state === "SELF_DESTRUCT";
        const lit = alarm && system.currentTick % 40 < 20;
        for (const pos of f.lights)
            try {
                const block = d.getBlock(pos);
                // Re-applying an identical permutation still costs a block update and a relight for every nearby player.
                if (block?.typeId === NS + "emergency_light" && block.permutation.getState(NS + "active") !== lit)
                    set(d, pos, "emergency_light", { [NS + "active"]: lit });
            }
            catch { /* Unloaded lamps are reconciled when active again. */ }
        if (alarm && alarmPhase === 0)
            sound(f, f.state === "ALERT" ? "alarm_alert" : "alarm_lockdown", f.origin, 0.32);
        if (f.state === "SELF_DESTRUCT" && alarmPhase % 2 === 0) {
            if ((f.countdown ?? 0) > 0) {
                f.countdown--;
                mark(f);
                for (const p of world.getAllPlayers())
                    if (p.dimension.id === f.dimension && inside(p.location, f.bounds, 5))
                        p.onScreenDisplay.setActionBar(`§cEVACUATE • ${f.countdown}s • B1 secret tunnel to the ${EXITS[f.exit?.kind ?? "rock_face"].label}`);
            }
            else if (demolish(f)) {
                for (const t of f.turrets) {
                    t.enabled = false;
                    t.damaged = true;
                }
                setSecurity(f, "DESTROYED");
            }
        }
    }
}
export { defenceActive };
