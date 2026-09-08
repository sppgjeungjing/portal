/**
 * PushNotifikasi.gs — Notifikasi ke notification tray HP relawan lewat
 * Firebase Cloud Messaging (FCM). Backend tetap Apps Script + Spreadsheet
 * sesuai aturan proyek -- FCM cuma "jembatan pengiriman", bukan hosting/
 * database baru.
 *
 * ISI DULU 3 SCRIPT PROPERTY INI SEBELUM DIPAKAI (Project Settings >
 * Script Properties di Apps Script):
 *   FCM_PROJECT_ID           -- dari firebaseConfig.projectId
 *   FCM_SERVICE_ACCOUNT_EMAIL -- dari file JSON service account, field "client_email"
 *   FCM_SERVICE_ACCOUNT_KEY   -- dari file JSON service account, field "private_key"
 *                                (termasuk baris -----BEGIN PRIVATE KEY-----)
 *
 * Kolom baru yang perlu ditambahkan manual di 07_AKUN_RELAWAN:
 *   FCM_TOKEN            -- token perangkat relawan (diisi otomatis oleh sistem)
 *   NOTIF_HP_AKTIF       -- TRUE/FALSE, relawan boleh menonaktifkan
 *   TERAKHIR_DIINGATKAN  -- dipakai supaya tidak spam (1x per hari per jenis)
 */

// ------------------------------------------------------------
// SIMPAN TOKEN PERANGKAT
// ------------------------------------------------------------

function simpanTokenPushNotifikasi(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  if (akun.idx.FCM_TOKEN === undefined) {
    throw new Error('Kolom FCM_TOKEN belum ada di 07_AKUN_RELAWAN. Tambahkan dulu kolom ini.');
  }

  const sheet = getAkunSheet();
  sheet.getRange(akun.baris, akun.idx.FCM_TOKEN + 1).setValue(sanitize(body.fcmToken));
  if (akun.idx.NOTIF_HP_AKTIF !== undefined) {
    sheet.getRange(akun.baris, akun.idx.NOTIF_HP_AKTIF + 1).setValue(true);
  }
  return { success: true };
}

function nonaktifkanPushNotifikasi(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun || akun.idx.NOTIF_HP_AKTIF === undefined) return { success: true };
  getAkunSheet().getRange(akun.baris, akun.idx.NOTIF_HP_AKTIF + 1).setValue(false);
  return { success: true };
}

// ------------------------------------------------------------
// INTI PENGIRIMAN (FCM HTTP v1 API + OAuth2 Service Account)
// ------------------------------------------------------------

