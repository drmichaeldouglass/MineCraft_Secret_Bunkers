"""Validate shipped JSON references and independently decode every NBT template."""
from pathlib import Path
import io
import json
import re
import struct
import uuid
import wave
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
BP,RP=ROOT/"behavior_pack",ROOT/"resource_pack"

def read_nbt(data):
    stream=io.BytesIO(data)
    def unpack(fmt):return struct.unpack(fmt,stream.read(struct.calcsize(fmt)))[0]
    def string():return stream.read(unpack("<H")).decode("utf8")
    def payload(kind):
        if kind==1:return unpack("<b")
        if kind==3:return unpack("<i")
        if kind==8:return string()
        if kind==9:
            child,n=unpack("<B"),unpack("<i");return [payload(child) for _ in range(n)]
        if kind==10:
            result={}
            while True:
                child=unpack("<B")
                if child==0:return result
                name=string();result[name]=payload(child)
        raise AssertionError(f"Unexpected NBT tag {kind}")
    assert unpack("<B")==10;string();root=payload(10);assert stream.read()==b"";return root

def main():
    files=list(BP.rglob("*.json"))+list(RP.rglob("*.json"))
    parsed={str(p.relative_to(ROOT)):json.loads(p.read_text()) for p in files}
    ids=set();uuids=set()
    for pack in (BP,RP):
        manifest=json.loads((pack/"manifest.json").read_text())
        assert manifest["format_version"]==2
        for module in [manifest["header"],*manifest["modules"]]:
            uuid.UUID(module["uuid"]);assert module["uuid"] not in uuids;uuids.add(module["uuid"])
        for module in manifest["modules"]:
            if module["type"]=="script":assert (pack/module["entry"]).is_file()
    bp=json.loads((BP/"manifest.json").read_text());rp=json.loads((RP/"manifest.json").read_text())
    assert {"uuid":rp["header"]["uuid"],"version":rp["header"]["version"]} in bp["dependencies"]
    terrain=json.loads((RP/"textures/terrain_texture.json").read_text())["texture_data"]
    items=json.loads((RP/"textures/item_texture.json").read_text())["texture_data"]
    for entry in [*terrain.values(),*items.values()]:assert (RP/(entry["textures"]+".png")).is_file()
    components={"secretfacilities:interact","secretfacilities:use_device"}
    for name,data in parsed.items():
        kind="minecraft:block" if "/blocks/" in name and name.startswith("behavior_pack") else "minecraft:item" if "/items/" in name and name.startswith("behavior_pack") else None
        if not kind:continue
        definition=data[kind];identifier=definition["description"]["identifier"]
        assert identifier.startswith("secretfacilities:") and identifier not in ids;ids.add(identifier)
        for key in definition["components"]:
            if not key.startswith("minecraft:"):assert key in components
        for part in [definition,*definition.get("permutations",[])]:
            for material in part.get("components",{}).get("minecraft:material_instances",{}).values():assert material["texture"] in terrain
    for path in (BP/"scripts").rglob("*.js"):
        for imported in re.findall(r'from [\'"]([^\'"]+)[\'"]',path.read_text()):
            assert imported in ["@minecraft/server","@minecraft/server-ui"] or (path.parent/imported).is_file(),(path,imported)
    catalog={t["name"]:t for t in json.loads((ROOT/"tools/generated/template_voxels.json").read_text())}
    templates=list((BP/"structures").rglob("*.mcstructure"))
    assert len(templates)==len(catalog)
    for path in templates:
        data=read_nbt(path.read_bytes());expected=catalog[path.stem]
        assert data["format_version"]==1 and data["size"]==expected["size"]
        indices=data["structure"]["block_indices"];palette=data["structure"]["palette"]["default"]["block_palette"]
        assert len(indices)==2 and indices[0]==expected["indices"]
        assert all(i==-1 for i in indices[1])
        assert len(indices[0])==data["size"][0]*data["size"][1]*data["size"][2]
        assert all(0<=i<len(palette) for i in indices[0])
        for block in palette:
            assert block["name"].startswith("minecraft:") or block["name"] in ids
    for path in RP.rglob("*.png"):
        with Image.open(path) as image:image.verify()
    sound_defs=json.loads((RP/"sounds/sound_definitions.json").read_text())["sound_definitions"]
    for definition in sound_defs.values():
        for sound in definition["sounds"]:
            with wave.open(str(RP/(sound+".wav"))) as audio:assert audio.getnchannels()==1 and audio.getnframes()>0
    print(f"Validated {len(files)} JSON files, {len(ids)} block/item IDs, {len(templates)} NBT structures, PNGs, sound files, imports and pack dependencies.")

if __name__=="__main__":main()
