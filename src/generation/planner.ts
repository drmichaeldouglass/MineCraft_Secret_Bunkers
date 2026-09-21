import { add, type Facility, type Vec } from "../core/types.js";
import { random } from "../core/rules.js";
export const FLOOR_NAMES = ["Administration & Security", "Personnel", "Command", "Engineering", "High Security", "Archives", "Research", "Deep Vault"];
const required = ["security", "barracks", "command", "generator", "vault", "archive", "laboratory", "vault"];
const optional = [
  ["office", "briefing", "security", "archive"], ["barracks", "medical", "canteen", "office"],
  ["command", "server", "briefing", "archive"], ["generator", "workshop", "server", "utility"],
  ["vault", "laboratory", "archive", "server"],
];
export function planBunker(origin: Vec, levels: number, seed: number, defences: boolean, id = `sf_${seed >>> 0}`): Facility {
  if (!Number.isInteger(levels) || levels < 3 || levels > 8) throw Error("Choose 3–8 underground floors.");
  if (![origin.x, origin.y, origin.z, seed].every(Number.isFinite)) throw Error("Invalid coordinates or seed.");
  if (origin.y - levels*9 < -60 || origin.y > 290) throw Error("Not enough vertical space. Choose a higher, ordinary surface site.");
  const rng = random(seed), p = (x:number,y:number,z:number) => add(origin,{x,y,z});
  const f: Facility = {
    schema:1,id,type:"bunker",dimension:"minecraft:overworld",seed,origin,
    bounds:{min:p(0,-levels*9,-6),max:p(64,8,53)},state:"NORMAL",phase:"building",buildStep:0,
    doors:[],floors:[],lasers:[],lights:[],turrets:[],modules:[],
    zones:{entrance:defences ? "ACTIVE":"OFFLINE",command:defences ? "ALERT_ONLY":"OFFLINE"},
    lasersEnabled:true,consoles:[],
  };
  f.modules.push({template:"entrance",pos:p(22,0,-6),floor:0,role:"entrance"});
  f.floors.push({name:"Surface • Main entrance",y:origin.y,clearance:1,destination:p(32.5,1,19.5),panel:p(34,2,20)});
  f.doors.push({id:"main",min:p(28,1,0),max:p(36,5,0),clearance:1,open:false,kind:"blast",readers:[p(38,2,-2),p(38,2,2)]});
  f.lights.push(p(26,5,0),p(38,5,0));
  for(let level=0;level<levels;level++) {
    const dy=-(level+1)*9, levelClearance=Math.min(4,level+1);
    f.floors.push({name:`B${level+1} • ${FLOOR_NAMES[level]}`,y:origin.y+dy,clearance:levelClearance,
      destination:p(32.5,dy+1,19.5),panel:p(34,dy+2,20)});
    for(let gx=0;gx<5;gx++) for(let gz=0;gz<3;gz++) {
      let template:string, role:string;
      if(gz===1) { template=gx===2?"core":gx===0?"hall_west":gx===4?"hall_east":"hall"; role=gx===2?"vertical_core":"corridor_standard"; }
      else {
        const list=optional[Math.min(level,4)];
        role=gx===0&&gz===0?required[level]:list[Math.floor(rng()*list.length)];
        template=`${role}_${gz===0?"north":"south"}`;
      }
      f.modules.push({template,pos:p(gx*13,dy,gz*13),floor:level+1,role});
      if(gz!==1) {
        const z=gz===0?12:26;
        f.doors.push({id:`b${level+1}_${gx}_${gz}`,min:p(gx*13+5,dy+1,z),max:p(gx*13+7,dy+3,z),
          clearance:levelClearance,open:true,kind:"security",readers:[p(gx*13+8,dy+2,z-1),p(gx*13+8,dy+2,z+1)]});
      }
    }
    f.consoles.push({pos:p(30,dy+2,22),kind:"security",zone:"command"},
      {pos:p(28,dy+2,22),kind:"defence",zone:"command"});
    f.lights.push(p(32,dy+5,16),p(19,dy+5,19),p(45,dy+5,19));
    // Three horizontal beams and one vertical beam create a reusable grid.
    for(const y of [1.4,2.4,3.4]) f.lasers.push({a:p(17.5,dy+y,17.5),b:p(17.5,dy+y,21.5),response:level>=2?"LOCKDOWN":"ALERT"});
    f.lasers.push({a:p(43.5,dy+1.3,19.5),b:p(43.5,dy+4.7,19.5),response:"ALERT"});
    f.doors.push({id:`shutter_${level}`,min:p(24,dy+2,17),max:p(24,dy+3,21),clearance:4,open:true,kind:"shutter",readers:[]});
  }
  // B3 command deck. x=28/30 already hold that floor's defence and security consoles;
  // a shared position would hide one console behind the other in the registry lookup.
  f.consoles.push({pos:p(32,-27+2,22),kind:"destruct",zone:"command"});
  if(defences) {
    f.turrets.push({id:"entrance_left",pos:p(24.5,2,-3.5),zone:"entrance",enabled:true,damaged:false},
      {id:"entrance_right",pos:p(40.5,2,-3.5),zone:"entrance",enabled:true,damaged:false},
      {id:"command",pos:p(59.5,-25,17.5),zone:"command",enabled:true,damaged:false});
  }
  return f;
}
