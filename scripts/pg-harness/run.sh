#!/usr/bin/env bash
# Roda migrations + testes pgTAP num Postgres 16 local (sem Docker/Supabase).
# Uso: scripts/pg-harness/run.sh   (como root; usa o usuário postgres)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
DATA=/tmp/salonix-pg
PORT=54399
run_pg() { su postgres -c "$*"; }

if [ ! -d "$DATA" ]; then
  mkdir -p "$DATA" && chown postgres "$DATA"
  run_pg "$PGBIN/initdb -D $DATA -A trust >/dev/null"
fi
run_pg "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log status >/dev/null" \
  || run_pg "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"

PSQL="psql -h /tmp -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "drop database if exists salonix_test" -c "create database salonix_test" >/dev/null
$PSQL -d salonix_test -f "$ROOT/scripts/pg-harness/bootstrap.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  $PSQL -d salonix_test -f "$f" >/dev/null
done
if [ -f "$ROOT/supabase/seed.sql" ] && [ "${WITH_SEED:-1}" = 1 ]; then
  $PSQL -d salonix_test -f "$ROOT/supabase/seed.sql" >/dev/null
fi
pg_prove -h /tmp -p "$PORT" -U postgres -d salonix_test "$ROOT"/supabase/tests/*.test.sql
