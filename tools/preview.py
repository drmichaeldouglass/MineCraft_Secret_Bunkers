"""Render an honest top-down preview from the assembled test-world block data."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
from build_assets import BLOCKS, ITEMS, ROOT, RP

def font(size):
    for path in ["/System/Library/Fonts/Supplemental/Arial.ttf","/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(path).exists():return ImageFont.truetype(path,size)
    return ImageFont.load_default(size=size)

data=json.loads((ROOT/"docs/generated/bunker-preview.json").read_text());f=data["facility"];blocks=dict(data["blocks"])
im=Image.new("RGB",(1600,1060),(14,24,30));d=ImageDraw.Draw(im)
d.text((60,35),"SECRET FACILITIES",font=font(42),fill=(228,239,222))
d.text((62,92),"COMMAND BUNKER  /  FIRST PLAYABLE ALPHA",font=font(19),fill=(92,211,181))
d.text((62,129),"Actual generated block layout • seed 104729",font=font(18),fill=(152,174,177))
# Approximate map colours for the vanilla furniture, so furnished rooms read at a glance.
VANILLA={"bed":(170,40,40),"chest":(160,110,50),"barrel":(130,95,55),"bookshelf":(120,85,50),"crafting_table":(150,105,60),
    "mangrove_planks":(120,55,45),"mangrove_stairs":(120,55,45),"mangrove_slab":(120,55,45),"farmland":(95,65,40),
    "wheat":(200,180,70),"carrots":(230,130,40),"potatoes":(190,160,80),"beetroot":(160,40,50),"water":(50,90,200),
    "stone":(125,125,125),"andesite":(135,135,130),"tuff":(105,105,95),"iron_ore":(170,140,120),"coal_ore":(60,60,60),
    "sea_lantern":(170,220,210),"white_concrete":(210,215,215),"red_concrete":(160,40,35),"iron_bars":(150,150,150),
    "furnace":(110,110,110),"smoker":(100,90,80),"blast_furnace":(100,100,105),"cauldron":(70,70,75),"rail":(140,120,90)}
scale=20
def plan(level,ox,oz):
    floor=f["floors"][level]["y"]
    d.text((ox,oz-30),f["floors"][level]["name"].upper(),font=font(16),fill=(223,231,217))
    def color(x,z):
        for y in [floor+2,floor+1,floor]:
            b=blocks.get(f"{x},{y},{z}")
            if not b:continue
            if b["typeId"]=="minecraft:air" or b["states"].get("secretfacilities:open"):continue
            short=b["typeId"].split(":")[-1]
            return BLOCKS.get(short,VANILLA.get(short,(117,130,123)))
        return (20,36,42)
    for x in range(27):
        for z in range(27):
            c=color(x,z);d.rectangle((ox+x*scale,oz+z*scale,ox+(x+1)*scale-1,oz+(z+1)*scale-1),fill=c)
    for module in f["modules"]:
        if module["floor"]!=level or module["role"]=="corridor_standard":continue
        x,z=module["pos"]["x"],module["pos"]["z"]
        name="LIFT / LADDER" if module["role"]=="vertical_core" else module["role"].upper()
        width=d.textbbox((0,0),name,font=font(12))[2]
        cx=ox+(x+4.5)*scale;cy=oz+(z+4)*scale
        d.rectangle((cx-width/2-5,cy-3,cx+width/2+5,cy+17),fill=(12,26,32))
        d.text((cx-width/2,cy),name,font=font(12),fill=(221,237,211))
# Living quarters and engineering show off the bedrooms, lounge, farm and mining face.
plan(2,60,230);plan(4,630,230)
sidebar=1220
d.text((sidebar,194),"BUILT INTO THIS PACK",font=font(17),fill=(223,231,217))
for i,line in enumerate(["3–8 underground floors","19 furnished room types","Buried under a mountain","Split sliding blast door","Elevator transfer pads","Emergency ladder","Laser grids + lockdown","Glowing-beam laser turrets","B1 escape tunnel","TNT self-destruct"]):
    d.text((sidebar,238+i*33),line,font=font(16),fill=(162,187,186))
d.text((sidebar,610),"SECURITY CLEARANCE",font=font(17),fill=(223,231,217))
for i,(name,label) in enumerate([(n,l) for n,l in zip(list(ITEMS)[:5],["Staff","Restricted","High security","Command","Creative master"])]):
    icon=Image.open(RP/"textures/items"/f"{name}.png").resize((40,40),Image.Resampling.NEAREST)
    im.paste(icon,(sidebar,644+i*40),icon);d.text((sidebar+47,654+i*40),label,font=font(15),fill=(170,191,187))
d.text((62,883),"ORIGINAL INDUSTRIAL PALETTE",font=font(16),fill=(91,207,178))
for i,name in enumerate(list(BLOCKS)[:20]):
    tex=Image.open(RP/"textures/blocks"/f"{name}.png").resize((48,48),Image.Resampling.NEAREST)
    im.paste(tex,(62+i*54,919),tex)
d.text((62,997),"Layout preview from the test harness, not an in-game screenshot. In-game import and rendering still need verification.",font=font(16),fill=(145,166,169))
im.save(ROOT/"docs/bunker-preview.png")
print("Rendered docs/bunker-preview.png")
