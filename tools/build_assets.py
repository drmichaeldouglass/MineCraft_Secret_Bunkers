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
    for name,color,size in [("laser_beam",[1,0.13,0.09,1],0.055),("laser_impact",[1,0.65,0.2,1],0.15)]:
        write(RP/"particles"/f"{name}.json",{"format_version":"1.10.0","particle_effect":{
            "description":{"identifier":NS+name,"basic_render_parameters":{"material":"particles_alpha","texture":"textures/particle/laser"}},
            "components":{"minecraft:emitter_rate_instant":{"num_particles":1},"minecraft:emitter_lifetime_once":{"active_time":0.1},
                "minecraft:emitter_shape_point":{},"minecraft:particle_lifetime_expression":{"max_lifetime":0.22},
                "minecraft:particle_appearance_billboard":{"size":[size,size],"facing_camera_mode":"lookat_xyz","uv":{"texture_width":8,"texture_height":8,"uv":[0,0],"uv_size":[8,8]}},
                "minecraft:particle_appearance_tinting":{"color":color}}}})
    save(Image.new("RGBA",(8,8),(255,255,255,255)),RP/"textures/particle/laser.png")

# The entrance blast door is 5 wide and 4 tall; the planner test pins that size.
LEAF_WIDTH, LEAF_HEIGHT = 5, 4

def door_leaf():
    """A moving copy of the blast door leaf. The client eases it toward the scripted
    progress every frame, so the slide is smooth instead of stepping with block updates."""
    progress=NS+"progress"
    write(BP/"entities/blast_door_leaf.json",{"format_version":"1.21.90","minecraft:entity":{
        "description":{"identifier":NS+"blast_door_leaf","is_spawnable":False,"is_summonable":True,"is_experimental":False,
            "properties":{progress:{"type":"float","range":[0.0,1.0],"default":0.0,"client_sync":True}}},
        "components":{"minecraft:type_family":{"family":["inanimate","secretfacilities_door"]},
            "minecraft:health":{"value":1,"max":1},"minecraft:collision_box":{"width":0.1,"height":0.1},
            "minecraft:damage_sensor":{"triggers":{"cause":"all","deals_damage":"no"}},
            "minecraft:physics":{"has_gravity":False,"has_collision":False},
            "minecraft:pushable":{"is_pushable":False,"is_pushable_by_piston":False},
            "minecraft:knockback_resistance":{"value":1},"minecraft:body_rotation_blocked":{},"minecraft:fire_immune":{}},
        # Spawning mid-travel starts the client at the right end, so a closing leaf never flashes shut.
        "events":{NS+"from_open":{"set_property":{progress:1.0}}}}})
    # One cube per door block, so the blast door texture tiles exactly like the blocks it covers.
    # 15 px deep: just inside the wall above, which hides the leaf once it has slid up.
    face={"uv":[0,0],"uv_size":[32,32]};edge={"uv":[0,0],"uv_size":[30,32]};cap={"uv":[0,0],"uv_size":[32,30]}
    uv={"north":face,"south":face,"east":edge,"west":edge,"up":cap,"down":cap}
    cubes=[{"origin":[-8*LEAF_WIDTH+16*i,16*j,-7.5],"size":[16,16,15],"uv":uv} for i in range(LEAF_WIDTH) for j in range(LEAF_HEIGHT)]
    write(RP/"models/entity/blast_door_leaf.geo.json",{"format_version":"1.12.0","minecraft:geometry":[{
        "description":{"identifier":"geometry.secretfacilities.blast_door_leaf","texture_width":32,"texture_height":32,
            "visible_bounds_width":LEAF_WIDTH+1,"visible_bounds_height":2*LEAF_HEIGHT+1,"visible_bounds_offset":[0,LEAF_HEIGHT+0.5,0]},
        "bones":[{"name":"leaf","pivot":[0,0,0],"cubes":cubes}]}]})
    # Follow the server at slightly above door speed (one leaf height per 1.6 s); snap on large gaps.
    follow=0.8
    write(RP/"entity/blast_door_leaf.entity.json",{"format_version":"1.10.0","minecraft:client_entity":{
        "description":{"identifier":NS+"blast_door_leaf","materials":{"default":"entity"},
            "textures":{"default":"textures/blocks/blast_door"},"geometry":{"default":"geometry.secretfacilities.blast_door_leaf"},
            "animations":{"slide":"animation.secretfacilities.door_leaf.slide"},
            "scripts":{"initialize":["v.shown = -1;"],
                "pre_animation":[f"t.target = q.property('{progress}');",
                    f"v.shown = (v.shown < 0 || math.abs(t.target - v.shown) > 0.25) ? t.target : v.shown + math.clamp(t.target - v.shown, -{follow} * q.delta_time, {follow} * q.delta_time);"],
                "animate":["slide"]},
            "render_controllers":["controller.render.secretfacilities.door_leaf"]}}})
    write(RP/"render_controllers/door_leaf.json",{"format_version":"1.8.0","render_controllers":{
        "controller.render.secretfacilities.door_leaf":{"geometry":"Geometry.default","materials":[{"*":"Material.default"}],"textures":["Texture.default"]}}})
    write(RP/"animations/door_leaf.animation.json",{"format_version":"1.8.0","animations":{
        "animation.secretfacilities.door_leaf.slide":{"loop":True,"bones":{"leaf":{"position":[0,f"v.shown * {16*LEAF_HEIGHT}",0]}}}}})

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

