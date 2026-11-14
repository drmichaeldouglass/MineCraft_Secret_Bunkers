import test from "node:test";
import assert from "node:assert/strict";
import { blocks, commands, dimension, entities, GameMode, playerAt, players, properties, reset, tasks } from "./mock-server.mjs";
import { answers } from "./mock-ui.mjs";
import { planBunker } from "../behavior_pack/scripts/generation/planner.js";
import { build, holdSite, releaseStaleSites, siteAnchor } from "../behavior_pack/scripts/runtime/generation.js";
import { debug, deployment } from "../behavior_pack/scripts/runtime/menus.js";
import { facilities, interrupted, load, save } from "../behavior_pack/scripts/runtime/store.js";
import { requestDoor, restoreDoors, setSecurity, tickDoors, tickLasers, travel } from "../behavior_pack/scripts/runtime/security.js";

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
test("ticking areas left by a deployment the world closed on are released when it next loads",async()=>{
  const removed=()=>commands.filter(c=>c.startsWith("tickingarea remove"));
  // The world closes while the confirmation form is open: nothing was registered, only the areas remain.
  const {f,p}=setup();
  await holdSite(dimension,"orphan",f.type,siteAnchor(p,f.type),p);
  assert.equal(removed().length,0);
  commands.length=0;load();releaseStaleSites(interrupted);
  assert.deepEqual(removed(),["tickingarea remove orphan_0","tickingarea remove orphan_1"]);
  // Once released they are forgotten, and a deployment that ended normally is never on the list.
  commands.length=0;releaseStaleSites();assert.equal(removed().length,0);
  // The world closes during construction, in a save made before held sites were listed.
  build(f,p);properties.delete(ns+"held");facilities.clear();tasks.clear();commands.length=0;
  load();assert.equal(facilities.get(f.id).phase,"failed");releaseStaleSites(interrupted);
  assert.deepEqual(removed(),["tickingarea remove review_0","tickingarea remove review_1"]);
});
test("a blast door already where it is asked to be gives no warning",()=>{
  const {f,p}=setup();f.phase="ready";facilities.set(f.id,f);
  const played=[];p.playSound=id=>played.push(id);
  const warnings=()=>played.filter(id=>id===ns+"blast_door_warning").length;
  // The entrance is shut already, so an alert moves nothing there.
  setSecurity(f,"ALERT");assert.equal(warnings(),0);
  const door=f.doors.find(d=>d.kind==="blast");
  requestDoor(f,door,true);assert.equal(warnings(),1);
  // Reversing mid-slide is a movement too.
  for(let i=0;i<5;i++)tickDoors();
  requestDoor(f,door,false);assert.equal(warnings(),2);
});
test("spectators neither trip laser grids nor hold doors open",()=>{
  const {f,p}=setup();f.phase="ready";facilities.set(f.id,f);
  p.getComponent=()=>({container:{size:0,getItem(){}}});
  const laser=f.lasers[0],mid={x:laser.a.x,y:Math.floor(laser.a.y),z:(laser.a.z+laser.b.z)/2};
  p.location=mid;p.getGameMode=()=>GameMode.Spectator;
  tickLasers();assert.equal(f.state,"NORMAL");
  const door=f.doors.find(d=>d.kind==="security");
  entities.push({...p,id:"ghost",location:{...door.min},tags:[]});
  requestDoor(f,door,false);for(let i=0;i<travel(door)+2;i++)tickDoors();
  assert.equal(blocks.get(`${door.min.x},${door.min.y},${door.min.z}`).states[ns+"open"],false);
  entities.length=0;
  p.getGameMode=()=>GameMode.Survival;
  tickLasers();assert.equal(f.state,"ALERT");
});
