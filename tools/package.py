"""Reproducible mcpack/mcaddon output; no source tools or test fixtures shipped."""
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
def archive(entries):
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,data in sorted(entries):
            info=zipfile.ZipInfo(name,date_time=(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o644<<16;z.writestr(info,data)
    return buffer.getvalue()
def main():
    out=ROOT/"dist";out.mkdir(exist_ok=True)
    packs=[]
    for folder,label in [("behavior_pack","Behavior"),("resource_pack","Resources")]:
        root=ROOT/folder
        assert (root/"manifest.json").exists()
        data=archive([(str(p.relative_to(root)),p.read_bytes()) for p in root.rglob("*") if p.is_file() and not p.name.startswith(".")])
        name=f"Secret_Facilities_{label}.mcpack";(out/name).write_bytes(data);packs.append((name,data))
    name="Secret_Facilities_0.1.0.mcaddon";data=archive(packs);(out/name).write_bytes(data)
    with zipfile.ZipFile(io.BytesIO(data)) as outer:
        assert outer.testzip() is None
        for pack in outer.namelist():
            with zipfile.ZipFile(io.BytesIO(outer.read(pack))) as inner:
                assert inner.testzip() is None;assert "manifest.json" in inner.namelist()
                json.loads(inner.read("manifest.json"))
    (out/"SHA256SUMS.txt").write_text("\n".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}" for p in sorted(out.glob("*.mc*")))+"\n")
    print(f"Packaged and verified {name} ({len(data):,} bytes).")
if __name__=="__main__":main()
