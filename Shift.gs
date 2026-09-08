/**
 * SPPG JEUNGJING — PORTAL RELAWAN
 * Shift.gs — Modul Shift per Divisi & Penugasan Khusus (BARU)
 *
 * Modul berdiri sendiri: 2 sheet baru (21-22), TIDAK menyentuh sheet lain.
 * SATU fungsi di file ini menyentuh Absensi.gs secara TIDAK LANGSUNG lewat
 * pemanggilan (resolveShiftUntukRelawan_), dan Absensi.gs sendiri diedit
 * minimal (lihat catatan "INTEGRASI SHIFT" di Absensi.gs) dengan fallback
 * wajib ke perilaku LAMA kalau data Shift belum diisi Admin.
 *
 * ==================================================================
 * WAJIB DISIAPKAN MANUAL sebelum modul ini berfungsi:
 * ==================================================================
 * 21_SHIFT_DIVISI
 * ID_SHIFT | ID_PERIODE | NAMA_DIVISI | JAM_MASUK | JAM_PULANG | KETERANGAN | DIBUAT_PADA
 *   -- 1 baris berlaku untuk SEMUA tanggal operasional dalam 1 Periode.
 *   -- NAMA_DIVISI dicocokkan LANGSUNG ke kolom DIVISI di 01_DATA_RELAWAN
 *      (sheet 02_DATA_DIVISI memang cuma berisi daftar nama, tidak ada ID
 *      terpisah -- lihat Relawan.gs:getDivisiList()).
 *
 * 22_PENUGASAN_KHUSUS
 * ID_PENUGASAN | ID_OPERASIONAL | ID_RELAWAN | JAM_MASUK | JAM_PULANG | CATATAN | DIBUAT_PADA
 *   -- override per relawan, per tanggal operasional spesifik.
 *
 * ==================================================================
 * PRIORITAS RESOLUSI (dipakai resolveShiftUntukRelawan_):
 *   1. Penugasan Khusus (relawan + tanggal operasional spesifik)
 *   2. Shift Divisi (divisi relawan + periode tanggal operasional itu)
 *   3. null -- pemanggil (Absensi.gs) WAJIB fallback ke aturan lama
 *      (JAM_MULAI_CEK_OPERASIONAL_BESOK / JAM_MASUK_STANDAR global)
 * ==================================================================
 */

function getShiftDivisiSheet() { return getSheet(NAMA_SHEET.SHIFT_DIVISI); }
function getPenugasanKhususSheet() { return getSheet(NAMA_SHEET.PENUGASAN_KHUSUS); }

// ------------------------------------------------------------
// RESOLUSI SHIFT — dipakai Absensi.gs, HARUS ringan & tahan-gagal
// (kalau sheet belum ada / kosong, kembalikan null, JANGAN throw,
// supaya absensi tidak ikut rusak kalau modul Shift belum disiapkan).
// ------------------------------------------------------------

/**
 * Mencari jam shift (masuk & pulang) untuk seorang relawan pada satu
 * entri operasional spesifik. Return null kalau tidak ada data Shift
 * SAMA SEKALI untuk kombinasi ini (pemanggil wajib fallback).
 * @param {string} idRelawan
 * @param {string} idOperasional  ID_OPERASIONAL dari 15_KALENDER_OPERASIONAL
 */
function resolveShiftUntukRelawan_(idRelawan, idOperasional) {
  try {
    // 1) Penugasan Khusus (paling prioritas)
    const khusus = sheetToObjects(getPenugasanKhususSheet())
      .find(p => p.ID_OPERASIONAL === idOperasional && p.ID_RELAWAN === idRelawan);
    if (khusus && khusus.JAM_MASUK) {
      return { jamMasuk: String(khusus.JAM_MASUK), jamPulang: khusus.JAM_PULANG ? String(khusus.JAM_PULANG) : null, sumber: 'KHUSUS' };
    }

    // 2) Shift Divisi (perlu tahu ID_PERIODE dari entri operasional, dan divisi relawan)
    const opRow = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasional);
    if (!opRow) return null;

    const relawan = getRelawanById(idRelawan);
    if (!relawan || !relawan.divisi) return null;

    const shift = sheetToObjects(getShiftDivisiSheet()).find(s =>
      s.ID_PERIODE === opRow.ID_PERIODE && s.NAMA_DIVISI === relawan.divisi
    );
    if (shift && shift.JAM_MASUK) {
      return { jamMasuk: String(shift.JAM_MASUK), jamPulang: shift.JAM_PULANG ? String(shift.JAM_PULANG) : null, sumber: 'DIVISI' };
    }

    return null;
  } catch (err) {
    // Modul Shift belum disiapkan (sheet belum dibuat) atau error lain --
    // JANGAN sampai ini mematikan absensi. Pemanggil akan fallback.
    return null;
  }
}

