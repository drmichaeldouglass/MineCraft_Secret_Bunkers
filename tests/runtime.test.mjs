import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { blocks, dimension, entities, finishBuild, playerAt, players, properties, reset, system, terrain } from "./mock-server.mjs";
import { planBunker } from "../behavior_pack/scripts/generation/planner.js";
import { facilities, load, mark, save } from "../behavior_pack/scripts/runtime/store.js";
import { build, originAt } from "../behavior_pack/scripts/runtime/generation.js";
import { armDestruct, abortDestruct, ease, LEAF, requestDoor, restoreDoors, setSecurity, SUBSTEPS, tickAlarms, tickDoors } from "../behavior_pack/scripts/runtime/security.js";
import { tickDefence } from "../behavior_pack/scripts/runtime/defence.js";
const ns="secretfacilities:",at=(x,y,z)=>blocks.get(`${x},${y},${z}`);
const passable=b=>b&&(b.typeId==="minecraft:air"||b.typeId==="minecraft:ladder"||b.states[ns+"open"]===true);
function flood(y,start,bounds={x0:0,x1:26,z0:-4,z1:37}){
  const todo=[start],seen=new Set([start.join(",")]);
  for(let i=0;i<todo.length;i++){
    const [x,z]=todo[i];
    for(const [a,b] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
      const key=`${a},${b}`;
      if(a<bounds.x0||a>bounds.x1||b<bounds.z0||b>bounds.z1||seen.has(key))continue;
      if(passable(at(a,y,b))&&passable(at(a,y+1,b))){seen.add(key);todo.push([a,b]);}
    }
  }
  return seen;
}
function make(levels=5,seed=10){
  reset();facilities.clear();const f=planBunker({x:0,y:80,z:0},levels,seed,true,"test");
  const p=playerAt({x:13,y:81,z:-10});players.push(p);build(f,p);finishBuild();assert.equal(f.phase,"ready");
  return {f,p};
}
test("assembled voxel navigation for 3, 5 and 8 floor bunkers",()=>{
  for(const levels of [3,5,8]){
    const {f}=make(levels,42+levels);
    // Walkable room doors are open initially, not just connected abstractly.
    for(const floor of f.floors.slice(1)){
      const seen=flood(floor.y+1,[13,13]);
      for(const module of f.modules.filter(m=>m.pos.y===floor.y))
        assert.ok(seen.has(`${module.pos.x+4},${module.pos.z+4}`),`${levels} floors: cannot reach ${module.template} at ${JSON.stringify(module.pos)}`);
      for(const door of f.doors.filter(d=>d.min.y===floor.y+1))for(const reader of door.readers)
        assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>seen.has(`${reader.x+dx},${reader.z+dz}`)),`Reader inaccessible at ${JSON.stringify(reader)}`);
      assert.ok(seen.has("14,16"),"Emergency ladder approach disconnected");
    }
    const escape=flood(f.floors[1].y+1,[13,13]);assert.ok(escape.has("13,34"),"B1 escape tunnel blocked");
    // Only the ladder itself may pierce a floor; any open column beside it is a drop to the bottom.
    for(const floor of f.floors)assert.notEqual(at(14,floor.y,16).typeId,"minecraft:air",`Open drop beside the ladder at Y ${floor.y}`);
    // The escape ladder must land players on a hut floor that leads to its exit.
    const hut=f.origin.y;
    for(let x=12;x<=14;x++)for(let z=33;z<=35;z++)if(x!==13||z!==35)
      assert.notEqual(at(x,hut,z).typeId,"minecraft:air",`Escape hut floor open at ${x},${hut},${z}`);
    assert.equal(at(13,hut,35).typeId,"minecraft:ladder","Escape ladder does not reach the hut");
    assert.ok(flood(hut+1,[13,34],{x0:12,x1:14,z0:32,z1:35}).has("13,32"),"Escape hut exit unreachable");
    for(let y=f.floors.at(-1).y+1;y<=85;y++){
      assert.equal(at(15,y,16).typeId,"minecraft:ladder");assert.equal(at(16,y,16).typeId,ns+"steel_wall");
    }
    const main=f.doors[0],bounds={x0:6,x1:20,z0:-4,z1:17};
    assert.equal(flood(81,[13,-2],bounds).has("13,13"),false,"Closed blast door can be bypassed");
    requestDoor(f,main,true);for(let n=0;n<40;n++)tickDoors();
    assert.ok(flood(81,[13,-2],bounds).has("13,13"),"Open entrance does not connect to elevator");
  }
});
test("the site survey refuses slopes and water, and rock encases every slab",()=>{
  // A site that is not level is what leaves floors exposed through a hillside.
  reset();facilities.clear();
  const site=()=>{const p=playerAt({x:100,y:81,z:200});players.length=0;players.push(p);return p;};
  assert.ok(originAt(site()),"flat ground must be accepted");
  terrain.height=x=>80+Math.round((x-87)*0.7);
  assert.throws(()=>originAt(site()),/rises and falls/,"a hillside must be refused");
  // Level footprint, but a rise behind it would bury the escape hut's exit.
  terrain.height=(x,z)=>z>=240?90:80;
  assert.throws(()=>originAt(site()),/rises and falls/,"a rise over the escape hut must be refused");
  terrain.height=()=>80;
  const {f}=make(5);
  // The outer skin of the underground footprint must be solid. The only permitted openings
  // are the rear escape tunnel mouth and the emergency ladder shaft.
  const open=[];
  for(let y=f.floors.at(-1).y;y<=f.origin.y-1;y++)for(let x=0;x<=26;x++)for(let z=0;z<=26;z++){
    if(x!==0&&x!==26&&z!==0&&z!==26)continue;
    const b=at(x,y,z);if(!b||b.typeId==="minecraft:air")open.push(`${x},${y},${z}`);
  }
  assert.ok(open.every(k=>k.startsWith("12,")||k.startsWith("13,")||k.startsWith("14,")),
    `Unexpected hole in the encasement: ${open.slice(0,5)}`);
  // The emergency ladder passes through each slab as ladder blocks, not open air.
  for(const floor of f.floors.slice(1))for(let x=0;x<=26;x++)for(let z=0;z<=26;z++){
    for(const y of [floor.y+7,floor.y+8])
      assert.notEqual(at(x,y,z)?.typeId,"minecraft:air",`Inter-floor slab open at ${x},${y},${z}`);
  }
});
test("snapshot persistence round trips large facilities and interrupted builds",()=>{
  const {f}=make(8);f.zones.command="OFFLINE";f.doors[3].open=false;f.turrets[0].damaged=true;
  f.countdown=33;f.state="SELF_DESTRUCT";mark(f);save(f);
  const original=JSON.stringify(f);facilities.clear();load();assert.equal(JSON.stringify(facilities.get("test")),original);
  const saved=facilities.get("test");saved.phase="building";save(saved);facilities.clear();load();assert.equal(facilities.get("test").phase,"failed");
  for(const value of properties.values())if(typeof value==="string")assert.ok(Buffer.byteLength(value,"utf8")<32767,"Dynamic property exceeds Bedrock limit");
});
test("lockdown closes doors and shutters; normal releases shutters",()=>{
  const {f}=make();setSecurity(f,"LOCKDOWN");assert.ok(f.doors.every(d=>!d.open));
  for(let n=0;n<100;n++)tickDoors();
  for(const door of f.doors)assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],false);
  setSecurity(f,"NORMAL");assert.ok(f.doors.filter(d=>d.kind==="shutter").every(d=>d.open));
});
test("door obstruction delays closure without trapping entities",()=>{
  const {f}=make(),door=f.doors.find(d=>d.kind==="security");
  entities.push({id:"obstruction",typeId:"minecraft:cow",location:{...door.min},tags:[],isValid:true});
  requestDoor(f,door,false);tickDoors();assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],true);
  entities.pop();for(let n=0;n<40;n++)tickDoors();assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],false);
});
test("room doors retract in two-pixel steps rather than popping open",()=>{
  const {f}=make(3),door=f.doors.find(d=>d.kind==="security"),height=door.max.y-door.min.y+1;
  const column=()=>[...Array(height).keys()].map(r=>{
    const b=at(door.min.x+1,door.min.y+r,door.min.z);
    return b.states[ns+"open"]===true?"open":String(b.states[ns+"slide"]);
  }).join("|");
  requestDoor(f,door,false);for(let n=0;n<height*SUBSTEPS+4;n++)tickDoors();
  assert.equal(column(),new Array(height).fill("0").join("|"),"Should close to a solid leaf");
  requestDoor(f,door,true);
  const frames=[];for(let n=0;n<height*SUBSTEPS+4;n++){frames.push(column());tickDoors();}
  // One frame per tick, eight per block of height, so the leaf lifts two pixels at a time.
  assert.ok(new Set(frames).size>=height*SUBSTEPS,`Only ${new Set(frames).size} distinct frames for a ${height}-block door`);
  assert.ok(frames.some(k=>/(^|\|)7(\||$)/.test(k)),"The finest partial-slide frame was never shown");
  assert.equal(column(),new Array(height).fill("open").join("|"),"Should finish fully open");
});
test("the blast door slides as one smooth leaf and leaves nothing behind",()=>{
  const {f}=make(3),door=f.doors[0],height=door.max.y-door.min.y+1,steps=height*SUBSTEPS,tag=`sf_door:${f.id}:${door.id}`;
  // The leaf model in tools/build_assets.py is built for exactly this door.
  assert.deepEqual([door.max.x-door.min.x+1,height,door.max.z-door.min.z+1],[5,4,1]);
  const leaves=()=>entities.filter(e=>e.typeId===LEAF);
  const rows=()=>[...Array(height).keys()].map(r=>at(door.min.x+2,door.min.y+r,door.min.z).states[ns+"open"]);
  const anchor=()=>[leaves()[0].getProperty(ns+"phase"),leaves()[0].getProperty(ns+"motion")];
  requestDoor(f,door,true);tickDoors();
  // The leaf arrives one tick before any block is cleared, so the doorway never flashes open.
  assert.equal(leaves().length,1);assert.deepEqual(rows(),new Array(height).fill(false));
  assert.ok(leaves()[0].tags.includes(tag));assert.equal(leaves()[0].spawnEvent,undefined);
  assert.deepEqual(anchor(),[0,1],"The leaf is told once where it starts and which way it goes");
  const cleared=[];
  for(let n=1;n<=steps;n++){
    tickDoors();
    // The client animates on its own clock; per-tick updates would bring back the stutter.
    assert.deepEqual(anchor(),[0,1],"The leaf must not be re-synced mid-slide");
    // Courses the eased leaf has begun to leave are cleared; courses it still covers stay solid.
    const lifted=ease(n/steps)*height;
    assert.deepEqual(rows(),[...Array(height).keys()].map(r=>r<lifted),`Blocks disagree with the leaf at step ${n}`);
    cleared.push(rows().filter(Boolean).length);
  }
  // Eased: the first and last courses take longer to clear than the middle ones.
  const tick=row=>cleared.findIndex(c=>c>row);
  assert.ok(tick(1)-tick(0)>tick(2)-tick(1),"The leaf should accelerate away from rest");
  tickDoors();assert.equal(leaves().length,0,"The leaf must be removed once the door is open");
  assert.deepEqual(rows(),new Array(height).fill(true));
  // Closing starts from the top, is paused by an entity in the doorway, then resumes.
  requestDoor(f,door,false);tickDoors();
  assert.equal(leaves()[0].spawnEvent,ns+"from_open","A closing leaf must start fully raised");
  for(let n=0;n<8;n++)tickDoors();
  const cow={id:"cow",typeId:"minecraft:cow",location:{...door.min},tags:[],isValid:true};entities.push(cow);
  const held=rows();for(let n=0;n<10;n++)tickDoors();
  assert.deepEqual(rows(),held,"The door must hold while the doorway is obstructed");
  assert.deepEqual(anchor(),[1-8/steps,0],"The client leaf must stop where the door stopped");
  entities.splice(entities.indexOf(cow),1);tickDoors();
  assert.deepEqual(anchor(),[1-8/steps,-1],"The client leaf must resume from where it stopped");
  for(let n=0;n<steps;n++)tickDoors();
  assert.deepEqual(rows(),new Array(height).fill(false));assert.equal(leaves().length,0);
  // A leaf stranded by a reload mid-slide is cleared when the door is restored.
  dimension.spawnEntity(LEAF,{...door.min}).addTag(tag);
  restoreDoors(f);tickDoors();assert.equal(leaves().length,0,"Stale leaf survived a restore");
});
test("a blast door reversed mid-slide turns back from where its leaf is",()=>{
  const {f}=make(3),door=f.doors[0],steps=(door.max.y-door.min.y+1)*SUBSTEPS;
  const leaf=()=>entities.find(e=>e.typeId===LEAF);
  requestDoor(f,door,true);for(let n=0;n<=12;n++)tickDoors();
  const id=leaf().id;requestDoor(f,door,false);tickDoors();
  assert.equal(leaf().id,id,"Reversing must keep the same leaf");
  assert.deepEqual([leaf().getProperty(ns+"phase"),leaf().getProperty(ns+"motion")],[12/steps,-1]);
  for(let n=0;n<=13;n++)tickDoors();
  assert.equal(leaf(),undefined);assert.ok(!door.open);
  assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],false);
});
test("self-destruct abort cutoff and permanent bounded damage",()=>{
  const {f}=make(3);armDestruct(f);assert.equal(f.countdown,90);assert.ok(f.doors.every(d=>d.open));
  assert.equal(abortDestruct(f),true);armDestruct(f);f.countdown=10;assert.equal(abortDestruct(f),false);
  for(let i=0;i<40;i++){system.currentTick+=10;tickAlarms();}
  assert.equal(f.state,"DESTROYED");assert.ok(f.turrets.every(t=>t.damaged&&!t.enabled));
  setSecurity(f,"NORMAL");assert.equal(f.state,"DESTROYED");
  assert.ok([...blocks.values()].some(b=>b.typeId===ns+"damaged_panel"));
});
test("turret target selection, cooldown, line-of-sight and disabled state",()=>{
  const {f}=make(3),turret=f.turrets[0],source=turret.pos;
  const cow=dimension.spawnEntity("minecraft:cow",{x:source.x,y:source.y,z:source.z-3});
  const player=dimension.spawnEntity("minecraft:player",{x:source.x,y:source.y,z:source.z-4});
  const zombie=dimension.spawnEntity("minecraft:zombie",{x:source.x,y:source.y,z:source.z-6});
  for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}
  assert.ok(zombie.damage>0);assert.equal(cow.damage,undefined);assert.equal(player.damage,undefined);
  const before=zombie.damage;f.zones.entrance="OFFLINE";
  for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}assert.equal(zombie.damage,before);
  f.zones.entrance="ACTIVE";const ray=dimension.getBlockFromRay;dimension.getBlockFromRay=()=>({block:{}});
  for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}assert.equal(zombie.damage,before);
  dimension.getBlockFromRay=ray;
});
test("write inspectable first-floor voxel preview",()=>{
  const {f}=make(5,104729);
  fs.mkdirSync(new URL("../docs/generated/",import.meta.url),{recursive:true});
  fs.writeFileSync(new URL("../docs/generated/bunker-preview.json",import.meta.url),JSON.stringify({facility:f,blocks:[...blocks]}));
});
