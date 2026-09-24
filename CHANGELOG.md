# Changelog

## Unreleased — themed rooms, a hidden mountain site and a real self-destruct

- **Rooms have specific jobs.** Every floor now has a purpose, with fixed rooms that always appear and a seeded pool for the rest: B1 Administration & Security, B2 Living Quarters, B3 Command, B4 Engineering & Mining, B5 High Security, B6 Hydroponics & Supply, B7 Research and B8 Deep Excavation. There are 19 room types, furnished with working vanilla blocks instead of construction-block props: bunk rooms and officers' bedrooms with real (coloured) beds, lounges, mess halls with a galley, hydroponic farms with irrigated crops under grow lights, mining faces of live ore-bearing rock with a railed drift and smelters, workshops, power plants with a caged reactor core, infirmaries, laboratories, command and data centres, briefing rooms, security offices with a holding cell, archives, strongrooms, water treatment and supply depots. The asset builder checks every room keeps its aisle and reader spot clear.
- **The bunker is hidden under a mountain.** After the fittings go in, a seeded mountain about 24 blocks high is heaped over the whole site. The portal becomes a cave mouth under an overhanging brow, marked by two floodlights and reached along an open cut in the north face. Beyond the levelled pad the slopes only fill air and water, so they drape over the surrounding terrain. The escape hut is dug into the back of the mountain and its door now faces south, out onto clear ground; its ladder moved to the west wall.
- **Self-destruct now destroys the bunker.** Real TNT charges are sealed in the rock one block outside the walls (twelve per floor, four against the surface lobby; the rock encasement is two blocks wider to hold them). At zero the floors go one per second, deepest first: charges explode and breach the walls beside them, every room and hall is gutted, part of each ceiling falls in, rubble and fires are left behind, and every room takes a real explosion that hurts anyone still inside. The lobby then caves in, the portal passage fills with rubble and the turrets are destroyed. Explosions do not break blocks themselves, so the demolition is controlled and does not scatter item drops. The console shows how many charges are still in place; a charge dug out is simply missing from the blast. The escape tunnel and hut survive as the way out, and a destroyed bunker's doors are no longer repainted on reload.
- **The entrance blast door opens sideways.** It now splits down the middle and its two leaves slide apart horizontally into the walls over about two seconds, eased in and out. While the leaves move, the door blocks stay solid but draw invisibly so the leaves show; each column opens only once both leaves are fully clear of it, from the seam outward.
- **Turret shots are a solid glowing beam.** Each shot is now a single additive, full-bright particle emitter that fills the line from muzzle to target with a white-hot core, a red body and a soft halo, fading over a third of a second, plus a flash and a spray of sparks on impact. Tripwire grids keep their faint dotted beam.
- The deployment's reserved bounds now include the mountain; the loaded-area check still covers only the levelled pad.

## Unreleased — bug fixes

### From in-game testing

- **You could see through walls.** Large parts of the bunker and the surrounding terrain stopped rendering, leaving an x-ray view of room interiors with sky showing through. Open doors and shutters used a block geometry with no cubes, which breaks the client's chunk meshing, and partially open door frames used the `opaque` render method, which tells the client the block fills its whole cube so neighbouring faces were hidden. Open doors are now a fully transparent cube, partial frames use `alpha_test`, and the validator rejects both mistakes.
- **Floors surfaced through hillsides.** The generator anchored the whole footprint to the topmost block of a single column, so on sloping ground the "underground" levels broke out of the hillside and you looked straight into them, with fog and water where the terrain should have been. Deployment now surveys the whole footprint and refuses sites that are wet or vary by more than five blocks, and every underground slab is encased in solid rock before the modules are carved into it.
- **Bases were far too large.** A floor was a 5×3 grid of 13×13 modules (65×39). It is now a 3×3 grid of 9×9 modules (27×27) — about 29% of the old area — with the entrance rescaled from 21×32 to 15×22 and the escape tunnel shortened to match.
- **Doors were not animated.** The leaf popped away one whole block column at a time. Doors now slide upward in quarter-block steps through new `slide` block states and partial-cube geometry, giving 16 distinct frames for the entrance blast door over about 1.6 seconds, and the same in reverse when closing.
- **The elevator had no animation.** It was a silent 1.5-second pause before a teleport. The ride now rumbles the camera, calls out each deck as it passes, and hides the transfer behind a camera fade.
- Fixed the deployment confirmation showing the wrong entrance coordinate, which also made the "you moved away from the site" check reject valid deployments.

