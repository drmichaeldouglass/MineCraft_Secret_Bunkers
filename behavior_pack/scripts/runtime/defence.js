import { EntityDamageCause, system, world } from "@minecraft/server";
import { isHostile, defenceActive } from "../core/rules.js";
import { add, distance, NS } from "../core/types.js";
import { facilities, mark } from "./store.js";
import { beam, dim, lineClear, nearby, sound } from "./world.js";
const cache = new Map();
const allowed = (e) => e.isValid && isHostile(e.typeId, e.getComponent("minecraft:tameable")?.isTamed ?? false);
function update(f, t) {
    const key = `${f.id}:${t.id}`, d = dim(f);
    let tracking = cache.get(key);
    if (!tracking) {
        tracking = { nextScan: system.currentTick + (cache.size % 8) * 5, nextShot: 0 };
        cache.set(key, tracking);
    }
    let entity = tracking.entity ? world.getEntity(tracking.entity) : undefined;
    if (!entity?.isValid) {
        if (system.currentTick < tracking.nextScan)
            return;
        tracking.nextScan = system.currentTick + 40;
        entity = d.getEntities({ type: NS + "laser_turret", tags: [`sf:${f.id}:${t.id}`], location: t.pos, maxDistance: 4 })[0];
        if (!entity)
            return;
        tracking.entity = entity.id;
    }
    if (t.damaged || !t.enabled || !defenceActive(f.zones[t.zone], f.state, f.countdown)) {
        tracking.target = undefined;
        return;
    }
    const source = add(entity.location, { x: 0, y: 0.95, z: 0 }), range = t.zone === "entrance" ? 28 : 16;
    let target = tracking.target ? world.getEntity(tracking.target) : undefined;
    if (target && (!allowed(target) || target.dimension.id !== f.dimension || distance(target.location, source) > range))
        target = undefined;
    if (!target && system.currentTick >= tracking.nextScan) {
        tracking.nextScan = system.currentTick + 40;
        target = d.getEntities({ location: source, maxDistance: range }).filter(allowed)
            .sort((a, b) => distance(a.location, source) - distance(b.location, source))
            .find(e => lineClear(d, source, add(e.location, { x: 0, y: 1, z: 0 })));
    }
    tracking.target = target?.id;
    if (!target)
        return;
    const aim = add(target.location, { x: 0, y: 1, z: 0 }), delta = { x: aim.x - source.x, y: aim.y - source.y, z: aim.z - source.z };
    entity.setRotation({ x: -Math.atan2(delta.y, Math.hypot(delta.x, delta.z)) * 180 / Math.PI, y: -Math.atan2(delta.x, delta.z) * 180 / Math.PI });
    if (system.currentTick < tracking.nextShot)
        return;
    if (!lineClear(d, source, aim)) {
        tracking.target = undefined;
        return;
    }
    tracking.nextShot = system.currentTick + 20;
    beam(d, source, aim);
    d.spawnParticle(NS + "laser_impact", aim);
    target.applyDamage(5, { cause: EntityDamageCause.entityAttack, damagingEntity: entity });
    sound(f, "laser_turret_fire", source, 0.3);
}
export function tickDefence() {
    for (const f of facilities.values())
        if (f.phase === "ready" && nearby(f))
            for (const turret of f.turrets) {
                try {
                    update(f, turret);
                }
                catch (error) {
                    console.warn(`[Secret Facilities] turret ${turret.id}: ${error}`);
                }
            }
}
export function registerDefenceEvents() {
    world.afterEvents.entityDie.subscribe(event => {
        const entity = event.deadEntity;
        if (entity.typeId !== NS + "laser_turret")
            return;
        try {
            const f = facilities.get(String(entity.getDynamicProperty(NS + "facility")));
            const t = f?.turrets.find(t => t.id === entity.getDynamicProperty(NS + "turret"));
            if (f && t) {
                t.damaged = true;
                mark(f);
            }
        }
        catch { /* Already removed; never recreate a missing defence automatically. */ }
    });
}
