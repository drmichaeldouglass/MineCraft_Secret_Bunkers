import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { blockAt, blocks, dimension, entities, explosions, finishBuild, particles, playerAt, players, properties, reset, system, terrain } from "./mock-server.mjs";
import { planBunker } from "../behavior_pack/scripts/generation/planner.js";
import { facilities, load, mark, save } from "../behavior_pack/scripts/runtime/store.js";
import { build, MAX_CUT, MAX_FILL, originAt } from "../behavior_pack/scripts/runtime/generation.js";
import { armDestruct, abortDestruct, ease, LEAF, requestDoor, restoreDoors, setSecurity, slid, SUBSTEPS, tickAlarms, tickDoors, travel } from "../behavior_pack/scripts/runtime/security.js";
import { column, MOUNTAIN } from "../behavior_pack/scripts/generation/mountain.js";
import { tickDefence } from "../behavior_pack/scripts/runtime/defence.js";
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
    for(let x=12;x<=14;x++)for(let z=33;z<=35;z++)if(x!==12||z!==34)
      assert.notEqual(at(x,hut,z).typeId,"minecraft:air",`Escape hut floor open at ${x},${hut},${z}`);
    assert.equal(at(12,hut,34).typeId,"minecraft:ladder","Escape ladder does not reach the hut");
    // The hut is dug into the back of the mountain; its door opens south, out onto clear ground.
    assert.ok(flood(hut+1,[13,34],{x0:10,x1:16,z0:32,z1:42}).has("13,42"),"Escape hut exit unreachable");
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
  const f=planBunker(s.origin,3,10,true,"hill");f.ground=s.ground;build(f,site());finishBuild();
  assert.equal(f.phase,"ready");
  const o=f.origin,rel=(x,y,z)=>blockAt(o.x+x,o.y+y,o.z+z).typeId;
  // Structures that stand above the pad: entrance, ladder shaft and escape hut.
  const built=(x,z)=>(x>=6&&x<=20&&z>=-4&&z<=17)||(x>=15&&x<=16&&z===16)||(x>=11&&x<=15&&z>=32&&z<=36);
  for(let x=-2;x<=28;x++)for(let z=-6;z<=39;z++){
    if(built(x,z))continue;
    assert.notEqual(rel(x,0,z),"minecraft:air",`No pad surface at ${x},${z}`);
    // The old hill is gone: what stands on the pad now is the mountain, solid to its surface.
    const top=column(f.seed,x,z).top;
    for(let y=1;y<=top;y++)assert.notEqual(rel(x,y,z),"minecraft:air",`Hollow in the mountain at ${x},${y},${z}`);
    for(let y=top+1;y<=top+MAX_CUT;y++)assert.equal(rel(x,y,z),"minecraft:air",`Hill left standing at ${x},${y},${z}`);
    // Beside the rooms and escape tunnel, nothing under the pad may be left hollow.
    if((x>=0&&x<=26&&z>=0&&z<=26)||(x>=11&&x<=15&&z>=26&&z<=36))continue;
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
  const lake=planBunker(s.origin,3,10,true,"lake");lake.ground=s.ground;build(lake,site());finishBuild();
  assert.ok(!["minecraft:air","minecraft:water"].includes(blockAt(lake.origin.x+27,77,lake.origin.z+26).typeId),"The bunker wall on the lake side is exposed");
  assert.equal(blockAt(lake.origin.x+28,77,lake.origin.z+30).typeId,"minecraft:dirt","Lake water under the pad is filled");
  reset();facilities.clear();
  terrain.height=(x,z)=>z>=235?78:80;terrain.water=(x,z)=>z>=235?82:undefined;
  assert.throws(()=>originAt(site()),/flood/,"water above the pad must be refused");
  terrain.water=()=>undefined;
  // A rise behind the footprint is cut back so the escape hut's exit stays open.
  terrain.height=(x,z)=>z>=240?90:80;
  s=originAt(site());assert.equal(s.cut,10);
  const hut=planBunker(s.origin,3,10,true,"hut");hut.ground=s.ground;build(hut,site());finishBuild();
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
test("self-destruct fires the charges and brings the whole bunker down",()=>{
  const {f}=make(3);armDestruct(f);assert.equal(f.countdown,90);assert.ok(f.doors.every(d=>d.open));
  assert.equal(abortDestruct(f),true);armDestruct(f);f.countdown=10;assert.equal(abortDestruct(f),false);
  for(let n=0;n<40;n++)tickDoors();
  // Inside the bunker itself: the escape tunnel and hut are the way out and are left standing.
  const count=id=>[...blocks].filter(([k,b])=>{const [x,,z]=k.split(",").map(Number);return b.typeId===ns+id&&x>=0&&x<=26&&z>=-4&&z<=26;}).length;
  const fittings=["keycard_reader","elevator_panel","security_console","self_destruct_console","server_rack","industrial_light","blast_door","security_door"];
  const before=Object.fromEntries(fittings.map(id=>[id,count(id)]));
  assert.ok(Object.values(before).every(n=>n>0));
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
  assert.equal(entities.filter(e=>e.typeId===ns+"laser_turret"||e.typeId===LEAF).length,0);
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
test("the bunker is buried in a mountain with its portal and escape exit left open",()=>{
  const {f}=make(3),o=f.origin,rel=(x,y,z)=>blockAt(o.x+x,o.y+y,o.z+z).typeId;
  // Solid rock over the lobby roof and every hut, with the mountain's surface where it should be.
  for(let x=6;x<=20;x++)for(let z=0;z<=17;z++){
    const top=column(f.seed,x,z).top;assert.ok(top>=12,`Thin cover over the entrance at ${x},${z}`);
    for(let y=9;y<=top;y++)assert.notEqual(rel(x,y,z),"minecraft:air",`Hole in the mountain at ${x},${y},${z}`);
    assert.equal(rel(x,top+1,z),"minecraft:air");
  }
  let peak=0;for(let x=MOUNTAIN.x0;x<=MOUNTAIN.x1;x++)for(let z=MOUNTAIN.z0;z<=MOUNTAIN.z1;z++)peak=Math.max(peak,column(f.seed,x,z).top);
  assert.ok(peak>=20,`A ${peak}-block mound is not a mountain`);
  // The forecourt is a cave mouth under an overhanging brow, open to the approach.
  for(let x=8;x<=18;x++)for(let z=-4;z<=-1;z++)for(let y=2;y<=(z===-1?6:8);y++)if(!(x===17&&y===2&&z===-2))assert.equal(rel(x,y,z),"minecraft:air",`Forecourt blocked at ${x},${y},${z}`);
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
test("write inspectable first-floor voxel preview",()=>{
  const {f}=make(5,104729);
  fs.mkdirSync(new URL("../docs/generated/",import.meta.url),{recursive:true});
  fs.writeFileSync(new URL("../docs/generated/bunker-preview.json",import.meta.url),JSON.stringify({facility:f,blocks:[...blocks]}));
});
