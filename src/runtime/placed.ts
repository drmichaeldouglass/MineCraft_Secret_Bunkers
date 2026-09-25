import { EntityDamageCause, system, world, type BlockRaycastHit, type Dimension, type Entity } from "@minecraft/server";
import { segmentDistance } from "../core/rules.js";
import { add, distance, NS, type Vec } from "../core/types.js";
import { acquire, aim, allowed, rotation } from "./defence.js";
import { lineClear, turretBeam } from "./world.js";
// Turrets a player places from a spawn egg. Facility turrets carry their facility's ID and are run
// by defence.ts under its zone modes; placed turrets belong to no facility and are always active.
export const LASER = { range:24, reload:20, damage:5 };
/** Ranges in blocks, times in ticks. The minimum range keeps blasts away from the turret itself. */
export const MISSILE = { minRange:10, maxRange:40, reload:60, speed:1.2, turn:0.25, life:60, fuse:1.5, radius:3.5, damage:14 };
export const TURRETS = [NS+"laser_turret", NS+"missile_turret"];
const SURVEY = 64;
interface Sentry { target?:string; nextScan:number; nextShot:number }
interface Flight { dimension:Dimension; pos:Vec; dir:Vec; target?:string; launcher:string; age:number }
const sentries=new Map<string,Sentry>(), flights=new Map<string,Flight>();
let active:string[]=[], nextSurvey=0;
const sub=(a:Vec,b:Vec):Vec=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(v:Vec,k:number):Vec=>({x:v.x*k,y:v.y*k,z:v.z*k});
const unit=(v:Vec):Vec=>{const n=Math.hypot(v.x,v.y,v.z)||1;return scale(v,1/n);};
/** Placed turrets near any player. Also clears missiles with no flight to finish: ones left over
 *  from before a reload, or that flew into unloaded chunks. */
function survey():void {
  const found=new Set<string>();
  for(const p of world.getAllPlayers()){
    const near={location:p.location,maxDistance:SURVEY};
    for(const type of TURRETS)for(const e of p.dimension.getEntities({...near,type}))
      if(e.getDynamicProperty(NS+"facility")===undefined)found.add(e.id);
    for(const e of p.dimension.getEntities({...near,type:NS+"missile"}))if(!flights.has(e.id))try{e.remove();}catch{/* Gone. */}
  }
  active=[...found];
  for(const id of sentries.keys())if(!found.has(id))sentries.delete(id);
}
/** The current target while it stays valid and in range, otherwise the nearest visible one. */
function track(s:Sentry,d:Dimension,source:Vec,range:number,minRange=0):Entity|undefined {
  let target=s.target?world.getEntity(s.target):undefined;
  if(target){
    const r=target.isValid&&target.dimension.id===d.id?distance(target.location,source):Infinity;
    if(!allowed(target)||r>range||r<minRange)target=undefined;
  }
  if(!target&&system.currentTick>=s.nextScan){s.nextScan=system.currentTick+20;target=acquire(d,source,range,minRange);}
  s.target=target?.id;return target;
}
function update(e:Entity):void {
  let s=sentries.get(e.id);
  if(!s){s={nextScan:system.currentTick+(sentries.size%4)*5,nextShot:0};sentries.set(e.id,s);}
  const d=e.dimension,missile=e.typeId===NS+"missile_turret";
  const source=add(e.location,{x:0,y:missile?0.75:0.95,z:0});
  const target=missile?track(s,d,source,MISSILE.maxRange,MISSILE.minRange):track(s,d,source,LASER.range);
  if(!target)return;
  const to=aim(target);e.setRotation(rotation(sub(to,source)));
  if(system.currentTick<s.nextShot)return;
  if(!lineClear(d,source,to)){s.target=undefined;return;}
  if(missile){s.nextShot=system.currentTick+MISSILE.reload;launch(e,d,source,to,target);return;}
  s.nextShot=system.currentTick+LASER.reload;
  turretBeam(d,source,to);
  target.applyDamage(LASER.damage,{cause:EntityDamageCause.entityAttack,damagingEntity:e});
  try{d.playSound(NS+"laser_turret_fire",source,{volume:0.3});}catch{/* Unloaded. */}
}
function launch(turret:Entity,d:Dimension,source:Vec,to:Vec,target:Entity):void {
  const dir=unit(sub(to,source)),muzzle=add(source,scale(dir,0.9));
  const m=d.spawnEntity(NS+"missile",muzzle);m.setRotation(rotation(dir));
  flights.set(m.id,{dimension:d,pos:muzzle,dir,target:target.id,launcher:turret.id,age:0});
  try{d.spawnParticle(NS+"laser_impact",muzzle);d.spawnParticle(NS+"missile_smoke",muzzle);d.playSound(NS+"missile_launch",source,{volume:0.8});}catch{/* Unloaded. */}
}
/** One tick of flight: steer gently toward the target, then detonate on a wall, near the target or
 *  when the fuel runs out. */
