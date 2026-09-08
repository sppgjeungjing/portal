/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Akun.gs — Akun, login, dan profil relawan (Tahap 2, 3, 4 dari roadmap)
 *
 * Modul ini BERDIRI SENDIRI dari sistem absensi lama (Absensi.gs, script.js,
 * absensi.html). Belum ada yang menghubungkan login relawan ke proses
 * absensi — itu direncanakan pada tahap berikutnya (Fase 7 di roadmap).
 *
 * Data akun disimpan di sheet BARU: 07_AKUN_RELAWAN, terhubung ke
 * 01_DATA_RELAWAN lewat ID_RELAWAN. Sheet 01_DATA_RELAWAN sendiri TIDAK
 * diubah sama sekali — nol risiko ke sistem absensi yang sudah berjalan.
 *
 * Kolom 07_AKUN_RELAWAN:
 *   ID_RELAWAN | USERNAME | PASSWORD_HASH | SALT | NO_HP | EMAIL |
 *   STATUS_AKUN | WAJIB_GANTI_PASSWORD | DIBUAT_PADA | LOGIN_TERAKHIR |
 *   TOKEN_AKTIF | TOKEN_KADALUARSA  <-- BARU (lihat catatan sesi di bawah)
 *
 * PERBAIKAN: sesi relawan (Tahap 3) tadinya HANYA disimpan di CacheService,
 * yang punya batas KERAS 21600 detik (6 jam) dari Google -- tidak bisa
 * diperpanjang lewat kode. Untuk relawan yang HP/tabletnya ditampilkan
 * terus-menerus di lokasi (tidak login ulang tiap hari), sesi ditulis JUGA
 * ke sheet ini (kolom TOKEN_AKTIF + TOKEN_KADALUARSA) sebagai penyimpanan
 * jangka panjang. CacheService tetap dipakai sebagai jalur cepat (supaya
 * tidak selalu baca Spreadsheet); begitu cache itu kadaluarsa (>6 jam),
 * requireAuthRelawan_ otomatis jatuh ke pengecekan sheet sebelum menyerah.
 *
 * WAJIB: tambahkan 2 kolom baru ini secara manual di sheet 07_AKUN_RELAWAN
 * kalau belum ada -- kode di bawah aman (tidak error) walau kolom ini
 * belum ditambahkan, tapi relawan akan tetap logout tiap 6 jam sampai
 * kolomnya dibuat.
 */

// Berapa lama sesi relawan bertahan tanpa perlu login ulang (dalam hari).
// >>> UBAH ANGKA INI SESUAI KEBUTUHAN (mis. 90 untuk perangkat kios yang jarang login ulang) <<<
const DURASI_SESI_RELAWAN_HARI = 90;

// ------------------------------------------------------------
// UTILITAS SHEET AKUN
// ------------------------------------------------------------

function getAkunSheet() {
  return getSheet(NAMA_SHEET.AKUN_RELAWAN);
}

/** Membaca header sheet Akun menjadi { NAMA_KOLOM: indexAngka (mulai 0) }. */
function akunHeaderIndex_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h).trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });
  return idx;
}

/** Mencari baris akun berdasarkan ID_RELAWAN. Return null jika tidak ada. */
function cariAkunByIdRelawan_(idRelawan) {
  const sheet = getAkunSheet();
  const data = sheet.getDataRange().getValues();
  const idx = akunHeaderIndex_(sheet);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.ID_RELAWAN]) === idRelawan) {
      return { baris: i + 1, data: data[i], idx: idx };
    }
  }
  return null;
}

/**
 * Mencari baris akun berdasarkan TOKEN_AKTIF yang tersimpan di sheet (jalur
 * cadangan saat CacheService sudah kadaluarsa, lihat catatan di atas file).
 * Return null kalau kolomnya belum ada di sheet, tokennya tidak cocok, atau
 * sudah lewat TOKEN_KADALUARSA.
 */