/** Base64url encode -- FCM/JWT butuh varian ini, beda dikit dari base64 biasa. */
function _base64UrlEncode_(bytesAtauTeks) {
  let base64;
  if (typeof bytesAtauTeks === 'string') {
    base64 = Utilities.base64Encode(bytesAtauTeks, Utilities.Charset.UTF_8);
  } else {
    base64 = Utilities.base64Encode(bytesAtauTeks);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Ambil OAuth2 access token pakai Service Account (JWT Bearer flow) --
 * pola standar Google, satu-satunya cara resmi memanggil FCM HTTP v1 API.
 * Token di-cache 55 menit (kadaluarsa asli 1 jam) supaya tidak generate
 * ulang di setiap pengiriman.
 */
function _ambilAccessTokenFcm_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('fcm_access_token');
  if (cached) return cached;

  const email = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT_EMAIL');
  let privateKey = PropertiesService.getScriptProperties().getProperty('FCM_SERVICE_ACCOUNT_KEY');
  if (!email || !privateKey) {
    throw new Error('FCM_SERVICE_ACCOUNT_EMAIL / FCM_SERVICE_ACCOUNT_KEY belum diisi di Script Properties.');
  }
  // Kalau di-paste sebagai teks literal "\n" (dua karakter, bukan baris
  // baru sungguhan -- ini yang paling sering terjadi kalau copy-paste dari
  // file JSON), ubah dulu jadi baris baru asli supaya PEM-nya valid.
  privateKey = privateKey.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const bagianHeader = _base64UrlEncode_(JSON.stringify(header));
  const bagianClaim = _base64UrlEncode_(JSON.stringify(claim));
  const input = bagianHeader + '.' + bagianClaim;

  const signatureBytes = Utilities.computeRsaSha256Signature(input, privateKey);
  const jwt = input + '.' + _base64UrlEncode_(signatureBytes);

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  const hasil = JSON.parse(resp.getContentText());
  if (!hasil.access_token) {
    throw new Error('Gagal ambil access token FCM: ' + resp.getContentText());
  }
  cache.put('fcm_access_token', hasil.access_token, 55 * 60);
  return hasil.access_token;
}

/**
 * Kirim 1 notifikasi push ke 1 relawan. Dipakai internal saja (nama
 * berakhiran _) -- dipanggil dari fungsi-fungsi pengecekan otomatis di
 * bawah, atau bisa dipanggil manual dari Admin nanti.
 * Kegagalan kirim TIDAK melempar error ke pemanggil -- supaya 1 relawan
 * yang tokennya kadaluarsa tidak menghentikan proses untuk relawan lain.
 */
function kirimPushNotifikasi_(idRelawan, judul, isiPesan, dataTambahan) {
  try {
    const akun = cariAkunByIdRelawan_(idRelawan);
    if (!akun || akun.idx.FCM_TOKEN === undefined) return false;

    const token = akun.data[akun.idx.FCM_TOKEN];
    if (!token) return false; // relawan belum pernah mengizinkan notifikasi

    if (akun.idx.NOTIF_HP_AKTIF !== undefined && akun.data[akun.idx.NOTIF_HP_AKTIF] === false) {
      return false; // relawan sudah matikan notifikasi HP
    }

    const projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
    const accessToken = _ambilAccessTokenFcm_();

    const payload = {
      message: {
        token: token,
        notification: { title: judul, body: isiPesan },
        webpush: {
          notification: { icon: 'assets/icon-192.png' },
          fcm_options: { link: (dataTambahan && dataTambahan.link) || '/' }
        }
      }
    };

    const resp = UrlFetchApp.fetch(
      'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send',
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + accessToken },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    return resp.getResponseCode() === 200;
  } catch (e) {
    Logger.log('Gagal kirim push ke ' + idRelawan + ': ' + e.message);
    return false;
  }
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #1: BELUM ABSEN MASUK
// Dipanggil dari time-driven trigger (lihat panduan) -- mengecek semua
// relawan yang operasionalnya sudah berjalan tapi belum absen masuk.
// ------------------------------------------------------------

function cekBelumAbsenDanKirimPush() {
  const hariIni = formatTanggal(new Date());
  const semuaRelawanAktif = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN))
    .filter(r => String(r.STATUS).toUpperCase() === 'AKTIF');
  const semuaAbsensiHariIni = getAbsensiRows_().filter(a => {
    const tgl = tanggalSheetKeIso_(a.TANGGAL_OPERASIONAL || '');
    return tgl === tanggalSheetKeIso_(hariIni);
  });

  const jamSekarang = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  let terkirim = 0;

  semuaRelawanAktif.forEach(r => {
    // Lewati kalau sudah absen masuk hari ini
    const sudahAbsen = semuaAbsensiHariIni.some(a => a.ID_RELAWAN === r.ID_RELAWAN && a.JENIS_ABSENSI === 'MASUK');
    if (sudahAbsen) return;

    // Cek operasional & jam shift relawan ini (pakai resolusi divisi-aware
    // dari Fase 3 -- SAMA yang dipakai halaman Absensi relawan sendiri)
    let jamMasukShift = null;
    try {
      const operasional = tentukanOperasionalAktifHariIni_(r.ID_RELAWAN);
      if (!operasional) return; // tidak ada operasional aktif untuk relawan ini hari ini
      const shift = resolveShiftUntukRelawan_(r.ID_RELAWAN, operasional.idOperasional);
      jamMasukShift = shift ? shift.jamMasuk : null;
    } catch (e) { return; } // kalau gagal resolve, lewati relawan ini -- jangan asal kirim
    if (!jamMasukShift) return;

    // Kirim kalau sudah lewat 30 menit dari jam shift, dan belum diingatkan hari ini
    const [jamShift, menitShift] = String(jamMasukShift).split(':').map(Number);
    const [jamNow, menitNow] = jamSekarang.split(':').map(Number);
    const menitLewat = (jamNow * 60 + menitNow) - (jamShift * 60 + menitShift);
    if (menitLewat < 30) return;

    const akun = cariAkunByIdRelawan_(r.ID_RELAWAN);
    if (akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      const terakhir = akun.data[akun.idx.TERAKHIR_DIINGATKAN];
      if (terakhir && tanggalSheetKeIso_(formatTanggal(new Date(terakhir))) === tanggalSheetKeIso_(hariIni)) return;
    }

    const terkirimKe = kirimPushNotifikasi_(r.ID_RELAWAN, '⚠️ Belum Absen Masuk', 'Kamu belum absen masuk hari ini. Segera absen ya!', { link: '/absensi.html' });
    if (terkirimKe && akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      getAkunSheet().getRange(akun.baris, akun.idx.TERAKHIR_DIINGATKAN + 1).setValue(new Date());
      terkirim++;
    }
  });

  Logger.log('cekBelumAbsenDanKirimPush: ' + terkirim + ' notifikasi terkirim.');
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #2: LENGKAPI PROFIL
// Dikirim SEKALI SAJA per relawan (bukan berulang tiap hari) -- ditandai
// lewat kolom PROFIL_REMINDER_TERKIRIM supaya tidak spam.
// ------------------------------------------------------------

function cekProfilBelumLengkapDanKirimPush() {
  const semuaAkun = sheetToObjects(getAkunSheet());
  let terkirim = 0;

  semuaAkun.forEach(a => {
    if (a.PROFIL_REMINDER_TERKIRIM === true || String(a.PROFIL_REMINDER_TERKIRIM).toUpperCase() === 'TRUE') return;

    const belumLengkap = !a.TANGGAL_LAHIR || !a.JENIS_KELAMIN || !a.ALAMAT || !a.FOTO_PROFIL;
    if (!belumLengkap) return;

    const berhasil = kirimPushNotifikasi_(a.ID_RELAWAN, '📋 Lengkapi Profil Kamu', 'Beberapa data profil kamu masih kosong. Yuk lengkapi di menu Profil Saya.', { link: '/profil.html' });
    if (berhasil) {
      const akun = cariAkunByIdRelawan_(a.ID_RELAWAN);
      if (akun && akun.idx.PROFIL_REMINDER_TERKIRIM !== undefined) {
        getAkunSheet().getRange(akun.baris, akun.idx.PROFIL_REMINDER_TERKIRIM + 1).setValue(true);
        terkirim++;
      }
    }
  });

  Logger.log('cekProfilBelumLengkapDanKirimPush: ' + terkirim + ' notifikasi terkirim.');
}

/**
 * Dipanggil 1 fungsi ini saja dari time-driven trigger (tiap 30 menit) --
 * menjalankan kedua pengecekan di atas sekaligus.
 */

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #3: BELUM ABSEN PULANG
// ------------------------------------------------------------

function cekBelumAbsenPulangDanKirimPush() {
  const hariIni = formatTanggal(new Date());
  const semuaRelawanAktif = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN))
    .filter(r => String(r.STATUS).toUpperCase() === 'AKTIF');
  const semuaAbsensiHariIni = getAbsensiRows_().filter(a => {
    const tgl = tanggalSheetKeIso_(a.TANGGAL_OPERASIONAL || '');
    return tgl === tanggalSheetKeIso_(hariIni);
  });

  const jamSekarang = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  let terkirim = 0;

  semuaRelawanAktif.forEach(r => {
    const rekapHariItu = semuaAbsensiHariIni.filter(a => a.ID_RELAWAN === r.ID_RELAWAN);
    const masuk = rekapHariItu.find(a => a.JENIS_ABSENSI === 'MASUK' && a.KETERANGAN !== 'Izin' && a.KETERANGAN !== 'Sakit');
    const sudahPulang = rekapHariItu.some(a => a.JENIS_ABSENSI === 'PULANG');
    if (!masuk || sudahPulang) return;

    let jamPulangShift = null;
    try {
      const operasional = tentukanOperasionalAktifHariIni_(r.ID_RELAWAN);
      if (!operasional) return;
      const shift = resolveShiftUntukRelawan_(r.ID_RELAWAN, operasional.idOperasional);
      jamPulangShift = shift ? shift.jamPulang : null;
    } catch (e) { return; }
    if (!jamPulangShift) return;

    const [jamShift, menitShift] = String(jamPulangShift).split(':').map(Number);
    const [jamNow, menitNow] = jamSekarang.split(':').map(Number);
    const menitLewat = (jamNow * 60 + menitNow) - (jamShift * 60 + menitShift);
    if (menitLewat < 30) return;

    const akun = cariAkunByIdRelawan_(r.ID_RELAWAN);
    const kunciSudahIngat = 'PULANG:' + tanggalSheetKeIso_(hariIni);
    if (akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      const terakhir = String(akun.data[akun.idx.TERAKHIR_DIINGATKAN] || '');
      if (terakhir === kunciSudahIngat) return;
    }

    const terkirimKe = kirimPushNotifikasi_(r.ID_RELAWAN, '⚠️ Belum Absen Pulang', 'Kamu sudah absen masuk tapi belum absen pulang hari ini.', { link: '/absensi.html' });
    if (terkirimKe && akun && akun.idx.TERAKHIR_DIINGATKAN !== undefined) {
      getAkunSheet().getRange(akun.baris, akun.idx.TERAKHIR_DIINGATKAN + 1).setValue(kunciSudahIngat);
      terkirim++;
    }
  });

  Logger.log('cekBelumAbsenPulangDanKirimPush: ' + terkirim + ' notifikasi terkirim.');
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #4: STOK MENIPIS/HABIS (SIRAGA)
// Pakai statusStokBarang_ yang SUDAH ADA di Stok.gs. Dikirim maks 1x per
// hari per barang (disimpan di Script Properties) supaya tidak spam.
// ------------------------------------------------------------

