/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Absensi.gs — Kirim absensi, cegah duplikasi, rekap harian & bulanan
 *
 * ============================================================
 * FASE 5 — CATATAN PEROMBAKAN submitAbsensi() (fungsi terproteksi)
 * ============================================================
 * BEFORE : Identitas (id/nama/divisi) dikirim APA ADANYA dari body request
 *          (form dropdown, tanpa login). Kunci duplikat: ID_RELAWAN+TANGGAL
 *          (TANGGAL = tanggal kalender perangkat/server saat submit).
 * AFTER  : Identitas WAJIB dari session login (requireAuthRelawan) — tidak
 *          pernah dipercaya dari body. Selfie + GPS wajib, divalidasi ulang
 *          di server (jarak vs MASTER_LOKASI_SPPG). Kunci duplikat:
 *          ID_RELAWAN+ID_OPERASIONAL+JENIS_ABSENSI. TANGGAL diisi dari
 *          TANGGAL_OPERASIONAL (Kalender Operasional) bukan tanggal
 *          perangkat — sehingga shift lintas tengah malam tetap tercatat
 *          di hari operasional yang benar TANPA mengubah satu pun logika
 *          Rekap Harian/Bulanan/2-Minggu/Riwayat di bawah (semua masih
 *          mengelompokkan berdasarkan TANGGAL, persis seperti sebelumnya).
 * WHY    : Permintaan eksplisit (lihat dokumen "Perombakan Fitur Absensi")
 *          — sistem belum diterapkan resmi, perombakan alur diizinkan.
 * RISK   : Relawan tanpa akun tidak bisa absen sampai Admin membuatkan akun
 *          (lihat tab Akun Relawan). QR code lama tidak lagi dipakai.
 * ROLLBACK: Simpan salinan file ini sebelum menimpa. 03_DATA_ABSENSI kolom
 *          A–I (data lama) tidak diubah strukturnya — hanya menambah kolom
 *          J–P di akhir — jadi rollback kode tidak merusak data yang sudah
 *          masuk lewat versi baru (kolom baru cukup diabaikan oleh kode lama).
 * ============================================================
 */

// ------------------------------------------------------------
// SUBMIT ABSENSI (Fase 5 — Selfie + GPS, identitas dari session)
// ------------------------------------------------------------

/** Semua baris 03_DATA_ABSENSI dengan TANGGAL sudah diseragamkan jadi teks "dd/MM/yyyy"
 * (lihat catatan bacaTanggalDMY_ di Utils.gs — perbaikan penting terhadap bug Sheets
 * yang otomatis mengonversi teks tanggal menjadi tipe Date). */
/**
 * DIMEMOISASI PER EKSEKUSI SCRIPT (bukan lintas-request). Diverifikasi
 * AMAN: kedua fungsi yang MENULIS ke sheet Absensi (submitAbsensi,
 * koreksiTanggalOperasionalAbsensi) tidak pernah memanggil fungsi ini
 * LAGI setelah menulis dalam eksekusi yang sama -- jadi tidak ada risiko
 * membaca data basi. Sebelumnya terpanggil sampai belasan kali lintas
 * modul; dalam satu request Dashboard saja bisa 3x baca sheet yang sama.
 */
let _cacheAbsensiRows = null;
function getAbsensiRows_() {
  if (_cacheAbsensiRows) return _cacheAbsensiRows;
  const rows = sheetToObjects(getSheet(NAMA_SHEET.ABSENSI));
  rows.forEach(r => {
    if (r.TANGGAL) r.TANGGAL = bacaTanggalDMY_(r.TANGGAL);
    if (r.JAM) r.JAM = bacaJamHMS_(r.JAM);
  });
  _cacheAbsensiRows = rows;
  return rows;
}

