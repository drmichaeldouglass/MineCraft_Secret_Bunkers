# Secret Facilities
## Minecraft Bedrock Edition Add-On
### Staged Implementation and AI Agent Specification

## 1. Project Goal

Create a Minecraft Bedrock Edition add-on called **Secret Facilities** that adds large, impressive, procedurally generated military, bunker, intelligence, research, and spy-themed facilities to Minecraft worlds.

The primary experience is architectural exploration and interaction with functioning facility systems.

The add-on must focus on:

- Large procedural structures
- Multiple underground levels
- Terrain-integrated entrances
- Functional blast doors
- Elevators
- Keycard-controlled access
- Laser tripwires
- Facility alarms
- Lockdowns
- Security shutters
- Secret escape tunnels
- Automated defensive turrets
- Self-destruct systems
- Multiple distinct facility archetypes
- High-quality custom industrial and security-themed blocks, items, sounds, models, animations, and textures

Do **not** implement the following systems at this stage:

- Guards or custom NPCs
- Loot systems
- Missions
- Story scenarios
- Facility scenario variants
- Quest progression
- Complex secrets or puzzle systems

The architecture should nevertheless be modular enough that these features could be added later without redesigning the core add-on.

---

# 2. Target Platform

Target:

**Minecraft Bedrock Edition**

Use:

- Behavior Pack
- Resource Pack
- Minecraft Script API
- TypeScript where practical, compiled to JavaScript for the pack
- Custom block components
- Custom item components
- Custom entities where appropriate for turrets or moving components
- `.mcstructure` structure templates
- Jigsaw structures
- Template pools
- Structure sets
- Jigsaw processors where useful
- `StructureManager` for scripted placement where additional control is necessary
- `@minecraft/server-ui` where an interface is preferable to physical buttons

Use Minecraft-native systems wherever practical, while reserving scripting for systems that genuinely require dynamic behaviour.

---

# 3. High-Level Architecture

Divide the add-on into six major systems.

```text
SECRET FACILITIES
│
├── STRUCTURE SYSTEM
│   ├── Room modules
│   ├── Corridors
│   ├── Junctions
│   ├── Shafts
│   ├── Entrances
│   ├── Exterior structures
│   └── Jigsaw generation
│
├── FACILITY SYSTEM
│   ├── Facility identity
│   ├── Floor definitions
│   ├── Security state
│   ├── Door registry
│   ├── Elevator registry
│   ├── Defence registry
│   └── Self-destruct state
│
├── SECURITY SYSTEM
│   ├── Keycards
│   ├── Card readers
│   ├── Blast doors
│   ├── Laser tripwires
│   ├── Alarm state
│   └── Security shutters
│
├── DEFENCE SYSTEM
│   ├── Laser turrets
│   ├── Missile turrets
│   ├── Target detection
│   ├── Friend-or-foe rules
│   ├── Turret control consoles
│   └── Defensive zones
│
├── TRANSPORT SYSTEM
│   ├── Elevators
│   ├── Secret tunnels
│   └── Secret Metro
│
└── RESOURCE PACK
    ├── Blocks
    ├── Textures
    ├── Models
    ├── Animations
    ├── Particles
    ├── Sounds
    └── UI assets
```

Keep these systems loosely coupled.

A bunker should not contain unique hard-coded security or turret logic. It should use the same shared systems as the Arctic facility, mansion, missile silo, desert compound, or volcano base.

---

# 4. Namespace and Naming

Use a consistent namespace such as:

```text
secretfacilities:
```

Examples:

```text
secretfacilities:reinforced_concrete
secretfacilities:blast_door
secretfacilities:keycard_red
secretfacilities:security_terminal
secretfacilities:laser_turret
secretfacilities:missile_turret
secretfacilities:turret_control_console
```

Use descriptive folder structures and names rather than abbreviated asset names.

---

# 5. Repository Layout

Recommended project structure:

```text
secret-facilities/
│
├── behavior_pack/
│   ├── manifest.json
│   ├── blocks/
│   ├── entities/
│   ├── items/
│   ├── recipes/
│   ├── structures/
│   │   └── secretfacilities/
│   │       ├── bunker/
│   │       ├── mansion/
│   │       ├── mountain/
│   │       ├── arctic/
│   │       ├── desert/
│   │       ├── island/
│   │       ├── missile_silo/
│   │       ├── laboratory/
│   │       ├── listening_station/
│   │       ├── metro/
│   │       └── volcano/
│   │
│   ├── worldgen/
│   │   ├── processors/
│   │   ├── structures/
│   │   ├── structure_sets/
│   │   └── template_pools/
│   │
│   ├── scripts/
│   │   ├── main.ts
│   │   ├── facility/
│   │   ├── generation/
│   │   ├── security/
│   │   ├── defence/
│   │   ├── elevators/
│   │   ├── doors/
│   │   ├── alarms/
│   │   └── self_destruct/
│   │
│   └── texts/
│
├── resource_pack/
│   ├── manifest.json
│   ├── blocks.json
│   ├── terrain_texture.json
│   ├── item_texture.json
│   ├── models/
│   │   ├── blocks/
│   │   └── entity/
│   ├── animations/
│   ├── animation_controllers/
│   ├── particles/
│   ├── textures/
│   │   ├── blocks/
│   │   ├── entities/
│   │   ├── items/
│   │   └── ui/
│   ├── sounds/
│   ├── sound_definitions.json
│   └── texts/
│
├── tools/
├── docs/
├── tests/
├── README.md
└── CHANGELOG.md
```

