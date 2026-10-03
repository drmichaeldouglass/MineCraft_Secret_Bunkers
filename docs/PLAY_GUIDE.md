# Installation and play guide

## First launch

Open `dist/Secret_Facilities_0.2.2.mcaddon` using Minecraft Bedrock 1.21.90+. Both packs must be activated on the world. The behavior pack declares its resource-pack dependency.

Use a Creative test world with cheats enabled. The device and scanner deliberately refuse Survival use. Normal keycards, readers, consoles, elevators and alarms are available in Survival after deployment.

Get the starter kit with `/scriptevent secretfacilities:kit`, or use `/give @s secretfacilities:facility_deployment_device` and choose **Get development kit**. The kit includes the deployment device, debug scanner, all five keycards and spawn eggs for the laser and missile turrets. Existing kit items are not duplicated; overflow is dropped nearby if the inventory is full.

## Place a bunker

Choose open land. The surface portal is anchored to the top block ten blocks south of the player. Bunker rooms extend underneath this site; they are not restricted to existing caves. The entrance always faces north.

Choose 3–8 underground floors, whether to include defences, where the secret escape tunnel comes up, and a seed. The default is five floors and an automatic exit. The confirmation shows the entrance, depth and footprint before any construction begins.

Construction replaces blocks in the modules and infrastructure, then buries the whole site under a mountain. The bunker itself is 27 × 42 blocks horizontally (a 27 × 27 floor plate plus the start of the escape tunnel), from nine blocks per underground floor below the portal. The mountain rises about 24 blocks above the pad and spreads to 51 × 55 blocks; beyond the levelled pad its slopes are only laid into air and water, so they drape over the surrounding terrain rather than cutting into it. Uneven ground is levelled into a flat pad two blocks wider than the footprint: high ground is cut away (up to 12 blocks) and dips, caves, water and lava under the pad are filled (up to 12 blocks) with earth matching the surface. The pad stays at the entrance ground when it can. A site is refused only if it rises and falls more than 24 blocks, or if water or lava stands above the pad level. The confirmation shows how much will be cut and filled. The underground volume is encased in stone. Existing registered facilities must have an eight-block gap. The alpha supports at most 16 registered facilities in one world.

The portal stays open: a cave mouth with an overhanging rock brow and two floodlights, reached along an open cut in the north face of the mountain. The escape tunnel's exit stands on its own ground beyond the mountain; see below.

Stay near the entrance while construction runs. It places one template or installation operation every two ticks. If the site unloads or the game is closed during construction, return to the same area and use **Resume interrupted construction**. Resuming retries the saved build step; it does not undo already placed blocks. Keep other players out until construction is complete.

## Deploy a fortified estate

Choose **Deploy fortified estate** in the deployment device. Pick 3–5 floors for the bunker beneath the mansion, whether to include defences, and where the secret tunnel should come out (every choice except the rock face; there is no mountain). Stand where you want the forecourt: the gate is built about 15 blocks north of you, and the compound reaches about 40 blocks either side and 65 blocks south. The whole 79 × 85 block site is surveyed and levelled like the bunker's pad, with up to 12 blocks of cut and 12 of fill, and it must be loaded. Anyone standing below the new ground is lifted onto it.

What you get:

- **A walled compound.** The wall is five blocks of reinforced concrete with an iron security fence and floodlights along the top. A watchtower stands in each corner. Climb its ladder to a railed platform with a laser turret.
- **The main gate** is a blast door in the middle of the north wall, between two pillars with a turret on each. Use the reader set into the east pillar, on its outer or inner face (green card or better). Just inside, a two-beam laser grid across the driveway raises ALERT when anyone without a black card walks through, and the alert shuts the gate.
- **The gatehouse** beside the gate has a security console and a defence console for the `gate` zone, set into a bank of cabinets along its east wall.
- **The forecourt** has a three-bay garage with shutter doors, a helipad, a fountain and flower beds.
- **The mansion.** The front and back doors need a green card; their readers are set into the facade either side of each door. The grand hall has the lift pad and panel for the bunker below, the emergency ladder, and a staircase up the west side. The west wing is the dining room and kitchen. The east wing is the library and the study, which is the defence control room, with a security console and a defence console for the `perimeter` zone. Upstairs are four bedrooms with real beds and a gallery lounge. Every window on the north and south facades has a steel shutter that drops in a lockdown.
- **Behind the mansion** are a garden path and the generator house.
- **Beneath it all** is the bunker, 3–5 floors of the same floors as the command bunker, including the B3 self-destruct deck and the B1 secret tunnel. The tunnel comes up at a remote exit outside the wall, or at a well in the back garden if no remote site suits.

