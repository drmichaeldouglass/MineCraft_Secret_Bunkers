# Changelog

## Unreleased — bug fixes

- Fixed the self-destruct console sharing a block with B3's security console, which made the entire self-destruct sequence unreachable: the console opened the security menu instead, and confirming "arm" silently raised an alert.
- Fixed a finished build being recorded as `failed` when the builder disconnected before the completion message could be delivered.
- Fixed persisted snapshots being accepted with missing `floors`, `lasers`, `lights`, `turrets`, `consoles` or `zones`, where a single bad facility aborted a shared tick handler for every facility in the world.
- Laser grids now read each player's clearance once per tick instead of once per beam per player, removing an inventory scan per beam.
- Alarm lamps now write a permutation only when the lit state actually changes, instead of re-applying an identical permutation to every lamp every 10 ticks.
- Cleared stale ids from the pending-save set so they cannot accumulate.
- `tools/package.py` now writes archive entries with forward slashes on every host OS.
- Added a planner regression test asserting that every generated fixture claims a distinct block.

## 0.1.0 — 2026-09-21

Initial command-bunker alpha built from the supplied Secret Facilities plan.

- Added behavior/resource packs, pinned TypeScript build and reproducible packaging.
- Added 47 custom blocks, seven items, 33 generated binary templates, original textures, turret geometry/animation, particles and synthesized sound.
- Implemented seeded 3–8-floor module assembly, a reinforced surface entrance, transfer-pad elevators, a manual ladder and B1 escape route.
- Implemented keycard doors, laser grids, shared security state, alarm lighting/sirens, shutters, hostile-only laser turrets and defence modes.
- Added Creative deployment/debug tools, resumable construction and persistent facility snapshots.
- Added two-confirmation self-destruct with evacuation, bounded damage and permanent shutdown.
- Added automated generation/runtime checks and independent asset/NBT validation.

Not yet game-tested. Later facilities, missiles, natural/jigsaw generation, advanced moving geometry and cinematic effects remain planned; see `docs/STATUS.md`.
