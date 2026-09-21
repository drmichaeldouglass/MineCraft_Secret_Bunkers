const CARDS = {
    keycard_green: 1, keycard_blue: 2, keycard_red: 3, keycard_black: 4,
};
export function clearance(items, creative) {
    if (creative && items.includes("secretfacilities:keycard_master"))
        return 5;
    return items.reduce((level, id) => Math.max(level, CARDS[id.replace("secretfacilities:", "")] ?? 0), 0);
}
export function mayOpen(state, level, required) {
    if (state === "DESTROYED" || state === "SELF_DESTRUCT")
        return true;
    return level >= required && (state !== "LOCKDOWN" || level >= 4);
}
export function defenceActive(mode, state, countdown) {
    if (state === "DESTROYED" || (state === "SELF_DESTRUCT" && (countdown ?? 0) <= 10))
        return false;
    if (mode === "OFFLINE" || mode === "STANDBY")
        return false;
    return mode === "ACTIVE" || (mode === "ALERT_ONLY" && state !== "NORMAL") ||
        (mode === "LOCKDOWN_ONLY" && (state === "LOCKDOWN" || state === "SELF_DESTRUCT"));
}
// Conservative allowlist: the generic 'monster' family includes neutral mobs.
// Spiders, endermen, piglins and wolves are deliberately excluded unless a future
// targeting adapter can prove aggression. Tags cannot override friendly types.
export const HOSTILES = new Set([
    "zombie", "husk", "drowned", "zombie_villager", "zombie_villager_v2",
    "skeleton", "stray", "bogged", "wither_skeleton", "creeper", "witch", "phantom",
    "pillager", "vindicator", "evocation_illager", "ravager", "vex", "silverfish",
    "endermite", "slime", "magma_cube", "blaze", "ghast", "guardian", "elder_guardian", "breeze",
].map(id => `minecraft:${id}`));
export function isHostile(typeId, tamed = false) { return !tamed && HOSTILES.has(typeId); }
export function segmentDistance(p, a, b) {
    const v = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len2 = v.x * v.x + v.y * v.y + v.z * v.z;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * v.x + (p.y - a.y) * v.y + (p.z - a.z) * v.z) / len2)) : 0;
    return Math.hypot(p.x - a.x - v.x * t, p.y - a.y - v.y * t, p.z - a.z - v.z * t);
}
export function random(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let t = value;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
