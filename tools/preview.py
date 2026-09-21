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
d.text((62,129),"Actual generated block layout • B1 Administration & Security • seed 104729",font=font(18),fill=(152,174,177))
scale=17;ox,oz=60,190;floor=f["floors"][1]["y"]
def color(x,z):
    for y in [floor+2,floor+1,floor]:
        b=blocks.get(f"{x},{y},{z}")
        if not b:continue
        if b["typeId"]=="minecraft:air" or b["states"].get("secretfacilities:open"):continue
        short=b["typeId"].split(":")[-1]
        return BLOCKS.get(short,(117,130,123))
    return (20,36,42)
for x in range(65):
    for z in range(39):
        c=color(x,z);d.rectangle((ox+x*scale,oz+z*scale,ox+(x+1)*scale-1,oz+(z+1)*scale-1),fill=c)
for module in f["modules"]:
    if module["floor"]!=1:continue
    x,z=module["pos"]["x"],module["pos"]["z"]
    if module["role"]=="corridor_standard":continue
    name="LIFT / LADDER" if module["role"]=="vertical_core" else module["role"].upper()
    width=d.textbbox((0,0),name,font=font(12))[2]
    cx=ox+(x+6.5)*scale;cy=oz+(z+6)*scale
    d.rectangle((cx-width/2-5,cy-3,cx+width/2+5,cy+17),fill=(12,26,32))
    d.text((cx-width/2,cy),name,font=font(12),fill=(221,237,211))
sidebar=1220
d.text((sidebar,194),"BUILT INTO THIS PACK",font=font(17),fill=(223,231,217))
for i,line in enumerate(["3–8 underground floors","33 room / hall templates","47 custom blocks","Keycard blast doors","Elevator transfer pads","Emergency ladder","Laser grids + lockdown","Hostile-only laser turrets","B1 escape tunnel","90-second self-destruct"]):
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
