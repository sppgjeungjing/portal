# SIPRES SPPG Jeungjing — Source Final (Gabungan)

Paket ini berisi source code LENGKAP Portal SPPG Jeungjing, dengan 3 penambahan
yang berjalan PARALEL dengan sistem lama (tidak ada yang dihapus/ditimpa):

1. **Roster-First Attendance** (`03_DATA_ABSENSI_V2`)
2. **Master Tarif & Fondasi Penggajian** (`31_MASTER_TARIF`) — backend saja, TANPA UI
3. **Pengajuan Ketidakhadiran** (`32_PENGAJUAN_KETIDAKHADIRAN`) — alur persetujuan baru

**Baca dulu**: `SIPRES_SPPG_JEUNGJING_AUDIT_TEST_DEPLOY.md` — audit, testing,
deploy, migrasi, dan rollback plan LENGKAP untuk ketiganya.

## Struktur
```
source/
├── 1-APPS-SCRIPT/   Backend Google Apps Script (44 file .gs)
└── 2-GITHUB/         Frontend (GitHub Pages) — TIDAK diubah sesi ini
```
