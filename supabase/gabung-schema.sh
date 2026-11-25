#!/usr/bin/env bash
# Menyusun supabase/schema.sql (instalasi baru) dari berkas migrasi berurutan.
set -euo pipefail
cd "$(dirname "$0")"
{
  echo "-- Kelasku.id v1.0.0: skema lengkap untuk instalasi baru (gabungan migrations/*.sql)."
  echo "-- Jangan diedit langsung. Ubah berkas di migrations/, lalu jalankan: ./gabung-schema.sh"
  echo "-- Naik dari v0.2.0? Jangan pakai berkas ini; jalankan migrations/002_rombak_v030.sql lalu 003_fitur_kelas_v040.sql dan 004_push_v100.sql."
  for f in migrations/*.sql; do echo; echo "-- ======== $f"; cat "$f"; done
} > schema.sql
echo "schema.sql dibuat dari $(ls migrations/*.sql | wc -l) berkas."