class Template:
    def __init__(self,name,size=(9,7,9)):
        self.name,self.size=name,size;self.blocks={}
        self.fill((0,0,0),tuple(n-1 for n in size),"minecraft:air")
    def set(self,x,y,z,block,states=None):
        if not (0<=x<self.size[0] and 0<=y<self.size[1] and 0<=z<self.size[2]):raise ValueError((self.name,x,y,z))
        # Palette entries carry every state, as game-saved structures do.
        if states is None and block in ["blast_door","security_door","security_shutter"]:states={NS+"open":False,NS+"slide":0}
        if states is None and block=="emergency_light":states={NS+"active":False}
        if states is None and block.endswith("_slab"):states={"minecraft:vertical_half":"bottom"}
        self.blocks[x,y,z]=(block if ":" in block else NS+block,tuple(sorted((states or {}).items())))
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
              "palette":(10,{"default":(10,{"block_palette":(9,(10,pals)),"block_position_data":(10,{})})})})}
        path=BP/"structures/secretfacilities/bunker"/f"{self.name}.mcstructure";path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(b"\x0a\x00\x00"+nbt_payload(10,root))
        return {"name":self.name,"size":list(self.size),"palette":[[n,dict(s)] for n,s in palette],"indices":indices}

def room(role,side):
    t=Template(f"{role}_{side}");t.shell()
    z=8 if side=="north" else 0
    far=1 if side=="north" else 7
    t.fill((3,1,z),(5,3,z),"minecraft:air")
    # A 3-wide unbroken aisle always leads from the connector to the far wall.
    for x in [2,6]:t.set(x,6,4,"industrial_light")
    t.fill((1,1,1),(1,4,7),"concrete_panel")
    t.fill((7,1,1),(7,4,7),"concrete_panel")
    if role in ["server","archive","vault","utility"]:
        for x in [2,6]:
            for zz in [2,5]:t.fill((x,1,zz),(x,3,zz+1),"server_rack" if role=="server" else "steel_plate" if role=="vault" else "electrical_cabinet")
    elif role in ["command","office","security","briefing"]:
        for x in [2,6]:
            for zz in [2,5]:
                t.set(x,1,zz,"steel_plate");t.set(x,2,zz,"control_cabinet");t.set(x,1,zz+1,"minecraft:polished_blackstone_brick_slab")
        t.fill((2,3,far),(6,4,far),"facility_status_display")
    elif role in ["generator","workshop"]:
        for x in [2,6]:
            t.fill((x,1,2),(x,2,6),"generator_panel");t.fill((x,4,1),(x,4,7),"pipe")
        t.fill((2,0,1),(2,0,7),"concrete_warning_stripe")
    elif role in ["laboratory","medical"]:
        for x in [2,6]:
            t.fill((x,1,2),(x,1,6),"light_reinforced_concrete")
            t.set(x,2,3,"security_glass");t.set(x,2,5,"utility_panel")
    elif role=="barracks":
        for x in [2,6]:
            for zz in [1,4,6]:
                t.fill((x,1,zz),(x,1,zz+1),"minecraft:gray_wool");t.set(x,1,zz,"minecraft:white_wool")
    elif role=="canteen":
        for x in [2,6]:
            t.fill((x,1,2),(x,1,6),"steel_plate")
        t.fill((2,1,far),(6,1,far),"light_reinforced_concrete")
    return t

