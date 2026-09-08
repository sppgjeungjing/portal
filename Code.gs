/**
 * SPPG JEUNGJING — SISTEM ABSENSI RELAWAN
 * Code.gs — Routing utama (doGet & doPost)
 *
 * PENTING: setelah menyalin semua file .gs ke proyek Apps Script Anda,
 * deploy sebagai Web App:
 *   Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 * Salin URL yang diberikan ke dalam config.js pada website (folder utama).
 *
 * Permintaan GET dipakai untuk MEMBACA data (getDivisi, getRelawan, dst.)
 * Permintaan POST dipakai untuk MENULIS data (submitAbsensi, login, dst.)
 * POST dikirim tanpa header Content-Type khusus agar tidak memicu CORS
 * preflight yang tidak didukung Apps Script — lihat komentar di common.js.
 */

function doGet(e) {
  try {
    const action = e.parameter && e.parameter.action;
    if (!action) return gagal('Aksi API tidak diberikan oleh permintaan.', 'MISSING_ACTION');
    let data;
    switch (action) {
      case 'getJadwalRelawan':
        data = getJadwalRelawan(e.parameter.token);
        break;
      case 'getJadwalListAdmin':
        requireAuth(e.parameter.token);
        data = getJadwalListAdmin();
        break;
      case 'getInformasiRelawan':
        data = getInformasiRelawan(e.parameter.token);
        break;
      case 'getInformasiListAdmin':
        requireAuth(e.parameter.token);
        data = getInformasiListAdmin();
        break;
      case 'getDokumenRelawan':
        data = getDokumenRelawan(e.parameter.token);
        break;
      case 'getDokumenListAdmin':
        requireAuth(e.parameter.token);
        data = getDokumenListAdmin();
        break;
      case 'getNotifikasiRelawan':
        data = getNotifikasiRelawan(e.parameter.token);
        break;
      case 'getPengumumanListAdmin':
        requireAuth(e.parameter.token);
        data = getPengumumanListAdmin();
        break;
      case 'getNotifikasiListAdmin':
        requireAuth(e.parameter.token);
        data = getNotifikasiListAdmin();
        break;
      case 'getRekapDetailUntukExport':
        data = getRekapDetailUntukExport(e.parameter.token, e.parameter.periodeAwal, e.parameter.periodeAkhir);
        break;
      case 'getTrenKehadiran7Hari':
        data = getTrenKehadiran7Hari(e.parameter.token);
        break;
      case 'getDashboardLengkapRelawan':
        data = getDashboardLengkapRelawan(e.parameter.token);
        break;
      case 'getJadwalSayaHariIni':
        data = getJadwalSayaHariIni(e.parameter.token);
        break;
      case 'health':
        data = { status: 'OK', waktuServer: new Date().toISOString() };
        break;
      case 'getDivisi':
        data = getDivisiList();
        break;
      case 'getRelawan':
        data = getRelawanList(e.parameter.divisi, e.parameter.semua === '1');
        break;
      case 'getAbsensi':
        data = getAbsensiList(e.parameter);
        break;
      case 'getRekapHarian':
        data = getRekapHarian(e.parameter.tanggal);
        break;
      case 'getRekapBulanan':
        data = getRekapBulanan(e.parameter.bulan, e.parameter.tahun);
        break;
      case 'getRekapDuaMinggu':
        data = getRekapDuaMinggu(e.parameter.periodeAwal, e.parameter.periodeAkhir);
        break;
      case 'getAkunRelawanList':
        requireAuth(e.parameter.token);
        data = getAkunRelawanList();
        break;
      case 'getProfilRelawan':
        data = getProfilRelawan(e.parameter.token);
        break;
      case 'getRiwayatAbsensiRelawan':
        data = getRiwayatAbsensiRelawan(e.parameter.token);
        break;
      case 'getStatusAbsensiRelawan':
        data = getStatusAbsensiRelawan(e.parameter.token);
        break;
      case 'getPengaturanAkun':
        data = getPengaturanAkun(e.parameter.token);
        break;
      case 'getInformasiRelawan':
        data = getInformasiRelawan(e.parameter.token);
        break;
      case 'getInformasiListAdmin':
        requireAuth(e.parameter.token);
        data = getInformasiListAdmin();
        break;
      case 'getJadwalRelawan':
        data = getJadwalRelawan(e.parameter.token);
        break;
      case 'getJadwalListAdmin':
        requireAuth(e.parameter.token);
        data = getJadwalListAdmin();
        break;
      case 'getDokumenRelawan':
        data = getDokumenRelawan(e.parameter.token);
        break;
      case 'getDokumenListAdmin':
        requireAuth(e.parameter.token);
        data = getDokumenListAdmin();
        break;
      case 'getNotifikasiRelawan':
        data = getNotifikasiRelawan(e.parameter.token);
        break;
      case 'getNotifikasiListAdmin':
        requireAuth(e.parameter.token);
        data = getNotifikasiListAdmin();
        break;
      case 'getPengumumanListAdmin':
        requireAuth(e.parameter.token);
        data = getPengumumanListAdmin();
        break;
      case 'getPeriodeListAdmin':
        requireAuth(e.parameter.token);
        data = getPeriodeListAdmin();
        break;
      case 'getKalenderListAdmin':
        requireAuth(e.parameter.token);
        data = getKalenderListAdmin(e.parameter.idPeriode);
        break;
      case 'getLokasiListAdmin':
        requireAuth(e.parameter.token);
        data = getLokasiListAdmin();
        break;
      case 'getKategoriBarang':
        data = getKategoriBarang(e.parameter.token);
        break;
      case 'getKategoriBarangAdmin':
        data = getKategoriBarangAdmin(e.parameter.token);
        break;
      case 'getSatuanList':
        data = getSatuanList(e.parameter.token);
        break;
      case 'getProfilRoleSaya':
        data = getProfilRoleSaya(e.parameter.token);
        break;
      case 'masukSebagaiRelawanUntukSipandu':
        data = masukSebagaiRelawanUntukSipandu(e.parameter.token);
        break;
      case 'getAuditLogListAdmin':
        data = getAuditLogListAdmin(e.parameter.token);
        break;
      case 'getRingkasanMonitoring':
        data = getRingkasanMonitoring(e.parameter.token);
        break;
      case 'getDaftarRelawanUntukRoleAdmin':
        data = getDaftarRelawanUntukRoleAdmin(e.parameter.token);
        break;
      case 'getSatuanListAdmin':
        data = getSatuanListAdmin(e.parameter.token);
        break;
      case 'getDataBarangList':
        data = getDataBarangList(e.parameter.token, e.parameter);
        break;
      case 'getDetailBarang':
        data = getDetailBarang(e.parameter.token, e.parameter.idBarang);
        break;
      case 'getRiwayatStokList':
        data = getRiwayatStokList(e.parameter.token, e.parameter);
        break;
      case 'getStokDashboard':
        data = getStokDashboard(e.parameter.token);
        break;
      case 'getDaftarPetugasStok':
        data = getDaftarPetugasStok(e.parameter.token);
        break;
      case 'getShiftDivisiListAdmin':
        requireAuth(e.parameter.token);
        data = getShiftDivisiListAdmin(e.parameter.idPeriode);
        break;
      case 'getPenugasanKhususListAdmin':
        requireAuth(e.parameter.token);
        data = getPenugasanKhususListAdmin(e.parameter.idOperasional);
        break;
      case 'cariAbsensiUntukKoreksi':
        data = cariAbsensiUntukKoreksi(e.parameter.token, e.parameter.idRelawan, e.parameter.tanggalPresensi);
        break;
      default:
        return gagal('Aksi tidak dikenali: ' + action, 'UNKNOWN_ACTION');
    }
    return sukses(data);
  } catch (err) {
    return gagal(err.message || 'Terjadi kesalahan pada server.', klasifikasiError_(err));
  }
}

