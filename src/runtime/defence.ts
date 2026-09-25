import { EntityDamageCause, system, world, type Dimension, type Entity, type Vector2 } from "@minecraft/server";
import { isHostile, defenceActive } from "../core/rules.js";
import { add, distance, NS, type Facility, type Turret, type Vec } from "../core/types.js";
import { facilities, mark } from "./store.js";
import { dim, lineClear, nearby, sound, turretBeam } from "./world.js";
interface Tracking { target?:string; nextScan:number; nextShot:number; entity?:string }
const cache=new Map<string,Tracking>();
export const allowed=(e:Entity):boolean=>e.isValid&&isHostile(e.typeId,e.getComponent("minecraft:tameable")?.isTamed??false);
/** Where turrets aim: the middle of a mob, not its feet. */
export const aim=(e:Entity):Vec=>add(e.location,{x:0,y:1,z:0});
/** Pitch and yaw that point an entity's front along a direction. */
export const rotation=(v:Vec):Vector2=>({x:-Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI,y:-Math.atan2(v.x,v.z)*180/Math.PI});
/** The nearest valid target between the minimum and maximum range that the turret can see. */
export function acquire(d:Dimension,source:Vec,range:number,minRange=0):Entity|undefined {
  return d.getEntities({location:source,maxDistance:range}).filter(e=>allowed(e)&&distance(e.location,source)>=minRange)
    .sort((a,b)=>distance(a.location,source)-distance(b.location,source))
    .find(e=>lineClear(d,source,aim(e)));
}
function update(f:Facility,t:Turret):void {
  const key=`${f.id}:${t.id}`,d=dim(f);
  let tracking=cache.get(key);
  if(!tracking){tracking={nextScan:system.currentTick+(cache.size%8)*5,nextShot:0};cache.set(key,tracking);}
  let entity=tracking.entity?world.getEntity(tracking.entity):undefined;
  if(!entity?.isValid){
    if(system.currentTick<tracking.nextScan)return;
    tracking.nextScan=system.currentTick+40;
    entity=d.getEntities({type:NS+"laser_turret",tags:[`sf:${f.id}:${t.id}`],location:t.pos,maxDistance:4})[0];
    if(!entity)return;tracking.entity=entity.id;
  }
  if(t.damaged||!t.enabled||!defenceActive(f.zones[t.zone],f.state,f.countdown)){tracking.target=undefined;return;}
  const source=add(entity.location,{x:0,y:0.95,z:0}),range=t.zone==="entrance"?28:16;
  let target=tracking.target?world.getEntity(tracking.target):undefined;
  if(target&&(!allowed(target)||target.dimension.id!==f.dimension||distance(target.location,source)>range))target=undefined;
  if(!target&&system.currentTick>=tracking.nextScan){
    tracking.nextScan=system.currentTick+40;
    target=acquire(d,source,range);
  }
  tracking.target=target?.id;
  if(!target)return;
  const to=aim(target);
  entity.setRotation(rotation({x:to.x-source.x,y:to.y-source.y,z:to.z-source.z}));
  if(system.currentTick<tracking.nextShot)return;
  if(!lineClear(d,source,to)){tracking.target=undefined;return;}
  tracking.nextShot=system.currentTick+20;
  turretBeam(d,source,to);
  target.applyDamage(5,{cause:EntityDamageCause.entityAttack,damagingEntity:entity});
  sound(f,"laser_turret_fire",source,0.3);
}
export function tickDefence():void {
  for(const f of facilities.values())if(f.phase==="ready"&&nearby(f))for(const turret of f.turrets){
    try{update(f,turret);}catch(error){console.warn(`[Secret Facilities] turret ${turret.id}: ${error}`);}
  }
}
export function registerDefenceEvents():void {
  world.afterEvents.entityDie.subscribe(event=>{
    const entity=event.deadEntity;if(entity.typeId!==NS+"laser_turret")return;
    try{
      const f=facilities.get(String(entity.getDynamicProperty(NS+"facility")));
      const t=f?.turrets.find(t=>t.id===entity.getDynamicProperty(NS+"turret"));
      if(f&&t){t.damaged=true;mark(f);}
    }catch{/* Already removed; never recreate a missing defence automatically. */}
  });
}
