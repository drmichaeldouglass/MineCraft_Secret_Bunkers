import { GameMode, system, world } from "@minecraft/server";
import { add, intersects, NS } from "../core/types.js";
import { FLOOR_STEP, MODULE } from "../generation/planner.js";
import { facilities, mark, save } from "./store.js";
import { dim, fill, loaded, report, set, tell } from "./world.js";
const active = new Set();
/** Columns are sampled every few blocks across the footprint, and must agree within this. */
const SITE_RELIEF = 5, SURVEY_STEP = 5;
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
    ops.push(() => {
        fill(d, p(11, -9, 26), p(15, -5, 36), "reinforced_concrete");
        fill(d, p(12, -8, 26), p(14, -6, 35), "minecraft:air");
        set(d, p(13, -5, 31), "industrial_light");
    });
    ops.push(() => {
        fill(d, p(11, -5, 32), p(15, 4, 36), "reinforced_concrete");
        fill(d, p(12, -5, 33), p(14, 3, 35), "minecraft:air");
        // Hut floor; the ladder then cuts its own opening. Without it the exit is two blocks of open shaft away.
        fill(d, p(12, 0, 33), p(14, 0, 35), "industrial_floor");
        fill(d, p(13, -8, 35), p(13, 3, 35), "minecraft:ladder", { facing_direction: 2 });
        fill(d, p(12, 1, 32), p(14, 2, 32), "minecraft:air");
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
/** Solid rock around every underground slab, so no floor can surface through a hillside. */
function encasement(f) {
    const d = dim(f), o = f.origin, span = 3 * MODULE - 1, ops = [];
    for (const floor of f.floors.slice(1))
        for (let band = 0; band < 3; band++) {
            const z = o.z + band * MODULE, top = floor.y + FLOOR_STEP - 1;
            ops.push(() => fill(d, { x: o.x, y: floor.y, z }, { x: o.x + span, y: top, z: z + MODULE - 1 }, "minecraft:stone"));
        }
    // Ground the entrance forecourt so it never juts out over a slope.
    ops.push(() => fill(d, { x: o.x + 6, y: o.y - 4, z: o.z - 4 }, { x: o.x + 20, y: o.y - 1, z: o.z - 1 }, "minecraft:stone"));
    return ops;
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
    for (const x of [f.bounds.min.x, f.bounds.max.x])
        for (const z of [f.bounds.min.z, f.bounds.max.z])
            if (!loaded(d, { x, y: f.origin.y, z }))
                throw Error("The full site must be loaded. Move closer or raise simulation distance, then retry.");
    facilities.set(f.id, f);
    f.phase = "building";
    save(f);
    active.add(f.id);
    // Rock first, then modules carved into it, then fittings.
    const ops = encasement(f);
    ops.push(...f.modules.map(m => () => {
        if (!loaded(d, m.pos) || !loaded(d, add(m.pos, { x: m.template === "entrance" ? 14 : MODULE - 1, y: m.template === "entrance" ? 8 : 6, z: m.template === "entrance" ? 21 : MODULE - 1 })))
            throw Error("Build paused because its chunks unloaded. Return here and use Resume in the deployment device.");
        world.structureManager.place(NS + "bunker/" + m.template, d, m.pos, { includeEntities: false });
    }));
    ops.push(...installations(f));
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
/** An uneven or flooded site leaves floors exposed, so refuse it before anything is replaced. */
function survey(d, origin) {
    let low = Infinity, high = -Infinity, wet = 0, unknown = 0;
    const columns = [];
    for (let x = 0; x <= 3 * MODULE - 1; x += SURVEY_STEP)
        for (let z = -4; z <= 3 * MODULE - 1; z += SURVEY_STEP)
            columns.push([x, z]);
    // The escape hut stands behind the footprint; a rise there would bury its exit.
    for (const x of [11, 15])
        for (const z of [31, 36])
            columns.push([x, z]);
    for (const [x, z] of columns) {
        const column = groundAt(d, origin.x + x, origin.z + z);
        if (!column) {
            unknown++;
            continue;
        }
        if (column.isLiquid) {
            wet++;
            continue;
        }
        low = Math.min(low, column.location.y);
        high = Math.max(high, column.location.y);
    }
    if (unknown > 2)
        throw Error("The site is not fully loaded yet. Stand in the middle of it, wait a moment, then try again.");
    if (wet)
        throw Error("Part of this footprint is water. Move to dry ground.");
    if (high - low > SITE_RELIEF)
        throw Error(`This site rises and falls ${high - low} blocks across the footprint. Choose ground level to within ${SITE_RELIEF} blocks.`);
}
export function originAt(player) {
    if (player.dimension.id !== "minecraft:overworld")
        throw Error("Choose an Overworld surface site.");
    const x = Math.floor(player.location.x), z = Math.floor(player.location.z) + 10;
    // Use the solid surface directly beneath the entrance rather than excavating at flight height.
    const ground = groundAt(player.dimension, x, z);
    if (!ground || ground.isLiquid)
        throw Error("Choose dry land for the main entrance.");
    const origin = { x: x - 13, y: ground.location.y, z };
    survey(player.dimension, origin);
    return origin;
}