function doPost(e) {
  try {
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return gagal('Permintaan tidak valid (format data rusak). Silakan muat ulang halaman.', 'INVALID_REQUEST');
    }
    const action = body && body.action;
    if (!action) return gagal('Aksi API tidak diberikan oleh permintaan.', 'MISSING_ACTION');
    let data;
    switch (action) {
      case 'submitAbsensi':
        data = submitAbsensi(body);
        break;
      case 'ajukanIzinSakit':
        data = ajukanIzinSakit(body);
        break;
      case 'login':
        data = adminLogin(body.username, body.password);
        break;
      case 'logout':
        data = logoutAdmin(body);
        break;
      case 'logoutAdmin':
        data = logoutAdmin(body);
        break;
      case 'resetAdminPasswordWithCode':
        data = resetAdminPasswordWithCode(body);
        break;
      case 'addRelawan':
        requireAuth(body.token);
        data = addRelawan(body);
        break;
      case 'updateRelawan':
        requireAuth(body.token);
        data = updateRelawan(body);
        break;
      case 'addDivisi':
        requireAuth(body.token);
        data = addDivisi(body);
        break;
      case 'addAkunRelawan':
        requireAuth(body.token);
        data = addAkunRelawan(body);
        break;
      case 'resetPasswordRelawan':
        requireAuth(body.token);
        data = resetPasswordRelawan(body);
        break;
      case 'updateStatusAkunRelawan':
        requireAuth(body.token);
        data = updateStatusAkunRelawan(body);
        break;
      case 'addInformasi':
        requireAuth(body.token);
        data = addInformasi(body);
        break;
      case 'updateInformasi':
        requireAuth(body.token);
        data = updateInformasi(body);
        break;
      case 'updateStatusInformasi':
        requireAuth(body.token);
        data = updateStatusInformasi(body);
        break;
      case 'addJadwal':
        requireAuth(body.token);
        data = addJadwal(body);
        break;
      case 'updateJadwal':
        requireAuth(body.token);
        data = updateJadwal(body);
        break;
      case 'deleteJadwal':
        requireAuth(body.token);
        data = deleteJadwal(body);
        break;
      case 'loginRelawan':
        data = relawanLogin(body.username, body.password);
        break;
      case 'logoutRelawan':
        data = logoutRelawan(body);
        break;
      case 'updateProfilRelawan':
        data = updateProfilRelawan(body);
        break;
      case 'kirimTestPushNotifikasi':
        data = kirimTestPushNotifikasi(body);
        break;
      case 'simpanTokenPushNotifikasi':
        data = simpanTokenPushNotifikasi(body);
        break;
      case 'nonaktifkanPushNotifikasi':
        data = nonaktifkanPushNotifikasi(body);
        break;
      case 'gantiUsernameRelawan':
        data = gantiUsernameRelawan(body);
        break;
      case 'simpanFotoProfilRelawan':
        data = simpanFotoProfilRelawan(body);
        break;
      case 'addJadwal':
        requireAuth(body.token);
        data = addJadwal(body);
        break;
      case 'updateJadwal':
        requireAuth(body.token);
        data = updateJadwal(body);
        break;
      case 'deleteJadwal':
        requireAuth(body.token);
        data = deleteJadwal(body);
        break;
      case 'addInformasi':
        requireAuth(body.token);
        data = addInformasi(body);
        break;
      case 'updateInformasi':
        requireAuth(body.token);
        data = updateInformasi(body);
        break;
      case 'updateStatusInformasi':
        requireAuth(body.token);
        data = updateStatusInformasi(body);
        break;
      case 'addDokumen':
        requireAuth(body.token);
        data = addDokumen(body);
        break;
      case 'updateStatusDokumen':
        requireAuth(body.token);
        data = updateStatusDokumen(body);
        break;
      case 'addPengumuman':
        requireAuth(body.token);
        data = addPengumuman(body);
        break;
      case 'addNotifikasiSistem':
        data = addNotifikasiSistem(body);
        break;
      case 'importRelawanMassal':
        data = importRelawanMassal(body);
        break;
      case 'gantiPasswordRelawan':
        data = gantiPasswordRelawan(body);
        break;
      case 'addDokumen':
        requireAuth(body.token);
        data = addDokumen(body);
        break;
      case 'updateStatusDokumen':
        requireAuth(body.token);
        data = updateStatusDokumen(body);
        break;
      case 'addNotifikasiSistem':
        requireAuth(body.token);
        data = addNotifikasiSistem(body);
        break;
      case 'addPengumuman':
        requireAuth(body.token);
        data = addPengumuman(body);
        break;
      case 'addPeriode':
        requireAuth(body.token);
        data = addPeriode(body);
        break;
      case 'updatePeriode':
        requireAuth(body.token);
        data = updatePeriode(body);
        break;
      case 'updateStatusPeriode':
        requireAuth(body.token);
        data = updateStatusPeriode(body);
        break;
      case 'deletePeriode':
        requireAuth(body.token);
        data = deletePeriode(body);
        break;
      case 'addOperasional':
        requireAuth(body.token);
        data = addOperasional(body);
        break;
      case 'addOperasionalBulk':
        requireAuth(body.token);
        data = addOperasionalBulk(body);
        break;
      case 'updateStatusOperasional':
        requireAuth(body.token);
        data = updateStatusOperasional(body);
        break;
      case 'deleteOperasional':
        requireAuth(body.token);
        data = deleteOperasional(body);
        break;
      case 'hapusSemuaOperasionalPeriode':
        requireAuth(body.token);
        data = hapusSemuaOperasionalPeriode(body);
        break;
      case 'addLokasi':
        requireAuth(body.token);
        data = addLokasi(body);
        break;
      case 'updateLokasi':
        requireAuth(body.token);
        data = updateLokasi(body);
        break;
      case 'updateStatusLokasiAktif':
        requireAuth(body.token);
        data = updateStatusLokasiAktif(body);
        break;
      case 'deleteLokasi':
        requireAuth(body.token);
        data = deleteLokasi(body);
        break;
      case 'addKategoriStok':
        data = addKategoriStok(body);
        break;
      case 'updateStatusKategoriAktif':
        data = updateStatusKategoriAktif(body);
        break;
      case 'addSatuan':
        data = addSatuan(body);
        break;
      case 'updateStatusSatuanAktif':
        data = updateStatusSatuanAktif(body);
        break;
      case 'addBarang':
        data = addBarang(body);
        break;
      case 'updateBarang':
        data = updateBarang(body);
        break;
      case 'updateStatusBarangAktif':
        data = updateStatusBarangAktif(body);
        break;
      case 'simpanBarangMasuk':
        data = simpanBarangMasuk(body);
        break;
      case 'simpanBarangKeluar':
        data = simpanBarangKeluar(body);
        break;
      case 'setRoleStok':
        data = setRoleStok(body);
        break;
      case 'setRoleRelawan':
        data = setRoleRelawan(body);
        break;
      case 'addShiftDivisi':
        data = addShiftDivisi(body);
        break;
      case 'deleteShiftDivisi':
        data = deleteShiftDivisi(body);
        break;
      case 'addPenugasanKhusus':
        data = addPenugasanKhusus(body);
        break;
      case 'deletePenugasanKhusus':
        data = deletePenugasanKhusus(body);
        break;
      case 'koreksiTanggalOperasionalAbsensi':
        data = koreksiTanggalOperasionalAbsensi(body);
        break;
      default:
        return gagal('Aksi tidak dikenali: ' + action, 'UNKNOWN_ACTION');
    }
    return sukses(data);
  } catch (err) {
    return gagal(err.message || 'Terjadi kesalahan pada server.', klasifikasiError_(err));
  }
}

/**
 * Mengelompokkan pesan error menjadi kode kategori sederhana, supaya
 * frontend/log bisa membedakan "sesi habis" dari "input tidak valid" dari
 * "kesalahan server murni" — tanpa mengubah pesan yang sudah ada.
 */
function klasifikasiError_(err) {
  const pesan = String((err && err.message) || '').toLowerCase();
  if (pesan.indexOf('sesi') !== -1) return 'AUTH_ERROR';
  if (pesan.indexOf('tidak ditemukan') !== -1) return 'DATA_NOT_FOUND';
  if (pesan.indexOf('wajib') !== -1 || pesan.indexOf('tidak valid') !== -1 || pesan.indexOf('minimal') !== -1) return 'VALIDATION_ERROR';
  return 'SERVER_ERROR';
}
