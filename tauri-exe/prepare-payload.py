from pathlib import Path
import json
import tarfile
import argparse

wrapper = Path(__file__).resolve().parent
source = wrapper.parent
parser = argparse.ArgumentParser()
parser.add_argument('--web', type=Path, required=True)
parser.add_argument('--node', type=Path, default=source.parent / 'launcher/runtime')
args = parser.parse_args()
web = args.web.resolve()
node = args.node.resolve()
files = {}
for path in web.rglob('*'):
    if path.is_file():
        files['dist/' + path.relative_to(web).as_posix()] = path
for directory in ['server', 'runtime/hoyolab-login']:
    for path in (source / directory).rglob('*'):
        if path.is_file():
            files[path.relative_to(source).as_posix()] = path
for name in ['package.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'script/install-update.ps1']:
    files[name] = source / name
files['start-server.mjs'] = wrapper / 'start-server.mjs'
files['runtime/node.exe'] = node / 'node.exe'
files['runtime/LICENSE'] = node / 'LICENSE'
assert (web / 'index.html').is_file()
assert all(path.is_file() for path in files.values())
with tarfile.open(wrapper / 'payload.tar.gz', 'w:gz', compresslevel=9) as archive:
    for name, path in sorted(files.items()):
        archive.add(path, arcname=name, recursive=False)
manifest = {'files': sorted(files), 'count': len(files), 'compressedBytes': (wrapper / 'payload.tar.gz').stat().st_size,
            'sourceBytes': sum(path.stat().st_size for path in files.values())}
(wrapper / 'payload-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in manifest.items() if key != 'files'}, indent=2))
