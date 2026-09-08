/**
 * SIPANDU — Sistem Informasi Pengelolaan Data & Operasional SPPG
 * SipanduUtils.gs — utilitas dasar (sheet, ID, response JSON)
 *
 * PROYEK APPS SCRIPT TERPISAH dari Portal Relawan (sesuai instruksi:
 * "Gunakan Google Apps Script khusus SIPANDU"). Database (Spreadsheet)
 * JUGA terpisah -- baru dibuat khusus untuk SIPANDU, JANGAN pakai
 * spreadsheet Portal Relawan yang sudah ada.
 *
 * WAJIB DISIAPKAN SEBELUM DIPAKAI:
 * 1. Buat Spreadsheet BARU khusus SIPANDU (lihat SIPANDU-SETUP-SHEET.md
 *    untuk daftar lengkap sheet & header kolom).
 * 2. Buat sheet "CONFIG" di spreadsheet itu dengan 2 kolom: KEY | VALUE.
 *    Isi baris pertama: MAIN_PORTAL_SPREADSHEET_ID | <ID spreadsheet
 *    Portal Relawan yang sudah ada> -- ini yang dipakai buat validasi
 *    sesi login lintas-proyek (lihat SipanduAuth.gs).
 * 3. Deploy sebagai Web App terpisah (URL beda dari Portal Relawan).
 */

const SIPANDU_SHEET = {
  CONFIG: 'CONFIG',
  USERS: 'USERS',
  ROLES: 'ROLES',
  PERMISSIONS: 'PERMISSIONS',
  ROLE_PERMISSIONS: 'ROLE_PERMISSIONS',
  WORK_ORDERS: 'WORK_ORDERS',
  MENU: 'MENU',
  MENU_GIZI: 'MENU_GIZI',
  BENEFICIARIES: 'BENEFICIARIES',
  PREPARATION: 'PREPARATION',
  PROCESSING: 'PROCESSING',
  PORTIONING: 'PORTIONING',
  DISTRIBUTION: 'DISTRIBUTION',
  DISTRIBUTION_STOPS: 'DISTRIBUTION_STOPS',
  WASHING: 'WASHING',
  VALIDATION: 'VALIDATION',
  POP_SNAPSHOT: 'POP_SNAPSHOT',
  POP_FILL_LOG: 'POP_FILL_LOG',
  AUDIT_LOG: 'AUDIT_LOG'
};

const SIPANDU_ZONA_WAKTU = 'Asia/Jakarta';

function getSipanduSheet(namaSheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(namaSheet);
  if (!sheet) {
    throw new Error('Sheet "' + namaSheet + '" tidak ditemukan di database SIPANDU. Periksa kembali struktur Spreadsheet (lihat SIPANDU-SETUP-SHEET.md).');
  }
  return sheet;
}

/** Sama seperti sheetToObjects di Portal Relawan -- header-based, aman kalau kolom belum lengkap. */
function sipanduSheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function sipanduSanitize(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/[<>]/g, '');
}

/** ID generator generik: PREFIX + 5 digit urut, mis. WO00001, MNU00042. */
function generateSipanduId_(sheet, prefix, kolomId) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idx = kolomId ? headers.indexOf(kolomId) : 0;
  let max = 0;
  const pola = new RegExp('^' + prefix + '(\\d+)$', 'i');
  for (let i = 1; i < data.length; i++) {
    const cocok = String(data[i][idx] || '').match(pola);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return prefix + String(max + 1).padStart(5, '0');
}

/** Nomor WO format WO-YYYYMMDD-NNNN (§4 dokumen), urut ulang per tanggal. */
function generateNomorWO_(sheet, tanggalYMD) {
  const awalan = 'WO-' + tanggalYMD + '-';
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idxNomor = headers.indexOf('NOMOR_WO');
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const nomor = String(data[i][idxNomor] || '');
    if (nomor.indexOf(awalan) === 0) {
      const urut = parseInt(nomor.substring(awalan.length), 10);
      if (!isNaN(urut)) max = Math.max(max, urut);
    }
  }
  return awalan + String(max + 1).padStart(4, '0');
}

function sipanduSukses(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sipanduGagal(message, errorCode) {
  // PENTING: kunci "message" (bukan "error") -- disamakan persis dengan
  // format gagal() di Portal Relawan, supaya frontend (sipandu-common.js)
  // bisa pakai pola apiGet/apiPost yang SAMA PERSIS tanpa cabang kode beda.
  return ContentService.createTextOutput(JSON.stringify({ success: false, message: message, errorCode: errorCode || 'ERROR' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sipanduKlasifikasiError_(err) {
  const msg = String(err && err.message || err || '');
  if (msg.indexOf('izin') !== -1 || msg.indexOf('permission') !== -1) return 'FORBIDDEN';
  if (msg.indexOf('tidak ditemukan') !== -1) return 'NOT_FOUND';
  if (msg.indexOf('sesi') !== -1 || msg.indexOf('login') !== -1) return 'UNAUTHENTICATED';
  return 'ERROR';
}

/** Ambil 1 nilai dari sheet CONFIG (key-value). */
function getSipanduConfig_(key) {
  const rows = sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.CONFIG));
  const row = rows.find(r => r.KEY === key);
  return row ? row.VALUE : null;
}

/**
 * ANTRIAN PUSH KE PORTAL UTAMA — SIPANDU (proyek terpisah) tidak bisa
 * memanggil fungsi kirim push di proyek Portal secara langsung. Solusinya:
 * tulis permintaan ke sheet 25_ANTRIAN_PUSH_SIPANDU di Spreadsheet PORTAL
 * (BUKAN Spreadsheet SIPANDU) -- dibuka lewat ID, pola SAMA seperti
 * SipanduAuth.gs membaca 07_AKUN_RELAWAN. Portal utama yang akan membaca
 * & benar-benar mengirim lewat trigger 30 menit yang sudah berjalan.
 *
 * Dibungkus try/catch SENGAJA -- gagal menulis antrian TIDAK BOLEH
 * menggagalkan aksi utama SIPANDU (mis. tetap sukses bikin WO walau
 * antrian push gagal ditulis).
 */
function antrikanPushKePortal_(idRelawan, judul, isi, link) {
  try {
    const mainSpreadsheetId = getSipanduConfig_('MAIN_PORTAL_SPREADSHEET_ID');
    if (!mainSpreadsheetId) return;

    const ss = SpreadsheetApp.openById(mainSpreadsheetId);
    const sheet = ss.getSheetByName('25_ANTRIAN_PUSH_SIPANDU');
    if (!sheet) return; // sheet belum dibuat di Portal -- diamkan, jangan sampai bikin WO gagal

    const data = sheet.getDataRange().getValues();
    let max = 0;
    for (let i = 1; i < data.length; i++) {
      const cocok = String(data[i][0] || '').match(/^APS(\d+)$/i);
      if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
    }
    const id = 'APS' + String(max + 1).padStart(6, '0');
    sheet.appendRow([id, idRelawan, judul, isi, link || '', 'MENUNGGU', new Date()]);
  } catch (e) {
    // Diamkan -- ini fitur pelengkap, bukan inti dari aksi SIPANDU.
  }
}

/** Cari semua ID_USER di SIPANDU yang punya role tertentu (mis. koordinator terkait). */
function cariUserSipanduByRole_(kodeRole) {
  return sipanduSheetToObjects(getSipanduSheet(SIPANDU_SHEET.USERS))
    .filter(u => u.ROLE_SIPANDU === kodeRole && String(u.AKTIF).toUpperCase() !== 'NONAKTIF')
    .map(u => u.ID_USER);
}