function cariAkunByTokenSheet_(token) {
  const sheet = getAkunSheet();
  const idx = akunHeaderIndex_(sheet);
  if (idx.TOKEN_AKTIF === undefined || idx.TOKEN_KADALUARSA === undefined) return null;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.TOKEN_AKTIF]) === token && data[i][idx.TOKEN_AKTIF] !== '') {
      const kadaluarsa = data[i][idx.TOKEN_KADALUARSA];
      if (kadaluarsa instanceof Date && kadaluarsa.getTime() > Date.now()) {
        return { baris: i + 1, data: data[i], idx: idx };
      }
      return null; // token ada tapi sudah lewat masa berlaku
    }
  }
  return null;
}

/** Mencari baris akun berdasarkan USERNAME (tidak case-sensitive). Return null jika tidak ada. */
function cariAkunByUsername_(username) {
  const sheet = getAkunSheet();
  const data = sheet.getDataRange().getValues();
  const idx = akunHeaderIndex_(sheet);
  const target = String(username).toLowerCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx.USERNAME]).toLowerCase() === target) {
      return { baris: i + 1, data: data[i], idx: idx };
    }
  }
  return null;
}

/** Password acak 8 karakter, menghindari karakter yang gampang tertukar (0/O, 1/l/I). */
function generatePasswordSementara_() {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let hasil = '';
  for (let i = 0; i < 8; i++) {
    hasil += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return hasil;
}

// ------------------------------------------------------------
// TAHAP 2 — ADMIN: KELOLA AKUN RELAWAN
// ------------------------------------------------------------

/** Daftar status akun untuk dashboard admin — TIDAK PERNAH mengembalikan hash/salt. */
function getAkunRelawanList() {
  const rows = sheetToObjects(getAkunSheet());
  return rows.map(r => ({
    idRelawan: r.ID_RELAWAN,
    username: r.USERNAME,
    statusAkun: r.STATUS_AKUN,
    wajibGantiPassword: r.WAJIB_GANTI_PASSWORD === true || String(r.WAJIB_GANTI_PASSWORD).toUpperCase() === 'TRUE'
  }));
}

/**
 * Admin membuat akun baru untuk relawan yang sudah ada di 01_DATA_RELAWAN.
 * Password sementara dibuat otomatis oleh sistem dan HANYA muncul pada
 * respons pemanggilan ini — setelah ini hanya hash yang tersimpan, tidak
 * bisa dilihat lagi. Admin wajib langsung mencatat & menyampaikannya ke
 * relawan yang bersangkutan.
 */
function addAkunRelawan(body) {
  const idRelawan = sanitize(body.idRelawan);
  const username = sanitize(body.username).toLowerCase();
  const noHp = sanitize(body.noHp);
  const email = sanitize(body.email);

  if (!idRelawan) throw new Error('Relawan wajib dipilih.');
  if (!username || username.length < 4) throw new Error('Username minimal 4 karakter.');
  if (!/^[a-z0-9._]+$/.test(username)) throw new Error('Username hanya boleh huruf kecil, angka, titik, dan garis bawah.');

  const relawan = getRelawanById(idRelawan);
  if (!relawan) throw new Error('Data relawan tidak ditemukan.');
  if (cariAkunByIdRelawan_(idRelawan)) throw new Error('Relawan ini sudah mempunyai akun.');
  if (cariAkunByUsername_(username)) throw new Error('Username sudah dipakai, gunakan username lain.');

  const passwordSementara = generatePasswordSementara_();
  const salt = Utilities.getUuid();
  const hash = hashPassword(passwordSementara, salt);

  getAkunSheet().appendRow([
    idRelawan, username, hash, salt, noHp, email, 'AKTIF', true, new Date()
  ]);

  return {
    idRelawan: idRelawan,
    nama: relawan.nama,
    username: username,
    passwordSementara: passwordSementara
  };
}

/** Admin mereset password relawan (akun terkunci / lupa & belum ada OTP). Password lama langsung tidak berlaku. */
function resetPasswordRelawan(body) {
  const idRelawan = sanitize(body.idRelawan);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun relawan tidak ditemukan.');

  const passwordBaru = generatePasswordSementara_();
  const salt = Utilities.getUuid();
  const hash = hashPassword(passwordBaru, salt);

  const sheet = getAkunSheet();
  sheet.getRange(akun.baris, akun.idx.PASSWORD_HASH + 1).setValue(hash);
  sheet.getRange(akun.baris, akun.idx.SALT + 1).setValue(salt);
  sheet.getRange(akun.baris, akun.idx.WAJIB_GANTI_PASSWORD + 1).setValue(true);

  return { idRelawan: idRelawan, passwordSementara: passwordBaru };
}

// ------------------------------------------------------------
// TAHAP 3 — LOGIN RELAWAN
// ------------------------------------------------------------

function relawanLogin(username, password) {
  username = sanitize(username);
  if (!username || !password) throw new Error('Username dan password wajib diisi.');

  const akun = cariAkunByUsername_(username);
  if (!akun) throw new Error('Username atau password salah.');

  if (String(akun.data[akun.idx.STATUS_AKUN]).toUpperCase() !== 'AKTIF') {
    throw new Error('Akun tidak aktif. Hubungi admin.');
  }

  const hash = hashPassword(password, akun.data[akun.idx.SALT]);
  if (hash !== akun.data[akun.idx.PASSWORD_HASH]) throw new Error('Username atau password salah.');

  const idRelawan = String(akun.data[akun.idx.ID_RELAWAN]);
  const relawan = getRelawanById(idRelawan);
  if (!relawan || String(relawan.status).toUpperCase() !== 'AKTIF') {
    throw new Error('Data relawan tidak aktif. Hubungi admin.');
  }

  const token = generateToken();
  // Jalur cepat: CacheService (server), maks 6 jam -- ini batas KERAS dari Google.
  CacheService.getScriptCache().put('sesi_relawan_' + token, idRelawan, 21600);

  // Jalur jangka panjang: simpan token yang SAMA + tanggal kadaluarsa ke sheet,
  // supaya begitu cache di atas kadaluarsa, relawan tetap tidak perlu login
  // ulang selama masih dalam DURASI_SESI_RELAWAN_HARI (lihat requireAuthRelawan).
  if (akun.idx.TOKEN_AKTIF !== undefined && akun.idx.TOKEN_KADALUARSA !== undefined) {
    const kadaluarsa = new Date(Date.now() + DURASI_SESI_RELAWAN_HARI * 24 * 60 * 60 * 1000);
    const sheetAkun = getAkunSheet();
    sheetAkun.getRange(akun.baris, akun.idx.TOKEN_AKTIF + 1).setValue(token);
    sheetAkun.getRange(akun.baris, akun.idx.TOKEN_KADALUARSA + 1).setValue(kadaluarsa);
  }

  // Catat waktu login terakhir (dipakai nanti di halaman Pengaturan Akun).
  // Dicek dulu supaya tetap aman kalau kolom LOGIN_TERAKHIR belum ditambahkan ke sheet.
  if (akun.idx.LOGIN_TERAKHIR !== undefined) {
    getAkunSheet().getRange(akun.baris, akun.idx.LOGIN_TERAKHIR + 1).setValue(new Date());
  }

  const wajib = akun.data[akun.idx.WAJIB_GANTI_PASSWORD];
  return {
    token: token,
    idRelawan: idRelawan,
    nama: relawan.nama,
    divisi: relawan.divisi,
    wajibGantiPassword: wajib === true || String(wajib).toUpperCase() === 'TRUE'
  };
}

function logoutRelawan(body) {
  if (body && body.token) {
    CacheService.getScriptCache().remove('sesi_relawan_' + body.token);

    // Hapus juga token jangka panjang di sheet, supaya perangkat yang sudah
    // "Keluar" tidak bisa otomatis masuk lagi walau tokennya masih tersimpan.
    const akun = cariAkunByTokenSheet_(body.token);
    if (akun && akun.idx.TOKEN_AKTIF !== undefined) {
      getAkunSheet().getRange(akun.baris, akun.idx.TOKEN_AKTIF + 1).setValue('');
      getAkunSheet().getRange(akun.baris, akun.idx.TOKEN_KADALUARSA + 1).setValue('');
    }
  }
  return { success: true };
}

/**
 * Dipanggil di awal setiap aksi relawan yang butuh login.
 *
 * Sengaja memvalidasi ULANG status akun di sini (bukan cuma saat login) —
 * supaya begitu Admin menonaktifkan akun ini, permintaan BERIKUTNYA dari
 * relawan tsb langsung ditolak & sesinya dihapus dari server, tanpa perlu
 * menunggu token kedaluwarsa (maks 6 jam). Bukan real-time seketika (server
 * tidak tahu token mana yang sedang aktif dipakai), tapi setiap kali relawan
 * melakukan aksi apa pun (buka halaman, simpan profil, dll.) statusnya
 * dicek ulang — sesuai jawaban "berkala/setiap request penting".
 */
function requireAuthRelawan(token) {
  if (!token) throw new Error('Sesi tidak valid. Silakan login kembali.');

  let idRelawan = CacheService.getScriptCache().get('sesi_relawan_' + token);

  if (!idRelawan) {
    // Cache 6-jam sudah kadaluarsa (batas keras dari Google) -- coba cari
    // sesi jangka panjang di sheet sebelum menyerah (lihat catatan di atas file).
    const akunToken = cariAkunByTokenSheet_(token);
    if (!akunToken) throw new Error('Sesi telah berakhir. Silakan login kembali.');
    idRelawan = String(akunToken.data[akunToken.idx.ID_RELAWAN]);
    // Isi ulang cache cepat supaya request berikutnya tidak perlu baca sheet lagi.
    CacheService.getScriptCache().put('sesi_relawan_' + token, idRelawan, 21600);
  }

  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun || String(akun.data[akun.idx.STATUS_AKUN]).toUpperCase() !== 'AKTIF') {
    CacheService.getScriptCache().remove('sesi_relawan_' + token);
    throw new Error('Akun Anda telah dinonaktifkan oleh Admin. Silakan hubungi Admin.');
  }

  return idRelawan;
}