function cekStokMenipisDanKirimPush() {
  let barang;
  try {
    barang = sheetToObjects(getStokBarangSheet()).filter(b => String(b.AKTIF).toUpperCase() !== 'NONAKTIF');
  } catch (e) {
    Logger.log('cekStokMenipisDanKirimPush: modul SIRAGA belum tersedia -- dilewati.');
    return;
  }

  const petugasStok = sheetToObjects(getAkunSheet()).filter(a => String(a.ROLE_STOK).toUpperCase() === 'AKTIF');
  if (!petugasStok.length) { Logger.log('cekStokMenipisDanKirimPush: belum ada Petugas Stok terdaftar.'); return; }

  const hariIniIso = tanggalSheetKeIso_(formatTanggal(new Date()));
  const props = PropertiesService.getScriptProperties();
  let terkirim = 0;

  barang.forEach(b => {
    const stokSaatIni = Number(b.STOK_SAAT_INI) || 0;
    const stokMinimum = Number(b.STOK_MINIMUM) || 0;
    const status = statusStokBarang_(stokSaatIni, stokMinimum);
    if (status === 'AMAN') return;

    const kunciProp = 'stok_diingatkan_' + b.ID_BARANG;
    if (props.getProperty(kunciProp) === hariIniIso + ':' + status) return;

    const emoji = status === 'HABIS' ? '🔴' : '🟡';
    const judul = emoji + ' Stok ' + (status === 'HABIS' ? 'Habis' : 'Menipis') + ': ' + b.NAMA_BARANG;
    const isi = 'Sisa ' + stokSaatIni + ' ' + b.SATUAN + ' (minimum ' + stokMinimum + ' ' + b.SATUAN + ').';

    petugasStok.forEach(p => kirimPushNotifikasi_(p.ID_RELAWAN, judul, isi, { link: '/stok-relawan.html' }));
    try { catatNotifikasi_('Sistem', judul, isi, 'SEMUA'); } catch (e) { /* modul Notifikasi mungkin belum siap */ }

    props.setProperty(kunciProp, hariIniIso + ':' + status);
    terkirim++;
  });

  Logger.log('cekStokMenipisDanKirimPush: ' + terkirim + ' notifikasi stok terkirim.');
}

