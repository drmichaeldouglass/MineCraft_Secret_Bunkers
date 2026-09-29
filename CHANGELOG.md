# Changelog

## Unreleased — horizontal tripwires that burn, and controls set into the walls

- **Tripwires are horizontal.** Each floor's east hall had a single vertical beam from the floor up to a receiver hanging under the ceiling. Both halls now have a grid of three horizontal beams, at ankle, waist and chest height (0.4, 1.4 and 2.4 blocks above the floor), from an emitter set into one wall to a receiver in the other. The west grid still raises LOCKDOWN from B3 down; the east grid raises ALERT.
- **Beams you can see.** A beam was a few faint dots drawn every three-quarters of a second. Each beam is now one thin, steady, glowing red line from emitter to receiver, redrawn every quarter second while a player is within 24 blocks.
- **Tripwires burn hostile mobs.** A hostile mob caught in a live beam takes 3 damage every quarter second (12 a second), once per tick however many beams cross it, with a spark where it is hit. Only the turrets' conservative hostile list is burned: never players, villagers, animals, pets or neutral mobs. Grids that are switched off, and facilities in self-destruct or destroyed, burn nothing. Mobs are burned but do not raise the alarm; players and blocked beams still do. This covers every grid, including the tunnel's and the estate's driveway.
- **Controls are set into the walls instead of floating in the air.**
  - Room door readers: the room-side reader now sits in the door's own wall.
  - Lobby consoles: each floor's security and defence consoles are in the lobby's south wall, and the B3 self-destruct console is in its north wall.
  - Lift panels: every lift panel sits in a floor-to-ceiling control column beside its pad, on every floor, in the surface lobby and in the mansion hall.
  - Entrance: the blast door's readers are in the portal facade and the passage wall.
  - Estate: the gate's readers are in the east gate pillar, and the mansion's door readers are in the facade either side of each door. The gatehouse and study consoles sit in floor-to-ceiling cabinet banks, and the driveway grid in concrete posts.
  - Alarm lamps are flush in the ceilings instead of hanging below them.
- **Existing bunkers are upgraded too.** A bunker saved with the old vertical beams gets the new horizontal grids when the world loads. The floor emitter is paved over, the hanging receiver is removed, and the new emitters and receivers are set into the hall walls as soon as a player comes near enough for their chunks to load. An unfinished build is upgraded when it finishes, and a destroyed bunker is left alone.
- Readers, consoles and panels in facilities already built keep the positions they were saved with, so they go on working where they are. New deployments use the new positions.

## Unreleased — Stage 15: fortified estate

- **A second facility: the fortified estate.** The deployment device now offers **Deploy fortified estate** next to the command bunker. It builds a secure mansion inside a walled compound, with a bunker underneath, a secret escape tunnel and automated defences.
- **The compound.** A 75 × 81 block site levelled like the bunker's pad and enclosed by a five-block reinforced concrete wall topped with an iron security fence and floodlights. Inside are a watchtower in each corner, a gatehouse beside the gate, a three-bay garage, a helipad, a fountain, flower beds, hedges along the driveway, and a generator house and garden behind the mansion.
- **The main gate** is a five-wide blast door in the north wall, between two turret-topped pillars. Its two leaves slide into the wall like the bunker's entrance door. It needs a keycard reader on either side and a laser grid across the driveway just inside it raises ALERT.
- **The mansion.** Two storeys in white concrete and deepslate. On the ground floor, a chequered grand hall with the lift and emergency ladder down to the bunker, a staircase, a dining room, a kitchen, a library, and a study that is the estate's defence control room. Upstairs are four bedrooms with real beds and a gallery lounge. Keycard doors front and back, and steel shutters over every window on both long facades. The shutters, like the garage doors, close in a lockdown and open again afterwards.
- **The bunker beneath** is 3–5 floors of the command bunker's own floors, with the same rooms, lifts, ladder, grids, shutters, self-destruct deck and B1 secret tunnel. The tunnel comes up at a terrain-matched exit outside the wall, or at a well in the back garden when no remote site will do.
- **Defences.** Nine laser turrets: one on each gate pillar (zone `gate`), one on each watchtower and one on the mansion roof (zone `perimeter`, both 28-block exterior range), plus the command deck and tunnel junction turrets. Consoles in the gatehouse and in the study.
- **Self-destruct** brings down the floors below, then guts the mansion: fittings, glass and lamps are blown out, the stone is scorched grey, holes are torn through the roof and upper floor, fires are started and the lift is sealed with rubble. The wall, outbuildings and secret tunnel survive.
- The estate is deployed from where its forecourt will be. Anyone standing below the new ground when it is levelled is lifted onto it rather than buried.
- Shared systems generalised for more than one facility type: the underground floors, the secret tunnel and the survey are shared code. Exit sites can be kept clear of a facility's footprint, and exterior turret zones share the long range.
- `tools/preview.py` also renders `docs/estate-preview.png`, a site plan of an assembled estate with the mansion template beside it.

