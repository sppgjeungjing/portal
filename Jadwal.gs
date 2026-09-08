/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Jadwal.gs — Jadwal & Penugasan (Modul Dashboard Relawan #5)
 *
 * ==================================================================
 * ⚠️ DEPRECATED (per instruksi konsolidasi jadwal) ⚠️
 * Sheet 10_JADWAL dan fungsi-fungsi di file ini TIDAK LAGI menjadi
 * SUMBER UTAMA untuk "Jadwal Saya" di Dashboard/jadwal.html relawan.
 * Sumber utama sekarang: Shift.gs -> getJadwalSayaHariIni() (dari
 * Shift Divisi + Penugasan Khusus, alias "Shift & Koreksi").
 *
 * File ini SENGAJA TIDAK DIHAPUS (data lama di 10_JADWAL tetap aman &
 * bisa dibaca via getJadwalListAdmin kalau perlu ditinjau), tapi JANGAN
 * dipakai lagi untuk fitur baru. Gunakan addPenugasanKhusus/addShiftDivisi
 * (Shift.gs) untuk kebutuhan jadwal & penugasan ke depan.
 * ==================================================================
 */

const NAMA_HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getJadwalSheet() {
  return getSheet(NAMA_SHEET.JADWAL);
}

function generateIdJadwal_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^JDW(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'JDW' + String(max + 1).padStart(3, '0');
}

function hitungNamaHari_(tanggalDMY) {
  const bagian = String(tanggalDMY).split('/');
  if (bagian.length !== 3) return '';
  const d = new Date(Number(bagian[2]), Number(bagian[1]) - 1, Number(bagian[0]));
  return NAMA_HARI_ID[d.getDay()];
}

/**
 * JADWAL PER DIVISI — memakai struktur ID_RELAWAN yang SUDAH ADA, bukan
 * kolom baru. Selain "SEMUA" dan ID relawan spesifik, sekarang juga
 * menerima format "DIVISI:NamaDivisi" (mis. "DIVISI:Dapur") untuk target
 * satu divisi. 100% backward-compatible -- jadwal lama (SEMUA / ID biasa)
 * tetap berfungsi sama persis.
 */
function getJadwalRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  const divisiSaya = relawan ? relawan.divisi : '';

  const semua = sheetToObjects(getJadwalSheet());
  return semua
    .filter(j => {
      const target = String(j.ID_RELAWAN);
      if (target === idRelawan || target.toUpperCase() === 'SEMUA') return true;
      if (target.toUpperCase().indexOf('DIVISI:') === 0) {
        const namaDivisiTarget = target.slice(7).trim();
        return divisiSaya && namaDivisiTarget.toLowerCase() === String(divisiSaya).toLowerCase();
      }
      return false;
    })
    .map(j => ({
      id: j.ID, tanggal: j.TANGGAL, hari: j.HARI, waktu: j.WAKTU,
      penugasan: j.PENUGASAN, keterangan: j.KETERANGAN, status: j.STATUS
    }))
    .sort((a, b) => tanggalSheetKeIso_(a.tanggal).localeCompare(tanggalSheetKeIso_(b.tanggal)));
}

function getJadwalListAdmin() {
  const semua = sheetToObjects(getJadwalSheet());
  const relawanList = getRelawanList(null, true);
  const namaById = {};
  relawanList.forEach(r => { namaById[r.id] = r.nama; });

  return semua.map(j => ({
    id: j.ID, tanggal: j.TANGGAL, hari: j.HARI, waktu: j.WAKTU,
    idRelawan: j.ID_RELAWAN,
    namaRelawan: String(j.ID_RELAWAN).toUpperCase() === 'SEMUA' ? 'Semua Relawan'
      : (String(j.ID_RELAWAN).toUpperCase().indexOf('DIVISI:') === 0 ? 'Divisi: ' + String(j.ID_RELAWAN).slice(7)
      : (namaById[j.ID_RELAWAN] || j.ID_RELAWAN)),
    penugasan: j.PENUGASAN, keterangan: j.KETERANGAN, status: j.STATUS
  })).sort((a, b) => tanggalSheetKeIso_(b.tanggal).localeCompare(tanggalSheetKeIso_(a.tanggal)));
}

function addJadwal(body) {
  const tanggalIso = sanitize(body.tanggal);
  const waktu = sanitize(body.waktu);
  const idRelawan = sanitize(body.idRelawan) || 'SEMUA';
  const penugasan = sanitize(body.penugasan);
  const keterangan = sanitize(body.keterangan);
  const status = sanitize(body.status) || 'Terjadwal';

  if (!tanggalIso) throw new Error('Tanggal wajib diisi.');
  if (!penugasan) throw new Error('Penugasan wajib diisi.');

  const [yyyy, mm, dd] = tanggalIso.split('-');
  const tanggalDMY = `${dd}/${mm}/${yyyy}`;
  const hari = hitungNamaHari_(tanggalDMY);

  const sheet = getJadwalSheet();
  const id = generateIdJadwal_(sheet);
  sheet.appendRow([id, tanggalDMY, hari, waktu, idRelawan, penugasan, keterangan, status]);
  // CATATAN: push notification "Penugasan Baru" TIDAK lagi dikirim dari
  // sini (dipindah ke addPenugasanKhusus di Shift.gs, sumber baru sesuai
  // konsolidasi). Fungsi ini dibiarkan tetap bisa dipakai untuk mencatat
  // ke Notifikasi kalau ada kebutuhan arsip, tapi TIDAK direkomendasikan
  // untuk fitur baru -- gunakan addPenugasanKhusus/addShiftDivisi.
  catatNotifikasi_(
    idRelawan === 'SEMUA' ? 'Jadwal' : 'Penugasan',
    idRelawan === 'SEMUA' ? 'Jadwal baru: ' + penugasan : 'Penugasan baru untuk Anda',
    (tanggalDMY + (waktu ? ' · ' + waktu : '') + ' — ' + penugasan + (keterangan ? ' (' + keterangan + ')' : '')),
    idRelawan
  );

  return { id: id };
}

function updateJadwal(body) {
  const id = sanitize(body.id);
  const tanggalIso = sanitize(body.tanggal);
  const waktu = sanitize(body.waktu);
  const idRelawan = sanitize(body.idRelawan) || 'SEMUA';
  const penugasan = sanitize(body.penugasan);
  const keterangan = sanitize(body.keterangan);
  const status = sanitize(body.status) || 'Terjadwal';

  if (!tanggalIso) throw new Error('Tanggal wajib diisi.');
  if (!penugasan) throw new Error('Penugasan wajib diisi.');

  const [yyyy, mm, dd] = tanggalIso.split('-');
  const tanggalDMY = `${dd}/${mm}/${yyyy}`;
  const hari = hitungNamaHari_(tanggalDMY);

  const sheet = getJadwalSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.getRange(i + 1, 1, 1, 8).setValues([[id, tanggalDMY, hari, waktu, idRelawan, penugasan, keterangan, status]]);
      return { success: true };
    }
  }
  throw new Error('Jadwal tidak ditemukan.');
}

function deleteJadwal(body) {
  const id = sanitize(body.id);
  const sheet = getJadwalSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  throw new Error('Jadwal tidak ditemukan.');
}
