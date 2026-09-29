import { BlockVolume, GameMode, system, world, type Block, type Dimension, type Player } from "@minecraft/server";
import { add, intersects, NS, type Bounds, type ExitKind, type Facility, type Vec } from "../core/types.js";
import { FLOOR_STEP, MODULE } from "../generation/planner.js";
import { column, MOUNTAIN, PAD, PEAK, rearExit, type Box } from "../generation/mountain.js";
import { chooseExit, EXIT_FILL, exitCandidates, EXITS, routeColumns, SITE, siteColumns, type ExitSite, type SiteSample } from "../generation/tunnel.js";
import { COMPOUND, DRIVE, ESTATE_PAD, ESTATE_SEARCH, WALL_HEIGHT } from "../generation/estate.js";
import { facilities, levelGrids, mark, save } from "./store.js";
import { dim, fill, loaded, report, set, tell } from "./world.js";
const active=new Set<string>();
type Operation=()=>void;
const PAUSED="Build paused because its chunks unloaded. Return here and use Resume in the deployment device.";
/** The ground a facility levels: the bunker's pad, or the estate's compound and its margin. */
const padOf=(f:Facility):Box => f.type==="estate"?ESTATE_PAD:PAD;
const within=(b:Box,x:number,z:number):boolean => x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1;
/** Ground may rise or fall this far from the chosen surface level; earthworks cut and fill it
 *  to a level pad, so no floor surfaces through a hillside. Columns are sampled every few blocks. */
export const MAX_CUT=12, MAX_FILL=12;
const SURVEY_STEP=5;
/** The pad is cleared well above the highest cut so trees on it do not float, and above the
 *  mountain's peak so none of the old hill pokes through it. Bands keep each fill small. */
const CLEAR_HEIGHT=Math.max(MAX_CUT+12,PEAK+2), PAD_BAND=6;
/** What the fill below the pad may replace: holes, caves, water and lava, never solid ground. */
export const LOOSE=["minecraft:air","minecraft:water","minecraft:flowing_water","minecraft:lava","minecraft:flowing_lava"];
const EARTH=["minecraft:grass_block","minecraft:dirt","minecraft:coarse_dirt","minecraft:podzol","minecraft:mycelium",
  "minecraft:snow","minecraft:moss_block","minecraft:mud"];
const ROCK=["minecraft:stone","minecraft:deepslate","minecraft:andesite","minecraft:diorite","minecraft:granite",
  "minecraft:tuff","minecraft:calcite","minecraft:gravel"];
/** The pad's top block and the fill under it, matched to the natural surface at the entrance. */
export function padMaterial(ground:string):[string,string] {
  if(ground==="minecraft:sand")return [ground,"minecraft:sandstone"];
  if(ground==="minecraft:red_sand")return [ground,"minecraft:red_sandstone"];
  if(EARTH.includes(ground))return [ground,"minecraft:dirt"];
  if(ROCK.includes(ground))return [ground,"minecraft:stone"];
  if(ground.endsWith("terracotta"))return [ground,ground];
  return ["minecraft:grass_block","minecraft:dirt"];
}
function installations(f:Facility):Operation[] {
  const d=dim(f),o=f.origin,p=(x:number,y:number,z:number)=>add(o,{x,y,z}),low=f.floors[f.floors.length-1].y;
  const ops:Operation[]=[];
  // Dry, reinforced emergency ladder shaft. One floor-height segment per operation.
  // Only the ladder column is cut through the floors: an open column beside it would be
  // a drop from the surface lobby to the deepest floor.
  for(let y=low+1;y<=o.y+5;y+=FLOOR_STEP){const top=Math.min(y+FLOOR_STEP-1,o.y+5);
    ops.push(()=>{fill(d,{x:o.x+16,y,z:o.z+16},{x:o.x+16,y:top,z:o.z+16},"steel_wall");
      fill(d,{x:o.x+15,y,z:o.z+16},{x:o.x+15,y:top,z:o.z+16},"minecraft:ladder",{facing_direction:4});});}
  if(!rearExit(f)){ops.push(...tunnel(f));return [...ops,...fittings(f)];}
  // B1 rear escape tunnel and a second ladder to a discreet surface utility hut.
  // It opens from the back of the room south of the lobby, whose aisle is cleared through to it.
  ops.push(()=>{fill(d,p(11,-9,26),p(15,-5,36),"reinforced_concrete");fill(d,p(12,-8,22),p(14,-6,35),"minecraft:air");
    set(d,p(13,-5,31),"industrial_light");});
  ops.push(()=>{fill(d,p(11,-5,32),p(15,4,36),"reinforced_concrete");fill(d,p(12,-5,33),p(14,3,35),"minecraft:air");
    // Hut floor; the ladder then cuts its own opening. Without it the exit is two blocks of open shaft away.
    fill(d,p(12,0,33),p(14,0,35),"industrial_floor");
    fill(d,p(12,-8,34),p(12,3,34),"minecraft:ladder",{facing_direction:5});
    // The hut is dug into the back of the mountain, so its door faces away from it, south.
    fill(d,p(13,1,36),p(14,2,36),"minecraft:air");set(d,p(13,4,34),"industrial_light");});
  return [...ops,...fittings(f)];
}
/** The secret tunnel to a remote exit: the exit site levelled, then sealed and lined pieces and their
 *  open interiors, then the exit's shaft, its structure and the ladder up through it all. */
