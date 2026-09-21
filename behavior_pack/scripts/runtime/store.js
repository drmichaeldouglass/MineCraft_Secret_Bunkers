import { world } from "@minecraft/server";
const INDEX = "secretfacilities:index";
export const facilities = new Map();
export const dirty = new Set();
export function mark(f) { dirty.add(f.id); }
export function save(f) {
    const prefix = `secretfacilities:${f.id}`;
    const old = Number(world.getDynamicProperty(`${prefix}:bank`) ?? 0), bank = 1 - old;
    const text = JSON.stringify(f), count = Math.ceil(text.length / 12000);
    // The pointer is committed last. A reload mid-write retains the prior snapshot.
    for (let i = 0; i < count; i++)
        world.setDynamicProperty(`${prefix}:${bank}:${i}`, text.slice(i * 12000, (i + 1) * 12000));
    world.setDynamicProperty(`${prefix}:${bank}:count`, count);
    world.setDynamicProperty(`${prefix}:bank`, bank);
    world.setDynamicProperty(INDEX, JSON.stringify([...facilities.keys()]));
    dirty.delete(f.id);
}
export function load() {
    const ids = JSON.parse(String(world.getDynamicProperty(INDEX) ?? "[]"));
    for (const id of ids) {
        try {
            const prefix = `secretfacilities:${id}`, bank = Number(world.getDynamicProperty(`${prefix}:bank`) ?? 0);
            const count = Number(world.getDynamicProperty(`${prefix}:${bank}:count`) ?? 0);
            if (count < 1 || count > 100)
                throw Error("Invalid saved chunk count");
            let text = "";
            for (let i = 0; i < count; i++)
                text += String(world.getDynamicProperty(`${prefix}:${bank}:${i}`) ?? "");
            const f = JSON.parse(text);
            if (f.schema !== 1 || f.id !== id || !Array.isArray(f.doors) || !Array.isArray(f.modules))
                throw Error("Unsupported facility save");
            // Generations interrupted by world closure can be resumed explicitly.
            if (f.phase === "building")
                f.phase = "failed";
            facilities.set(id, f);
        }
        catch (error) {
            console.warn(`[Secret Facilities] Could not load ${id}: ${error}`);
        }
    }
}
