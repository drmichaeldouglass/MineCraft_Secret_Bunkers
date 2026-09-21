import { world } from "@minecraft/server";
import type { Facility } from "../core/types.js";
const INDEX = "secretfacilities:index";
export const facilities = new Map<string, Facility>();
export const dirty = new Set<string>();
export function mark(f: Facility): void { dirty.add(f.id); }
export function save(f: Facility): void {
  const prefix = `secretfacilities:${f.id}`;
  const old = Number(world.getDynamicProperty(`${prefix}:bank`) ?? 0), bank=1-old;
  const text=JSON.stringify(f), count=Math.ceil(text.length/12000);
  // The pointer is committed last. A reload mid-write retains the prior snapshot.
  for(let i=0;i<count;i++) world.setDynamicProperty(`${prefix}:${bank}:${i}`,text.slice(i*12000,(i+1)*12000));
  world.setDynamicProperty(`${prefix}:${bank}:count`,count);
  world.setDynamicProperty(`${prefix}:bank`,bank);
  world.setDynamicProperty(INDEX,JSON.stringify([...facilities.keys()]));
  dirty.delete(f.id);
}
export function load(): void {
  const ids=JSON.parse(String(world.getDynamicProperty(INDEX)??"[]")) as string[];
  for(const id of ids) {
    try {
      const prefix=`secretfacilities:${id}`,bank=Number(world.getDynamicProperty(`${prefix}:bank`)??0);
      const count=Number(world.getDynamicProperty(`${prefix}:${bank}:count`)??0);
      if(count<1 || count>100) throw Error("Invalid saved chunk count");
      let text="";for(let i=0;i<count;i++)text+=String(world.getDynamicProperty(`${prefix}:${bank}:${i}`)??"");
      const f=JSON.parse(text) as Facility;
      // Every list below is walked by a shared tick loop, so one bad snapshot must not poison the others.
      const lists:unknown[]=[f.doors,f.modules,f.floors,f.lasers,f.lights,f.turrets,f.consoles];
      if(f.schema!==1 || f.id!==id || !lists.every(Array.isArray) || !f.floors.length || !Object.keys(f.zones??{}).length)
        throw Error("Unsupported facility save");
      // Generations interrupted by world closure can be resumed explicitly.
      if(f.phase==="building")f.phase="failed";
      facilities.set(id,f);
    }catch(error){console.warn(`[Secret Facilities] Could not load ${id}: ${error}`);}
  }
}