function tunnel(f:Facility):Operation[] {
  const d=dim(f),o=f.origin,e=f.exit!,l=e.ladder,ops:Operation[]=[],edge={ignoreChunkBoundErrors:true};
  const need=(...at:Vec[])=>{if(!at.every(v=>loaded(d,v)))throw Error(PAUSED);};
  const grown=(b:Bounds):BlockVolume=>new BlockVolume(add(b.min,{x:-1,y:-1,z:-1}),add(b.max,{x:1,y:1,z:1}));
  const [top,under]=padMaterial(e.ground),lo={x:l.x-SITE,z:l.z-SITE},hi={x:l.x+SITE,z:l.z+SITE};
  // Level the exit site first: its backfill would otherwise plug a tunnel running close beneath it.
  ops.push(()=>{
    need({...lo,y:l.y},{...hi,y:l.y});
    d.fillBlocks(new BlockVolume({...lo,y:l.y+1},{...hi,y:l.y+12}),"minecraft:air",edge);
    d.fillBlocks(new BlockVolume({...lo,y:l.y-EXIT_FILL-2},{...hi,y:l.y-1}),under,{...edge,blockFilter:{includeTypes:LOOSE}});
    d.fillBlocks(new BlockVolume({...lo,y:l.y},{...hi,y:l.y}),top,edge);
  });
  e.passages.forEach((piece,i)=>ops.push(()=>{
    need(piece.lining.min,piece.lining.max);
    // Seal any cave or ravine the tunnel crosses, so its lining is never left hanging in the open.
    // The first piece leaves the bunker itself, whose room must not be filled.
    if(i>0)d.fillBlocks(grown(piece.lining),"minecraft:stone",{...edge,blockFilter:{includeTypes:LOOSE}});
    fill(d,piece.lining.min,piece.lining.max,"reinforced_concrete");
  }));
  for(const piece of e.passages)ops.push(()=>fill(d,piece.interior.min,piece.interior.max,"minecraft:air"));
  ops.push(()=>{for(const lamp of e.lamps)set(d,lamp,"industrial_light");});
  // The shaft rises from the tunnel roof to just under the exit's floor.
  ops.push(()=>{
    d.fillBlocks(new BlockVolume({x:l.x-2,y:o.y-5,z:l.z-2},{x:l.x+2,y:l.y-1,z:l.z+2}),"minecraft:stone",{...edge,blockFilter:{includeTypes:LOOSE}});
    fill(d,{x:l.x-1,y:o.y-5,z:l.z-1},{x:l.x+1,y:l.y-1,z:l.z+1},"reinforced_concrete");
  });
  ops.push(()=>{need({...lo,y:l.y},{...hi,y:l.y});world.structureManager.place(NS+"tunnel/exit_"+e.kind,d,{x:l.x-3,y:l.y,z:l.z-3},{includeEntities:false});});
  ops.push(()=>fill(d,{x:l.x,y:o.y-8,z:l.z},{x:l.x,y:l.y+EXITS[e.kind].ladderTop,z:l.z},"minecraft:ladder",{facing_direction:e.facing}));
  return ops;
}
/** Doors, readers, panels, consoles, lamps, grids and turrets at their registered positions. */
function fittings(f:Facility):Operation[] {
  const d=dim(f),ops:Operation[]=[];
  for(const door of f.doors)ops.push(()=>{
    const id=door.kind==="blast"?"blast_door":door.kind==="shutter"?"security_shutter":"security_door";
    fill(d,door.min,door.max,id,{[NS+"open"]:door.open,[NS+"slide"]:0});
    for(const r of door.readers)set(d,r,"keycard_reader");
  });
  for(const floor of f.floors)ops.push(()=>set(d,floor.panel,"elevator_panel"));
  for(const c of f.consoles)ops.push(()=>set(d,c.pos,c.kind==="security"?"security_console":c.kind==="defence"?"turret_control_console":"self_destruct_console"));
  for(const light of f.lights)ops.push(()=>set(d,light,"emergency_light",{[NS+"active"]:false}));
  for(const laser of f.lasers)ops.push(()=>{
    if(laser.a.y===laser.b.y){
      // Horizontal beams run along z or, across a tunnel, along x; the fittings sit in the walls at each end.
      const alongX=laser.a.z===laser.b.z?1:0;
      set(d,{x:Math.floor(laser.a.x)-alongX,y:Math.floor(laser.a.y),z:Math.floor(laser.a.z)-(1-alongX)},"laser_emitter");
      set(d,{x:Math.floor(laser.b.x)+alongX,y:Math.floor(laser.b.y),z:Math.floor(laser.b.z)+(1-alongX)},"laser_receiver");
    }else{
      set(d,{x:Math.floor(laser.a.x),y:Math.floor(laser.a.y)-1,z:Math.floor(laser.a.z)},"laser_emitter");
      set(d,{x:Math.floor(laser.b.x),y:Math.ceil(laser.b.y),z:Math.floor(laser.b.z)},"laser_receiver");
    }
  });
  for(const turret of f.turrets)ops.push(()=>{
    const tag=`sf:${f.id}:${turret.id}`;
    if(d.getEntities({type:NS+"laser_turret",tags:[tag]}).length)return;
    set(d,{x:Math.floor(turret.pos.x),y:turret.pos.y-1,z:Math.floor(turret.pos.z)},"laser_turret_mount");
    const e=d.spawnEntity(NS+"laser_turret",turret.pos);e.addTag(tag);e.setDynamicProperty(NS+"facility",f.id);e.setDynamicProperty(NS+"turret",turret.id);
    e.nameTag=`§7${turret.zone.toUpperCase()} DEFENCE`;
  });
  return ops;
}
/** Level the site to the surface level: clear everything above it, fill every hole below it
 *  down to the deepest permitted fill, and lay a matching surface. */