function submitAbsensi(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const relawan = getRelawanById(idRelawan);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tidak aktif. Hubungi admin.');
  }

  const jenis = sanitize(body.jenis).toUpperCase();
  if (jenis !== 'MASUK' && jenis !== 'PULANG') throw new Error('Jenis absensi tidak valid.');

  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  const akurasi = body.akurasi !== undefined && body.akurasi !== null && body.akurasi !== '' ? Number(body.akurasi) : '';
  validasiKoordinat_(lat, lng);

  const fotoBase64 = body.fotoBase64;
  if (!fotoBase64 || typeof fotoBase64 !== 'string' || fotoBase64.length < 100) {
    throw new Error('Swafoto wajib diambil sebelum melakukan absensi.');
  }
  if (fotoBase64.length > 6 * 1024 * 1024) {
    throw new Error('Ukuran foto terlalu besar. Coba ambil ulang swafoto.');
  }

  const keterangan = sanitize(body.keterangan);

  // ----- Validasi lokasi (server WAJIB validasi ulang, tidak percaya frontend) -----
  const lokasi = getLokasiAktif_();
  if (!lokasi) throw new Error('Lokasi SPPG belum diatur oleh Admin. Hubungi admin sebelum melakukan absensi.');

  const jarak = hitungJarakMeter_(lat, lng, lokasi.latitude, lokasi.longitude);
  const statusLokasi = jarak <= lokasi.radiusMeter ? 'DALAM_ZONA' : 'LUAR_ZONA';
  if (statusLokasi === 'LUAR_ZONA') {
    throw new Error('Lokasi Anda berada di luar radius absensi (±' + Math.round(jarak) + ' m dari ' +
      lokasi.nama + ', radius diizinkan ' + lokasi.radiusMeter + ' m). Absensi tidak dapat dilakukan dari lokasi ini.');
  }

  // ----- Tentukan ID_OPERASIONAL & TANGGAL (mendukung lintas tengah malam) -----
  const semuaAbsensiSaya = getAbsensiRows_().filter(a => a.ID_RELAWAN === idRelawan);
  let idOperasional, tanggalOperasional;

  if (jenis === 'MASUK') {
    if (cariMasukTerbuka_(semuaAbsensiSaya)) {
      throw new Error('Anda sudah melakukan absensi masuk dan belum absen pulang. Selesaikan absensi pulang terlebih dahulu.');
    }
    const opHariIni = tentukanOperasionalAktifHariIni_(idRelawan);
    if (!opHariIni) throw new Error('Belum ada operasional aktif untuk absensi hari ini. Hubungi admin.');
    const sudahAda = semuaAbsensiSaya.some(a => a.ID_OPERASIONAL === opHariIni.idOperasional && a.JENIS_ABSENSI === 'MASUK');
    if (sudahAda) throw new Error('Anda sudah melakukan absensi masuk pada operasional ini.');
    idOperasional = opHariIni.idOperasional;
    tanggalOperasional = opHariIni.tanggal;
  } else {
    const masukTerbuka = cariMasukTerbuka_(semuaAbsensiSaya);
    if (!masukTerbuka) throw new Error('Anda belum melakukan absensi masuk. Tidak dapat melakukan absensi pulang.');
    idOperasional = masukTerbuka.ID_OPERASIONAL;
    tanggalOperasional = masukTerbuka.TANGGAL;
    const sudahPulang = semuaAbsensiSaya.some(a => a.ID_OPERASIONAL === idOperasional && a.JENIS_ABSENSI === 'PULANG');
    if (sudahPulang) throw new Error('Anda sudah melakukan absensi pulang pada operasional ini.');
  }

  // ----- Upload foto ke Drive SEBELUM masuk lock, supaya lock dipegang sesingkat mungkin -----
  const now = new Date();
  const fileId = uploadSelfieKeDrive_(fotoBase64, idRelawan, jenis, tanggalOperasional, now);

  // ----- Kunci hanya untuk cek-duplikat-ulang (race condition) + tulis -----
  const lock = LockService.getScriptLock();
  const dapatKunci = lock.tryLock(10000);
  if (!dapatKunci) {
    throw new Error('Sistem sedang sibuk, terlalu banyak yang absen bersamaan. Silakan coba lagi dalam beberapa detik.');
  }

  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idxIdRelawan = headers.indexOf('ID_RELAWAN');
    const idxIdOperasional = headers.indexOf('ID_OPERASIONAL');
    const idxJenis = headers.indexOf('JENIS_ABSENSI');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxIdRelawan]) === idRelawan &&
          String(data[i][idxIdOperasional]) === idOperasional &&
          String(data[i][idxJenis]) === jenis) {
        throw new Error(jenis === 'MASUK'
          ? 'Anda sudah melakukan absensi masuk pada operasional ini.'
          : 'Anda sudah melakukan absensi pulang pada operasional ini.');
      }
    }

    const jam = formatJam(now);
    const nomorBaru = data.length;
    sheet.appendRow([
      nomorBaru, now, tanggalOperasional, jam, idRelawan, relawan.nama, relawan.divisi, jenis, keterangan,
      idOperasional, lat, lng, akurasi, Math.round(jarak), statusLokasi, fileId, ''
    ]);
    // Tulis ulang kolom TANGGAL & JAM sebagai teks murni — lihat catatan paksaKolomTeks_ di Utils.gs.
    const barisBaru = sheet.getLastRow();
    paksaKolomTeks_(sheet, barisBaru, 3);
    sheet.getRange(barisBaru, 3).setValue(tanggalOperasional);
    paksaKolomTeks_(sheet, barisBaru, 4);
    sheet.getRange(barisBaru, 4).setValue(jam);

    return {
      jenis: jenis,
      tanggal: tanggalOperasional,
      jam: formatJamPendek(now),
      idOperasional: idOperasional,
      jarakMeter: Math.round(jarak),
      statusLokasi: statusLokasi,
      fotoUrl: urlFotoReference_(fileId)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Relawan mengajukan Izin/Sakit — SENGAJA tidak memerlukan selfie/GPS
 * (fitur ini sudah ada sejak sebelum Fase 5, dipertahankan sesuai audit —
 * lihat §L dokumen: "Pertahankan fitur Keterangan, audit dulu sebelum
 * mengubah". Selfie+GPS wajib hanya berlaku untuk kehadiran fisik).
 * Ditulis dengan JENIS_ABSENSI='MASUK' + KETERANGAN='Izin'/'Sakit' — sama
 * persis seperti konvensi lama, supaya getRekapHarian/Bulanan/DuaMinggu &
 * getRiwayatAbsensiRelawan di bawah TIDAK PERLU diubah sama sekali.
 */
function ajukanIzinSakit(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const relawan = getRelawanById(idRelawan);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tidak aktif. Hubungi admin.');
  }

  const jenisPengajuan = sanitize(body.jenisPengajuan);
  if (jenisPengajuan !== 'Izin' && jenisPengajuan !== 'Sakit') throw new Error('Jenis pengajuan tidak valid.');
  const keterangan = sanitize(body.keterangan);
  if (!keterangan) throw new Error('Keterangan wajib diisi.');

  const semuaAbsensiSaya = getAbsensiRows_().filter(a => a.ID_RELAWAN === idRelawan);
  if (cariMasukTerbuka_(semuaAbsensiSaya)) {
    throw new Error('Anda sedang berstatus sudah absen masuk dan belum pulang. Tidak dapat mengajukan izin/sakit.');
  }

  const opHariIni = tentukanOperasionalAktifHariIni_(idRelawan);
  if (!opHariIni) throw new Error('Belum ada operasional aktif hari ini.');

  const sudahAda = semuaAbsensiSaya.some(a => a.ID_OPERASIONAL === opHariIni.idOperasional && a.JENIS_ABSENSI === 'MASUK');
  if (sudahAda) throw new Error('Anda sudah tercatat pada operasional ini.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sistem sedang sibuk. Silakan coba lagi.');
  try {
    const sheet = getSheet(NAMA_SHEET.ABSENSI);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const idxIdRelawan = headers.indexOf('ID_RELAWAN');
    const idxIdOperasional = headers.indexOf('ID_OPERASIONAL');
    const idxJenis = headers.indexOf('JENIS_ABSENSI');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxIdRelawan]) === idRelawan &&
          String(data[i][idxIdOperasional]) === opHariIni.idOperasional &&
          String(data[i][idxJenis]) === 'MASUK') {
        throw new Error('Anda sudah tercatat pada operasional ini.');
      }
    }

    const now = new Date();
    const jamPengajuan = formatJam(now);
    const nomorBaru = data.length;
    const statusPengajuan = typeof statusKetepatanPengajuanIzin_ === 'function'
      ? statusKetepatanPengajuanIzin_(idRelawan, opHariIni.idOperasional)
      : ''; // modul Shift belum ada -- kosongkan saja, jangan gagalkan pengajuan
    sheet.appendRow([
      nomorBaru, now, opHariIni.tanggal, jamPengajuan, idRelawan, relawan.nama, relawan.divisi, 'MASUK', jenisPengajuan,
      opHariIni.idOperasional, '', '', '', '', '', '', statusPengajuan
    ]);
    const barisBaru = sheet.getLastRow();
    paksaKolomTeks_(sheet, barisBaru, 3);
    sheet.getRange(barisBaru, 3).setValue(opHariIni.tanggal);
    paksaKolomTeks_(sheet, barisBaru, 4);
    sheet.getRange(barisBaru, 4).setValue(jamPengajuan);
    return { success: true, jenisPengajuan: jenisPengajuan };
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------
// STATUS ABSENSI RELAWAN (dipakai absensi.html — satu panggilan gabungan,
// lihat §47 "jangan request berlebihan": identitas + lokasi SPPG + status
// masuk/pulang hari ini semua dalam satu respons)
// ------------------------------------------------------------

function getStatusAbsensiRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  const lokasi = getLokasiAktif_();
  const semua = getAbsensiRows_().filter(a => a.ID_RELAWAN === idRelawan);

  const masukTerbuka = cariMasukTerbuka_(semua);
  let adaOperasional = false, idOperasional = null, tanggalOperasional = null, hariOperasional = '';
  let masukRow = null, pulangRow = null;

  if (masukTerbuka) {
    adaOperasional = true;
    idOperasional = masukTerbuka.ID_OPERASIONAL;
    tanggalOperasional = masukTerbuka.TANGGAL;
    masukRow = masukTerbuka;
    pulangRow = semua.find(a => a.ID_OPERASIONAL === idOperasional && a.JENIS_ABSENSI === 'PULANG') || null;
  } else {
    const opHariIni = tentukanOperasionalAktifHariIni_(idRelawan);
    if (opHariIni) {
      adaOperasional = true;
      idOperasional = opHariIni.idOperasional;
      tanggalOperasional = opHariIni.tanggal;
      hariOperasional = opHariIni.hari;
      masukRow = semua.find(a => a.ID_OPERASIONAL === idOperasional && a.JENIS_ABSENSI === 'MASUK') || null;
      pulangRow = semua.find(a => a.ID_OPERASIONAL === idOperasional && a.JENIS_ABSENSI === 'PULANG') || null;
    }
  }

  let durasi = null;
  if (masukRow && pulangRow && masukRow.TIMESTAMP instanceof Date && pulangRow.TIMESTAMP instanceof Date) {
    const totalMenit = Math.max(0, Math.round((pulangRow.TIMESTAMP.getTime() - masukRow.TIMESTAMP.getTime()) / 60000));
    durasi = Math.floor(totalMenit / 60) + ' jam ' + (totalMenit % 60) + ' menit';
  }

  return {
    identitas: { id: idRelawan, nama: relawan ? relawan.nama : '', divisi: relawan ? relawan.divisi : '' },
    lokasiSppg: lokasi ? { nama: lokasi.nama, latitude: lokasi.latitude, longitude: lokasi.longitude, radiusMeter: lokasi.radiusMeter } : null,
    operasional: adaOperasional ? { ada: true, idOperasional: idOperasional, tanggal: tanggalOperasional, hari: hariOperasional } : { ada: false },
    masuk: buildDetailAbsensi_(masukRow),
    pulang: buildDetailAbsensi_(pulangRow),
    durasi: durasi
  };
}

function buildDetailAbsensi_(row) {
  if (!row) return { sudah: false };
  return {
    sudah: true,
    jam: row.JAM,
    keterangan: row.KETERANGAN || '',
    isIzinSakit: row.KETERANGAN === 'Izin' || row.KETERANGAN === 'Sakit',
    jarakMeter: row.JARAK_METER !== '' && row.JARAK_METER !== undefined ? Number(row.JARAK_METER) : null,
    statusLokasi: row.STATUS_LOKASI || null,
    fotoUrl: row.FOTO_REFERENCE ? urlFotoReference_(row.FOTO_REFERENCE) : null,
    // BARU: lat/lng AKTUAL saat presensi -- dibutuhkan untuk menampilkan
    // peta lokasi di Dashboard. Koordinat dapur SPPG TETAP TIDAK
    // dikirim dari sini (itu ada terpisah di lokasiSppg, dan frontend
    // sudah diinstruksikan tidak menampilkannya ke relawan).
    latitude: row.LATITUDE !== '' && row.LATITUDE !== undefined ? Number(row.LATITUDE) : null,
    longitude: row.LONGITUDE !== '' && row.LONGITUDE !== undefined ? Number(row.LONGITUDE) : null
  };
}

/**
 * Shift yang masih "terbuka" (MASUK asli — bukan Izin/Sakit — tanpa PULANG
 * yang cocok). Dipakai untuk mendukung lintas tengah malam: relawan yang
 * masuk jam 23:00 kemarin dan belum pulang, saat membuka absensi.html hari
 * ini akan tetap diarahkan ke form PULANG untuk operasional KEMARIN,
 * bukan diminta mengisi MASUK baru untuk hari ini.
 *
 * Hanya mempertimbangkan baris dengan ID_OPERASIONAL terisi (baris lama
 * sebelum Fase 5 dibiarkan kosong di kolom ini) — supaya data historis
 * yang belum termigrasi tidak keliru dianggap sebagai shift yang masih
 * terbuka dan memblokir absensi baru.
 */