/**
 * Dipakai tentukanOperasionalAktifHariIni_ (Absensi.gs) untuk tahu jam
 * berapa shift relawan ini MULAI pada entri operasional tertentu, dengan
 * toleransi datang awal (menit) supaya relawan yang datang sedikit lebih
 * cepat dari jam shift tetap tercatat ke operasional yang benar.
 * Return null kalau tidak ada data Shift (pemanggil fallback ke aturan lama).
 */
function jamMulaiShiftDenganToleransi_(idRelawan, idOperasional, toleransiMenit) {
  const shift = resolveShiftUntukRelawan_(idRelawan, idOperasional);
  if (!shift || !shift.jamMasuk) return null;
  const [h, m] = shift.jamMasuk.split(':').map(Number);
  const total = h * 60 + m - (toleransiMenit || 0);
  const totalAman = ((total % 1440) + 1440) % 1440; // jaga-jaga kalau toleransi bikin lewat tengah malam
  const hh = Math.floor(totalAman / 60);
  const mm = totalAman % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/**
 * Versi shift-aware dari apakahTerlambat(): kalau relawan ini punya data
 * Shift (Penugasan Khusus atau Shift Divisi) untuk operasional yang
 * bersangkutan, bandingkan ke situ. Kalau tidak ada data Shift sama
 * sekali, otomatis fallback ke apakahTerlambat() lama (JAM_MASUK_STANDAR
 * global) -- perilaku persis seperti sebelum modul Shift ada.
 */
function apakahTerlambatShiftAware_(idRelawan, idOperasional, jamString) {
  if (idRelawan && idOperasional) {
    const shift = resolveShiftUntukRelawan_(idRelawan, idOperasional);
    if (shift && shift.jamMasuk) {
      return apakahTerlambatDenganBatas_(jamString, shift.jamMasuk);
    }
  }
  return apakahTerlambat(jamString);
}

/**
 * Menandai seberapa mepet pengajuan Izin/Sakit dibanding jam shift relawan
 * (Fase 4). BUKAN penolakan -- pengajuan tetap selalu diterima, ini
 * murni penanda buat Admin. Kalau modul Shift/data shift belum ada,
 * fallback ke JAM_MASUK_STANDAR global.
 *
 * CATATAN keterbatasan: perhitungan pakai jam-di-hari-yang-sama (belum
 * menghitung lintas tengah malam secara presisi) -- cukup akurat untuk
 * penanda "mepet/telat", tidak dipakai untuk keputusan otomatis apa pun.
 *
 * @return 'TEPAT_WAKTU' | 'MEPET' | 'TELAT'
 */
function statusKetepatanPengajuanIzin_(idRelawan, idOperasional) {
  let jamMasukShift = JAM_MASUK_STANDAR;
  if (typeof resolveShiftUntukRelawan_ === 'function') {
    try {
      const shift = resolveShiftUntukRelawan_(idRelawan, idOperasional);
      if (shift && shift.jamMasuk) jamMasukShift = shift.jamMasuk;
    } catch (e) { /* fallback ke JAM_MASUK_STANDAR di atas */ }
  }

  const jamSekarangStr = Utilities.formatDate(new Date(), ZONA_WAKTU, 'HH:mm');
  const [hNow, mNow] = jamSekarangStr.split(':').map(Number);
  const [hShift, mShift] = jamMasukShift.split(':').map(Number);
  const selisihMenit = (hShift * 60 + mShift) - (hNow * 60 + mNow);

  if (selisihMenit < 0) return 'TELAT';
  if (selisihMenit < BATAS_JAM_PENGAJUAN_IZIN_SEBELUM_SHIFT * 60) return 'MEPET';
  return 'TEPAT_WAKTU';
}

// ------------------------------------------------------------
// SHIFT DIVISI — CRUD (Admin)
// ------------------------------------------------------------

function getShiftDivisiListAdmin(idPeriode) {
  let list = sheetToObjects(getShiftDivisiSheet());
  if (idPeriode) list = list.filter(s => s.ID_PERIODE === idPeriode);
  return list.map(s => ({
    id: s.ID_SHIFT,
    idPeriode: s.ID_PERIODE,
    namaDivisi: s.NAMA_DIVISI,
    jamMasuk: s.JAM_MASUK,
    jamPulang: s.JAM_PULANG || '',
    keterangan: s.KETERANGAN || ''
  }));
}

function generateIdShift_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][0] || '').match(/^SFT(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'SFT' + String(max + 1).padStart(3, '0');
}

function addShiftDivisi(body) {
  requireAuth(body.token);
  const idPeriode = sanitize(body.idPeriode);
  const namaDivisi = sanitize(body.namaDivisi);
  const jamMasuk = sanitize(body.jamMasuk);
  const jamPulang = sanitize(body.jamPulang);

  if (!idPeriode) throw new Error('Periode wajib dipilih.');
  if (!namaDivisi) throw new Error('Divisi wajib dipilih.');
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');
  if (jamPulang && !/^\d{2}:\d{2}$/.test(jamPulang)) throw new Error('Jam pulang wajib format HH:mm.');

  const sheet = getShiftDivisiSheet();

  // Satu kombinasi (periode, divisi) cukup 1 baris -- kalau sudah ada, perbarui.
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === idPeriode && String(data[i][2]) === namaDivisi) {
      sheet.getRange(i + 1, 4, 1, 3).setValues([[jamMasuk, jamPulang, sanitize(body.keterangan)]]);
      return { id: data[i][0], diperbarui: true };
    }
  }

  const id = generateIdShift_(sheet);
  sheet.appendRow([id, idPeriode, namaDivisi, jamMasuk, jamPulang, sanitize(body.keterangan), new Date()]);
  return { id: id, diperbarui: false };
}

