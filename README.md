# Secret Facilities

A Minecraft **Bedrock Edition** add-on built from `Secret_Facilities_Plan.md`.

**Release: 0.1.0 alpha — command bunker foundation.** This is an importable implementation of the first bunker milestone, not the complete eleven-facility Version 1.0. Automated checks pass; Minecraft import, rendering, sound, controller/mobile interaction, and multiplayer behavior have **not** been tested in a running game.

[Download the add-on](dist/Secret_Facilities_0.1.0.mcaddon) · [Installation and controls](docs/PLAY_GUIDE.md) · [Test checklist](docs/TESTING.md) · [Implementation status](docs/STATUS.md)

![Generated bunker floor plan](docs/bunker-preview.png)

The preview is rendered from the actual assembled block data in the test harness. It is not a Minecraft screenshot.

## Install and start

1. Open `dist/Secret_Facilities_0.1.0.mcaddon` with Minecraft Bedrock **1.21.90 or later**. Import both packs.
2. Create a Creative test world with cheats enabled. Activate **Secret Facilities BP** and **Secret Facilities RP**. No experimental toggles are intended to be required.
3. Find **Facility Deployment Device** in the Creative inventory, or run:

   ```mcfunction
   /scriptevent secretfacilities:kit
   ```

4. Stand on dry, reasonably level ground. Use the device, choose 3–8 floors, and confirm the displayed site. **Deployment replaces terrain/buildings in its footprint.** Use a test world or a backup.
5. Stay near the build until “Bunker ready” appears. The entrance faces north (−Z). Use its reader with a keycard in your inventory.

If the kit command is unavailable, use `/give @s secretfacilities:facility_deployment_device`, then choose **Get development kit** in its menu.

## Included

- A 65-block-wide modular command bunker with 3–8 underground floors and 33 binary `.mcstructure` templates.
- Seeded selection of offices, briefing rooms, security rooms, barracks, medical rooms, canteens, command rooms, server rooms, engineering rooms, archives, laboratories, and vaults.
- A nine-block-wide entrance blast door, room security doors, readers, alarm shutters, and emergency lights.
- Four clearance levels and a Creative-only master card.
- Multi-floor elevator transfer pads, a continuous emergency ladder, and a B1 escape tunnel to a surface utility hut.
- Horizontal and vertical laser grids, alert/lockdown controls, shared facility state, and saved configurations.
- Two exterior laser turrets and one command-level turret when defences are enabled; range, line-of-sight, reload, zone controls, and a conservative hostile-only target filter.
- A two-confirmation, 90-second self-destruct sequence with evacuation, abort window, bounded room damage, and permanent system shutdown.
- 47 custom construction/control blocks, seven custom items, original 32×32 pixel textures, a turret model, aiming animation, two particles, eleven synthesized sounds, and pack icons.

## Build from source

Requires Node.js 20+ and Python 3.10+ with Pillow. Minecraft API packages are compile-time definitions; they are supplied by the game at runtime.

```sh
npm install
python3 tools/build_assets.py
npm test
python3 tools/validate.py
python3 tools/preview.py
python3 tools/package.py
```

Alternatively, `python3 tools/bootstrap.py` downloads the pinned TypeScript compiler and official Minecraft API packages without running package lifecycle scripts. The compiler can then be invoked with `node node_modules/typescript/bin/tsc -p tsconfig.json`.

`npm test` compiles TypeScript, tests 600 procedural plans, assembles real templates in a mock world, verifies paths and security behavior, and writes the data for the preview. The validator independently decodes the little-endian NBT, checks JSON and local references, and inspects textures/audio. These checks do not replace Minecraft's content log or runtime testing.

## Project structure

| Folder | Purpose |
|---|---|
| `src/` | TypeScript: shared rules, planner, generation, persistence, security, defence, and menus |
| `behavior_pack/` | Importable pack, compiled scripts, custom definitions, and binary structure templates |
| `resource_pack/` | Original pixel textures, geometry, animation, particles, sound, and names |
| `tools/` | Reproducible asset generation, validation, preview, and packaging |
| `tests/` | Pure rules and simulated-world integration tests |
| `docs/` | Controls, architecture, assets, status, and manual acceptance checks |
| `dist/` | Combined `.mcaddon`, separate `.mcpack` files, and SHA-256 checksums |

The later facility types, missile turrets, natural generation, jigsaw pools, and advanced animation/art stages remain on the [roadmap](docs/STATUS.md). Guards, loot, quests, stories, and handheld weapons have not been added.
