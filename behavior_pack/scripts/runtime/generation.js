import { BlockVolume, GameMode, system, world } from "@minecraft/server";
import { add, intersects, NS } from "../core/types.js";
import { FLOOR_STEP, MODULE } from "../generation/planner.js";
import { column, MOUNTAIN, PAD, PEAK } from "../generation/mountain.js";
import { facilities, mark, save } from "./store.js";
import { dim, fill, loaded, report, set, tell } from "./world.js";
const active = new Set();
/** Ground may rise or fall this far from the chosen surface level; earthworks cut and fill it
 *  to a level pad, so no floor surfaces through a hillside. Columns are sampled every few blocks. */
export const MAX_CUT = 12, MAX_FILL = 12;
const SURVEY_STEP = 5;
/** The pad is cleared well above the highest cut so trees on it do not float, and above the
 *  mountain's peak so none of the old hill pokes through it. Bands keep each fill small. */
const CLEAR_HEIGHT = Math.max(MAX_CUT + 12, PEAK + 2), PAD_BAND = 6;
/** What the fill below the pad may replace: holes, caves, water and lava, never solid ground. */
export const LOOSE = ["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava"];
const EARTH = ["minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt", "minecraft:podzol", "minecraft:mycelium",
    "minecraft:snow", "minecraft:moss_block", "minecraft:mud"];
const ROCK = ["minecraft:stone", "minecraft:deepslate", "minecraft:andesite", "minecraft:diorite", "minecraft:granite",
    "minecraft:tuff", "minecraft:calcite", "minecraft:gravel"];
/** The pad's top block and the fill under it, matched to the natural surface at the entrance. */
export function padMaterial(ground) {
    if (ground === "minecraft:sand")
        return [ground, "minecraft:sandstone"];
    if (ground === "minecraft:red_sand")
        return [ground, "minecraft:red_sandstone"];
    if (EARTH.includes(ground))
        return [ground, "minecraft:dirt"];
    if (ROCK.includes(ground))
        return [ground, "minecraft:stone"];
    if (ground.endsWith("terracotta"))
        return [ground, ground];
    return ["minecraft:grass_block", "minecraft:dirt"];
}
function installations(f) {
    const d = dim(f), o = f.origin, p = (x, y, z) => add(o, { x, y, z }), low = f.floors[f.floors.length - 1].y;
    const ops = [];
    // Dry, reinforced emergency ladder shaft. One floor-height segment per operation.
    // Only the ladder column is cut through the floors: an open column beside it would be
    // a drop from the surface lobby to the deepest floor.
    for (let y = low + 1; y <= o.y + 5; y += FLOOR_STEP) {
        const top = Math.min(y + FLOOR_STEP - 1, o.y + 5);
        ops.push(() => {
            fill(d, { x: o.x + 16, y, z: o.z + 16 }, { x: o.x + 16, y: top, z: o.z + 16 }, "steel_wall");
            fill(d, { x: o.x + 15, y, z: o.z + 16 }, { x: o.x + 15, y: top, z: o.z + 16 }, "minecraft:ladder", { facing_direction: 4 });
        });
    }
    // B1 rear escape tunnel and a second ladder to a discreet surface utility hut.
    // It opens from the back of the room south of the lobby, whose aisle is cleared through to it.
    ops.push(() => {
        fill(d, p(11, -9, 26), p(15, -5, 36), "reinforced_concrete");
        fill(d, p(12, -8, 22), p(14, -6, 35), "minecraft:air");
        set(d, p(13, -5, 31), "industrial_light");
    });
    ops.push(() => {
        fill(d, p(11, -5, 32), p(15, 4, 36), "reinforced_concrete");
        fill(d, p(12, -5, 33), p(14, 3, 35), "minecraft:air");
        // Hut floor; the ladder then cuts its own opening. Without it the exit is two blocks of open shaft away.
        fill(d, p(12, 0, 33), p(14, 0, 35), "industrial_floor");
        fill(d, p(12, -8, 34), p(12, 3, 34), "minecraft:ladder", { facing_direction: 5 });
        // The hut is dug into the back of the mountain, so its door faces away from it, south.
        fill(d, p(13, 1, 36), p(14, 2, 36), "minecraft:air");
        set(d, p(13, 4, 34), "industrial_light");
    });
    for (const door of f.doors)
        ops.push(() => {
            const id = door.kind === "blast" ? "blast_door" : door.kind === "shutter" ? "security_shutter" : "security_door";
            fill(d, door.min, door.max, id, { [NS + "open"]: door.open, [NS + "slide"]: 0 });
            for (const r of door.readers)
                set(d, r, "keycard_reader");
        });
    for (const floor of f.floors)
        ops.push(() => set(d, floor.panel, "elevator_panel"));
    for (const c of f.consoles)
        ops.push(() => set(d, c.pos, c.kind === "security" ? "security_console" : c.kind === "defence" ? "turret_control_console" : "self_destruct_console"));
    for (const light of f.lights)
        ops.push(() => set(d, light, "emergency_light", { [NS + "active"]: false }));
    for (const laser of f.lasers)
        ops.push(() => {
            if (laser.a.y === laser.b.y) {
                set(d, { x: Math.floor(laser.a.x), y: Math.floor(laser.a.y), z: Math.floor(laser.a.z) - 1 }, "laser_emitter");
                set(d, { x: Math.floor(laser.b.x), y: Math.floor(laser.b.y), z: Math.floor(laser.b.z) + 1 }, "laser_receiver");
            }
            else {
                set(d, { x: Math.floor(laser.a.x), y: Math.floor(laser.a.y) - 1, z: Math.floor(laser.a.z) }, "laser_emitter");
                set(d, { x: Math.floor(laser.b.x), y: Math.ceil(laser.b.y), z: Math.floor(laser.b.z) }, "laser_receiver");
            }
        });
    for (const turret of f.turrets)
        ops.push(() => {
            const tag = `sf:${f.id}:${turret.id}`;
            if (d.getEntities({ type: NS + "laser_turret", tags: [tag] }).length)
                return;
            set(d, { x: Math.floor(turret.pos.x), y: turret.pos.y - 1, z: Math.floor(turret.pos.z) }, "laser_turret_mount");
            const e = d.spawnEntity(NS + "laser_turret", turret.pos);
            e.addTag(tag);
            e.setDynamicProperty(NS + "facility", f.id);
            e.setDynamicProperty(NS + "turret", turret.id);
            e.nameTag = turret.zone === "entrance" ? "§7ENTRANCE DEFENCE" : "§7COMMAND DEFENCE";
        });
    return ops;
}
/** Level the site to the surface level: clear everything above it, fill every hole below it
 *  down to the deepest permitted fill, and lay a matching surface. */
