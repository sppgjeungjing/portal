/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Relawan.gs — Data relawan & divisi
 */

/**
 * TAMBALAN DARURAT (dipulihkan lagi -- lihat catatan pengiriman):
 * dipanggil di 9 tempat (login, absensi, profil, shift, stok).
 */
function getRelawanById(id) {
  const relawan = sheetToObjects(getSheet(NAMA_SHEET.RELAWAN)).find(r => String(r.ID_RELAWAN) === String(id));
  if (!relawan) return null;
  return {
    id: relawan.ID_RELAWAN,
    nama: relawan.NAMA_RELAWAN,
    divisi: relawan.DIVISI,
    status: relawan.STATUS
  };
}

function getDivisiList() {
  // Divisi jarang berubah -- di-cache 10 menit di server (CacheService)
  // supaya tidak baca ulang Spreadsheet tiap kali dipanggil. Kalau Admin
  // baru saja menambah divisi, perubahannya baru terlihat maksimal 10
  // menit kemudian -- tukar cepat kalau kamu butuh instan (lihat addDivisi
  // di bawah, sudah menghapus cache ini otomatis begitu ada divisi baru).
  const cache = CacheService.getScriptCache();
  const tersimpan = cache.get('cache_divisi_list');
  if (tersimpan) return JSON.parse(tersimpan);

  const sheet = getSheet(NAMA_SHEET.DIVISI);
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const nama = sanitize(data[i][0]);
    if (nama) list.push(nama);
  }
  cache.put('cache_divisi_list', JSON.stringify(list), 600); // 10 menit
  return list;
}

/**
 * @param {string} [divisi] filter berdasarkan divisi (opsional)
 * @param {boolean} [semua] jika true, kembalikan relawan AKTIF & NONAKTIF (dipakai dashboard admin).
 *                          Jika false/kosong, hanya relawan AKTIF (dipakai form absensi publik).
 */
function getRelawanList(divisi, semua) {
  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const rows = sheetToObjects(sheet);
  return rows
    .filter(r => semua ? true : String(r.STATUS).toUpperCase() === 'AKTIF')
    .filter(r => !divisi || r.DIVISI === divisi)
    .map(r => ({ id: r.ID_RELAWAN, nama: r.NAMA_RELAWAN, divisi: r.DIVISI, status: r.STATUS }));
}

/** Membuat ID baru berformat R001, R002, dst. berdasarkan ID tertinggi yang sudah ada. */
function generateIdRelawan(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^R(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'R' + String(max + 1).padStart(3, '0');
}

function addRelawan(body) {
  const nama = sanitize(body.nama);
  const divisi = sanitize(body.divisi);
  if (!nama) throw new Error('Nama relawan wajib diisi.');
  if (!divisi) throw new Error('Divisi wajib dipilih.');
  if (!getDivisiList().includes(divisi)) throw new Error('Divisi tidak dikenali.');

  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const id = generateIdRelawan(sheet);
  sheet.appendRow([id, nama, divisi, 'AKTIF']);
  return { id: id, nama: nama, divisi: divisi, status: 'AKTIF' };
}

function updateRelawan(body) {
  const id = sanitize(body.id);
  if (!id) throw new Error('ID relawan wajib diisi.');

  const sheet = getSheet(NAMA_SHEET.RELAWAN);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === id) {
      const baris = i + 1;
      if (body.nama !== undefined && body.nama !== '') {
        sheet.getRange(baris, 2).setValue(sanitize(body.nama));
      }
      if (body.divisi !== undefined && body.divisi !== '') {
        sheet.getRange(baris, 3).setValue(sanitize(body.divisi));
      }
      if (body.status !== undefined && body.status !== '') {
        sheet.getRange(baris, 4).setValue(sanitize(body.status).toUpperCase());
      }
      return { id: id, success: true };
    }
  }
  throw new Error('Relawan tidak ditemukan.');
}

/**
 * IMPORT RELAWAN MASSAL — alur: baca CSV di frontend -> kirim baris ke
 * sini -> backend VALIDASI ULANG (tidak percaya data mentah dari client)
 * + cek duplikasi -> kalau body.konfirmasi=false cuma PREVIEW (tidak
 * menulis apa pun) -> Admin lihat hasil -> kirim lagi dengan
 * konfirmasi=true untuk benar-benar menyimpan yang valid saja.
 */
