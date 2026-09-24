"""Reproducible pixel art, geometry, audio and Bedrock little-endian NBT templates.

All assets are original procedural artwork. Requires Pillow; runtime packs do not.
"""
from pathlib import Path
import json
import math
import random
import struct
import wave
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / "behavior_pack", ROOT / "resource_pack"
NS = "secretfacilities:"
VERSION = [0, 1, 0]
# Door frames per block of travel. Must match SUBSTEPS in src/runtime/security.ts.
DOOR_SUBSTEPS = 8
DOOR_PX = 16 // DOOR_SUBSTEPS
BP_UUID = "9475140d-6c47-4789-994e-ebcad89c09c9"
RP_UUID = "ff0f218a-08c7-43a1-8ab3-a19408a6eb20"

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")

def save(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)

BLOCKS = {
    "reinforced_concrete": (99, 110, 111), "dark_reinforced_concrete": (44, 54, 60),
    "light_reinforced_concrete": (190, 197, 187), "concrete_panel": (121, 133, 132),
    "concrete_warning_stripe": (204, 162, 55), "steel_wall": (70, 88, 93),
    "steel_plate": (102, 123, 127), "riveted_steel": (80, 99, 106),
    "industrial_floor": (52, 67, 73), "diamond_plate_floor": (68, 83, 89),
    "grated_floor": (52, 61, 63), "bunker_ceiling_panel": (86, 98, 100),
    "blast_resistant_glass": (113, 187, 192), "security_glass": (92, 162, 170),
    "ventilation_grille": (72, 81, 81), "large_vent": (84, 94, 99),
    "pipe": (102, 126, 118), "pipe_junction": (103, 128, 118),
    "cable_tray": (61, 74, 77), "electrical_cabinet": (92, 103, 97),
    "generator_panel": (82, 116, 98), "server_rack": (33, 46, 52),
    "control_cabinet": (64, 95, 100), "utility_panel": (92, 99, 99),
    "industrial_light": (193, 226, 214), "emergency_light": (103, 44, 39),
    "floodlight": (227, 225, 196), "keycard_reader": (54, 90, 94),
    "security_console": (42, 72, 79), "alarm_panel": (141, 57, 41),
    "laser_emitter": (76, 53, 54), "laser_receiver": (60, 78, 80),
    "security_shutter": (86, 104, 110), "security_shutter_housing": (61, 72, 79),
    "door_control_panel": (67, 82, 89), "self_destruct_console": (126, 51, 43),
    "facility_status_display": (39, 75, 70), "turret_control_console": (50, 78, 86),
    "turret_power_unit": (64, 82, 73), "laser_turret_mount": (70, 83, 89),
    "missile_turret_base": (68, 80, 75), "defence_status_panel": (47, 78, 72),
    "blast_door": (68, 85, 94), "security_door": (65, 91, 100),
    "elevator_panel": (49, 90, 85), "elevator_pad": (51, 104, 112),
    "damaged_panel": (45, 45, 41),
}
INTERACTIVE = {"keycard_reader", "door_control_panel", "security_console", "turret_control_console",
               "self_destruct_console", "elevator_panel", "facility_status_display", "alarm_panel"}
ITEMS = {
    "keycard_green": (58, 197, 122), "keycard_blue": (56, 145, 219),
    "keycard_red": (226, 72, 62), "keycard_black": (77, 81, 95),
    "keycard_master": (236, 192, 85), "facility_deployment_device": (52, 198, 186),
    "facility_debug_scanner": (215, 161, 61),
}

