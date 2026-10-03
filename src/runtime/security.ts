import { EntityDamageCause, system, world, type Dimension, type Entity, type Player } from "@minecraft/server";
import { defenceActive, mayOpen, segmentDistance } from "../core/rules.js";
import { add, distance, inside, NS, type Door, type Facility, type Laser, type SecurityState, type Vec } from "../core/types.js";
import { facilities, mark, save } from "./store.js";
import { dim, fill, getClearance, lineClear, loaded, nearby, set, sound, tell, tripwire } from "./world.js";
import { allowed } from "./defence.js";
import { demolish } from "./destruct.js";
import { EXITS } from "../generation/tunnel.js";
import { FLOOR_STEP } from "../generation/planner.js";

interface DoorJob { f:Facility; door:Door; progress:number; target:number; repaint:boolean; started:boolean; leaf?:string; motion?:number; hidden?:boolean }
const moving=new Map<string,DoorJob>();
/** Two-pixel sub-steps the leaf travels; eight per block of door height, one per tick. */
export const SUBSTEPS=8;
/** Ticks per block each blast door leaf slides sideways. Must match LEAF_RATE in tools/build_assets.py. */
export const BLAST_RATE=16;
/** Blast door 'slide' state while its leaves are in motion: still solid, but drawn invisible so the
 *  moving leaves show through. Only the blast door defines this permutation. */
const HIDDEN=1;
export const LEAF=NS+"blast_door_leaf";
function idFor(door:Door):string {return door.kind==="blast"?"blast_door":door.kind==="shutter"?"security_shutter":"security_door";}
/** The blast door is drawn in motion by a leaf entity the client slides smoothly;
 *  its blocks only supply collision and the solid door shown at rest. */
const usesLeaf=(door:Door):boolean => door.kind==="blast";
const width=(door:Door):number => door.max.x-door.min.x+1;
/** Steps of a full open or close: the blast door's two leaves each travel half its width. */
export const travel=(door:Door):number =>
  usesLeaf(door)?Math.round(width(door)/2*BLAST_RATE):(door.max.y-door.min.y+1)*SUBSTEPS;
const leafTag=(f:Facility,door:Door):string => `sf_door:${f.id}:${door.id}`;
/** Ease in and out, so the heavy leaf starts and stops gently. Must match the client script. */
export const ease=(phase:number):number => phase*phase*(3-2*phase);
/** Blocks each blast door leaf has slid away from the centre seam at a given step. */
export const slid=(door:Door,progress:number):number => ease(progress/travel(door))*width(door)/2;
/** A blast door column is passable only once both leaves have slid entirely clear of it,
 *  so a player can never walk through a leaf that is still drawn there. */
function clearOf(door:Door,progress:number,column:number):boolean {
  const half=width(door)/2;
  return slid(door,progress)>=Math.max(half-column,column+1-half)-1e-9;
}
function leafStates(door:Door,progress:number,column:number,inMotion:boolean):Record<string,boolean|number> {
  const open=clearOf(door,progress,column);
  return {[NS+"open"]:open,[NS+"slide"]:!open&&inMotion?HIDDEN:0};
}
/** Paint the blast door's columns whose state differs between two moments. Returns the number of fills. */
function paintLeafDoor(d:Dimension,door:Door,from:number,to:number,wasMoving:boolean,isMoving:boolean,all=false):number {
  let fills=0;
  for(let i=0;i<width(door);i++){
    const before=leafStates(door,from,i,wasMoving),after=leafStates(door,to,i,isMoving);
    if(!all&&before[NS+"open"]===after[NS+"open"]&&before[NS+"slide"]===after[NS+"slide"])continue;
    const x=door.min.x+i;fill(d,{...door.min,x},{...door.max,x},idFor(door),after);fills++;
  }
  return fills;
}
/** Paint one horizontal course of a stepped door: courses below the moving edge are gone,
 *  the edge course shows its offset, and courses above are still solid. */
