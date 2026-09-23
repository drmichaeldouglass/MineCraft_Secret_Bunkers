import test from "node:test";
import assert from "node:assert/strict";
import { clearance, isHostile, mayOpen, defenceActive, segmentDistance } from "../behavior_pack/scripts/core/rules.js";
import { planBunker } from "../behavior_pack/scripts/generation/planner.js";
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
  assert.equal(isHostile(ns+"laser_turret"),false);
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
      assert.ok(mods.some(m=>m.role===["security","barracks","command","generator","vault","archive","laboratory","vault"][floor-1]));
      for(let a=0;a<mods.length;a++)for(let b=a+1;b<mods.length;b++){
        const box=m=>({min:m.pos,max:{x:m.pos.x+8,y:m.pos.y+6,z:m.pos.z+8}});
        assert.equal(intersects(box(mods[a]),box(mods[b])),false);
      }
    }
    for(const door of f.doors)for(const pos of [door.min,door.max,...door.readers]){
      assert.ok(pos.x>=f.bounds.min.x&&pos.x<=f.bounds.max.x);
      assert.ok(pos.y>=f.bounds.min.y&&pos.y<=f.bounds.max.y);
      assert.ok(pos.z>=f.bounds.min.z&&pos.z<=f.bounds.max.z);
    }
  }
});
test("every generated fixture claims a distinct block",()=>{
  // A shared position silently hides one fixture behind another in the interact registry
  // and lets a later installation overwrite an earlier block.
  for(let levels=3;levels<=8;levels++){
    const f=planBunker({x:-32,y:80,z:10},levels,levels*31,true),seen=new Map();
    const claim=(pos,label)=>{
      const k=`${Math.floor(pos.x)},${Math.floor(pos.y)},${Math.floor(pos.z)}`;
      assert.equal(seen.get(k),undefined,`${levels} floors: ${label} shares ${k} with ${seen.get(k)}`);
      seen.set(k,label);
    };
    for(const station of f.consoles)claim(station.pos,`console:${station.kind}`);
    for(const floor of f.floors)claim(floor.panel,`panel:${floor.name}`);
    for(const light of f.lights)claim(light,"light");
    for(const turret of f.turrets)claim({...turret.pos,y:turret.pos.y-1},`mount:${turret.id}`);
    for(const door of f.doors){
      for(let x=door.min.x;x<=door.max.x;x++)for(let y=door.min.y;y<=door.max.y;y++)for(let z=door.min.z;z<=door.max.z;z++)
        claim({x,y,z},`door:${door.id}`);
      for(const reader of door.readers)claim(reader,`reader:${door.id}`);
    }
    for(const laser of f.lasers){
      const flat=laser.a.y===laser.b.y;
      claim(flat?{...laser.a,z:laser.a.z-1}:{...laser.a,y:laser.a.y-1},"emitter");
      claim(flat?{...laser.b,z:laser.b.z+1}:{...laser.b,y:Math.ceil(laser.b.y)},"receiver");
    }
  }
});
test("seed repeatability and invalid depth guards",()=>{
  const args=[{x:0,y:80,z:0},5,901,true];assert.deepEqual(planBunker(...args),planBunker(...args));
  assert.notDeepEqual(planBunker(...args).modules,planBunker(args[0],5,902,true).modules);
  for(const levels of [0,2,9,3.2])assert.throws(()=>planBunker(args[0],levels,1,false));
  assert.throws(()=>planBunker({x:0,y:0,z:0},8,1,false));
  assert.equal(planBunker(...args.slice(0,3),false).turrets.length,0);
});
