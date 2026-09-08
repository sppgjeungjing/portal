/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Pengumuman.gs — Pengumuman (Modul Dashboard Admin)
 */

function getPengumumanSheet() {
  return getSheet(NAMA_SHEET.PENGUMUMAN);
}

function generateIdPengumuman_(sheet) {
  const data = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    const cocok = id.match(/^PGM(\d+)$/i);
    if (cocok) max = Math.max(max, parseInt(cocok[1], 10));
  }
  return 'PGM' + String(max + 1).padStart(3, '0');
}

function getPengumumanListAdmin() {
  const semua = sheetToObjects(getPengumumanSheet());
  return semua.map(p => ({
    id: p.ID, judul: p.JUDUL, isi: p.ISI, target: p.TARGET,
    tanggalPublikasi: p.TANGGAL_PUBLIKASI, status: p.STATUS
  })).reverse();
}

function addPengumuman(body) {
  const judul = sanitize(body.judul);
  const isi = sanitize(body.isi);
  const target = sanitize(body.target) || 'SEMUA';
  const tanggalPublikasiIso = sanitize(body.tanggalPublikasi);
  if (!judul) throw new Error('Judul pengumuman wajib diisi.');
  if (!isi) throw new Error('Isi pengumuman wajib diisi.');

  let tanggalPublikasiDMY = formatTanggal(new Date());
  if (tanggalPublikasiIso) {
    const bagian = tanggalPublikasiIso.split('-');
    if (bagian.length === 3) tanggalPublikasiDMY = `${bagian[2]}/${bagian[1]}/${bagian[0]}`;
  }

  const sheet = getPengumumanSheet();
  const id = generateIdPengumuman_(sheet);
  sheet.appendRow([id, judul, isi, target, tanggalPublikasiDMY, 'AKTIF', new Date()]);

  // BUG LAMA DIPERBAIKI: sebelumnya `target` disimpan di sheet tapi TIDAK
  // PERNAH diteruskan ke addInformasi() -- akibatnya Pengumuman SELALU
  // tayang ke semua orang walau Admin sudah memilih target tertentu.
  addInformasi({ judul: judul, isi: isi, targetPenerima: target });

  return { id: id };
}