function paintRow(d:Dimension,door:Door,row:number,progress:number):void {
  const y=door.min.y+row,edge=Math.floor(progress/SUBSTEPS);
  fill(d,{...door.min,y},{...door.max,y},idFor(door),
    {[NS+"open"]:row<edge,[NS+"slide"]:row===edge?progress%SUBSTEPS:0});
}
/** Repaint only the courses a single step changes. Returns the number of fills. */
function paintStep(d:Dimension,door:Door,to:number):number {
  const edge=Math.min(door.max.y-door.min.y,Math.floor(to/SUBSTEPS));
  paintRow(d,door,edge,to);
  if(edge>0){paintRow(d,door,edge-1,to);return 2;}
  return 1;
}
function clearLeaves(d:Dimension,f:Facility,door:Door):void {
  for(const e of d.getEntities({type:LEAF,tags:[leafTag(f,door)]}))try{e.remove();}catch{/* Already gone. */}
}
const liveLeaf=(job:DoorJob):Entity|undefined => {const e=job.leaf?world.getEntity(job.leaf):undefined;return e?.isValid?e:undefined;};
/** Which way the leaves travel this tick: 1 opening, -1 closing, 0 held. */
const heading=(job:DoorJob):number => Math.sign(job.target-job.progress);
/** The client animates the leaf on its own clock from where it was last told it started,
 *  so the slide stays smooth whatever the tick rate or network jitter. The server only
 *  speaks when the leaf starts, stops or reverses. */
function steer(leaf:Entity,door:Door,job:DoorJob,motion:number):void {
  leaf.setProperty(NS+"phase",job.progress/travel(door));leaf.setProperty(NS+"motion",motion);job.motion=motion;
}
function spawnLeaf(d:Dimension,f:Facility,door:Door,job:DoorJob):void {
  clearLeaves(d,f,door);
  const leaf=d.spawnEntity(LEAF,{x:(door.min.x+door.max.x+1)/2,y:door.min.y,z:door.min.z+0.5},
    job.progress/travel(door)>0.5?{spawnEvent:NS+"from_open"}:undefined);
  leaf.setRotation({x:0,y:0});leaf.addTag(leafTag(f,door));steer(leaf,door,job,heading(job));
  job.leaf=leaf.id;
}
/** Leaves outlive their slide only when a chunk or world unloads mid-travel. */
export function registerDoorEvents():void {
  world.afterEvents.entityLoad.subscribe(({entity})=>{
    try{if(entity.typeId===LEAF&&![...moving.values()].some(j=>j.leaf===entity.id))entity.remove();}catch{/* Already gone. */}
  });
}
/** Once demolition has begun, a door whose blocks were blown out or buried in rubble is gone for good:
 *  moving it would paint door blocks back over the ruin. A door that survived, like the tunnel's, still works. */
function intact(f:Facility,door:Door):boolean {
  if(f.destructionStep===undefined)return true;
  try{return dim(f).getBlock(door.min)?.typeId===NS+idFor(door);}catch{return false;}
}
export function requestDoor(f:Facility,door:Door,open:boolean):void {
  if(!intact(f,door))return;
  const key=`${f.id}:${door.id}`,running=moving.get(key);
  // Reversing mid-travel resumes from where the leaf actually is.
  const progress=running?running.progress:(door.open?travel(door):0);
  door.open=open;mark(f);
  moving.set(key,{f,door,progress,target:open?travel(door):0,repaint:false,started:false,leaf:running?.leaf,motion:running?.motion,hidden:running?.hidden});
  if(door.kind==="blast")sound(f,"blast_door_warning",door.min);
}
export function restoreDoors(f:Facility):void {
  for(const door of f.doors){const at=door.open?travel(door):0;
    moving.set(`${f.id}:${door.id}`,{f,door,progress:at,target:at,repaint:true,started:true});}
}
export function toggleDoor(player:Player,f:Facility,door:Door):void {
  if(!mayOpen(f.state,getClearance(player),door.clearance)){
    sound(f,"access_denied",door.min);tell(player,f.state==="LOCKDOWN"?"Lockdown: command clearance required.":`Level ${door.clearance} keycard required.`);return;
  }
  sound(f,"access_granted",door.min);requestDoor(f,door,!door.open);
}
/** Loose things a closing door may shut on; the game pushes them out of the block. Counting them
 *  let one dropped item or spent arrow in a doorway hold the door open until it despawned. */
