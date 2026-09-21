import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { blocks, dimension, entities, finishBuild, playerAt, players, properties, reset, system } from "./mock-server.mjs";
import { planBunker } from "../behavior_pack/scripts/generation/planner.js";
import { facilities, load, mark, save } from "../behavior_pack/scripts/runtime/store.js";
import { build } from "../behavior_pack/scripts/runtime/generation.js";
import { armDestruct, abortDestruct, requestDoor, setSecurity, tickAlarms, tickDoors } from "../behavior_pack/scripts/runtime/security.js";
import { tickDefence } from "../behavior_pack/scripts/runtime/defence.js";
const ns="secretfacilities:",at=(x,y,z)=>blocks.get(`${x},${y},${z}`);
const passable=b=>b&&(b.typeId==="minecraft:air"||b.typeId==="minecraft:ladder"||b.states[ns+"open"]===true);
function flood(y,start,bounds={x0:0,x1:64,z0:0,z1:53}){
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
  const p=playerAt({x:32,y:81,z:-10});players.push(p);build(f,p);finishBuild();assert.equal(f.phase,"ready");
  return {f,p};
}
test("assembled voxel navigation for 3, 5 and 8 floor bunkers",()=>{
  for(const levels of [3,5,8]){
    const {f}=make(levels,42+levels);
    // Walkable room doors are open initially, not just connected abstractly.
    for(const floor of f.floors.slice(1)){
      const seen=flood(floor.y+1,[32,19]);
      for(const module of f.modules.filter(m=>m.pos.y===floor.y))
        assert.ok(seen.has(`${module.pos.x+6},${module.pos.z+6}`),`${levels} floors: cannot reach ${module.template} at ${JSON.stringify(module.pos)}`);
      for(const door of f.doors.filter(d=>d.min.y===floor.y+1))for(const reader of door.readers)
        assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>seen.has(`${reader.x+dx},${reader.z+dz}`)),`Reader inaccessible at ${JSON.stringify(reader)}`);
      assert.ok(seen.has("35,22"),"Emergency ladder approach disconnected");
    }
    const escape=flood(f.floors[1].y+1,[32,19]);assert.ok(escape.has("32,50"),"B1 escape tunnel blocked");
    for(let y=f.floors.at(-1).y+1;y<=85;y++){
      assert.equal(at(36,y,22).typeId,"minecraft:ladder");assert.equal(at(37,y,22).typeId,ns+"steel_wall");
    }
    const main=f.doors[0],bounds={x0:22,x1:42,z0:-6,z1:25};
    assert.equal(flood(81,[32,-3],bounds).has("32,19"),false,"Closed blast door can be bypassed");
    requestDoor(f,main,true);for(let n=0;n<20;n++)tickDoors();
    assert.ok(flood(81,[32,-3],bounds).has("32,19"),"Open entrance does not connect to elevator");
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
  entities.pop();for(let n=0;n<10;n++)tickDoors();assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],false);
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
