# Validation and in-game acceptance

## Automated evidence

Run the asset builder before tests. Tests compile real TypeScript against the pinned official APIs and load the compiled JavaScript. Runtime integration tests use a local Minecraft API simulation; they do not run Minecraft itself.

The suite covers:

- Clearance hierarchy and Creative-only master cards.
- Lockdown and evacuation access rules.
- Friendly/neutral exclusion and hostile target eligibility.
- Defence modes and the final evacuation shutdown.
- Horizontal/vertical beam distance calculations.
- 600 seeds/level-count combinations: required rooms, bounds, aligned cores, unique IDs and no module overlap.
- Deterministic seeds and invalid floor/depth rejection.
- Actual block assembly for 3, 5 and 8 floors: paths from the core to every room, reader access, the B1 escape tunnel and hut exit, ladder continuity, and no open drop beside the ladder.
- A closed entrance that cannot be bypassed and an open entrance connected to the surface lift.
- Large-facility persistence, dynamic-property limits and interrupted-build state.
- Lockdown/shutter response and obstruction-safe closure.
- Door animation: 2-pixel frames for room doors; for the blast door, the leaf appears a tick before any block clears, its blocks track its position, it holds while obstructed, and no leaf is left after the slide or a reload.
- Countdown abort cutoff and permanent bounded destruction.
- Turret target selection, offline behavior and blocked line of sight.

Independent asset validation checks 75 JSON files, pack UUIDs/dependencies, script imports, 54 block/item identifiers, PNG integrity, all sound files, and all 33 NBT templates including palette/index consistency.

Regression fixes found during development: a south-facing canteen counter blocked its connector; absolute game-tick modulo could prevent countdown/siren updates when interval start times were offset. Both were corrected before packaging.

## In-game acceptance — not yet run

Enable the content log and perform these checks in a disposable Creative world with the packaged BP/RP:

- [ ] Import on the minimum supported Bedrock version; confirm no content errors.
- [ ] Repeat on the installed current stable game version.
- [ ] Find all seven items and representative construction blocks; inspect texture, transparency, light and names.
- [ ] Deploy a five-floor defended bunker; remain nearby; inspect its entrance and all required floor roles.
- [ ] Walk every room, climb between all levels, use the B1 escape route out through the surface hut, and test the 3-/8-floor extremes.
- [ ] Test the deployment confirmation/cancel, overlap refusal, unloaded-site refusal and resume behavior.
- [ ] Deploy beside a hill, a cliff and a shoreline; confirm the survey refuses each with a clear message.
- [ ] After a successful deploy, walk and fly the whole perimeter: no floor, slab or room may be visible from outside.
- [ ] Close/reopen the world mid-build and resume at the original site.
- [ ] Test each keycard in isolation in Survival; confirm master alone grants nothing in Survival.
- [ ] Watch the entrance blast door slide up smoothly, then close again: no flash of an open or shut doorway at the start or end, no leaf showing above the door or through the roof, and the leaf lined up with the wall rather than rotated. Stand in its closing path and verify the leaf holds until you move.
- [ ] Watch a room door and a shutter open and close in fine steps; close a whole floor at once with lockdown and note any stutter.
- [ ] Close the world while the blast door is moving; on reload no stray leaf may remain.
- [ ] Use elevator pads in both directions; confirm the camera rumble, per-deck callouts and fade; deny unauthorized floors; test obstruction, leaving the pad mid-ride, and lockdown during a menu/trip.
- [ ] Cross and block laser beams; disable them; verify alert, lockdown, flashing lights and audible sirens.
- [ ] Confirm neutral mobs and every friendly category are ignored by turrets; test zombie, skeleton, creeper, witch and pillager targets.
- [ ] Verify turret model orientation, pitch, particle visibility, sound and wall occlusion; kill/remove a turret and reload.
- [ ] Toggle local/all defence modes; verify red versus black clearance.
- [ ] Test arming cancellation, second confirmation, abort, final-ten-second shutdown and permanent destroyed state.
- [ ] Reload NORMAL, LOCKDOWN and countdown states; verify saved doors, zones and floors.
- [ ] Test two players with different cards and concurrent/stale menus.
- [ ] Test mobile/controller interaction and form cancellation.
- [ ] Profile several nearby bunkers, idle facilities and repeated unload/reload cycles; check particle/audio budgets.

Record game version, content-log messages, seed, world coordinates and action sequence for any failure. Automated checks alone cannot certify this release as production-ready.
