import { BlockVolume, world } from "@minecraft/server";
import { random } from "../core/rules.js";
import { add, inside, NS } from "../core/types.js";
import { FLOOR_STEP } from "../generation/planner.js";
import { mark } from "./store.js";
import { dim, loaded, set, shake, sound } from "./world.js";
/** Walls, floors and ceilings: scorched and cracked rather than removed, so the ruin still stands. */
const STRUCTURE = ["reinforced_concrete", "dark_reinforced_concrete", "light_reinforced_concrete", "concrete_panel",
    "concrete_warning_stripe", "steel_wall", "steel_plate", "riveted_steel", "industrial_floor", "diamond_plate_floor",
    "grated_floor", "bunker_ceiling_panel"].map(id => NS + id);
/** Fittings and machinery: blown out entirely. Doors, lights and consoles go with them. */
const EQUIPMENT = ["blast_resistant_glass", "security_glass", "ventilation_grille", "large_vent", "pipe", "pipe_junction",
    "cable_tray", "electrical_cabinet", "generator_panel", "server_rack", "control_cabinet", "utility_panel", "industrial_light",
    "emergency_light", "floodlight", "keycard_reader", "security_console", "alarm_panel", "laser_emitter", "laser_receiver",
    "security_shutter", "security_shutter_housing", "door_control_panel", "self_destruct_console", "facility_status_display",
    "turret_control_console", "turret_power_unit", "laser_turret_mount", "missile_turret_base", "defence_status_panel",
    "blast_door", "security_door", "elevator_panel", "elevator_pad"].map(id => NS + id);
const RUBBLE = ["minecraft:cobblestone", "minecraft:gravel", "minecraft:tuff", "minecraft:cobbled_deepslate", NS + "damaged_panel"];
const TNT = "minecraft:tnt";
function volume(d, a, b, block, only) {
    try {
        d.fillBlocks(new BlockVolume(a, b), block, { ignoreChunkBoundErrors: true, ...(only ? { blockFilter: { includeTypes: only } } : {}) });
    }
    catch { /* A fill reaching past loaded ground is skipped rather than aborting the sequence. */ }
}
/** A real explosion for the blast, sound, knockback and damage, without breaking blocks:
 *  the custom walls resist explosions, and a block-breaking blast would scatter thousands of drops. */
function explode(d, at, radius) {
    try {
        d.createExplosion(at, radius, { breaksBlocks: false, causesFire: false });
    }
    catch { /* Unloaded. */ }
}
const range = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const block = (d, at) => { try {
    return d.getBlock(at);
}
catch {
    return undefined;
} };
/** Charges still in place. A charge a player has dug out or set off early is simply missing. */
export function charges(f) {
    const d = dim(f), all = f.charges ?? [];
    return { armed: all.filter(c => block(d, c)?.typeId === TNT).length, total: all.length };
}
/** Fire one charge: the TNT goes off and blasts a breach through the wall beside it. */
function detonate(d, c) {
    if (block(d, c)?.typeId !== TNT)
        return;
    volume(d, add(c, { x: -1, y: -1, z: -1 }), add(c, { x: 1, y: 1, z: 1 }), "minecraft:air");
    explode(d, { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 }, 4);
}
/** Gut one room or hall: scorch its shell, blow out its fittings, open cavities through its walls,
 *  bring part of the ceiling down, and leave rubble and fires behind. The floor itself holds. */
