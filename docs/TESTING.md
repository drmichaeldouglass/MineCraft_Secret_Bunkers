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
- Actual block assembly for 3, 5 and 8 floors: paths from the core to every room, reader access, the B1 secret tunnel to its exit, ladder continuity, and no open drop beside the ladder.
- Fortified estates, planned for 3–5 floors and 40 seeds each: the gate is the main door, the lift lands where the bunker's lift expects, every building stands inside the wall and clear of the others, every fixture lies inside the reserved bounds and claims its own block, exit sites lie outside the wall, and the fallback is a well in the garden. Assembled estates: an unbroken fenced wall that only the gate opens, a forecourt that reaches the gatehouse, garage and helipad, front and back doors that must be opened, the lift pad and emergency ladder in the grand hall, every bunker room reachable below, the secret tunnel to an exit beyond the wall, lockdown closing the gate, garage and all 16 window shutters and normal reopening them, nine mounted turrets, watchtower and gate turrets firing at hostiles outside the wall but not at passive mobs, and the driveway grid raising ALERT and shutting the gate. Self-destruct guts the mansion (no readers, doors, shutters, glass, lift pad or unscorched stone left), seals the lift, and leaves the wall, the tunnel and only the tunnel's shut-down turret. The compound survey levels gentle slopes, refuses steep ones and falls back to the garden well when water surrounds the wall. A builder standing below the new ground is lifted onto it. The asset builder checks that the mansion's hall reaches the lift pad, back door, every ground-floor room and the stairs, and that the stairs reach every upstairs room.
- Tripwires: every beam in the plans is horizontal; each floor has a three-beam grid across each hall; each emitter and receiver is in place with nothing in the beam's path; every beam near a player is redrawn each sensor tick as one line across its full span. A zombie and a silverfish in a beam are burned once per tick, a cow, a player and a zombie beside the beam are not, no alarm is raised by mobs, and disabled or distant grids burn nothing.
- Bunkers saved with the old vertical beam are upgraded on load: every beam becomes horizontal with a three-beam grid in each east hall, the old floor emitter and hanging receiver are replaced and the new wall fittings placed once a player is near, the upgrade is saved, and destroyed facilities are left alone.
- Wall-mounted controls, in an assembled bunker, a rock-face bunker and an estate: every reader, console, lift panel and grid fitting has solid blocks above and below it and one open face, and every alarm lamp is flush with at least two solid neighbours. With the old floating reader positions put back, this test fails.
- Secret tunnels: every exit type in every direction, at exit levels from 3 below to 14 above the pad, can be walked to from the B1 core, climbed on one supported ladder and left on foot, on a levelled and cleared site. The exit survey chooses a forest cabin among trees, a well on sand, a mine on rock and a shed, hatch or well on open land; it honours a chosen exit, avoids lakes and valleys, and falls back to the rock face. A cave crossing the tunnel is sealed around it without filling it. The tunnel door, laser grid and junction turret work (the turret holds fire in NORMAL and ignores passive mobs). The planner keeps every tunnel inside the reserved bounds and every exit site clear of the mountain. Legacy saves and the rock-face exit keep the hut behind the mountain.
- A closed entrance that cannot be bypassed and an open entrance connected to the surface lift.
- Large-facility persistence, dynamic-property limits and interrupted-build state.
- Lockdown/shutter response and obstruction-safe closure.
- Door animation: 2-pixel frames for room doors; for the blast door, the leaves appear a tick before any block changes, the columns open from the centre seam outward in pairs only once both leaves are clear of them, the door holds while obstructed, reverses from where it is, and no leaf is left after the slide or a reload.
- The armoury: twelve stands on its floor facing the aisle, reachable from the lobby, each dealt all four pieces and a sword in one metal from loot tables that exist, with one trim per suit and enchantments on every piece; four suits of each metal; a resumed build does not deal a second set; a bunker saved before the armoury keeps a solid mountain there.
- The mountain: solid cover over the lobby and armoury, an open overhung forecourt reachable from outside the mountain, and every charge sealed in on all sides.
- Countdown abort cutoff; demolition that fires every charge (but not a defused one), breaches the walls, removes every fitting, opens every room, seals the portal and removes the turrets, using explosions that do not break blocks; the secret tunnel and its exit survive with no blast inside them.
- Turret target selection, offline behavior, blocked line of sight, and one solid beam emitter per shot ending on the target.
- Turrets placed from spawn eggs: a laser turret with no facility still fires at hostiles only; a missile turret holds fire inside its minimum range, launches a missile that flies to its target and detonates, damages only hostile mobs, breaks no blocks, respects its reload, stops at a wall without the blast reaching through, and stray missiles are cleared.

Independent asset validation checks 85 JSON files, pack UUIDs/dependencies, script imports, 54 block/item identifiers, every entity's client definition, geometry, textures and spawn egg icon, PNG integrity, all sound files, and all 48 NBT templates including palette/index consistency, structure voids and bed block entity data. The asset builder also asserts that every tunnel exit template leaves the shaft column open, has headroom above the ladder, gives the ladder a solid wall all the way up, and has a way out of its footprint.