function earthworks(f:Facility):Operation[] {
  // Facilities deployed before levelling existed resume their build without it.
  if(!f.ground)return [];
  const d=dim(f),o=f.origin,y=o.y,[top,under]=padMaterial(f.ground),ops:Operation[]=[],pad=padOf(f);
  const x0=o.x+pad.x0,x1=o.x+pad.x1,z1=o.z+pad.z1;
  // The pad's margin may reach unloaded chunks; those edges are simply left as they are.
  const edge={ignoreChunkBoundErrors:true};
  for(let z=o.z+pad.z0;z<=z1;z+=PAD_BAND){const zb=Math.min(z+PAD_BAND-1,z1);
    ops.push(()=>{
      d.fillBlocks(new BlockVolume({x:x0,y:y+1,z},{x:x1,y:y+CLEAR_HEIGHT,z:zb}),"minecraft:air",edge);
      d.fillBlocks(new BlockVolume({x:x0,y:y-MAX_FILL,z},{x:x1,y:y-1,z:zb}),under,{...edge,blockFilter:{includeTypes:LOOSE}});
      d.fillBlocks(new BlockVolume({x:x0,y,z},{x:x1,y,z:zb}),top,edge);
    });
  }
  // The estate is deployed from where its forecourt will be; a builder standing below the new
  // ground would be buried by the fill, so anyone there is lifted onto it.
  if(f.type==="estate")ops.push(()=>{
    for(const player of world.getAllPlayers())
      if(player.dimension.id===f.dimension&&within(pad,Math.floor(player.location.x)-o.x,Math.floor(player.location.z)-o.z)&&player.location.y<y+1)
        player.tryTeleport({...player.location,y:y+1});
  });
  return ops;
}
/** Solid rock around every underground slab, so no floor can surface through a hillside.
 *  It reaches two blocks past the walls, sealing in the demolition charges. */