/** Admin mengaktifkan/menonaktifkan akun relawan. Lihat catatan di requireAuthRelawan soal kapan sesi berhenti berlaku. */
function updateStatusAkunRelawan(body) {
  const idRelawan = sanitize(body.idRelawan);
  const statusBaru = sanitize(body.statusBaru).toUpperCase();
  if (statusBaru !== 'AKTIF' && statusBaru !== 'NONAKTIF') throw new Error('Status tidak valid.');

  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun relawan tidak ditemukan.');

  getAkunSheet().getRange(akun.baris, akun.idx.STATUS_AKUN + 1).setValue(statusBaru);
  return { idRelawan: idRelawan, statusAkun: statusBaru };
}

// ------------------------------------------------------------
// TAHAP 4 — PROFIL RELAWAN
// ------------------------------------------------------------

/** Identitas resmi (ID/Nama/Divisi/Status, milik Admin) digabung data yang boleh dilengkapi relawan (No HP/Email). */
/**
 * Modul Pengaturan Akun (Modul Dashboard Relawan #3) — SENGAJA terpisah dari
 * getProfilRelawan(): Profil = identitas, Pengaturan = keamanan/status akun.
 * Tidak mengulang nama/ID/username/No HP/Email di sini.
 */
function getPengaturanAkun(token) {
  const idRelawan = requireAuthRelawan(token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');

  const loginTerakhir = akun.idx.LOGIN_TERAKHIR !== undefined ? akun.data[akun.idx.LOGIN_TERAKHIR] : '';
  return {
    statusAkun: akun.data[akun.idx.STATUS_AKUN],
    loginTerakhir: loginTerakhir instanceof Date ? loginTerakhir.toISOString() : (loginTerakhir || '')
  };
}

function getProfilRelawan(token) {
  const idRelawan = requireAuthRelawan(token);
  const relawan = getRelawanById(idRelawan);
  if (!relawan) throw new Error('Data relawan tidak ditemukan.');

  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');

  return {
    id: relawan.id,
    nama: relawan.nama,
    divisi: relawan.divisi,
    status: relawan.status,
    username: akun.data[akun.idx.USERNAME],
    noHp: akun.data[akun.idx.NO_HP] || '',
    email: akun.data[akun.idx.EMAIL] || '',
    // ======================================================
    // PERBAIKAN KRITIS: field-field ini SUDAH BISA DITULIS oleh
    // updateProfilRelawan/simpanFotoProfilRelawan sejak lama, tapi
    // TIDAK PERNAH DIKEMBALIKAN di sini -- akibatnya data yang sudah
    // tersimpan di sheet terlihat "hilang lagi" setiap kali profil
    // dimuat ulang (padahal datanya aman di sheet, cuma tidak pernah
    // dikirim balik ke frontend). Ini JUGA penyebab avatar header
    // tidak muncul, karena app-shell.js butuh fotoProfilUrl dari sini.
    // ======================================================
    tanggalLahir: (akun.idx.TANGGAL_LAHIR !== undefined) ? (akun.data[akun.idx.TANGGAL_LAHIR] || '') : '',
    jenisKelamin: (akun.idx.JENIS_KELAMIN !== undefined) ? (akun.data[akun.idx.JENIS_KELAMIN] || '') : '',
    alamat: (akun.idx.ALAMAT !== undefined) ? (akun.data[akun.idx.ALAMAT] || '') : '',
    fotoProfilUrl: (akun.idx.FOTO_PROFIL !== undefined && akun.data[akun.idx.FOTO_PROFIL])
      ? urlFotoReference_(akun.data[akun.idx.FOTO_PROFIL]) : null,
    gantiUsername: statusGantiUsername_(akun)
  };
}

/** Relawan hanya boleh mengubah No HP & Email — identitas resmi (ID/Nama/Divisi/Status) tetap milik Admin. */
function updateProfilRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');

  const sheet = getAkunSheet();
  if (body.noHp !== undefined) sheet.getRange(akun.baris, akun.idx.NO_HP + 1).setValue(sanitize(body.noHp));
  if (body.email !== undefined) sheet.getRange(akun.baris, akun.idx.EMAIL + 1).setValue(sanitize(body.email));

  // Kolom tambahan -- hanya ditulis kalau kolomnya memang sudah dibuat,
  // supaya versi lama sheet tetap berjalan tanpa error. (Sebelumnya field
  // ini dikirim oleh profil.js tapi DIAM-DIAM diabaikan di sini -- bukan
  // error, makanya tidak ketahuan sampai dicek langsung.)
  if (body.tanggalLahir !== undefined && akun.idx.TANGGAL_LAHIR !== undefined) {
    sheet.getRange(akun.baris, akun.idx.TANGGAL_LAHIR + 1).setNumberFormat('@').setValue(sanitize(body.tanggalLahir));
  }
  if (body.jenisKelamin !== undefined && akun.idx.JENIS_KELAMIN !== undefined) {
    sheet.getRange(akun.baris, akun.idx.JENIS_KELAMIN + 1).setValue(sanitize(body.jenisKelamin));
  }
  if (body.alamat !== undefined && akun.idx.ALAMAT !== undefined) {
    sheet.getRange(akun.baris, akun.idx.ALAMAT + 1).setValue(sanitize(body.alamat));
  }
  return { success: true };
}