Regression fixes found during development: a south-facing canteen counter blocked its connector; absolute game-tick modulo could prevent countdown/siren updates when interval start times were offset. Both were corrected before packaging.

## In-game acceptance — not yet run

Enable the content log and perform these checks in a disposable Creative world with the packaged BP/RP:

- [ ] Import on the minimum supported Bedrock version; confirm no content errors.
- [ ] Repeat on the installed current stable game version.
- [ ] Find all seven items, both turret spawn eggs and representative construction blocks; inspect texture, transparency, light and names.
- [ ] Deploy a five-floor defended bunker; remain nearby; inspect its entrance and all required floor roles.
- [ ] Walk into the armoury from the lobby. Check all twelve stands wear four armour pieces and hold a sword, each suit in a single metal with a visible trim on every piece, and that the enchantment glint shows. Take a piece and confirm its enchantments and trim in the inventory tooltip. Check the content log for no `Could not deal` warnings. Deploy a second bunker and confirm its suits differ.
- [ ] Walk every room type. Sleep in a bunk and a bedroom bed and check the bed colours; confirm farm crops grow under the grow lights and the farmland stays wet; mine the ore face; open chests, barrels, furnaces and brewing stands; check no vanilla furniture shows as an unknown block or faces the wrong way in north- and south-facing rooms.
- [ ] Climb between all levels and test the 3-/8-floor extremes.
- [ ] Deploy a fortified estate on plains and on a gentle slope. Walk the wall, look for gaps, and check the fence, floodlights and towers. Open the gate from outside and inside and watch the leaves slide into the wall between the pillars. Walk in without a black card and confirm the driveway grid raises ALERT and shuts the gate. Enter the mansion by the front and back doors, climb the stairs to every bedroom, and check bed colours and that no vanilla block (mangrove stairs and slabs, deepslate tiles, polished deepslate, glass) shows as unknown or faces the wrong way. Take the lift and the emergency ladder down to every floor. Trigger lockdown and watch every window shutter and garage door close, then reopen on NORMAL. Check the watchtower, gate and roof turrets engage hostiles outside the wall. Use the gatehouse and study consoles. Run self-destruct and watch the mansion burn, from the tunnel's exit.
- [ ] Deploy with each exit choice (shed, cabin, well, hatch, mine, rock face) and on automatic in woodland, desert, stony ground and plains. Walk the B1 secret tunnel to its exit and climb out: the ladder must attach and be climbable all the way, the well rim and the hatch's trapdoor must let you out, and no vanilla block in the exits may show as unknown or face the wrong way. Check the tunnel is lit, sealed from caves and not visible from the surface, and that the confirmation's direction and coordinates match where the exit really is. Walk in from the exit without a black card and confirm the grid raises ALERT and shuts the tunnel door.
- [ ] Test the deployment confirmation/cancel, overlap refusal, unloaded-site refusal and resume behavior.
- [ ] Deploy on a hillside and a shoreline; confirm the site is levelled into a flat pad with matching surface blocks and no floating trees or flooding. Confirm a cliff is refused with a clear message.
- [ ] After a successful deploy, walk and fly the whole perimeter: no floor, slab or room may be visible from outside.
- [ ] Look at the mountain from every side and from above: natural slopes, no floating blocks or holes, snow on the summit, skirts blending into the surrounding terrain. Walk in along the approach cut to the portal. With a rock-face exit, also leave by the escape hut's south door.
- [ ] Close/reopen the world mid-build and resume at the original site.
- [ ] Test each keycard in isolation in Survival; confirm master alone grants nothing in Survival.
- [ ] Watch the entrance blast door part at the centre and slide both leaves sideways into the walls, then close again: the leaves must move apart (not overlap each other), meet cleanly at the seam, show no flash of an open or shut doorway at the start or end, and stay hidden inside the wall once open. Stand in its closing path and verify the leaves hold until you move.
- [ ] Watch a room door and a shutter open and close in fine steps; close a whole floor at once with lockdown and note any stutter.
- [ ] Close the world while the blast door is moving; on reload no stray leaf may remain.
- [ ] Use elevator pads in both directions; confirm the camera rumble, per-deck callouts and fade; deny unauthorized floors; test obstruction, leaving the pad mid-ride, and lockdown during a menu/trip.
- [ ] Cross and block laser beams; disable them; verify alert, lockdown, flashing lights and audible sirens. Check both halls' grids show three steady, level red lines from wall to wall, day and night, and that a zombie or skeleton led through a beam takes damage while a villager or pet does not.
- [ ] Open a world with a bunker built by an earlier version of the pack. Walk each floor's east hall: the vertical beam must be gone, the floor and ceiling patched, and three horizontal beams running from wall to wall.
- [ ] Check no reader, console, lift panel, grid fitting or alarm lamp floats: readers beside every door, consoles in the lobby walls, lift panels in their columns, estate gate readers in the pillar and mansion readers in the facade. Use each from where you would naturally stand.
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
