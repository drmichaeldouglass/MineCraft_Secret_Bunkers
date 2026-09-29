import test from "node:test";
import assert from "node:assert/strict";
import { clearance, isHostile, mayOpen, defenceActive, segmentDistance } from "../behavior_pack/scripts/core/rules.js";
import fs from "node:fs";
import { FLOOR_PROGRAMS, planBunker, ROOM_ROLES } from "../behavior_pack/scripts/generation/planner.js";
import { chooseExit, exitCandidates, exitKind, EXITS, MIN_COVER, REMOTE, SITE, siteColumns } from "../behavior_pack/scripts/generation/tunnel.js";
import { MOUNTAIN } from "../behavior_pack/scripts/generation/mountain.js";
import { BUILDINGS, COMPOUND, ESTATE_SEARCH, GARDEN_EXIT, planEstate } from "../behavior_pack/scripts/generation/estate.js";
import { intersects } from "../behavior_pack/scripts/core/types.js";
const ns="secretfacilities:";
test("clearance hierarchy and Creative-only master card",()=>{
  assert.equal(clearance([],false),0);
  assert.equal(clearance([ns+"keycard_blue",ns+"keycard_green"],false),2);
  assert.equal(clearance([ns+"keycard_master"],false),0);
  assert.equal(clearance([ns+"keycard_master"],true),5);
  assert.equal(clearance([ns+"keycard_black"],false),4);
});
test("lockdown access and evacuation overrides",()=>{
  assert.equal(mayOpen("NORMAL",1,2),false);assert.equal(mayOpen("NORMAL",2,2),true);
  assert.equal(mayOpen("LOCKDOWN",3,1),false);assert.equal(mayOpen("LOCKDOWN",4,4),true);
  assert.equal(mayOpen("SELF_DESTRUCT",0,4),true);assert.equal(mayOpen("DESTROYED",0,4),true);
});
test("target filter refuses players, passive, neutral, pets, and facilities",()=>{
  for(const type of ["player","cow","sheep","villager","villager_v2","wolf","cat","horse","iron_golem","enderman","spider","piglin","zombified_piglin"])
    assert.equal(isHostile("minecraft:"+type),false,type);
  for(const type of ["laser_turret","missile_turret","missile"])assert.equal(isHostile(ns+type),false,type);
  for(const type of ["zombie","skeleton","creeper","witch","pillager","phantom"])assert.equal(isHostile("minecraft:"+type),true,type);
  assert.equal(isHostile("minecraft:zombie",true),false);
});
test("defence modes honor alarms, disable, destruction, and final evacuation",()=>{
  assert.equal(defenceActive("ACTIVE","NORMAL"),true);
  assert.equal(defenceActive("STANDBY","LOCKDOWN"),false);
  assert.equal(defenceActive("OFFLINE","LOCKDOWN"),false);
  assert.equal(defenceActive("ALERT_ONLY","NORMAL"),false);
  assert.equal(defenceActive("ALERT_ONLY","ALERT"),true);
  assert.equal(defenceActive("LOCKDOWN_ONLY","ALERT"),false);
  assert.equal(defenceActive("LOCKDOWN_ONLY","LOCKDOWN"),true);
  assert.equal(defenceActive("ACTIVE","SELF_DESTRUCT",11),true);
  assert.equal(defenceActive("ACTIVE","SELF_DESTRUCT",10),false);
  assert.equal(defenceActive("ACTIVE","DESTROYED"),false);
});
test("beam intersection handles horizontal, vertical and degenerate segments",()=>{
  assert.equal(segmentDistance({x:2,y:0,z:0},{x:0,y:0,z:0},{x:4,y:0,z:0}),0);
  assert.equal(segmentDistance({x:1,y:2,z:0},{x:0,y:0,z:0},{x:0,y:4,z:0}),1);
  assert.equal(segmentDistance({x:3,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:0}),3);
});
test("600 layouts: required rooms, non-overlap, floor alignment, bounds, unique IDs",()=>{
  for(let levels=3;levels<=8;levels++)for(let seed=0;seed<100;seed++){
    const f=planBunker({x:-32,y:80,z:10},levels,seed,true);
    assert.equal(f.modules.length,levels*9+1);assert.equal(f.floors.length,levels+1);
    assert.equal(new Set(f.doors.map(d=>d.id)).size,f.doors.length);
    assert.equal(new Set(f.turrets.map(t=>t.id)).size,f.turrets.length);
    for(let floor=1;floor<=levels;floor++){
      const mods=f.modules.filter(m=>m.floor===floor),core=mods.find(m=>m.role==="vertical_core");
      assert.ok(core);assert.equal(core.pos.x+4.5,f.floors[floor].destination.x);
      assert.equal(core.pos.z+4.5,f.floors[floor].destination.z);
      assert.equal(f.floors[floor].y,80-floor*9);
      // Every fixed room of the floor's program is present; the rest come from its pool.
      const program=FLOOR_PROGRAMS[floor-1],rooms=mods.filter(m=>m.pos.z!==core.pos.z).map(m=>m.role);
      assert.equal(rooms.length,6);
      for(const role of new Set(program.fixed))
        assert.ok(rooms.filter(r=>r===role).length>=program.fixed.filter(r=>r===role).length,`B${floor} is missing its ${role}`);
      for(const role of rooms)assert.ok(program.fixed.includes(role)||program.pool.includes(role),`B${floor} has a stray ${role}`);
      assert.equal(mods.find(m=>m.pos.x===core.pos.x-9&&m.pos.z===core.pos.z-9).role,program.fixed[0]);
      for(let a=0;a<mods.length;a++)for(let b=a+1;b<mods.length;b++){
        const box=m=>({min:m.pos,max:{x:m.pos.x+8,y:m.pos.y+6,z:m.pos.z+8}});
        assert.equal(intersects(box(mods[a]),box(mods[b])),false);
      }
    }
    // Charges sit one block outside the walls: never inside a room, never in the open.
    assert.equal(f.charges.length,levels*12-1+4);
    for(const c of f.charges){
      const x=c.x+32,z=c.z-10;
      assert.ok(c.y>80?(x===5||x===21):(x===-1||x===27||z===-1||z===27),`charge inside the walls at ${JSON.stringify(c)}`);
    }
    for(const door of f.doors)for(const pos of [door.min,door.max,...door.readers,...f.charges]){
      assert.ok(pos.x>=f.bounds.min.x&&pos.x<=f.bounds.max.x);
      assert.ok(pos.y>=f.bounds.min.y&&pos.y<=f.bounds.max.y);
      assert.ok(pos.z>=f.bounds.min.z&&pos.z<=f.bounds.max.z);
    }
  }
});
/** A shared position silently hides one fixture behind another in the interact registry and lets a
 *  later installation overwrite an earlier block. */