function wreck(d, a, rng) {
    const b = add(a, { x: 8, y: 6, z: 8 });
    volume(d, a, b, NS + "damaged_panel", STRUCTURE);
    volume(d, a, b, "minecraft:air", EQUIPMENT);
    for (let i = 0; i < 2; i++) {
        const w = range(rng, 3, 5), h = range(rng, 2, 4), l = range(rng, 3, 5), x = a.x - 1 + range(rng, 0, 10 - w), z = a.z - 1 + range(rng, 0, 10 - l);
        volume(d, { x, y: a.y + 1, z }, { x: x + w - 1, y: a.y + h, z: z + l - 1 }, "minecraft:air");
    }
    // Gravel from the slab above falls into the room below it.
    const cx = a.x + range(rng, 1, 6), cz = a.z + range(rng, 1, 6);
    volume(d, { x: cx, y: a.y + 6, z: cz }, { x: cx + 1, y: a.y + 7, z: cz + 1 }, "minecraft:gravel");
    for (let i = 0; i < 3; i++) {
        const x = a.x + range(rng, 1, 6), z = a.z + range(rng, 1, 6), w = range(rng, 0, 2), l = range(rng, 0, 2);
        volume(d, { x, y: a.y + 1, z }, { x: x + w, y: a.y + range(rng, 1, 2), z: z + l }, RUBBLE[range(rng, 0, RUBBLE.length - 1)], ["minecraft:air"]);
    }
    for (let i = 0; i < 2; i++) {
        const at = { x: a.x + range(rng, 1, 7), y: a.y + 1, z: a.z + range(rng, 1, 7) }, below = block(d, { ...at, y: at.y - 1 });
        if (block(d, at)?.isAir && below && !below.isAir && !below.isLiquid)
            try {
                set(d, at, "minecraft:fire");
            }
            catch { /* Fire refused here. */ }
    }
    explode(d, { x: a.x + 4.5, y: a.y + 2, z: a.z + 4.5 }, 3);
}
function wreckFloor(f, d, y, rng) {
    for (const c of f.charges ?? [])
        if (c.y >= y && c.y < y + FLOOR_STEP)
            detonate(d, c);
    for (const m of f.modules)
        if (m.pos.y === y)
            wreck(d, m.pos, rng);
}
/** The surface lobby caves in and the portal passage fills with rubble, sealing the ruin. */
function wreckSurface(f, d, rng) {
    const o = f.origin, p = (x, y, z) => add(o, { x, y, z });
    for (const c of f.charges ?? [])
        if (c.y >= o.y)
            detonate(d, c);
    volume(d, p(6, 0, -4), p(20, 8, 17), NS + "damaged_panel", STRUCTURE);
    volume(d, p(6, 0, -4), p(20, 8, 17), "minecraft:air", EQUIPMENT);
    volume(d, p(11, 1, 0), p(15, 5, 8), "minecraft:cobblestone");
    for (let i = 0; i < 3; i++) {
        const x = range(rng, 11, 14), z = range(rng, 0, 7);
        volume(d, p(x, 1, z), p(x + 1, 3, z + 1), "minecraft:gravel");
    }
    for (let i = 0; i < 5; i++) {
        const x = range(rng, 9, 16), z = range(rng, 9, 15);
        volume(d, p(x, 1, z), p(x + range(rng, 0, 1), range(rng, 1, 3), z + range(rng, 0, 1)), RUBBLE[range(rng, 0, RUBBLE.length - 1)], ["minecraft:air"]);
    }
    volume(d, p(12, 6, 11), p(14, 7, 14), "minecraft:gravel");
    for (const door of f.doors)
        for (const e of d.getEntities({ type: NS + "blast_door_leaf", tags: [`sf_door:${f.id}:${door.id}`] }))
            try {
                e.remove();
            }
            catch { /* Gone. */ }
    for (const t of f.turrets) {
        for (const e of d.getEntities({ type: NS + "laser_turret", tags: [`sf:${f.id}:${t.id}`] }))
            try {
                e.remove();
            }
            catch { /* Gone. */ }
        explode(d, t.pos, 3);
    }
    explode(d, p(13.5, 2.5, -1.5), 6);
    explode(d, p(13.5, 2, 13.5), 5);
}
/** One stage of the demolition, deepest floor first and the surface last. Returns true once the
 *  whole facility has been brought down. A stage waits while its ground is unloaded. */
export function demolish(f) {
    const d = dim(f), floors = f.floors.slice(1).reverse(), step = f.destructionStep ?? 0;
    if (step > floors.length)
        return true;
    const centre = add(f.origin, { x: 13, y: step < floors.length ? floors[step].y - f.origin.y + 2 : 2, z: step < floors.length ? 13 : 8 });
    if (!loaded(d, centre))
        return false;
    const rng = random((f.seed ^ Math.imul(step + 1, 0x9e3779b1)) >>> 0);
    if (step < floors.length)
        wreckFloor(f, d, floors[step].y, rng);
    else
        wreckSurface(f, d, rng);
    sound(f, "destruction", centre, 1);
    for (const player of world.getAllPlayers())
        if (player.dimension.id === f.dimension && inside(player.location, f.bounds, 24))
            shake(player, 1.4, 0.5);
    f.destructionStep = step + 1;
    mark(f);
    return f.destructionStep > floors.length;
}