function cariMasukTerbuka_(semuaAbsensiSaya) {
  const masukAsli = semuaAbsensiSaya
    .filter(a => a.JENIS_ABSENSI === 'MASUK' && a.KETERANGAN !== 'Izin' && a.KETERANGAN !== 'Sakit' && a.ID_OPERASIONAL)
    .sort((a, b) => {
      const ta = a.TIMESTAMP instanceof Date ? a.TIMESTAMP.getTime() : 0;
      const tb = b.TIMESTAMP instanceof Date ? b.TIMESTAMP.getTime() : 0;
      return tb - ta; // terbaru dulu
    });
  for (const m of masukAsli) {
    const adaPulang = semuaAbsensiSaya.some(a => a.ID_OPERASIONAL === m.ID_OPERASIONAL && a.JENIS_ABSENSI === 'PULANG');
    if (!adaPulang) return m;
  }
  return null;
}

/**
 * Operasional AKTIF pada Kalender Operasional untuk absen MASUK "sekarang".
 *
 * PERBAIKAN (lintas tengah malam, menyusul Fase 5): versi sebelumnya HANYA
 * mencocokkan ke tanggal HARI INI persis. Itu benar untuk shift siang/reguler,
 * tapi salah untuk shift malam yang baru MULAI sebelum tengah malam sementara
 * entri Kalender-nya dibuat untuk hari PRODUKSI (besok) — mis. relawan absen
 * Masuk jam 23:00 tanggal 30, padahal Kalender Operasional cuma punya entri
 * AKTIF tanggal 31. Sebelum perbaikan ini, itu selalu gagal dengan pesan
 * "Belum ada operasional aktif", walau Admin tidak salah input apa pun.
 *
 * Urutan pencarian sekarang:
 *   1) Tanggal HARI INI (diutamakan — mencakup semua shift siang/reguler).
 *   2) Kalau tidak ketemu DAN jam sekarang >= JAM_MULAI_CEK_OPERASIONAL_BESOK
 *      (lihat Utils.gs), coba tanggal BESOK — shift malam yang baru dimulai
 *      dianggap menempel ke hari produksi besok, TANPA Admin perlu membuat
 *      entri Kalender terpisah untuk hari ini.
 *
 * Absen PULANG tidak lewat fungsi ini — itu selalu mengikuti ID_OPERASIONAL
 * dari MASUK yang masih terbuka (lihat cariMasukTerbuka_), jadi otomatis
 * konsisten dengan tanggal operasional yang dipilih saat MASUK, berapa pun
 * lama shift-nya berlangsung.
 */
function tentukanOperasionalAktifHariIni_(idRelawan) {
  const now = new Date();
  const semuaKalender = getKalenderRows_();

  const hariIni = formatTanggal(now);
  const jamMenitSekarang = Utilities.formatDate(now, ZONA_WAKTU, 'HH:mm');

  // Tanggal besok dihitung dari komponen dd/MM/yyyy milik ZONA_WAKTU
  // (bukan getFullYear/getMonth/getDate langsung dari `now`, yang ikut
  // timezone proyek Apps Script) — supaya "besok" selalu benar walau
  // timezone proyek belum diset eksplisit ke Asia/Jakarta.
  const [ddStr, mmStr, yyyyStr] = hariIni.split('/');
  const besok = new Date(Number(yyyyStr), Number(mmStr) - 1, Number(ddStr) + 1);
  const tanggalBesok = formatTanggal(besok);
  const cocokBesok = semuaKalender.find(k => k.TANGGAL_OPERASIONAL === tanggalBesok && k.STATUS === 'AKTIF');

  // ============================================================
  // INTEGRASI SHIFT (Fase 3+4): kalau relawan diketahui dan modul Shift
  // sudah punya jam masuk untuk divisinya pada operasional BESOK, dan jam
  // sekarang sudah masuk jendela shift itu (toleransi datang awal 60
  // menit), PRIORITASKAN besok -- WALAU hari ini kebetulan juga punya
  // entri aktif (kasus nyata: siang masih operasional hari ini, tapi
  // malam ini sudah masuk jam shift untuk operasional besok, mis. Tim
  // Persiapan 17:00). Tanpa ini, kode LAMA di bawah selalu memenangkan
  // "hari ini" duluan kalau hari ini kebetulan juga aktif -- itu akar
  // masalah salah-tanggal yang pernah terjadi.
  //
  // Dibungkus try/catch dan cek `typeof` supaya TETAP AMAN kalau Shift.gs
  // belum sempat ditambahkan ke proyek (fallback otomatis ke logika lama).
  // ============================================================
  if (idRelawan && cocokBesok && typeof jamMulaiShiftDenganToleransi_ === 'function') {
    try {
      const batasAwal = jamMulaiShiftDenganToleransi_(idRelawan, cocokBesok.ID_OPERASIONAL, 60);
      if (batasAwal && jamMenitSekarang >= batasAwal) {
        return { idOperasional: cocokBesok.ID_OPERASIONAL, tanggal: cocokBesok.TANGGAL_OPERASIONAL, hari: cocokBesok.HARI };
      }
    } catch (errShift) {
      // Data Shift belum lengkap/valid untuk relawan ini -- abaikan, lanjut ke logika lama di bawah.
    }
  }

  // ----- Logika LAMA (dipertahankan persis, jadi fallback wajib) -----
  const cocokHariIni = semuaKalender.find(k => k.TANGGAL_OPERASIONAL === hariIni && k.STATUS === 'AKTIF');
  if (cocokHariIni) {
    return { idOperasional: cocokHariIni.ID_OPERASIONAL, tanggal: cocokHariIni.TANGGAL_OPERASIONAL, hari: cocokHariIni.HARI };
  }

  const jamSekarang = Number(Utilities.formatDate(now, ZONA_WAKTU, 'H'));
  if (jamSekarang >= JAM_MULAI_CEK_OPERASIONAL_BESOK && cocokBesok) {
    return { idOperasional: cocokBesok.ID_OPERASIONAL, tanggal: cocokBesok.TANGGAL_OPERASIONAL, hari: cocokBesok.HARI };
  }

  return null;
}

// ------------------------------------------------------------
// GOOGLE DRIVE — PENYIMPANAN SELFIE
// Struktur: ABSENSI_SELFIE/TAHUN/BULAN/DD-MM-YYYY/ID_JENIS_HHmmss.jpg
// Spreadsheet hanya menyimpan FILE_ID (kolom FOTO_REFERENCE) sebagai
// referensi — bukan file gambar itu sendiri (§P dokumen pengembangan).
// ------------------------------------------------------------