With defences, the gate turrets start ACTIVE and the watchtower and roof turrets (zone `perimeter`) start ACTIVE, all with the 28-block exterior range. The command deck and tunnel turrets start in ALERT ONLY. Self-destruct demolishes the floors below. Then the mansion is gutted and set alight, its windows and fittings are blown out, holes open through its roof, and the lift in the hall is sealed with rubble. The wall, towers, outbuildings and tunnel are left standing.

## Keycards

The **highest-clearance card anywhere in your inventory** applies. You do not need to hold it. Remove the other cards to test a lower clearance. Master cards work only in Creative.

| Card | Level | Typical access |
|---|---:|---|
| Green | 1 | Entrance, B1 |
| Blue | 2 | B2 and lower-clearance areas |
| Red | 3 | B3 and the local defence console |
| Black | 4 | B4 and deeper, security reset, all defence zones, self-destruct |
| Master | 5 | All clearance checks, Creative only |

Doors start open inside the facility; alarms close them. The exterior blast door starts closed; it splits down the middle and its two leaves slide apart sideways into the walls, taking about two seconds. Interact with a reader on either side to toggle its registered door. Lockdown requires black or Creative master clearance to reopen doors. Door closure waits if an entity is in its path.

## Elevators and escape routes

Each floor has a cyan elevator pad in the central lobby. Stand on it, interact with the elevator panel in the steel control column beside it, and select a floor. The prototype plays a travel sound, waits briefly, then safely transfers the player. Clearance and destination occupancy are rechecked before arrival. Leaving the pad cancels travel. It does not have a physically moving cabin or animated cabin doors yet.

The emergency ladder is on the east side of the lobby; it runs between every floor and the surface.

### Armoury

A doorway in the east wall of the surface lobby leads to the armoury, a steel-backed hall of twelve armour stands: eight along the far wall and two either side of the doorway. Each stand wears a full suit of gold, diamond or netherite armour and holds a sword of the same metal, four suits of each metal. Every piece of armour and every sword is enchanted as if from a fully powered enchanting table, without curses, so each suit has its own mix of enchantments. All four pieces of a suit share one armour trim, and no two suits share a trim. The suits are dealt when the bunker is built, so every bunker's armoury is different. Take what you need: the armour comes off the stands like any other.

### The secret tunnel

B1 also has a secret escape tunnel. Enter the room immediately south of the central lobby and continue through its rear wall. The tunnel passes a keycard door (green card or better) and a laser grid, reaches a small junction chamber under the back of the mountain, then runs south, east or west to a ladder shaft. The ladder climbs to a remote exit 37 to 55 blocks from the core, clear of the mountain, so the way out cannot be seen from the bunker.

When you deploy, the device surveys nine possible exit sites and picks the flattest dry one that keeps at least two blocks of rock over the tunnel. The exit type follows the ground there, or you can choose one in the deployment menu:

| Exit | Chosen for | How you get out |
|---|---|---|
| Utility shed | Open land | Climb into the concrete shed and leave by its south door |
| Forest cabin | Woodland (trees around the site) | Climb into the spruce cabin and leave by its south door |
| Old well | Sand, or open land | Climb to the top of the well shaft, step onto the rim and drop down |
| Hidden hatch | Open land | Open the trapdoor above the ladder and climb out into the undergrowth |
| Abandoned mine | Bare rock, gravel or stone | Climb out under the timber headframe |

An exit site can be cut or filled by up to four blocks. It is levelled with the local surface block, and the tunnel is sealed in stone wherever it crosses a cave. Sites under water, in unloaded chunks, on rough ground, or too low to keep the tunnel buried are skipped. If none will do, or you choose **Rock face behind the mountain**, the tunnel instead comes up in a hut dug into the back of the mountain, with its door facing south onto a cleared apron. That is also where bunkers deployed before this version keep their exit. The confirmation screen, the debug scanner and the self-destruct screen all tell you which exit you have, in which direction, how far, and its coordinates.

From the outside the exit is a way *in*. The tunnel's laser grid raises ALERT when anyone without a black card walks through it, and the alert closes the tunnel door. With defences enabled, a laser turret in the junction chamber (zone `tunnel`, ALERT ONLY by default) fires at hostile mobs once the alarm is up.

