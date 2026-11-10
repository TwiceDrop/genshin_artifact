#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
umask 077
mkdir -p backups
backup="backups/mona-$(date -u +%Y%m%dT%H%M%SZ).dump"
if [[ -e "$backup" || -e "$backup.tmp" ]]; then
    printf 'Backup path already exists: %s\n' "$backup" >&2
    exit 1
fi
docker compose exec -T db pg_dump -U mona -d mona -Fc > "$backup.tmp"
mv -- "$backup.tmp" "$backup"
printf 'Database backup written to %s\n' "$backup"
