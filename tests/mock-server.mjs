import fs from "node:fs";
const catalog=JSON.parse(fs.readFileSync(new URL("../tools/generated/template_voxels.json",import.meta.url),"utf8"));
const templates=new Map(catalog.map(t=>["secretfacilities:bunker/"+t.name,t]));
const xyz=p=>`${Math.floor(p.x)},${Math.floor(p.y)},${Math.floor(p.z)}`;
export const blocks=new Map(),properties=new Map(),players=[],entities=[],tasks=new Map(),explosions=[],particles=[];
// Terrain profile the site survey reads. Flat by default; tests override it to model slopes
// and standing water (the water surface y, or undefined for a dry column).
export const terrain={height:()=>80,water:()=>undefined};
const surface=(x,z)=>terrain.height(x,z);
/** The untouched world: grass on stone up to the terrain height, then any water, then air. */
const natural=(x,y,z)=>{const h=surface(x,z),w=terrain.water(x,z);
  return {typeId:y<h?"minecraft:stone":y===h?"minecraft:grass_block":w!==undefined&&y<=w?"minecraft:water":"minecraft:air",states:{}};};
export const blockAt=(x,y,z)=>blocks.get(xyz({x,y,z}))??natural(x,y,z);
let serial=0;
export const GameMode={Creative:"Creative",Survival:"Survival"};
export const EntityDamageCause={entityAttack:"entityAttack"};
export class ItemStack{constructor(typeId){this.typeId=typeId;}}
export class BlockVolume{constructor(a,b){this.a=a;this.b=b;}}
export class MolangVariableMap{constructor(){this.values={};}setFloat(k,v){this.values[k]=v;}setVector3(k,v){this.values[k]={...v};}}
export class BlockPermutation{static resolve(typeId,states={}){return {typeId,states};}}
export const dimension={
  id:"minecraft:overworld",
  getBlock(p){
    const loc={x:Math.floor(p.x),y:Math.floor(p.y),z:Math.floor(p.z)},entry=blockAt(loc.x,loc.y,loc.z);
    return {location:loc,typeId:entry.typeId,isAir:entry.typeId==="minecraft:air",isLiquid:entry.typeId==="minecraft:water",
      permutation:{getState(name){return entry.states?.[name];}},
      setPermutation(value){blocks.set(xyz(p),value);}};
  },
  fillBlocks(volume,block,options){
    const permutation=typeof block==="string"?{typeId:block,states:{}}:block,only=options?.blockFilter?.includeTypes;
    for(let x=volume.a.x;x<=volume.b.x;x++)for(let y=volume.a.y;y<=volume.b.y;y++)for(let z=volume.a.z;z<=volume.b.z;z++)
      if(!only||only.includes(blockAt(x,y,z).typeId))blocks.set(xyz({x,y,z}),permutation);
  },
  getTopmostBlock({x,z}){const h=surface(x,z),w=terrain.water(x,z);
    return w!==undefined&&w>h?{location:{x,y:w,z},typeId:"minecraft:water",isAir:false,isLiquid:true}:{location:{x,y:h,z},typeId:"minecraft:grass_block",isAir:false,isLiquid:false};},
  getEntities(options={}){return entities.filter(e=>(!options.type||e.typeId===options.type)&&(!options.tags||options.tags.every(t=>e.tags.includes(t)))&&(!options.maxDistance||Math.hypot(e.location.x-options.location.x,e.location.y-options.location.y,e.location.z-options.location.z)<=options.maxDistance));},
  spawnEntity(typeId,location,options){const e={id:`e${serial++}`,typeId,location,dimension:this,tags:[],isValid:true,props:new Map(),properties:new Map(),spawnEvent:options?.spawnEvent,
    addTag(tag){this.tags.push(tag);},getDynamicProperty(k){return this.props.get(k);},setDynamicProperty(k,v){this.props.set(k,v);},
    getComponent(){return undefined;},setRotation(v){this.rotation=v;},applyDamage(value){this.damage=(this.damage??0)+value;},
    getProperty(k){return this.properties.get(k);},setProperty(k,v){this.properties.set(k,v);},
    remove(){this.isValid=false;entities.splice(entities.indexOf(this),1);}};entities.push(e);return e;},
  spawnParticle(id,location,vars){particles.push({id,location,vars:vars?.values});},spawnItem(){},getBlockFromRay(){return undefined;},
  createExplosion(location,radius,options){explosions.push({location,radius,options});return true;},
};
const signal={subscribe(){}};
export const world={getDimension(){return dimension;},getAllPlayers(){return players;},getEntity(id){return entities.find(e=>e.id===id);},
  getDynamicProperty(k){return properties.get(k);},setDynamicProperty(k,v){properties.set(k,v);},
  afterEvents:{entityDie:signal,entityLoad:signal,worldLoad:signal},
  structureManager:{place(id,d,pos){
    const t=templates.get(id);if(!t)throw Error(`Unknown template ${id}`);let i=0;
    for(let x=0;x<t.size[0];x++)for(let y=0;y<t.size[1];y++)for(let z=0;z<t.size[2];z++){
      const [typeId,states]=t.palette[t.indices[i++]];blocks.set(xyz({x:pos.x+x,y:pos.y+y,z:pos.z+z}),{typeId,states});
    }
  }},
};
export const system={currentTick:0,runInterval(work){const id=serial++;tasks.set(id,work);return id;},clearRun(id){tasks.delete(id);},
  runTimeout(work){queueMicrotask(work);return serial++;},run(work){work();},beforeEvents:{startup:signal},afterEvents:{scriptEventReceive:signal}};
export function playerAt(location){return {id:"player1",typeId:"minecraft:player",isValid:true,location,dimension,
  getGameMode(){return GameMode.Creative;},sendMessage(){},playSound(){},onScreenDisplay:{setActionBar(){}},
  tryTeleport(target){this.location={...target};return true;},runCommand(){return {successCount:1};},
  camera:{fade(){}},
  getComponent(){return {container:{size:1,getItem(){return {typeId:"secretfacilities:keycard_master"};}}};}};}
export function finishBuild(){for(let i=0;i<1500&&tasks.size;i++){for(const work of [...tasks.values()])work();system.currentTick+=2;}if(tasks.size)throw Error("Build did not finish");}
export function reset(){blocks.clear();properties.clear();players.length=0;entities.length=0;tasks.clear();explosions.length=0;particles.length=0;system.currentTick=0;terrain.height=()=>80;terrain.water=()=>undefined;}
