import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { blockAt, blocks, commands, dimension, entities, explosions, finishBuild, particles, playerAt, players, properties, reset, sounds, system, terrain } from "./mock-server.mjs";
import { ARMOURY_DOOR, MATERIALS, PIECES, planArmoury, SLOTS, standTag, TRIMS } from "../behavior_pack/scripts/generation/armoury.js";
import { planBunker } from "../behavior_pack/scripts/generation/planner.js";
import { facilities, levelGrids, load, mark, save } from "../behavior_pack/scripts/runtime/store.js";
import { build, estateOriginAt, exitSite, FORECOURT, MAX_CUT, MAX_FILL, originAt } from "../behavior_pack/scripts/runtime/generation.js";
import { COMPOUND, ESTATE_PAD, planEstate, TOWERS, WALL_HEIGHT } from "../behavior_pack/scripts/generation/estate.js";
import { armDestruct, abortDestruct, BEAM_DAMAGE, ease, LEAF, requestDoor, restoreDoors, setSecurity, slid, SUBSTEPS, tickAlarms, tickDoors, tickLasers, travel } from "../behavior_pack/scripts/runtime/security.js";
import { ARMOURY, column, MOUNTAIN, rearExit } from "../behavior_pack/scripts/generation/mountain.js";
import { EXITS, REMOTE, SITE } from "../behavior_pack/scripts/generation/tunnel.js";
import { tickDefence } from "../behavior_pack/scripts/runtime/defence.js";
import { MISSILE, tickMissiles, tickPlaced } from "../behavior_pack/scripts/runtime/placed.js";
const ns="secretfacilities:",at=(x,y,z)=>blocks.get(`${x},${y},${z}`);
// Rails and carpets are walked over, not into.
const passable=b=>b&&(["minecraft:air","minecraft:ladder","minecraft:rail"].includes(b.typeId)||b.typeId.endsWith("_carpet")||b.states[ns+"open"]===true);
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
function make(levels=5,seed=10,site){
  reset();facilities.clear();const f=planBunker({x:0,y:80,z:0},levels,seed,true,"test",site);
  const p=playerAt({x:13,y:81,z:-10});players.push(p);
  // Door jobs are module-wide and keyed by facility id, and every test reuses "test". Let any an
  // earlier test left running finish now, in the empty world the build is about to overwrite.
  for(let n=0;n<400;n++)tickDoors();
  build(f,p);finishBuild();assert.equal(f.phase,"ready");
  return {f,p};
}
/** Walk the secret tunnel from the B1 core to its exit, climb the ladder, and step out onto open ground. */
function escapes(f,from=[13,13]){
  const e=f.exit,l=e.ladder,tunnel=f.floors[1].y+1,label=`${e.kind} ${e.heading??""}`;
  const o=f.origin,reach=flood(tunnel,[o.x+from[0],o.z+from[1]],{x0:o.x-60,x1:o.x+90,z0:o.z-4,z1:o.z+90});
  assert.ok(reach.has(`${l.x},${l.z}`),`${label}: the tunnel does not lead from the core to the exit ladder`);
  // One ladder, hung on solid wall the whole way, from the tunnel floor to the exit.
  const top=l.y+EXITS[e.kind].ladderTop,back={2:[0,1],3:[0,-1],4:[1,0],5:[-1,0]}[e.facing];
  for(let y=tunnel;y<=top;y++){
    assert.equal(at(l.x,y,l.z)?.typeId,"minecraft:ladder",`${label}: ladder missing at ${l.x},${y},${l.z}`);
    assert.deepEqual(at(l.x,y,l.z).states,{facing_direction:e.facing});
    assert.ok(!["minecraft:air",undefined].includes(blockAt(l.x+back[0],y,l.z+back[1]).typeId),`${label}: ladder unsupported at Y ${y}`);
  }
  // A player at the top of the ladder can walk out of the exit's footprint. A hatch is opened first.
  const open=b=>passable(b)||b?.typeId==="minecraft:spruce_trapdoor";
  const feet=(x,z)=>e.kind==="well"&&Math.abs(x-l.x)<=1&&Math.abs(z-l.z)<=1?top+1:l.y+1;
  const todo=[[l.x,l.z]],seen=new Set([`${l.x},${l.z}`]);let out=false;
  while(todo.length&&!out){
    const [x,z]=todo.pop();
    for(const [a,b] of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]]){
      if(seen.has(`${a},${b}`))continue;
      const y=feet(a,b);if(!open(blockAt(a,y,b))||!open(blockAt(a,y+1,b)))continue;
      if(Math.abs(a-l.x)>3||Math.abs(b-l.z)>3){out=true;break;}
      seen.add(`${a},${b}`);todo.push([a,b]);
    }
  }
  assert.ok(out,`${label}: no way out of the exit at the top of the ladder`);
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
    escapes(f);
    // Only the ladder itself may pierce a floor; any open column beside it is a drop to the bottom.
    for(const floor of f.floors)assert.notEqual(at(14,floor.y,16).typeId,"minecraft:air",`Open drop beside the ladder at Y ${floor.y}`);
    for(let y=f.floors.at(-1).y+1;y<=85;y++){
      assert.equal(at(15,y,16).typeId,"minecraft:ladder");assert.equal(at(16,y,16).typeId,ns+"steel_wall");
    }
    const main=f.doors[0],bounds={x0:6,x1:20,z0:-4,z1:17};
    assert.equal(flood(81,[13,-2],bounds).has("13,13"),false,"Closed blast door can be bypassed");
    requestDoor(f,main,true);for(let n=0;n<40;n++)tickDoors();
    assert.ok(flood(81,[13,-2],bounds).has("13,13"),"Open entrance does not connect to elevator");
  }
});
test("uneven sites are levelled instead of refused, within limits",()=>{
  reset();facilities.clear();
  const site=()=>{const p=playerAt({x:100,y:81,z:200});players.length=0;players.push(p);return p;};
  let s=originAt(site());
  assert.deepEqual([s.origin.y,s.cut,s.fill,s.ground],[80,0,0,"minecraft:grass_block"],"flat ground needs no earthworks");
  // A hillside the old five-block rule refused: about 18 blocks from one side to the other.
  terrain.height=x=>80+Math.round((x-100)*0.7);
  s=originAt(site());
  assert.equal(s.origin.y,80,"The pad stays at the entrance ground when it can");
  assert.ok(s.cut>5&&s.fill>5&&s.cut<=MAX_CUT&&s.fill<=MAX_FILL,`cut ${s.cut}, fill ${s.fill}`);
  const f=planBunker(s.origin,3,10,true,"hill",exitSite(dimension,s.origin,10));f.ground=s.ground;build(f,site());finishBuild();
  assert.equal(f.phase,"ready");assert.notEqual(f.exit.kind,"rock_face","A gentle hillside has room for a remote exit");
  escapes(f);
  const o=f.origin,rel=(x,y,z)=>blockAt(o.x+x,o.y+y,o.z+z).typeId;
  // Structures that stand above the pad: entrance, armoury and ladder shaft.
  const built=(x,z)=>(x>=6&&x<=20&&z>=-4&&z<=17)||(x>=ARMOURY.x0&&x<=ARMOURY.x1&&z>=ARMOURY.z0&&z<=ARMOURY.z1)||(x>=15&&x<=16&&z===16);
  const tunnel=(x,z)=>f.exit.passages.some(({lining:b})=>o.x+x>=b.min.x&&o.x+x<=b.max.x&&o.z+z>=b.min.z&&o.z+z<=b.max.z);
  for(let x=-2;x<=28;x++)for(let z=-6;z<=39;z++){
    if(built(x,z))continue;
    assert.notEqual(rel(x,0,z),"minecraft:air",`No pad surface at ${x},${z}`);
    // The old hill is gone: what stands on the pad now is the mountain, solid to its surface.
    const top=column(f.seed,x,z,rearExit(f),true).top;
    for(let y=1;y<=top;y++)assert.notEqual(rel(x,y,z),"minecraft:air",`Hollow in the mountain at ${x},${y},${z}`);
    for(let y=top+1;y<=top+MAX_CUT;y++)assert.equal(rel(x,y,z),"minecraft:air",`Hill left standing at ${x},${y},${z}`);
    // Beside the rooms and escape tunnel, nothing under the pad may be left hollow.
    if((x>=0&&x<=26&&z>=0&&z<=26)||tunnel(x,z))continue;
    for(let y=-MAX_FILL;y<0;y++)assert.notEqual(rel(x,y,z),"minecraft:air",`Hole left under the pad at ${x},${y},${z}`);
  }
  assert.equal(rel(0,-1,-6),"minecraft:dirt","The low side is backfilled with earth");
  assert.equal(column(f.seed,28,-6).top,0);
  assert.equal(rel(28,0,-6),"minecraft:grass_block","The cut side gets a fresh surface");
  // Too steep to level either way.
  reset();facilities.clear();
  terrain.height=x=>80+Math.round((x-100)*1.2);
  assert.throws(()=>originAt(site()),/rises and falls/,"a cliff must be refused");
  // A steep site whose entrance is on the low side is raised to a level the earthworks can reach.
  terrain.height=x=>x<100?80:80+Math.round((x-100)*1.4);
  s=originAt(site());assert.equal(s.cut,MAX_CUT);assert.ok(s.origin.y>80);
  // Water level with the pad is filled; water standing above it would flood the entrance.
  terrain.height=x=>x>=105?74:80;terrain.water=x=>x>=105?80:undefined;
  s=originAt(site());assert.deepEqual([s.origin.y,s.fill],[80,6]);
  const lake=planBunker(s.origin,3,10,true,"lake",exitSite(dimension,s.origin,10));lake.ground=s.ground;build(lake,site());finishBuild();
  assert.ok(["south","west"].includes(lake.exit.heading),`The exit must stay out of the lake, not go ${lake.exit.heading}`);
  escapes(lake);
  assert.ok(!["minecraft:air","minecraft:water"].includes(blockAt(lake.origin.x+27,77,lake.origin.z+26).typeId),"The bunker wall on the lake side is exposed");
  assert.equal(blockAt(lake.origin.x+28,77,lake.origin.z+30).typeId,"minecraft:dirt","Lake water under the pad is filled");
  reset();facilities.clear();
  terrain.height=(x,z)=>z>=235?78:80;terrain.water=(x,z)=>z>=235?82:undefined;
  assert.throws(()=>originAt(site()),/flood/,"water above the pad must be refused");
  terrain.water=()=>undefined;
  // A rise behind the footprint is cut back so the rock-face exit's hut stays open.
  terrain.height=(x,z)=>z>=240?90:80;
  s=originAt(site());assert.equal(s.cut,10);
  const hut=planBunker(s.origin,3,10,true,"hut",{kind:"rock_face"});hut.ground=s.ground;build(hut,site());finishBuild();
  for(const z of [36,37,38,39])for(const y of [1,2])
    assert.equal(blockAt(hut.origin.x+13,hut.origin.y+y,hut.origin.z+z).typeId,"minecraft:air","Hut exit buried");
});
test("rock encases every slab",()=>{
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
test("a lowered shutter seals the hall from floor to ceiling",()=>{
  const {f}=make();setSecurity(f,"LOCKDOWN");for(let n=0;n<200;n++)tickDoors();
  for(const [i,floor] of f.floors.slice(1).entries()){
    const shutter=f.doors.find(d=>d.id===`shutter_${i}`);
    // Every block of the corridor's cross-section at the shutter must be closed steel: no gap for
    // a small mob underneath, and none above for a player to climb over.
    for(let y=floor.y+1;y<=floor.y+6;y++)for(let z=11;z<=15;z++){
      const b=at(shutter.min.x,y,z);
      assert.ok(b&&b.typeId!=="minecraft:air"&&b.states[ns+"open"]!==true,`B${i+1} shutter leaves a gap at ${shutter.min.x},${y},${z}`);
    }
  }
});
test("older saves with two-course shutters are grown to full height on load",()=>{
  const {f}=make(3);
  for(const door of f.doors)if(door.kind==="shutter"){door.min.y+=1;door.max.y-=2;}
  save(f);facilities.clear();load();
  const loaded=facilities.get(f.id);
  for(const [i,floor] of loaded.floors.slice(1).entries()){
    const shutter=loaded.doors.find(d=>d.id===`shutter_${i}`);
    assert.deepEqual([shutter.min.y,shutter.max.y],[floor.y+1,floor.y+5]);
  }
});
test("door obstruction delays closure without trapping entities",()=>{
  const {f}=make(),door=f.doors.find(d=>d.kind==="security");
  entities.push({id:"obstruction",typeId:"minecraft:cow",location:{...door.min},tags:[],isValid:true});
  requestDoor(f,door,false);tickDoors();assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],true);
  entities.pop();for(let n=0;n<40;n++)tickDoors();assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],false);
});
test("dropped items and spent arrows in a doorway do not hold the door open",()=>{
  const {f}=make(),door=f.doors.find(d=>d.kind==="security");
  for(const typeId of ["minecraft:item","minecraft:xp_orb","minecraft:arrow"])
    entities.push({id:typeId,typeId,location:{x:door.min.x+0.5,y:door.min.y,z:door.min.z+0.5},tags:[],isValid:true});
  requestDoor(f,door,false);for(let n=0;n<40;n++)tickDoors();
  assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],false,"Loose debris kept the door from closing");
  entities.length=0;
});
test("laser grids catch a player walking through, not one teleporting past",()=>{
  const {f}=make(3),floor=f.floors[1],y=floor.y+1;
  const intruder=playerAt({x:4.5,y,z:11.8});intruder.id="intruder";
  intruder.getComponent=()=>({container:{size:0,getItem(){}}});
  players.length=0;players.push(intruder);
  // One sensor tick to learn where the player stands, then a long jump across the grid.
  tickLasers();intruder.location={x:4.5,y,z:24};tickLasers();
  assert.equal(f.state,"NORMAL","An elevator ride, respawn or /tp across a grid must not trip it");
  intruder.location={x:4.5,y,z:15.2};tickLasers();intruder.location={x:4.5,y,z:12};tickLasers();
  assert.equal(f.state,"ALERT","Walking through the beams must still trip the grid");
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
test("the blast door parts at a centre seam and both leaves slide sideways into the wall",()=>{
  const {f}=make(3),door=f.doors[0],width=door.max.x-door.min.x+1,height=door.max.y-door.min.y+1,steps=travel(door);
  const tag=`sf_door:${f.id}:${door.id}`;
  // The leaf model in tools/build_assets.py is built for exactly this door.
  assert.deepEqual([width,height,door.max.z-door.min.z+1],[5,4,1]);
  assert.equal(steps,40,"Each leaf slides 2.5 blocks at 16 ticks a block");
  const leaves=()=>entities.filter(e=>e.typeId===LEAF);
  // Every course of a column must agree: the door moves sideways, never course by course.
  const cols=()=>[...Array(width).keys()].map(i=>{
    const kinds=new Set([...Array(height).keys()].map(r=>{
      const b=at(door.min.x+i,door.min.y+r,door.min.z);
      return b.states[ns+"open"]?"open":b.states[ns+"slide"]>0?"hidden":"solid";
    }));
    assert.equal(kinds.size,1,`Column ${i} is split between states`);return [...kinds][0];
  });
  const anchor=()=>[leaves()[0].getProperty(ns+"phase"),leaves()[0].getProperty(ns+"motion")];
  requestDoor(f,door,true);tickDoors();
  // The leaves arrive one tick before the blocks give way, so the doorway never flashes open.
  assert.equal(leaves().length,1);assert.deepEqual(cols(),new Array(width).fill("solid"));
  assert.ok(leaves()[0].tags.includes(tag));assert.equal(leaves()[0].spawnEvent,undefined);
  assert.deepEqual(anchor(),[0,1],"The leaves are told once where they start and which way they go");
  const opened=new Array(width).fill(-1);
  for(let n=1;n<=steps;n++){
    tickDoors();
    assert.deepEqual(anchor(),[0,1],"The leaves must not be re-synced mid-slide");
    const shown=cols(),gap=slid(door,n);
    shown.forEach((kind,i)=>{
      // A column opens only when both leaves have slid clear of it; until then it stays solid,
      // drawn invisibly so the moving leaves show instead.
      const clear=gap>=Math.max(width/2-i,i+1-width/2)-1e-9;
      assert.equal(kind,clear?"open":"hidden",`Column ${i} disagrees with the leaves at step ${n}`);
      if(clear&&opened[i]<0)opened[i]=n;
    });
  }
  assert.ok(opened[2]<opened[1]&&opened[1]===opened[3]&&opened[3]<opened[0]&&opened[0]===opened[4],
    `Columns must open from the seam outward in pairs: ${opened}`);
  // Eased: the leaves accelerate away from rest.
  assert.ok(opened[2]>opened[1]-opened[2],"The leaves should start slowly");
  tickDoors();assert.equal(leaves().length,0,"The leaves must be removed once the door is open");
  assert.deepEqual(cols(),new Array(width).fill("open"));
  // Closing starts fully parted, is held by an entity in the doorway, then resumes.
  requestDoor(f,door,false);tickDoors();
  assert.equal(leaves()[0].spawnEvent,ns+"from_open","Closing leaves must start fully parted");
  for(let n=0;n<8;n++)tickDoors();
  const cow={id:"cow",typeId:"minecraft:cow",location:{...door.min},tags:[],isValid:true};entities.push(cow);
  const held=cols();for(let n=0;n<10;n++)tickDoors();
  assert.deepEqual(cols(),held,"The door must hold while the doorway is obstructed");
  assert.deepEqual(anchor(),[1-8/steps,0],"The client leaves must stop where the door stopped");
  entities.splice(entities.indexOf(cow),1);tickDoors();
  assert.deepEqual(anchor(),[1-8/steps,-1],"The client leaves must resume from where they stopped");
  for(let n=0;n<steps;n++)tickDoors();
  // Shut: the blocks draw the door again, then the leaves go, so it never flashes transparent.
  assert.deepEqual(cols(),new Array(width).fill("solid"));assert.equal(leaves().length,0);
  // A leaf stranded by a reload mid-slide is cleared when the door is restored.
  dimension.spawnEntity(LEAF,{...door.min}).addTag(tag);
  restoreDoors(f);tickDoors();assert.equal(leaves().length,0,"Stale leaf survived a restore");
  assert.deepEqual(cols(),new Array(width).fill("solid"));
});
test("a blast door reversed mid-slide turns back from where its leaves are",()=>{
  const {f}=make(3),door=f.doors[0],steps=travel(door);
  const leaf=()=>entities.find(e=>e.typeId===LEAF);
  requestDoor(f,door,true);for(let n=0;n<=12;n++)tickDoors();
  const id=leaf().id;requestDoor(f,door,false);tickDoors();
  assert.equal(leaf().id,id,"Reversing must keep the same leaves");
  assert.deepEqual([leaf().getProperty(ns+"phase"),leaf().getProperty(ns+"motion")],[12/steps,-1]);
  for(let n=0;n<=13;n++)tickDoors();
  assert.equal(leaf(),undefined);assert.ok(!door.open);
  for(let x=door.min.x;x<=door.max.x;x++)
    assert.deepEqual(at(x,door.min.y,door.min.z).states,{[ns+"open"]:false,[ns+"slide"]:0});
});
const STANDS=()=>entities.filter(e=>e.typeId==="minecraft:armor_stand");
/** The deal each stand was given: slot to loot table, read back from the commands the build ran. */
function deals(f){
  return f.armoury.map((_,i)=>Object.fromEntries(commands.filter(c=>c.includes(`tag=${standTag(f.id,i)}]`)).map(c=>{
    const m=c.match(/^loot replace entity @e\[type=armor_stand,tag=\S+\] (\S+) 0 loot "([^"]+)"$/);assert.ok(m,`Malformed deal: ${c}`);return [m[1],m[2]];
  })));
}
test("the armoury: a room of armour stands off the lobby, each in an enchanted, trimmed suit with a matching sword",()=>{
  const {f}=make(3),o=f.origin,rel=(x,y,z)=>blockAt(o.x+x,o.y+y,o.z+z).typeId;
  // Twelve stands, each on the armoury floor in open air, turned to face the aisle.
  const stands=STANDS();assert.equal(stands.length,12);assert.equal(f.armoury.length,12);
  f.armoury.forEach((stand,i)=>{
    const e=stands.find(e=>e.tags.includes(standTag(f.id,i)));assert.ok(e,`Stand ${i} was not placed`);
    const x=Math.floor(e.location.x)-o.x,y=Math.floor(e.location.y)-o.y,z=Math.floor(e.location.z)-o.z;
    assert.ok(x>=21&&x<=27&&z>=3&&z<=17&&y===1,`Stand ${i} is outside the armoury at ${x},${y},${z}`);
    assert.equal(rel(x,0,z),ns+"diamond_plate_floor");assert.equal(rel(x,1,z),"minecraft:air");assert.equal(rel(x,2,z),"minecraft:air");
    assert.equal(e.rotation.y,x===27?90:-90,`Stand ${i} faces the wall`);
  });
  // The armoury is reached on foot from the lobby, through the doorway in its east wall, and its aisle runs the length of the room.
  const reach=flood(o.y+1,[13,13],{x0:0,x1:28,z0:-4,z1:20});
  for(let z=ARMOURY_DOOR.z0;z<=ARMOURY_DOOR.z1;z++)for(let y=1;y<=ARMOURY_DOOR.height;y++)assert.equal(rel(20,y,z),"minecraft:air");
  for(const [x,z] of [[24,3],[24,17],[26,10]])assert.ok(reach.has(`${o.x+x},${o.z+z}`),`The armoury aisle is not reachable at ${x},${z}`);
  // Each stand is dealt a full suit and a sword, all in one metal, the armour all in one trim.
  const dealt=deals(f);
  dealt.forEach((deal,i)=>{
    const stand=f.armoury[i],trim=TRIMS[stand.trim];
    assert.deepEqual(Object.keys(deal).sort(),Object.values(SLOTS).sort(),`Stand ${i} is missing a piece`);
    for(const piece of [...PIECES,"sword"]){
      const table=deal[SLOTS[piece]],path=new URL(`../behavior_pack/loot_tables/${table}.json`,import.meta.url);
      assert.ok(fs.existsSync(path),`No loot table ${table}`);
      const entry=JSON.parse(fs.readFileSync(path,"utf8")).pools[0].entries[0];
      const prefix={gold:"golden",diamond:"diamond",netherite:"netherite"}[stand.material];
      assert.equal(entry.name,`minecraft:${prefix}_${piece}`,`Stand ${i} got the wrong ${piece}`);
      const fn=name=>entry.functions.find(x=>x.function===name);
      assert.deepEqual(fn("enchant_with_levels"),{function:"enchant_with_levels",treasure:false,levels:{min:30,max:39}},`${table} is not enchanted`);
      if(piece==="sword")assert.equal(fn("set_armor_trim"),undefined);
      else assert.deepEqual(fn("set_armor_trim"),{function:"set_armor_trim",material:trim.material,pattern:trim.pattern},`${table} has the wrong trim`);
    }
  });
  // Four suits of each metal, and no two suits in the same trim.
  for(const metal of MATERIALS)assert.equal(f.armoury.filter(s=>s.material===metal).length,4,metal);
  assert.equal(new Set(f.armoury.map(s=>s.trim)).size,12);
  // Every bunker deals its own armoury, and the same seed deals the same one.
  const deal=seed=>JSON.stringify(planArmoury(o,seed).map(s=>[s.material,s.trim]));
  assert.equal(deal(10),deal(10));assert.notEqual(deal(10),deal(11));
  // A resumed build keeps the stands it has rather than dealing a second set.
  const before=commands.length;f.phase="failed";f.buildStep=0;build(f,players[0]);finishBuild();
  assert.equal(STANDS().length,12);assert.equal(commands.length,before,"A resumed build dealt the suits again");
  // Rock covers the room, which stays open beneath it.
  for(let x=20;x<=29;x++)for(let z=1;z<=19;z++){
    const top=column(f.seed,x,z,rearExit(f),true).top;assert.ok(top>=ARMOURY.roof+4,`Thin cover over the armoury at ${x},${z}`);
    for(let y=ARMOURY.roof+1;y<=top;y++)assert.notEqual(rel(x,y,z),"minecraft:air",`Hole in the mountain over the armoury at ${x},${y},${z}`);
  }
  for(let y=1;y<=5;y++)assert.equal(rel(24,y,10),y===1?"minecraft:red_carpet":"minecraft:air","The armoury was filled in by the mountain");
});
test("a bunker saved before the armoury keeps a solid mountain where the room would be",()=>{
  reset();facilities.clear();
  const f=planBunker({x:0,y:80,z:0},3,10,true,"old");delete f.armoury;f.modules=f.modules.filter(m=>m.role!=="armoury");
  const p=playerAt({x:13,y:81,z:-10});players.push(p);build(f,p);finishBuild();
  assert.equal(STANDS().length,0);assert.equal(commands.length,0);
  for(let y=1;y<=5;y++)assert.notEqual(blockAt(24,80+y,10).typeId,"minecraft:air",`Hollow left in the mountain at 24,${y},10`);
});
test("self-destruct fires the charges and brings the whole bunker down",()=>{
  const {f}=make(3);armDestruct(f);assert.equal(f.countdown,90);assert.ok(f.doors.every(d=>d.open));
  assert.equal(abortDestruct(f),true);armDestruct(f);f.countdown=10;assert.equal(abortDestruct(f),false);
  for(let n=0;n<40;n++)tickDoors();
  // Inside the bunker itself: the escape tunnel and hut are the way out and are left standing.
  const count=id=>[...blocks].filter(([k,b])=>{const [x,,z]=k.split(",").map(Number);return b.typeId===ns+id&&x>=0&&x<=26&&z>=-4&&z<=26;}).length;
  const fittings=["keycard_reader","elevator_panel","security_console","self_destruct_console","server_rack","industrial_light","blast_door","security_door"];
  const before=Object.fromEntries(fittings.map(id=>[id,count(id)]));
  assert.ok(Object.values(before).every(n=>n>0));assert.equal(STANDS().length,12);
  // A charge a player dug out before the countdown ended does not go off.
  const defused=f.charges[0];blocks.set(`${defused.x},${defused.y},${defused.z}`,{typeId:"minecraft:stone",states:{}});
  // Floors fall one per second, deepest first, while the lobby survives until last.
  const lobby=()=>at(13,81,13);
  for(let i=0;i<40&&f.state!=="DESTROYED";i++){
    system.currentTick+=10;tickAlarms();
    if(f.destructionStep===1)assert.equal(lobby().typeId,"minecraft:air","The surface went before the deepest floor");
  }
  assert.equal(f.state,"DESTROYED");assert.ok(f.turrets.every(t=>t.damaged&&!t.enabled));
  setSecurity(f,"NORMAL");assert.equal(f.state,"DESTROYED");
  // Every live charge blew, the defused one did not, and nothing is left to find.
  for(const c of f.charges)assert.notEqual(at(c.x,c.y,c.z)?.typeId,"minecraft:tnt",`Unexploded charge at ${JSON.stringify(c)}`);
  assert.equal(at(defused.x,defused.y,defused.z).typeId,"minecraft:stone","A defused charge must not blast a breach");
  for(const c of f.charges.slice(1))assert.ok(explosions.some(e=>Math.abs(e.location.x-c.x-0.5)<0.01&&Math.abs(e.location.y-c.y-0.5)<0.01&&Math.abs(e.location.z-c.z-0.5)<0.01));
  assert.ok(explosions.every(e=>e.options.breaksBlocks===false),"Explosions must not scatter block drops");
  // Each charge breaches the wall beside it.
  const c=f.charges.find(c=>c.x===-1);assert.equal(at(0,c.y,c.z).typeId,"minecraft:air","No breach behind a charge");
  // Every fitting is gone, and the shell is scorched.
  for(const id of fittings)assert.equal(count(id),0,`${id} survived the demolition`);
  assert.ok(count("damaged_panel")>2000,"The shell should be scorched and cracked");
  // Each room shows real damage: at least one cavity opened through its shell.
  for(const m of f.modules.filter(m=>m.floor>0)){
    let open=0;
    for(let x=m.pos.x-1;x<=m.pos.x+9;x++)for(const z of [m.pos.z,m.pos.z+8])for(let y=m.pos.y+1;y<=m.pos.y+4;y++)if(at(x,y,z)?.typeId==="minecraft:air")open++;
    for(let z=m.pos.z;z<=m.pos.z+8;z++)for(const x of [m.pos.x,m.pos.x+8])for(let y=m.pos.y+1;y<=m.pos.y+4;y++)if(at(x,y,z)?.typeId==="minecraft:air")open++;
    assert.ok(open>0,`${m.template} on B${m.floor} came through intact`);
  }
  // The portal passage is filled with rubble, sealing the ruin, and the defences are gone.
  assert.equal(flood(81,[13,-2],{x0:6,x1:20,z0:-4,z1:17}).has("13,13"),false,"The collapsed portal can still be walked through");
  assert.equal(entities.filter(e=>e.typeId===ns+"laser_turret"&&!e.tags.includes(`sf:${f.id}:tunnel`)||e.typeId===LEAF).length,0);
  // The armoury is gutted too, and its stands go with their suits.
  assert.equal(STANDS().length,0,"Armour stands survived the demolition");
  assert.equal(at(24,86,10)?.typeId,ns+"damaged_panel","The armoury ceiling should be scorched");
  // The secret tunnel and its exit are the way out and come through intact, with no blast in them;
  // the junction turret is left standing but shut down for good.
  escapes(f,[13,27]);
  const junction=f.turrets.find(t=>t.zone==="tunnel");
  assert.ok(junction.damaged&&!junction.enabled);
  const inTunnel=v=>f.exit.passages.slice(1).some(({interior:b})=>v.x>=b.min.x-2&&v.x<=b.max.x+3&&v.y>=b.min.y-2&&v.y<=b.max.y+3&&v.z>=b.min.z-2&&v.z<=b.max.z+3);
  assert.ok(!explosions.some(x=>inTunnel(x.location)),"An explosion went off in the escape tunnel");
});
test("turret target selection, cooldown, line-of-sight and disabled state",()=>{
  const {f}=make(3),turret=f.turrets[0],source=turret.pos;
  const cow=dimension.spawnEntity("minecraft:cow",{x:source.x,y:source.y,z:source.z-3});
  const player=dimension.spawnEntity("minecraft:player",{x:source.x,y:source.y,z:source.z-4});
  const zombie=dimension.spawnEntity("minecraft:zombie",{x:source.x,y:source.y,z:source.z-6});
  for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}
  assert.ok(zombie.damage>0);assert.equal(cow.damage,undefined);assert.equal(player.damage,undefined);
  // Each shot is one solid beam emitter spanning muzzle to target, not a dotted trail.
  const shots=particles.filter(p=>p.id===ns+"turret_beam");
  assert.ok(shots.length>0&&!particles.some(p=>p.id===ns+"laser_beam"));
  const {location:from,vars}=shots[0],end={x:from.x+vars["variable.span"].x,y:from.y+vars["variable.span"].y,z:from.z+vars["variable.span"].z};
  assert.ok(Math.abs(Math.hypot(vars["variable.span"].x,vars["variable.span"].y,vars["variable.span"].z)-vars["variable.length"])<1e-9);
  assert.ok(Math.hypot(end.x-zombie.location.x,end.y-zombie.location.y-1,end.z-zombie.location.z)<1e-9,"The beam must end on the target");
  const before=zombie.damage;f.zones.entrance="OFFLINE";
  for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}assert.equal(zombie.damage,before);
  f.zones.entrance="ACTIVE";const ray=dimension.getBlockFromRay;dimension.getBlockFromRay=()=>({block:{}});
  for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}assert.equal(zombie.damage,before);
  dimension.getBlockFromRay=ray;
});
test("turrets placed from spawn eggs defend on their own, missiles keep their minimum range and break nothing",()=>{
  reset();facilities.clear();players.push(playerAt({x:0,y:81,z:-6}));
  const tick=n=>{for(let i=0;i<n;i++){system.currentTick++;tickMissiles();if(system.currentTick%5===0)tickPlaced();}};
  const spawn=(type,z,x=0.5)=>dimension.spawnEntity(type,{x,y:81,z});
  const laser=spawn(ns+"laser_turret",0.5);
  const cow=spawn("minecraft:cow",4),person=spawn("minecraft:player",5),zombie=spawn("minecraft:zombie",8);
  tick(150);
  assert.ok(zombie.damage>0,"A placed laser turret belongs to no facility but must still fire");
  assert.equal(cow.damage,undefined);assert.equal(person.damage,undefined);
  assert.ok(particles.some(p=>p.id===ns+"turret_beam"));
  for(const e of [laser,cow,person,zombie])e.remove();
  // Missile turret: a hostile inside the minimum range is left alone; nothing is launched at it.
  const launcher=spawn(ns+"missile_turret",0.5),close=spawn("minecraft:zombie",0.5+MISSILE.minRange-2);
  tick(100);
  assert.equal(close.damage,undefined);assert.ok(!sounds.some(s=>s.id===ns+"missile_launch"),"Launched inside the minimum range");
  close.remove();
  const far=spawn("minecraft:zombie",20),villager=spawn("minecraft:villager_v2",21),bystander=spawn("minecraft:player",22);
  let flew=false;
  for(let i=0;i<200&&!far.damage;i++){tick(1);flew||=entities.some(e=>e.typeId===ns+"missile");}
  assert.ok(flew,"No missile entity was launched");
  assert.ok(far.damage>0,"The missile never reached its target");
  assert.equal(far.hits[0].cause,"entityExplosion");assert.equal(far.hits[0].damagingEntity,launcher);
  assert.equal(villager.damage,undefined);assert.equal(bystander.damage,undefined);
  assert.equal(explosions.length,0,"Missile blasts must not break blocks");
  assert.ok(sounds.some(s=>s.id==="random.explode"));
  assert.ok(particles.some(p=>p.id===ns+"missile_exhaust")&&particles.some(p=>p.id===ns+"missile_smoke"));
  tick(1);assert.equal(entities.filter(e=>e.typeId===ns+"missile").length,0,"The missile must be gone after it detonates");
  // Reload: at most one launch every three seconds.
  const launches=()=>sounds.filter(s=>s.id===ns+"missile_launch").length,before=launches();
  tick(MISSILE.reload*3);assert.ok(launches()-before<=3,`${launches()-before} launches in ${MISSILE.reload*3} ticks`);
  // A wall in the flight path stops the missile short, and the blast does not reach through to the target.
  const ray=dimension.getBlockFromRay;
  for(let i=0;i<200&&!entities.some(e=>e.typeId===ns+"missile");i++)tick(1);
  assert.ok(entities.some(e=>e.typeId===ns+"missile"),"The turret stopped firing");
  const damage=far.damage;
  dimension.getBlockFromRay=(from)=>({block:{location:{x:0,y:81,z:Math.floor(from.z)+1}},faceLocation:{x:0.5,y:0.5,z:0}});
  tick(2);dimension.getBlockFromRay=ray;
  assert.equal(entities.filter(e=>e.typeId===ns+"missile").length,0,"The missile flew through a wall");
  assert.equal(far.damage,damage,"The blast reached a target far beyond the wall");
  // A missile left behind by a reload has no flight to finish and is cleared when a player comes near.
  launcher.remove();const stray=spawn(ns+"missile",3);tick(45);assert.equal(stray.isValid,false);
});
test("the bunker is buried in a mountain with its portal and escape exit left open",()=>{
  const {f}=make(3),o=f.origin,rel=(x,y,z)=>blockAt(o.x+x,o.y+y,o.z+z).typeId;
  // Solid rock over the lobby roof and every hut, with the mountain's surface where it should be.
  for(let x=6;x<=20;x++)for(let z=0;z<=17;z++){
    const top=column(f.seed,x,z,rearExit(f)).top;assert.ok(top>=12,`Thin cover over the entrance at ${x},${z}`);
    for(let y=9;y<=top;y++)assert.notEqual(rel(x,y,z),"minecraft:air",`Hole in the mountain at ${x},${y},${z}`);
    assert.equal(rel(x,top+1,z),"minecraft:air");
  }
  let peak=0;for(let x=MOUNTAIN.x0;x<=MOUNTAIN.x1;x++)for(let z=MOUNTAIN.z0;z<=MOUNTAIN.z1;z++)peak=Math.max(peak,column(f.seed,x,z).top);
  assert.ok(peak>=20,`A ${peak}-block mound is not a mountain`);
  // The forecourt is a cave mouth under an overhanging brow, open to the approach.
  for(let x=8;x<=18;x++)for(let z=-4;z<=-1;z++)for(let y=2;y<=(z===-1?6:8);y++)assert.equal(rel(x,y,z),"minecraft:air",`Forecourt blocked at ${x},${y},${z}`);
  for(let x=6;x<=20;x++)assert.notEqual(rel(x,9,-2),"minecraft:air","The portal has no overhanging brow");
  const approach=flood(o.y+1,[13,MOUNTAIN.z0],{x0:MOUNTAIN.x0,x1:MOUNTAIN.x1,z0:MOUNTAIN.z0,z1:-1});
  assert.ok(approach.has("13,-1"),"The portal cannot be reached from outside the mountain");
  assert.ok(!approach.has("5,-2")&&!approach.has("21,-2"),"The forecourt should be walled in by rock");
  // Every charge is real TNT, sealed in on all sides.
  for(const c of f.charges){
    assert.equal(at(c.x,c.y,c.z).typeId,"minecraft:tnt");
    for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])
      assert.notEqual(at(c.x+dx,c.y+dy,c.z+dz)?.typeId??"minecraft:air","minecraft:air",`Exposed charge at ${JSON.stringify(c)}`);
  }
});
test("every secret tunnel exit, in every direction, leads out to open ground",()=>{
  const sites=[["south",13,50],["east",46,38],["west",-20,38],["south",13,66]];
  REMOTE.forEach((kind,i)=>{
    for(const [heading,x,z] of sites){
      // Exits stand anywhere from a little below to well above the pad.
      const level=80+[-3,0,6,14][(i+x)&3];
      const {f}=make(3,i*7+x,{kind,heading,x,z,level,ground:"minecraft:grass_block"});
      assert.equal(f.exit.kind,kind);escapes(f);
      // The exit's template stands where it should: its floor on the levelled ground.
      const l=f.exit.ladder;
      for(const [dx,dz] of [[-SITE,-SITE],[SITE,SITE]])assert.equal(at(l.x+dx,l.y,l.z+dz).typeId,"minecraft:grass_block",`${kind}: exit site not levelled`);
      for(const [dx,dz] of [[-SITE,0],[SITE,0]])assert.equal(at(l.x+dx,l.y+1,l.z+dz).typeId,"minecraft:air",`${kind}: exit site not cleared`);
    }
  });
});
test("the survey picks an exit that suits the ground around the bunker",()=>{
  const origin={x:0,y:80,z:0},pick=(seed=4,preference)=>exitSite(dimension,origin,seed,preference);
  reset();
  assert.ok(["utility_shed","hidden_hatch","well"].includes(pick().kind),"Open grassland takes a shed, hatch or well");
  terrain.tree=()=>true;assert.equal(pick().kind,"forest_cabin");
  assert.equal(pick(4,"hidden_hatch").kind,"hidden_hatch","A chosen exit overrides the terrain");
  const forest=planBunker(origin,3,4,true,"test",pick());
  players.push(playerAt({x:13,y:81,z:-10}));build(forest,players[0]);finishBuild();escapes(forest);
  reset();terrain.top=()=>"minecraft:sand";assert.equal(pick().kind,"well");
  reset();terrain.top=()=>"minecraft:stone";assert.equal(pick().kind,"mine_headframe");
  // A valley below the tunnel all round: nowhere keeps the tunnel buried, so it comes up behind the mountain.
  reset();terrain.height=(x,z)=>Math.hypot(x-13,z-13)>34?72:80;assert.equal(pick().kind,"rock_face");
  // Lakes to the south and west leave only the east.
  reset();const wet=(x,z)=>x<40&&(z>43||x<-12);terrain.height=(x,z)=>wet(x,z)?74:80;terrain.water=(x,z)=>wet(x,z)?80:undefined;
  for(let seed=0;seed<6;seed++)assert.equal(pick(seed).heading,"east");
  // A hill rising behind the bunker carries the exit up onto it, within the ladder's reach.
  reset();terrain.height=(x,z)=>z>44?88:80;const hill=pick(2);
  if(hill.heading==="south")assert.equal(hill.level,88);
  reset();assert.equal(pick(1,"rock_face").kind,"rock_face");
});
test("a cave the tunnel crosses is sealed around it",()=>{
  reset();facilities.clear();
  const f=planBunker({x:0,y:80,z:0},3,5,true,"test",{kind:"utility_shed",heading:"east",x:46,z:38,level:80,ground:"minecraft:grass_block"});
  // A cave pocket beyond the mountain's skirts, right across the tunnel's path.
  for(let x=40;x<=44;x++)for(let y=68;y<=78;y++)for(let z=33;z<=43;z++)blocks.set(`${x},${y},${z}`,{typeId:"minecraft:air",states:{}});
  players.push(playerAt({x:13,y:81,z:-10}));build(f,players[0]);finishBuild();escapes(f);
  for(let x=40;x<=44;x++){
    for(let y=70;y<=76;y++)for(const z of [35,41])assert.notEqual(at(x,y,z).typeId,"minecraft:air",`Tunnel wall open to the cave at ${x},${y},${z}`);
    for(let z=35;z<=41;z++)for(const y of [70,76])assert.notEqual(at(x,y,z).typeId,"minecraft:air",`Tunnel roof or floor open at ${x},${y},${z}`);
    for(let y=72;y<=74;y++)assert.equal(at(x,y,38).typeId,"minecraft:air","The sealing filled the tunnel itself");
  }
});
test("the secret tunnel is guarded by a keycard door, a laser grid and a junction turret",()=>{
  const {f}=make(3,8,{kind:"hidden_hatch",heading:"west",x:-20,z:38,level:80,ground:"minecraft:grass_block"});
  const door=f.doors.find(d=>d.id==="tunnel"),y=f.floors[1].y+1;
  for(const r of door.readers)assert.equal(at(r.x,r.y,r.z).typeId,ns+"keycard_reader");
  assert.equal(at(11,y+1,32).typeId,ns+"laser_emitter");assert.equal(at(15,y+1,32).typeId,ns+"laser_receiver");
  // Someone without command clearance walking in from the exit trips the grid, and the door shuts behind it.
  const intruder=playerAt({x:13.5,y,z:34});intruder.id="intruder";intruder.getComponent=()=>({container:{size:0,getItem(){}}});
  players.length=0;players.push(intruder);
  tickLasers();intruder.location={x:13.5,y,z:31};tickLasers();
  assert.equal(f.state,"ALERT");assert.equal(door.open,false);
  for(let n=0;n<40;n++)tickDoors();
  assert.equal(flood(y,[13,34],{x0:-30,x1:30,z0:22,z1:50}).has("13,24"),false,"A closed tunnel door can be walked past");
  // The junction turret only fires once the alarm is up, at hostiles only.
  const turret=f.turrets.find(t=>t.zone==="tunnel"),entity=entities.find(e=>e.tags.includes(`sf:${f.id}:tunnel`));
  assert.equal(entity.nameTag,"§7TUNNEL DEFENCE");assert.equal(at(Math.floor(turret.pos.x),turret.pos.y-1,Math.floor(turret.pos.z)).typeId,ns+"laser_turret_mount");
  const zombie=dimension.spawnEntity("minecraft:zombie",{x:13.5,y,z:38.5}),cow=dimension.spawnEntity("minecraft:cow",{x:12.5,y,z:38.5});
  setSecurity(f,"NORMAL");for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}
  assert.equal(zombie.damage,undefined,"ALERT ONLY must hold fire in NORMAL");
  setSecurity(f,"ALERT");for(let i=0;i<30;i++){system.currentTick+=5;tickDefence();}
  assert.ok(zombie.damage>0);assert.equal(cow.damage,undefined);
  // Self-destruct opens the way out.
  armDestruct(f);assert.equal(door.open,true);
});
test("the rock-face fallback, and bunkers saved before remote exits, keep the hut behind the mountain",()=>{
  for(const legacy of [false,true]){
    reset();facilities.clear();
    const f=planBunker({x:0,y:80,z:0},3,12,true,"test",{kind:"rock_face"});
    if(legacy){delete f.exit;f.doors=f.doors.filter(d=>d.id!=="tunnel");f.lasers=f.lasers.filter(l=>l.a.z===l.b.z?false:true);f.lights.pop();}
    assert.equal(rearExit(f),true);
    players.push(playerAt({x:13,y:81,z:-10}));build(f,players[0]);finishBuild();
    if(!legacy)escapes(f);
    assert.ok(flood(f.floors[1].y+1,[13,13]).has("13,34"),"B1 escape tunnel blocked");
    // The escape ladder lands players on a hut floor that leads to its exit.
    const hut=f.origin.y;
    for(let x=12;x<=14;x++)for(let z=33;z<=35;z++)if(x!==12||z!==34)
      assert.notEqual(at(x,hut,z).typeId,"minecraft:air",`Escape hut floor open at ${x},${hut},${z}`);
    assert.equal(at(12,hut,34).typeId,"minecraft:ladder","Escape ladder does not reach the hut");
    // The hut is dug into the back of the mountain; its door opens south, out onto clear ground.
    assert.ok(flood(hut+1,[13,34],{x0:10,x1:16,z0:32,z1:42}).has("13,42"),"Escape hut exit unreachable");
    assert.equal(column(f.seed,13,40).open,true,"The hut's apron must stay open");
  }
  // Remote exits need no apron: the mountain closes over the back of the bunker.
  assert.equal(column(1,13,40,false).open,false);
});
function makeEstate(levels=3,seed=7,site){
  reset();facilities.clear();const f=planEstate({x:0,y:80,z:0},levels,seed,true,"estate",site);f.ground="minecraft:grass_block";
  const p=playerAt({x:13.5,y:81,z:-15.5});players.push(p);
  for(let n=0;n<400;n++)tickDoors();
  build(f,p);finishBuild();assert.equal(f.phase,"ready");
  return {f,p};
}
const COMPOUND_BOX={x0:COMPOUND.x0-2,x1:COMPOUND.x1+2,z0:COMPOUND.z0-2,z1:COMPOUND.z1+2};
test("the fortified estate: walled and gated, a mansion over its bunker, and a secret way out",()=>{
  const {f}=makeEstate(3);
  const gate=f.doors.find(d=>d.id==="gate"),front=f.doors.find(d=>d.id==="front"),back=f.doors.find(d=>d.id==="back");
  // The wall runs unbroken all the way round, fence on top, and only the gate opens it.
  for(let x=COMPOUND.x0;x<=COMPOUND.x1;x++)for(const z of [COMPOUND.z0,COMPOUND.z1])for(let y=81;y<=80+WALL_HEIGHT;y++)
    assert.notEqual(blockAt(x,y,z).typeId,"minecraft:air",`Hole in the wall at ${x},${y},${z}`);
  for(let z=COMPOUND.z0;z<=COMPOUND.z1;z++)for(const x of [COMPOUND.x0,COMPOUND.x1])for(let y=81;y<=80+WALL_HEIGHT;y++)
    assert.notEqual(blockAt(x,y,z).typeId,"minecraft:air",`Hole in the wall at ${x},${y},${z}`);
  assert.equal(at(0,86,COMPOUND.z1).typeId,"minecraft:iron_bars");
  const outside=()=>flood(81,[13,COMPOUND.z0-2],COMPOUND_BOX);
  assert.equal(outside().has("13,-20"),false,"The closed gate can be bypassed");
  requestDoor(f,gate,true);for(let n=0;n<60;n++)tickDoors();
  const court=outside();
  for(const cell of ["13,-20","13,1","22,-25","-7,-20","36,-20"])assert.ok(court.has(cell),`The forecourt does not reach ${cell}`);
  assert.equal(court.has("13,10"),false,"The closed front door can be bypassed");
  // Through the front door to the lift, the ladder and the back door.
  requestDoor(f,front,true);for(let n=0;n<40;n++)tickDoors();
  const hall=outside();for(const cell of ["13,13","14,16","13,21"])assert.ok(hall.has(cell),`The hall does not reach ${cell}`);
  requestDoor(f,back,true);for(let n=0;n<40;n++)tickDoors();assert.ok(outside().has("13,30"),"The back door does not open onto the garden");
  // The mansion's lift lands on a pad, and the emergency ladder climbs into its hall.
  const lift=f.floors[0].destination;
  assert.equal(blockAt(13,80,13).typeId,ns+"elevator_pad");assert.equal(blockAt(13,81,13).typeId,"minecraft:air");assert.equal(blockAt(13,82,13).typeId,"minecraft:air");
  assert.equal(at(Math.floor(lift.x)+2,82,Math.floor(lift.z)+1).typeId,ns+"elevator_panel");
  for(let y=f.floors.at(-1).y+1;y<=85;y++)assert.equal(at(15,y,16).typeId,"minecraft:ladder",`Emergency ladder broken at Y ${y}`);
  // The bunker below is the same as the command bunker's: every room reachable from its core.
  for(const floor of f.floors.slice(1)){
    const seen=flood(floor.y+1,[13,13]);
    for(const m of f.modules.filter(m=>m.pos.y===floor.y))assert.ok(seen.has(`${m.pos.x+4},${m.pos.z+4}`),`Cannot reach ${m.template} under the estate`);
  }
  escapes(f);
  assert.ok(f.exit.ladder.z>COMPOUND.z1||f.exit.ladder.x>COMPOUND.x1||f.exit.ladder.x<COMPOUND.x0,"The secret exit must lie outside the wall");
  // Lockdown shuts the gate, the doors, the garage and every window; normal opens the shutters again.
  setSecurity(f,"LOCKDOWN");for(let n=0;n<300;n++)tickDoors();
  for(const door of f.doors.filter(d=>d.id==="gate"||d.id.startsWith("window")||d.id.startsWith("garage")))
    for(let x=door.min.x;x<=door.max.x;x++)assert.equal(at(x,door.min.y,door.min.z).states[ns+"open"],false,`${door.id} did not close`);
  setSecurity(f,"NORMAL");for(let n=0;n<300;n++)tickDoors();
  for(const door of f.doors.filter(d=>d.kind==="shutter"))assert.equal(at(door.min.x,door.min.y,door.min.z).states[ns+"open"],true,`${door.id} did not reopen`);
  // Nine turrets: two on the gate pillars, one on each watchtower, one on the roof, the command deck and the tunnel.
  assert.equal(entities.filter(e=>e.typeId===ns+"laser_turret").length,9);
  for(const t of f.turrets)assert.equal(at(Math.floor(t.pos.x),t.pos.y-1,Math.floor(t.pos.z)).typeId,ns+"laser_turret_mount",`${t.id} has no mount`);
});
test("estate watchtowers and gate turrets fire at hostiles outside the wall, and the gate grid raises the alarm",()=>{
  const {f}=makeEstate(3,9);
  const [x,z]=TOWERS[0],zombie=dimension.spawnEntity("minecraft:zombie",{x:x-8,y:81,z:z-6}),cow=dimension.spawnEntity("minecraft:cow",{x:x-6,y:81,z:z-8});
  const raider=dimension.spawnEntity("minecraft:pillager",{x:13.5,y:81,z:COMPOUND.z0-12});
  for(let i=0;i<40;i++){system.currentTick+=5;tickDefence();}
  assert.ok(zombie.damage>0,"The north-west watchtower did not fire");assert.equal(cow.damage,undefined);
  assert.ok(raider.damage>0,"The gate turrets did not fire");
  const intruder=playerAt({x:13.5,y:81,z:-28});intruder.id="intruder";intruder.getComponent=()=>({container:{size:0,getItem(){}}});
  players.length=0;players.push(intruder);tickLasers();intruder.location={x:13.5,y:81,z:-25};tickLasers();
  assert.equal(f.state,"ALERT");assert.equal(f.doors.find(d=>d.id==="gate").open,false);
});
test("estate self-destruct guts and burns the mansion, seals its lift, and leaves the walls and tunnel",()=>{
  const {f}=makeEstate(3,5);armDestruct(f);for(let n=0;n<80;n++)tickDoors();f.countdown=0;
  for(let i=0;i<40&&f.state!=="DESTROYED";i++){system.currentTick+=10;tickAlarms();}
  assert.equal(f.state,"DESTROYED");
  const house=id=>[...blocks].filter(([k,b])=>{const [x,y,z]=k.split(",").map(Number);return b.typeId===id&&x>=-4&&x<=30&&y>=80&&y<=92&&z>=1&&z<=23;}).length;
  for(const id of [ns+"keycard_reader",ns+"security_door",ns+"security_shutter","minecraft:glass",ns+"elevator_pad","minecraft:white_concrete"])
    assert.equal(house(id),0,`${id} survived in the mansion`);
  assert.ok(house("minecraft:gray_concrete")>500,"The mansion should be scorched");
  assert.equal(at(13,81,13).typeId,"minecraft:cobblestone","The lift in the hall must be sealed");
  assert.equal(blockAt(0,83,COMPOUND.z1).typeId,ns+"light_reinforced_concrete","The perimeter wall should stand");
  assert.equal(entities.filter(e=>e.typeId===ns+"laser_turret").length,1,"Only the tunnel's shut-down turret remains");
  escapes(f,[13,27]);
});
test("estates are surveyed across the whole compound, and without a remote site the tunnel comes up in the garden",()=>{
  reset();facilities.clear();
  const at=()=>{const p=playerAt({x:200.5,y:81,z:300.5});players.length=0;players.push(p);return p;};
  let s=estateOriginAt(at());
  assert.deepEqual([s.origin.x+FORECOURT.x,s.origin.z+FORECOURT.z,s.origin.y,s.cut,s.fill],[200,300,80,0,0],"The player stands in the forecourt");
  terrain.height=x=>80+Math.round((x-200)*0.25);
  s=estateOriginAt(at());assert.ok(s.cut>0&&s.fill>0&&s.cut<=MAX_CUT&&s.fill<=MAX_FILL,`cut ${s.cut} fill ${s.fill}`);
  terrain.height=x=>80+Math.round((x-200)*0.6);assert.throws(()=>estateOriginAt(at()),/rises and falls/);
  // Water everywhere beyond the wall: no remote site, so the tunnel comes up at a well in the back garden.
  reset();const pad=ESTATE_PAD,outside=(x,z)=>x<200-13+pad.x0||x>200-13+pad.x1||z<300+15+pad.z0||z>300+15+pad.z1;
  terrain.height=(x,z)=>outside(x,z)?74:80;terrain.water=(x,z)=>outside(x,z)?80:undefined;
  s=estateOriginAt(at());const exit=exitSite(dimension,s.origin,3,undefined,"estate");assert.equal(exit.kind,"rock_face");
  const f=planEstate(s.origin,3,3,true,"garden",exit);f.ground=s.ground;build(f,players[0]);finishBuild();
  assert.equal(f.phase,"ready");assert.equal(f.exit.kind,"well");escapes(f);
  // A builder standing below the new ground when it is levelled is lifted onto it, not buried.
  reset();facilities.clear();s=estateOriginAt(at());
  const lifted=planEstate(s.origin,3,4,false,"lift");lifted.ground=s.ground;
  const builder=players[0];build(lifted,builder);builder.location={...builder.location,y:76};finishBuild();
  assert.equal(builder.location.y,81,"The builder was left inside the ground");
});
/** Where a grid's emitter and receiver sit: one block beyond each end of the beam, in the wall. */
function fittings(laser){
  const alongX=laser.a.z===laser.b.z,cell=v=>({x:Math.floor(v.x),y:Math.floor(v.y),z:Math.floor(v.z)});
  return [cell({...laser.a,[alongX?"x":"z"]:laser.a[alongX?"x":"z"]-1}),cell({...laser.b,[alongX?"x":"z"]:laser.b[alongX?"x":"z"]+1})];
}
const solid=b=>b&&b.typeId!=="minecraft:air"&&b.states?.[ns+"open"]!==true;
test("tripwires are horizontal beams from wall to wall, drawn as a steady line",()=>{
  const {f}=make(3),y=f.floors[1].y;
  assert.ok(f.lasers.every(l=>l.a.y===l.b.y),"Every tripwire beam must be horizontal");
  for(const floor of f.floors.slice(1))for(const x of [4.5,22.5])
    assert.equal(f.lasers.filter(l=>l.a.x===x&&Math.floor(l.a.y)>=floor.y&&Math.floor(l.a.y)<floor.y+9).length,3,`B${f.floors.indexOf(floor)} needs a three-beam grid across its hall at x=${x}`);
  for(const laser of f.lasers){
    const [emitter,receiver]=fittings(laser);
    assert.equal(at(emitter.x,emitter.y,emitter.z).typeId,ns+"laser_emitter");assert.equal(at(receiver.x,receiver.y,receiver.z).typeId,ns+"laser_receiver");
    // Nothing stands in the beam's way, and nothing hangs in the air: the fittings are in the walls.
    for(let t=0;t<=1;t+=0.25){const v={x:laser.a.x+(laser.b.x-laser.a.x)*t,y:laser.a.y,z:laser.a.z+(laser.b.z-laser.a.z)*t};
      assert.ok(!solid(at(Math.floor(v.x),Math.floor(v.y),Math.floor(v.z))),`Beam blocked at ${JSON.stringify(v)}`);}
  }
  // Every sensor tick near a player redraws every nearby beam across its whole span.
  players.length=0;players.push(playerAt({x:13.5,y:y+1,z:13.5}));f.lasersEnabled=true;
  const before=particles.length;tickLasers();
  const beams=particles.slice(before).filter(p=>p.id===ns+"laser_beam");
  const inRange=f.lasers.filter(l=>Math.hypot(l.a.x-13.5,l.a.y-y-1,l.a.z-13.5)<24);
  assert.ok(inRange.length>=6);assert.equal(beams.length,inRange.length,"Every beam near a player should be drawn every tick");
  for(const b of beams){const len=Math.hypot(b.vars["variable.span"].x,b.vars["variable.span"].y,b.vars["variable.span"].z);
    assert.ok(Math.abs(len-2)<1e-9&&b.vars["variable.span"].y===0,"A beam must span its hall or tunnel, level");}
});
test("hostile mobs crossing a live tripwire are burned; players and passive mobs are not",()=>{
  const {f}=make(3),y=f.floors[1].y+1;
  const guard=playerAt({x:13.5,y,z:13.5});guard.getComponent=()=>({container:{size:1,getItem(){return {typeId:ns+"keycard_black"};}}});
  players.length=0;players.push(guard);
  const zombie=dimension.spawnEntity("minecraft:zombie",{x:4.5,y,z:13.5});
  const silverfish=dimension.spawnEntity("minecraft:silverfish",{x:22.5,y,z:12.8});
  const cow=dimension.spawnEntity("minecraft:cow",{x:4.6,y,z:12.9}),bystander=dimension.spawnEntity("minecraft:player",{x:22.4,y,z:14.1});
  const clear=dimension.spawnEntity("minecraft:zombie",{x:7.5,y,z:13.5});
  tickLasers();
  // One hit a tick, however many of the grid's beams run through the mob.
  assert.equal(zombie.damage,BEAM_DAMAGE);assert.equal(silverfish.damage,BEAM_DAMAGE,"A mob low enough to crawl under the old beams is caught");
  assert.equal(cow.damage,undefined);assert.equal(bystander.damage,undefined);assert.equal(clear.damage,undefined,"A mob beside the beam is not hit");
  assert.ok(particles.some(p=>p.id===ns+"laser_impact"));
  for(let i=0;i<3;i++)tickLasers();assert.equal(zombie.damage,4*BEAM_DAMAGE);
  // Mobs are burned, not reported: a black card holder saw it all and no alarm went off.
  assert.equal(f.state,"NORMAL");
  f.lasersEnabled=false;tickLasers();assert.equal(zombie.damage,4*BEAM_DAMAGE,"Disabled grids must not burn");
  f.lasersEnabled=true;players.length=0;players.push(playerAt({x:13.5,y,z:13.5+60}));tickLasers();
  assert.equal(zombie.damage,4*BEAM_DAMAGE,"Grids far from every player stay idle");
});
test("bunkers saved with the old vertical beam are upgraded to horizontal grids when loaded",()=>{
  const {f}=make(3),y=f.floors[1].y,set=(x,yy,z,typeId)=>blocks.set(`${x},${yy},${z}`,{typeId,states:{}});
  // Recreate an old save: each floor's east grid was one vertical beam from a floor emitter to a receiver under the ceiling.
  for(const floor of f.floors.slice(1)){
    const dy=floor.y;f.lasers=f.lasers.filter(l=>!(l.a.x===22.5&&Math.floor(l.a.y)>=dy&&Math.floor(l.a.y)<dy+9));
    f.lasers.push({a:{x:22.5,y:dy+1.3,z:13.5},b:{x:22.5,y:dy+4.7,z:13.5},response:"ALERT"});
    for(const h of [1,2,3]){set(22,dy+h,11,ns+"dark_reinforced_concrete");set(22,dy+h,15,ns+"dark_reinforced_concrete");}
    set(22,dy,13,ns+"laser_emitter");set(22,dy+5,13,ns+"laser_receiver");
  }
  save(f);facilities.clear();load();
  const loaded=facilities.get("test");
  assert.ok(loaded.lasers.every(l=>l.a.y===l.b.y),"A vertical beam survived the upgrade");
  assert.equal(loaded.lasers.filter(l=>l.a.x===22.5).length,9,"Each floor's east hall needs its three-beam grid");
  // The fittings are swapped once a player is near enough for their chunks to be loaded.
  players.length=0;players.push(playerAt({x:13.5,y:y+1,z:13.5}));tickLasers();
  assert.equal(loaded.retrofit,undefined,"The upgrade should finish once its chunks are loaded");
  for(const floor of loaded.floors.slice(1)){
    const dy=floor.y;
    assert.equal(at(22,dy,13).typeId,ns+"industrial_floor","The old floor emitter should be paved over");
    assert.equal(at(22,dy+5,13).typeId,"minecraft:air","The old hanging receiver should be gone");
    for(const h of [1,2,3]){assert.equal(at(22,dy+h,11).typeId,ns+"laser_emitter");assert.equal(at(22,dy+h,15).typeId,ns+"laser_receiver");}
  }
  // The upgrade is saved, and a new or ruined facility is left alone.
  save(loaded);facilities.clear();load();assert.equal(facilities.get("test").retrofit,undefined);
  assert.equal(levelGrids(facilities.get("test")),false);
  const ruin=planBunker({x:0,y:80,z:0},3,1,true,"ruin");ruin.phase="ready";ruin.state="DESTROYED";
  ruin.lasers.push({a:{x:22.5,y:1.3,z:13.5},b:{x:22.5,y:4.7,z:13.5},response:"ALERT"});
  assert.equal(levelGrids(ruin),false,"A destroyed facility's grids stay as they were");
});
test("readers, consoles, lift panels and grid fittings are set into walls, not floating",()=>{
  const check=(f,label)=>{
    const controls=[...f.doors.flatMap(d=>d.readers.map(r=>[r,`reader:${d.id}`])),...f.consoles.map(c=>[c.pos,`console:${c.kind}`]),
      ...f.floors.map(fl=>[fl.panel,`panel:${fl.name}`]),...f.lasers.flatMap(l=>fittings(l).map(v=>[v,"grid fitting"]))];
    for(const [v,what] of controls){
      assert.ok(solid(at(v.x,v.y,v.z)),`${label}: ${what} missing at ${JSON.stringify(v)}`);
      for(const dy of [-1,1])assert.ok(solid(blockAt(v.x,v.y+dy,v.z)),`${label}: ${what} at ${JSON.stringify(v)} floats (nothing ${dy<0?"below":"above"})`);
      // And it can be reached: at least one face is open to the room or passage.
      assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>!solid(blockAt(v.x+dx,v.y,v.z+dz))),`${label}: ${what} at ${JSON.stringify(v)} is walled in`);
    }
    // Alarm lamps are set flush into a ceiling, wall, slab or parapet, not hung beneath one.
    for(const v of f.lights)assert.ok([[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>solid(blockAt(v.x+dx,v.y,v.z+dz))).length>=2,`${label}: lamp hangs loose at ${JSON.stringify(v)}`);
  };
  check(make(5).f,"bunker");
  check(make(3,4,{kind:"rock_face"}).f,"rock-face bunker");
  check(makeEstate(3).f,"estate");
});
test("write an inspectable top-down estate site plan",()=>{
  const {f}=makeEstate(3,104729),top=[];
  const pad=ESTATE_PAD;
  for(let z=pad.z0;z<=pad.z1;z++){const row=[];
    for(let x=pad.x0;x<=pad.x1;x++){
      let found="minecraft:air",height=0;
      for(let y=100;y>=80;y--){const b=blockAt(x,y,z);if(b.typeId!=="minecraft:air"&&b.states?.[ns+"open"]!==true){found=b.typeId;height=y-80;break;}}
      row.push([found,height]);
    }
    top.push(row);
  }
  fs.mkdirSync(new URL("../docs/generated/",import.meta.url),{recursive:true});
  fs.writeFileSync(new URL("../docs/generated/estate-preview.json",import.meta.url),JSON.stringify({pad,exit:f.exit.ladder,modules:f.modules.filter(m=>m.size).map(m=>({role:m.role,x:m.pos.x,z:m.pos.z,size:m.size})),top}));
});
test("write inspectable first-floor voxel preview",()=>{
  const {f}=make(5,104729);
  fs.mkdirSync(new URL("../docs/generated/",import.meta.url),{recursive:true});
  fs.writeFileSync(new URL("../docs/generated/bunker-preview.json",import.meta.url),JSON.stringify({facility:f,blocks:[...blocks]}));
});