function earthworks(f) {
    // Facilities deployed before levelling existed resume their build without it.
    if (!f.ground)
        return [];
    const d = dim(f), o = f.origin, y = o.y, [top, under] = padMaterial(f.ground), ops = [];
    const x0 = o.x + PAD.x0, x1 = o.x + PAD.x1, z1 = o.z + PAD.z1;
    // The pad's margin may reach unloaded chunks; those edges are simply left as they are.
    const edge = { ignoreChunkBoundErrors: true };
    for (let z = o.z + PAD.z0; z <= z1; z += PAD_BAND) {
        const zb = Math.min(z + PAD_BAND - 1, z1);
        ops.push(() => {
            d.fillBlocks(new BlockVolume({ x: x0, y: y + 1, z }, { x: x1, y: y + CLEAR_HEIGHT, z: zb }), "minecraft:air", edge);
            d.fillBlocks(new BlockVolume({ x: x0, y: y - MAX_FILL, z }, { x: x1, y: y - 1, z: zb }), under, { ...edge, blockFilter: { includeTypes: LOOSE } });
            d.fillBlocks(new BlockVolume({ x: x0, y, z }, { x: x1, y, z: zb }), top, edge);
        });
    }
    return ops;
}
/** Solid rock around every underground slab, so no floor can surface through a hillside.
 *  It reaches two blocks past the walls, sealing in the demolition charges. */
function encasement(f) {
    const d = dim(f), o = f.origin, span = 3 * MODULE - 1, ops = [];
    for (const floor of f.floors.slice(1))
        for (let band = 0; band < 3; band++) {
            const z0 = o.z + (band === 0 ? -2 : band * MODULE), z1 = o.z + (band === 2 ? span + 2 : (band + 1) * MODULE - 1), top = floor.y + FLOOR_STEP - 1;
            ops.push(() => fill(d, { x: o.x - 2, y: floor.y, z: z0 }, { x: o.x + span + 2, y: top, z: z1 }, "minecraft:stone"));
        }
    // Ground the entrance forecourt so it never juts out over a slope.
    ops.push(() => fill(d, { x: o.x + 6, y: o.y - 4, z: o.z - 4 }, { x: o.x + 20, y: o.y - 1, z: o.z - 1 }, "minecraft:stone"));
    return ops;
}
/** Ground cover the mountain's skirts may bury, besides air and liquids. */
const COVERABLE = [...LOOSE, "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern",
    "minecraft:snow_layer", "minecraft:dandelion", "minecraft:poppy", "minecraft:deadbush"];
/** Heap the mountain over the finished bunker, one row of columns per operation. Over the pad the
 *  column is built from just above the ground or a structure's roof; beyond it the skirts are only
 *  laid into air and water, so they drape over the surrounding terrain instead of cutting it. */