const DEBRIS=new Set([LEAF,"minecraft:item","minecraft:xp_orb","minecraft:arrow","minecraft:thrown_trident","minecraft:snowball","minecraft:egg"]);
function occupied(d:Dimension,door:Door):boolean {
  const a=door.min,b=door.max;
  const c={x:(a.x+b.x+1)/2,y:(a.y+b.y+1)/2,z:(a.z+b.z+1)/2};
  const reach=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/2+4;
  return d.getEntities({location:c,maxDistance:reach}).some(e=>!DEBRIS.has(e.typeId)&&inside(e.location,{min:{x:a.x-0.7,y:a.y-1.9,z:a.z-0.7},max:{x:b.x+1.7,y:b.y+1,z:b.z+1.7}}));
}
export function tickDoors():void {
  let writes=0;
  for(const [key,job] of [...moving]){
    const {f,door}=job,d=dim(f);
    if(writes>=32)break;
    if(!nearby(f)||!loaded(d,door.min)||!loaded(d,door.max))continue;
    // A door caught mid-travel by the demolition stays as the blast left it.
    if(!intact(f,door)){clearLeaves(d,f,door);moving.delete(key);continue;}
    const height=door.max.y-door.min.y+1;
    if(job.repaint){
      // Saved open is the requested endpoint, not the position of an interrupted slide.
      // Restore an occupied closed doorway as open, then let the normal closure wait for it to clear.
      if(job.progress===0&&job.target===0&&occupied(d,door))job.progress=travel(door);
      if(usesLeaf(door)){
        // A leaf left over from a slide interrupted by a reload or unload.
        clearLeaves(d,f,door);job.leaf=undefined;job.hidden=false;
        writes+=paintLeafDoor(d,door,job.progress,job.progress,false,false,true);
      }else{for(let row=0;row<height;row++)paintRow(d,door,row,job.progress);writes+=height;}
      job.repaint=false;
    }
    if(job.progress===job.target){
      if(job.leaf||job.hidden){
        // At rest the door blocks draw the door again, then the leaves can go.
        if(usesLeaf(door))writes+=paintLeafDoor(d,door,job.progress,job.progress,true,false);
        clearLeaves(d,f,door);job.leaf=undefined;job.hidden=false;
      }
      moving.delete(key);continue;
    }
    const next=job.progress+heading(job),leaf=usesLeaf(door)?liveLeaf(job):undefined;
    // Never materialize a steel door around an entity. Retry while obstructed.
    if(next<job.progress&&occupied(d,door)){if(leaf&&job.motion!==0)steer(leaf,door,job,0);continue;}
    if(!job.started){job.started=true;if(door.kind==="blast")sound(f,"blast_door_movement",door.min);}
    // A new, resumed or reversed leaf gets one tick to reach clients before the blocks move,
    // so the doorway never opens ahead of the leaves the player sees.
    if(usesLeaf(door)&&!leaf){spawnLeaf(d,f,door,job);continue;}
    if(leaf&&job.motion!==heading(job)){steer(leaf,door,job,heading(job));continue;}
    const from=job.progress;job.progress=next;
    if(usesLeaf(door)){
      // The first step hands the picture over to the leaves: the resting door blocks turn invisible.
      writes+=paintLeafDoor(d,door,from,next,job.hidden===true,true,!job.hidden);job.hidden=true;
    }else writes+=paintStep(d,door,next);
    // Round-robin prevents a blocked door or a distant facility starving others.
    moving.delete(key);moving.set(key,job);
  }
}
export function setSecurity(f:Facility,state:SecurityState):void {
  if(f.state===state)return;
  if(f.state==="DESTROYED")return;
  if(f.state==="SELF_DESTRUCT"&&state!=="DESTROYED")return;
  f.state=state;
  for(const door of f.doors){
    if(state==="SELF_DESTRUCT"||state==="DESTROYED")requestDoor(f,door,true);
    else if(state==="LOCKDOWN"||(state==="ALERT"&&door.kind!=="shutter"))requestDoor(f,door,false);
    else if(state==="NORMAL"&&door.kind==="shutter")requestDoor(f,door,true);
  }
  mark(f);save(f);
  for(const p of world.getAllPlayers())if(p.dimension.id===f.dimension&&inside(p.location,f.bounds,10))tell(p,`Facility status: §e${state}`);
}
export function armDestruct(f:Facility):void {
  if(f.state==="DESTROYED"||f.state==="SELF_DESTRUCT")return;
  f.countdown=90;setSecurity(f,"SELF_DESTRUCT");
}
export function abortDestruct(f:Facility):boolean {
  if(f.state!=="SELF_DESTRUCT"||(f.countdown??0)<=10)return false;
  f.countdown=undefined;f.state="NORMAL";for(const door of f.doors)requestDoor(f,door,true);mark(f);save(f);return true;
}
/** Beams are drawn, and burn hostile mobs, only within this distance of a player. */
const SENSOR_RANGE=24;
/** Health a hostile mob loses each sensor tick (four a second) while any beam passes through it. */
export const BEAM_DAMAGE=3;
/** Heights above a mob's feet tested against the beams: low enough for a silverfish, high enough for a zombie. */
const BODY=[0.1,0.6,1.1,1.6];
/** Hostile mobs near a grid, found once per grid per tick however many beams it has. Every floor has
 *  grids at the same x and z, so the key also carries the floor the beam is on. */