## Rooms

Every floor has a purpose, and each of its six rooms is furnished with working vanilla blocks:

| Floor | Always has | May also have |
|---|---|---|
| B1 Administration & Security | Security office, office | Briefing room, archive, supply depot, lounge, mess hall |
| B2 Living Quarters | Bunk room, officer's bedroom, mess hall, lounge, hydroponic farm | A second bedroom, infirmary |
| B3 Command | Command centre, data centre | Briefing room, security office, office, archive, lounge |
| B4 Engineering & Mining | Power plant, workshop, mining face | Water treatment, data centre, supply depot, a second mining face |
| B5 High Security | Strongroom, security office | Laboratory, archive, supply depot, data centre, a second strongroom |
| B6 Hydroponics & Supply | Hydroponic farm, supply depot | More farms, mess hall, water treatment, workshop, bedroom |
| B7 Research | Laboratory, infirmary | A second laboratory, data centre, archive, workshop, water treatment |
| B8 Deep Excavation | Mining face, strongroom | A second mining face, supply depot, power plant, workshop, water treatment |

- **Bunk rooms and bedrooms** have real beds you can sleep in and set your spawn at, with barrel lockers and chests.
- **Hydroponic farms** grow wheat, carrots, potatoes and beetroot on irrigated farmland under sea-lantern grow lights, with a composter.
- **Mining faces** are live rock walls full of coal, iron, copper, gold, redstone, lapis and occasional diamond ore, with a railed drift, blast furnace, furnace and ore storage. The rock continues into the stone around the bunker.
- **Mess halls** have a smoker, furnace, sink and tables with cake; **lounges** have sofas, a screen, a jukebox and note blocks; **workshops** have crafting, smithing, fletching and cartography tables, a stonecutter and furnaces.
- **Infirmaries** and **laboratories** have brewing stands and water cauldrons; the lab also has an enchanting table among bookshelves.
- **Supply depots**, **strongrooms**, **offices** and **archives** are lined with real chests and barrels. Containers start empty.

## Security controls

Each floor's central lobby has a **Security Console** and a **Turret Control Console** set into its south wall, beside the passage to the room behind. On B3 the **Self-Destruct Console** is set into the lobby's north wall opposite them. The security console needs black clearance and provides NORMAL, ALERT, LOCKDOWN and laser enable/disable actions. Every door's reader is set into the wall beside it: one on the room side and one on the hall side.

- NORMAL uses the configured defence modes. Shutters are raised. Previously closed security doors can be reopened at readers.
- ALERT activates sirens, flashing emergency lights, and closes security doors.
- LOCKDOWN also lowers shutters and restricts elevators to command clearance.
- Each hall has a laser grid: three horizontal red beams, at ankle, waist and chest height, from an emitter in one wall to a receiver in the other. The west grid raises LOCKDOWN from B3 down and ALERT above; the east grid raises ALERT.
- Laser grids detect unapproved player crossings or a blocked beam. Black and Creative master cards bypass crossing detection; a physically blocked beam still triggers its response. Lower cards can open room doors but do not bypass laser grids.
- Live beams burn hostile mobs caught in them: 3 damage every quarter second. They never hurt players, villagers, animals or pets, and a mob in a beam does not raise the alarm. Disabled grids burn nothing.
- Disable laser grids at a security console before testing ordinary clearance access without alarms.

## Defences

With defences enabled, two laser turrets guard the entrance in ACTIVE mode with a 28-block range. A third, on the north edge of the command corridor, starts in ALERT ONLY mode with a 16-block range, and a fourth guards the secret tunnel's junction in ALERT ONLY mode with a 16-block range. Damage is five health points per shot with a 20-tick cooldown.

Red clearance changes the console's local command zone. Black clearance can change every zone, including the entrance and the tunnel. Modes are ACTIVE, OFFLINE, STANDBY, ALERT ONLY and LOCKDOWN ONLY. OFFLINE and STANDBY do not fire.

Each shot is a solid, glowing red beam from the turret's muzzle to its target, with a flash and sparks where it hits.

Turrets use a central conservative allowlist of hostile mob types. They ignore players, villagers, animals, pets, and facility entities. Neutral creatures, including spiders, are excluded because the current adapter cannot reliably establish their aggression. Walls block firing. No turret explosion breaks blocks.

Turrets are real persistent entities with 80 health. A destroyed turret is not automatically respawned. Placing a turret mount or control block manually does not create a connected defence; functional systems are registered by the deployment process.