## Unreleased — Stage 14: secret tunnels

- **The escape tunnel now leads somewhere secret.** The B1 tunnel no longer stops at a hut dug into the back of the bunker's mountain. It runs on under the mountain to a junction chamber, then south, east or west to a remote exit 37 to 55 blocks from the core, well clear of the mountain, and a ladder shaft climbs from the tunnel to the surface.
- **Five exits that suit the ground.** A utility shed, a spruce forest cabin, an old dry well, a hidden hatch in the undergrowth and an abandoned mine headframe, each an authored 7×7 template. Deployment surveys nine candidate sites and picks the flattest dry one that keeps at least two blocks of rock over the tunnel. The exit type follows the ground it lands on: a cabin among trees, a well in sand, a mine on bare rock, and a shed, hatch or well on open land. The deployment menu can also force a particular exit. The chosen exit's type, direction, distance and coordinates are shown before you confirm, and again on the debug scanner and the self-destruct screens.
- **Terrain-aware, with a safe fallback.** Exit sites are levelled with cut and fill of up to four blocks, using the local surface block. The tunnel is sealed in stone wherever it crosses a cave. Sites with water, unloaded chunks, rough ground, or ground too low to bury the tunnel are passed over. If no site works, or you choose it, the tunnel comes up at the original rock-face door behind the mountain, which the bunker's own earthworks always make possible. The mountain now closes over the back of the bunker unless that rock-face exit is used.
- **The tunnel is guarded by the shared security systems.** A keycard door (level 1) just outside the B1 room, a two-beam laser grid that raises ALERT when someone without command clearance walks through, an emergency lamp in the junction that flashes with the alarms, and, when defences are enabled, a laser turret at the junction in a new `tunnel` defence zone (ALERT ONLY by default). No missile turret is ever placed underground.
- **Self-destruct leaves the way out intact.** The junction turret shuts down with the rest at detonation, but its demolition blast is no longer set off inside the escape tunnel.
- Bunkers saved before this change keep their hut behind the mountain and resume interrupted builds with exactly the original build steps.
- Structure templates can now contain structure voids (block index −1), which keep the block already in the world. Tunnel exits use them so the levelled ground around them stays in place. The validator and the test harness understand them.
- Horizontal laser grids can now run along x as well as z, which the tunnel's grid needs.
- `tools/preview.py` also renders `docs/tunnel-exits.png`, an isometric view of the five exit templates.

## Unreleased — bug fixes from a third review

- **Lockdown shutters did not seal the hall.** Each floor's shutter covered only the middle two of the corridor's five courses, leaving a one-block gap along the floor that small mobs (baby zombies, silverfish, endermites) walked under, and a two-block gap under the ceiling that a player could climb into with a couple of placed blocks. Shutters now fill the corridor from floor to ceiling and take 2 s to travel. Bunkers saved by earlier builds are grown to full height when the world loads.
- **A dropped item could hold a door open for minutes.** Door closure waited for any entity in the doorway, including dropped items, experience orbs and spent arrows. A mob shot down by the entrance turrets in front of the blast door could stop it closing until its drops despawned. Closing doors now ignore loose items and projectiles and only wait for mobs and players.
- **Teleporting could trip a laser grid.** The tripwire check joins each player's last and current positions so a fast walk between sensor ticks is still caught. After a `/tp`, a respawn or a dimension change, that line could run straight through a beam the player never went near. A jump longer than 8 blocks, or into another dimension, is now treated as a teleport and only the new position is checked.
- Test harness: leftover door jobs from one test no longer carry over into the next and change its timing.

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