function importRelawanMassal(body) {
  const usernameAdmin = requireAuth(body.token);
  const baris = Array.isArray(body.rows) ? body.rows : [];
  const konfirmasi = body.konfirmasi === true;
  if (!baris.length) throw new Error('Tidak ada data untuk diimpor.');

  const divisiValid = getDivisiList();
  const relawanSheet = getSheet(NAMA_SHEET.RELAWAN);
  const existingData = relawanSheet.getDataRange().getValues();
  const namaSudahAda = new Set();
  for (let i = 1; i < existingData.length; i++) {
    const n = sanitize(existingData[i][1]);
    if (n) namaSudahAda.add(n.toLowerCase());
  }

  const hasilValid = [];
  const hasilTidakValid = [];
  const hasilDuplikat = [];
  const namaDalamBatchIni = new Set(); // cegah duplikat ANTAR baris di file yang sama

  baris.forEach((r, idx) => {
    const nomorBaris = idx + 1;
    const nama = sanitize(r.nama);
    const divisi = sanitize(r.divisi);

    if (!nama) { hasilTidakValid.push({ baris: nomorBaris, nama: r.nama || '', alasan: 'Nama kosong' }); return; }
    if (!divisi) { hasilTidakValid.push({ baris: nomorBaris, nama: nama, alasan: 'Divisi kosong' }); return; }
    if (!divisiValid.includes(divisi)) { hasilTidakValid.push({ baris: nomorBaris, nama: nama, alasan: 'Divisi "' + divisi + '" tidak dikenali' }); return; }

    const kunciNama = nama.toLowerCase();
    if (namaSudahAda.has(kunciNama) || namaDalamBatchIni.has(kunciNama)) {
      hasilDuplikat.push({ baris: nomorBaris, nama: nama, alasan: 'Nama sudah ada' });
      return;
    }

    namaDalamBatchIni.add(kunciNama);
    hasilValid.push({ baris: nomorBaris, nama: nama, divisi: divisi });
  });

  if (!konfirmasi) {
    // Mode PREVIEW -- tidak menulis apa pun, cuma laporkan hasil validasi.
    return {
      mode: 'preview',
      totalDiperiksa: baris.length,
      jumlahValid: hasilValid.length,
      jumlahTidakValid: hasilTidakValid.length,
      jumlahDuplikat: hasilDuplikat.length,
      valid: hasilValid, tidakValid: hasilTidakValid, duplikat: hasilDuplikat
    };
  }

  // Mode KONFIRMASI -- benar-benar tulis yang valid.
  const now = new Date();
  const barisBaru = hasilValid.map(r => {
    const id = generateIdRelawan(relawanSheet);
    // generateIdRelawan baca ulang sheet tiap panggil -- aman dari
    // tabrakan ID walau ditulis satu-satu lewat appendRow di bawah.
    relawanSheet.appendRow([id, r.nama, r.divisi, 'AKTIF', now, now]);
    return { id: id, nama: r.nama, divisi: r.divisi };
  });

  logAudit_('IMPORT_RELAWAN_MASSAL', 'RELAWAN', '', usernameAdmin, { jumlah: barisBaru.length });

  return {
    mode: 'konfirmasi',
    jumlahBerhasil: barisBaru.length,
    jumlahDilewati: hasilTidakValid.length + hasilDuplikat.length,
    data: barisBaru
  };
}

function addDivisi(body) {
  const nama = sanitize(body.nama);
  if (!nama) throw new Error('Nama divisi wajib diisi.');

  const existing = getDivisiList();
  if (existing.some(d => d.toLowerCase() === nama.toLowerCase())) {
    throw new Error('Divisi tersebut sudah ada.');
  }
  const sheet = getSheet(NAMA_SHEET.DIVISI);
  sheet.appendRow([nama]);
  CacheService.getScriptCache().remove('cache_divisi_list'); // supaya langsung kelihatan, tidak nunggu 10 menit
  return { nama: nama };
}
