import { system, world } from "@minecraft/server";
import { defenceActive, mayOpen, segmentDistance } from "../core/rules.js";
import { add, distance, inside, NS } from "../core/types.js";
import { facilities, mark, save } from "./store.js";
import { beam, dim, fill, getClearance, lineClear, loaded, nearby, set, sound, tell } from "./world.js";
const moving = new Map();
function idFor(door) { return door.kind === "blast" ? "blast_door" : door.kind === "shutter" ? "security_shutter" : "security_door"; }
export function requestDoor(f, door, open) {
    door.open = open;
    mark(f);
    moving.set(`${f.id}:${door.id}`, { f, door, index: 0 });
    if (door.kind === "blast")
        sound(f, "blast_door_warning", door.min);
}
export function restoreDoors(f) { for (const door of f.doors)
    moving.set(`${f.id}:${door.id}`, { f, door, index: 0 }); }
export function toggleDoor(player, f, door) {
    if (!mayOpen(f.state, getClearance(player), door.clearance)) {
        sound(f, "access_denied", door.min);
        tell(player, f.state === "LOCKDOWN" ? "Lockdown: command clearance required." : `Level ${door.clearance} keycard required.`);
        return;
    }
    sound(f, "access_granted", door.min);
    requestDoor(f, door, !door.open);
}
function occupied(d, a, b) {
    const c = { x: (a.x + b.x + 1) / 2, y: (a.y + b.y + 1) / 2, z: (a.z + b.z + 1) / 2 };
    return d.getEntities({ location: c, maxDistance: 8 }).some(e => inside(e.location, { min: { x: a.x - 0.7, y: a.y - 1.9, z: a.z - 0.7 }, max: { x: b.x + 1.7, y: b.y + 1, z: b.z + 1.7 } }));
}
export function tickDoors() {
    let writes = 0;
    for (const [key, job] of [...moving]) {
        const { f, door } = job, d = dim(f);
        if (writes >= 18)
            break;
        if (!nearby(f) || !loaded(d, door.min) || !loaded(d, door.max))
            continue;
        const width = door.max.x - door.min.x + 1;
        if (job.index >= width) {
            moving.delete(key);
            continue;
        }
        const col = door.open ? Math.floor(width / 2) + (job.index % 2 === 0 ? Math.ceil(job.index / 2) : -Math.ceil(job.index / 2)) : job.index;
        const a = { ...door.min, x: door.min.x + col }, b = { ...door.max, x: door.min.x + col };
        // Never materialize a steel door around an entity. Retry while obstructed.
        if (!door.open && occupied(d, a, b))
            continue;
        fill(d, a, b, idFor(door), { [NS + "open"]: door.open });
        if (job.index === 0 && door.kind === "blast")
            sound(f, "blast_door_movement", door.min);
        job.index++;
        writes++;
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
        for (let i = 0; i < f.lasers.length; i++) {
            const laser = f.lasers[i];
            if (!local.some(p => distance(p.location, laser.a) < 14))
                continue;
            if (!loaded(d, laser.a) || !loaded(d, laser.b))
                continue;
            if ((i + sensorCursor) % 3 === 0)
                beam(d, laser.a, laser.b, 0.9, 8);
            const obstruction = !lineClear(d, laser.a, laser.b);
            const crossed = local.some(p => {
                if (getClearance(p) >= 4)
                    return false;
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
        for (const pos of f.lights)
            try {
                const block = d.getBlock(pos);
                if (block?.typeId === NS + "emergency_light")
                    set(d, pos, "emergency_light", { [NS + "active"]: alarm && system.currentTick % 40 < 20 });
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