function uploadSelfieKeDrive_(fotoBase64, idRelawan, jenis, tanggalOperasionalDMY, now) {
  try {
    const base64Bersih = String(fotoBase64).replace(/^data:image\/\w+;base64,/, '');
    const bytes = Utilities.base64Decode(base64Bersih);
    const blob = Utilities.newBlob(bytes, 'image/jpeg');

    const bagian = tanggalOperasionalDMY.split('/');
    const dd = bagian[0], mm = bagian[1], yyyy = bagian[2];

    const root = getOrCreateFolder_(DriveApp.getRootFolder(), 'ABSENSI_SELFIE');
    const folderTahun = getOrCreateFolder_(root, yyyy);
    const folderBulan = getOrCreateFolder_(folderTahun, mm);
    const folderTanggal = getOrCreateFolder_(folderBulan, dd + '-' + mm + '-' + yyyy);

    const stempel = Utilities.formatDate(now, ZONA_WAKTU, 'HHmmss');
    blob.setName(idRelawan + '_' + jenis + '_' + stempel + '.jpg');

    const file = folderTanggal.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getId();
  } catch (err) {
    console.error('[uploadSelfieKeDrive_]', err.message);
    throw new Error('Gagal mengunggah foto ke penyimpanan. Silakan coba lagi.');
  }
}

function getOrCreateFolder_(parent, nama) {
  const existing = parent.getFoldersByName(nama);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(nama);
}

function urlFotoReference_(fileId) {
  if (!fileId) return null;
  // PERBAIKAN: format "uc?export=view" sering gagal tampil sebagai <img> --
  // Google kadang mengarahkannya ke halaman peringatan/scan virus alih-alih
  // gambar mentah, terutama saat diakses berulang kali (hotlink). Format
  // "thumbnail" di bawah ini disajikan lewat CDN gambar Google yang jauh
  // lebih stabil untuk ditampilkan langsung di tag <img>.
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';
}

// ------------------------------------------------------------
// DAFTAR ABSENSI (Admin — tidak diubah dari versi sebelumnya)
// ------------------------------------------------------------

function getAbsensiList(params) {
  const rows = getAbsensiRows_();
  return rows.filter(r => {
    if (params.tanggal && r.TANGGAL !== params.tanggal) return false;
    if (params.divisi && r.DIVISI !== params.divisi) return false;
    if (params.nama && r.NAMA_RELAWAN !== params.nama) return false;
    return true;
  });
}

// ------------------------------------------------------------
// REKAP HARIAN — TIDAK DIUBAH (masih mengelompokkan berdasarkan TANGGAL,
// yang sekarang diisi dari TANGGAL_OPERASIONAL — tetap benar tanpa perubahan)
// ------------------------------------------------------------

function getRekapHarian(tanggal) {
  if (!tanggal) tanggal = formatTanggal(new Date());

  const relawanList = getRelawanList(null, false); // hanya yang berstatus AKTIF
  const absensiHariIni = getAbsensiRows_().filter(a => a.TANGGAL === tanggal);

  const rekap = relawanList.map(r => {
    const recMasuk = absensiHariIni.find(a => a.ID_RELAWAN === r.id && a.JENIS_ABSENSI === 'MASUK');
    const recPulang = absensiHariIni.find(a => a.ID_RELAWAN === r.id && a.JENIS_ABSENSI === 'PULANG');
    const recIzinSakit = absensiHariIni.find(a => a.ID_RELAWAN === r.id && (a.KETERANGAN === 'Izin' || a.KETERANGAN === 'Sakit'));

    let status = 'BELUM ABSEN';
    let keterangan = '';

    if (recIzinSakit) {
      status = String(recIzinSakit.KETERANGAN).toUpperCase();
      keterangan = recIzinSakit.KETERANGAN;
    } else if (recMasuk) {
      status = (typeof apakahTerlambatShiftAware_ === 'function' ? apakahTerlambatShiftAware_(r.id, recMasuk.ID_OPERASIONAL, recMasuk.JAM) : apakahTerlambat(recMasuk.JAM)) ? 'TERLAMBAT' : 'HADIR';
      keterangan = recMasuk.KETERANGAN || '';
    }

    return {
      id: r.id,
      nama: r.nama,
      divisi: r.divisi,
      jamMasuk: recMasuk ? recMasuk.JAM : '',
      jamPulang: recPulang ? recPulang.JAM : '',
      status: status,
      keterangan: keterangan,
      statusPengajuan: recIzinSakit ? (recIzinSakit.STATUS_PENGAJUAN || '') : '',
      lokasiMasuk: buildLokasiRingkas_(recMasuk),
      lokasiPulang: buildLokasiRingkas_(recPulang),
      fotoMasukUrl: recMasuk && recMasuk.FOTO_REFERENCE ? urlFotoReference_(recMasuk.FOTO_REFERENCE) : null,
      fotoPulangUrl: recPulang && recPulang.FOTO_REFERENCE ? urlFotoReference_(recPulang.FOTO_REFERENCE) : null
    };
  });

  try { simpanRekapHarianKeSheet(tanggal, rekap); } catch (e) { /* jangan gagalkan permintaan utama */ }

  return { tanggal: tanggal, data: rekap };
}

/** Ringkasan lokasi utk kolom Rekap Admin, mis. "18 m · Dalam Zona". null kalau baris tidak punya data GPS (Izin/Sakit/belum absen/data lama). */
function buildLokasiRingkas_(rec) {
  if (!rec || rec.JARAK_METER === '' || rec.JARAK_METER === undefined || rec.JARAK_METER === null) return null;
  const zona = rec.STATUS_LOKASI === 'DALAM_ZONA' ? 'Dalam Zona' : (rec.STATUS_LOKASI === 'LUAR_ZONA' ? 'Luar Zona' : '');
  return Math.round(Number(rec.JARAK_METER)) + ' m' + (zona ? ' · ' + zona : '');
}

