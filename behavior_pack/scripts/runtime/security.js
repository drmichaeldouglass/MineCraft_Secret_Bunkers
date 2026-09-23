import { system, world } from "@minecraft/server";
import { defenceActive, mayOpen, segmentDistance } from "../core/rules.js";
import { add, distance, inside, NS } from "../core/types.js";
import { facilities, mark, save } from "./store.js";
import { beam, dim, fill, getClearance, lineClear, loaded, nearby, set, sound, tell } from "./world.js";
const moving = new Map();
/** Two-pixel sub-steps the leaf travels; eight per block of door height, one per tick. */
export const SUBSTEPS = 8;
export const LEAF = NS + "blast_door_leaf";
function idFor(door) { return door.kind === "blast" ? "blast_door" : door.kind === "shutter" ? "security_shutter" : "security_door"; }
const travel = (door) => (door.max.y - door.min.y + 1) * SUBSTEPS;
/** The blast door is drawn in motion by a leaf entity the client slides smoothly;
 *  its blocks only supply collision and the solid courses the leaf is hidden behind. */
const usesLeaf = (door) => door.kind === "blast";
const leafTag = (f, door) => `sf_door:${f.id}:${door.id}`;
/** Paint one horizontal course of the leaf. Stepped doors: courses below the moving edge
 *  are gone, the edge course shows its offset, and courses above are still solid.
 *  Leaf doors: any course the leaf has started to leave is cleared so the leaf shows there. */
function paintRow(d, door, row, progress) {
    const y = door.min.y + row;
    if (usesLeaf(door)) {
        fill(d, { ...door.min, y }, { ...door.max, y }, idFor(door), { [NS + "open"]: row < Math.ceil(progress / SUBSTEPS), [NS + "slide"]: 0 });
        return;
    }
    const edge = Math.floor(progress / SUBSTEPS);
    fill(d, { ...door.min, y }, { ...door.max, y }, idFor(door), { [NS + "open"]: row < edge, [NS + "slide"]: row === edge ? progress % SUBSTEPS : 0 });
}
/** Repaint only the courses a single step changes. Returns the number of fills. */
function paintStep(d, door, from, to) {
    if (usesLeaf(door)) {
        const a = Math.ceil(from / SUBSTEPS), b = Math.ceil(to / SUBSTEPS);
        if (a === b)
            return 0;
        paintRow(d, door, Math.min(a, b), to);
        return 1;
    }
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
function spawnLeaf(d, f, door, job) {
    const fraction = job.progress / travel(door);
    clearLeaves(d, f, door);
    const leaf = d.spawnEntity(LEAF, { x: (door.min.x + door.max.x + 1) / 2, y: door.min.y, z: door.min.z + 0.5 }, fraction > 0.5 ? { spawnEvent: NS + "from_open" } : undefined);
    leaf.setRotation({ x: 0, y: 0 });
    leaf.addTag(leafTag(f, door));
    leaf.setProperty(NS + "progress", fraction);
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
    moving.set(key, { f, door, progress, target: open ? travel(door) : 0, repaint: false, started: false, leaf: running?.leaf });
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
function occupied(d, door) {
    const a = door.min, b = door.max;
    const c = { x: (a.x + b.x + 1) / 2, y: (a.y + b.y + 1) / 2, z: (a.z + b.z + 1) / 2 };
    const reach = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 2 + 4;
    return d.getEntities({ location: c, maxDistance: reach }).some(e => e.typeId !== LEAF && inside(e.location, { min: { x: a.x - 0.7, y: a.y - 1.9, z: a.z - 0.7 }, max: { x: b.x + 1.7, y: b.y + 1, z: b.z + 1.7 } }));
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
            // A leaf left over from a slide interrupted by a reload or unload.
            if (usesLeaf(door)) {
                clearLeaves(d, f, door);
                job.leaf = undefined;
            }
            for (let row = 0; row < height; row++)
                paintRow(d, door, row, job.progress);
            job.repaint = false;
            writes += height;
        }
        if (job.progress === job.target) {
            if (job.leaf) {
                clearLeaves(d, f, door);
                job.leaf = undefined;
            }
            moving.delete(key);
            continue;
        }
        const next = job.progress + (job.target > job.progress ? 1 : -1);
        // Never materialize a steel door around an entity. Retry while obstructed.
        if (next < job.progress && occupied(d, door))
            continue;
        if (!job.started) {
            job.started = true;
            if (door.kind === "blast")
                sound(f, "blast_door_movement", door.min);
        }
        // A new leaf gets one tick to reach clients before the blocks it covers are cleared.
        if (usesLeaf(door) && !liveLeaf(job)) {
            spawnLeaf(d, f, door, job);
            continue;
        }
        const from = job.progress;
        job.progress = next;
        if (usesLeaf(door))
            liveLeaf(job)?.setProperty(NS + "progress", next / travel(door));
        writes += paintStep(d, door, from, next);
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
const previous = new Map();
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
                const old = previous.get(p.id) ?? p.location, current = p.location;
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
        previous.set(p.id, { ...p.location });
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
                        p.onScreenDisplay.setActionBar(`§cEVACUATE • ${f.countdown}s • rear B1 escape tunnel`);
            }
            else {
                // Bounded structural damage, never a chain of uncontrolled explosions.
                f.destructionStep ?? (f.destructionStep = 0);
                const floor = f.floors.slice(1)[f.destructionStep];
                if (floor) {
                    const center = add(f.origin, { x: 6, y: floor.y - f.origin.y, z: 6 });
                    if (loaded(d, center)) {
                        fill(d, add(center, { x: -3, y: 0, z: -3 }), add(center, { x: 3, y: 0, z: 3 }), "damaged_panel");
                        for (const x of [-2, 2])
                            fill(d, add(center, { x, y: 1, z: -1 }), add(center, { x, y: 3, z: 1 }), "damaged_panel");
                        sound(f, "destruction", center);
                        f.destructionStep++;
                        mark(f);
                    }
                }
                else {
                    for (const t of f.turrets) {
                        t.enabled = false;
                        t.damaged = true;
                    }
                    setSecurity(f, "DESTROYED");
                }
            }
        }
    }
}
export { defenceActive };
