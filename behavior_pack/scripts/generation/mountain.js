/** Ground the earthworks level: the rooms, the entrance with its forecourt, and the escape hut. */
export const FOOTPRINT = { x0: 0, x1: 26, z0: -4, z1: 37 };
/** The levelled pad: the footprint plus a margin, so its edge is not the bunker's wall. */
export const PAD = { x0: FOOTPRINT.x0 - 2, x1: FOOTPRINT.x1 + 2, z0: FOOTPRINT.z0 - 2, z1: FOOTPRINT.z1 + 2 };
/** Every column the mountain can reach, including its skirts beyond the levelled pad. */
export const MOUNTAIN = { x0: -12, x1: 38, z0: -12, z1: 42 };
/** Surface structures the mountain is laid over rather than through. */
export const ENTRANCE = { x0: 6, x1: 20, z0: -4, z1: 17, roof: 8 };
export const HUT = { x0: 11, x1: 15, z0: 32, z1: 36, roof: 4 };
/** The armoury beside the surface lobby, its east wall on the edge of the levelled pad. */
export const ARMOURY = { x0: 21, x1: 28, z0: 2, z1: 18, roof: 6 };
/** Lowest a skirt fill reaches below the pad, so slopes never overhang a dip. */
export const SKIRT_DEPTH = 12;
export const PEAK = 24;
const CX = 13, CZ = 15, RX = 25, RZ = 27;
/** Thickness of rock kept over the entrance roof, and the portal's overhanging brow. */
const COVER = 12;
const within = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
function hash(seed, x, z) {
    let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263)) >>> 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function noise(seed, x, z) {
    const x0 = Math.floor(x), z0 = Math.floor(z), s = (t) => t * t * (3 - 2 * t), fx = s(x - x0), fz = s(z - z0);
    const a = hash(seed, x0, z0), b = hash(seed, x0 + 1, z0), c = hash(seed, x0, z0 + 1), d = hash(seed, x0 + 1, z0 + 1);
    const top = a + (b - a) * fx, bottom = c + (d - c) * fx;
    return top + (bottom - top) * fz;
}
/** Half-width of the open approach in front of the portal; it flares as it leaves the mountain. */
const approach = (z) => 7.5 + Math.max(0, -5 - z) * 0.6;
/** Half-width of the open apron behind the escape hut's south-facing exit. */
const apron = (z) => 3 + (z - 37) * 0.5;
/** Whether a facility's escape tunnel comes up behind its mountain: every facility built before
 *  remote exits, and any whose survey found no remote site. Only those keep the rear apron and hut. */
export const rearExit = (f) => !f.exit || f.exit.kind === "rock_face";
/** Only bunkers planned with an armoury have the room to keep clear; an older bunker resuming its
 *  build must not have a hollow left in its mountain where it has no room. */
export function column(seed, x, z, rear = true, armoury = false) {
    const none = (open) => ({ top: 0, base: 1, open });
    if (!within(MOUNTAIN, x, z))
        return none(false);
    if (z <= -5 && Math.abs(x - 13) <= approach(z))
        return none(true);
    if (rear && z >= 37 && Math.abs(x - 13) <= apron(z))
        return none(true);
    const d = Math.hypot((x - CX) / RX, (z - CZ) / RZ);
    let h = d >= 1 ? 0 : PEAK * Math.pow(1 - d * d, 1.4) + (noise(seed, x / 10, z / 10) * 7 + noise(seed + 7, x / 4, z / 4) * 2.5 - 4.75) * (1 - d);
    const entrance = within(ENTRANCE, x, z), hut = rear && within(HUT, x, z);
    if (entrance || (x >= ENTRANCE.x0 - 1 && x <= ENTRANCE.x1 + 1 && z >= -4 && z <= ENTRANCE.z1 + 1))
        h = Math.max(h, COVER);
    if (hut)
        h = Math.max(h, HUT.roof + 2);
    const store = armoury && within(ARMOURY, x, z);
    if (armoury && x >= ARMOURY.x0 - 1 && x <= ARMOURY.x1 + 1 && z >= ARMOURY.z0 - 1 && z <= ARMOURY.z1 + 1)
        h = Math.max(h, ARMOURY.roof + 4);
    // Slope down into the open channels instead of standing over them as sheer walls.
    if (z <= -5)
        h = Math.min(h, 1 + (Math.abs(x - 13) - approach(z)) * 1.4);
    if (rear && z >= 37)
        h = Math.min(h, 1 + (Math.abs(x - 13) - apron(z)) * 1.2);
    const top = h < 1 ? 0 : Math.round(h);
    if (!top)
        return none(false);
    // The earthworks already made the pad solid; only skirts beyond it are filled from below.
    return { top, base: entrance ? ENTRANCE.roof + 1 : store ? ARMOURY.roof + 1 : hut ? HUT.roof + 1 : within(PAD, x, z) ? 1 : -SKIRT_DEPTH, open: false };
}