function mountain(f) {
    if (!f.charges)
        return [];
    const d = dim(f), o = f.origin, [top, under] = padMaterial(f.ground ?? "minecraft:grass_block"), ops = [];
    const core = under === "minecraft:dirt" ? "minecraft:stone" : under, edge = { ignoreChunkBoundErrors: true };
    const only = { ...edge, blockFilter: { includeTypes: COVERABLE } };
    const lay = (x, z, a, b, block) => {
        if (b >= a)
            d.fillBlocks(new BlockVolume({ x: o.x + x, y: o.y + a, z: o.z + z }, { x: o.x + x, y: o.y + b, z: o.z + z }), block, only);
    };
    for (let z = MOUNTAIN.z0; z <= MOUNTAIN.z1; z++)
        ops.push(() => {
            for (let x = MOUNTAIN.x0; x <= MOUNTAIN.x1; x++) {
                const c = column(f.seed, x, z);
                if (c.open) {
                    // Keep the approach and the hut's apron open at pad level, whatever the terrain beyond does.
                    d.fillBlocks(new BlockVolume({ x: o.x + x, y: o.y + 1, z: o.z + z }, { x: o.x + x, y: o.y + CLEAR_HEIGHT, z: o.z + z }), "minecraft:air", edge);
                    lay(x, z, -MAX_FILL, -1, under);
                    const path = z < 0 && Math.abs(x - 13) <= 2;
                    d.fillBlocks(new BlockVolume({ x: o.x + x, y: o.y, z: o.z + z }, { x: o.x + x, y: o.y, z: o.z + z }), path ? "minecraft:coarse_dirt" : top, edge);
                    continue;
                }
                if (!c.top)
                    continue;
                // Steep faces and the summit are bare rock; gentler slopes carry the local soil.
                const slope = Math.max(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => Math.abs(c.top - column(f.seed, x + dx, z + dz).top)));
                const rock = (x * 7 + z * 13 + f.seed) % 5 === 0 ? "minecraft:andesite" : core;
                const surface = c.top >= PEAK - 2 ? "minecraft:snow" : slope >= 3 ? rock : top;
                lay(x, z, c.base, c.top - 4, core);
                lay(x, z, Math.max(c.base, c.top - 3), c.top - 1, slope >= 3 ? rock : under);
                lay(x, z, Math.max(c.base, c.top), c.top, surface);
            }
        });
    return ops;
}
/** Vanilla TNT sealed in the rock just outside the walls, and floodlights marking the portal. */
function charges(f) {
    if (!f.charges)
        return [];
    const d = dim(f), o = f.origin;
    return [() => {
            for (const c of f.charges)
                set(d, c, "minecraft:tnt");
            for (const x of [5, 21])
                set(d, add(o, { x, y: 6, z: -3 }), "floodlight");
        }];
}
export function build(f, player) {
    if (player.getGameMode() !== GameMode.Creative)
        throw Error("Deployment is Creative-only.");
    if (active.has(f.id))
        throw Error("This facility is already being built.");
    if (facilities.size >= 16 && !facilities.has(f.id))
        throw Error("This alpha supports at most 16 registered facilities per world.");
    for (const other of facilities.values())
        if (other.id !== f.id && other.dimension === f.dimension && intersects(f.bounds, other.bounds, 8))
            throw Error("Another facility overlaps this site. Move farther away.");
    const d = dim(f);
    // The mountain's skirts may run into unloaded chunks; the pad itself must be loaded.
    for (const x of [PAD.x0, PAD.x1])
        for (const z of [PAD.z0, PAD.z1])
            if (!loaded(d, add(f.origin, { x, y: 0, z })))
                throw Error("The full site must be loaded. Move closer or raise simulation distance, then retry.");
    facilities.set(f.id, f);
    f.phase = "building";
    save(f);
    active.add(f.id);
    // Level ground, then rock, then modules carved into it, then fittings, then the mountain over it all.
    const ops = [...earthworks(f), ...encasement(f)];
    ops.push(...f.modules.map(m => () => {
        if (!loaded(d, m.pos) || !loaded(d, add(m.pos, { x: m.template === "entrance" ? 14 : MODULE - 1, y: m.template === "entrance" ? 8 : 6, z: m.template === "entrance" ? 21 : MODULE - 1 })))
            throw Error("Build paused because its chunks unloaded. Return here and use Resume in the deployment device.");
        world.structureManager.place(NS + "bunker/" + m.template, d, m.pos, { includeEntities: false });
    }));
    ops.push(...installations(f), ...mountain(f), ...charges(f));
    const task = system.runInterval(() => {
        try {
            if (f.buildStep >= ops.length) {
                f.phase = "ready";
                save(f);
                active.delete(f.id);
                system.clearRun(task);
                // Messaging a departed player throws; a finished build must not fall into the failure path.
                if (player.isValid)
                    tell(player, `§aBunker ready: ${f.id}. Entrance faces north (−Z). Use the outside reader with a keycard.`);
                return;
            }
            ops[f.buildStep]();
            f.buildStep++;
            mark(f);
            if (f.buildStep % 15 === 0) {
                save(f);
                if (player.isValid)
                    player.onScreenDisplay.setActionBar(`Building Secret Facilities • ${Math.floor(f.buildStep / ops.length * 100)}%`);
            }
        }
        catch (error) {
            f.phase = "failed";
            save(f);
            active.delete(f.id);
            system.clearRun(task);
            report(error, player);
        }
    }, 2);
    tell(player, `Building ${f.floors.length - 1} floors. Stay near this site until construction finishes.`);
}
// Canopy, ground cover and decoration sit above the real surface and must not count as relief.
const CANOPY = ["leaves", "_log", "wood", "_stem", "sapling", "vine", "bamboo", "cactus", "sugar_cane", "snow_layer",
    "short_grass", "tall_grass", "fern", "flower", "mushroom", "deadbush", "azalea", "moss_carpet", "hanging_roots",
    "kelp", "seagrass", "coral", "lantern", "torch", "web", "berry", "pumpkin", "melon", "crop", "sculk_vein"];