function deleteShiftDivisi(body) {
  requireAuth(body.token);
  const id = sanitize(body.id);
  const sheet = getShiftDivisiSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  throw new Error('Data Shift tidak ditemukan.');
}

// ------------------------------------------------------------
// PENUGASAN KHUSUS — CRUD (Admin)
// ------------------------------------------------------------

function getPenugasanKhususListAdmin(idOperasional) {
  const namaMap = {};
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(r => { namaMap[r.ID_RELAWAN] = r.NAMA_RELAWAN; });

  let list = sheetToObjects(getPenugasanKhususSheet());
  if (idOperasional) list = list.filter(p => p.ID_OPERASIONAL === idOperasional);
  return list.map(p => ({
    id: p.ID_PENUGASAN,
    idOperasional: p.ID_OPERASIONAL,
    idRelawan: p.ID_RELAWAN,
    namaRelawan: namaMap[p.ID_RELAWAN] || p.ID_RELAWAN,
    jamMasuk: p.JAM_MASUK,
    jamPulang: p.JAM_PULANG || '',
    catatan: p.CATATAN || ''
  }));
}

function generateIdPenugasanKhusus_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][0] || '').match(/^PGK(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'PGK' + String(max + 1).padStart(3, '0');
}

function addPenugasanKhusus(body) {
  requireAuth(body.token);
  const idOperasional = sanitize(body.idOperasional);
  const idRelawan = sanitize(body.idRelawan);
  const jamMasuk = sanitize(body.jamMasuk);
  const jamPulang = sanitize(body.jamPulang);

  if (!idOperasional) throw new Error('Tanggal operasional wajib dipilih.');
  if (!idRelawan) throw new Error('Relawan wajib dipilih.');
  if (!/^\d{2}:\d{2}$/.test(jamMasuk)) throw new Error('Jam masuk wajib format HH:mm.');
  if (jamPulang && !/^\d{2}:\d{2}$/.test(jamPulang)) throw new Error('Jam pulang wajib format HH:mm.');

  const sheet = getPenugasanKhususSheet();
  const id = generateIdPenugasanKhusus_(sheet);
  const catatan = sanitize(body.catatan);
  sheet.appendRow([id, idOperasional, idRelawan, jamMasuk, jamPulang, catatan, new Date()]);

  // PENUGASAN BARU -- push notification dipindah ke sini (dari Jadwal.gs
  // lama yang sekarang deprecated) sesuai konsolidasi sumber jadwal.
  try {
    const opRow = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasional);
    const isi = (catatan || 'Penugasan khusus') + (opRow ? ' · ' + opRow.TANGGAL_OPERASIONAL : '') + ' · ' + jamMasuk + (jamPulang ? '-' + jamPulang : '');
    catatNotifikasi_('Penugasan', '📌 Penugasan Baru', isi, idRelawan);
    kirimPushNotifikasi_(idRelawan, '📌 Penugasan Baru', isi, { link: '/jadwal.html' });
  } catch (e) { /* push notif gagal -- jangan gagalkan pembuatan penugasan */ }

  return { id: id };
}