function simpanRekapHarianKeSheet(tanggal, rekap) {
  const sheet = getSheet(NAMA_SHEET.REKAP_HARIAN);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === tanggal) sheet.deleteRow(i + 1);
  }
  if (!rekap.length) return;
  const rows = rekap.map(r => [tanggal, r.id, r.nama, r.divisi, r.jamMasuk, r.jamPulang, r.status, r.keterangan]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ------------------------------------------------------------
// REKAP BULANAN — TIDAK DIUBAH
// ------------------------------------------------------------

function getRekapBulanan(bulan, tahun) {
  const now = new Date();
  bulan = Number(bulan) || Number(Utilities.formatDate(now, ZONA_WAKTU, 'M'));
  tahun = Number(tahun) || Number(Utilities.formatDate(now, ZONA_WAKTU, 'yyyy'));

  const relawanList = getRelawanList(null, false);
  const semuaAbsensi = getAbsensiRows_();

  const absensiBulanIni = semuaAbsensi.filter(a => {
    const bagian = String(a.TANGGAL).split('/');
    return bagian.length === 3 && Number(bagian[1]) === bulan && Number(bagian[2]) === tahun;
  });

  const tanggalUnik = Array.from(new Set(absensiBulanIni.map(a => a.TANGGAL)));

  const rekap = relawanList.map(r => {
    const recAbsensi = absensiBulanIni.filter(a => a.ID_RELAWAN === r.id);
    let hadir = 0, terlambat = 0, izin = 0, sakit = 0;
    const tanggalTercatat = new Set();

    recAbsensi.forEach(a => {
      if (tanggalTercatat.has(a.TANGGAL)) return;
      if (a.KETERANGAN === 'Izin') { izin++; tanggalTercatat.add(a.TANGGAL); }
      else if (a.KETERANGAN === 'Sakit') { sakit++; tanggalTercatat.add(a.TANGGAL); }
      else if (a.JENIS_ABSENSI === 'MASUK') {
        if ((typeof apakahTerlambatShiftAware_ === 'function' ? apakahTerlambatShiftAware_(r.id, a.ID_OPERASIONAL, a.JAM) : apakahTerlambat(a.JAM))) terlambat++; else hadir++;
        tanggalTercatat.add(a.TANGGAL);
      }
    });

    const tidakHadir = Math.max(0, tanggalUnik.length - (hadir + terlambat + izin + sakit));

    return { id: r.id, nama: r.nama, divisi: r.divisi, hadir: hadir, terlambat: terlambat, izin: izin, sakit: sakit, tidakHadir: tidakHadir };
  });

  try { simpanRekapBulananKeSheet(bulan, tahun, rekap); } catch (e) { /* jangan gagalkan permintaan utama */ }

  return { bulan: bulan, tahun: tahun, data: rekap };
}

function simpanRekapBulananKeSheet(bulan, tahun, rekap) {
  const sheet = getSheet(NAMA_SHEET.REKAP_BULANAN);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (Number(data[i][0]) === bulan && Number(data[i][1]) === tahun) sheet.deleteRow(i + 1);
  }
  if (!rekap.length) return;
  const rows = rekap.map(r => [bulan, tahun, r.id, r.nama, r.divisi, r.hadir, r.terlambat, r.izin, r.sakit, r.tidakHadir]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ------------------------------------------------------------
// REKAP 2 MINGGU — TIDAK DIUBAH
// ------------------------------------------------------------

function tanggalSheetKeIso_(tanggalSheet) {
  const bagian = String(tanggalSheet).split('/');
  if (bagian.length !== 3) return null;
  const dd = bagian[0].padStart(2, '0');
  const mm = bagian[1].padStart(2, '0');
  const yyyy = bagian[2];
  return yyyy + '-' + mm + '-' + dd;
}

function getRekapDuaMinggu(periodeAwal, periodeAkhir) {
  periodeAwal = sanitize(periodeAwal);
  periodeAkhir = sanitize(periodeAkhir);
  if (!periodeAwal || !periodeAkhir) throw new Error('Periode awal dan akhir wajib diisi.');
  if (periodeAwal > periodeAkhir) throw new Error('Periode awal tidak boleh setelah periode akhir.');

  const relawanList = getRelawanList(null, false);
  const semuaAbsensi = getAbsensiRows_();

  const absensiPeriode = semuaAbsensi.filter(a => {
    const iso = tanggalSheetKeIso_(a.TANGGAL);
    return iso && iso >= periodeAwal && iso <= periodeAkhir;
  });

  const tanggalUnik = Array.from(new Set(absensiPeriode.map(a => a.TANGGAL)));
  const totalHariKerja = tanggalUnik.length;

  const rekap = relawanList.map(r => {
    const recAbsensi = absensiPeriode.filter(a => a.ID_RELAWAN === r.id);
    let hadir = 0, terlambat = 0, izin = 0, sakit = 0;
    const tanggalTercatat = new Set();

    recAbsensi.forEach(a => {
      if (tanggalTercatat.has(a.TANGGAL)) return;
      if (a.KETERANGAN === 'Izin') { izin++; tanggalTercatat.add(a.TANGGAL); }
      else if (a.KETERANGAN === 'Sakit') { sakit++; tanggalTercatat.add(a.TANGGAL); }
      else if (a.JENIS_ABSENSI === 'MASUK') {
        if ((typeof apakahTerlambatShiftAware_ === 'function' ? apakahTerlambatShiftAware_(r.id, a.ID_OPERASIONAL, a.JAM) : apakahTerlambat(a.JAM))) terlambat++; else hadir++;
        tanggalTercatat.add(a.TANGGAL);
      }
    });

    const tidakHadir = Math.max(0, totalHariKerja - (hadir + terlambat + izin + sakit));

    return {
      id: r.id, nama: r.nama, divisi: r.divisi,
      hadir: hadir, terlambat: terlambat, izin: izin, sakit: sakit,
      tidakHadir: tidakHadir, totalHariKerja: totalHariKerja
    };
  });

  try { simpanRekapDuaMingguKeSheet(periodeAwal, periodeAkhir, rekap); } catch (e) { /* jangan gagalkan permintaan utama */ }

  return { periodeAwal: periodeAwal, periodeAkhir: periodeAkhir, totalHariKerja: totalHariKerja, data: rekap };
}

function simpanRekapDuaMingguKeSheet(periodeAwal, periodeAkhir, rekap) {
  const sheet = getSheet(NAMA_SHEET.REKAP_DUA_MINGGU);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === periodeAwal && String(data[i][1]) === periodeAkhir) sheet.deleteRow(i + 1);
  }
  if (!rekap.length) return;
  const rows = rekap.map(r => [
    periodeAwal, periodeAkhir, r.id, r.nama, r.divisi,
    r.hadir, r.terlambat, r.izin, r.sakit, r.tidakHadir, r.totalHariKerja
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ------------------------------------------------------------
// RIWAYAT ABSENSI RELAWAN — TIDAK DIUBAH
// ------------------------------------------------------------

// ------------------------------------------------------------
// RIWAYAT ABSENSI RELAWAN
// PERBAIKAN (Fase 4): sebelumnya berbasis 14 hari KALENDER mundur apa
// adanya -- tanggal yang bukan hari operasional (libur/belum ada jadwal)
// ikut ditandai "Tidak Hadir" secara keliru. Sekarang berbasis Kalender
// Operasional yang Admin buat (2 periode terbaru), dan membedakan:
//   - "Tidak Hadir"      : ada shift/penugasan tapi tidak ada presensi
//   - "Tidak Ada Jadwal" : relawan memang tidak diketahui bertugas hari
//                          itu (sesuai §53 -- jangan dianggap tidak hadir
//                          kalau tidak ada shift/penugasan sama sekali)
// Kalau modul Shift belum ada, otomatis fallback ke "Tidak Hadir" seperti
// perilaku lama (aman, tidak breaking).
// ------------------------------------------------------------

function getRiwayatAbsensiRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const semuaAbsensi = getAbsensiRows_();
  const milikSaya = semuaAbsensi.filter(a => a.ID_RELAWAN === idRelawan);

  // 2 periode terbaru (getPeriodeListAdmin sudah urut terbaru dulu)
  const periodeTerbaru = getPeriodeListAdmin().slice(0, 2);
  const idPeriodeSet = {};
  periodeTerbaru.forEach(p => { idPeriodeSet[p.id] = true; });

  const hariIniIso = tanggalSheetKeIso_(formatTanggal(new Date()));

  const daftarOperasional = getKalenderRows_()
    .filter(k => idPeriodeSet[k.ID_PERIODE] && String(k.STATUS).toUpperCase() === 'AKTIF')
    .filter(k => {
      const iso = tanggalSheetKeIso_(k.TANGGAL_OPERASIONAL);
      return iso && iso <= hariIniIso; // riwayat = masa lalu, jangan tampilkan tanggal yang belum terjadi
    })
    .sort((a, b) => tanggalSheetKeIso_(b.TANGGAL_OPERASIONAL).localeCompare(tanggalSheetKeIso_(a.TANGGAL_OPERASIONAL)));

  return daftarOperasional.map(k => {
    const recHariItu = milikSaya.filter(a => a.ID_OPERASIONAL === k.ID_OPERASIONAL);
    const masuk = recHariItu.find(a => a.JENIS_ABSENSI === 'MASUK');
    const pulang = recHariItu.find(a => a.JENIS_ABSENSI === 'PULANG');

    let status;
    let keterangan = '';
    if (masuk && masuk.KETERANGAN === 'Izin') {
      status = 'Izin'; keterangan = masuk.KETERANGAN;
    } else if (masuk && masuk.KETERANGAN === 'Sakit') {
      status = 'Sakit'; keterangan = masuk.KETERANGAN;
    } else if (masuk) {
      status = (typeof apakahTerlambatShiftAware_ === 'function' ? apakahTerlambatShiftAware_(idRelawan, masuk.ID_OPERASIONAL, masuk.JAM) : apakahTerlambat(masuk.JAM)) ? 'Terlambat' : 'Hadir';
      keterangan = masuk.KETERANGAN || '';
    } else {
      const adaShift = typeof resolveShiftUntukRelawan_ === 'function'
        ? !!resolveShiftUntukRelawan_(idRelawan, k.ID_OPERASIONAL)
        : null; // modul Shift belum dipasang -- tidak bisa dipastikan, fallback ke perilaku lama
      status = (adaShift === false) ? 'Tidak Ada Jadwal' : 'Tidak Hadir';
    }

    return {
      tanggal: k.TANGGAL_OPERASIONAL,
      hari: k.HARI,
      jamMasuk: masuk ? masuk.JAM : '',
      jamPulang: pulang ? pulang.JAM : '',
      status: status,
      keterangan: keterangan
    };
  });
}

/**
 * REKAP DETAIL untuk Export (CSV/PDF) — beda dari getRekapDuaMinggu yang
 * cuma ringkasan angka (jumlah hadir/terlambat dst). Ini rincian PER HARI
 * PER RELAWAN, sesuai kebutuhan laporan resmi: nama, divisi, tanggal,
 * jam masuk, jam pulang, status.
 */
function getRekapDetailUntukExport(token, periodeAwal, periodeAkhir) {
  requireAuth(token);
  periodeAwal = sanitize(periodeAwal);
  periodeAkhir = sanitize(periodeAkhir);
  if (!periodeAwal || !periodeAkhir) throw new Error('Periode awal dan akhir wajib diisi.');
  if (periodeAwal > periodeAkhir) throw new Error('Periode awal tidak boleh setelah periode akhir.');

  const relawanList = getRelawanList(null, false);
  const namaById = {}; const divisiById = {};
  relawanList.forEach(r => { namaById[r.id] = r.nama; divisiById[r.id] = r.divisi; });

  const semuaAbsensi = getAbsensiRows_().filter(a => {
    const iso = tanggalSheetKeIso_(a.TANGGAL);
    return iso && iso >= periodeAwal && iso <= periodeAkhir;
  });

  // Kelompokkan per (relawan, tanggal) supaya MASUK & PULANG jadi 1 baris.
  const kunciMap = {};
  semuaAbsensi.forEach(a => {
    const kunci = a.ID_RELAWAN + '|' + a.TANGGAL;
    if (!kunciMap[kunci]) kunciMap[kunci] = { idRelawan: a.ID_RELAWAN, tanggal: a.TANGGAL, jamMasuk: '', jamPulang: '', keterangan: '', idOperasional: a.ID_OPERASIONAL };
    if (a.JENIS_ABSENSI === 'MASUK') { kunciMap[kunci].jamMasuk = a.JAM; kunciMap[kunci].keterangan = a.KETERANGAN || ''; }
    if (a.JENIS_ABSENSI === 'PULANG') kunciMap[kunci].jamPulang = a.JAM;
  });

  const hasil = Object.values(kunciMap).map(r => {
    let status;
    if (r.keterangan === 'Izin') status = 'Izin';
    else if (r.keterangan === 'Sakit') status = 'Sakit';
    else if (r.jamMasuk) {
      const telat = (typeof apakahTerlambatShiftAware_ === 'function') ? apakahTerlambatShiftAware_(r.idRelawan, r.idOperasional, r.jamMasuk) : apakahTerlambat(r.jamMasuk);
      status = telat ? 'Terlambat' : 'Hadir';
    } else status = 'Tidak Hadir';

    return {
      nama: namaById[r.idRelawan] || r.idRelawan,
      divisi: divisiById[r.idRelawan] || '-',
      tanggal: r.tanggal,
      jamMasuk: r.jamMasuk || '-',
      jamPulang: r.jamPulang || '-',
      status: status
    };
  }).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.nama.localeCompare(b.nama));

  return { periodeAwal: periodeAwal, periodeAkhir: periodeAkhir, data: hasil };
}

/** Tren kehadiran 7 hari terakhir -- dipakai grafik ringan Dashboard Admin. */
function getTrenKehadiran7Hari(token) {
  requireAuth(token);
  const relawanAktifCount = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).filter(r => String(r.STATUS).toUpperCase() === 'AKTIF').length;
  const semuaAbsensi = getAbsensiRows_();

  const hasil = [];
  for (let i = 6; i >= 0; i--) {
    const tgl = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const tglIso = tanggalSheetKeIso_(formatTanggal(tgl));
    const hadirHariItu = new Set();
    semuaAbsensi.forEach(a => {
      if (a.JENIS_ABSENSI === 'MASUK' && tanggalSheetKeIso_(a.TANGGAL) === tglIso) hadirHariItu.add(a.ID_RELAWAN);
    });
    hasil.push({
      tanggal: Utilities.formatDate(tgl, Session.getScriptTimeZone(), 'dd/MM'),
      hadir: hadirHariItu.size,
      totalRelawan: relawanAktifCount
    });
  }
  return hasil;
}

