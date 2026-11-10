from pathlib import Path
from datetime import datetime, timezone
import json
import sys
import zipfile

source = Path(__file__).resolve().parents[2]
service = source / "online-service"
output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else source.parent / "release-online-service-20261107"
output.mkdir(parents=True, exist_ok=True)
fixed = [
    "LICENSE",
    "online-service/package.json", "online-service/package-lock.json",
    "online-service/Dockerfile", "online-service/Dockerfile.dockerignore",
    "online-service/compose.yaml", "online-service/Caddyfile",
    "online-service/.env.example", "online-service/.gitignore", "online-service/DEPLOY.md",
    "online-service/scripts/init-secrets.mjs", "online-service/scripts/backup.sh", "online-service/scripts/pack.py",
    "server/hoyolab.mjs", "server/mys.mjs", "server/cookie.mjs", "server/device-fp.mjs",
    "server/vendor/twicedrop/mihoyo-api.mjs", "server/vendor/twicedrop/LICENSE",
]
files = [source / name for name in fixed]
files += sorted((service / "src").rglob("*.mjs"))
files += sorted((service / "migrations").rglob("*.sql"))
for path in files:
    if not path.is_file() or path.is_symlink():
        raise RuntimeError(f"Missing or linked package source: {path}")
if not any(path.parent == service / "src" for path in files):
    raise RuntimeError("Backend source is missing")
root_name = "mona-online-service-7.2.04"
name = f"{root_name}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.zip"
archive = output / name
manifest = [{"path": path.relative_to(source).as_posix(), "bytes": path.stat().st_size} for path in files]
with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as package:
    for path in files:
        package.write(path, f"{root_name}/{path.relative_to(source).as_posix()}")
    package.writestr(f"{root_name}/package-manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"archive": str(archive), "files": len(files), "bytes": archive.stat().st_size}, ensure_ascii=False))