function encasement(f:Facility):Operation[] {
  const d=dim(f),o=f.origin,span=3*MODULE-1,ops:Operation[]=[];
  for(const floor of f.floors.slice(1))for(let band=0;band<3;band++){
    const z0=o.z+(band===0?-2:band*MODULE),z1=o.z+(band===2?span+2:(band+1)*MODULE-1),top=floor.y+FLOOR_STEP-1;
    ops.push(()=>fill(d,{x:o.x-2,y:floor.y,z:z0},{x:o.x+span+2,y:top,z:z1},"minecraft:stone"));
  }
  // Ground the entrance forecourt so it never juts out over a slope.
  if(f.type==="bunker")ops.push(()=>fill(d,{x:o.x+6,y:o.y-4,z:o.z-4},{x:o.x+20,y:o.y-1,z:o.z-1},"minecraft:stone"));
  return ops;
}
/** Ground cover the mountain's skirts may bury, besides air and liquids. */
const COVERABLE=[...LOOSE,"minecraft:short_grass","minecraft:tall_grass","minecraft:fern","minecraft:large_fern",
  "minecraft:snow_layer","minecraft:dandelion","minecraft:poppy","minecraft:deadbush"];
/** Heap the mountain over the finished bunker, one row of columns per operation. Over the pad the
 *  column is built from just above the ground or a structure's roof; beyond it the skirts are only
 *  laid into air and water, so they drape over the surrounding terrain instead of cutting it. */
