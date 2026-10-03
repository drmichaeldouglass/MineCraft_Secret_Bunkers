import { add } from "../core/types.js";
import { random } from "../core/rules.js";
import { ARMOURY } from "./mountain.js";
export const MATERIALS = ["gold", "diamond", "netherite"];
/** Vanilla item names use "golden" for gold. */
const ITEM_PREFIX = { gold: "golden", diamond: "diamond", netherite: "netherite" };
export const PIECES = ["helmet", "chestplate", "leggings", "boots"];
/** Equipment slot each piece is dealt into. */
export const SLOTS = {
    helmet: "slot.armor.head", chestplate: "slot.armor.chest", leggings: "slot.armor.legs", boots: "slot.armor.feet", sword: "slot.weapon.mainhand",
};
/** Each suit wears one of these trims on all four pieces, and no two suits share one. The trim
 *  colours avoid the armour metals, so a trim always stands out from the suit it is on. */
export const TRIMS = [
    { pattern: "sentry", material: "lapis" }, { pattern: "dune", material: "redstone" }, { pattern: "coast", material: "emerald" },
    { pattern: "wild", material: "copper" }, { pattern: "ward", material: "quartz" }, { pattern: "eye", material: "amethyst" },
    { pattern: "vex", material: "iron" }, { pattern: "tide", material: "lapis" }, { pattern: "snout", material: "redstone" },
    { pattern: "rib", material: "amethyst" }, { pattern: "spire", material: "emerald" }, { pattern: "silence", material: "quartz" },
];
/** Enchantment levels, as from a fully powered enchanting table. Treasure enchantments are left out,
 *  so no suit carries a curse. */
export const ENCHANT_LEVELS = { min: 30, max: 39 };
/** Twelve stands: eight along the east wall, and four along the west wall either side of the doorway
 *  from the lobby, which leaves the way in clear. */
export const STAND_SPOTS = [
    ...[3, 5, 7, 9, 11, 13, 15, 17].map(z => ({ x: ARMOURY.x1 - 1, z, yaw: 90 })),
    ...[3, 5, 15, 17].map(z => ({ x: ARMOURY.x0, z, yaw: -90 })),
];
/** The doorway in the lobby's east wall, x = 20: three wide and three tall. */
export const ARMOURY_DOOR = { x: ARMOURY.x0 - 1, z0: 9, z1: 11, height: 3 };
/** Deal the suits: four of each metal in a seeded order, and a different trim on every suit. */
export function planArmoury(origin, seed) {
    const rng = random((seed ^ 0x2a8f61d3) >>> 0);
    const shuffle = (list) => {
        for (let i = list.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    };
    const metals = shuffle(STAND_SPOTS.map((_, i) => MATERIALS[i % MATERIALS.length]));
    const trims = shuffle([...TRIMS.keys()]);
    return STAND_SPOTS.map((s, i) => ({ pos: add(origin, { x: s.x + 0.5, y: 1, z: s.z + 0.5 }), yaw: s.yaw, material: metals[i], trim: trims[i] }));
}
/** The vanilla item a piece of a suit is. */
export const itemFor = (material, piece) => `minecraft:${ITEM_PREFIX[material]}_${piece}`;
/** The loot table that deals one piece of a suit, relative to loot_tables/ and without its extension. */
export function lootTable(stand, piece) {
    return piece === "sword" ? `secretfacilities/armoury/${stand.material}_sword`
        : `secretfacilities/armoury/${stand.material}_${TRIMS[stand.trim].pattern}_${piece}`;
}
/** Tag that finds one stand again, so a resumed build never deals a second suit onto the same spot. */
export const standTag = (facility, index) => `sf_armoury_${facility}_${index}`;
