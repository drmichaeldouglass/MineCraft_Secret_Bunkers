"""Fetch pinned compiler/API definitions only; no package lifecycle scripts run."""
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
for name, version in [("typescript", "5.8.3"), ("@minecraft/server", "2.0.0"), ("@minecraft/server-ui", "2.0.0"), ("@minecraft/common", "1.2.0")]:
    meta = json.load(urllib.request.urlopen(f"https://registry.npmjs.org/{name}/{version}", timeout=30))
    data = urllib.request.urlopen(meta["dist"]["tarball"], timeout=30).read()
    assert hashlib.sha1(data).hexdigest() == meta["dist"]["shasum"]
    target = ROOT / "node_modules" / name
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for member in archive.getmembers():
            relative = Path(member.name).relative_to("package")
            if not member.isfile() or ".." in relative.parts:
                continue
            out = target / relative
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(archive.extractfile(member).read())
    print(f"Installed {name}@{version}")