function mountain(f:Facility):Operation[] {
  if(!f.charges||f.type!=="bunker")return [];
  const d=dim(f),o=f.origin,[top,under]=padMaterial(f.ground??"minecraft:grass_block"),ops:Operation[]=[];
  const core=under==="minecraft:dirt"?"minecraft:stone":under,edge={ignoreChunkBoundErrors:true};
  const only={...edge,blockFilter:{includeTypes:COVERABLE}},rear=rearExit(f),passages=rear?[]:f.exit!.passages;
  const fillColumn=(x:number,z:number,a:number,b:number,block:string)=>{
    if(b>=a)d.fillBlocks(new BlockVolume({x:o.x+x,y:o.y+a,z:o.z+z},{x:o.x+x,y:o.y+b,z:o.z+z}),block,only);
  };
  // A skirt laid over a tunnel passing beneath it must not fill the tunnel, which is open air.
  const lay=(x:number,z:number,a:number,b:number,block:string)=>{
    const piece=passages.find(q=>o.x+x>=q.lining.min.x&&o.x+x<=q.lining.max.x&&o.z+z>=q.lining.min.z&&o.z+z<=q.lining.max.z);
    if(!piece)return fillColumn(x,z,a,b,block);
    fillColumn(x,z,a,Math.min(b,piece.lining.min.y-o.y-1),block);fillColumn(x,z,Math.max(a,piece.lining.max.y-o.y+1),b,block);
  };
  for(let z=MOUNTAIN.z0;z<=MOUNTAIN.z1;z++)ops.push(()=>{
    for(let x=MOUNTAIN.x0;x<=MOUNTAIN.x1;x++){
      const c=column(f.seed,x,z,rear);
      if(c.open){
        // Keep the approach and the hut's apron open at pad level, whatever the terrain beyond does.
        d.fillBlocks(new BlockVolume({x:o.x+x,y:o.y+1,z:o.z+z},{x:o.x+x,y:o.y+CLEAR_HEIGHT,z:o.z+z}),"minecraft:air",edge);
        lay(x,z,-MAX_FILL,-1,under);
        const path=z<0&&Math.abs(x-13)<=2;
        d.fillBlocks(new BlockVolume({x:o.x+x,y:o.y,z:o.z+z},{x:o.x+x,y:o.y,z:o.z+z}),path?"minecraft:coarse_dirt":top,edge);
        continue;
      }
      if(!c.top)continue;
      // Steep faces and the summit are bare rock; gentler slopes carry the local soil.
      const slope=Math.max(...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>Math.abs(c.top-column(f.seed,x+dx,z+dz,rear).top)));
      const rock=(x*7+z*13+f.seed)%5===0?"minecraft:andesite":core;
      const surface=c.top>=PEAK-2?"minecraft:snow":slope>=3?rock:top;
      lay(x,z,c.base,c.top-4,core);
      lay(x,z,Math.max(c.base,c.top-3),c.top-1,slope>=3?rock:under);
      lay(x,z,Math.max(c.base,c.top),c.top,surface);
    }
  });
  return ops;
}
/** Vanilla TNT sealed in the rock just outside the walls, and floodlights marking the portal. */
function charges(f:Facility):Operation[] {
  if(!f.charges)return [];
  const d=dim(f),o=f.origin;
  return [()=>{
    for(const c of f.charges!)set(d,c,"minecraft:tnt");
    if(f.type==="bunker")for(const x of [5,21])set(d,add(o,{x,y:6,z:-3}),"floodlight");
  }];
}
/** Surface vegetation that tolerates each levelled ground: flowers on soil, dead bushes on sand. */
const PLANTS:Record<string,string[]>={"minecraft:grass_block":["minecraft:poppy","minecraft:dandelion","minecraft:cornflower"],
  "minecraft:dirt":["minecraft:poppy","minecraft:dandelion"],"minecraft:podzol":["minecraft:fern"],"minecraft:sand":["minecraft:deadbush"],"minecraft:red_sand":["minecraft:deadbush"]};
/** The estate's grounds on the levelled pad: perimeter wall with a security fence and floodlights,
 *  the driveway, hedges, flower beds and garden paths. Laid before the buildings, so the gate pillars
 *  stand over the wall, and before the fittings, which set the gate's blast door into it. */