def structures():
    templates=[]
    for role in ["office","briefing","security","archive","barracks","medical","canteen","command","server","generator","workshop","utility","vault","laboratory"]:
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
        if name in ["blast_door","security_door","security_shutter"]:note="Generated doors / shutters";animation="Scripted 2-pixel block retraction" if name!="blast_door" else "Smooth moving leaf entity; blocks provide collision"
        if name=="emergency_light":note="Registered facility alarm lamps";animation="Flashing state permutation"
        if name=="missile_turret_base":note="Construction block only; missile system deferred"
        lines.append(f"| `{NS}{name}` | Block | {note} | Original 32×32 | Full cube; invisible open-door geometry where needed | {animation} | Vanilla placement; shared interaction sounds |")
    for name in ITEMS:
        lines.append(f"| `{NS}{name}` | Item | {'Creative development tool' if 'device' in name or 'scanner' in name or 'master' in name else 'Clearance card'} | Original 32×32 icon | Item sprite | None | Shared system feedback |")
    lines.extend(["", "## Defence assets", "",
        "| Identifier | Type | Implementation | Texture | Model | Animation | Sound |",
        "|---|---|---|---|---|---|---|",
        "| `secretfacilities:laser_turret` | Entity | Hostile-only laser defence; entrance and command zones | Original 64×64 atlas | Six named bones | Scripted entity rotation and pitch bone; game verification pending | Synthesized firing pulse |",
        "| `secretfacilities:blast_door_leaf` | Entity | Moving blast door leaf, present only while the entrance door travels | Shared blast door texture | 20 block-sized cubes | Client-eased slide driven by a synced property | Blast door sounds |",
        "| `secretfacilities:laser_beam` | Particle | Tripwires and turret shots | Original 8×8 white mask, tinted red | Billboard | 0.22-second particle lifetime | None |",
        "| `secretfacilities:laser_impact` | Particle | Hit marker | Shared white mask, tinted amber | Billboard | 0.22-second particle lifetime | Shared firing pulse |",
        "| Missile turret / projectile | Planned | Not shipped | Deferred | Deferred | Deferred | Deferred |", "",
        "## Audio", "", "Eleven original mono WAV assets are mapped through `resource_pack/sounds/sound_definitions.json`.", "",
        "`access_granted`, `access_denied`, `alarm_alert`, `alarm_lockdown`, `blast_door_movement`, `blast_door_warning`, `elevator_move`, `elevator_arrive`, `laser_turret_fire`, `warning_beep`, `destruction`.", "",
        "`warning_beep` is available for future countdown polish; the other sound events are wired to the shared systems. No third-party audio is included.", "",
        "## Structures", "", "33 authored/generated binary templates: 14 room roles in north/south connector orientations, four hall/core modules and the surface entrance. See `module_catalog.json`. Programmed overlays add doors, readers, controls, grids, shafts, escape route and turrets.", "",
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
    print(f"Built {len(BLOCKS)} blocks, {len(ITEMS)} items, 33 structure templates, turret, particles and 11 sounds.")

if __name__=="__main__":main()