## Placing your own turrets

**Laser Turret** and **Missile Turret** spawn eggs are in the Creative inventory under Spawn Eggs, and in the development kit. You can also use `/give @s secretfacilities:laser_turret_spawn_egg` or `/give @s secretfacilities:missile_turret_spawn_egg`. Use the egg on a block to place the turret on top of it. Placed turrets work anywhere, with or without a bunker, and are always active; they use the same hostile-only target filter and need a player within 64 blocks to operate. They are not connected to any facility, so the consoles, zone modes and self-destruct do not control them. To remove one, destroy it (80 health for the laser, 120 for the missile turret).

| Turret | Range | Reload | Damage |
|---|---|---|---|
| Laser | Up to 24 blocks | 1 second | 5 per shot |
| Missile | 10 to 40 blocks | 3 seconds | Up to 14 in a 3.5-block blast, falling off with distance |

The missile turret will not fire at anything closer than 10 blocks, so a mob that reaches it is safe from its own launcher; pair it with a laser turret for close defence. Each missile flies at 24 blocks a second with a smoke trail, steers gently after its target, and detonates on contact, within 1.5 blocks of the target, against a wall, or after three seconds. The blast is scripted: it breaks no blocks, starts no fires, and hurts only hostile mobs with a clear line to it, never players, pets, villagers or animals.

## Self-destruct

The bunker is built with demolition charges: real TNT blocks sealed in the rock one block outside its walls, twelve around each floor and four against the surface lobby and armoury. The B3 self-destruct console needs a black or Creative master card, shows how many charges are still in place, and has separate arming and authorization confirmations. On authorization:

1. The 90-second countdown starts and all doors/shutters open for evacuation.
2. Defences continue according to their configured modes until ten seconds remain.
3. Defences stop firing for the final ten seconds. The abort window closes.
4. At zero the floors go one per second, deepest first. On each floor the charges explode and blast breaches through the walls beside them; every room and hall is gutted — shell scorched to damaged panels, doors, lights, consoles and machinery blown out, cavities torn through the walls, part of the ceiling brought down in gravel, rubble and fires left behind — and every room takes a real explosion.
5. Last, the surface lobby caves in, the portal passage fills with rubble and the turrets are destroyed. The armoury is gutted with it, and any armour still on its stands is lost.
6. The facility becomes permanently DESTROYED.

The explosions are real: they damage and knock back anyone still inside, so evacuate. They do not break blocks themselves (the demolition is scripted), so the ruin does not shower the area with item drops. Containers and furniture caught in the blasts are lost. The B1 secret tunnel and its exit are left standing as the way out; the junction turret shuts down, but no demolition blast goes off in the tunnel. A charge dug out before zero is simply missing from the blast. Countdown and demolition pause while no player is near the facility and are saved approximately every two seconds.

To abort before the final ten seconds, interact with the same console and confirm **Abort sequence**. The debug scanner cannot resurrect a destroyed facility.

## Debug scanner

The Creative-only scanner displays facility ID, seed, bounds, floors and system counts. It can reset security with lasers disabled, trigger alert/lockdown, open/close doors, and enable/disable all defences.

## Troubleshooting

| Symptom | Check |
|---|---|
| Purple/missing textures or invisible custom blocks | Activate the matching RP and BP, then leave and reopen the world |
| Device does nothing | Confirm Creative mode, both packs, and game version; inspect the content log for script errors |
| No registered facility | Stand within six blocks of its reserved bounds; manually placed consoles are unlinked |
| Build paused | Return to the original site; increase simulation distance if necessary; resume with the deployment device |
| "Part of the site has not loaded" | Deployment holds the site with two temporary ticking areas named after the facility. A world allows 10; remove unused ones (`/tickingarea list`, `/tickingarea remove <name>`) or raise simulation distance, then deploy again |
| Access seems unrestricted | Remove black/master cards from all inventory slots before testing lower cards |
| Repeated alarms after reset | Disable grids or clear their beams before returning to NORMAL |
| Elevator fails | Stand on the cyan pad; clear the destination pad; use the ladder if a floor is unloaded |
| Turret does not fire | Check difficulty, hostile type, zone mode, range, line of sight, and whether the turret was destroyed. A missile turret holds fire inside 10 blocks |

Report the exact Minecraft version, content-log error, facility seed, and failing action. This package has not yet undergone in-game acceptance testing.

