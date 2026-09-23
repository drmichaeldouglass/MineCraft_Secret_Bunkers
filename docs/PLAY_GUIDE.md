# Installation and play guide

## First launch

Open `dist/Secret_Facilities_0.1.0.mcaddon` using Minecraft Bedrock 1.21.90+. Both packs must be activated on the world. The behavior pack declares its resource-pack dependency.

Use a Creative test world with cheats enabled. The device and scanner deliberately refuse Survival use. Normal keycards, readers, consoles, elevators and alarms are available in Survival after deployment.

Get the starter kit with `/scriptevent secretfacilities:kit`, or use `/give @s secretfacilities:facility_deployment_device` and choose **Get development kit**. The kit includes the deployment device, debug scanner and all five keycards. Existing kit items are not duplicated; overflow is dropped nearby if the inventory is full.

## Place a bunker

Choose dry, reasonably level, open land. The surface portal is anchored to the top block ten blocks south of the player. Bunker rooms extend underneath this site; they are not restricted to existing caves. It currently uses a fixed north-facing entrance and does not automatically search for or sculpt an ideal hillside.

Choose 3–8 underground floors, a seed, and whether to include defences. The default is five floors. The confirmation shows the entrance, depth and footprint before any construction begins.

Construction replaces blocks in the modules and infrastructure. Its reserved bounds are 27 × 42 blocks horizontally (a 27 × 27 floor plate plus the rear escape tunnel), from nine blocks per underground floor below the portal to eight blocks above it. The site must be dry and level to within five blocks, and the underground volume is encased in stone. Existing registered facilities must have an eight-block gap. The alpha supports at most 16 registered facilities in one world.

Stay near the entrance while construction runs. It places one template or installation operation every two ticks. If the site unloads or the game is closed during construction, return to the same area and use **Resume interrupted construction**. Resuming retries the saved build step; it does not undo already placed blocks. Keep other players out until construction is complete.

## Keycards

The **highest-clearance card anywhere in your inventory** applies. You do not need to hold it. Remove the other cards to test a lower clearance. Master cards work only in Creative.

| Card | Level | Typical access |
|---|---:|---|
| Green | 1 | Entrance, B1 |
| Blue | 2 | B2 and lower-clearance areas |
| Red | 3 | B3 and the local defence console |
| Black | 4 | B4 and deeper, security reset, all defence zones, self-destruct |
| Master | 5 | All clearance checks, Creative only |

Doors start open inside the facility; alarms close them. The exterior blast door starts closed. Interact with a reader on either side to toggle its registered door. Lockdown requires black or Creative master clearance to reopen doors. Door closure waits if an entity is in its path.

## Elevators and escape routes

Each floor has a cyan elevator pad in the central lobby. Stand on it, interact with the adjacent elevator panel, and select a floor. The prototype plays a travel sound, waits briefly, then safely transfers the player. Clearance and destination occupancy are rechecked before arrival. Leaving the pad cancels travel. It does not have a physically moving cabin or animated cabin doors yet.

The emergency ladder is on the east side of the lobby; it runs between every floor and the surface. B1 also has a secondary route: enter the room immediately south of the central lobby and continue through its rear wall into the service tunnel. Climb the ladder at the far end to the utility hut.

## Security controls

The central lobby contains a **Security Console** and a **Turret Control Console**. The security console needs black clearance and provides NORMAL, ALERT, LOCKDOWN and laser enable/disable actions. On B3 the security console position is occupied by the self-destruct console; use another floor's security console or the debug scanner to reset alarms.

- NORMAL uses the configured defence modes. Shutters are raised. Previously closed security doors can be reopened at readers.
- ALERT activates sirens, flashing emergency lights, and closes security doors.
- LOCKDOWN also lowers shutters and restricts elevators to command clearance.
- Laser grids detect unapproved player crossings or a blocked beam. Black and Creative master cards bypass crossing detection; a physically blocked beam still triggers its response. Lower cards can open room doors but do not bypass laser grids.
- Disable laser grids at a security console before testing ordinary clearance access without alarms.

## Defences

With defences enabled, two laser turrets guard the entrance in ACTIVE mode with a 28-block range. A third, on the north edge of the command corridor, starts in ALERT ONLY mode with a 16-block range. Damage is five health points per shot with a 20-tick cooldown.

Red clearance changes the console's local command zone. Black clearance can change every zone, including the entrance. Modes are ACTIVE, OFFLINE, STANDBY, ALERT ONLY and LOCKDOWN ONLY. OFFLINE and STANDBY do not fire.

Turrets use a central conservative allowlist of hostile mob types. They ignore players, villagers, animals, pets, and facility entities. Neutral creatures, including spiders, are excluded because the current adapter cannot reliably establish their aggression. Walls block firing. There are no missile turrets or destructive turret explosions in this release.

Turrets are real persistent entities with 80 health. A destroyed turret is not automatically respawned. Placing a turret mount or control block manually does not create a connected defence; functional systems are registered by the deployment process.

## Self-destruct

The B3 self-destruct console needs a black or Creative master card. It has separate arming and authorization confirmations. On authorization:

1. The 90-second countdown starts and all doors/shutters open for evacuation.
2. Defences continue according to their configured modes until ten seconds remain.
3. Defences stop firing for the final ten seconds. The abort window closes.
4. Several structures in one room on each floor change to damaged panels, accompanied by sound.
5. The facility becomes permanently DESTROYED. Elevators and defences are disabled.

The sequence uses bounded block changes and does not spawn TNT or uncontrolled explosions. It is an alpha damage effect, not a cinematic collapse of the entire bunker. It preserves the emergency routes. Countdown progress pauses while no player is near the facility and is saved approximately every two seconds.

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
| Access seems unrestricted | Remove black/master cards from all inventory slots before testing lower cards |
| Repeated alarms after reset | Disable grids or clear their beams before returning to NORMAL |
| Elevator fails | Stand on the cyan pad; clear the destination pad; use the ladder if a floor is unloaded |
| Turret does not fire | Check difficulty, hostile type, zone mode, range, line of sight, and whether the turret was destroyed |

Report the exact Minecraft version, content-log error, facility seed, and failing action. This package has not yet undergone in-game acceptance testing.