function mobsNear(f:Facility,d:Dimension,laser:Laser,cache:Map<string,Entity[]>):Entity[] {
  const floor=Math.floor((laser.a.y-f.origin.y)/FLOOR_STEP);
  const key=`${floor},${laser.a.x},${laser.a.z},${laser.b.x},${laser.b.z}`;
  let mobs=cache.get(key);
  if(!mobs){
    const mid={x:(laser.a.x+laser.b.x)/2,y:(laser.a.y+laser.b.y)/2,z:(laser.a.z+laser.b.z)/2};
    mobs=d.getEntities({location:mid,maxDistance:distance(laser.a,laser.b)/2+3}).filter(allowed);cache.set(key,mobs);
  }
  return mobs;
}
/** Burn every hostile mob a live beam passes through, at most once a tick however many beams it crosses. */
function burn(d:Dimension,laser:Laser,mobs:Entity[],burned:Set<string>):void {
  for(const mob of mobs){
    if(burned.has(mob.id)||!mob.isValid)continue;
    const at=BODY.map(h=>add(mob.location,{x:0,y:h,z:0})).find(v=>segmentDistance(v,laser.a,laser.b)<0.5);
    if(!at)continue;
    burned.add(mob.id);
    try{mob.applyDamage(BEAM_DAMAGE,{cause:EntityDamageCause.entityAttack});d.spawnParticle(NS+"laser_impact",at);}catch{/* Gone. */}
  }
}
/** Where each player stood at the last sensor tick, and in which dimension. */
const previous=new Map<string,{dimension:string;location:Vec}>();
/** Farther than anyone walks or runs between sensor ticks: a teleport, respawn or elevator ride.
 *  Interpolating across it would sweep an imaginary path through every beam in between. */