function deletePenugasanKhusus(body) {
  requireAuth(body.token);
  const id = sanitize(body.id);
  const sheet = getPenugasanKhususSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  throw new Error('Penugasan khusus tidak ditemukan.');
}

// ------------------------------------------------------------
// KOREKSI TANGGAL OPERASIONAL (tombol permanen, Admin)
// Dipakai kalau ada baris di 03_DATA_ABSENSI yang salah "menempel" ke
// tanggal operasional yang keliru (mis. kasus shift lintas tengah malam
// sebelum modul Shift terisi lengkap). TIDAK mengubah TIMESTAMP asli,
// TIDAK mengubah JAM -- hanya kolom TANGGAL & ID_OPERASIONAL.
// ------------------------------------------------------------

/** Cari baris absensi seorang relawan pada tanggal presensi aktual tertentu (untuk dipilih di UI koreksi). */
function cariAbsensiUntukKoreksi(token, idRelawan, tanggalPresensi) {
  requireAuth(token);
  idRelawan = sanitize(idRelawan);
  tanggalPresensi = sanitize(tanggalPresensi);

  const namaMap = {};
  sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).forEach(r => { namaMap[r.ID_RELAWAN] = r.NAMA_RELAWAN; });

  return sheetToObjects(getSheet(NAMA_SHEET.ABSENSI))
    .filter(a => a.ID_RELAWAN === idRelawan && a.TANGGAL === tanggalPresensi)
    .map((a, i) => ({
      nomorBaris: a.NO, // dipakai sisi server buat cari baris persis lagi saat koreksi
      nama: namaMap[idRelawan] || idRelawan,
      jenis: a.JENIS_ABSENSI,
      tanggalTercatatSaatIni: a.TANGGAL,
      idOperasionalSaatIni: a.ID_OPERASIONAL,
      jam: a.JAM
    }));
}

/**
 * Koreksi manual: ganti TANGGAL & ID_OPERASIONAL pada 1 baris absensi
 * yang salah, ke entri operasional yang benar. Timestamp/JAM asli TIDAK
 * disentuh -- ini murni memindahkan baris ke "hari operasional" yang
 * seharusnya, bukan mengubah kapan relawan sebenarnya absen.
 */