---

# 6. Facility Security States

Every generated facility must have a facility-level state.

Implement at minimum:

| State | Behaviour |
|---|---|
| NORMAL | Normal lighting, elevators, access control, and configured defensive systems |
| ALERT | Warning lights and alarms activate, selected doors close, turrets increase readiness |
| LOCKDOWN | Blast doors and shutters close, elevators become restricted, defence systems fully activate |
| SELF_DESTRUCT | Emergency sequence active, evacuation behaviour begins, defence system behaviour becomes configurable |
| DESTROYED | Facility is permanently in damaged state and most automated systems are disabled |

Turrets must listen to this shared facility state rather than creating a separate security model.

---

# 7. Keycard System

Implement four normal security levels plus a Creative-mode master card.

| Card | Colour | Clearance |
|---|---|---|
| Level 1 | Green | Staff |
| Level 2 | Blue | Restricted |
| Level 3 | Red | High Security |
| Level 4 | Black | Command |
| Master | Special | All systems |

Required custom items:

```text
secretfacilities:keycard_green
secretfacilities:keycard_blue
secretfacilities:keycard_red
secretfacilities:keycard_black
secretfacilities:keycard_master
```

Keycards should control:

- Security doors
- Blast doors
- Elevators
- Turret control consoles
- Defence-system overrides
- Self-destruct consoles where appropriate

---

# 8. Laser Tripwire System

Create reusable laser emitters and receivers.

Support:

- Horizontal beams
- Vertical beams
- Multiple parallel beams
- Laser grids

Breaking or intersecting an active beam should be able to:

- Trigger ALERT
- Trigger LOCKDOWN where configured
- Activate a local alarm
- Close nearby security doors
- Activate nearby defence turrets where configured

Lasers must be switchable from a security control panel.

Avoid expensive world-wide block scans every tick.

---

# 9. Alarm System

Create facility-wide alarms.

Required effects:

- Siren audio
- Flashing warning lights
- Red emergency lighting
- Security-door response
- Security-shutter response
- Defensive-turret response
- Console indicator changes

Alarm state should propagate from a single facility controller.

---

# 10. Security Shutters

Implement retractable or state-changing steel shutters for:

- Windows
- Security offices
- Command centres
- Laboratories
- Checkpoints
- Mansion windows
- Sensitive interior areas

Shutters should respond to lockdown automatically.

---

# 11. Automated Defence System

Create a reusable automated defence framework.

The system must support two primary turret classes:

1. **Laser Turret**
2. **Missile Turret**

The turret system must target **hostile mobs only by default**.

It must not intentionally target:

- Players
- Villagers
- Passive animals
- Pets
- Neutral mobs that have not become hostile
- Other facility defence systems

The targeting layer should be generic so the list of valid targets can be changed later.

---

# 12. Laser Turret

The laser turret is the standard defensive weapon.

It should be usable:

- On perimeter walls
- Beside bunker entrances
- On rooftops
- Inside large corridors
- In hangars
- Around command centres
- Near secure doors
- On watchtowers

## Behaviour

When active:

1. Scan within a configurable radius.
2. Find valid hostile mobs.
3. Prefer nearby valid targets.
4. Rotate toward target.
5. Track target.
6. Fire short laser bursts.
7. Deal configurable damage.
8. Play firing sound.
9. Generate beam and impact particles.
10. Return to idle scanning when no target exists.

## Suggested modes

```text
OFFLINE
STANDBY
ACTIVE
ALERT ONLY
LOCKDOWN ONLY
```

## Suggested ranges

Interior turret:

```text
12 to 20 blocks
```

Exterior turret:

```text
20 to 35 blocks
```

Exact values should be balanced through testing.

## Laser visual

The beam should appear as a short-lived straight energy beam from turret barrel to target.

Use particles or another efficient visual approach.

Avoid spawning large numbers of persistent entities solely to draw beams.

---

# 13. Missile Turret

Missile turrets are heavy exterior defences.

They should be much less common than laser turrets.

Typical locations:

- Fortified Estate perimeter
- Mountain Command Centre entrance
- Desert Black Site
- Island Spy Base
- Missile Silo perimeter
- Listening Station
- Volcano Base
- Large bunker surface defences

Missile turrets should generally not appear in small interior corridors.

## Behaviour

When active:

1. Detect a valid hostile target.
2. Check line of sight where practical.
3. Check minimum range.
4. Rotate toward target.
5. Launch a missile projectile.
6. Projectile travels toward target.
7. Projectile detonates on impact or near target.
8. Apply controlled explosion or area damage.
9. Begin reload cooldown.

## Critical safety rule

Missile turrets must have a **minimum engagement distance**.

Example:

```text
minimum range: 10 blocks
maximum range: 50 blocks
```

This prevents missiles from constantly detonating next to the turret or facility.

Missile explosions must also be designed to avoid excessive destruction of facility structures.

Preferred options:

- Damage entities without block destruction
- Use limited block damage
- Make block damage configurable

Default behaviour should prioritise preserving the generated facility.

---

# 14. Missile Projectile

Create a custom missile projectile if necessary.

Visual elements:

- Small missile model
- Exhaust flame
- Smoke trail
- Launch flash
- Impact explosion

Optional future enhancement:

- Limited target tracking after launch

For Version 1.0, reliable projectile behaviour is more important than sophisticated homing.

---

# 15. Turret Targeting Logic

Centralise targeting rules.

Example target categories:

```text
TARGET_HOSTILE_MONSTERS
IGNORE_PLAYERS
IGNORE_PASSIVE_MOBS
IGNORE_VILLAGERS
IGNORE_TAMED_MOBS
IGNORE_FACILITY_ENTITIES
```

Potential valid targets include normal hostile Minecraft mobs such as:

- Zombies
- Skeletons
- Creepers
- Spiders when hostile
- Witches
- Phantoms
- Pillagers
- Vindicators
- Ravagers
- Other hostile mobs

Avoid hard-coding only a few mob identifiers if Minecraft provides a reliable way to classify hostile entities.

If classification is unreliable, maintain a configurable target-tag system.

---

# 16. Turret Control Console

Create:

```text
secretfacilities:turret_control_console
```

Possible interface:

```text
FACILITY DEFENCE CONTROL

LASER TURRETS: ACTIVE
MISSILE TURRETS: STANDBY

[ENABLE ALL]
[DISABLE ALL]
[LASERS ONLY]
[ALERT MODE]
[LOCKDOWN MODE]
```

A higher security clearance should be required to modify defence settings.

Suggested clearance:

```text
Red Keycard: local turret control
Black Keycard: facility-wide defence control
Master Keycard: unrestricted
```

---

# 17. Defensive Zones

Allow generated facilities to define defence zones.

Examples:

```text
ZONE A: MAIN ENTRANCE
ZONE B: PERIMETER
ZONE C: HELIPAD
ZONE D: COMMAND LEVEL
ZONE E: HANGAR
```

Turrets can be assigned to a zone.

This allows control consoles to enable or disable only part of the defence network.

It also improves performance because targeting checks can remain local.

---

# 18. Turret Power State

Turrets should support:

```text
POWERED
UNPOWERED
DISABLED
DAMAGED
```

For Version 1.0, facility power generation can be abstracted rather than fully simulated.

However, self-destruct or facility destruction should be able to disable turret systems.

---

# 19. Doors

Create several reusable door classes.

## Standard Security Door

Width:

```text
2 to 3 blocks
```

## Heavy Security Door

Width:

```text
3 to 5 blocks
```

## Main Blast Door

Approximate size:

```text
7 to 11 blocks wide
5 to 7 blocks high
```

Primary bunker entrance.

Behaviour:

1. Player interacts with entrance control.
2. Warning sound plays.
3. Warning lights flash.
4. Door unlocks.
5. Door slides sideways.
6. Open state is retained.
7. Door can subsequently close.
8. Lockdown overrides normal access.

The animation should look deliberately heavy and slow.

---

# 20. Elevator System

Elevators are shared infrastructure.

Required elevator types:

| Elevator | Typical use |
|---|---|
| Passenger | Standard bunker |
| Freight | Engineering/storage |
| Secure Command | High-security facilities |
| Mansion | Fortified estate |
| Industrial Lift | Missile silo |
| Deep Facility Lift | Mountain/laboratory |
| Metro Access Lift | Secret Metro |

Preferred behaviour:

1. Player enters.
2. Floor selection appears.
3. Doors close.
4. Movement sounds play.
5. Player is transferred to destination.
6. Destination doors open.

The system should support turret-free elevator interiors to avoid accidental engagements in confined spaces.

---

# 21. Secret Tunnel System

Facilities may have secondary escape routes.

Possible tunnel exits:

