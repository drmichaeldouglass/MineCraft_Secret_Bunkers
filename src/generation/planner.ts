import { add, type Facility, type Vec } from "../core/types.js";
import { random } from "../core/rules.js";
import { MOUNTAIN, PEAK } from "./mountain.js";
export const FLOOR_NAMES = ["Administration & Security", "Living Quarters", "Command", "Engineering & Mining", "High Security", "Hydroponics & Supply", "Research", "Deep Excavation"];
/** What each floor is for. Every floor has six room slots: the fixed rooms always appear
 *  (the first in the north-west corner), and the rest are drawn from the pool without
 *  replacement, so a role listed twice can appear twice. */
export const FLOOR_PROGRAMS: { fixed: string[]; pool: string[] }[] = [
  { fixed: ["security", "office"], pool: ["briefing", "archive", "storage", "lounge", "canteen"] },
  { fixed: ["barracks", "bedroom", "canteen", "lounge", "farm"], pool: ["bedroom", "medical"] },
  { fixed: ["command", "server"], pool: ["briefing", "security", "office", "archive", "lounge"] },
  { fixed: ["generator", "workshop", "mining"], pool: ["utility", "server", "storage", "mining"] },
  { fixed: ["vault", "security"], pool: ["laboratory", "archive", "storage", "server", "vault"] },
  { fixed: ["farm", "storage"], pool: ["farm", "canteen", "utility", "workshop", "bedroom"] },
  { fixed: ["laboratory", "medical"], pool: ["laboratory", "server", "archive", "workshop", "utility"] },
  { fixed: ["mining", "vault"], pool: ["mining", "storage", "generator", "workshop", "utility"] },
];
/** Every furnished room role; each has a north- and south-facing template. */
export const ROOM_ROLES = [...new Set(FLOOR_PROGRAMS.flatMap(p => [...p.fixed, ...p.pool]))].sort();
/** Room slots on a floor, as grid [column,row]; the middle row is the hall and core. */
const SLOTS: [number, number][] = [[0,0],[1,0],[2,0],[0,2],[1,2],[2,2]];
/** Module footprint. A floor is a 3x3 grid of these, so 27x27 blocks. */
export const MODULE = 9;
/** Vertical spacing between floors; modules are seven tall, leaving a two-block slab. */
export const FLOOR_STEP = 9;
/** Grid column and row of the vertical core, and the command deck that carries self-destruct. */
const CORE = 1, COMMAND_LEVEL = 2;
export function planBunker(origin: Vec, levels: number, seed: number, defences: boolean, id = `sf_${seed >>> 0}`): Facility {
  if (!Number.isInteger(levels) || levels < 3 || levels > 8) throw Error("Choose 3–8 underground floors.");
  if (![origin.x, origin.y, origin.z, seed].every(Number.isFinite)) throw Error("Invalid coordinates or seed.");
  if (origin.y - levels*FLOOR_STEP < -60 || origin.y > 290) throw Error("Not enough vertical space. Choose a higher, ordinary surface site.");
  const rng = random(seed), p = (x:number,y:number,z:number) => add(origin,{x,y,z});
  const commandY = -(COMMAND_LEVEL+1)*FLOOR_STEP;
  const f: Facility = {
    schema:1,id,type:"bunker",dimension:"minecraft:overworld",seed,origin,
    // Reserved space includes the mountain over the site and the demolition charges around it.
    bounds:{min:p(MOUNTAIN.x0,-levels*FLOOR_STEP,MOUNTAIN.z0),max:p(MOUNTAIN.x1,PEAK+8,MOUNTAIN.z1)},state:"NORMAL",phase:"building",buildStep:0,
    doors:[],floors:[],lasers:[],lights:[],turrets:[],modules:[],
    zones:{entrance:defences ? "ACTIVE":"OFFLINE",command:defences ? "ALERT_ONLY":"OFFLINE"},
    lasersEnabled:true,consoles:[],charges:[],
  };
  f.modules.push({template:"entrance",pos:p(6,0,-4),floor:0,role:"entrance"});
  f.floors.push({name:"Surface • Main entrance",y:origin.y,clearance:1,destination:p(13.5,1,13.5),panel:p(15,2,14)});
  f.doors.push({id:"main",min:p(11,1,0),max:p(15,4,0),clearance:1,open:false,kind:"blast",readers:[p(17,2,-2),p(17,2,2)]});
  f.lights.push(p(9,4,0),p(17,4,0));
  for(let level=0;level<levels;level++) {
    const dy=-(level+1)*FLOOR_STEP, levelClearance=Math.min(4,level+1);
    f.floors.push({name:`B${level+1} • ${FLOOR_NAMES[level]}`,y:origin.y+dy,clearance:levelClearance,
      destination:p(13.5,dy+1,13.5),panel:p(15,dy+2,14)});
    const program=FLOOR_PROGRAMS[level],pool=[...program.pool],roles=new Map<string,string>();
    const drawn=[...program.fixed];
    while(drawn.length<SLOTS.length){const i=Math.floor(rng()*pool.length);drawn.push(...pool.splice(i,1));}
    // The first fixed role anchors the north-west corner; the others are shuffled into the remaining slots.
    const rest=drawn.slice(1);
    for(let i=rest.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];}
    [drawn[0],...rest].forEach((role,i)=>roles.set(SLOTS[i].join(","),role));
    for(let gx=0;gx<3;gx++) for(let gz=0;gz<3;gz++) {
      let template:string, role:string;
      if(gz===1) { template=gx===CORE?"core":gx===0?"hall_west":"hall_east"; role=gx===CORE?"vertical_core":"corridor_standard"; }
      else { role=roles.get(`${gx},${gz}`)!; template=`${role}_${gz===0?"north":"south"}`; }
      f.modules.push({template,pos:p(gx*MODULE,dy,gz*MODULE),floor:level+1,role});
      if(gz!==1) {
        const z=gz===0?8:18;
        f.doors.push({id:`b${level+1}_${gx}_${gz}`,min:p(gx*MODULE+3,dy+1,z),max:p(gx*MODULE+5,dy+3,z),
          clearance:levelClearance,open:true,kind:"security",readers:[p(gx*MODULE+6,dy+2,z-1),p(gx*MODULE+6,dy+2,z+1)]});
      }
    }
    // Demolition charges one block outside each wall, at mid-height, sealed in the encasing rock.
    // B1's rear escape tunnel passes the middle of the south wall, so that charge is left out.
    for(const a of [4,13,22]){
      f.charges!.push(p(a,dy+3,-1),p(-1,dy+3,a),p(27,dy+3,a));
      if(level>0||a!==13)f.charges!.push(p(a,dy+3,27));
    }
    f.consoles.push({pos:p(12,dy+2,15),kind:"security",zone:"command"},
      {pos:p(11,dy+2,15),kind:"defence",zone:"command"});
    f.lights.push(p(13,dy+5,11),p(2,dy+5,13),p(20,dy+5,13));
    // Three horizontal beams and one vertical beam create a reusable grid.
    for(const y of [1.4,2.4,3.4]) f.lasers.push({a:p(4.5,dy+y,12.5),b:p(4.5,dy+y,14.5),response:level>=2?"LOCKDOWN":"ALERT"});
    f.lasers.push({a:p(22.5,dy+1.3,13.5),b:p(22.5,dy+4.7,13.5),response:"ALERT"});
    f.doors.push({id:`shutter_${level}`,min:p(7,dy+2,12),max:p(7,dy+3,14),clearance:4,open:true,kind:"shutter",readers:[]});
  }
  // Command deck. x=11/12 already hold that floor's defence and security consoles;
  // a shared position would hide one console behind the other in the registry lookup.
  f.consoles.push({pos:p(13,commandY+2,15),kind:"destruct",zone:"command"});
  // Charges packed against the surface lobby's side walls bring the portal down.
  for(const z of [4,12])f.charges!.push(p(5,3,z),p(21,3,z));
  if(defences) {
    f.turrets.push({id:"entrance_left",pos:p(8.5,2,-2.5),zone:"entrance",enabled:true,damaged:false},
      {id:"entrance_right",pos:p(18.5,2,-2.5),zone:"entrance",enabled:true,damaged:false},
      {id:"command",pos:p(23.5,commandY+2,13.5),zone:"command",enabled:true,damaged:false});
  }
  return f;
}
