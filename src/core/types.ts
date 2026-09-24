export type Vec = { x: number; y: number; z: number };
export type SecurityState = "NORMAL" | "ALERT" | "LOCKDOWN" | "SELF_DESTRUCT" | "DESTROYED";
export type DefenceMode = "OFFLINE" | "STANDBY" | "ACTIVE" | "ALERT_ONLY" | "LOCKDOWN_ONLY";
export interface Bounds { min: Vec; max: Vec }
export interface Door {
  id: string; min: Vec; max: Vec; clearance: number; open: boolean;
  kind: "blast" | "security" | "shutter"; readers: Vec[];
}
export interface Floor { name: string; y: number; clearance: number; destination: Vec; panel: Vec }
export interface Laser { a: Vec; b: Vec; response: "ALERT" | "LOCKDOWN" }
export interface Turret { id: string; pos: Vec; zone: string; enabled: boolean; damaged: boolean }
export interface Module { template: string; pos: Vec; floor: number; role: string }
export interface Facility {
  schema: 1; id: string; type: "bunker"; dimension: string; seed: number;
  origin: Vec; bounds: Bounds; state: SecurityState; phase: "building" | "ready" | "failed";
  buildStep: number; doors: Door[]; floors: Floor[]; lasers: Laser[];
  lights: Vec[]; turrets: Turret[]; modules: Module[];
  zones: Record<string, DefenceMode>; lasersEnabled: boolean;
  consoles: { pos: Vec; kind: "security" | "defence" | "destruct"; zone: string }[];
  countdown?: number; destructionStep?: number;
  /** Natural surface block the site is levelled with. Absent for facilities built before levelling. */
  ground?: string;
}
export const NS = "secretfacilities:";
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
export const key = (v: Vec): string => `${v.x},${v.y},${v.z}`;
export const inside = (v: Vec, b: Bounds, margin = 0): boolean =>
  v.x >= b.min.x-margin && v.x <= b.max.x+margin &&
  v.y >= b.min.y-margin && v.y <= b.max.y+margin &&
  v.z >= b.min.z-margin && v.z <= b.max.z+margin;
export const intersects = (a: Bounds, b: Bounds, gap = 0): boolean =>
  a.min.x <= b.max.x+gap && a.max.x+gap >= b.min.x &&
  a.min.y <= b.max.y+gap && a.max.y+gap >= b.min.y &&
  a.min.z <= b.max.z+gap && a.max.z+gap >= b.min.z;
