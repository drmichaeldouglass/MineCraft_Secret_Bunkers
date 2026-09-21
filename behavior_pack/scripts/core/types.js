export const NS = "secretfacilities:";
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const key = (v) => `${v.x},${v.y},${v.z}`;
export const inside = (v, b, margin = 0) => v.x >= b.min.x - margin && v.x <= b.max.x + margin &&
    v.y >= b.min.y - margin && v.y <= b.max.y + margin &&
    v.z >= b.min.z - margin && v.z <= b.max.z + margin;
export const intersects = (a, b, gap = 0) => a.min.x <= b.max.x + gap && a.max.x + gap >= b.min.x &&
    a.min.y <= b.max.y + gap && a.max.y + gap >= b.min.y &&
    a.min.z <= b.max.z + gap && a.max.z + gap >= b.min.z;
