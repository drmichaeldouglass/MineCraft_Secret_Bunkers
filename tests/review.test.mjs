import test from "node:test";
import assert from "node:assert/strict";
import { blocks, dimension, entities, playerAt, players, reset, tasks } from "./mock-server.mjs";
import { answers } from "./mock-ui.mjs";
import { planBunker } from "../behavior_pack/scripts/generation/planner.js";
import { build } from "../behavior_pack/scripts/runtime/generation.js";
import { debug, deployment } from "../behavior_pack/scripts/runtime/menus.js";
import { facilities, load, save } from "../behavior_pack/scripts/runtime/store.js";
import { requestDoor, restoreDoors, tickDoors, travel } from "../behavior_pack/scripts/runtime/security.js";

const ns="secretfacilities:";
function setup(){
  reset();facilities.clear();answers.length=0;
  const f=planBunker({x:0,y:80,z:0},3,10,false,"review",{kind:"rock_face"});
  const p=playerAt({x:13,y:81,z:-10});players.push(p);return {f,p};
}
test("deployment confirmation rejects a dimension change at the same coordinates",async()=>{
  const {p}=setup();
  answers.push({selection:0},{formValues:[0,false,6,"10"]},()=>{
    p.dimension={...dimension,id:"minecraft:the_nether"};return {selection:1};
  });
  await assert.rejects(deployment(p),/dimension|site/i);
  assert.equal(facilities.size,0);assert.equal(tasks.size,0);assert.equal(blocks.size,0);
});
test("resuming construction also requires the player to be in the facility dimension",()=>{
  const {f,p}=setup();f.phase="failed";p.dimension={...dimension,id:"minecraft:the_nether"};
  assert.throws(()=>build(f,p),/dimension/i);
  assert.equal(f.phase,"failed");assert.equal(facilities.size,0);assert.equal(tasks.size,0);
});
test("debug menu cannot apply changes after moving away from the facility",async()=>{
  const {f,p}=setup();f.phase="ready";facilities.set(f.id,f);
  answers.push(()=>{p.location={x:1000,y:81,z:1000};return {selection:6};});
  const before=JSON.stringify(f.zones);
  await assert.rejects(debug(p),/Return|facility/i);
  assert.equal(JSON.stringify(f.zones),before);
});
test("restoring a pending closure never repaints solid doors around an occupant",()=>{
  for(const kind of ["security","blast","shutter"]){
    const {f,p}=setup();f.phase="ready";facilities.set(f.id,f);
    const door=f.doors.find(d=>d.kind===kind);f.doors=[door];door.open=true;
    p.location={...door.min};
    entities.push({id:"occupant",typeId:"minecraft:cow",location:{...door.min},tags:[],isValid:true});
    requestDoor(f,door,false);tickDoors();save(f);facilities.clear();load();
    const restored=facilities.get(f.id);restoreDoors(restored);tickDoors();
    assert.equal(blocks.get(`${door.min.x},${door.min.y},${door.min.z}`).states[ns+"open"],true,kind);
    for(let i=0;i<5;i++)tickDoors();
    assert.equal(blocks.get(`${door.min.x},${door.min.y},${door.min.z}`).states[ns+"open"],true,kind);
    entities.length=0;p.location={x:13,y:81,z:-10};
    for(let i=0;i<travel(door)+5;i++)tickDoors();
    assert.equal(blocks.get(`${door.min.x},${door.min.y},${door.min.z}`).states[ns+"open"],false,kind);
  }
});
