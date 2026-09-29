import { GameMode, ItemStack, system, type Player } from "@minecraft/server";
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { distance, key, NS, type DefenceMode, type ExitKind, type Facility, type FacilityType, type Vec } from "../core/types.js";
import { planBunker } from "../generation/planner.js";
import { planEstate } from "../generation/estate.js";
import { escapeRoute } from "../generation/tunnel.js";
import { facilities, mark, save } from "./store.js";
import { build, estateOriginAt, exitSite, originAt } from "./generation.js";
import { abortDestruct, armDestruct, requestDoor, setSecurity, toggleDoor } from "./security.js";
import { charges } from "./destruct.js";
import { delay, dim, fade, findFacility, getClearance, report, shake, sound, tell } from "./world.js";
const busy=new Set<string>();
/** Deployment choices for the secret tunnel's exit; automatic lets the terrain decide. */
const EXIT_CHOICES:[ExitKind|undefined,string][]=[[undefined,"Automatic • suits the terrain"],["utility_shed","Utility shed"],
  ["forest_cabin","Forest cabin"],["well","Old well"],["hidden_hatch","Hidden hatch"],["mine_headframe","Abandoned mine"],
  ["rock_face","Rock face behind the mountain"]];
const EXIT_LABEL=Object.fromEntries(EXIT_CHOICES.map(([k,l])=>[k,l.toLowerCase()])) as Record<ExitKind,string>;
export function runMenu(player:Player,work:()=>Promise<void>):void {
  if(busy.has(player.id))return;
  busy.add(player.id);
  void work().catch(error=>report(error,player)).finally(()=>busy.delete(player.id));
}
function creative(player:Player):void {if(player.getGameMode()!==GameMode.Creative)throw Error("This development tool is Creative-only.");}
function check(player:Player,f:Facility,pos:Vec,clearance:number):void {
  if(!player.isValid||player.dimension.id!==f.dimension||distance(player.location,pos)>8)throw Error("Return to this console to continue.");
  if(f.phase!=="ready")throw Error("Construction is not complete. Use the deployment device to resume.");
  if(getClearance(player)<clearance)throw Error(`A level ${clearance} keycard is required.`);
}
export function giveKit(player:Player):void {
  creative(player);const container=player.getComponent("minecraft:inventory")?.container;
  if(!container)throw Error("Inventory unavailable.");
  for(const id of ["facility_deployment_device","facility_debug_scanner","keycard_green","keycard_blue","keycard_red","keycard_black","keycard_master",
    "laser_turret_spawn_egg","missile_turret_spawn_egg"]){
    let found=false;for(let i=0;i<container.size;i++)if(container.getItem(i)?.typeId===NS+id)found=true;
    if(!found){const leftover=container.addItem(new ItemStack(NS+id));if(leftover)player.dimension.spawnItem(leftover,player.location);}
  }
  tell(player,"Deployment device, scanner, keycards and turret spawn eggs supplied. Keep only the card you want to test in your inventory.");
}
export async function deployment(player:Player):Promise<void> {
  creative(player);
  const f=findFacility(player);
  const form=new ActionFormData().title("SECRET FACILITIES").body("Command bunker and fortified estate • 0.1.0 alpha\n\nDeploy on dry land. A facility replaces blocks across its site. Use a test world or a backup.\n\nOther facility archetypes are planned for later stages.")
    .button("Deploy command bunker").button("Deploy fortified estate").button("Get development kit");
  if(f?.phase==="failed")form.button("Resume interrupted construction");
  const answer=await form.show(player);if(answer.canceled)return;creative(player);
  if(answer.selection===2){giveKit(player);return;}
  if(answer.selection===3&&f){build(f,player);return;}
  if(answer.selection===0||answer.selection===1)await configure(player,answer.selection===0?"bunker":"estate");
}
/** Floors, defences, escape exit and seed for a new facility, then the surveyed site to confirm. */
async function configure(player:Player,type:FacilityType):Promise<void> {
  const estate=type==="estate",choices=estate?EXIT_CHOICES.filter(([k])=>k!=="rock_face"):EXIT_CHOICES;
  const floors=["3 • compact","4 • regional","5 • command","6 • strategic","7 • deep","8 • maximum"].slice(0,estate?3:6);
  const settings=await new ModalFormData().title(estate?"ESTATE CONFIGURATION":"BUNKER CONFIGURATION")
    .dropdown(estate?"Underground floors below the mansion":"Underground floors",floors,{defaultValueIndex:estate?0:2})
    .toggle(estate?"Include automated laser defences (gate, watchtowers, roof)":"Include automated laser defences",{defaultValue:true})
    .dropdown("Secret escape tunnel exit",choices.map(([,label])=>label),{defaultValueIndex:0})
    .textField("Layout seed (optional integer)","e.g. 104729").show(player);
  if(settings.canceled||!settings.formValues)return;creative(player);
  const levels=Number(settings.formValues[0])+3,defences=Boolean(settings.formValues[1]);
  const preference=choices[Number(settings.formValues[2])]?.[0];
  const raw=String(settings.formValues[3]??"").trim(),seed=raw?Number(raw):Math.floor(Math.random()*2147483647);
  if(!Number.isSafeInteger(seed))throw Error("The layout seed must be a whole number.");
  const site=estate?estateOriginAt(player):originAt(player),origin=site.origin,start=player.location,id=`sf_${Date.now().toString(36)}_${Math.floor(Math.random()*9999)}`;
  const exit=exitSite(player.dimension,origin,seed,preference,type);
  const plan=estate?planEstate(origin,levels,seed,defences,id,exit):planBunker(origin,levels,seed,defences,id,exit);plan.ground=site.ground;
  const fallback=preference&&preference!==plan.exit?.kind?`\nNo dry, level site nearby suits the ${EXIT_LABEL[preference]}; the tunnel comes up ${estate?"in a well in the back garden":"behind the mountain"} instead.`:"";
  const earthworks=site.cut||site.fill?`\n\nUneven ground is levelled: cut up to ${site.cut} and filled up to ${site.fill} blocks.`:"";
  const where=estate?`Gate: ${origin.x+13}, ${origin.y+1}, ${origin.z-30} (north wall)\nYou are standing in the forecourt; the mansion rises to the south.`
    :`Entrance: ${origin.x+13}, ${origin.y+1}, ${origin.z}`;
  const what=estate?"levels the site, walls in the compound, builds the mansion, gatehouse, garage, helipad and watchtowers, and digs the bunker and escape tunnel beneath them."
    :"levels the site, replaces blocks inside the modules, entrance and escape route, and raises a mountain over it all.";
  const confirm=await new MessageFormData().title("CONFIRM DEPLOYMENT")
    .body(`${estate?"Fortified estate • ":""}${levels} underground floors • seed ${seed}\n\n${where}\nReserved: ${plan.bounds.max.x-plan.bounds.min.x+1} × ${plan.bounds.max.z-plan.bounds.min.z+1} blocks\nLowest floor: Y ${plan.bounds.min.y}\nEscape tunnel: ${escapeRoute(plan)}${fallback}${earthworks}\n\nConstruction ${what} Stay nearby while it builds.`)
    .button1("Cancel").button2(estate?"Build estate":"Build bunker").show(player);
  if(confirm.canceled||confirm.selection!==1)return;creative(player);
  if(distance(player.location,start)>16)throw Error("You moved away from the confirmed site. Deploy again here.");
  build(plan,player);
}
async function elevator(player:Player,f:Facility,pos:Vec):Promise<void> {
  check(player,f,pos,1);
  if(f.state==="DESTROYED")throw Error("Elevators are offline. Use the emergency ladder or the B1 secret tunnel.");
  if(f.state==="LOCKDOWN"&&getClearance(player)<4)throw Error("Elevators require command clearance during lockdown.");
  const current=f.floors.reduce((a,b)=>Math.abs(a.y-player.location.y)<Math.abs(b.y-player.location.y)?a:b);
  const menu=new ActionFormData().title("FACILITY ELEVATOR").body(`Current: ${current.name}\nStand on the cyan pad. Emergency ladder: east side of the lobby.`);
  for(const floor of f.floors)menu.button(`${floor.name}\nLevel ${floor.clearance} clearance`);
  const response=await menu.show(player);if(response.canceled||response.selection===undefined)return;
  const dest=f.floors[response.selection];if(!dest)return;check(player,f,pos,dest.clearance);
  if(f.state==="LOCKDOWN"&&getClearance(player)<4)throw Error("Lockdown engaged while you were selecting a floor.");
  if(Math.abs(player.location.x-current.destination.x)>2.5||Math.abs(player.location.z-current.destination.z)>2.5)throw Error("Step onto the cyan elevator pad and try again.");
  const from=f.floors.indexOf(current),to=response.selection,step=to>from?1:-1,passing=Math.abs(to-from);
  if(passing===0){tell(player,`Already at ${dest.name}.`);return;}
  const onPad=()=>Math.abs(player.location.x-current.destination.x)<=2.5&&Math.abs(player.location.z-current.destination.z)<=2.5;
  // The car rumbles, each deck is called out as it passes, then the transfer hides behind a fade.
  sound(f,"elevator_move",pos);
  const hold=Math.max(6,Math.min(14,Math.round(48/passing)));
  shake(player,passing*hold/20,0.07);
  for(let i=1;i<=passing;i++){
    await delay(hold);check(player,f,pos,dest.clearance);
    if(!onPad())throw Error("Trip canceled because you left the elevator pad.");
    const deck=f.floors[from+i*step];
    if(player.isValid)player.onScreenDisplay.setActionBar(i===passing?`§bArriving • ${deck.name}`:`§7Passing • ${deck.name}`);
  }
  fade(player,0.2,0.3,0.45);
  await delay(5);check(player,f,pos,dest.clearance);
  // Recheck live state after the ride; an open UI never grants lasting authority.
  if((f as Facility).state==="DESTROYED"||(f.state==="LOCKDOWN"&&getClearance(player)<4))throw Error("The elevator is no longer available.");
  if(!onPad())throw Error("Trip canceled because you left the elevator pad.");
  const d=dim(f),feet=d.getBlock(dest.destination),head=d.getBlock({...dest.destination,y:dest.destination.y+1});
  const ground=d.getBlock({...dest.destination,y:dest.destination.y-1});
  if(!feet?.isAir||!head?.isAir||ground?.typeId!==NS+"elevator_pad")throw Error("The destination is obstructed or unloaded. Clear its pad before travel.");
  if(!player.tryTeleport(dest.destination,{dimension:d,checkForBlocks:true}))throw Error("Could not reach this floor. Use the emergency ladder.");
  sound(f,"elevator_arrive",dest.destination);tell(player,dest.name);
}
async function security(player:Player,f:Facility,pos:Vec):Promise<void> {
  check(player,f,pos,4);
  const response=await new ActionFormData().title("FACILITY SECURITY").body(`Facility ${f.id}\nState: ${f.state}\nLasers: ${f.lasersEnabled?"enabled":"disabled"}`)
    .button("Normal / reset alarm").button("Alert").button("Lockdown").button(f.lasersEnabled?"Disable laser grids":"Enable laser grids").show(player);
  if(response.canceled)return;check(player,f,pos,4);
  if(f.state==="SELF_DESTRUCT"||f.state==="DESTROYED")throw Error("Security reset is unavailable in this state.");
  if(response.selection===3){f.lasersEnabled=!f.lasersEnabled;mark(f);save(f);tell(player,`Lasers ${f.lasersEnabled?"enabled":"disabled"}.`);return;}
  const state=(["NORMAL","ALERT","LOCKDOWN"] as const)[response.selection??-1];if(state)setSecurity(f,state);
}
async function defence(player:Player,f:Facility,pos:Vec,zone:string):Promise<void> {
  check(player,f,pos,3);const level=getClearance(player);
  const scope=await new ActionFormData().title("DEFENCE CONTROL").body(`Local zone: ${zone}\n${Object.entries(f.zones).map(([z,m])=>`${z}: ${m}`).join("\n")}\n\nRed card controls this zone. Black card controls all zones.`)
    .button(`Local zone: ${zone}`).button("All facility zones • black card").show(player);
  if(scope.canceled||scope.selection===undefined)return;check(player,f,pos,scope.selection===1?4:3);
  const all=scope.selection===1;if(all&&level<4)throw Error("Black keycard required.");
  const modes:DefenceMode[]=["ACTIVE","OFFLINE","STANDBY","ALERT_ONLY","LOCKDOWN_ONLY"];
  const menu=new ActionFormData().title("SET DEFENCE MODE").body("Turrets target hostile mobs only. Offline disables targeting and firing.");
  for(const mode of modes)menu.button(mode.replace(/_/g," "));
  const answer=await menu.show(player);if(answer.canceled||answer.selection===undefined)return;check(player,f,pos,all?4:3);
  if(f.state==="DESTROYED")throw Error("Destroyed defences cannot be restarted.");
  const mode=modes[answer.selection];if(!mode)return;
  for(const z of Object.keys(f.zones))if(all||z===zone)f.zones[z]=mode;
  mark(f);save(f);sound(f,"access_granted",pos);tell(player,`Defences set to ${mode}.`);
}
async function destruct(player:Player,f:Facility,pos:Vec):Promise<void> {
  check(player,f,pos,4);
  if(f.state==="DESTROYED")throw Error("This facility has already been destroyed.");
  if(f.state==="SELF_DESTRUCT"){
    const stop=await new MessageFormData().title("ABORT SELF-DESTRUCT").body(`Remaining: ${f.countdown}s. Abort is unavailable in the final 10 seconds.`).button1("Keep evacuating").button2("Abort sequence").show(player);
    if(!stop.canceled&&stop.selection===1){check(player,f,pos,4);tell(player,abortDestruct(f)?"Countdown aborted.":"Abort window has closed.");}return;
  }
  const {armed:ready,total}=charges(f);
  const status=total?`\n\nDemolition charges in place: ${ready} of ${total}.`:"";
  const armed=await new MessageFormData().title("ARM SELF-DESTRUCT").body(`Command authorization required. Arming prepares a 90-second evacuation sequence. A second confirmation is required.${status}`).button1("Cancel").button2("Arm console").show(player);
  if(armed.canceled||armed.selection!==1)return;check(player,f,pos,4);
  const auth=await new MessageFormData().title("AUTHORIZE DESTRUCTION").body(`Start a 90-second countdown?\n\nDoors open for evacuation. Turrets shut down for the final 10 seconds. At zero the charges fire floor by floor from the deepest level up: every room is gutted, ${f.type==="estate"?"then the mansion is gutted and set ablaze and its lift is sealed with rubble":"the lobby caves in and the portal is sealed with rubble"}. Anyone still inside will not survive.\n\nEscape via the emergency ladder or the B1 secret tunnel to the ${escapeRoute(f)}.`).button1("Disarm").button2("Start countdown").show(player);
  if(auth.canceled||auth.selection!==1)return;check(player,f,pos,4);armDestruct(f);
}
export async function interact(player:Player,pos:Vec):Promise<void> {
  const f=[...facilities.values()].find(f=>f.dimension===player.dimension.id&&(
    f.doors.some(d=>d.readers.some(r=>key(r)===key(pos)))||f.floors.some(l=>key(l.panel)===key(pos))||f.consoles.some(c=>key(c.pos)===key(pos))));
  if(!f){tell(player,"This block is not connected to a generated facility. Deploy a bunker to use its registered systems.");return;}
  check(player,f,pos,0);
  const door=f.doors.find(d=>d.readers.some(r=>key(r)===key(pos)));
  if(door){toggleDoor(player,f,door);return;}
  if(f.floors.some(l=>key(l.panel)===key(pos))){await elevator(player,f,pos);return;}
  const c=f.consoles.find(c=>key(c.pos)===key(pos));if(!c)return;
  if(c.kind==="security")await security(player,f,pos);
  else if(c.kind==="defence")await defence(player,f,pos,c.zone);
  else await destruct(player,f,pos);
}
export async function debug(player:Player):Promise<void> {
  creative(player);const f=findFacility(player);if(!f){tell(player,"No nearby registered facility. Use the deployment device first.");return;}
  const form=new ActionFormData().title("FACILITY DEBUG SCANNER").body(`${f.id}\nSeed ${f.seed} • ${f.floors.length-1} floors\n${f.phase} • ${f.state}\nDoors ${f.doors.length} • Turrets ${f.turrets.length}\nBounds: ${key(f.bounds.min)} to ${key(f.bounds.max)}\nEscape: ${escapeRoute(f)}`)
    .button("Reset security / lasers off").button("Test alert").button("Test lockdown").button("Open every door").button("Close every door").button("Disable all defences").button("Activate all defences");
  const response=await form.show(player);if(response.canceled)return;creative(player);check(player,f,player.location,0);
  if(f.state==="DESTROYED"||f.state==="SELF_DESTRUCT")throw Error("Use the self-destruct console during a countdown. Destroyed facilities cannot be reset.");
  switch(response.selection){
    case 0:f.lasersEnabled=false;setSecurity(f,"NORMAL");break;
    case 1:setSecurity(f,"ALERT");break;
    case 2:setSecurity(f,"LOCKDOWN");break;
    case 3:case 4:for(const d of f.doors)requestDoor(f,d,response.selection===3);break;
    case 5:case 6:for(const zone of Object.keys(f.zones))f.zones[zone]=response.selection===5?"OFFLINE":"ACTIVE";break;
  }
  mark(f);save(f);tell(player,`Debug change applied. State: ${f.state}.`);
}
export function scheduleDevice(player:Player,item:string):void {
  system.run(()=>runMenu(player,()=>item===NS+"facility_deployment_device"?deployment(player):debug(player)));
}