const JEDA_GANTI_USERNAME_HARI = 14;

function statusGantiUsername_(akun) {
  if (akun.idx.USERNAME_DIUBAH_PADA === undefined) return { boleh: true, sisaHari: 0 };
  const terakhir = akun.data[akun.idx.USERNAME_DIUBAH_PADA];
  if (!(terakhir instanceof Date)) return { boleh: true, sisaHari: 0 };
  const selisihHari = Math.floor((Date.now() - terakhir.getTime()) / 86400000);
  const sisa = JEDA_GANTI_USERNAME_HARI - selisihHari;
  return sisa > 0 ? { boleh: false, sisaHari: sisa } : { boleh: true, sisaHari: 0 };
}

/** Ganti username relawan -- menyentuh JALUR LOGIN, validasi ketat. */
function gantiUsernameRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  if (akun.idx.USERNAME_DIUBAH_PADA === undefined) {
    throw new Error('Kolom USERNAME_DIUBAH_PADA belum ada di 07_AKUN_RELAWAN. Hubungi Admin untuk menambahkannya.');
  }
  const status = statusGantiUsername_(akun);
  if (!status.boleh) throw new Error('Username baru bisa diubah lagi dalam ' + status.sisaHari + ' hari.');

  const baru = sanitize(body.usernameBaru).toLowerCase();
  if (baru.length < 4) throw new Error('Username minimal 4 karakter.');
  if (!/^[a-z0-9._]+$/.test(baru)) throw new Error('Username hanya boleh huruf kecil, angka, titik, dan garis bawah.');
  if (baru === String(akun.data[akun.idx.USERNAME]).toLowerCase()) throw new Error('Username baru sama dengan yang sekarang.');

  const semuaAkun = sheetToObjects(getAkunSheet());
  const bentrok = semuaAkun.some(a => String(a.USERNAME).toLowerCase() === baru && String(a.ID_RELAWAN) !== idRelawan);
  if (bentrok) throw new Error('Username "' + baru + '" sudah dipakai. Silakan pilih yang lain.');

  const sheet = getAkunSheet();
  sheet.getRange(akun.baris, akun.idx.USERNAME + 1).setValue(baru);
  sheet.getRange(akun.baris, akun.idx.USERNAME_DIUBAH_PADA + 1).setValue(new Date());
  logAudit_('GANTI_USERNAME', 'AKUN_RELAWAN', idRelawan, idRelawan, { usernameBaru: baru });
  try { kirimPushNotifikasi_(idRelawan, '🔐 Username Berhasil Diubah', 'Username akun kamu sekarang: ' + baru + '. Kalau bukan kamu yang mengubah, segera hubungi Admin.', {}); } catch (e) { /* jangan gagalkan ganti username kalau push gagal */ }
  return { success: true, username: baru };
}