function grounds(f:Facility):Operation[] {
  if(f.type!=="estate")return [];
  const d=dim(f),o=f.origin,p=(x:number,y:number,z:number)=>add(o,{x,y,z}),C=COMPOUND,ops:Operation[]=[];
  const [top]=padMaterial(f.ground??"minecraft:grass_block"),plants=PLANTS[top]??[];
  const sides:[Vec,Vec][]=[[p(C.x0,0,C.z0),p(C.x1,0,C.z0)],[p(C.x0,0,C.z1),p(C.x1,0,C.z1)],[p(C.x0,0,C.z0),p(C.x0,0,C.z1)],[p(C.x1,0,C.z0),p(C.x1,0,C.z1)]];
  for(const [a,b] of sides)ops.push(()=>{
    fill(d,add(a,{x:0,y:1,z:0}),add(b,{x:0,y:1,z:0}),"dark_reinforced_concrete");
    fill(d,add(a,{x:0,y:2,z:0}),add(b,{x:0,y:WALL_HEIGHT,z:0}),"light_reinforced_concrete");
    fill(d,add(a,{x:0,y:WALL_HEIGHT+1,z:0}),add(b,{x:0,y:WALL_HEIGHT+1,z:0}),"minecraft:iron_bars");
  });
  ops.push(()=>{
    for(let x=C.x0+4;x<C.x1;x+=12)for(const z of [C.z0,C.z1])set(d,p(x,WALL_HEIGHT+1,z),"floodlight");
    for(let z=C.z0+10;z<C.z1;z+=12)for(const x of [C.x0,C.x1])set(d,p(x,WALL_HEIGHT+1,z),"floodlight");
  });
  ops.push(()=>{
    // The driveway runs from outside the gate to the mansion's front door, between hedges.
    fill(d,p(DRIVE.x0,0,C.z0-2),p(DRIVE.x1,0,1),"minecraft:smooth_stone");
    const leaves={persistent_bit:true,update_bit:false};
    // Posts in the hedges for the driveway grid's emitters and receivers.
    for(const x of [DRIVE.x0-1,DRIVE.x1+1])fill(d,p(x,1,-27),p(x,3,-27),"dark_reinforced_concrete");
    for(let z=C.z0+2;z<=-17;z++)for(const x of [DRIVE.x0-1,DRIVE.x1+1])
      if(z!==-27&&(x<DRIVE.x1||z<-26||z>-24))set(d,p(x,1,z),"minecraft:oak_leaves",leaves);
    // A paved yard before the garage bays, a path to the gatehouse door, and paths through the back garden.
    fill(d,p(-7,0,-24),p(DRIVE.x0-2,0,-10),"minecraft:smooth_stone");
    fill(d,p(DRIVE.x1+1,0,-25),p(18,0,-25),"minecraft:smooth_stone");
    fill(d,p(12,0,24),p(14,0,39),"minecraft:smooth_stone");fill(d,p(15,0,32),p(26,0,33),"minecraft:smooth_stone");
  });
  if(plants.length)ops.push(()=>{
    for(let x=-20;x<=6;x++)for(let z=-8;z<=-2;z++)if((x+z)%2===0)set(d,p(x,1,z),plants[Math.abs(x*3+z)%plants.length]);
    for(let x=32;x<=46;x++)for(let z=-8;z<=-2;z++)if((x+z)%2===0)set(d,p(x,1,z),plants[Math.abs(x+z*5)%plants.length]);
  });
  return ops;
}
export function build(f:Facility,player:Player):void {
  if(player.getGameMode()!==GameMode.Creative)throw Error("Deployment is Creative-only.");
  if(active.has(f.id))throw Error("This facility is already being built.");
  if(facilities.size>=16&&!facilities.has(f.id))throw Error("This alpha supports at most 16 registered facilities per world.");
  for(const other of facilities.values())if(other.id!==f.id && other.dimension===f.dimension && intersects(f.bounds,other.bounds,8))throw Error("Another facility overlaps this site. Move farther away.");
  const d=dim(f);
  // The mountain's skirts may run into unloaded chunks; the pad itself must be loaded.
  const pad=padOf(f),corners=[pad.x0,pad.x1].flatMap(x=>[pad.z0,pad.z1].map(z=>add(f.origin,{x,y:0,z})));
  if(!rearExit(f)){const l=f.exit!.ladder;for(const dx of [-SITE,SITE])for(const dz of [-SITE,SITE])corners.push(add(l,{x:dx,y:0,z:dz}));}
  if(!corners.every(c=>loaded(d,c)))throw Error("The full site, including the escape exit, must be loaded. Move closer or raise simulation distance, then retry.");
  facilities.set(f.id,f);f.phase="building";save(f);active.add(f.id);
  // Level ground, then rock, then modules carved into it, then fittings, then the mountain over it all.
  const ops:Operation[]=[...earthworks(f),...encasement(f),...grounds(f)];
  ops.push(...f.modules.map(m=>()=>{
    const size=m.size??(m.template==="entrance"?{x:15,y:9,z:22}:{x:MODULE,y:7,z:MODULE});
    if(!loaded(d,m.pos)||!loaded(d,add(m.pos,{x:size.x-1,y:size.y-1,z:size.z-1})))throw Error(PAUSED);
    world.structureManager.place(NS+(m.template.includes("/")?m.template:"bunker/"+m.template),d,m.pos,{includeEntities:false});
  }));
  ops.push(...installations(f),...mountain(f),...charges(f));
  const task=system.runInterval(()=>{
    try{
      if(f.buildStep>=ops.length){
        f.phase="ready";levelGrids(f);save(f);active.delete(f.id);system.clearRun(task);
        // Messaging a departed player throws; a finished build must not fall into the failure path.
        if(player.isValid)tell(player,f.type==="estate"?`§aEstate ready: ${f.id}. The gate faces north (−Z); use its reader with a keycard, then the reader at the mansion's front door.`
          :`§aBunker ready: ${f.id}. Entrance faces north (−Z). Use the outside reader with a keycard.`);
        return;
      }
      ops[f.buildStep]();f.buildStep++;mark(f);
      if(f.buildStep%15===0){save(f);if(player.isValid)player.onScreenDisplay.setActionBar(`Building Secret Facilities • ${Math.floor(f.buildStep/ops.length*100)}%`);}
    }catch(error){f.phase="failed";save(f);active.delete(f.id);system.clearRun(task);report(error,player);}
  },2);
  tell(player,`Building ${f.floors.length-1} floors. Stay near this site until construction finishes.`);
}
// Canopy, ground cover and decoration sit above the real surface and must not count as relief.
/** What a tree is made of, for telling a forest from open ground. */
const TREE=["leaves","_log","wood"];
const CANOPY=["leaves","_log","wood","_stem","sapling","vine","bamboo","cactus","sugar_cane","snow_layer",
  "short_grass","tall_grass","fern","flower","mushroom","deadbush","azalea","moss_carpet","hanging_roots",
  "kelp","seagrass","coral","lantern","torch","web","berry","pumpkin","melon","crop","sculk_vein"];