const TELEPORT=8;
/** Make the queued upgrade changes whose chunks are loaded; the rest wait for a later tick. */
function retrofit(f:Facility):void {
  const d=dim(f);
  f.retrofit=f.retrofit!.filter(r=>{
    if(!loaded(d,r.pos))return true;
    try{if(!r.only||d.getBlock(r.pos)?.typeId===r.only)set(d,r.pos,r.block);}catch{return true;}
    return false;
  });
  if(!f.retrofit.length)delete f.retrofit;
  mark(f);
}
export function tickLasers():void {
  const players=world.getAllPlayers(),burned=new Set<string>();
  for(const f of facilities.values()){
    if(f.retrofit?.length&&f.phase==="ready"&&nearby(f))retrofit(f);
    if(f.phase!=="ready"||!f.lasersEnabled||f.state==="DESTROYED"||f.state==="SELF_DESTRUCT"||!nearby(f))continue;
    const d=dim(f),local=players.filter(p=>p.dimension.id===f.dimension&&inside(p.location,f.bounds,SENSOR_RANGE));
    // Reading clearance scans a whole inventory; do it once per tick, not once per beam.
    const watched=local.filter(p=>getClearance(p)<4),mobs=new Map<string,Entity[]>();
    for(const laser of f.lasers){
      if(!local.some(p=>distance(p.location,laser.a)<SENSOR_RANGE))continue;
      if(!loaded(d,laser.a)||!loaded(d,laser.b))continue;
      // Every sensor tick redraws the beam; each drawing outlasts the gap to the next, so it holds steady.
      tripwire(d,laser.a,laser.b);
      burn(d,laser,mobsNear(f,d,laser,mobs),burned);
      const obstruction=!lineClear(d,laser.a,laser.b);
      const crossed=watched.some(p=>{
        const last=previous.get(p.id),current=p.location;
        const old=last&&last.dimension===p.dimension.id&&distance(last.location,current)<=TELEPORT?last.location:current;
        // Interpolate fast movement so walking across between sensor ticks is detected.
        const steps=Math.min(16,Math.max(1,Math.ceil(distance(old,current)/0.3)));
        for(let j=0;j<=steps;j++)for(const height of [0.3,1,1.7]){
          const t=j/steps,v={x:old.x+(current.x-old.x)*t,y:old.y+(current.y-old.y)*t+height,z:old.z+(current.z-old.z)*t};
          if(segmentDistance(v,laser.a,laser.b)<0.4)return true;
        }
        return false;
      });
      if(obstruction||crossed){
        if(f.state==="NORMAL"||(f.state==="ALERT"&&laser.response==="LOCKDOWN"))setSecurity(f,laser.response);
      }
    }
  }
  previous.clear();for(const p of players)previous.set(p.id,{dimension:p.dimension.id,location:{...p.location}});
}
let alarmPhase=0;
export function tickAlarms():void {
  alarmPhase=(alarmPhase+1)%4;
  for(const f of facilities.values()){
    if(f.phase!=="ready"||!nearby(f))continue;
    const d=dim(f),alarm=f.state==="ALERT"||f.state==="LOCKDOWN"||f.state==="SELF_DESTRUCT";
    const lit=alarm&&system.currentTick%40<20;
    for(const pos of f.lights)try{
      const block=d.getBlock(pos);
      // Re-applying an identical permutation still costs a block update and a relight for every nearby player.
      if(block?.typeId===NS+"emergency_light"&&block.permutation.getAllStates()[NS+"active"]!==lit)
        set(d,pos,"emergency_light",{[NS+"active"]:lit});
    }catch{/* Unloaded lamps are reconciled when active again. */}
    if(alarm&&alarmPhase===0)sound(f,f.state==="ALERT"?"alarm_alert":"alarm_lockdown",f.origin,0.32);
    if(f.state==="SELF_DESTRUCT"&&alarmPhase%2===0){
      if((f.countdown??0)>0){f.countdown!--;mark(f);
        for(const p of world.getAllPlayers())if(p.dimension.id===f.dimension&&inside(p.location,f.bounds,5))
          p.onScreenDisplay.setActionBar(`§cEVACUATE • ${f.countdown}s • B1 secret tunnel to the ${EXITS[f.exit?.kind??"rock_face"].label}`);
      }else if(demolish(f)){
        for(const t of f.turrets){t.enabled=false;t.damaged=true;}
        setSecurity(f,"DESTROYED");
      }
    }
  }
}
export { defenceActive };