/** Simpan foto profil ke Drive (folder terpisah dari swafoto absensi). */
function simpanFotoProfilRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');
  if (akun.idx.FOTO_PROFIL === undefined) {
    throw new Error('Kolom FOTO_PROFIL belum ada di 07_AKUN_RELAWAN. Hubungi Admin untuk menambahkannya.');
  }
  if (!body.fotoBase64) throw new Error('Foto belum dipilih.');
  const cocok = String(body.fotoBase64).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!cocok) throw new Error('Format foto tidak dikenali.');

  const blob = Utilities.newBlob(Utilities.base64Decode(cocok[2]), 'image/' + cocok[1], 'profil-' + idRelawan + '.jpg');
  const root = DriveApp.getRootFolder();
  const folder = getOrCreateFolder_(root, 'FOTO_PROFIL_SPPG_JEUNGJING');
  const lama = akun.data[akun.idx.FOTO_PROFIL];
  if (lama) { try { DriveApp.getFileById(lama).setTrashed(true); } catch (e) { /* file sudah hilang -- abaikan */ } }

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  getAkunSheet().getRange(akun.baris, akun.idx.FOTO_PROFIL + 1).setValue(file.getId());
  return { success: true, fotoProfilUrl: urlFotoReference_(file.getId()) };
}

