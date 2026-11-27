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
    "beta-data/axis-format.mjs", "beta-data/shared-axis.mjs",
    "server/usage-stats-features.mjs", "server/usage-stats-characters.mjs",
]
fixed += [
    "beta-data/buff-rule-registry.mjs",
    "beta-data/buff-rule-schema.mjs",
    "beta-data/character-elements.mjs",
    "beta-data/direct-reaction-scope.mjs",
    "beta-data/dsl-segment-source.mjs",
    "beta-data/dsl-segment-target.mjs",
    "beta-data/dsl-tokens.mjs",
    "beta-data/effect-rule-engine.mjs",
    "beta-data/traveler-model.mjs",
    "beta-data/dsl-skill-names.json",
    "src/algorithms/dsl-generator.mjs",
    "src/algorithms/dsl-library.mjs",
    "src/algorithms/reaction-labels.mjs",
    "src/assets/_gen_character.js",
    "src/assets/_gen_weapon.js",
    "src/assets/_gen_buff.js",
    "src/import/character-summary.mjs",
    "src/import/character-talents.mjs",
]
files = [source / name for name in fixed]
files += sorted((service / "src").rglob("*.mjs"))
files += sorted((service / "migrations").rglob("*.sql"))
files += sorted(path for path in (service / "static").rglob("*") if path.is_file())
for path in files:
    if not path.is_file() or path.is_symlink():
        raise RuntimeError(f"Missing or linked package source: {path}")
if not any(path.parent == service / "src" for path in files):
    raise RuntimeError("Backend source is missing")
root_name = "mona-online-service-7.2.06.04"
name = f"{root_name}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.zip"
archive = output / name
manifest = [{"path": path.relative_to(source).as_posix(), "bytes": path.stat().st_size} for path in files]
with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED) as package:
    for path in files:
        package.write(path, f"{root_name}/{path.relative_to(source).as_posix()}")
    package.writestr(f"{root_name}/package-manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"archive": str(archive), "files": len(files), "bytes": archive.stat().st_size}, ensure_ascii=False))