- **The entrance blast door still stuttered.** The client chased a position the server re-sent every tick, so the leaf moved in stop-start bursts whenever updates arrived unevenly, and it started and stopped at full speed. The server now tells the leaf only where it starts, stops or reverses, and the client animates it every frame on its own clock with an ease-in-out. The collision blocks follow the same easing, so they stay in step with the leaf you see. Travel time is unchanged at 1.6 s.

- **Finding a site was too hard.** Deployment refused any footprint whose ground varied by more than five blocks. Uneven ground is now levelled into a flat pad instead: hills are cut away and dips, caves, water and lava under the pad are backfilled with earth that matches the local surface. Sites are refused only if they rise and fall more than 24 blocks, or if water or lava stands above the pad where it would flood the entrance. The confirmation screen shows how much will be cut and filled.

### Found by review

- Fixed the self-destruct console sharing a block with B3's security console, which made the entire self-destruct sequence unreachable: the console opened the security menu instead, and confirming "arm" silently raised an alert.
- Fixed a finished build being recorded as `failed` when the builder disconnected before the completion message could be delivered.
- Fixed persisted snapshots being accepted with missing `floors`, `lasers`, `lights`, `turrets`, `consoles` or `zones`, where a single bad facility aborted a shared tick handler for every facility in the world.
- Laser grids now read each player's clearance once per tick instead of once per beam per player, removing an inventory scan per beam.
- Alarm lamps now write a permutation only when the lit state actually changes, instead of re-applying an identical permutation to every lamp every 10 ticks.
- Cleared stale ids from the pending-save set so they cannot accumulate.
- `tools/package.py` now writes archive entries with forward slashes on every host OS.
- Added a planner regression test asserting that every generated fixture claims a distinct block.

### Found by second review

- **The emergency ladder shaft was a fatal drop.** Installation cleared a two-wide column through every floor but only the east half held the ladder, leaving an open hole beside it in the surface lobby and on each deck, straight down to the deepest floor. Only the ladder column now passes through the floors.
- **The escape hut had no floor.** The B1 tunnel ladder rose through an open 3×3 shaft, so the hut's exit was two blocks of empty air away from the top of the ladder and players fell back down the shaft. The hut now has a floor with a single ladder opening.
- The site survey now also samples the escape hut behind the footprint, so a rise there cannot bury the hut's exit.
- Partially open door frames used box UVs on a 16×16 block texture, so their faces sampled outside the sprite in the terrain atlas. They now use per-face UVs, and the texture rises with the leaf.
- Structure palettes now list every block state (door `slide`, slab `vertical_half`), as game-saved structures do, instead of relying on the game to fill in missing states.
- Added regression tests for the ladder floor openings, the escape hut floor and exit, and the hut survey.

### Smoother doors

- **The entrance blast door now slides smoothly.** While it moves, a `blast_door_leaf` entity draws the leaf and the player's client eases it toward the scripted position every frame, instead of the door stepping with block updates. The door blocks still provide collision and clear course by course as the leaf passes, the leaf is hidden inside the wall once raised, and it is removed when the slide ends. Obstruction still holds a closing door, and a leaf stranded by a reload is cleaned up.
- **Room doors and shutters move in 2-pixel steps every tick**, instead of quarter-block steps every other tick. Travel times are unchanged: 1.2 s for doors and 0.8 s for shutters (the blast door takes 1.6 s).

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
