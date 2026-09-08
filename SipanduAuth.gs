/**
 * SIPANDU — SipanduAuth.gs
 * Jembatan otentikasi & otorisasi. SIPANDU TIDAK punya sistem login sendiri
 * -- "satu login" ditegakkan dengan memvalidasi token yang SAMA yang
 * dipakai relawan login ke Portal Relawan (absensi/stok/shift).
 *
 * ==================================================================
 * KETERBATASAN PENTING yang WAJIB dipahami (baca sebelum setup):
 * ==================================================================
 * CacheService di Apps Script SCOPED PER-PROYEK -- proyek SIPANDU (ini)
 * TIDAK BISA membaca CacheService milik proyek Portal Relawan. Karena
 * itu, validasi sesi di sini HANYA mengandalkan token yang sudah
 * DIPERSIST ke SHEET (kolom TOKEN_AKTIF/TOKEN_KADALUARSA di
 * 07_AKUN_RELAWAN -- fitur sesi 90 hari yang sudah dipasang sebelumnya).
 *
 * Konsekuensinya:
 *  - Relawan (termasuk yang login sebagai Petugas Stok/ASN/dst lewat akun
 *    relawannya) -> BISA divalidasi di sini, karena sesinya persist ke sheet.
 *  - Login ADMIN (06_ADMIN, terpisah dari akun relawan) -> TIDAK BISA
 *    divalidasi di sini, karena sesi admin SENGAJA hanya di CacheService
 *    (lihat catatan desain di Akun.gs Portal Relawan -- admin wajib login
 *    ulang tiap refresh, tidak pernah dipersist ke sheet).
 *
 * SOLUSI: siapa pun yang butuh role "Admin" di SIPANDU WAJIB juga py akun
 * RELAWAN (kebanyakan pengelola SPPG memang sudah punya keduanya), lalu
 * didaftarkan di sheet USERS (database SIPANDU) dengan ROLE_SIPANDU =
 * 'ADMIN'. Login ke SIPANDU tetap lewat sesi relawan yang sama.
 */

/**
 * Validasi token (sesi relawan Portal Relawan) dengan membaca LANGSUNG
 * spreadsheet Portal Relawan (lintas proyek). Return ID_RELAWAN kalau valid.
 */
function requireSipanduAuth_(token) {
  if (!token) throw new Error('Sesi tidak valid. Silakan login kembali di Portal Relawan.');

  const mainSpreadsheetId = getSipanduConfig_('MAIN_PORTAL_SPREADSHEET_ID');
  if (!mainSpreadsheetId) {
    throw new Error('Konfigurasi MAIN_PORTAL_SPREADSHEET_ID belum diisi di sheet CONFIG (database SIPANDU).');
  }

  let mainSs;
  try {
    mainSs = SpreadsheetApp.openById(mainSpreadsheetId);
  } catch (e) {
    throw new Error('Tidak bisa membuka Spreadsheet Portal Relawan. Pastikan ID benar & akun yang menjalankan Apps Script SIPANDU punya akses baca ke spreadsheet itu.');
  }

  const akunSheet = mainSs.getSheetByName('07_AKUN_RELAWAN');
  if (!akunSheet) throw new Error('Sheet 07_AKUN_RELAWAN tidak ditemukan di Spreadsheet Portal Relawan.');

  const data = akunSheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxIdRelawan = headers.indexOf('ID_RELAWAN');
  const idxTokenAktif = headers.indexOf('TOKEN_AKTIF');
  const idxTokenKadaluarsa = headers.indexOf('TOKEN_KADALUARSA');
  const idxStatusAkun = headers.indexOf('STATUS_AKUN');

  if (idxTokenAktif === -1 || idxTokenKadaluarsa === -1) {
    throw new Error('Kolom TOKEN_AKTIF/TOKEN_KADALUARSA belum ada di 07_AKUN_RELAWAN. SIPANDU butuh fitur sesi jangka panjang relawan (sudah dipasang di paket Stok+Shift sebelumnya) supaya bisa validasi sesi lintas-proyek.');
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxTokenAktif]) === token && data[i][idxTokenAktif] !== '') {
      const kadaluarsa = data[i][idxTokenKadaluarsa];
      if (!(kadaluarsa instanceof Date) || kadaluarsa.getTime() <= Date.now()) {
        throw new Error('Sesi telah berakhir. Silakan login kembali di Portal Relawan.');
      }
      if (idxStatusAkun !== -1 && String(data[i][idxStatusAkun]).toUpperCase() !== 'AKTIF') {
        throw new Error('Akun Anda telah dinonaktifkan oleh Admin.');
      }
      return String(data[i][idxIdRelawan]);
    }
  }

  throw new Error('Sesi tidak dikenali. Silakan login kembali di Portal Relawan (sesi mungkin dibuat sebelum kolom TOKEN_AKTIF ada, atau sudah logout).');
}

/**
 * Ambil profil SIPANDU (role) untuk seorang relawan. Return null kalau
 * relawan itu belum terdaftar di sheet USERS SIPANDU sama sekali.
 */
function getSipanduUserProfile_(idRelawan) {
  const users = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.USERS));
  const row = users.find(u => String(u.ID_USER) === idRelawan);
  if (!row || String(row.AKTIF).toUpperCase() === 'NONAKTIF') return null;
  return { idUser: row.ID_USER, nama: row.NAMA, role: row.ROLE_SIPANDU };
}

/**
 * Validasi token DAN permission tertentu sekaligus. Dipakai di HAMPIR
 * SEMUA endpoint SIPANDU yang menyentuh data (§10: "Permission harus
 * diperiksa pada backend Apps Script, bukan hanya berdasarkan tampilan
 * frontend").
 */
function requireSipanduPermission_(token, permCode) {
  const idRelawan = requireSipanduAuth_(token);
  const profil = getSipanduUserProfile_(idRelawan);

  if (!profil) {
    throw new Error('Akun Anda belum terdaftar di SIPANDU. Hubungi Admin SIPANDU untuk didaftarkan.');
  }

  const rolePerms = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.ROLE_PERMISSIONS));
  const punyaAkses = rolePerms.some(rp => rp.KODE_ROLE === profil.role && rp.KODE_PERMISSION === permCode);

  if (!punyaAkses) {
    throw new Error('Anda tidak memiliki izin (' + permCode + ') untuk melakukan aksi ini.');
  }

  return { idUser: idRelawan, nama: profil.nama, role: profil.role };
}

/** Dipakai FRONTEND setelah login supaya tahu role & bisa atur menu. */
function getSipanduProfilSaya(token) {
  const idRelawan = requireSipanduAuth_(token);
  const profil = getSipanduUserProfile_(idRelawan);
  if (!profil) {
    throw new Error('Akun Anda belum terdaftar di SIPANDU. Hubungi Admin SIPANDU untuk didaftarkan.');
  }
  return profil;
}