/**
 * DASHBOARD LENGKAP — 1 pemanggilan untuk seluruh data yang dibutuhkan
 * Dashboard relawan (hemat request, sesuai prinsip "jangan request
 * berkali-kali"). SENGAJA memanggil ULANG fungsi-fungsi yang SUDAH ADA
 * (getStatusAbsensiRelawan, getStatusOperasionalHariIni, getJadwalRelawan,
 * getRiwayatAbsensiRelawan, getInformasiRelawan) -- BUKAN menulis ulang
 * logicnya di sini, supaya tidak ada 2 sumber kebenaran yang bisa beda.
 */
function getDashboardLengkapRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  const akun = cariAkunByIdRelawan_(idRelawan);

  const presensi = getStatusAbsensiRelawan(token);
  const statusOperasional = getStatusOperasionalHariIni();

  // JADWAL SAYA -- SUMBER DIALIHKAN ke Shift & Koreksi (getJadwalSayaHariIni)
  // sesuai instruksi konsolidasi. Jadwal.gs (manual lama) TIDAK LAGI dipakai
  // sebagai sumber di sini -- lihat catatan DEPRECATED di Jadwal.gs.
  let jadwalHariIni = null;
  try {
    const j = getJadwalSayaHariIni(token);
    if (j.ada) jadwalHariIni = { waktu: j.waktu, penugasan: j.penugasan, status: j.status };
  } catch (e) { /* modul Shift mungkin belum diisi Admin -- Dashboard tetap tampil tanpa bagian ini */ }

  // Ringkasan Kehadiran (4 kategori: Total Hadir/Terlambat/Izin-Sakit/Tidak
  // Hadir) -- dihitung dari getRiwayatAbsensiRelawan yang SUDAH ADA.
  let ringkasanKehadiran = { totalHadir: 0, terlambat: 0, izinSakit: 0, tidakHadir: 0 };
  try {
    const riwayat = getRiwayatAbsensiRelawan(token);
    (riwayat.items || []).forEach(item => {
      if (item.status === 'Hadir') ringkasanKehadiran.totalHadir++;
      else if (item.status === 'Terlambat') { ringkasanKehadiran.totalHadir++; ringkasanKehadiran.terlambat++; }
      else if (item.status === 'Izin' || item.status === 'Sakit') ringkasanKehadiran.izinSakit++;
      else if (item.status === 'Tidak Hadir') ringkasanKehadiran.tidakHadir++;
    });
  } catch (e) { /* diamkan -- tampilkan 0 kalau gagal, jangan gagalkan seluruh Dashboard */ }

  // Informasi Penting -- 5 item teratas saja dari getInformasiRelawan yang SUDAH ADA.
  let informasiPenting = [];
  try { informasiPenting = getInformasiRelawan(token).slice(0, 5); } catch (e) { /* diamkan */ }

  return {
    identitas: {
      nama: relawan ? relawan.nama : '',
      id: idRelawan,
      divisi: relawan ? relawan.divisi : '',
      statusAkun: akun ? String(akun.data[akun.idx.STATUS_AKUN] || '').toUpperCase() : '',
      fotoProfilUrl: (akun && akun.idx.FOTO_PROFIL !== undefined && akun.data[akun.idx.FOTO_PROFIL])
        ? urlFotoReference_(akun.data[akun.idx.FOTO_PROFIL]) : null
    },
    statusOperasional: statusOperasional,
    jadwalHariIni: jadwalHariIni,
    presensiHariIni: presensi,
    ringkasanKehadiran: ringkasanKehadiran,
    informasiPenting: informasiPenting
  };
}