function gantiPasswordRelawan(body) {
  const idRelawan = requireAuthRelawan(body.token);
  const akun = cariAkunByIdRelawan_(idRelawan);
  if (!akun) throw new Error('Akun tidak ditemukan.');

  const passwordLama = body.passwordLama || '';
  const passwordBaru = body.passwordBaru || '';
  if (passwordBaru.length < 6) throw new Error('Password baru minimal 6 karakter.');

  const hashLama = hashPassword(passwordLama, akun.data[akun.idx.SALT]);
  if (hashLama !== akun.data[akun.idx.PASSWORD_HASH]) throw new Error('Password lama salah.');

  const saltBaru = Utilities.getUuid();
  const hashBaru = hashPassword(passwordBaru, saltBaru);

  const sheet = getAkunSheet();
  sheet.getRange(akun.baris, akun.idx.PASSWORD_HASH + 1).setValue(hashBaru);
  sheet.getRange(akun.baris, akun.idx.SALT + 1).setValue(saltBaru);
  sheet.getRange(akun.baris, akun.idx.WAJIB_GANTI_PASSWORD + 1).setValue(false);

  logAudit_('GANTI_PASSWORD', 'AKUN_RELAWAN', idRelawan, idRelawan, {});
  // Konfirmasi keamanan: kalau BUKAN relawan itu sendiri yang mengganti
  // (akun dicuri/disalahgunakan), setidaknya pemilik asli tahu lewat push.
  try { kirimPushNotifikasi_(idRelawan, '🔐 Password Berhasil Diubah', 'Password akun kamu baru saja diganti. Kalau bukan kamu yang mengubah, segera hubungi Admin.', {}); } catch (e) { /* jangan gagalkan ganti password kalau push gagal */ }

  return { success: true };
}

