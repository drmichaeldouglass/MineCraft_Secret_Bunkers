# Architecture and compatibility decisions

## Target

The manifests use Bedrock 1.21.90 and the stable `@minecraft/server` 2.0.0 / `@minecraft/server-ui` 2.0.0 contracts. Every runtime call is checked against those exact official TypeScript definitions. The source does not silently depend on newer APIs such as `getPackStructureIds`.

Microsoft's [1.21.90 creator notes](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.21.90?view=minecraft-bedrock-stable) identify Script API 2 and Custom Components V2 as released features. Components register during `system.beforeEvents.startup`, following the [custom components documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/custom-components?view=minecraft-bedrock-stable). World reads and recurring work begin at `world.afterEvents.worldLoad`.

## Pure plan, engine adapter

`src/core` has no Minecraft imports. It contains geometry, security access, targeting, defence modes and seed generation. `src/generation/planner.ts` produces a serializable facility plan. Runtime modules consume that plan instead of duplicating bunker-specific security behavior.

Floor topology is currently a fixed connected three-by-three module grid, with a hall spine and central core. Each floor has a program (`FLOOR_PROGRAMS` in the planner): fixed rooms that always appear and a pool the seed draws the rest from without replacement. The seed varies room roles and positions, not the overall graph. Doors sit at compatible room connectors. After the fittings, a pure seeded heightfield (`src/generation/mountain.ts`) is heaped over the site, leaving the portal approach open (and the escape apron, for rock-face exits). Secret tunnels are planned by the pure `src/generation/tunnel.ts`: a fixed start behind the B1 room, a junction chamber, and a leg to one of nine candidate exit sites, all clear of the mountain. At deployment the runtime samples the candidates' ground (height, liquid, surface block, tree canopy) and the ground over each route, and the pure `chooseExit` scores them and picks the exit type. No usable site falls back to the rock-face exit behind the mountain, which the bunker's own pad guarantees. The mountain's skirts skip the tunnel's height band where they pass over it. Facilities saved without an `exit` keep the original build steps exactly, so resumed builds stay aligned with their saved step. Demolition charge positions are planned with the facility and placed last. Bounds, overlays and system positions are explicit and testable.

`.mcstructure` files are uncompressed little-endian NBT with primary and secondary block-index layers, palettes, state values and origin. A primary index of −1 is a structure void, which places nothing; tunnel exits use it to keep the levelled ground around them. Assets are authored by `tools/build_assets.py`, decoded independently by `tools/validate.py`, and assembled in the simulated-world tests. No binary placeholder files are shipped.

## Placement and recovery

The generator uses [StructureManager placement](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/structuremanager?view=minecraft-bedrock-stable), followed by explicit door/control/light/shaft/turret installation operations. It checks loaded chunks, world-height bounds and registered-facility overlap. Operations are paced at two-tick intervals. The saved build step makes interrupted builds resumable; there is no terrain undo transaction.

Jigsaw generation is deliberately not shipped as untested example JSON. The chosen 1.21.90 baseline predates stable jigsaw worldgen. Natural generation and jigsaw assets should be introduced after in-game validation and a deliberate engine-version upgrade.

## State and persistence

The shared states are NORMAL, ALERT, LOCKDOWN, SELF_DESTRUCT and DESTROYED. Security transitions drive doors, shutters, lamps and turret mode evaluation. Door state is the requested open/closed state; block changes may lag while an animation runs, a chunk is unloaded or an entity obstructs closure. A reload reconciles physical doors to saved intent.

Snapshots use two alternating banks of world dynamic properties. Each serialized chunk contains at most 12,000 characters; the bank pointer commits last. The world index stores facility IDs. Doors, elevator floors, build progress, grids, lights, zones, turret state and countdown are in each snapshot. Transient targets and animation progress are not saved; a blast door leaf stranded by a reload is removed when the entity loads or the door is restored.

Dynamic-property ownership depends on the BP header UUID. Keep that UUID stable when updating existing worlds. The current schema is 1. Content generation is idempotent at the operation level; turret spawning also checks a facility/turret tag before adding an entity.

## Performance and interaction

There are no world-wide block scans. Systems use registered positions and only process facilities near players. Door writes have a global budget; laser visuals are staggered and only rendered near a player. Turrets search locally, stagger scans, cache targets and use a one-second firing cooldown. Turrets placed from spawn eggs (`src/runtime/placed.ts`) are found by a type-filtered search within 64 blocks of each player every two seconds; missile flight runs every tick, but only for missiles in the air. In-game profiling is still required.

Menu actions recheck player position, dimension, current clearance and relevant live security state after responses or travel delays. A stale menu does not preserve authorization. Creative restrictions are checked when using development tools and again before deployment or debug mutations.

Target filtering is intentionally conservative. A general monster-family filter can include neutral creatures. The shared allowlist excludes neutral species until aggression can be established reliably. No player, pet, passive creature or facility entity can opt into targeting merely by adding a tag.

Custom sounds are original synthesized mono PCM files. Bedrock supports WAV alongside OGG/FSB, as documented in Microsoft's [sound introduction](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontosound?view=minecraft-bedrock-stable). Production art can replace these files without changing the shared sound IDs.