function jalankanSemuaPengecekanNotifikasiOtomatis() {
  cekBelumAbsenDanKirimPush();
  cekBelumAbsenPulangDanKirimPush();
  cekProfilBelumLengkapDanKirimPush();
  cekStokMenipisDanKirimPush();
  prosesAntrianPushSipandu();
}

// ------------------------------------------------------------
// ANTRIAN PUSH DARI SIPANDU (proyek Apps Script TERPISAH)
// SIPANDU tidak bisa memanggil kirimPushNotifikasi_ secara langsung
// (beda proyek). Solusinya: SIPANDU MENULIS permintaan ke sheet ini
// (dengan membuka Spreadsheet Portal lewat ID -- pola SAMA seperti
// SipanduAuth.gs membaca 07_AKUN_RELAWAN), lalu Portal utama yang
// MEMBACA & MENGIRIM lewat trigger 30-menit yang sudah ada.
//
// Kolom 25_ANTRIAN_PUSH_SIPANDU: ID | ID_RELAWAN | JUDUL | ISI | LINK | STATUS | DIBUAT_PADA
// STATUS: MENUNGGU -> TERKIRIM (atau GAGAL, tetap disimpan untuk audit)
// ------------------------------------------------------------

function prosesAntrianPushSipandu() {
  let sheet;
  try {
    sheet = getSheet(NAMA_SHEET.ANTRIAN_PUSH_SIPANDU);
  } catch (e) {
    Logger.log('prosesAntrianPushSipandu: sheet 25_ANTRIAN_PUSH_SIPANDU belum dibuat -- dilewati.');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  let terkirim = 0;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.STATUS]).toUpperCase() !== 'MENUNGGU') continue;

    const idRelawan = String(data[i][idx.ID_RELAWAN]);
    const judul = String(data[i][idx.JUDUL]);
    const isi = String(data[i][idx.ISI]);
    const link = String(data[i][idx.LINK] || '');

    const berhasil = kirimPushNotifikasi_(idRelawan, judul, isi, { link: link });
    sheet.getRange(i + 1, idx.STATUS + 1).setValue(berhasil ? 'TERKIRIM' : 'GAGAL');
    if (berhasil) terkirim++;
  }

  Logger.log('prosesAntrianPushSipandu: ' + terkirim + ' notifikasi dari SIPANDU terkirim.');
}

