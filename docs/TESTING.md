# Validation and in-game acceptance

## Automated evidence

Run the asset builder before tests. Tests compile real TypeScript against the pinned official APIs and load the compiled JavaScript. Runtime integration tests use a local Minecraft API simulation; they do not run Minecraft itself.

The suite covers:

- Clearance hierarchy and Creative-only master cards.
- Lockdown and evacuation access rules.
- Friendly/neutral exclusion and hostile target eligibility.
- Defence modes and the final evacuation shutdown.
- Horizontal/vertical beam distance calculations.
- 600 seeds/level-count combinations: each floor's fixed rooms and pool, bounds, aligned cores, unique IDs, no module overlap, and demolition charges outside the walls.
- Every room role the floor programs can place has north- and south-facing templates; the asset builder asserts each room keeps its aisle and reader spot clear.
- Deterministic seeds and invalid floor/depth rejection.
- Actual block assembly for 3, 5 and 8 floors: paths from the core to every room, reader access, the B1 escape tunnel and hut exit, ladder continuity, and no open drop beside the ladder.
- A closed entrance that cannot be bypassed and an open entrance connected to the surface lift.
- Large-facility persistence, dynamic-property limits and interrupted-build state.
- Lockdown/shutter response and obstruction-safe closure.
- Door animation: 2-pixel frames for room doors; for the blast door, the leaves appear a tick before any block changes, the columns open from the centre seam outward in pairs only once both leaves are clear of them, the door holds while obstructed, reverses from where it is, and no leaf is left after the slide or a reload.
- The mountain: solid cover over the lobby, an open overhung forecourt reachable from outside the mountain, the hut's exit onto clear ground, and every charge sealed in on all sides.
- Countdown abort cutoff; demolition that fires every charge (but not a defused one), breaches the walls, removes every fitting, opens every room, seals the portal and removes the turrets, using explosions that do not break blocks.
- Turret target selection, offline behavior, blocked line of sight, and one solid beam emitter per shot ending on the target.
- Turrets placed from spawn eggs: a laser turret with no facility still fires at hostiles only; a missile turret holds fire inside its minimum range, launches a missile that flies to its target and detonates, damages only hostile mobs, breaks no blocks, respects its reload, stops at a wall without the blast reaching through, and stray missiles are cleared.

Independent asset validation checks 85 JSON files, pack UUIDs/dependencies, script imports, 54 block/item identifiers, every entity's client definition, geometry, textures and spawn egg icon, PNG integrity, all sound files, and all 43 NBT templates including palette/index consistency and bed block entity data.

Regression fixes found during development: a south-facing canteen counter blocked its connector; absolute game-tick modulo could prevent countdown/siren updates when interval start times were offset. Both were corrected before packaging.

## In-game acceptance — not yet run

Enable the content log and perform these checks in a disposable Creative world with the packaged BP/RP:

- [ ] Import on the minimum supported Bedrock version; confirm no content errors.
- [ ] Repeat on the installed current stable game version.
- [ ] Find all seven items, both turret spawn eggs and representative construction blocks; inspect texture, transparency, light and names.
- [ ] Deploy a five-floor defended bunker; remain nearby; inspect its entrance and all required floor roles.
- [ ] Walk every room type. Sleep in a bunk and a bedroom bed and check the bed colours; confirm farm crops grow under the grow lights and the farmland stays wet; mine the ore face; open chests, barrels, furnaces and brewing stands; check no vanilla furniture shows as an unknown block or faces the wrong way in north- and south-facing rooms.
- [ ] Climb between all levels, use the B1 escape route out through the surface hut, and test the 3-/8-floor extremes.
- [ ] Test the deployment confirmation/cancel, overlap refusal, unloaded-site refusal and resume behavior.
- [ ] Deploy on a hillside and a shoreline; confirm the site is levelled into a flat pad with matching surface blocks and no floating trees or flooding. Confirm a cliff is refused with a clear message.
- [ ] After a successful deploy, walk and fly the whole perimeter: no floor, slab or room may be visible from outside.
- [ ] Look at the mountain from every side and from above: natural slopes, no floating blocks or holes, snow on the summit, skirts blending into the surrounding terrain. Walk in along the approach cut to the portal, and out of the escape hut's south door.
- [ ] Close/reopen the world mid-build and resume at the original site.
- [ ] Test each keycard in isolation in Survival; confirm master alone grants nothing in Survival.
- [ ] Watch the entrance blast door part at the centre and slide both leaves sideways into the walls, then close again: the leaves must move apart (not overlap each other), meet cleanly at the seam, show no flash of an open or shut doorway at the start or end, and stay hidden inside the wall once open. Stand in its closing path and verify the leaves hold until you move.
- [ ] Watch a room door and a shutter open and close in fine steps; close a whole floor at once with lockdown and note any stutter.
- [ ] Close the world while the blast door is moving; on reload no stray leaf may remain.
- [ ] Use elevator pads in both directions; confirm the camera rumble, per-deck callouts and fade; deny unauthorized floors; test obstruction, leaving the pad mid-ride, and lockdown during a menu/trip.
- [ ] Cross and block laser beams; disable them; verify alert, lockdown, flashing lights and audible sirens.
- [ ] Confirm neutral mobs and every friendly category are ignored by turrets; test zombie, skeleton, creeper, witch and pillager targets.
- [ ] Verify turret model orientation, pitch, sound and wall occlusion; the shot must read as one continuous glowing beam from muzzle to target, day and night, with an impact flash. Kill/remove a turret and reload.
- [ ] Toggle local/all defence modes; verify red versus black clearance.
- [ ] Place a laser and a missile turret from their spawn eggs on open ground away from any bunker. Check both models face and pitch toward targets; the missile turret must ignore a zombie closer than 10 blocks and fire at one 15–40 blocks away. Watch the missile's model, orientation, flame and smoke trail and the explosion; confirm no blocks break and a nearby player, villager and pet are unhurt. Fire one into a wall. Reload the world with a missile in flight and confirm no missile is left hanging in the air.
- [ ] Test arming cancellation, second confirmation, abort, final-ten-second shutdown and permanent destroyed state. Watch the full demolition from the surface and from the escape tunnel: floors going deepest first, charge explosions, gutted rooms, a sealed portal, no mass of item drops, and the frame rate during the blasts. Dig out a charge first and confirm the console count drops. Reload a destroyed bunker and confirm no doors reappear.
- [ ] Reload NORMAL, LOCKDOWN and countdown states; verify saved doors, zones and floors.
- [ ] Test two players with different cards and concurrent/stale menus.
- [ ] Test mobile/controller interaction and form cancellation.
- [ ] Profile several nearby bunkers, idle facilities and repeated unload/reload cycles; check particle/audio budgets.

Record game version, content-log messages, seed, world coordinates and action sequence for any failure. Automated checks alone cannot certify this release as production-ready.