function groundAt(d:Dimension,x:number,z:number):Block|undefined {
  try {
    let block=d.getTopmostBlock({x,z});
    for(let i=0;i<24&&block;i++){
      if(!CANOPY.some(part=>block!.typeId.includes(part)))return block;
      block=d.getBlock({x,y:block.location.y-1,z});
    }
    return block;
  } catch { return undefined; }
}
/** The solid floor of a column, looking through canopy and any water or lava standing on it. */
function floorAt(d:Dimension,x:number,z:number):{floor:number;liquid?:number;ground:string;canopy:boolean}|undefined {
  let block=groundAt(d,x,z),liquid:number|undefined,canopy=false;
  try{const crown=d.getTopmostBlock({x,z})?.typeId??"";canopy=TREE.some(part=>crown.includes(part));}catch{return undefined;}
  try {
    for(let i=0;i<64&&block&&(block.isLiquid||CANOPY.some(part=>block!.typeId.includes(part)));i++){
      if(block.isLiquid)liquid??=block.location.y;
      block=d.getBlock({x,y:block.location.y-1,z});
    }
  } catch { return undefined; }
  if(!block||block.isLiquid)return undefined;
  return {floor:block.location.y,liquid,ground:block.typeId,canopy};
}
export interface Site { origin:Vec; ground:string; cut:number; fill:number }
/** Measure the footprint and choose the surface level closest to the entrance ground that the
 *  earthworks can reach everywhere. Only ground too steep to level, or water standing above
 *  the pad where it would flood the entrance, is refused. */