// ------------------------------------------------------------
// NOTIFIKASI OTOMATIS #5: REKAP MINGGUAN
// Dipasang di TRIGGER TERPISAH (mingguan, bukan tiap 30 menit -- lihat
// panduan) supaya tidak ikut jalan berkali-kali dalam 1 minggu yang sama.
// Rekap per-relawan dikirim sebagai push; rekap per-divisi dicatat sebagai
// 1 notifikasi Sistem (dibaca Admin/siapa saja lewat halaman Notifikasi).
// ------------------------------------------------------------

function kirimRekapMingguan() {
  const sekarang = new Date();
  const tujuhHariLalu = new Date(sekarang.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tujuhHariLaluIso = tanggalSheetKeIso_(formatTanggal(tujuhHariLalu));
  const sekarangIso = tanggalSheetKeIso_(formatTanggal(sekarang));

  const absensi7Hari = getAbsensiRows_().filter(a => {
    const iso = tanggalSheetKeIso_(a.TANGGAL_OPERASIONAL || '');
    return iso >= tujuhHariLaluIso && iso <= sekarangIso;
  });

  const relawanAktif = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).filter(r => String(r.STATUS).toUpperCase() === 'AKTIF');

  // ---- Rekap per relawan (push ke masing-masing) ----
  relawanAktif.forEach(r => {
    const milikSaya = absensi7Hari.filter(a => a.ID_RELAWAN === r.ID_RELAWAN && a.JENIS_ABSENSI === 'MASUK');
    if (!milikSaya.length) return; // tidak ada aktivitas minggu ini -- tidak perlu kirim rekap kosong

    let hadir = 0, terlambat = 0, izinSakit = 0;
    milikSaya.forEach(a => {
      if (a.KETERANGAN === 'Izin' || a.KETERANGAN === 'Sakit') { izinSakit++; return; }
      hadir++;
      try {
        if (apakahTerlambatShiftAware_ && apakahTerlambatShiftAware_(r.ID_RELAWAN, a.ID_OPERASIONAL, a.JAM)) terlambat++;
      } catch (e) { /* fungsi Shift-aware belum tentu tersedia -- lewati hitungan terlambat */ }
    });

    const isi = 'Minggu ini: ' + hadir + ' hadir' + (terlambat ? ', ' + terlambat + ' terlambat' : '') + (izinSakit ? ', ' + izinSakit + ' izin/sakit' : '') + '.';
    kirimPushNotifikasi_(r.ID_RELAWAN, '📊 Rekap Minggu Ini', isi, { link: '/riwayat.html' });
  });

  // ---- Rekap per divisi (1 notifikasi sistem, dibaca siapa saja) ----
  const rekapDivisi = {};
  relawanAktif.forEach(r => {
    const divisi = r.DIVISI || 'Tanpa Divisi';
    if (!rekapDivisi[divisi]) rekapDivisi[divisi] = { hadir: 0 };
    const jumlahHadir = absensi7Hari.filter(a => a.ID_RELAWAN === r.ID_RELAWAN && a.JENIS_ABSENSI === 'MASUK' && a.KETERANGAN !== 'Izin' && a.KETERANGAN !== 'Sakit').length;
    rekapDivisi[divisi].hadir += jumlahHadir;
  });
  const ringkasanDivisi = Object.keys(rekapDivisi).map(d => d + ': ' + rekapDivisi[d].hadir + 'x hadir').join(' · ');
  try { catatNotifikasi_('Sistem', '📊 Rekap Mingguan per Divisi', ringkasanDivisi || 'Belum ada aktivitas minggu ini.', 'SEMUA'); } catch (e) { /* abaikan kalau modul Notifikasi belum siap */ }

  Logger.log('kirimRekapMingguan selesai: ' + relawanAktif.length + ' relawan diperiksa.');
}