def textures():
    terrain, blocks, lang, item_atlas = {}, {"format_version": [1, 1, 0]}, [], {}
    for i, (name, color) in enumerate(BLOCKS.items()):
        rng = random.Random(name)
        im = Image.new("RGBA", (32, 32)); px = im.load()
        for x in range(32):
            for y in range(32):
                jitter = rng.randrange(-6, 7)
                px[x, y] = tuple(max(0, min(255, c+jitter)) for c in color) + (255,)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 31, 31), outline=(25, 35, 39), width=1)
        d.line((1, 1, 30, 1), fill=tuple(min(255, c+23) for c in color))
        d.line((1, 1, 1, 30), fill=tuple(min(255, c+15) for c in color))
        if "concrete" in name or "ceiling" in name:
            d.line((0, 16, 31, 16), fill=tuple(max(0, c-18) for c in color))
            for x,y in [(3,3),(28,3),(3,28),(28,28)]: d.rectangle((x,y,x+1,y+1),fill=(50,60,62))
        if any(k in name for k in ("steel", "door", "floor", "shutter", "mount", "base")):
            for x,y in [(3,3),(27,3),(3,27),(27,27)]:
                d.rectangle((x,y,x+2,y+2),fill=(142,159,164)); d.point((x+2,y+2),fill=(24,33,36))
        if "grate" in name or "vent" in name or "shutter" in name:
            for y in range(5,29,4): d.rectangle((4,y,27,y+1),fill=(20,31,35))
        if "diamond" in name or "industrial_floor" == name:
            for x in range(5,30,8):
                for y in range(5,30,8): d.line((x,y,x+2,y-2),fill=(131,149,152),width=2)
        if name not in ["concrete_panel","bunker_ceiling_panel","damaged_panel"] and any(k in name for k in ("panel", "console", "cabinet", "display", "reader", "server")):
            d.rectangle((4,4,27,21),fill=(13,29,35),outline=(146,161,156))
            d.rectangle((6,6,25,19),fill=(19,61,61))
            for y in [8,11,14,17]:
                d.line((8,y,13+(y%3)*4,y),fill=(95,215,173),width=1)
            for x in [6,11,16,23]: d.rectangle((x,25,x+2,27),fill=(211,168,62) if x==23 else (126,162,152))
        if name in ["industrial_light","emergency_light","floodlight"]:
            d.rectangle((3,7,28,24),fill=(21,35,39));d.rectangle((5,9,26,22),fill=color)
            d.rectangle((7,11,24,14),fill=(249,247,211) if name!="emergency_light" else (229,67,37))
            for x in [3,14,26]: d.rectangle((x,6,x+2,25),fill=(52,69,74))
        if "laser" in name and "mount" not in name:
            d.rectangle((8,8,23,23),fill=(15,22,28),outline=(135,151,153))
            d.rectangle((12,12,19,19),fill=(252,56,53) if "emitter" in name else (62,213,173))
        if "warning" in name or "blast_door" == name:
            for x in range(32):
                for y in range(25,31):
                    d.point((x,y),fill=(218,171,51) if (x+y)//5%2 else (23,33,36))
        if "glass" in name:
            d.rectangle((3,3,28,28),fill=(95,178,187,75))
            d.line((5,18,18,5),fill=(202,241,231,180),width=2)
        if "pad" in name:
            for n in [5,9,13]: d.rectangle((n,n,31-n,31-n),outline=(84,233,213))
        if "damaged" in name:
            d.line((5,0,16,14,11,20,26,31),fill=(12,16,17),width=3)
        save(im,RP / "textures/blocks" / f"{name}.png")
        terrain[name] = {"textures":f"textures/blocks/{name}"}
        blocks[NS+name] = {"sound":"metal" if "concrete" not in name else "stone"}
        components = {
            "minecraft:destructible_by_mining":{"seconds_to_destroy":4},
            "minecraft:destructible_by_explosion":{"explosion_resistance":1200},
            "minecraft:geometry":"minecraft:geometry.full_block",
            "minecraft:material_instances":{"*":{"texture":name,"render_method":"blend" if "glass" in name else "opaque"}},
            "minecraft:map_color":"#%02x%02x%02x" % color,
        }
        if name in INTERACTIVE: components[NS+"interact"] = {}
        if name in ["industrial_light","emergency_light","floodlight"]: components["minecraft:light_emission"] = 12 if name!="emergency_light" else 2
        if "glass" in name: components["minecraft:light_dampening"] = 0
        description = {"identifier":NS+name,"menu_category":{"category":"construction"}}
        permutations = []
        if name == "emergency_light":
            description["states"]={NS+"active":[False,True]}
            permutations=[{"condition":"q.block_state('secretfacilities:active')", "components":{
                "minecraft:light_emission":15,"minecraft:material_instances":{"*":{"texture":"alarm_on","render_method":"opaque"}}}}]
        if name in ["blast_door", "security_door", "security_shutter"]:
            # 'slide' is how many 2-pixel steps the leaf has retracted upward into the lintel.
            # Later permutations win, so the fully-open case is listed last.
            description["states"]={NS+"open":[False,True],NS+"slide":list(range(DOOR_SUBSTEPS))}
            # Anything short of a solid cube must not use 'opaque': the client then treats the block
            # as fully occluding, culls the neighbouring faces and the world shows through (x-ray).
            permutations=[{"condition":f"q.block_state('{NS}slide') == {step}", "components":{
                "minecraft:geometry":{"identifier":f"geometry.secretfacilities.door_slide_{step}"},
                "minecraft:material_instances":{"*":{"texture":name,"render_method":"alpha_test"}},
                "minecraft:collision_box":{"origin":[-8,DOOR_PX*step,-8],"size":[16,16-DOOR_PX*step,16]},
                "minecraft:selection_box":{"origin":[-8,DOOR_PX*step,-8],"size":[16,16-DOOR_PX*step,16]},
                "minecraft:light_dampening":0}} for step in range(1,DOOR_SUBSTEPS)]
            if name=="blast_door":
                # The blast door does not retract; its two leaves slide apart as an entity. While they
                # move, any slide state keeps the block solid but draws it invisible, so the leaves show.
                permutations=[{"condition":f"q.block_state('{NS}slide') > 0", "components":{
                    "minecraft:material_instances":{"*":{"texture":"door_open","render_method":"alpha_test"}},
                    "minecraft:light_dampening":0}}]
            # Open doors are drawn as a fully transparent cube. A geometry with no cubes breaks
            # the client's chunk meshing, and whole sections of the bunker and terrain vanish.
            permutations.append({"condition":f"q.block_state('{NS}open')", "components":{
                "minecraft:collision_box":False,"minecraft:selection_box":False,
                "minecraft:geometry":"minecraft:geometry.full_block",
                "minecraft:material_instances":{"*":{"texture":"door_open","render_method":"alpha_test"}},
                "minecraft:light_dampening":0}})
        write(BP / "blocks" / f"{name}.json",{"format_version":"1.21.90","minecraft:block":{
            "description":description,"components":components,**({"permutations":permutations} if permutations else {})}})
        lang.append(f"tile.{NS}{name}.name={name.replace('_',' ').title()}")
    alarm = Image.open(RP / "textures/blocks/emergency_light.png").convert("RGBA")
    ImageDraw.Draw(alarm).rectangle((5,9,26,22),fill=(255,65,35))
    save(alarm, RP / "textures/blocks/alarm_on.png"); terrain["alarm_on"]={"textures":"textures/blocks/alarm_on"}
    save(Image.new("RGBA",(32,32)), RP / "textures/blocks/door_open.png"); terrain["door_open"]={"textures":"textures/blocks/door_open"}
    for name,color in ITEMS.items():
        im=Image.new("RGBA",(32,32));d=ImageDraw.Draw(im)
        if "keycard" in name:
            d.rectangle((3,7,28,25),fill=(23,34,39),outline=(148,167,162),width=1)
            d.rectangle((5,9,26,13),fill=color);d.rectangle((5,17,11,22),fill=(222,191,109))
            d.line((7,17,7,22),fill=(94,97,76));d.line((5,20,11,20),fill=(94,97,76))
            d.line((15,18,24,18),fill=(199,217,211));d.line((15,21,21,21),fill=(112,137,133))
        else:
            d.rounded_rectangle((6,2,25,29),radius=3,fill=(36,51,59),outline=(150,165,162))
            d.rectangle((9,6,22,20),fill=(17,44,44));d.rectangle((11,9,20,17),outline=color,width=2)
            d.line((15,7,15,19),fill=color);d.line((9,13,22,13),fill=color)
            for x in [10,15,20]: d.rectangle((x,24,x+1,25),fill=color)
        save(im,RP / "textures/items" / f"{name}.png")
        item_atlas[name]={"textures":f"textures/items/{name}"}
        c={"minecraft:icon":{"textures":{"default":name}},"minecraft:display_name":{"value":f"item.{NS}{name}.name"},"minecraft:max_stack_size":1}
        if "device" in name or "scanner" in name: c[NS+"use_device"]={}
        write(BP/"items"/f"{name}.json",{"format_version":"1.21.90","minecraft:item":{
            "description":{"identifier":NS+name,"menu_category":{"category":"items"}},"components":c}})
        lang.append(f"item.{NS}{name}.name={name.replace('_',' ').title()}")
    write(RP/"textures/terrain_texture.json",{"resource_pack_name":"secret_facilities","texture_name":"atlas.terrain","padding":8,"num_mip_levels":4,"texture_data":terrain})
    write(RP/"textures/item_texture.json",{"resource_pack_name":"secret_facilities","texture_name":"atlas.items","texture_data":item_atlas})
    write(RP/"blocks.json",blocks)
    for pack in (BP,RP):
        write(pack/"texts/languages.json",["en_US"])
        (pack/"texts/en_US.lang").write_text("pack.name=Secret Facilities\npack.description=Command bunker · first playable alpha\n"+"\n".join(lang)+"\n")
    models=[]
    for step in range(1,DOOR_SUBSTEPS):
        # Per-face UVs: box UV on a 16x16 block texture runs off the sprite and samples the atlas.
        # Sides show the leaf's lower edge, so the texture rises with the leaf.
        side={"uv":[0,DOOR_PX*step],"uv_size":[16,16-DOOR_PX*step]};cap={"uv":[0,0],"uv_size":[16,16]}
        uv={face:side for face in ("north","south","east","west")}|{"up":cap,"down":cap}
        models.append({"description":{"identifier":f"geometry.secretfacilities.door_slide_{step}",
            "texture_width":16,"texture_height":16,"visible_bounds_width":2,"visible_bounds_height":2,"visible_bounds_offset":[0,0.5,0]},
            "bones":[{"name":"leaf","pivot":[0,0,0],"cubes":[{"origin":[-8,DOOR_PX*step,-8],"size":[16,16-DOOR_PX*step,16],"uv":uv}]}]})
    write(RP/"models/blocks/door_slide.geo.json",{"format_version":"1.12.0","minecraft:geometry":models})

def turret():
    write(BP/"entities/laser_turret.json",{"format_version":"1.21.90","minecraft:entity":{
        "description":{"identifier":NS+"laser_turret","is_spawnable":False,"is_summonable":True,"is_experimental":False},
        "components":{"minecraft:type_family":{"family":["secretfacilities_defence"]},
            "minecraft:health":{"value":80,"max":80},"minecraft:collision_box":{"width":0.85,"height":1.5},
            "minecraft:physics":{"has_gravity":False,"has_collision":True},
            "minecraft:pushable":{"is_pushable":False,"is_pushable_by_piston":False},
            "minecraft:knockback_resistance":{"value":1},"minecraft:persistent":{},"minecraft:fire_immune":{}},
    }})
    def cube(origin,size,uv=[0,0]): return {"origin":origin,"size":size,"uv":uv}
    write(RP/"models/entity/laser_turret.geo.json",{"format_version":"1.12.0","minecraft:geometry":[{
        "description":{"identifier":"geometry.secretfacilities.laser_turret","texture_width":64,"texture_height":64,
            "visible_bounds_width":3,"visible_bounds_height":3,"visible_bounds_offset":[0,1,0]},
        "bones":[{"name":"base","pivot":[0,0,0],"cubes":[cube([-7,0,-7],[14,3,14])]},
            {"name":"yaw_mount","parent":"base","pivot":[0,6,0],"cubes":[cube([-4,3,-4],[8,6,8],[0,30])]},
            {"name":"pitch_mount","parent":"yaw_mount","pivot":[0,12,0],"cubes":[cube([-5,9,-5],[10,6,10],[0,30])]},
            {"name":"barrel","parent":"pitch_mount","pivot":[0,12,-3],"cubes":[cube([-2,11,-15],[4,3,12],[32,0])]},
            {"name":"emitter","parent":"barrel","pivot":[0,12,-15],"cubes":[cube([-2,11,-16],[4,3,1],[48,40])]},
            {"name":"status_light","parent":"yaw_mount","pivot":[0,16,0],"cubes":[cube([-2,15,-1],[4,2,2],[48,48])]}]}]})
    tex=Image.new("RGB",(64,64),(72,91,99));d=ImageDraw.Draw(tex)
    for y in range(0,64,4):d.line((0,y,63,y),fill=(53,72,81))
    for x in range(3,64,8):
        for y in range(3,64,8):d.rectangle((x,y,x+1,y+1),fill=(155,170,166))
    d.rectangle((48,40,63,47),fill=(243,74,49));d.rectangle((48,48,63,57),fill=(55,218,158))
    save(tex,RP/"textures/entities/laser_turret.png")
    write(RP/"entity/laser_turret.entity.json",{"format_version":"1.10.0","minecraft:client_entity":{
        "description":{"identifier":NS+"laser_turret","materials":{"default":"entity_alphatest"},
            "textures":{"default":"textures/entities/laser_turret"},"geometry":{"default":"geometry.secretfacilities.laser_turret"},
            "animations":{"aim":"animation.secretfacilities.turret.aim"},"scripts":{"animate":["aim"]},
            "render_controllers":["controller.render.secretfacilities.turret"]}}})
    write(RP/"render_controllers/turret.json",{"format_version":"1.8.0","render_controllers":{
        "controller.render.secretfacilities.turret":{"geometry":"Geometry.default","materials":[{"*":"Material.default"}],"textures":["Texture.default"]}}})
    write(RP/"animations/turret.animation.json",{"format_version":"1.8.0","animations":{
        "animation.secretfacilities.turret.aim":{"loop":True,"bones":{"pitch_mount":{"rotation":["query.target_x_rotation",0,0]}}}}})
    # Tripwire grids keep their faint dotted beam.
    write(RP/"particles/laser_beam.json",{"format_version":"1.10.0","particle_effect":{
        "description":{"identifier":NS+"laser_beam","basic_render_parameters":{"material":"particles_alpha","texture":"textures/particle/laser"}},
        "components":{"minecraft:emitter_rate_instant":{"num_particles":1},"minecraft:emitter_lifetime_once":{"active_time":0.1},
            "minecraft:emitter_shape_point":{},"minecraft:particle_lifetime_expression":{"max_lifetime":0.22},
            "minecraft:particle_appearance_billboard":{"size":[0.055,0.055],"facing_camera_mode":"lookat_xyz","uv":{"texture_width":8,"texture_height":8,"uv":[0,0],"uv_size":[8,8]}},
            "minecraft:particle_appearance_tinting":{"color":[1,0.13,0.09,1]}}}})
    save(Image.new("RGBA",(8,8),(255,255,255,255)),RP/"textures/particle/laser.png")
    # A soft round glow; drawn additively and unlit, overlapping sprites fuse into a solid light.
    glow=Image.new("RGBA",(16,16))
    for x in range(16):
        for y in range(16):
            r=math.hypot(x-7.5,y-7.5)/8;glow.putpixel((x,y),(255,255,255,int(255*max(0,1-r)**1.6)))
    save(glow,RP/"textures/particle/laser_glow.png")
    fade="(1 - v.particle_age / v.particle_lifetime)"
    # The turret beam is one emitter per shot. Every sprite sits at a random point along the shot
    # (script variable 'span' is the muzzle-to-target vector), densely enough to read as one solid
    # beam: a white-hot core, a red body and a wide faint halo, all fading together.
    layer=lambda core,body,halo:f"(v.particle_random_2 < 0.5 ? {core} : (v.particle_random_2 < 0.82 ? {body} : {halo}))"
    size=f"{layer(0.045,0.1,0.24)} * (1 - 0.5 * v.particle_age / v.particle_lifetime)"
    write(RP/"particles/turret_beam.json",{"format_version":"1.10.0","particle_effect":{
        "description":{"identifier":NS+"turret_beam","basic_render_parameters":{"material":"particles_add","texture":"textures/particle/laser_glow"}},
        "components":{"minecraft:emitter_rate_instant":{"num_particles":"math.clamp(v.length * 24, 12, 720)"},
            "minecraft:emitter_lifetime_once":{"active_time":0.05},"minecraft:emitter_shape_point":{},
            "minecraft:particle_lifetime_expression":{"max_lifetime":0.32},
            "minecraft:particle_motion_parametric":{"relative_position":[f"v.span.{a} * v.particle_random_1" for a in "xyz"]},
            "minecraft:particle_appearance_billboard":{"size":[size,size],"facing_camera_mode":"lookat_xyz",
                "uv":{"texture_width":16,"texture_height":16,"uv":[0,0],"uv_size":[16,16]}},
            "minecraft:particle_appearance_tinting":{"color":["1",layer(0.82,0.2,0.08),layer(0.78,0.12,0.05),f"{layer(1,0.85,0.4)} * {fade}"]}}}})
    # Where the beam lands: a hot flash and a spray of sparks.
    write(RP/"particles/laser_impact.json",{"format_version":"1.10.0","particle_effect":{
        "description":{"identifier":NS+"laser_impact","basic_render_parameters":{"material":"particles_add","texture":"textures/particle/laser_glow"}},
        "components":{"minecraft:emitter_rate_instant":{"num_particles":18},"minecraft:emitter_lifetime_once":{"active_time":0.05},
            "minecraft:emitter_shape_sphere":{"radius":0.1,"direction":"outwards"},
            "minecraft:particle_initial_speed":"v.particle_random_3 < 0.15 ? 0 : math.random(2, 5)",
            "minecraft:particle_motion_dynamic":{"linear_acceleration":[0,-9,0],"linear_drag_coefficient":3},
            "minecraft:particle_lifetime_expression":{"max_lifetime":"math.random(0.2, 0.45)"},
            "minecraft:particle_appearance_billboard":{"size":[f"(v.particle_random_3 < 0.15 ? 0.45 : 0.06) * {fade}"]*2,"facing_camera_mode":"lookat_xyz",
                "uv":{"texture_width":16,"texture_height":16,"uv":[0,0],"uv_size":[16,16]}},
            "minecraft:particle_appearance_tinting":{"color":["1","0.55 + 0.35 * v.particle_random_4","0.2",fade]}}}})

# The entrance blast door is 5 wide and 4 tall; the planner test pins that size.
LEAF_WIDTH, LEAF_HEIGHT = 5, 4
# Ticks per block each leaf slides. Must match BLAST_RATE in src/runtime/security.ts.
LEAF_RATE = 16

def door_leaf():
    """The moving blast door: two leaves that part at a central seam and slide sideways into the
    wall on either side. The server says where they start and which way they move; the client
    animates them every frame on its own clock, eased in and out, so the slide is smooth instead
    of stepping with block updates and network jitter."""
    phase,motion=NS+"phase",NS+"motion"
    write(BP/"entities/blast_door_leaf.json",{"format_version":"1.21.90","minecraft:entity":{
        "description":{"identifier":NS+"blast_door_leaf","is_spawnable":False,"is_summonable":True,"is_experimental":False,
            "properties":{phase:{"type":"float","range":[0.0,1.0],"default":0.0,"client_sync":True},
                motion:{"type":"int","range":[-1,1],"default":0,"client_sync":True}}},
        "components":{"minecraft:type_family":{"family":["inanimate","secretfacilities_door"]},
            "minecraft:health":{"value":1,"max":1},"minecraft:collision_box":{"width":0.1,"height":0.1},
            "minecraft:damage_sensor":{"triggers":{"cause":"all","deals_damage":"no"}},
            "minecraft:physics":{"has_gravity":False,"has_collision":False},
            "minecraft:pushable":{"is_pushable":False,"is_pushable_by_piston":False},
            "minecraft:knockback_resistance":{"value":1},"minecraft:body_rotation_blocked":{},"minecraft:fire_immune":{}},
        # Spawning mid-travel starts the client at the right end, so a closing door never flashes shut.
        "events":{NS+"from_open":{"set_property":{phase:1.0}}}}})
    # One cube per door column, so the texture tiles exactly like the blocks it replaces; the
    # centre column is split between the two leaves at the seam. 15 px deep, just inside the wall
    # either side, which hides each leaf once it has slid into its pocket.
    half=8*LEAF_WIDTH
    bones=[]
    for bone,sign in [("left",-1),("right",1)]:
        # Block column edges, measured from the seam: 0, 8, 24, 40 px for a five-wide door.
        edges=[0]+[e for e in range(8,half+1,16)]
        cubes=[]
        for a,b in zip(edges,edges[1:]):
            w=b-a;x0=sign*b if sign<0 else a
            # A half-width cube shows the half of the tile nearest the seam.
            u=(16 if sign<0 else 0) if w<16 else 0
            face={"uv":[u,0],"uv_size":[2*w,32]};cap={"uv":[u,0],"uv_size":[2*w,30]};edge={"uv":[0,0],"uv_size":[30,32]}
            uv={"north":face,"south":face,"east":edge,"west":edge,"up":cap,"down":cap}
            cubes+=[{"origin":[x0,16*j,-7.5],"size":[w,16,15],"uv":uv} for j in range(LEAF_HEIGHT)]
        bones.append({"name":bone,"pivot":[0,0,0],"cubes":cubes})
    write(RP/"models/entity/blast_door_leaf.geo.json",{"format_version":"1.12.0","minecraft:geometry":[{
        "description":{"identifier":"geometry.secretfacilities.blast_door_leaf","texture_width":32,"texture_height":32,
            "visible_bounds_width":2*LEAF_WIDTH+1,"visible_bounds_height":LEAF_HEIGHT+1,"visible_bounds_offset":[0,LEAF_HEIGHT/2,0]},
        "bones":bones}]})
    # Seconds for a full slide: each leaf travels half the door width. Must match travel() in security.ts.
    duration=LEAF_WIDTH/2*LEAF_RATE/20
    # Restart the clock whenever the server re-anchors the leaves (start, stop or reversal), advance
    # the phase linearly from there, and draw it through the same ease-in-out the server uses
    # for the collision blocks: 3s^2 - 2s^3.
    script=(f"v.elapsed = (q.property('{phase}') != v.phase || q.property('{motion}') != v.motion) ? 0 : v.elapsed + q.delta_time;"
        f"v.phase = q.property('{phase}');v.motion = q.property('{motion}');"
        f"v.s = math.clamp(v.phase + v.motion * v.elapsed / {duration}, 0, 1);"
        "v.shown = v.s * v.s * (3 - 2 * v.s);")
    write(RP/"entity/blast_door_leaf.entity.json",{"format_version":"1.10.0","minecraft:client_entity":{
        "description":{"identifier":NS+"blast_door_leaf","materials":{"default":"entity"},
            "textures":{"default":"textures/blocks/blast_door"},"geometry":{"default":"geometry.secretfacilities.blast_door_leaf"},
            "animations":{"slide":"animation.secretfacilities.door_leaf.slide"},
            "scripts":{"initialize":["v.phase = -1; v.motion = 0; v.elapsed = 0; v.s = 0; v.shown = 0;"],
                "pre_animation":[script],"animate":["slide"]},
            "render_controllers":["controller.render.secretfacilities.door_leaf"]}}})
    write(RP/"render_controllers/door_leaf.json",{"format_version":"1.8.0","render_controllers":{
        "controller.render.secretfacilities.door_leaf":{"geometry":"Geometry.default","materials":[{"*":"Material.default"}],"textures":["Texture.default"]}}})
    # Each leaf slides half the door width away from the seam, in opposite directions.
    write(RP/"animations/door_leaf.animation.json",{"format_version":"1.8.0","animations":{
        "animation.secretfacilities.door_leaf.slide":{"loop":True,"bones":{
            "left":{"position":[f"-v.shown * {half}",0,0]},"right":{"position":[f"v.shown * {half}",0,0]}}}}})

def sounds():
    definitions={}
    for name,duration in [("access_granted",0.22),("access_denied",0.3),("alarm_alert",1.8),("alarm_lockdown",1.8),
                          ("blast_door_movement",1.1),("blast_door_warning",0.7),("elevator_move",1.0),("elevator_arrive",0.5),
                          ("laser_turret_fire",0.17),("warning_beep",0.18),("destruction",1.5)]:
        rate=22050; samples=[];rng=random.Random(name)
        for n in range(int(rate*duration)):
            t=n/rate; env=min(1,t*45)*min(1,(duration-t)*18)
            if "alarm" in name: v=0.25*math.sin(2*math.pi*(550*t+60/(2*math.pi*1.8)*math.sin(2*math.pi*1.8*t)))
            elif "movement" in name or "move" in name or name=="destruction":v=0.14*math.sin(2*math.pi*65*t)+rng.uniform(-0.13,0.13)
            elif "fire" in name:v=0.3*math.sin(2*math.pi*(1800*t-3600*t*t))*(1-t/duration)
            else:v=0.2*math.sin(2*math.pi*(850 if "granted" in name or "arrive" in name else 340)*t)
            samples.append(struct.pack("<h",int(v*env*32767)))
        path=RP/"sounds/secretfacilities"/f"{name}.wav";path.parent.mkdir(parents=True,exist_ok=True)
        with wave.open(str(path),"wb") as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(b"".join(samples))
        definitions[NS+name]={"category":"block","sounds":[f"sounds/secretfacilities/{name}"]}
    write(RP/"sounds/sound_definitions.json",{"format_version":"1.14.0","sound_definitions":definitions})

# Minimal, explicit little-endian NBT encoder (no undocumented compression/header).
def nbt_string(value):
    data=value.encode("utf-8");return struct.pack("<H",len(data))+data
def nbt_payload(kind,value):
    if kind==3:return struct.pack("<i",value)
    if kind==1:return struct.pack("<b",value)
    if kind==8:return nbt_string(value)
    if kind==9:
        sub,items=value;return bytes([sub])+struct.pack("<i",len(items))+b"".join(nbt_payload(sub,item) for item in items)
    if kind==10:return b"".join(bytes([k])+nbt_string(n)+nbt_payload(k,v) for n,(k,v) in value.items())+b"\0"
    raise ValueError(kind)

# Must match ROOM_ROLES in src/generation/planner.ts: every role the floor programs can place.
ROOM_ROLES=sorted(["archive","barracks","bedroom","briefing","canteen","command","farm","generator","laboratory","lounge",
    "medical","mining","office","security","server","storage","utility","vault","workshop"])

class Template:
    def __init__(self,name,size=(9,7,9)):
        self.name,self.size=name,size;self.blocks={};self.entities={}
        self.fill((0,0,0),tuple(n-1 for n in size),"minecraft:air")
    def set(self,x,y,z,block,states=None):
        if not (0<=x<self.size[0] and 0<=y<self.size[1] and 0<=z<self.size[2]):raise ValueError((self.name,x,y,z))
        # Palette entries carry every state, as game-saved structures do.
        if states is None and block in ["blast_door","security_door","security_shutter"]:states={NS+"open":False,NS+"slide":0}
        if states is None and block=="emergency_light":states={NS+"active":False}
        if states is None and block.endswith("_slab"):states={"minecraft:vertical_half":"bottom"}
        self.blocks[x,y,z]=(block if ":" in block else NS+block,tuple(sorted((states or {}).items())))
    def entity(self,x,y,z,data):
        """Block entity data, as game-saved structures carry for beds, chests and the like."""
        self.entities[x,y,z]={**data,"x":(3,x),"y":(3,y),"z":(3,z)}
    def fill(self,a,b,block,states=None):
        for x in range(a[0],b[0]+1):
            for y in range(a[1],b[1]+1):
                for z in range(a[2],b[2]+1):self.set(x,y,z,block,states)
    def shell(self):
        sx,sy,sz=self.size
        self.fill((0,0,0),(sx-1,sy-1,sz-1),"reinforced_concrete")
        self.fill((1,1,1),(sx-2,sy-2,sz-2),"minecraft:air")
        self.fill((1,0,1),(sx-2,0,sz-2),"industrial_floor")
        self.fill((1,sy-1,1),(sx-2,sy-1,sz-2),"bunker_ceiling_panel")
    def export(self):
        palette=list(dict.fromkeys(self.blocks.values()));lookup={v:i for i,v in enumerate(palette)}
        sx,sy,sz=self.size
        indices=[lookup[self.blocks[x,y,z]] for x in range(sx) for y in range(sy) for z in range(sz)]
        pals=[]
        for name,states in palette:
            pals.append({"name":(8,name),"states":(10,{k:(1 if isinstance(v,bool) else 3 if isinstance(v,int) else 8,int(v) if isinstance(v,bool) else v) for k,v in states}),"version":(3,(1<<24)|(21<<16)|(90<<8)|3)})
        root={"format_version":(3,1),"size":(9,(3,list(self.size))),"structure_world_origin":(9,(3,[0,0,0])),
              "structure":(10,{"block_indices":(9,(9,[(3,indices),(3,[-1]*len(indices))])),"entities":(9,(10,[])),
              "palette":(10,{"default":(10,{"block_palette":(9,(10,pals)),"block_position_data":(10,{
                  str((x*sy+y)*sz+z):(10,{"block_entity_data":(10,data)}) for (x,y,z),data in sorted(self.entities.items())})})})})}
        path=BP/"structures/secretfacilities/bunker"/f"{self.name}.mcstructure";path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(b"\x0a\x00\x00"+nbt_payload(10,root))
        return {"name":self.name,"size":list(self.size),"palette":[[n,dict(s)] for n,s in palette],"indices":indices}

# Room furniture is authored facing north (door in the south wall at z=8, far wall at z=0) and
# mirrored for south-facing rooms. Interior: x 1..7, z 1..7. The aisle x 3..5 stays walkable from
# the door to the room's centre, and x 6..7 at the door row stays clear for the keycard reader.
FACE={"down":0,"up":1,"north":2,"south":3,"west":4,"east":5}
BED={"south":0,"west":1,"north":2,"east":3}
# Stairs' weirdo_direction names the side their tall back is on.
STAIR={"east":0,"west":1,"south":2,"north":3}
OPPOSITE={"north":"south","south":"north","east":"west","west":"east","up":"up","down":"down"}
STEP={"north":(0,-1),"south":(0,1),"west":(-1,0),"east":(1,0)}
WALKABLE=("minecraft:air","minecraft:rail")
BED_RED,BED_WHITE,BED_BLUE,BED_GREEN=14,0,11,13

class Room:
    def __init__(self,role,side):
        self.t=Template(f"{role}_{side}");self.t.shell();self.south=side=="south";self.rng=random.Random(f"{role}_{side}")
        self.t.fill((3,1,self.z(8)),(5,3,self.z(8)),"minecraft:air")
        for x in [2,6]:self.put(x,6,4,"industrial_light")
    def z(self,z):return 8-z if self.south else z
    def d(self,direction):return {"north":"south","south":"north"}.get(direction,direction) if self.south else direction
    def put(self,x,y,z,block,states=None):self.t.set(x,y,self.z(z),block,states)
    def box(self,a,b,block,states=None):
        for x in range(a[0],b[0]+1):
            for y in range(a[1],b[1]+1):
                for z in range(a[2],b[2]+1):self.put(x,y,z,block,states)
    def floor(self,block):self.box((1,0,1),(7,0,7),block)
    def cardinal(self,x,y,z,block,facing):self.put(x,y,z,block,{"minecraft:cardinal_direction":self.d(facing)})
    def chest(self,x,y,z,facing):self.cardinal(x,y,z,"minecraft:chest",facing)
    def barrel(self,x,y,z,facing):self.put(x,y,z,"minecraft:barrel",{"facing_direction":FACE[self.d(facing)],"open_bit":False})
    def chair(self,x,z,facing,block="minecraft:mangrove_stairs"):
        self.put(x,1,z,block,{"weirdo_direction":STAIR[self.d(OPPOSITE[facing])],"upside_down_bit":False})
    def table(self,x,y,z,block="minecraft:mangrove_slab"):self.put(x,y,z,block,{"minecraft:vertical_half":"top"})
    def lantern(self,x,y,z,hanging=False):self.put(x,y,z,"minecraft:lantern",{"hanging":hanging})
    def cauldron(self,x,y,z):self.put(x,y,z,"minecraft:cauldron",{"cauldron_liquid":"water","fill_level":6})
    def brewing(self,x,y,z):self.put(x,y,z,"minecraft:brewing_stand",{f"brewing_stand_slot_{c}_bit":False for c in "abc"})
    def lectern(self,x,y,z,facing):self.put(x,y,z,"minecraft:lectern",{"minecraft:cardinal_direction":self.d(facing),"powered_bit":False})
    def crop(self,x,z,block):
        self.put(x,0,z,"minecraft:farmland",{"moisturized_amount":7})
        self.put(x,1,z,block,{"growth":self.rng.randint(2,7)})
    def bed(self,x,z,head,color):
        dx,dz=STEP[head];hx,hz=x+dx,z+dz
        for (bx,bz),is_head in [((x,z),False),((hx,hz),True)]:
            self.put(bx,1,bz,"minecraft:bed",{"direction":BED[self.d(head)],"head_piece_bit":is_head,"occupied_bit":False})
            # The colour lives in the bed's block entity; without one the game draws a default bed.
            self.t.entity(bx,1,self.z(bz),{"id":(8,"Bed"),"color":(1,color),"isMovable":(1,1)})
    def check(self):
        """The aisle must stay walkable from the door to the room centre, and the reader spot clear."""
        for z in range(4,8):
            for x in range(3,6):
                for y in (1,2):
                    block=self.t.blocks[x,y,self.z(z)][0]
                    assert block in WALKABLE or block.endswith("_carpet"),(self.t.name,x,y,z,block)
        for y in (1,2,3):assert self.t.blocks[6,y,self.z(7)][0]=="minecraft:air",(self.t.name,"reader")
        return self.t

def room(role,side):
    r=Room(role,side);rng=r.rng
    if role=="bedroom":  # Officer's quarters: double bed, desk, wardrobe, bookshelf.
        r.floor("minecraft:mangrove_planks");r.box((3,1,3),(5,1,5),"minecraft:blue_carpet")
        for x in [1,2]:r.bed(x,2,"north",BED_BLUE)
        r.barrel(3,1,1,"up");r.lantern(3,2,1);r.chest(1,1,3,"south")
        r.box((6,1,1),(7,3,1),"minecraft:bookshelf")
        for z in [3,4]:r.table(7,1,z)
        r.chair(6,4,"east");r.lantern(7,2,3)
        for z in [5,6]:
            for y in [1,2]:r.barrel(7,y,z,"west")
        r.lantern(4,5,3,True)
    elif role=="barracks":  # Bunk room: eight beds with lockers between them.
        for z in [1,2,4,5]:r.bed(2,z,"west",BED_RED);r.bed(6,z,"east",BED_RED)
        for y in [1,2]:r.barrel(1,y,3,"east");r.barrel(2,y,3,"east");r.barrel(7,y,3,"west");r.barrel(6,y,3,"west")
        r.chest(1,1,6,"east");r.chest(7,1,6,"west")
        for z in [2,5]:r.lantern(4,5,z,True)
    elif role=="lounge":  # Recreation: sofas facing a screen, coffee table, music.
        r.floor("minecraft:mangrove_planks");r.box((3,1,4),(5,1,5),"minecraft:red_carpet")
        r.box((3,1,1),(5,1,1),"minecraft:black_concrete");r.box((3,2,1),(5,3,1),"facility_status_display")
        for x in [2,6]:r.box((x,1,1),(x,2,1),"minecraft:noteblock")
        for z in [2,3,4]:r.chair(1,z,"east");r.chair(7,z,"west")
        r.table(1,1,5);r.lantern(1,2,5);r.table(7,1,5)
        r.table(4,1,3);r.put(4,2,3,"minecraft:cake",{"bite_counter":0})
        r.box((1,1,7),(1,3,7),"minecraft:bookshelf");r.put(2,1,7,"minecraft:jukebox")
        r.lantern(4,5,4,True)
    elif role=="canteen":  # Mess hall with a galley along the far wall.
        r.cardinal(1,1,1,"minecraft:smoker","south");r.cardinal(2,1,1,"minecraft:furnace","south")
        for x in [3,4,5]:r.table(x,1,1,"minecraft:polished_blackstone_brick_slab")
        r.cauldron(6,1,1);r.barrel(7,1,1,"south");r.barrel(7,2,1,"south")
        for z in [3,4,5,6]:
            r.table(1,1,z);r.chair(2,z,"west");r.table(7,1,z);r.chair(6,z,"east")
        r.put(1,2,4,"minecraft:cake",{"bite_counter":0});r.put(7,2,5,"minecraft:cake",{"bite_counter":0})
    elif role=="farm":  # Hydroponics bay: irrigated crop beds under grow lights.
        r.box((3,0,4),(5,0,7),"grated_floor")
        rows={1:"minecraft:wheat",2:"minecraft:carrots",3:"minecraft:potatoes"}
        for z,crop in rows.items():
            for x in range(1,8):
                if (x,z)!=(4,2):r.crop(x,z,crop)
        r.put(4,0,2,"minecraft:water",{"liquid_depth":0})
        for z in [4,5,6]:
            for x in [1,2]:r.crop(x,z,"minecraft:beetroot")
            for x in [6,7]:r.crop(x,z,"minecraft:wheat")
        # Crops need light 9 to grow; a lamp directly above gives 10, one block aside 9.
        r.box((1,6,2),(7,6,2),"minecraft:sea_lantern")
        for x in [1,2,6,7]:r.put(x,6,5,"minecraft:sea_lantern")
        r.put(1,1,7,"minecraft:composter",{"composter_fill_level":0});r.chest(2,1,7,"south")
    elif role=="mining":  # Excavation: a live rock face with ore, a railed drift and ore processing.
        ores=[("minecraft:coal_ore",8),("minecraft:iron_ore",7),("minecraft:copper_ore",5),("minecraft:gold_ore",3),
              ("minecraft:redstone_ore",3),("minecraft:lapis_ore",2),("minecraft:deepslate_diamond_ore",1)]
        for x in range(1,8):
            for y in range(1,6):
                for z in [0,1,2]:
                    roll=rng.random()*100;block="minecraft:stone"
                    for ore,chance in ores:
                        if roll<chance:block=ore;break
                        roll-=chance
                    else:block=rng.choice(["minecraft:stone","minecraft:stone","minecraft:andesite","minecraft:tuff"])
                    r.put(x,y,z,block)
        for z in [1,2]:r.box((4,1,z),(4,2,z),"minecraft:air")
        for z in range(1,8):r.put(4,1,z,"minecraft:rail",{"rail_direction":0})
        for x in [2,6]:r.box((x,1,3),(x,3,3),"minecraft:mangrove_fence")
        r.box((2,4,3),(6,4,3),"minecraft:mangrove_planks")
        r.box((1,0,3),(2,0,7),"minecraft:cobblestone");r.box((6,0,3),(7,0,7),"minecraft:cobblestone")
        r.put(1,1,3,"minecraft:gravel");r.put(7,1,3,"minecraft:cobblestone")
        r.cardinal(1,1,4,"minecraft:blast_furnace","east");r.cardinal(1,1,5,"minecraft:furnace","east")
        r.chest(1,1,6,"east");r.put(2,1,6,"minecraft:crafting_table")
        r.chest(7,1,4,"west");r.barrel(7,1,5,"west");r.barrel(7,2,5,"west")
        r.lantern(4,5,5,True)
    elif role=="workshop":  # Fabrication: a full workbench line and tool storage.
        r.box((2,0,1),(2,0,7),"concrete_warning_stripe")
        r.put(1,1,2,"minecraft:crafting_table");r.put(1,1,3,"minecraft:smithing_table")
        r.cardinal(1,1,4,"minecraft:stonecutter_block","east");r.cardinal(1,1,5,"minecraft:furnace","east")
        r.cardinal(1,1,6,"minecraft:blast_furnace","east")
        r.put(3,1,1,"minecraft:fletching_table");r.put(4,1,1,"minecraft:cartography_table");r.chest(5,1,1,"south")
        for z in [2,3,4,5]:
            for y in [1,2]:r.barrel(7,y,z,"west")
        for x in [1,7]:r.box((x,5,1),(x,5,7),"pipe")
    elif role=="generator":  # Power plant: a caged reactor core between generator banks.
        r.box((3,1,1),(3,4,1),"minecraft:iron_bars");r.box((5,1,1),(5,4,1),"minecraft:iron_bars")
        r.box((4,1,1),(4,4,1),"minecraft:sea_lantern");r.box((4,1,2),(4,4,2),"minecraft:iron_bars")
        r.box((3,5,1),(5,5,2),"riveted_steel")
        r.box((1,1,2),(1,2,6),"generator_panel");r.box((7,1,2),(7,2,6),"generator_panel")
        for x in [1,7]:r.box((x,4,1),(x,4,7),"pipe");r.put(x,4,4,"pipe_junction")
        for x in [2,6]:r.box((x,0,1),(x,0,7),"concrete_warning_stripe")
        r.put(2,1,1,"electrical_cabinet");r.put(6,1,1,"electrical_cabinet")
    elif role=="medical":  # Infirmary: patient beds, dispensary counter with brewing stands.
        r.floor("minecraft:white_concrete")
        for x,z in [(4,3),(4,4),(4,5),(3,4),(5,4)]:r.put(x,0,z,"minecraft:red_concrete")
        for z in [2,5]:r.bed(2,z,"west",BED_WHITE)
        r.put(1,1,3,"light_reinforced_concrete");r.brewing(1,2,3);r.chest(1,1,6,"east")
        r.bed(6,1,"east",BED_WHITE)
        r.box((7,1,2),(7,1,5),"light_reinforced_concrete");r.brewing(7,2,3);r.put(7,2,5,"utility_panel");r.cauldron(7,1,6)
        r.box((3,1,1),(5,1,1),"minecraft:white_concrete");r.box((3,2,1),(5,2,1),"facility_status_display")
    elif role=="laboratory":  # Research lab: glowing specimen tanks, enchanting and brewing benches.
        r.floor("light_reinforced_concrete")
        for x in [1,7]:r.put(x,1,1,"minecraft:sea_lantern");r.box((x,2,1),(x,3,1),"blast_resistant_glass")
        r.put(4,1,1,"minecraft:enchanting_table")
        for x in [2,3,5,6]:r.box((x,1,1),(x,2,1),"minecraft:bookshelf")
        r.box((1,1,3),(1,1,6),"light_reinforced_concrete");r.brewing(1,2,4);r.brewing(1,2,6);r.cauldron(1,1,5)
        r.box((7,1,3),(7,2,3),"security_glass");r.box((7,1,4),(7,1,6),"utility_panel");r.put(7,2,5,"minecraft:lantern",{"hanging":False})
    elif role=="command":  # Command centre: display wall, console banks, strategy table.
        r.box((2,1,1),(6,1,1),"control_cabinet");r.box((2,2,1),(6,4,1),"facility_status_display")
        for x in [1,7]:r.box((x,1,2),(x,1,6),"control_cabinet");r.box((x,2,2),(x,2,6),"facility_status_display")
        for z in [3,5]:r.chair(2,z,"west","minecraft:polished_blackstone_stairs");r.chair(6,z,"east","minecraft:polished_blackstone_stairs")
        r.box((3,1,2),(5,1,2),"minecraft:cartography_table")
    elif role=="office":  # Administration: two desks, filing, bookshelves and a lectern.
        r.box((1,1,1),(2,3,1),"minecraft:bookshelf");r.box((6,1,1),(7,3,1),"minecraft:bookshelf")
        r.lectern(4,1,1,"south");r.barrel(3,1,1,"south");r.barrel(5,1,1,"south")
        for z in [3,4]:r.table(1,1,z);r.table(7,1,z)
        r.chair(2,4,"west");r.chair(6,4,"east");r.lantern(1,2,3);r.lantern(7,2,3)
        for y in [1,2]:r.barrel(1,y,6,"east");r.barrel(7,y,6,"west")
    elif role=="briefing":  # Briefing room: projection wall, presenter's lectern, rows of seats.
        r.box((2,1,1),(6,1,1),"minecraft:black_concrete");r.box((2,2,1),(6,4,1),"facility_status_display")
        r.lectern(4,1,2,"south")
        for z in [4,5,6]:
            for x in [1,2,6,7]:r.chair(x,z,"north")
    elif role=="security":  # Security office: monitor wall, duty desk, lockers and a holding cell.
        r.box((1,1,2),(1,1,5),"control_cabinet");r.box((1,2,2),(1,3,5),"facility_status_display")
        for z in [3,4]:r.table(2,1,z,"minecraft:polished_blackstone_brick_slab")
        r.chair(3,3,"west","minecraft:polished_blackstone_stairs")
        r.box((5,1,1),(5,3,3),"minecraft:iron_bars");r.box((6,1,3),(7,3,3),"minecraft:iron_bars")
        r.put(7,1,1,"minecraft:polished_blackstone_brick_slab")
        for z in [4,5]:
            for y in [1,2]:r.barrel(7,y,z,"west")
        r.chest(7,1,6,"west")
    elif role=="server":  # Data centre: rack rows on a raised grated floor.
        r.floor("grated_floor")
        for x in [1,2,6,7]:
            for z in [1,2,4,5]:r.box((x,1,z),(x,3,z),"server_rack")
        r.box((4,5,1),(4,5,7),"cable_tray")
    elif role=="archive":  # Records: shelving walls, filing chests and a reading lectern.
        r.box((1,1,1),(1,4,6),"minecraft:bookshelf");r.box((7,1,1),(7,4,5),"minecraft:bookshelf")
        for z in [2,5]:r.chest(2,1,z,"east");r.chest(6,1,z,"west")
        r.table(4,1,1);r.lectern(3,1,1,"south");r.lectern(5,1,1,"south");r.lantern(4,5,3,True)
    elif role=="vault":  # Strongroom: steel-lined barrel stacks and secured chests.
        r.floor("diamond_plate_floor")
        for z in range(1,6):
            for y in [1,2]:r.barrel(1,y,z,"east");r.barrel(7,y,z,"west")
        r.chest(3,1,1,"south");r.put(4,1,1,"steel_plate");r.chest(5,1,1,"south");r.box((3,2,1),(5,2,1),"riveted_steel")
        r.box((2,1,1),(2,3,1),"steel_plate");r.box((6,1,1),(6,3,1),"steel_plate")
    elif role=="utility":  # Water treatment: a reservoir, filter cauldrons, pumps and switchgear.
        r.box((2,0,1),(6,0,2),"minecraft:water",{"liquid_depth":0});r.box((2,1,3),(6,1,3),"minecraft:iron_bars")
        for z in [2,3,4,5]:r.cauldron(1,1,z)
        for x in [1,7]:r.box((x,4,1),(x,4,7),"pipe")
        r.put(1,4,2,"pipe_junction");r.put(1,4,5,"pipe_junction")
        r.box((7,1,2),(7,2,5),"electrical_cabinet");r.put(7,1,6,"utility_panel")
    elif role=="storage":  # Supply depot: barrel walls and chests.
        for z in range(1,7):
            for y in [1,2,3]:r.barrel(1,y,z,"east");r.barrel(7,y,z,"west")
        for z in [2,4]:r.chest(2,1,z,"east");r.chest(6,1,z,"west")
        for x in [3,4,5]:r.barrel(x,1,1,"south");r.barrel(x,2,1,"south")
        r.lantern(4,5,4,True)
    else:raise ValueError(role)
    return r.check()

def structures():
    templates=[]
    for role in ROOM_ROLES:
        for side in ["north","south"]:templates.append(room(role,side))
    for name in ["hall","hall_west","hall_east","core"]:
        t=Template(name);t.shell()
        t.fill((1,1,1),(7,5,2),"dark_reinforced_concrete");t.fill((1,1,6),(7,5,7),"dark_reinforced_concrete")
        t.fill((3,1,0),(5,3,8),"minecraft:air")
        if name!="hall_west":t.fill((0,1,3),(0,4,5),"minecraft:air")
        if name!="hall_east":t.fill((8,1,3),(8,4,5),"minecraft:air")
        t.fill((2,6,4),(6,6,4),"industrial_light")
        t.fill((0,0,3),(8,0,3),"concrete_warning_stripe")
        t.fill((0,0,5),(8,0,5),"concrete_warning_stripe")
        if name=="core":
            t.fill((1,1,1),(7,5,7),"minecraft:air")
            t.fill((3,0,3),(5,0,5),"elevator_pad")
            t.set(6,2,5,"elevator_panel")
        templates.append(t)
    # Authored entrance, 15 wide x 9 high x 22 deep; its rear core aligns with all floors.
    t=Template("entrance",(15,9,22));t.shell()
    t.fill((0,0,0),(14,8,3),"minecraft:air");t.fill((0,0,0),(14,0,3),"reinforced_concrete")
    for x in [0,1,13,14]:t.fill((x,1,3),(x,7,10),"dark_reinforced_concrete")
    t.fill((0,7,3),(14,8,10),"concrete_panel")
    t.fill((0,1,4),(14,6,4),"concrete_panel")
    t.fill((5,1,4),(9,4,4),"blast_door")
    t.fill((5,1,5),(9,5,12),"minecraft:air")
    t.fill((3,1,13),(11,6,20),"minecraft:air")
    t.fill((6,0,16),(8,0,18),"elevator_pad")
    t.set(9,2,18,"elevator_panel")
    for x in [2,12]:t.set(x,1,1,"laser_turret_mount")
    for z in [8,12,16,20]:t.fill((6,7,z),(8,7,z),"industrial_light")
    templates.append(t)
    catalog=[t.export() for t in templates]
    write(ROOT/"tools/generated/template_voxels.json",catalog)
    write(ROOT/"docs/module_catalog.json",[{"identifier":NS+"bunker/"+t["name"],"size":t["size"]} for t in catalog])

def icon():
    im=Image.new("RGB",(128,128),(17,29,34));d=ImageDraw.Draw(im)
    d.polygon([(4,92),(20,40),(42,19),(61,32),(91,13),(124,57),(124,117),(4,117)],fill=(51,68,70))
    d.rectangle((20,47,108,114),fill=(106,123,119),outline=(149,165,151),width=3)
    d.rectangle((30,58,98,114),fill=(24,40,47));d.rectangle((36,62,62,112),fill=(74,94,103));d.rectangle((66,62,92,112),fill=(74,94,103))
    for y in [70,88,106]:d.line((37,y,91,y),fill=(112,133,132),width=2)
    for x in range(29,102,10):d.polygon([(x,49),(x+4,49),(x+10,56),(x+6,56)],fill=(240,181,51))
    d.rectangle((24,62,27,70),fill=(246,67,38));d.rectangle((101,62,104,70),fill=(246,67,38))
    for pack in [BP,RP]:save(im,pack/"pack_icon.png")

def asset_inventory():
    lines=["# Asset inventory", "", "Original generated assets shipped in 0.1.0. All visual/audio entries still require in-game acceptance.", "",
           "| Identifier | Type | Implementation / use | Texture | Model | Animation | Sound |",
           "|---|---|---|---|---|---|---|"]
    for name in BLOCKS:
        note="Construction palette; available in Creative"
        animation="None"
        if name in INTERACTIVE:note="Shared interaction component; functional at registered positions"
        if name in ["blast_door","security_door","security_shutter"]:note="Generated doors / shutters";animation="Scripted 2-pixel block retraction" if name!="blast_door" else "Split leaves slide apart as an entity; blocks provide collision"
        if name=="emergency_light":note="Registered facility alarm lamps";animation="Flashing state permutation"
        if name=="missile_turret_base":note="Construction block only; missile system deferred"
        lines.append(f"| `{NS}{name}` | Block | {note} | Original 32×32 | Full cube; invisible open-door geometry where needed | {animation} | Vanilla placement; shared interaction sounds |")
    for name in ITEMS:
        lines.append(f"| `{NS}{name}` | Item | {'Creative development tool' if 'device' in name or 'scanner' in name or 'master' in name else 'Clearance card'} | Original 32×32 icon | Item sprite | None | Shared system feedback |")
    lines.extend(["", "## Defence assets", "",
        "| Identifier | Type | Implementation | Texture | Model | Animation | Sound |",
        "|---|---|---|---|---|---|---|",
        "| `secretfacilities:laser_turret` | Entity | Hostile-only laser defence; entrance and command zones | Original 64×64 atlas | Six named bones | Scripted entity rotation and pitch bone; game verification pending | Synthesized firing pulse |",
        "| `secretfacilities:blast_door_leaf` | Entity | Two blast door leaves that part at a central seam and slide sideways into the wall, present only while the entrance door travels | Shared blast door texture | Two bones of block-column cubes | Client-eased slide driven by a synced property | Blast door sounds |",
        "| `secretfacilities:turret_beam` | Particle | Turret shot: one emitter draws a solid glowing beam from muzzle to target | Original 16×16 soft glow, additive, unlit | Dense billboards placed along the shot | 0.32-second fade | Shared firing pulse |",
        "| `secretfacilities:laser_beam` | Particle | Tripwire grids | Original 8×8 white mask, tinted red | Billboard | 0.22-second particle lifetime | None |",
        "| `secretfacilities:laser_impact` | Particle | Hit flash and sparks | Shared soft glow, additive | Billboards with gravity | Up to 0.45 seconds | Shared firing pulse |",
        "| Missile turret / projectile | Planned | Not shipped | Deferred | Deferred | Deferred | Deferred |", "",
        "## Audio", "", "Eleven original mono WAV assets are mapped through `resource_pack/sounds/sound_definitions.json`.", "",
        "`access_granted`, `access_denied`, `alarm_alert`, `alarm_lockdown`, `blast_door_movement`, `blast_door_warning`, `elevator_move`, `elevator_arrive`, `laser_turret_fire`, `warning_beep`, `destruction`.", "",
        "`warning_beep` is available for future countdown polish; the other sound events are wired to the shared systems. No third-party audio is included.", "",
        "## Structures", "", "43 authored/generated binary templates: 19 furnished room roles (bedrooms, bunk rooms, lounges, mess halls, hydroponic farms, mining faces, workshops, labs and more) in north/south connector orientations, four hall/core modules and the surface entrance. Rooms use vanilla furniture with block entity data for bed colours. See `module_catalog.json`. Programmed overlays add doors, readers, controls, grids, shafts, escape route, turrets, the covering mountain and TNT demolition charges.", "",
        "## Other", "", "Both packs include an original 128×128 bunker icon and en_US names. Advanced control models, damaged turret models, directional animated doors, facility-specific palettes and cinematic particles are deferred."])
    (ROOT/"docs").mkdir(exist_ok=True)
    (ROOT/"docs/assets.md").write_text("\n".join(lines)+"\n")

def main():
    write(BP/"manifest.json",{"format_version":2,"header":{"name":"Secret Facilities BP","description":"Procedural command bunker and shared security systems · 0.1.0 alpha","uuid":BP_UUID,"version":VERSION,"min_engine_version":[1,21,90]},
        "modules":[{"type":"data","uuid":"f0641e5f-71aa-4fe1-a0c0-c7e532c9e5b8","version":VERSION},
                   {"type":"script","language":"javascript","uuid":"c577c5f3-e17b-4e46-bdf9-3f6900947862","entry":"scripts/main.js","version":VERSION}],
        "dependencies":[{"uuid":RP_UUID,"version":VERSION},{"module_name":"@minecraft/server","version":"2.0.0"},{"module_name":"@minecraft/server-ui","version":"2.0.0"}]})
    write(RP/"manifest.json",{"format_version":2,"header":{"name":"Secret Facilities RP","description":"Original industrial pixel art, turret model, effects and sounds","uuid":RP_UUID,"version":VERSION,"min_engine_version":[1,21,90]},
        "modules":[{"type":"resources","uuid":"071c689c-24f6-45d4-8aaa-4843be1664cf","version":VERSION}]})
    textures();turret();door_leaf();sounds();structures();icon();asset_inventory()
    print(f"Built {len(BLOCKS)} blocks, {len(ITEMS)} items, {2*len(ROOM_ROLES)+5} structure templates, turret, particles and 11 sounds.")

if __name__=="__main__":main()
