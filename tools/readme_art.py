"""Render the README illustrations from the add-on's own block data, textures, models and menu text.

Run after `npm test` (which writes docs/generated/bunker-preview.json). Writes docs/readme/*.png.
The menus are drawn from the strings in src/runtime/menus.ts; none of these are in-game screenshots.
"""
from pathlib import Path
import json, math
from PIL import Image, ImageDraw, ImageFont
from build_assets import BLOCKS, ROOT, RP

OUT = ROOT/"docs/readme"
BG = (14, 24, 30)
INK = (228, 239, 222)
MUTED = (152, 174, 177)
ACCENT = (92, 211, 181)

def font(size, bold=False):
    paths = (["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if bold
             else ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"])
    for path in paths:
        if Path(path).exists(): return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)

def shade(c, k): return tuple(max(0, min(255, int(v*k))) for v in c[:3])

def label(d, cx, cy, text, size=13, fill=(221, 237, 211), box=(12, 26, 32)):
    w = d.textbbox((0, 0), text, font=font(size))[2]
    d.rectangle((cx-w/2-5, cy-size*0.75, cx+w/2+5, cy+size*0.75), fill=box)
    d.text((cx-w/2, cy-size*0.62), text, font=font(size), fill=fill)

def wrap(d, text, width, f):
    lines = []
    for para in text.split("\n"):
        line = ""
        for word in para.split(" "):
            test = (line+" "+word).strip()
            if d.textbbox((0, 0), test, font=f)[2] > width and line: lines.append(line); line = word
            else: line = test
        lines.append(line)
    return lines

def texture(path, size):
    return Image.open(path).convert("RGBA").resize((size, size), Image.Resampling.NEAREST)

# Approximate map colours for vanilla blocks.
VANILLA = {"bed": (170, 40, 40), "chest": (160, 110, 50), "barrel": (130, 95, 55), "bookshelf": (120, 85, 50),
    "crafting_table": (150, 105, 60), "mangrove_planks": (120, 55, 45), "mangrove_stairs": (120, 55, 45),
    "mangrove_slab": (120, 55, 45), "mangrove_fence": (110, 50, 40), "farmland": (95, 65, 40), "wheat": (200, 180, 70),
    "carrots": (230, 130, 40), "potatoes": (190, 160, 80), "beetroot": (160, 40, 50), "water": (50, 90, 200),
    "stone": (118, 118, 118), "andesite": (135, 135, 130), "tuff": (105, 105, 95), "iron_ore": (170, 140, 120),
    "coal_ore": (60, 60, 60), "copper_ore": (170, 120, 90), "gold_ore": (200, 175, 80), "redstone_ore": (150, 60, 60),
    "lapis_ore": (60, 80, 160), "deepslate_diamond_ore": (90, 170, 170), "sea_lantern": (170, 220, 210),
    "white_concrete": (210, 215, 215), "red_concrete": (160, 40, 35), "black_concrete": (30, 30, 34),
    "iron_bars": (150, 150, 150), "furnace": (110, 110, 110), "smoker": (100, 90, 80), "blast_furnace": (100, 100, 105),
    "cauldron": (70, 70, 75), "rail": (140, 120, 90), "dirt": (121, 85, 58), "coarse_dirt": (110, 80, 58),
    "grass_block": (98, 150, 66), "snow": (236, 242, 245), "cobblestone": (112, 112, 112), "tnt": (205, 60, 40),
    "ladder": (150, 110, 60), "lantern": (240, 190, 90), "red_carpet": (160, 40, 35), "blue_carpet": (55, 70, 160),
    "lectern": (150, 110, 60), "noteblock": (110, 75, 50), "jukebox": (110, 75, 50), "cake": (235, 225, 215),
    "polished_blackstone_brick_slab": (50, 45, 52), "polished_blackstone_stairs": (50, 45, 52),
    "cartography_table": (120, 100, 75), "armor_stand": (150, 120, 80), "glass_pane": (170, 205, 215),
    "spruce_planks": (115, 85, 52), "spruce_log": (72, 52, 32), "spruce_door": (110, 80, 48), "composter": (120, 85, 50),
    "brewing_stand": (120, 110, 90), "enchanting_table": (90, 40, 60), "anvil": (70, 70, 75), "smithing_table": (60, 55, 60),
    "stonecutter": (120, 120, 120), "fletching_table": (170, 150, 100), "grindstone": (130, 130, 130), "hopper": (70, 70, 75)}

def colour(type_id):
    short = type_id.split(":")[-1]
    return BLOCKS.get(short, VANILLA.get(short, (117, 130, 123)))

data = json.loads((ROOT/"docs/generated/bunker-preview.json").read_text())
facility = data["facility"]
blocks = {tuple(map(int, k.split(","))): v for k, v in data["blocks"]}

def solid(pos):
    b = blocks.get(pos)
    if not b or b["typeId"] == "minecraft:air" or b["states"].get("secretfacilities:open"): return None
    return b["typeId"]

# ---------------------------------------------------------------- 1. Cross-section of the whole bunker
def cross_section():
    cell = 9
    zs = range(-12, 55); ys = range(35, 108)
    W, H = len(zs)*cell, len(ys)*cell
    left, top = 60, 120
    im = Image.new("RGB", (left+W+330, top+H+100), BG); d = ImageDraw.Draw(im)
    d.text((left, 30), "SECRET FACILITIES  /  COMMAND BUNKER CROSS-SECTION", font=font(30), fill=INK)
    d.text((left+2, 74), "Sliced north to south through the entrance, the lift core and the escape tunnel (seed 104729, five floors).",
           font=font(16), fill=MUTED)
    ground = {}
    for z in zs:
        col = [y for y in ys if solid((13, y, z)) and colour(solid((13, y, z))) in [(98, 150, 66), (236, 242, 245)]]
        ground[z] = max(col) if col else None
    for i, z in enumerate(zs):
        for j, y in enumerate(reversed(ys)):
            px, py = left+i*cell, top+j*cell
            t = solid((13, y, z))
            if t:
                c = colour(t)
                if t.endswith(":stone"): c = (92, 94, 96)
                if t.endswith(":dirt"): c = (104, 76, 54)
            else:
                # Look past the cut into the bunker, darkening with depth, so rooms read as hollow.
                c = None
                for depth in range(1, 9):
                    t2 = solid((13+depth, y, z))
                    if t2: c = shade(colour(t2), 0.72-depth*0.06); break
                if c is None:
                    inside = (13, y, z) in blocks
                    # Cells outside the recorded volume are untouched ground below the pad and sky above it.
                    c = (24, 38, 46) if inside and y < 81 else (52, 50, 46) if y <= 80 else (32, 52, 66)
            d.rectangle((px, py, px+cell-1, py+cell-1), fill=c)
    def at(z, y): return left+(z-zs[0])*cell, top+(ys[-1]-y)*cell
    # Floor labels on the right.
    rx = left+W+24
    for floor in facility["floors"]:
        _, py = at(0, floor["y"]+2)
        d.line((left+W, py, rx-6, py), fill=(70, 96, 104))
        d.text((rx, py-10), floor["name"], font=font(15), fill=INK)
    d.text((rx, top+H+2), "B6 to B8 follow below", font=font(13), fill=MUTED)
    d.text((rx, top+H+20), "when you choose more floors", font=font(13), fill=MUTED)
    # Feature callouts.
    def callout(z, y, text, dx, dy):
        x0, y0 = at(z, y); x0 += cell/2; y0 += cell/2
        d.line((x0, y0, x0+dx, y0+dy), fill=(240, 220, 140), width=2)
        d.ellipse((x0-3, y0-3, x0+3, y0+3), fill=(240, 220, 140))
        label(d, x0+dx, y0+dy, text, 13, fill=(20, 26, 30), box=(240, 220, 140))
    callout(0, 82, "Blast door", -40, -70)
    callout(-8, 81, "Approach cut", -10, -120)
    callout(13, 100, "Mountain raised over the site", 60, -62)
    callout(13, 64, "Lift core: one pad per floor", 140, 30)
    callout(30, 73, "Secret escape tunnel", 30, -60)
    callout(50, 81, "Remote exit (utility shed)", -40, -90)
    callout(4, 66, "Furnished rooms", -10, 96)
    d.text((left, top+H+48), "Rendered from the block data assembled by the test harness, not an in-game screenshot. "
           "North is on the left; the view looks east.", font=font(14), fill=MUTED)
    im.save(OUT/"cross-section.png")

# ---------------------------------------------------------------- 2. Isometric cutaway of one floor
def iso_floor(level, title, path):
    floor = facility["floors"][level]["y"]
    cell = 17
    vox = {}
    for x in range(-1, 28):
        for z in range(-1, 28):
            for y in range(floor, floor+3):
                t = solid((x, y, z))
                if not t: continue
                short = t.split(":")[-1]
                if short in ("stone", "dirt", "tnt") or short.endswith("_ore") and (x < 0 or z < 0 or x > 26 or z > 26): continue
                vox[x, y-floor, z] = colour(t)
    W = 27*cell*2+160
    im = Image.new("RGB", (W+300, 27*cell+3*cell+230), BG); d = ImageDraw.Draw(im)
    ox, oy = 80+27*cell, 160
    def proj(x, y, z): return ox+(x-z)*cell, oy+(x+z)*cell//2-y*cell
    for (x, y, z), c in sorted(vox.items(), key=lambda v: (v[0][0]+v[0][2], v[0][1], v[0][0])):
        px, py = proj(x, y, z)
        d.polygon([(px, py), (px+cell, py+cell//2), (px, py+cell), (px-cell, py+cell//2)], fill=shade(c, 1.08))
        d.polygon([(px-cell, py+cell//2), (px, py+cell), (px, py+2*cell), (px-cell, py+cell+cell//2)], fill=shade(c, 0.8))
        d.polygon([(px, py+cell), (px+cell, py+cell//2), (px+cell, py+cell+cell//2), (px, py+2*cell)], fill=shade(c, 0.62))
    for m in facility["modules"]:
        if m["floor"] != level or m["role"] == "corridor_standard": continue
        name = "LIFT / CONSOLES" if m["role"] == "vertical_core" else m["role"].upper()
        px, py = proj(m["pos"]["x"]+4.5, 3.5, m["pos"]["z"]+4.5)
        label(d, px, py, name, 13)
    d.text((40, 30), title, font=font(30), fill=INK)
    d.text((42, 74), "One floor cut away at waist height (seed 104729). Rooms open off two halls crossed by laser grids.",
           font=font(16), fill=MUTED)
    sx = W+20
    d.text((sx, 150), "IN THIS VIEW", font=font(16), fill=ACCENT)
    notes = ["Real beds you can sleep in", "Hydroponic farm with crops", "Mess hall, lounge, barrack",
             "Security doors with readers", "Laser grid in each hall", "Lift pad, consoles and the", "emergency ladder in the core"]
    for i, n in enumerate(notes): d.text((sx, 182+i*26), n, font=font(15), fill=(170, 191, 187))
    d.text((40, im.height-40), "Rendered from the test harness block data, not an in-game screenshot.", font=font(14), fill=MUTED)
    im.save(path)

# ---------------------------------------------------------------- 3. The development kit
KIT = [("facility_deployment_device", "Deployment Device", "Builds a bunker or estate. Creative only."),
       ("facility_debug_scanner", "Debug Scanner", "Facility info and test controls. Creative only."),
       ("keycard_green", "Green Keycard", "Level 1: entrance, B1, tunnel door"),
       ("keycard_blue", "Blue Keycard", "Level 2: B2"),
       ("keycard_red", "Red Keycard", "Level 3: B3, local defence console"),
       ("keycard_black", "Black Keycard", "Level 4: everything, incl. self-destruct"),
       ("keycard_master", "Master Keycard", "Level 5: all checks, Creative only"),
       ("laser_turret_spawn_egg", "Laser Turret Egg", "Place a laser turret anywhere"),
       ("missile_turret_spawn_egg", "Missile Turret Egg", "Place a missile turret anywhere")]

def kit():
    cols, cw, ch = 3, 430, 118
    im = Image.new("RGB", (60+cols*cw, 150+3*ch+50), BG); d = ImageDraw.Draw(im)
    d.text((40, 30), "THE DEVELOPMENT KIT", font=font(30), fill=INK)
    d.text((42, 74), "/scriptevent secretfacilities:kit  gives you all nine items. Your highest card anywhere in your inventory counts.",
           font=font(16), fill=MUTED)
    for i, (name, title, text) in enumerate(KIT):
        x, y = 40+(i % cols)*cw, 130+(i//cols)*ch
        d.rounded_rectangle((x, y, x+cw-20, y+ch-18), 10, fill=(22, 36, 44), outline=(44, 66, 74))
        icon = texture(RP/"textures/items"/f"{name}.png", 64)
        im.paste(icon, (x+16, y+18), icon)
        d.text((x+96, y+20), title, font=font(18, True), fill=INK)
        for k, line in enumerate(wrap(d, text, cw-140, font(14))): d.text((x+96, y+50+k*20), line, font=font(14), fill=(170, 191, 187))
    d.text((40, im.height-40), "Item icons are the add-on's own 32 × 32 textures.", font=font(14), fill=MUTED)
    im.save(OUT/"kit.png")

# ---------------------------------------------------------------- 4 & 5. Menu walkthroughs (drawn from menus.ts strings)
PANEL, BUTTON, BTN_EDGE = (49, 50, 54), (88, 89, 94), (30, 30, 33)

def form(im, x, y, w, title, body, buttons=(), fields=(), step=None, caption=None):
    d = ImageDraw.Draw(im)
    lines = wrap(d, body, w-40, font(14)) if body else []
    h = 64+len(lines)*20+sum(36 if f[0] == "toggle" else 58 for f in fields)+len(buttons)*50+20
    d.rectangle((x+6, y+6, x+w+6, y+h+6), fill=(6, 10, 12))
    d.rectangle((x, y, x+w, y+h), fill=PANEL, outline=(20, 20, 22), width=3)
    d.rectangle((x+3, y+3, x+w-3, y+44), fill=(66, 67, 72))
    tw = d.textbbox((0, 0), title, font=font(17, True))[2]
    d.text((x+w/2-tw/2, y+13), title, font=font(17, True), fill=(240, 240, 240))
    cy = y+60
    for line in lines: d.text((x+20, cy), line, font=font(14), fill=(225, 225, 225)); cy += 20
    for kind, name, value in fields:
        d.text((x+20, cy), name, font=font(14), fill=(225, 225, 225))
        if kind == "toggle":
            d.rounded_rectangle((x+w-80, cy-2, x+w-24, cy+22), 11, fill=(60, 133, 39))
            d.ellipse((x+w-46, cy, x+w-26, cy+20), fill=(240, 240, 240))
            cy -= 22
        else:
            d.rectangle((x+20, cy+22, x+w-20, cy+48), fill=(30, 30, 33), outline=(15, 15, 17))
            d.text((x+30, cy+27), value, font=font(14), fill=(200, 200, 200) if kind == "drop" else (130, 130, 130))
            if kind == "drop": d.polygon([(x+w-40, cy+31), (x+w-28, cy+31), (x+w-34, cy+39)], fill=(220, 220, 220))
        cy += 58
    for b in buttons:
        hi = b.startswith("*"); b = b.lstrip("*")
        d.rectangle((x+20, cy, x+w-20, cy+40), fill=(60, 133, 39) if hi else BUTTON, outline=BTN_EDGE, width=2)
        d.line((x+22, cy+38, x+w-22, cy+38), fill=shade((60, 133, 39) if hi else BUTTON, 0.6), width=3)
        bl = b.split("\n")
        for k, part in enumerate(bl):
            f = font(15 if k == 0 else 12)
            bw = d.textbbox((0, 0), part, font=f)[2]
            d.text((x+w/2-bw/2, cy+(12 if len(bl) == 1 else 4+k*18)), part, font=f, fill=(245, 245, 245) if k == 0 else (200, 200, 200))
        cy += 50
    if step:
        d.ellipse((x-18, y-18, x+18, y+18), fill=ACCENT)
        sw = d.textbbox((0, 0), str(step), font=font(20, True))[2]
        d.text((x-sw/2, y-13), str(step), font=font(20, True), fill=BG)
    if caption:
        for k, line in enumerate(wrap(d, caption, w, font(15))): d.text((x, y+h+22+k*21), line, font=font(15), fill=(190, 208, 204))
    return h

def deploy_flow():
    im = Image.new("RGB", (1500, 720), BG); d = ImageDraw.Draw(im)
    d.text((40, 30), "DEPLOYING A BUNKER", font=font(30), fill=INK)
    d.text((42, 74), "Use the Facility Deployment Device in Creative mode. Three screens take you from open ground to a build.",
           font=font(16), fill=MUTED)
    form(im, 50, 140, 420, "SECRET FACILITIES",
         "Command bunker and fortified estate • 0.2.2 alpha\n\nDeploy on dry land. A facility replaces blocks across its site. Use a test world or a backup.",
         ["*Deploy command bunker", "Deploy fortified estate", "Get development kit"], step=1,
         caption="Pick what to build. The kit button gives you the keycards, scanner and turret eggs. A Resume button appears if a build was interrupted.")
    form(im, 540, 140, 420, "BUNKER CONFIGURATION", "",
         fields=[("drop", "Underground floors", "5 • command"), ("toggle", "Include automated laser defences", ""),
                 ("drop", "Secret escape tunnel exit", "Automatic • suits the terrain"),
                 ("text", "Layout seed (optional integer)", "e.g. 104729")],
         buttons=["*Submit"], step=2,
         caption="Choose 3 to 8 floors, whether turrets are installed, where the escape tunnel comes up, and an optional seed to repeat a layout.")
    form(im, 1030, 140, 420, "CONFIRM DEPLOYMENT",
         "5 underground floors • seed 104729\n\nEntrance: 13, 81, 0\nReserved: 51 × 67 blocks\nLowest floor: Y 35\n"
         "Escape tunnel: utility shed 50 blocks south\n\nUneven ground is levelled: cut up to 3 and filled up to 2 blocks.\n\n"
         "Construction levels the site, replaces blocks inside the modules, entrance and escape route, and raises a mountain over it all. Stay nearby while it builds.",
         ["Cancel", "*Build bunker"], step=3,
         caption="Check the surveyed site, then build. Stay close until “Bunker ready” appears. The entrance faces north.")
    d.text((40, im.height-40), "Illustration of the add-on's menus using their actual wording (coordinates are an example). Not an in-game screenshot.",
           font=font(14), fill=MUTED)
    im.save(OUT/"deploy-menus.png")

def control_menus():
    im = Image.new("RGB", (1500, 710), BG); d = ImageDraw.Draw(im)
    d.text((40, 30), "INSIDE THE BUNKER", font=font(30), fill=INK)
    d.text((42, 74), "Interact with a panel or console to open its menu. Each needs the right keycard somewhere in your inventory.",
           font=font(16), fill=MUTED)
    blocks_shown = [("elevator_panel", "Elevator panel"), ("security_console", "Security console"),
                    ("turret_control_console", "Turret control console"), ("self_destruct_console", "Self-destruct console")]
    xs = [40, 400, 760, 1120]
    for x, (tex, name) in zip(xs, blocks_shown):
        icon = texture(RP/"textures/blocks"/f"{tex}.png", 48); im.paste(icon, (x, 120), icon)
        d.text((x+60, 134), name, font=font(17, True), fill=INK)
    form(im, 40, 190, 340, "FACILITY ELEVATOR", "Current: B1 • Administration & Security\nStand on the cyan pad.",
         ["Surface • Main entrance\nLevel 1 clearance", "B1 • Administration & Security\nLevel 1 clearance",
          "B2 • Living Quarters\nLevel 2 clearance", "B3 • Command\nLevel 3 clearance", "B4 • Engineering & Mining\nLevel 4 clearance"],
         caption="Stand on the cyan pad, then pick a floor. Each floor needs its clearance; only a black card works in lockdown.")
    form(im, 400, 190, 340, "FACILITY SECURITY", "State: NORMAL\nLasers: enabled",
         ["Normal / reset alarm", "Alert", "Lockdown", "Disable laser grids"],
         caption="Black card. Raise or clear the alarm, and switch the hall laser grids on or off.")
    form(im, 760, 190, 340, "SET DEFENCE MODE", "Turrets target hostile mobs only. Offline disables targeting and firing.",
         ["*ACTIVE", "OFFLINE", "STANDBY", "ALERT ONLY", "LOCKDOWN ONLY"],
         caption="Red card for this console's zone, black card for every zone (entrance, command, tunnel).")
    form(im, 1120, 190, 340, "AUTHORIZE DESTRUCTION",
         "Start a 90-second countdown?\n\nDoors open for evacuation. Turrets shut down for the final 10 seconds. At zero the charges fire floor by floor from the deepest level up.",
         ["Disarm", "*Start countdown"],
         caption="On B3. Black card, two confirmations. Use the same console to abort until 10 seconds remain.")
    d.text((40, im.height-40), "Illustration of the add-on's menus using their actual wording. Block icons are the add-on's textures. Not an in-game screenshot.",
           font=font(14), fill=MUTED)
    im.save(OUT/"control-menus.png")

# ---------------------------------------------------------------- 6. Alarm states
def alarm_states():
    states = [("NORMAL", (70, 170, 110), ["Shutters raised", "Doors open at readers", "Only ACTIVE turrets fire"]),
              ("ALERT", (230, 170, 50), ["Sirens sound", "Emergency lights flash", "Security doors close", "ALERT ONLY turrets join in"]),
              ("LOCKDOWN", (225, 80, 60), ["Shutters drop", "Lift needs a black card", "Doors need a black card",
                                          "LOCKDOWN ONLY turrets join in"]),
              ("SELF-DESTRUCT", (170, 60, 200), ["90 s countdown", "Doors open to evacuate", "Floors blow deepest first",
                                                 "Escape by ladder or tunnel"])]
    im = Image.new("RGB", (1500, 520), BG); d = ImageDraw.Draw(im)
    d.text((40, 30), "ALARM STATES", font=font(30), fill=INK)
    d.text((42, 74), "The whole facility shares one state. Laser grids and the security console raise it; a security console resets it to NORMAL.",
           font=font(16), fill=MUTED)
    w, gap = 315, 47
    for i, (name, c, notes) in enumerate(states):
        x = 40+i*(w+gap)
        d.rounded_rectangle((x, 130, x+w, 430), 12, fill=(22, 36, 44), outline=c, width=3)
        d.rounded_rectangle((x, 130, x+w, 185), 12, fill=c); d.rectangle((x, 170, x+w, 185), fill=c)
        tw = d.textbbox((0, 0), name, font=font(22, True))[2]
        d.text((x+w/2-tw/2, 144), name, font=font(22, True), fill=(16, 20, 24))
        for k, n in enumerate(notes):
            d.ellipse((x+22, 214+k*44, x+32, 224+k*44), fill=c)
            d.text((x+44, 209+k*44), n, font=font(16), fill=(205, 220, 216))
        if i < 3:
            ax = x+w+6; d.polygon([(ax, 270), (ax+34, 280), (ax, 290)], fill=(120, 140, 146))
    trig = ["Laser grid or console", "West grid (B3 down) or console", "Armed on B3, any state"]
    for i, t in enumerate(trig):
        x = 40+(i+1)*(w+gap)-gap//2
        tw = d.textbbox((0, 0), t, font=font(13))[2]
        d.text((x-tw/2, 440), t, font=font(13), fill=MUTED)
    d.text((40, im.height-40), "Live laser beams also burn hostile mobs: 3 damage every quarter second. They never hurt players, pets or villagers.",
           font=font(14), fill=MUTED)
    im.save(OUT/"alarm-states.png")

# ---------------------------------------------------------------- 7. Turret models
def box_faces(o, s, uv):
    """Bedrock box-UV faces as (corners in model space, texture rect, normal)."""
    (x0, y0, z0), (w, h, dp) = o, s
    x1, y1, z1 = x0+w, y0+h, z0+dp
    u, v = uv
    return [
        # north (-z): left-top is x1 (model x is mirrored), so walk x from x1 to x0
        ([(x1, y1, z0), (x0, y1, z0), (x0, y0, z0), (x1, y0, z0)], (u+dp, v+dp, w, h), (0, 0, -1)),
        ([(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], (u+2*dp+w, v+dp, w, h), (0, 0, 1)),
        ([(x1, y1, z1), (x1, y1, z0), (x1, y0, z0), (x1, y0, z1)], (u, v+dp, dp, h), (1, 0, 0)),
        ([(x0, y1, z0), (x0, y1, z1), (x0, y0, z1), (x0, y0, z0)], (u+dp+w, v+dp, dp, h), (-1, 0, 0)),
        ([(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], (u+dp, v, w, dp), (0, 1, 0)),
    ]

def render_model(name, tex_path, yaw=-35, pitch=28, scale=13, size=(420, 380)):
    geo = json.loads((RP/f"models/entity/{name}.geo.json").read_text())["minecraft:geometry"][0]
    tex = Image.open(tex_path).convert("RGBA")
    a, b = math.radians(yaw), math.radians(pitch)
    def rot(p):
        x, y, z = p
        x, z = x*math.cos(a)-z*math.sin(a), x*math.sin(a)+z*math.cos(a)
        y, z = y*math.cos(b)+z*math.sin(b), -y*math.sin(b)+z*math.cos(b)
        return x, y, z
    light = (0.45, 0.8, -0.4)
    quads = []
    for bone in geo["bones"]:
        for cube in bone.get("cubes", []):
            if not isinstance(cube["uv"], list): continue
            for corners, (u, v, tw, th), n in box_faces(cube["origin"], cube["size"], cube["uv"]):
                rn = rot(n)
                if rn[2] > 0.01: continue  # facing away
                k = 0.55+0.5*max(0, sum(p*q for p, q in zip(n, light)))
                nu, nv = max(1, int(round(tw))), max(1, int(round(th)))
                for i in range(nu):
                    for j in range(nv):
                        def pt(s, t):
                            return tuple(corners[0][q]+(corners[1][q]-corners[0][q])*s+(corners[3][q]-corners[0][q])*t for q in range(3))
                        pts = [pt(i/nu, j/nv), pt((i+1)/nu, j/nv), pt((i+1)/nu, (j+1)/nv), pt(i/nu, (j+1)/nv)]
                        tx = min(tex.width-1, int(u+(i+0.5)*tw/nu)); ty = min(tex.height-1, int(v+(j+0.5)*th/nv))
                        col = tex.getpixel((tx, ty))
                        if col[3] < 10: continue
                        rp = [rot(p) for p in pts]
                        depth = sum(p[2] for p in rp)/4
                        quads.append((depth, [(size[0]/2+p[0]*scale, size[1]*0.78-p[1]*scale) for p in rp], shade(col, k)))
    im = Image.new("RGBA", size, (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for _, pts, col in sorted(quads, key=lambda q: -q[0]): d.polygon(pts, fill=col, outline=col)
    return im

def turrets():
    im = Image.new("RGB", (1500, 640), BG); d = ImageDraw.Draw(im)
    d.text((40, 30), "TURRETS", font=font(30), fill=INK)
    d.text((42, 74), "Generated bunkers install laser turrets at the entrance, command deck and tunnel. Spawn eggs place either kind anywhere.",
           font=font(16), fill=MUTED)
    rows = [("laser_turret", "LASER TURRET", ["Range up to 24 blocks (28 at a bunker entrance)", "1 second reload, 5 damage per shot",
             "Solid glowing red beam", "80 health"]),
            ("missile_turret", "MISSILE TURRET", ["Range 10 to 40 blocks", "3 second reload",
             "Up to 14 damage in a 3.5 block blast", "Breaks no blocks, 120 health"])]
    for i, (name, title, notes) in enumerate(rows):
        x = 40+i*730
        d.rounded_rectangle((x, 120, x+700, 560), 12, fill=(22, 36, 44), outline=(44, 66, 74))
        model = render_model(name, RP/f"textures/entities/{name}.png")
        im.paste(model, (x+10, 150), model)
        d.text((x+430, 160), title, font=font(22, True), fill=INK)
        egg = texture(RP/f"textures/items/{name}_spawn_egg.png", 48); im.paste(egg, (x+430, 200), egg)
        d.text((x+488, 214), "Spawn egg", font=font(14), fill=MUTED)
        for k, line in enumerate(sum((wrap(d, n, 240, font(15)) for n in notes), [])):
            d.text((x+430, 272+k*26), line, font=font(15), fill=(190, 208, 204))
    d.text((40, 578), "Both target hostile mobs only and never players, pets, villagers or animals. Walls block their shots.",
           font=font(15), fill=(190, 208, 204))
    d.text((40, im.height-34), "Models rendered from the add-on's geometry and textures, not in-game screenshots.", font=font(14), fill=MUTED)
    im.save(OUT/"turrets.png")

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    cross_section()
    iso_floor(2, "A FLOOR FROM ABOVE  /  B2 LIVING QUARTERS", OUT/"floor-cutaway.png")
    kit(); deploy_flow(); control_menus(); alarm_states(); turrets()
    print("Rendered", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))
