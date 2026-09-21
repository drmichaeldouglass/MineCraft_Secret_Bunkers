import { GameMode, system, world } from "@minecraft/server";
import { add, intersects, NS } from "../core/types.js";
import { facilities, mark, save } from "./store.js";
import { dim, fill, loaded, report, set, tell } from "./world.js";
const active = new Set();
function installations(f) {
    const d = dim(f), o = f.origin, p = (x, y, z) => add(o, { x, y, z }), low = f.floors[f.floors.length - 1].y;
    const ops = [];
    // Dry, reinforced emergency ladder shaft. One nine-block segment per operation.
    for (let y = low + 1; y <= o.y + 5; y += 9) {
        const top = Math.min(y + 8, o.y + 5);
        ops.push(() => {
            fill(d, { x: o.x + 35, y, z: o.z + 22 }, { x: o.x + 36, y: top, z: o.z + 22 }, "minecraft:air");
            fill(d, { x: o.x + 37, y, z: o.z + 22 }, { x: o.x + 37, y: top, z: o.z + 22 }, "steel_wall");
            fill(d, { x: o.x + 36, y, z: o.z + 22 }, { x: o.x + 36, y: top, z: o.z + 22 }, "minecraft:ladder", { facing_direction: 4 });
        });
    }
    // B1 rear escape tunnel and a second ladder to a discreet surface utility hut.
    ops.push(() => {
        fill(d, p(30, -9, 38), p(34, -5, 52), "reinforced_concrete");
        fill(d, p(31, -8, 38), p(33, -6, 51), "minecraft:air");
        set(d, p(32, -5, 44), "industrial_light");
    });
    ops.push(() => {
        fill(d, p(30, -5, 48), p(34, 4, 52), "reinforced_concrete");
        fill(d, p(31, -5, 49), p(33, 3, 51), "minecraft:air");
        fill(d, p(32, -8, 51), p(32, 3, 51), "minecraft:ladder", { facing_direction: 2 });
        fill(d, p(31, 1, 48), p(33, 2, 48), "minecraft:air");
        set(d, p(32, 4, 50), "industrial_light");
    });
    for (const door of f.doors)
        ops.push(() => {
            const id = door.kind === "blast" ? "blast_door" : door.kind === "shutter" ? "security_shutter" : "security_door";
            fill(d, door.min, door.max, id, { [NS + "open"]: door.open });
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
    const ops = f.modules.map(m => () => {
        if (!loaded(d, m.pos) || !loaded(d, add(m.pos, { x: m.template === "entrance" ? 20 : 12, y: 6, z: m.template === "entrance" ? 31 : 12 })))
            throw Error("Build paused because its chunks unloaded. Return here and use Resume in the deployment device.");
        world.structureManager.place(NS + "bunker/" + m.template, d, m.pos, { includeEntities: false });
    });
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
export function originAt(player) {
    if (player.dimension.id !== "minecraft:overworld")
        throw Error("Choose an Overworld surface site.");
    const x = Math.floor(player.location.x), z = Math.floor(player.location.z) + 10;
    // Use the solid surface directly beneath the entrance rather than excavating at flight height.
    const ground = player.dimension.getTopmostBlock({ x, z });
    if (!ground || ground.isLiquid)
        throw Error("Choose dry land for the main entrance.");
    return { x: x - 32, y: ground.location.y, z };
}