function koreksiTanggalOperasionalAbsensi(body) {
  requireAuth(body.token);
  const idRelawan = sanitize(body.idRelawan);
  const jenis = sanitize(body.jenis); // 'MASUK' | 'PULANG'
  const tanggalLama = sanitize(body.tanggalLama);
  const idOperasionalBaru = sanitize(body.idOperasionalBaru);

  if (!idRelawan || !jenis || !tanggalLama || !idOperasionalBaru) {
    throw new Error('Data koreksi tidak lengkap.');
  }

  const opBaru = getKalenderRows_().find(k => k.ID_OPERASIONAL === idOperasionalBaru);
  if (!opBaru) throw new Error('Entri operasional tujuan tidak ditemukan.');

  const sheet = getSheet(NAMA_SHEET.ABSENSI);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxRelawan = headers.indexOf('ID_RELAWAN');
  const idxTanggal = headers.indexOf('TANGGAL');
  const idxJenis = headers.indexOf('JENIS_ABSENSI');
  const idxIdOperasional = headers.indexOf('ID_OPERASIONAL');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxRelawan]) === idRelawan &&
        String(data[i][idxTanggal]) === tanggalLama &&
        String(data[i][idxJenis]) === jenis) {
      // Kolom TANGGAL ditulis ulang sebagai teks murni (sama seperti pola
      // penulisan lain di Absensi.gs) supaya tidak kena bug auto-convert Sheets.
      sheet.getRange(i + 1, idxTanggal + 1).setNumberFormat('@').setValue(opBaru.TANGGAL_OPERASIONAL);
      sheet.getRange(i + 1, idxIdOperasional + 1).setValue(idOperasionalBaru);
      return { success: true, tanggalBaru: opBaru.TANGGAL_OPERASIONAL };
    }
  }
  throw new Error('Baris absensi yang sesuai tidak ditemukan (mungkin sudah dikoreksi sebelumnya).');
}

/**
 * "JADWAL SAYA" — SATU SUMBER KEBENARAN dari Shift & Koreksi (BUKAN dari
 * 10_JADWAL/Jadwal.gs lagi, sesuai instruksi konsolidasi). Menu yang
 * ditampilkan ke pengguna tetap bernama "Jadwal & Penugasan" -- ini murni
 * perubahan SUMBER DATA di baliknya.
 *
 * Menggabungkan:
 *   - Status Operasional hari ini (LIBUR -> jadwal = "Libur", tidak perlu
 *     cek shift sama sekali)
 *   - resolveShiftUntukRelawan_ (SUDAH ADA) untuk jam masuk/pulang
 *   - CATATAN dari Penugasan Khusus sebagai deskripsi tugas (kalau sumber
 *     KHUSUS) -- field ini yang paling dekat menggantikan "Penugasan"
 *     bebas teks dari sistem manual lama
 *   - Status absensi AKTUAL hari itu untuk tentukan Terjadwal/Sedang
 *     Bertugas/Selesai
 */
function getJadwalSayaHariIni(token) {
  const idRelawan = requireAuthRelawan(token);
  const statusOp = getStatusOperasionalHariIni();

  if (statusOp.status === 'LIBUR') {
    return { ada: true, waktu: '', penugasan: 'Libur', status: 'Libur' };
  }

  const operasional = tentukanOperasionalAktifHariIni_(idRelawan);
  if (!operasional) return { ada: false };

  const shift = resolveShiftUntukRelawan_(idRelawan, operasional.idOperasional);
  const relawan = getRelawanById(idRelawan);

  let penugasan = relawan ? relawan.divisi : 'Tugas Umum';
  if (shift && shift.sumber === 'KHUSUS') {
    const khusus = sheetToObjects(getPenugasanKhususSheet())
      .find(p => p.ID_OPERASIONAL === operasional.idOperasional && p.ID_RELAWAN === idRelawan);
    if (khusus && khusus.CATATAN) penugasan = khusus.CATATAN;
  }

  const waktu = shift ? (shift.jamMasuk + (shift.jamPulang ? ' – ' + shift.jamPulang : '')) : '';

  // Status berdasarkan absensi AKTUAL hari itu -- konsisten dengan yang
  // dipakai getStatusAbsensiRelawan (Absensi.gs), bukan logic terpisah.
  const semuaAbsensi = getAbsensiRows_().filter(a => a.ID_RELAWAN === idRelawan && a.ID_OPERASIONAL === operasional.idOperasional);
  const sudahMasuk = semuaAbsensi.some(a => a.JENIS_ABSENSI === 'MASUK');
  const sudahPulang = semuaAbsensi.some(a => a.JENIS_ABSENSI === 'PULANG');
  let status = 'Terjadwal';
  if (sudahMasuk && sudahPulang) status = 'Selesai';
  else if (sudahMasuk) status = 'Sedang Bertugas';

  return { ada: true, waktu: waktu, penugasan: penugasan, status: status };
}
