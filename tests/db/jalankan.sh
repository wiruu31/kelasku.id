#!/usr/bin/env bash
# Uji database v1.0.0 di PostgreSQL lokal (butuh psql dan server Postgres 14+).
# Pakai: PGHOST=/tmp PGPORT=5544 PGUSER=postgres ./jalankan.sh
# Skrip membuat database sementara "kelasku_uji" dan membuangnya lagi.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")"
DB=kelasku_uji
SQL="../../supabase/migrations"
psql -qXAt -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -qX -v ON_ERROR_STOP=1 -d "$DB" "$@" >/dev/null; }

run -f 00-bootstrap.sql
run -f "$SQL/001_dasar_v020.sql"
run -f 10-seed-v020.sql
run -f "$SQL/002_rombak_v030.sql"
echo "002 pertama berhasil"
run -f "$SQL/002_rombak_v030.sql"
echo "002 kedua (diulang) berhasil"
run -f "$SQL/003_fitur_kelas_v040.sql"
echo "003 pertama berhasil"
run -f "$SQL/003_fitur_kelas_v040.sql"
echo "003 kedua (diulang) berhasil"
run -f "$SQL/004_push_v100.sql"
echo "004 pertama berhasil"
run -f "$SQL/004_push_v100.sql"
echo "004 kedua (diulang) berhasil"
run -f 20-uji-v030.sql -f 30-uji-migrasi.sql -f 40-uji-hierarki.sql -f 50-uji-fitur-v040.sql -f 60-uji-push.sql

# Instalasi baru: 001 lalu 002 di database kosong.
psql -qXAt -d postgres -c "drop database if exists ${DB}_baru" -c "create database ${DB}_baru"
psql -qX -v ON_ERROR_STOP=1 -d "${DB}_baru" -f 00-bootstrap.sql -f "$SQL/001_dasar_v020.sql" -f "$SQL/002_rombak_v030.sql" -f "$SQL/003_fitur_kelas_v040.sql" -f "$SQL/004_push_v100.sql" >/dev/null
echo "instalasi baru berhasil"
psql -qXAt -d postgres -c "drop database ${DB}_baru"

psql -qXAt -d "$DB" -F ' | ' -c "select count(*) filter (where lulus) || ' lulus, ' || count(*) filter (where not lulus) || ' gagal' from t.hasil"
psql -qXAt -d "$DB" -F ' | ' -c "select 'GAGAL: ' || nama || ' -> ' || coalesce(rincian, '') from t.hasil where not lulus"
FAILS=$(psql -qXAt -d "$DB" -c "select count(*) from t.hasil where not lulus")
psql -qXAt -d postgres -c "drop database $DB"
[ "$FAILS" = "0" ]