function claimsDistinct(f,label){
  const seen=new Map();
  const claim=(pos,what)=>{
    const k=`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
    assert.equal(seen.get(k),undefined,`${label}: ${what} shares ${k} with ${seen.get(k)}`);
    seen.set(k,what);
  };
  for(const station of f.consoles)claim(station.pos,`console:${station.kind}`);
  for(const floor of f.floors)claim(floor.panel,`panel:${floor.name}`);
  for(const light of f.lights)claim(light,"light");
  for(const turret of f.turrets)claim({...turret.pos,y:turret.pos.y-1},`mount:${turret.id}`);
  for(const charge of f.charges)claim(charge,"charge");
  for(const door of f.doors){
    for(let x=door.min.x;x<=door.max.x;x++)for(let y=door.min.y;y<=door.max.y;y++)for(let z=door.min.z;z<=door.max.z;z++)
      claim({x,y,z},`door:${door.id}`);
    for(const reader of door.readers)claim(reader,`reader:${door.id}`);
  }
  for(const laser of f.lasers){
    // Horizontal beams run along z in the halls and along x across the tunnel.
    const flat=laser.a.y===laser.b.y,alongX=laser.a.z===laser.b.z;
    claim(!flat?{...laser.a,y:laser.a.y-1}:alongX?{...laser.a,x:laser.a.x-1}:{...laser.a,z:laser.a.z-1},"emitter");
    claim(!flat?{...laser.b,y:Math.ceil(laser.b.y)}:alongX?{...laser.b,x:laser.b.x+1}:{...laser.b,z:laser.b.z+1},"receiver");
  }
  for(const lamp of f.exit.lamps)claim(lamp,"tunnel lamp");
}
test("every generated fixture claims a distinct block",()=>{
  for(let levels=3;levels<=8;levels++)claimsDistinct(planBunker({x:-32,y:80,z:10},levels,levels*31,true),`bunker, ${levels} floors`);
  for(let levels=3;levels<=5;levels++)claimsDistinct(planEstate({x:-32,y:80,z:10},levels,levels*31,true),`estate, ${levels} floors`);
});
test("seed repeatability and invalid depth guards",()=>{
  const args=[{x:0,y:80,z:0},5,901,true];assert.deepEqual(planBunker(...args),planBunker(...args));
  assert.notDeepEqual(planBunker(...args).modules,planBunker(args[0],5,902,true).modules);
  for(const levels of [0,2,9,3.2])assert.throws(()=>planBunker(args[0],levels,1,false));
  assert.throws(()=>planBunker({x:0,y:0,z:0},8,1,false));
  assert.equal(planBunker(...args.slice(0,3),false).turrets.length,0);
});
test("every room the floor programs can place has north and south templates",()=>{
  const names=new Set(JSON.parse(fs.readFileSync(new URL("../tools/generated/template_voxels.json",import.meta.url),"utf8")).map(t=>t.name));
  assert.equal(ROOM_ROLES.length,19);
  for(const role of ROOM_ROLES)for(const side of ["north","south"])assert.ok(names.has(`${role}_${side}`),`${role}_${side} missing`);
  for(const name of ["bedroom","lounge","farm","mining"])assert.ok(ROOM_ROLES.includes(name));
});
test("secret tunnels: every direction reaches its exit, stays inside the reserved bounds and never enters the mountain",()=>{
  const o={x:-32,y:80,z:10};
  for(const c of exitCandidates())for(const kind of REMOTE){
    const f=planBunker(o,4,c.rank,true,"t",{kind,heading:c.heading,x:c.x,z:c.z,level:84,ground:"minecraft:grass_block"}),e=f.exit;
    assert.equal(e.kind,kind);assert.deepEqual([e.ladder.x-o.x,e.ladder.y,e.ladder.z-o.z],[c.x,84,c.z]);
    for(const q of e.passages)for(const v of [q.lining.min,q.lining.max,q.interior.min,q.interior.max]){
      assert.ok(v.x>=f.bounds.min.x&&v.x<=f.bounds.max.x&&v.z>=f.bounds.min.z&&v.z<=f.bounds.max.z,`${c.heading}: tunnel outside bounds`);
      // Interiors sit inside their linings.
      assert.ok(q.interior.min.x>=q.lining.min.x&&q.interior.max.z<=q.lining.max.z);
    }
    // The exit site and its levelled margin clear the mountain on every side.
    const rx=e.ladder.x-o.x,rz=e.ladder.z-o.z;
    assert.ok(rx-SITE>MOUNTAIN.x1||rx+SITE<MOUNTAIN.x0||rz-SITE>MOUNTAIN.z1,`${c.heading} ${c.rank}: exit site under the mountain`);
    assert.ok(f.bounds.max.y>=84+EXITS[kind].height,"The exit's structure is outside the reserved bounds");
    // The ladder ends at the tunnel's capped end, whatever the direction.
    const last=e.passages[e.passages.length-1].interior;
    assert.ok(e.ladder.x>=last.min.x&&e.ladder.x<=last.max.x&&e.ladder.z>=last.min.z&&e.ladder.z<=last.max.z,"The ladder is not in the tunnel");
    assert.equal(f.turrets.filter(t=>t.zone==="tunnel").length,1);assert.equal(f.zones.tunnel,"ALERT_ONLY");
    assert.ok(f.doors.some(d=>d.id==="tunnel"));
  }
  const back=planBunker(o,4,1,false,"t",{kind:"rock_face"});
  assert.equal(back.exit.kind,"rock_face");assert.equal(back.zones.tunnel,undefined);
  assert.ok(!back.turrets.some(t=>t.zone==="tunnel"),"No junction, no junction turret");
});
test("the exit follows the ground: trees, sand, rock and open land, and no site means the rock face",()=>{
  const sample=(ground,canopy=false,floor=80)=>({floor,liquid:false,ground,canopy});
  const flat=(make)=>siteColumns({x:0,z:0}).map(make);
  assert.equal(exitKind(flat((_,i)=>sample("minecraft:grass_block",i%2===0)),1),"forest_cabin");
  assert.equal(exitKind(flat(()=>sample("minecraft:sand")),1),"well");
  assert.equal(exitKind(flat(()=>sample("minecraft:stone")),1),"mine_headframe");
  const open=new Set();for(let seed=0;seed<40;seed++)open.add(exitKind(flat(()=>sample("minecraft:grass_block")),seed));
  assert.deepEqual([...open].sort(),["hidden_hatch","utility_shed","well"]);
  const surveys=(make,routeLow=80)=>exitCandidates().map(c=>({...c,samples:siteColumns(c).map(([x,z])=>make(c,x,z)),routeLow}));
  // Only the east is dry, level and high enough.
  const east=surveys(c=>c.heading==="east"?sample("minecraft:grass_block"):{...sample("minecraft:grass_block"),liquid:true});
  for(let seed=0;seed<10;seed++)assert.equal(chooseExit(east,80,seed).heading,"east");
  // Rough ground, a valley below the tunnel, a tunnel with too little cover, or unread ground are all passed over.
  const rough=surveys((c,x)=>sample("minecraft:grass_block",false,80+(Math.abs(x-c.x)/2%2?6:-6)));
  assert.equal(chooseExit(rough,80,1).kind,"rock_face");
  assert.equal(chooseExit(surveys(()=>sample("minecraft:grass_block",false,80+MIN_COVER-1)),80,1).kind,"rock_face");
  assert.equal(chooseExit(surveys(()=>sample("minecraft:grass_block"),80+MIN_COVER-1),80,1).kind,"rock_face");
  assert.equal(chooseExit(surveys(()=>undefined),80,1).kind,"rock_face");
  // Level ground a few blocks up is fine; the flattest site wins, and a chosen kind is honoured.
  const good=surveys((c,x,z)=>sample("minecraft:grass_block",false,c.heading==="west"?85:80+((x+z)%4===0?2:0)));
  const pick=chooseExit(good,80,3);assert.equal(pick.heading,"west");assert.equal(pick.level,85);assert.equal(pick.cut+pick.fill,0);
  assert.equal(chooseExit(good,80,3,"forest_cabin").kind,"forest_cabin");
  assert.equal(chooseExit(good,80,3,"rock_face").kind,"rock_face");
  assert.deepEqual(chooseExit(good,80,3),chooseExit(good,80,3),"The choice is repeatable for a seed");
});
test("fortified estates: a walled compound over a bunker, with every fixture inside its reserved bounds",()=>{
  const o={x:-32,y:80,z:10},inBounds=(f,v)=>v.x>=f.bounds.min.x&&v.x<=f.bounds.max.x&&v.y>=f.bounds.min.y&&v.y<=f.bounds.max.y&&v.z>=f.bounds.min.z&&v.z<=f.bounds.max.z;
  for(let levels=3;levels<=5;levels++)for(let seed=0;seed<40;seed++){
    const f=planEstate(o,levels,seed,true);
    assert.equal(f.type,"estate");assert.equal(f.floors.length,levels+1);
    assert.equal(f.modules.length,levels*9+BUILDINGS.length);
    assert.equal(new Set(f.doors.map(d=>d.id)).size,f.doors.length);
    assert.equal(new Set(f.turrets.map(t=>t.id)).size,f.turrets.length);
    // The gate is the facility's main door, and the mansion's lift lands where the bunker's lift expects.
    assert.equal(f.doors[0].id,"gate");assert.equal(f.doors[0].kind,"blast");
    assert.deepEqual([f.floors[0].destination.x-o.x,f.floors[0].destination.z-o.z],[13.5,13.5]);
    for(let floor=1;floor<=levels;floor++)assert.equal(f.floors[floor].y,80-floor*9);
    // Only the underground floors carry charges; B1 leaves the tunnel's wall alone.
    assert.equal(f.charges.length,levels*12-1);
    for(const v of [...f.doors.flatMap(d=>[d.min,d.max,...d.readers]),...f.charges,...f.lights,...f.turrets.map(t=>t.pos),...f.consoles.map(c=>c.pos)])
      assert.ok(inBounds(f,v),`Outside the reserved bounds: ${JSON.stringify(v)}`);
    for(const m of f.modules.filter(m=>m.size))assert.ok(inBounds(f,m.pos)&&inBounds(f,{x:m.pos.x+m.size.x-1,y:m.pos.y+m.size.y-1,z:m.pos.z+m.size.z-1}),m.template);
    // Every building stands inside the wall, clear of every other one.
    const surface=f.modules.filter(m=>m.size&&m.role!=="gate_pillar");
    for(const m of surface){
      assert.ok(m.pos.x-o.x>COMPOUND.x0&&m.pos.x-o.x+m.size.x-1<COMPOUND.x1&&m.pos.z-o.z>COMPOUND.z0&&m.pos.z-o.z+m.size.z-1<COMPOUND.z1,`${m.template} crosses the wall`);
      for(const n of surface)if(n!==m)assert.ok(!intersects({min:m.pos,max:{x:m.pos.x+m.size.x-1,y:99,z:m.pos.z+m.size.z-1}},{min:n.pos,max:{x:n.pos.x+n.size.x-1,y:99,z:n.pos.z+n.size.z-1}}),`${m.template} overlaps ${n.template}`);
    }
    assert.deepEqual(Object.keys(f.zones).sort(),["command","gate","perimeter","tunnel"]);
    assert.equal(f.turrets.filter(t=>t.zone==="perimeter").length,5);assert.equal(f.turrets.filter(t=>t.zone==="gate").length,2);
  }
  assert.equal(planEstate(o,3,1,false).turrets.length,0);
  for(const levels of [2,6])assert.throws(()=>planEstate(o,levels,1,true),/3–5/);
  // Remote exits lie beyond the wall; with none, the tunnel comes up in the back garden.
  const candidates=exitCandidates(ESTATE_SEARCH);
  assert.deepEqual([...new Set(candidates.map(c=>c.heading))].sort(),["east","south","west"]);
  for(const heading of ["east","south","west"])assert.ok(candidates.filter(c=>c.heading===heading).length>=3,`Too few ${heading} sites`);
  for(const c of candidates)assert.ok(c.x+SITE<COMPOUND.x0||c.x-SITE>COMPOUND.x1||c.z-SITE>COMPOUND.z1,`${c.heading} ${c.rank} inside the compound`);
  const garden=planEstate(o,3,1,true,"g",{kind:"rock_face"});
  assert.equal(garden.exit.kind,"well");assert.deepEqual([garden.exit.ladder.x-o.x,garden.exit.ladder.z-o.z],[GARDEN_EXIT(80).x,GARDEN_EXIT(80).z]);
  assert.ok(garden.exit.ladder.z-o.z+SITE<COMPOUND.z1,"The garden well must be inside the wall");
});
