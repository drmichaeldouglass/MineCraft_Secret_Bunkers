import { world } from "@minecraft/server";
import { NS, type Facility, type Laser } from "../core/types.js";
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
/** Bunkers built before horizontal grids had one vertical beam per floor, from an emitter in the
 *  east hall's floor to a receiver hanging under its ceiling. Replace each with the three-beam
 *  horizontal grid new bunkers get, and queue the fittings to swap. A ruin is left alone, and an
 *  unfinished build waits until it is finished, so its saved build step still lines up. */
export function levelGrids(f: Facility): boolean {
  if(f.phase!=="ready"||f.state==="DESTROYED"||f.destructionStep!==undefined)return false;
  const upright=f.lasers.filter(l=>l.a.y!==l.b.y);
  if(!upright.length)return false;
  f.lasers=f.lasers.filter(l=>l.a.y===l.b.y);f.retrofit??=[];
  for(const l of upright){
    const x=Math.floor(l.a.x),z=Math.floor(l.a.z),floor=Math.floor(l.a.y)-1;
    f.retrofit.push({pos:{x,y:floor,z},block:NS+"industrial_floor",only:NS+"laser_emitter"},
      {pos:{x,y:Math.ceil(l.b.y),z},block:"minecraft:air",only:NS+"laser_receiver"});
    for(const h of [1.4,2.4,3.4]){
      const beam:Laser={a:{x:l.a.x,y:floor+h,z:l.a.z-1},b:{x:l.a.x,y:floor+h,z:l.a.z+1},response:l.response};
      f.lasers.push(beam);
      const y=floor+Math.floor(h);
      f.retrofit.push({pos:{x,y,z:z-2},block:NS+"laser_emitter"},{pos:{x,y,z:z+2},block:NS+"laser_receiver"});
    }
  }
  return true;
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
      // Shutters saved by earlier builds covered only the middle two of the hall's five courses. Growing
      // them to floor and ceiling is safe: the door repaint on load fills the new courses.
      for(const door of f.doors)if(door.kind==="shutter"&&door.max.y-door.min.y===1){
        door.min={...door.min,y:door.min.y-1};door.max={...door.max,y:door.max.y+2};
      }
      levelGrids(f);
      facilities.set(id,f);
    }catch(error){console.warn(`[Secret Facilities] Could not load ${id}: ${error}`);}
  }
}
