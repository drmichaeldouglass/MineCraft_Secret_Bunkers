import { BlockPermutation, BlockVolume, GameMode, system, world } from "@minecraft/server";
import { clearance } from "../core/rules.js";
import { distance, inside, NS } from "../core/types.js";
import { facilities } from "./store.js";
export const dim = (f) => world.getDimension(f.dimension);
export function getClearance(player) {
    const c = player.getComponent("minecraft:inventory")?.container, items = [];
    if (c)
        for (let i = 0; i < c.size; i++) {
            const item = c.getItem(i);
            if (item)
                items.push(item.typeId);
        }
    return clearance(items, player.getGameMode() === GameMode.Creative);
}
export function findFacility(player) {
    return [...facilities.values()].find(f => f.dimension === player.dimension.id && inside(player.location, f.bounds, 6));
}
export function nearby(f) {
    return world.getAllPlayers().some(p => p.dimension.id === f.dimension && inside(p.location, f.bounds, 48));
}
export function loaded(d, p) { try {
    return d.getBlock(p) !== undefined;
}
catch {
    return false;
} }
export function set(d, p, id, states) {
    const b = d.getBlock(p);
    if (!b)
        throw Error(`Chunk not loaded at ${p.x}, ${p.z}`);
    b.setPermutation(BlockPermutation.resolve(id.includes(":") ? id : NS + id, states));
}
export function fill(d, a, b, id, states) {
    d.fillBlocks(new BlockVolume(a, b), BlockPermutation.resolve(id.includes(":") ? id : NS + id, states));
}
export function sound(f, id, pos = f.origin, volume = 0.5) {
    for (const p of world.getAllPlayers())
        if (p.dimension.id === f.dimension && inside(p.location, f.bounds, 20)) {
            try {
                p.playSound(NS + id, { location: distance(p.location, pos) < 24 ? pos : p.location, volume });
            }
            catch { /* Player left. */ }
        }
}
export function tell(player, message) { player.sendMessage(`§b[Secret Facilities]§r ${message}`); }
export function report(error, player) {
    console.warn(`[Secret Facilities] ${error}`);
    if (player?.isValid)
        tell(player, `§c${String(error).replace(/^Error: /, "")}`);
}
export const delay = (ticks) => new Promise(resolve => system.runTimeout(resolve, ticks));
export function lineClear(d, a, b) {
    const length = distance(a, b);
    if (length < 0.05)
        return true;
    try {
        return !d.getBlockFromRay(a, { x: (b.x - a.x) / length, y: (b.y - a.y) / length, z: (b.z - a.z) / length }, { maxDistance: length, includeLiquidBlocks: false, includePassableBlocks: false });
    }
    catch {
        return false;
    }
}
export function beam(d, a, b, step = 0.7, max = 36) {
    const count = Math.min(max, Math.ceil(distance(a, b) / step));
    for (let i = 0; i <= count; i++) {
        const t = count ? i / count : 0;
        try {
            d.spawnParticle(NS + "laser_beam", { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
        }
        catch {
            return;
        }
    }
}
