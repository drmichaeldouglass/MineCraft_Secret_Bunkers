# Implementation status

## Release boundary

The source plan explicitly prioritizes a smaller reliable bunker and staged shared systems before all eleven facility archetypes. Version 0.1.0 implements the command-bunker foundation with simplified art and animation. It is not a claim that every acceptance criterion in the 59-section specification is complete.

| Area | Current implementation | Remaining work |
|---|---|---|
| Foundation | BP/RP, pinned TypeScript/API pipeline, validation, packaging, source and tests | In-game import acceptance; CI |
| Palette | 47 custom textured blocks, light state, seven items | Bespoke geometry for consoles, pipes, panels and readers; facility-specific palettes |
| Modular construction | 33 binary templates; 13×7×13 rooms and halls; 9-block floor spacing | Separate corner/T/cross/stair exports, large room families, richer furniture |
| Bunker generation | 3–8 floors; guaranteed connected hall and core; seed selects room types | More varied topology and weighted room pools; site preview; rollback/removal tooling |
| Terrain entrance | Surface-height-anchored reinforced portal, nine-wide blast door | Hill-profile detection, arbitrary rotations, terrain blending and grading |
| Doors | Stateful multi-block doors, sequential center-out retraction, reader clearance, obstruction handling | Sliding mesh animation, articulated locking assemblies |
| Elevators | Clearance-controlled timed transfer pads, safe destination checks, emergency ladder | Cabin doors, floor indicators, freight/other visual variants |
| Security | Horizontal/vertical grids, alert/lockdown, sirens, flashing lights, shutters | Local-response configuration UI; alarm/status console texture permutations |
| Defence | Laser entity/model, aiming, local searches, cached targets, LOS, cooldown, modes, two zones | Native aggression adapter for neutral mobs, field performance measurements, richer animation/damage visuals |
| Missiles | Construction base block only | Missile entity/projectile, minimum range, launch/reload, safe impact, tests |
| Escape | B1 tunnel, climbable exit shaft, surface utility hut | Terrain-aware remote exits and alternative escape modules |
| Self-destruct | Two confirmations, countdown/abort, final turret cutoff, bounded damage, destroyed state | Cinematic sequence and more varied damaged rooms |
| Persistence | Per-facility two-bank snapshots; saved build step, doors, floors, zones, countdown, turret state | Migration beyond schema 1, transactional rollback of terrain |
| Natural generation | Not enabled | Jigsaw pools/sets/processors and biome feature rules after in-game template acceptance |
| Facility variety | Command bunker only | Estate, mountain, Arctic, desert, island, silo, laboratory, listening station, metro and volcano |
| Tests | Strict compilation, rules, 600 plans, template assembly, navigation, state, defence, NBT and assets | Full Minecraft, multiplayer, device-specific and extended-session acceptance |

## Intentional exclusions

No guards, soldiers, custom enemy NPCs, loot system, missions, quests, story campaign, hacking puzzles, camera detection, handheld weapons, functional silo missiles, or submarines were added.

Furniture uses construction blocks, including decorative bunks and archive cabinets. These are not functional beds, loot chests or inventory containers.

## Follow-on order

1. Complete the in-game acceptance checklist and repair any content-log errors.
2. Improve terrain integration, door/elevator presentation and module variety.
3. Implement and validate the minimum-range missile turret independently.
4. Reuse the shared systems in the Fortified Estate.
5. Add natural generation after templates and site selection are stable.
6. Expand through the other facility stages in the supplied plan.