// ------------------------------------------------------------
// TEST DARI WEB — supaya Admin bisa uji kirim notifikasi tanpa perlu
// buka Apps Script sama sekali (cukup dari Dashboard Admin).
// ------------------------------------------------------------

/**
 * Versi VERBOSE dari kirimPushNotifikasi_ -- TIDAK menelan error, dipakai
 * KHUSUS untuk tombol Test dari web supaya Admin bisa lihat penyebab
 * asli kalau gagal. Untuk pengecekan otomatis massal, tetap pakai
 * kirimPushNotifikasi_ yang aman (1 relawan gagal tidak menghentikan yang lain).
 */
function _kirimPushVerbose_(idRelawan, judul, isiPesan) {
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun || akun.idx.FCM_TOKEN === undefined) throw new Error('Kolom FCM_TOKEN tidak ditemukan di sheet.');
  const token = akun.data[akun.idx.FCM_TOKEN];
  if (!token) throw new Error('Relawan ini belum punya token (belum pernah klik "Aktifkan Notifikasi HP").');

  const projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
  if (!projectId) throw new Error('Script Property FCM_PROJECT_ID belum diisi.');

  const accessToken = _ambilAccessTokenFcm_(); // akan throw sendiri kalau service account salah/belum diisi

  const payload = {
    message: {
      token: token,
      notification: { title: judul, body: isiPesan },
      webpush: { notification: { icon: 'assets/icon-192.png' }, fcm_options: { link: '/' } }
    }
  };

  const resp = UrlFetchApp.fetch(
    'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const kode = resp.getResponseCode();
  if (kode !== 200) {
    throw new Error('FCM menolak (HTTP ' + kode + '): ' + resp.getContentText());
  }
  return true;
}

function kirimTestPushNotifikasi(body) {
  const usernameAdmin = requireAuth(body.token);
  const idRelawan = sanitize(body.idRelawan);
  if (!idRelawan) throw new Error('ID Relawan wajib diisi.');

  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Relawan dengan ID tersebut tidak ditemukan.');

  // _kirimPushVerbose_ SENGAJA dibiarkan melempar error apa adanya ke
  // sini -- tidak ditangkap -- supaya pesannya sampai persis ke Admin.
  _kirimPushVerbose_(idRelawan, '🔔 Test Notifikasi', 'Ini notifikasi percobaan dari Admin. Kalau kamu lihat ini, berarti sistem notifikasi HP sudah jalan!');

  logAudit_('TEST_PUSH_NOTIFIKASI', 'PUSH_NOTIF', idRelawan, usernameAdmin, { berhasil: true });
  return { success: true };
}