function survey(d:Dimension,origin:Vec,columns:[number,number][],what="bunker"):{level:number;cut:number;fill:number} {
  let low=Infinity,high=-Infinity,unknown=0,liquid=-Infinity;
  for(const [x,z] of columns){
    const column=floorAt(d,origin.x+x,origin.z+z);
    if(!column){unknown++;continue;}
    low=Math.min(low,column.floor);high=Math.max(high,column.floor);
    if(column.liquid!==undefined)liquid=Math.max(liquid,column.liquid);
  }
  if(unknown>2)throw Error("The site is not fully loaded yet. Stand in the middle of it, wait a moment, then try again.");
  if(high-low>MAX_CUT+MAX_FILL)throw Error(`This site rises and falls ${high-low} blocks across the footprint. The ${what} can level up to ${MAX_CUT+MAX_FILL}; try gentler ground.`);
  const level=Math.min(Math.max(origin.y,high-MAX_CUT),low+MAX_FILL);
  if(liquid>level)throw Error("Water or lava on this site sits above ground level and would flood the entrance. Move away from it.");
  return {level,cut:Math.max(0,high-level),fill:Math.max(0,level-low)};
}
export function originAt(player:Player):Site {
  if(player.dimension.id!=="minecraft:overworld")throw Error("Choose an Overworld surface site.");
  const x=Math.floor(player.location.x),z=Math.floor(player.location.z)+10;
  // Use the solid surface directly beneath the entrance rather than excavating at flight height.
  const ground=groundAt(player.dimension,x,z);
  if(!ground||ground.isLiquid)throw Error("Choose dry land for the main entrance.");
  const columns:[number,number][]=[];
  for(let x=0;x<=3*MODULE-1;x+=SURVEY_STEP)for(let z=-4;z<=3*MODULE-1;z+=SURVEY_STEP)columns.push([x,z]);
  // The rock-face exit's hut stands behind the footprint; a rise there would bury its exit.
  for(const x of [11,15])for(const z of [31,36])columns.push([x,z]);
  const {level,cut,fill}=survey(player.dimension,{x:x-13,y:ground.location.y,z},columns);
  return {origin:{x:x-13,y:level,z},ground:ground.typeId,cut,fill};
}
/** Where the estate's forecourt sits relative to its origin: the player deploys from here, just
 *  inside where the gate will be, with the mansion ahead to the south. */
export const FORECOURT={x:13,z:-15};
/** The estate is centred on its forecourt at the player's feet. Its whole walled compound is
 *  surveyed and levelled like the bunker's pad. */
export function estateOriginAt(player:Player):Site {
  if(player.dimension.id!=="minecraft:overworld")throw Error("Choose an Overworld surface site.");
  const x=Math.floor(player.location.x),z=Math.floor(player.location.z),ground=groundAt(player.dimension,x,z);
  if(!ground||ground.isLiquid)throw Error("Choose dry land for the estate.");
  const o={x:x-FORECOURT.x,y:ground.location.y,z:z-FORECOURT.z},columns:[number,number][]=[];
  for(let cx=COMPOUND.x0;cx<=COMPOUND.x1;cx+=6)for(let cz=COMPOUND.z0;cz<=COMPOUND.z1;cz+=6)columns.push([cx,cz]);
  const {level,cut,fill}=survey(player.dimension,o,columns,"estate");
  return {origin:{...o,y:level},ground:ground.typeId,cut,fill};
}
/** Survey the remote exit sites around a planned facility and choose where its escape tunnel comes up. */
export function exitSite(d:Dimension,origin:Vec,seed:number,preference?:ExitKind,type:Facility["type"]="bunker"):ExitSite {
  if(preference==="rock_face")return {kind:"rock_face"};
  // The levelled pad, and a bunker's mountain skirts, bury the tunnel wherever they reach.
  const covered=type==="estate"?(x:number,z:number)=>within(ESTATE_PAD,x,z):(x:number,z:number)=>within(PAD,x,z)||column(seed,x,z,false).top>0;
  const surveys=exitCandidates(type==="estate"?ESTATE_SEARCH:undefined).map(c=>{
    const samples=siteColumns(c).map(([x,z]):SiteSample|undefined=>{
      const at=floorAt(d,origin.x+x,origin.z+z);
      return at&&{floor:at.floor,liquid:at.liquid!==undefined,ground:at.ground,canopy:at.canopy};
    });
    // Elsewhere the ground over the tunnel must keep it buried.
    let routeLow=Infinity;
    for(const [x,z] of routeColumns(c)){
      if(covered(x,z))continue;
      routeLow=Math.min(routeLow,floorAt(d,origin.x+x,origin.z+z)?.floor??-Infinity);
    }
    return {...c,samples,routeLow};
  });
  return chooseExit(surveys,origin.y,seed,preference);
}