function groundAt(d, x, z) {
    try {
        let block = d.getTopmostBlock({ x, z });
        for (let i = 0; i < 24 && block; i++) {
            if (!CANOPY.some(part => block.typeId.includes(part)))
                return block;
            block = d.getBlock({ x, y: block.location.y - 1, z });
        }
        return block;
    }
    catch {
        return undefined;
    }
}
/** The solid floor of a column, looking through canopy and any water or lava standing on it. */
function floorAt(d, x, z) {
    let block = groundAt(d, x, z), liquid;
    try {
        for (let i = 0; i < 64 && block && (block.isLiquid || CANOPY.some(part => block.typeId.includes(part))); i++) {
            if (block.isLiquid)
                liquid ?? (liquid = block.location.y);
            block = d.getBlock({ x, y: block.location.y - 1, z });
        }
    }
    catch {
        return undefined;
    }
    if (!block || block.isLiquid)
        return undefined;
    return { floor: block.location.y, liquid };
}
/** Measure the footprint and choose the surface level closest to the entrance ground that the
 *  earthworks can reach everywhere. Only ground too steep to level, or water standing above
 *  the pad where it would flood the entrance, is refused. */
function survey(d, origin) {
    let low = Infinity, high = -Infinity, unknown = 0, liquid = -Infinity;
    const columns = [];
    for (let x = 0; x <= 3 * MODULE - 1; x += SURVEY_STEP)
        for (let z = -4; z <= 3 * MODULE - 1; z += SURVEY_STEP)
            columns.push([x, z]);
    // The escape hut stands behind the footprint; a rise there would bury its exit.
    for (const x of [11, 15])
        for (const z of [31, 36])
            columns.push([x, z]);
    for (const [x, z] of columns) {
        const column = floorAt(d, origin.x + x, origin.z + z);
        if (!column) {
            unknown++;
            continue;
        }
        low = Math.min(low, column.floor);
        high = Math.max(high, column.floor);
        if (column.liquid !== undefined)
            liquid = Math.max(liquid, column.liquid);
    }
    if (unknown > 2)
        throw Error("The site is not fully loaded yet. Stand in the middle of it, wait a moment, then try again.");
    if (high - low > MAX_CUT + MAX_FILL)
        throw Error(`This site rises and falls ${high - low} blocks across the footprint. The bunker can level up to ${MAX_CUT + MAX_FILL}; try gentler ground.`);
    const level = Math.min(Math.max(origin.y, high - MAX_CUT), low + MAX_FILL);
    if (liquid > level)
        throw Error("Water or lava on this site sits above ground level and would flood the entrance. Move away from it.");
    return { level, cut: Math.max(0, high - level), fill: Math.max(0, level - low) };
}
export function originAt(player) {
    if (player.dimension.id !== "minecraft:overworld")
        throw Error("Choose an Overworld surface site.");
    const x = Math.floor(player.location.x), z = Math.floor(player.location.z) + 10;
    // Use the solid surface directly beneath the entrance rather than excavating at flight height.
    const ground = groundAt(player.dimension, x, z);
    if (!ground || ground.isLiquid)
        throw Error("Choose dry land for the main entrance.");
    const { level, cut, fill } = survey(player.dimension, { x: x - 13, y: ground.location.y, z });
    return { origin: { x: x - 13, y: level, z }, ground: ground.typeId, cut, fill };
}