function fly(m:Entity,f:Flight):void {
  const d=f.dimension,target=f.target?world.getEntity(f.target):undefined;
  if(target&&allowed(target)&&target.dimension.id===d.id)f.dir=unit(add(f.dir,scale(unit(sub(aim(target),f.pos)),MISSILE.turn)));
  else f.target=undefined;
  const next=add(f.pos,scale(f.dir,MISSILE.speed));
  let hit:BlockRaycastHit|undefined;
  try{hit=d.getBlockFromRay(f.pos,f.dir,{maxDistance:MISSILE.speed,includeLiquidBlocks:false,includePassableBlocks:false});}
  catch{return burst(m,f,f.pos);}
  // Burst just short of the wall, so the blast is on the missile's side of it.
  if(hit)return burst(m,f,sub(add(hit.block.location,hit.faceLocation),scale(f.dir,0.3)));
  if(f.target&&target&&segmentDistance(aim(target),f.pos,next)<=MISSILE.fuse)return burst(m,f,aim(target));
  if(++f.age>=MISSILE.life)return burst(m,f,next);
  m.teleport(next,{rotation:rotation(f.dir)});
  try{d.spawnParticle(NS+"missile_exhaust",f.pos);d.spawnParticle(NS+"missile_smoke",f.pos);}catch{/* Unloaded. */}
  f.pos=next;
}
/** A controlled blast: hostile mobs in the radius take damage falling off with distance. No blocks
 *  break, and players, pets, villagers and animals are never hurt. */
function burst(m:Entity,f:Flight,at:Vec):void {
  flights.delete(m.id);try{m.remove();}catch{/* Gone. */}
  const d=f.dimension,launcher=world.getEntity(f.launcher);
  try{d.spawnParticle("minecraft:large_explosion",at);d.playSound("random.explode",at,{volume:1.5});}catch{/* Unloaded. */}
  for(const e of d.getEntities({location:at,maxDistance:MISSILE.radius})){
    if(!allowed(e)||!lineClear(d,at,aim(e)))continue;
    const falloff=1-0.6*Math.min(1,distance(e.location,at)/MISSILE.radius);
    e.applyDamage(Math.max(1,Math.round(MISSILE.damage*falloff)),
      {cause:EntityDamageCause.entityExplosion,...(launcher?.isValid?{damagingEntity:launcher}:{})});
  }
}
export function tickPlaced():void {
  if(system.currentTick>=nextSurvey){nextSurvey=system.currentTick+40;survey();}
  for(const id of active){
    const e=world.getEntity(id);
    if(!e?.isValid){sentries.delete(id);continue;}
    try{update(e);}catch(error){console.warn(`[Secret Facilities] placed turret ${id}: ${error}`);}
  }
}
export function tickMissiles():void {
  for(const [id,f] of flights){
    const m=world.getEntity(id);
    if(!m?.isValid){flights.delete(id);continue;}
    try{fly(m,f);}catch(error){flights.delete(id);console.warn(`[Secret Facilities] missile ${id}: ${error}`);}
  }
}