- Small forest cabin
- Utility shed
- Rock face
- Drainage pipe
- Cave
- Abandoned mine
- Hidden trapdoor
- Well
- Remote maintenance building

Tunnels should generally not contain missile turrets.

Laser turrets may optionally protect high-security tunnel junctions.

---

# 22. Procedural Building Standard

Establish a common structural grid.

Suggested starting dimensions:

| Component | Suggested dimensions |
|---|---|
| Standard corridor | 5 wide × 5 high |
| Narrow service corridor | 3 wide × 4 high |
| Small room | 9 × 9 |
| Standard room | 13 × 13 |
| Large room | 17 × 17 or larger |
| Major hall | 21 × 21 or larger |
| Floor-to-floor distance | 8 to 10 blocks |
| Passenger elevator shaft | Approximately 5 × 5 |
| Freight shaft | Approximately 7 × 7 |

Add standardized turret mounting locations where appropriate.

Examples:

```text
turret_wall
turret_ceiling
turret_floor
turret_rooftop
turret_watchtower
turret_perimeter
```

---

# 23. Structure Connector Types

Use a controlled connector vocabulary.

```text
corridor_standard
corridor_service
room_standard
room_secure
elevator_passenger
elevator_freight
stairs_standard
tunnel_secret
metro_platform
surface_exit
large_hall
defence_mount
```

---

# 24. Primary Facility: Underground Command Bunker

The bunker is the reference implementation.

Exterior:

- Reinforced concrete surround
- Large recessed blast door
- Security lights
- Access console
- Optional ventilation structures
- Internal security tunnel
- Optional laser-turret emplacements
- Optional missile-turret emplacement for large bunkers

Possible defence configuration:

```text
OUTPOST
2 exterior laser turrets

REGIONAL BUNKER
2 to 4 exterior laser turrets

COMMAND BUNKER
4 exterior laser turrets
1 missile turret

STRATEGIC FACILITY
4 to 8 laser turrets
1 to 2 missile turrets
```

Exact numbers should remain configurable.

---

# 25. Underground Bunker Levels

Generate approximately 3 to 8 underground levels.

## B1: Administration and Security

Possible modules:

- Entry checkpoint
- Security office
- Reception
- Administration offices
- Briefing room
- Equipment room
- Storage
- Elevator lobby
- Emergency stairs
- Defence control room

## B2: Personnel

Possible modules:

- Barracks
- Kitchen
- Dining room
- Showers
- Recreation room
- Medical room
- Storage

## B3: Command

Possible modules:

- Command centre
- Operations centre
- Communications room
- Situation room
- Conference room
- Server room
- Security control
- Defence control

## B4: Engineering

Possible modules:

- Generator room
- Electrical room
- Workshop
- Pump room
- Water treatment
- Ventilation
- Maintenance corridors

## B5 and Below: High Security

Possible modules:

- Secure storage
- Restricted laboratories
- Archive rooms
- Vault rooms
- Heavy security checkpoints
- Large secure chambers

Interior laser turrets may appear sparingly in large secure areas.

---

# 26. Procedural Generation Rules

Generation rules must enforce:

- Rooms cannot overlap.
- Every floor connects to the vertical core.
- Floors remain navigable.
- Dead ends are capped.
- Required rooms spawn.
- Optional rooms use weighted selection.
- Elevators align.
- Entrances remain usable.
- Defence emplacements do not obstruct corridors.
- Turrets must have sufficient firing space.
- Missile turrets cannot generate indoors unless a specially designed large space explicitly supports them.
- Turrets cannot spawn facing directly into solid walls.
- Missile turrets require adequate clearance around their firing arc.

---

# 27. Creative Deployment Tool

Create:

```text
secretfacilities:facility_deployment_device
```

Menu:

```text
Underground Command Bunker
Fortified Estate
Mountain Command Centre
Arctic Research Station
Desert Black Site
Island Spy Base
Missile Silo
Subterranean Laboratory
Listening Station
Secret Metro Station
Volcano Base
```

Development options should eventually include:

```text
Generate with defences
Generate without defences
```

---

# 28. Fortified Estate

Required elements:

- Large mansion
- Stone perimeter walls
- Metal security fencing
- Main gate
- Gatehouse
- Security lighting
- 2 to 4 watchtowers
- Garage
- Helipad
- Gardens
- Utility buildings
- Underground bunker

Defence system:

- Laser turrets on selected watchtowers
- Laser turrets near primary vehicle gate
- Optional rooftop laser turrets
- One or more missile turrets on large estates
- Central defence control room

The estate should visually resemble a heavily protected private intelligence or government compound.

---

# 29. Mountain Command Centre

Required:

- Huge blast doors
- Vehicle tunnel
- Cavern-sized interior
- Underground roads
- Multiple elevators
- Security zones
- Engineering areas
- Exterior defensive positions

Defence system:

- Laser turrets guarding tunnel entrances
- Laser turrets inside major vehicle bays
- Missile turrets positioned outside the mountain
- Dedicated defence-control centre

---

# 30. Arctic Research Station

Surface:

- Research buildings
- Communications mast
- Radar equipment
- Generator buildings
- Utility structures

Defence:

- Exterior laser turrets
- Limited missile defence for larger variants
- Cold-weather visual styling for turret mounts

---

# 31. Desert Black Site

Required:

- Large secure perimeter
- Watchtowers
- Floodlights
- Vehicle checkpoint
- Administration
- Hangar
- Underground levels

Defence:

- Watchtower-mounted laser turrets
- Main-gate laser turrets
- Perimeter missile turrets
- Wide firing arcs suitable for open desert

This facility should make particularly strong use of automated perimeter defence.

---

# 32. Island Spy Base

Surface:

- Mansion or secure complex
- Helipad
- Pool or landscaped area
- Service buildings

Underground:

- Command centre
- Laboratories
- Engineering
- Submarine dock
- Ocean tunnel

Defence:

- Laser turrets around shoreline approaches
- Rooftop laser turrets
- Missile turrets covering major exterior approaches
- Turrets should not fire indiscriminately into the facility's own buildings

---

# 33. Missile Silo

Required:

- Surface access
- Central missile shaft
- Ring corridors
- Security level
- Command level
- Maintenance level
- Engineering level
- Launch control
- Industrial elevator

Defence:

- Strong perimeter laser coverage
- Surface missile turrets
- Limited interior laser turrets

The main silo missile itself remains decorative.

---

# 34. Subterranean Laboratory

Visual identity:

- White and grey surfaces
- Glass corridors
- Bright lighting
- Modern architecture

Defence:

- Limited laser turrets around high-security sections
- No normal indoor missile turrets
- Missile defence only if the laboratory has a substantial exterior compound

---

# 35. Listening Station

Surface:

- Radar dishes
- Radomes
- Antennas
- Communications towers
- Administration

Defence:

- Laser turrets around radar infrastructure
- Missile turrets around larger stations
- Turret placement must avoid clipping into radar structures

---

# 36. Secret Metro

Station components:

- Platforms
- Tracks
- Service corridors
- Security doors
- Elevators
- Maintenance rooms

Security:

- Laser turrets may guard secure platform entrances.
- Missile turrets are not appropriate underground.

---

# 37. Volcano Base

Required:

- Mountain exterior
- Hidden entrance
- Huge cavern
- Bridges
- Lava channels
- Command centre
- Industrial platforms
- Hangar
- Elevators

Defence:

- Entrance laser turrets
- Hangar defence turrets
- Interior laser emplacements in huge cavern spaces
- Exterior missile turrets
- Defensive systems should visually suit the dramatic scale of the facility

---

# 38. Self-Destruct System

Sequence:

```text
NORMAL
↓
ARMED
↓
AUTHORIZATION
↓
COUNTDOWN
↓
DETONATION
↓
DESTROYED
```

Required interaction with automated defences:

During self-destruct, configurable behaviour should determine whether turrets:

```text
A. Shut down immediately
B. Remain active during evacuation
C. Remain active until final detonation
```

Default:

**Remain active during the early evacuation stage, then shut down shortly before final detonation.**

After destruction:

- Most turrets become inactive.
- Some models may switch to damaged variants.
- Turrets should not continue operating indefinitely inside destroyed facilities.

---

# 39. Required Custom Blocks

## Structural

```text
Reinforced Concrete
Dark Reinforced Concrete
Light Reinforced Concrete
Concrete Panel
Concrete Warning Stripe
Steel Wall
Steel Plate
Riveted Steel
Industrial Floor
Diamond Plate Floor
Grated Floor
Bunker Ceiling Panel
Blast-Resistant Glass
Security Glass
```

## Industrial

```text
Ventilation Grille
Large Vent
Pipe
Pipe Junction
Cable Tray
Electrical Cabinet
Generator Panel
Server Rack
Control Cabinet
Utility Panel
Industrial Light
Emergency Light
Floodlight
```

## Security

```text
Keycard Reader
Security Console
Alarm Panel
Laser Emitter
Laser Receiver
Security Shutter
Security Shutter Housing
Door Control Panel
Self-Destruct Console
Facility Status Display
```

## Defence

```text
Turret Control Console
Turret Power Unit
Laser Turret Mount
Missile Turret Base
Defence Status Panel
```

The actual moving turret may be better represented as a custom entity mounted to a block, depending on implementation testing.

---

# 40. Required Custom Items

Initial items:

```text
Green Keycard
Blue Keycard
Red Keycard
Black Keycard
Master Keycard
Facility Deployment Device
```

Development/debug items:

```text
Alarm Test Device
Lockdown Test Device
Door Test Device
Turret Test Device
Facility Debug Scanner
Structure Module Placement Tool
```

---

# 41. Texture Requirements

Use a Minecraft-compatible industrial visual style.

## Defence textures

Create:

```text
laser_turret_base
laser_turret_body
laser_turret_barrel
laser_turret_emitter
laser_turret_status_green
laser_turret_status_red

missile_turret_base
missile_turret_body
missile_launcher
missile_projectile
missile_exhaust

turret_console
turret_console_active
turret_console_disabled
turret_console_alert
```

Also create damaged variants where appropriate.

---

# 42. Custom Models

Create models for:

- Keycard reader
- Security console
- Laser emitter
- Laser receiver
- Alarm panel
- Elevator panel
- Self-destruct console
- Blast-door components
- Industrial lights
- Radar equipment
- Laser turret
- Missile turret
- Missile projectile
- Turret control console

Turrets should have separately animated rotating components if feasible.

Suggested laser turret components:

```text
base
yaw_mount
pitch_mount
barrel
emitter
status_light
```

Suggested missile turret components:

```text
base
yaw_mount
launcher
missile_rack
status_light
```

---

# 43. Animations

Required animation work:

- Main blast door opening
- Main blast door closing
- Heavy door locking
- Security shutter lowering
- Security shutter raising
- Alarm light flashing
- Elevator doors
- Laser emitter activation
- Self-destruct console activation
- Laser turret horizontal rotation
- Laser turret vertical aiming
- Laser turret recoil or firing pulse
- Missile turret horizontal rotation
- Missile launcher elevation
- Missile launch
- Turret disabled state

---

# 44. Particles

Create particle effects for:

- Laser tripwire beam
- Laser turret beam
- Laser impact
- Missile exhaust
- Missile smoke trail
- Missile impact
- Launch flash
- Electrical sparks
- Steam
- Dust
- Smoke
- Self-destruct explosions
- Falling debris

Particle counts must remain controlled.

---

# 45. Sound Design

## Doors

```text
blast_door_warning
blast_door_unlock
blast_door_hydraulic_start
blast_door_movement
blast_door_stop
blast_door_lock
security_door_open
security_door_close
shutter_movement
```

## Security

```text
access_granted
access_denied
card_scan
alarm_alert
alarm_lockdown
warning_beep
```

## Elevator

```text
elevator_arrive
elevator_door_open
elevator_door_close
elevator_move
elevator_floor_chime
```

## Turrets

```text
laser_turret_activate
laser_turret_track
laser_turret_fire
laser_turret_power_down

missile_turret_activate
missile_turret_track
missile_launch
missile_flight
missile_impact
missile_reload

defence_console_beep
defence_system_online
defence_system_offline
```

## Facility ambience

```text
generator_hum
server_room_hum
ventilation_hum
electrical_buzz
```

---

# 46. Staged Development Plan

## Stage 0: Project Foundation

Implement:

- Repository
- Behavior Pack
- Resource Pack
- TypeScript pipeline
- Manifests
- Namespace
- Development deployment
- README
- CHANGELOG
- Debug logging
- JSON validation

---

## Stage 1: Core Construction Palette

Implement bunker construction blocks and lighting.

---

## Stage 2: Doors and Interactive Components

Implement:

- Security door
- Main blast door
- Card reader
- Door console
- Sounds
- Persistent states

---

## Stage 3: Elevator Prototype

Implement reusable multi-floor elevator system.

---

## Stage 4: Modular Structure Standard

Create:

```text
straight corridor
short corridor
corner
T junction
cross junction
dead-end cap
security checkpoint
small room
medium room
large room
elevator lobby
stairs
utility room
```

---

## Stage 5: Procedural Bunker Level

Generate one complete underground level.

---

## Stage 6: Multi-Level Command Bunker

Generate 3 to 8 aligned levels.

This is the first major milestone.

---

## Stage 7: Terrain-Aware Hill Entrance

Generate the huge blast door convincingly in a hillside or mountain.

---

## Stage 8: Keycard Security

Implement all keycards, readers, and clearance checks.

---

## Stage 9: Alarm, Laser Tripwire and Lockdown Systems

Implement:

- Laser tripwires
- Alerts
- Facility lockdown
- Sirens
- Emergency lighting
- Automatic door response

---

## Stage 10: Security Shutters

Implement lockdown-controlled security shutters.

---

## Stage 11: Automated Laser Turret Prototype

Create one functioning laser turret.

Required:

- Hostile mob detection
- Range limiting
- Target selection
- Rotation
- Vertical aiming
- Laser firing
- Damage
- Beam particles
- Impact particles
- Audio
- Enable/disable control

Acceptance criteria:

- Does not intentionally target players.
- Does not target passive mobs.
- Reliably engages nearby hostile mobs.
- Stops firing when target dies or leaves range.
- Multiple turrets can operate simultaneously.
- Performance remains acceptable.

---

## Stage 12: Turret Network and Defence Zones

Implement:

- Facility turret registry
- Defence zones
- Turret control console
- Security-state integration
- Zone activation/deactivation
- Red/black keycard control

Acceptance criteria:

A lockdown can activate an entire configured defence zone automatically.

---

## Stage 13: Missile Turret Prototype

Implement:

- Target acquisition
- Minimum range
- Maximum range
- Launcher rotation
- Projectile spawning
- Missile travel
- Impact damage
- Explosion visuals
- Reload cooldown
- Configurable terrain damage

Acceptance criteria:

- Does not fire at targets inside minimum range.
- Does not target friendly entities.
- Does not continuously destroy its own mounting structure.
- Reload period prevents excessive missile spam.
- Multiple missile turrets remain performant.

---

## Stage 14: Secret Tunnels

Implement remote secondary exits.

---

## Stage 15: Fortified Estate

Implement full second facility with integrated automated defences.

---

## Stage 16: Self-Destruct System

Implement facility destruction and turret shutdown behaviour.

---

## Stage 17: Mountain Command Centre

Build large mountain facility and heavy defence positions.

---

## Stage 18: Arctic Research Station

Build Arctic facility with appropriate defence coverage.

---

## Stage 19: Desert Black Site

Build desert compound with substantial perimeter defences.

---

## Stage 20: Island Spy Base

Build island facility and submarine dock.

---

## Stage 21: Missile Silo

Build vertical silo facility.

---

## Stage 22: Subterranean Laboratory

Build clean laboratory architecture.

---

## Stage 23: Listening Station

Build radar and communications installation.

---

## Stage 24: Secret Metro

Build underground stations and connection system.

---

## Stage 25: Volcano Base

Build final showcase facility.

---

# 47. Natural World Generation

Once each facility works through the deployment device, enable natural generation.

Suggested relative rarity:

```text
Commoner:
Listening Station
Desert Black Site

Moderate:
Underground Command Bunker
Arctic Research Station
Fortified Estate
Subterranean Laboratory

Rare:
Mountain Command Centre
Missile Silo
Island Spy Base

Very Rare:
Secret Metro connected facility
Volcano Base
```

Defence strength should generally scale with facility size rather than simply facility rarity.

---

# 48. Performance Requirements

Avoid:

- Large per-tick world scans
- Every turret searching huge radii every tick
- Thousands of ticking entities
- Excessive missile projectiles
- Persistent beam entities
- Particle spam
- Giant uncontrolled explosions
- Constant target reacquisition

Turret optimisation strategies should include:

- Staggered scanning intervals
- Local search radii
- Cached current targets
- Longer scan intervals when idle
- Faster tracking only after a target is acquired
- Facility-based activation
- Deactivation when relevant chunks are not actively simulated
- Strict missile cooldowns

For example, do not make 20 turrets all perform expensive entity searches on exactly the same game tick.

---

# 49. Persistence

Persist at minimum:

- Facility identifier
- Facility type
- Facility security state
- Door states
- Self-destruct state
- Destroyed state
- Elevator configuration
- Defence-zone configuration
- Turret enabled/disabled state
- Turret damage state where applicable

Current transient targets do not need to persist across reloads.

---

# 50. Debugging Tools

Implement Creative-only development tools or commands for:

```text
Generate facility
Generate individual module
Set NORMAL
Set ALERT
Set LOCKDOWN
Trigger self-destruct
Reset security
Open all doors
Close all doors
Test elevator
Enable all turrets
Disable all turrets
Enable defence zone
Disable defence zone
Spawn turret test target
Show turret range
Show current turret target
Show facility ID
Show module bounds
Show connector locations
```

A visible turret-range debug mode would be especially useful for tuning placement.

---

# 51. Automated Generation Testing

For each facility:

1. Generate many instances.
2. Record generation seed where available.
3. Record facility type.
4. Record bounding box.
5. Check required modules.
6. Check elevator alignment.
7. Check entrances.
8. Check overlaps.
9. Check turret mounting.
10. Check firing arcs.
11. Check missile clearance.
12. Check that defence systems do not block player navigation.
13. Save failed configurations for regression testing.

---

# 52. Turret Testing

Create dedicated automated or semi-automated tests.

Test laser turrets against:

```text
Zombie
Skeleton
Creeper
Spider
Witch
Pillager
Passive animal
Villager
Player
Tamed animal
```

Expected result:

Hostile targets are engaged.

Friendly and passive targets are ignored.

Test missile turrets at:

```text
5 blocks
10 blocks
20 blocks
40 blocks
beyond maximum range
```

Verify minimum and maximum range behaviour.

Also test:

- Targets behind walls
- Multiple simultaneous mobs
- Dead target
- Target leaving range
- Facility entering lockdown
- Facility returning to normal
- Self-destruct
- Facility destruction

---

# 53. Asset Tracking

Maintain:

```text
docs/assets.md
```

Each asset should include:

```text
Asset identifier
Asset type
Implementation status
Texture status
Model status
Animation status
Sound status
Facility usage
Notes
```

Turret assets should be tracked separately because they require models, animations, particles, sounds, and scripting.

---

# 54. AI Agent Working Rules

The implementing AI agent should:

1. Work one stage at a time.
2. Stabilize shared systems before adding new facilities.
3. Keep reusable functionality generic.
4. Avoid facility-specific copies of shared code.
5. Validate JSON after modifications.
6. Keep identifiers namespaced.
7. Test after each meaningful feature.
8. Document implementation decisions.
9. Add regression tests for procedural bugs.
10. Prefer robust Minecraft-native approaches.
11. Keep Creative/development tools separate from normal gameplay.
12. Do not add guards, loot, quests, missions, or story systems unless scope is expanded.
13. Keep turret targeting limited to intended hostile entities.
14. Do not allow missile systems to cause uncontrolled terrain destruction.
15. Treat performance of automated defences as a core engineering requirement.
16. Ensure every defence system can be disabled for debugging.

---

# 55. Definition of First Playable Version

The first playable milestone contains:

```text
HILLSIDE
   │
LARGE BLAST DOOR
   │
EXTERIOR LASER DEFENCE
   │
SECURITY TUNNEL
   │
CHECKPOINT
   │
MULTI-LEVEL PROCEDURAL BUNKER
   │
├── B1 Administration
├── B2 Personnel
├── B3 Command
├── B4 Engineering
└── B5 High Security
```

Required functionality:

- Functional blast door
- Elevators
- Green/blue/red/black keycards
- Security doors
- Laser tripwires
- Alarm state
- Lockdown state
- Security shutters
- Emergency lighting
- Secret escape tunnel
- Functional automated laser turrets
- Defence control console

Missile turrets may follow immediately after this milestone if they require additional projectile work.

---

# 56. Definition of Version 1.0

Version 1.0 should contain:

```text
1. Underground Command Bunker
2. Fortified Estate
3. Mountain Command Centre
4. Arctic Research Station
5. Desert Black Site
6. Island Spy Base
7. Missile Silo
8. Subterranean Laboratory
9. Listening Station
10. Secret Metro
11. Volcano Base
```

Shared systems:

```text
Keycards
Card readers
Security doors
Blast doors
Laser tripwires
Facility alarms
Lockdowns
Security shutters
Elevators
Secret tunnels
Automated laser turrets
Automated missile turrets
Defence zones
Turret control consoles
Self-destruct
Facility deployment device
Natural world generation
```

Art/audio:

```text
Complete construction palette
Facility-specific texture families
Interactive models
Laser turret model
Missile turret model
Missile projectile model
Turret animations
Turret particles
Keycard icons
Door sounds
Alarm sounds
Elevator sounds
Turret sounds
Missile sounds
Industrial ambience
Damaged structure assets
Pack icon
```

---

# 57. Explicitly Deferred Features

Do not implement for Version 1.0:

```text
Security guards
Custom soldiers
Enemy NPCs
Loot generation
Mission system
Quest system
Story campaign
Facility scenarios
Random story events
Complex hacking mechanics
Camera detection
Biometric identity mechanics
Player disguise system
Handheld weapons
Functional silo missiles
Functional submarines
```

Automated defensive turrets are explicitly **in scope**.

---

# 58. Future Expansion Hooks

Leave extension points for:

```text
Guards
Security-camera detection
NPC factions
Procedural missions
Loot
Documents
Facility lore
Hacking
Disguises
Biometrics
Spy equipment
Additional turret types
Drone defence
Anti-air systems
Facility ownership
Procedural facility scenarios
Interconnected intelligence networks
```

---

# 59. Final Development Priority

When trade-offs are necessary, prioritize:

```text
1. Reliable generation
2. Navigable architecture
3. Terrain integration
4. Reusable systems
5. Doors and elevators
6. Security functionality
7. Reliable turret targeting
8. Defence-system performance
9. Visual quality
10. Facility variety
11. Ambient polish
12. Additional complexity
```

A smaller, reliable facility is preferable to an enormous facility that generates incorrectly.

A simple laser turret that reliably identifies and fires on hostile mobs is preferable to a visually elaborate turret with unstable targeting.

A missile turret that fires slowly and safely is preferable to one that creates excessive explosions or damages the facility itself.

The project should therefore evolve from a robust modular bunker generator into a reusable procedural facility framework, then layer security and automated defence systems onto that framework before expanding into the more ambitious facility types.