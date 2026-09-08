// ============================================================
// SPPG JEUNGJING — LOGIC DASHBOARD ADMIN (admin.html)
// Menggunakan fungsi bersama dari common.js (apiGet, apiPost, dst.)
// ============================================================

(function () {
  'use strict';

  let authToken = null;

  const cache = {
    divisiList: [],
    relawanList: [],   // semua relawan (aktif + nonaktif), untuk tab "Kelola Relawan"
    rekapHarian: [],
    rekapDuaMinggu: [],
    akunList: [],        // status akun relawan, untuk tab "Akun Relawan"
    informasiList: [],    // untuk tab "Informasi"
    periodeList: [],       // untuk tab "Periode Kerja"
    kalenderList: [],       // untuk tab "Kalender Operasional"
    lokasiList: [],         // untuk tab "Master Lokasi SPPG"
    jadwalList: [],         // untuk tab "Jadwal & Penugasan"
    dokumenList: [],          // untuk tab "Dokumen"
    notifikasiList: [],         // untuk tab "Notifikasi"
    pengumumanList: [],           // untuk tab "Pengumuman"
    errors: {}                       // { namaList: true } kalau load TERAKHIR gagal (beda dari data kosong)
  };

  const el = {
    loginWrap: document.getElementById('loginWrap'),
    dashboardWrap: document.getElementById('dashboardWrap'),
    loginForm: document.getElementById('loginForm'),
    inputUsername: document.getElementById('inputUsername'),
    inputPassword: document.getElementById('inputPassword'),
    toggleAdminPw: document.getElementById('toggleAdminPw'),
    loginError: document.getElementById('loginError'),
    btnLupaPassword: document.getElementById('btnLupaPassword'),
    btnBatalReset: document.getElementById('btnBatalReset'),
    cardLogin: document.getElementById('cardLogin'),
    cardResetPassword: document.getElementById('cardResetPassword'),
    resetPasswordForm: document.getElementById('resetPasswordForm'),
    resetUsername: document.getElementById('resetUsername'),
    resetKode: document.getElementById('resetKode'),
    resetPasswordBaru: document.getElementById('resetPasswordBaru'),
    toggleResetPw: document.getElementById('toggleResetPw'),
    resetError: document.getElementById('resetError'),
    btnLogout: document.getElementById('btnLogout'),

    statTotal: document.getElementById('statTotal'),
    statHadir: document.getElementById('statHadir'),
    statBelum: document.getElementById('statBelum'),
    statIzin: document.getElementById('statIzin'),
    statSakit: document.getElementById('statSakit'),
    statTerlambat: document.getElementById('statTerlambat'),

    tabs: document.querySelectorAll('.admin-tab-btn'),
    panels: document.querySelectorAll('.admin-panel'),

    filterTanggal: document.getElementById('filterTanggal'),
    filterDivisiHarian: document.getElementById('filterDivisiHarian'),
    filterStatusHarian: document.getElementById('filterStatusHarian'),
    btnMuatHarian: document.getElementById('btnMuatHarian'),
    btnExportHarian: document.getElementById('btnExportHarian'),
    divisiGrid: document.getElementById('divisiGrid'),
    tbodyHarian: document.getElementById('tbodyHarian'),

    filterPeriodeAwal: document.getElementById('filterPeriodeAwal'),
    filterPeriodeAkhir: document.getElementById('filterPeriodeAkhir'),
    filterDivisiDuaMinggu: document.getElementById('filterDivisiDuaMinggu'),
    btnMuatDuaMinggu: document.getElementById('btnMuatDuaMinggu'),
    btnExportDuaMinggu: document.getElementById('btnExportDuaMinggu'),
    tbodyDuaMinggu: document.getElementById('tbodyDuaMinggu'),

    formTambahRelawan: document.getElementById('formTambahRelawan'),
    inputNamaRelawanBaru: document.getElementById('inputNamaRelawanBaru'),
    selectDivisiRelawanBaru: document.getElementById('selectDivisiRelawanBaru'),
    cariRelawan: document.getElementById('cariRelawan'),
    filterDivisiRelawan: document.getElementById('filterDivisiRelawan'),
    filterStatusRelawan: document.getElementById('filterStatusRelawan'),
    tbodyRelawan: document.getElementById('tbodyRelawan'),

    formTambahDivisi: document.getElementById('formTambahDivisi'),
    inputDivisiBaru: document.getElementById('inputDivisiBaru'),
    tbodyDivisi: document.getElementById('tbodyDivisi'),

    cariAkun: document.getElementById('cariAkun'),
    filterStatusAkun: document.getElementById('filterStatusAkun'),
    tbodyAkun: document.getElementById('tbodyAkun'),
    akunPasswordAlert: document.getElementById('akunPasswordAlert'),
    akunPasswordAlertText: document.getElementById('akunPasswordAlertText'),
    btnSalinPassword: document.getElementById('btnSalinPassword'),
    btnTutupPasswordAlert: document.getElementById('btnTutupPasswordAlert'),

    formTambahInformasi: document.getElementById('formTambahInformasi'),
    inputJudulInformasi: document.getElementById('inputJudulInformasi'),
    inputIsiInformasi: document.getElementById('inputIsiInformasi'),
    listInformasiAdmin: document.getElementById('listInformasiAdmin'),

    formTambahPeriode: document.getElementById('formTambahPeriode'),
    inputNamaPeriode: document.getElementById('inputNamaPeriode'),
    inputMulaiPeriode: document.getElementById('inputMulaiPeriode'),
    inputSelesaiPeriode: document.getElementById('inputSelesaiPeriode'),
    inputKeteranganPeriode: document.getElementById('inputKeteranganPeriode'),
    tbodyPeriode: document.getElementById('tbodyPeriode'),

    formGenerateKalender: document.getElementById('formGenerateKalender'),
    selectPeriodeGenerate: document.getElementById('selectPeriodeGenerate'),
    checkboxHariGrid: document.getElementById('checkboxHariGrid'),
    inputKeteranganGenerate: document.getElementById('inputKeteranganGenerate'),
    formTambahOperasional: document.getElementById('formTambahOperasional'),
    selectPeriodeOperasional: document.getElementById('selectPeriodeOperasional'),
    inputTanggalOperasional: document.getElementById('inputTanggalOperasional'),
    inputKeteranganOperasional: document.getElementById('inputKeteranganOperasional'),
    filterPeriodeKalender: document.getElementById('filterPeriodeKalender'),
    btnHapusSemuaKalender: document.getElementById('btnHapusSemuaKalender'),
    tbodyKalender: document.getElementById('tbodyKalender'),

    formTambahLokasi: document.getElementById('formTambahLokasi'),
    btnPakaiLokasiSaya: document.getElementById('btnPakaiLokasiSaya'),
    inputNamaLokasi: document.getElementById('inputNamaLokasi'),
    inputLatitudeLokasi: document.getElementById('inputLatitudeLokasi'),
    inputLongitudeLokasi: document.getElementById('inputLongitudeLokasi'),
    inputRadiusLokasi: document.getElementById('inputRadiusLokasi'),
    inputJadikanAktifLokasi: document.getElementById('inputJadikanAktifLokasi'),
    pesanLokasiGps: document.getElementById('pesanLokasiGps'),
    tbodyLokasi: document.getElementById('tbodyLokasi'),

    formTambahJadwal: document.getElementById('formTambahJadwal'),
    inputTanggalJadwal: document.getElementById('inputTanggalJadwal'),
    inputWaktuJadwal: document.getElementById('inputWaktuJadwal'),
    selectRelawanJadwal: document.getElementById('selectRelawanJadwal'),
    inputPenugasanJadwal: document.getElementById('inputPenugasanJadwal'),
    inputKeteranganJadwal: document.getElementById('inputKeteranganJadwal'),
    selectStatusJadwal: document.getElementById('selectStatusJadwal'),
    tbodyJadwal: document.getElementById('tbodyJadwal'),

    ovTotalRelawan: document.getElementById('ovTotalRelawan'),
    ovRelawanAktif: document.getElementById('ovRelawanAktif'),
    ovAkunAktif: document.getElementById('ovAkunAktif'),
    ovNotifikasiBaru: document.getElementById('ovNotifikasiBaru'),
    ovAktivitasList: document.getElementById('ovAktivitasList'),
    ovBelumAkun: document.getElementById('ovBelumAkun'),
    ovAkunAktif2: document.getElementById('ovAkunAktif2'),
    ovAkunNonaktif: document.getElementById('ovAkunNonaktif'),

    formTambahDokumen: document.getElementById('formTambahDokumen'),
    inputJudulDokumen: document.getElementById('inputJudulDokumen'),
    inputDeskripsiDokumen: document.getElementById('inputDeskripsiDokumen'),
    selectKategoriDokumen: document.getElementById('selectKategoriDokumen'),
    inputUrlDokumen: document.getElementById('inputUrlDokumen'),
    listDokumenAdmin: document.getElementById('listDokumenAdmin'),
    dokumenAdminTabs: document.getElementById('dokumenAdminTabs'),

    formTambahNotifikasi: document.getElementById('formTambahNotifikasi'),
    inputJudulNotifikasi: document.getElementById('inputJudulNotifikasi'),
    inputIsiNotifikasi: document.getElementById('inputIsiNotifikasi'),
    listNotifikasiAdmin: document.getElementById('listNotifikasiAdmin'),

    formPengumuman: document.getElementById('formPengumuman'),
    inputJudulPengumuman: document.getElementById('inputJudulPengumuman'),
    inputIsiPengumuman: document.getElementById('inputIsiPengumuman'),
    // selectTargetPengumuman lama sudah diganti widget target (Semua/Divisi/Individu) -- lihat admin-target-widget.js
    inputJadwalPublikasi: document.getElementById('inputJadwalPublikasi'),
    listPengumumanAdmin: document.getElementById('listPengumumanAdmin')
  };

  // ===== LOGIN / LOGOUT =====
  el.toggleAdminPw.addEventListener('click', () => {
    const tampil = el.inputPassword.type === 'password';
    el.inputPassword.type = tampil ? 'text' : 'password';
    el.toggleAdminPw.textContent = tampil ? 'SEMBUNYIKAN' : 'TAMPILKAN';
  });

  // ===== LUPA PASSWORD (Tahap 5) =====
  el.toggleResetPw.addEventListener('click', () => {
    const tampil = el.resetPasswordBaru.type === 'password';
    el.resetPasswordBaru.type = tampil ? 'text' : 'password';
    el.toggleResetPw.textContent = tampil ? 'SEMBUNYIKAN' : 'TAMPILKAN';
  });

  el.btnLupaPassword.addEventListener('click', () => {
    el.cardLogin.classList.add('is-hidden');
    el.cardResetPassword.classList.remove('is-hidden');
    el.resetError.textContent = '';
  });

  el.btnBatalReset.addEventListener('click', () => {
    el.cardResetPassword.classList.add('is-hidden');
    el.cardLogin.classList.remove('is-hidden');
    el.resetPasswordForm.reset();
  });

  el.resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.resetError.textContent = '';
    showLoading('Menyimpan password baru...');
    try {
      await apiPost('resetAdminPasswordWithCode', {
        username: el.resetUsername.value.trim(),
        kode: el.resetKode.value.trim(),
        passwordBaru: el.resetPasswordBaru.value
      });
      hideLoading();
      el.resetPasswordForm.reset();
      el.cardResetPassword.classList.add('is-hidden');
      el.cardLogin.classList.remove('is-hidden');
      el.loginError.textContent = '';
      showSuccess('Password berhasil diganti. Silakan login dengan password baru.');
    } catch (err) {
      hideLoading();
      el.resetError.textContent = err.message || 'Gagal mereset password.';
    }
  });

  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    el.loginError.textContent = '';
    showLoading('Memeriksa akun...');
    try {
      const usernameInput = el.inputUsername.value.trim();
      const passwordInput = el.inputPassword.value;
      // Login AMAN diulang otomatis (lihat catatan sama di login.js) --
      // 1x percobaan ulang kalau timeout, sebelum benar-benar menyerah.
      let data;
      try {
        data = await apiPost('login', { username: usernameInput, password: passwordInput });
      } catch (errPertama) {
        if (!/tidak merespons/i.test(errPertama.message)) throw errPertama;
        showLoading('Koneksi lambat, mencoba sekali lagi...');
        data = await apiPost('login', { username: usernameInput, password: passwordInput }, undefined, 'Koneksi ke server lambat. Periksa internet Anda dan coba masuk lagi.');
      }
      authToken = data.token;
      // BARU (modul Stok): expose token secara terbatas ke luar closure ini,
      // supaya admin-stok.js (file terpisah, tidak mengubah logic admin.js
      // yang sudah ada) bisa memakai sesi admin yang sama tanpa login ulang.
      window.sppgAdminToken = authToken;
      window.dispatchEvent(new CustomEvent('sppg-admin-ready'));
      el.loginWrap.classList.add('is-hidden');
      el.dashboardWrap.classList.remove('is-hidden');
      await initDashboard();
    } catch (err) {
      el.loginError.textContent = err.message || 'Username atau password salah.';
    } finally {
      hideLoading();
    }
  });

  el.btnLogout.addEventListener('click', async () => {
    const tokenLama = authToken;
    authToken = null;
    window.sppgAdminToken = null; // BARU (modul Stok): ikut dikosongkan saat logout
    el.dashboardWrap.classList.add('is-hidden');
    el.loginWrap.classList.remove('is-hidden');
    el.inputPassword.value = '';
    try {
      await apiPost('logout', { token: tokenLama });
    } catch (err) {
      // Tampilan tetap keluar di sisi perangkat meski panggilan ke server gagal
      // (mis. sedang offline) — sesi di server akan kedaluwarsa otomatis maksimal 6 jam.
    }
  });

  /**
   * HTML untuk kondisi kosong: membedakan "memang belum ada data" (empty
   * state biasa) dari "gagal dimuat karena error API/jaringan" (empty
   * state + tombol Coba Lagi) — supaya pengguna tidak mengira data hilang
   * padahal sebenarnya request-nya yang gagal.
   */
  function emptyOrErrorHtml(key, pesanKosong) {
    if (cache.errors[key]) {
      return `<div class="empty-state">Data belum dapat dimuat karena gangguan koneksi/server.
        <button type="button" class="btn-mini" style="margin-left:8px;" onclick="muatUlangModulAdmin('${key}')">Coba Lagi</button></div>`;
    }
    return `<div class="empty-state">${pesanKosong}</div>`;
  }

  /** Sama seperti emptyOrErrorHtml, tapi dibungkus <tr><td colspan> untuk isi tbody tabel. */
  function emptyOrErrorRow(key, colspan, pesanKosong) {
    return `<tr><td colspan="${colspan}">${emptyOrErrorHtml(key, pesanKosong)}</td></tr>`;
  }

  // ===== TABS =====
  el.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      el.tabs.forEach(t => t.classList.remove('active'));
      el.panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel).classList.add('active');
    });
  });

  // ===== INIT DASHBOARD =====
  // Setiap sumber data dimuat SECARA TERPISAH (Promise.allSettled), supaya
  // satu modul yang gagal (mis. Jadwal) tidak ikut mengosongkan modul lain
  // yang datanya sebenarnya berhasil diambil (Relawan, Akun, dst).
  const SUMBER_DASHBOARD = [
    { key: 'divisiList', label: 'Divisi', fn: () => apiGetCached('getDivisi', {}, 600000) },
    { key: 'relawanList', label: 'Relawan', fn: () => apiGet('getRelawan', { semua: '1' }) },
    { key: 'akunList', label: 'Akun Relawan', fn: () => apiGet('getAkunRelawanList', { token: authToken }) },
    { key: 'informasiList', label: 'Informasi', fn: () => apiGet('getInformasiListAdmin', { token: authToken }) },
    { key: 'periodeList', label: 'Periode Kerja', fn: () => apiGet('getPeriodeListAdmin', { token: authToken }) },
    { key: 'kalenderList', label: 'Kalender Operasional', fn: () => apiGet('getKalenderListAdmin', { token: authToken }) },
    { key: 'lokasiList', label: 'Master Lokasi SPPG', fn: () => apiGet('getLokasiListAdmin', { token: authToken }) },
    { key: 'jadwalList', label: 'Jadwal & Penugasan', fn: () => apiGet('getJadwalListAdmin', { token: authToken }) },
    { key: 'dokumenList', label: 'Dokumen', fn: () => apiGet('getDokumenListAdmin', { token: authToken }) },
    { key: 'notifikasiList', label: 'Notifikasi', fn: () => apiGet('getNotifikasiListAdmin', { token: authToken }) },
    { key: 'pengumumanList', label: 'Pengumuman', fn: () => apiGet('getPengumumanListAdmin', { token: authToken }) }
  ];
  const RENDER_UNTUK_KEY = {
    relawanList: () => { renderRelawanTable(); renderOverview(); },
    divisiList: () => { fillDivisiSelects(); renderDivisiTable(); },
    akunList: () => { renderAkunTable(); renderOverview(); },
    informasiList: renderInformasiAdmin,
    periodeList: () => { fillPeriodeSelects(); renderPeriodeTable(); },
    kalenderList: renderKalenderTable,
    lokasiList: renderLokasiTable,
    jadwalList: () => { fillRelawanJadwalSelect(); renderJadwalTable(); },
    dokumenList: renderDokumenAdmin,
    notifikasiList: () => { renderNotifikasiAdmin(); renderOverview(); },
    pengumumanList: renderPengumumanAdmin
  };

  /** Muat ulang SATU sumber data saja (dipanggil dari tombol "Coba Lagi" di empty-state error). */
  window.muatUlangModulAdmin = async function (key) {
    const sumber = SUMBER_DASHBOARD.find(s => s.key === key);
    if (!sumber) return;
    try {
      cache[key] = await sumber.fn();
      cache.errors[key] = false;
      showSuccess(sumber.label + ' berhasil dimuat ulang.');
    } catch (err) {
      cache.errors[key] = true;
      showError(sumber.label + ' masih gagal dimuat: ' + (err.message || ''));
    }
    (RENDER_UNTUK_KEY[key] || function () {})();
  };

  async function initDashboard() {
    showLoading('Memuat data dashboard...');
    const sumber = SUMBER_DASHBOARD;

    const hasil = await Promise.allSettled(sumber.map(s => s.fn()));
    const gagalDimuat = [];
    hasil.forEach((r, i) => {
      const { key, label } = sumber[i];
      if (r.status === 'fulfilled') {
        cache[key] = r.value;
        cache.errors[key] = false;
      } else {
        cache[key] = cache[key] || [];
        cache.errors[key] = true;
        gagalDimuat.push(label + ' (' + (r.reason && r.reason.message ? r.reason.message : 'gagal dimuat') + ')');
      }
    });

    fillDivisiSelects();
    fillRelawanJadwalSelect();
    fillPeriodeSelects();
    renderRelawanTable();
    renderDivisiTable();
    renderAkunTable();
    renderInformasiAdmin();
    renderPeriodeTable();
    renderKalenderTable();
    renderLokasiTable();
    renderJadwalTable();
    renderDokumenAdmin();
    renderNotifikasiAdmin();
    renderPengumumanAdmin();
    renderOverview();

    const now = new Date();
    el.filterTanggal.value = toDateInputValue(now);
    const periodeDefault = defaultPeriodeDuaMinggu(now);
    el.filterPeriodeAwal.value = toDateInputValue(periodeDefault.awal);
    el.filterPeriodeAkhir.value = toDateInputValue(periodeDefault.akhir);
    el.inputTanggalJadwal.value = toDateInputValue(now);

    try {
      await muatRekapHarian();
    } catch (err) {
      gagalDimuat.push('Rekap Harian (' + (err.message || 'gagal dimuat') + ')');
    }

    hideLoading();
    if (gagalDimuat.length) {
      showError('Sebagian data belum dapat dimuat — modul lain tetap tampil: ' + gagalDimuat.join('; '));
    }
  }

  function fillRelawanJadwalSelect() {
    const relawanAktif = cache.relawanList.filter(r => (r.status || 'AKTIF') === 'AKTIF');
    el.selectRelawanJadwal.innerHTML = '<option value="SEMUA">Semua Relawan</option>' +
      relawanAktif.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
  }

  function fillDivisiSelects() {
    const opts = '<option value="">Semua Divisi</option>' +
      cache.divisiList.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    el.filterDivisiHarian.innerHTML = opts;
    el.filterDivisiDuaMinggu.innerHTML = opts;
    el.filterDivisiRelawan.innerHTML = opts;
    el.selectDivisiRelawanBaru.innerHTML = '<option value="" disabled selected>Pilih Divisi</option>' +
      cache.divisiList.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function toDateInputValue(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }
  function toMonthInputValue(date) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`; }
  /** Periode gajian: tanggal 1-14 atau 15-akhir bulan, tergantung tanggal hari ini. */
  function defaultPeriodeDuaMinggu(date) {
    const y = date.getFullYear(), m = date.getMonth();
    if (date.getDate() <= 14) return { awal: new Date(y, m, 1), akhir: new Date(y, m, 14) };
    return { awal: new Date(y, m, 15), akhir: new Date(y, m + 1, 0) };
  }
  function toTanggalIndo(dateInputValue) {
    const [y, m, d] = dateInputValue.split('-');
    return `${d}/${m}/${y}`;
  }

  // ===== REKAP HARIAN =====
  el.btnMuatHarian.addEventListener('click', muatRekapHarian);

  async function muatRekapHarian() {
    if (!el.filterTanggal.value) return;
    const tanggal = toTanggalIndo(el.filterTanggal.value);
    showLoading('Memuat rekap harian...');
    try {
      const res = await apiGet('getRekapHarian', { tanggal });
      cache.rekapHarian = res.data;
      renderStatCards(cache.rekapHarian);
      renderDivisiGrid(cache.rekapHarian);
      renderRekapHarianTable();
    } catch (err) {
      showError(err.message || 'Gagal memuat rekap harian.');
    } finally {
      hideLoading();
    }
  }

  function renderStatCards(data) {
    el.statTotal.textContent = data.length;
    el.statHadir.textContent = data.filter(r => r.status === 'HADIR' || r.status === 'TERLAMBAT').length;
    el.statBelum.textContent = data.filter(r => r.status === 'BELUM ABSEN').length;
    el.statIzin.textContent = data.filter(r => r.status === 'IZIN').length;
    el.statSakit.textContent = data.filter(r => r.status === 'SAKIT').length;
    el.statTerlambat.textContent = data.filter(r => r.status === 'TERLAMBAT').length;
  }

  function renderDivisiGrid(data) {
    const byDivisi = {};
    data.forEach(r => {
      if (!byDivisi[r.divisi]) byDivisi[r.divisi] = { total: 0, hadir: 0 };
      byDivisi[r.divisi].total++;
      if (r.status === 'HADIR' || r.status === 'TERLAMBAT') byDivisi[r.divisi].hadir++;
    });
    const names = Object.keys(byDivisi);
    if (!names.length) {
      el.divisiGrid.innerHTML = '<p class="empty-state">Belum ada data kehadiran.</p>';
      return;
    }
    el.divisiGrid.innerHTML = names.map(nama => `
      <div class="divisi-card">
        <div class="divisi-name">${escapeHtml(nama)}</div>
        <div class="divisi-stats"><span>Total: ${byDivisi[nama].total}</span><span>Hadir: ${byDivisi[nama].hadir}</span></div>
      </div>`).join('');
  }

  function renderRekapHarianTable() {
    let rows = cache.rekapHarian;
    const divisi = el.filterDivisiHarian.value;
    const status = el.filterStatusHarian.value;
    if (divisi) rows = rows.filter(r => r.divisi === divisi);
    if (status) rows = rows.filter(r => r.status === status);

    if (!rows.length) {
      el.tbodyHarian.innerHTML = `<tr><td colspan="10"><div class="empty-state">Belum ada data kehadiran.</div></td></tr>`;
      return;
    }
    el.tbodyHarian.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.nama)}</td>
        <td>${escapeHtml(r.divisi)}</td>
        <td>${escapeHtml(r.jamMasuk || '–')}</td>
        <td>${escapeHtml(r.jamPulang || '–')}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${escapeHtml(r.keterangan || '–')}${labelStatusPengajuan_(r.statusPengajuan)}</td>
        <td style="font-size:12px;">${escapeHtml(r.lokasiMasuk || '–')}</td>
        <td style="font-size:12px;">${escapeHtml(r.lokasiPulang || '–')}</td>
        <td>${buktiFotoCell_(r)}</td>
      </tr>`).join('');
  }

  function buktiFotoCell_(r) {
    const tautan = [];
    if (r.fotoMasukUrl) tautan.push(`<a href="${escapeHtml(r.fotoMasukUrl)}" target="_blank" rel="noopener" class="btn-mini" style="font-size:11px;">🖼 Masuk</a>`);
    if (r.fotoPulangUrl) tautan.push(`<a href="${escapeHtml(r.fotoPulangUrl)}" target="_blank" rel="noopener" class="btn-mini" style="font-size:11px;">🖼 Pulang</a>`);
    return tautan.length ? tautan.join(' ') : '–';
  }

  el.filterDivisiHarian.addEventListener('change', () => cache.rekapHarian.length && renderRekapHarianTable());
  el.filterStatusHarian.addEventListener('change', () => cache.rekapHarian.length && renderRekapHarianTable());

  function statusBadge(status) {
    const map = { HADIR: 'hadir', TERLAMBAT: 'terlambat', IZIN: 'izin', SAKIT: 'sakit', 'BELUM ABSEN': 'belum-absen' };
    return `<span class="badge ${map[status] || 'belum-absen'}">${escapeHtml(status)}</span>`;
  }

  // Fase 4: penanda seberapa mepet pengajuan Izin/Sakit dibanding jam shift.
  // Murni informasi buat Admin -- tidak mengubah status HADIR/IZIN/dst sama sekali.
  function labelStatusPengajuan_(statusPengajuan) {
    if (statusPengajuan === 'MEPET') return ' <span class="stok-badge stok-badge-menipis" title="Diajukan mendekati jam shift">⚠️ Mepet</span>';
    if (statusPengajuan === 'TELAT') return ' <span class="stok-badge stok-badge-habis" title="Diajukan setelah jam shift seharusnya mulai">⏰ Telat diajukan</span>';
    return '';
  }

  el.btnExportHarian.addEventListener('click', () => {
    if (!cache.rekapHarian.length) { showError('Tidak ada data untuk diexport.'); return; }
    const rows = [['No', 'Nama', 'Divisi', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan', 'Lokasi Masuk', 'Lokasi Pulang', 'Foto Masuk', 'Foto Pulang']];
    cache.rekapHarian.forEach((r, i) => rows.push([
      i + 1, r.nama, r.divisi, r.jamMasuk, r.jamPulang, r.status, r.keterangan,
      r.lokasiMasuk || '', r.lokasiPulang || '', r.fotoMasukUrl || '', r.fotoPulangUrl || ''
    ]));
    downloadCsv(rows, `rekap-harian-${el.filterTanggal.value}.csv`);
  });

  // ===== REKAP 2 MINGGU =====
  el.btnMuatDuaMinggu.addEventListener('click', muatRekapDuaMinggu);

  async function muatRekapDuaMinggu() {
    if (!el.filterPeriodeAwal.value || !el.filterPeriodeAkhir.value) return;
    if (el.filterPeriodeAwal.value > el.filterPeriodeAkhir.value) {
      showError('Periode awal tidak boleh setelah periode akhir.');
      return;
    }
    showLoading('Memuat rekap 2 minggu...');
    try {
      const res = await apiGet('getRekapDuaMinggu', {
        periodeAwal: el.filterPeriodeAwal.value,
        periodeAkhir: el.filterPeriodeAkhir.value
      });
      cache.rekapDuaMinggu = res.data;
      renderRekapDuaMingguTable();
    } catch (err) {
      showError(err.message || 'Gagal memuat rekap 2 minggu.');
    } finally {
      hideLoading();
    }
  }

  function renderRekapDuaMingguTable() {
    let rows = cache.rekapDuaMinggu;
    const divisi = el.filterDivisiDuaMinggu.value;
    if (divisi) rows = rows.filter(r => r.divisi === divisi);
    if (!rows.length) {
      el.tbodyDuaMinggu.innerHTML = `<tr><td colspan="8"><div class="empty-state">Belum ada data untuk periode ini.</div></td></tr>`;
      return;
    }
    el.tbodyDuaMinggu.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.nama)}</td>
        <td>${escapeHtml(r.divisi)}</td>
        <td>${r.hadir}</td>
        <td>${r.terlambat}</td>
        <td>${r.izin}</td>
        <td>${r.sakit}</td>
        <td>${r.tidakHadir}</td>
        <td>${r.totalHariKerja}</td>
      </tr>`).join('');
  }
  el.filterDivisiDuaMinggu.addEventListener('change', () => cache.rekapDuaMinggu.length && renderRekapDuaMingguTable());

  el.btnExportDuaMinggu.addEventListener('click', () => {
    if (!cache.rekapDuaMinggu.length) { showError('Tidak ada data untuk diexport.'); return; }
    const rows = [['Nama', 'Divisi', 'Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tidak Hadir', 'Total Hari Kerja']];
    cache.rekapDuaMinggu.forEach(r => rows.push([r.nama, r.divisi, r.hadir, r.terlambat, r.izin, r.sakit, r.tidakHadir, r.totalHariKerja]));
    downloadCsv(rows, `rekap-2minggu-${el.filterPeriodeAwal.value}_${el.filterPeriodeAkhir.value}.csv`);
  });

  // ===== KELOLA RELAWAN =====
  el.formTambahRelawan.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('Menyimpan relawan...');
    try {
      await apiPost('addRelawan', {
        token: authToken,
        nama: el.inputNamaRelawanBaru.value.trim(),
        divisi: el.selectDivisiRelawanBaru.value
      });
      el.formTambahRelawan.reset();
      await muatUlangRelawan();
    } catch (err) {
      showError(err.message || 'Gagal menambah relawan.');
    } finally {
      hideLoading();
    }
  });

  async function muatUlangRelawan() {
    cache.relawanList = await apiGet('getRelawan', { semua: '1' });
    renderRelawanTable();
    renderDivisiTable();
  }

  function renderRelawanTable() {
    let rows = cache.relawanList;
    const cari = el.cariRelawan.value.trim().toLowerCase();
    const divisi = el.filterDivisiRelawan.value;
    const status = el.filterStatusRelawan.value;
    if (cari) rows = rows.filter(r => r.nama.toLowerCase().includes(cari));
    if (divisi) rows = rows.filter(r => r.divisi === divisi);
    if (status) rows = rows.filter(r => (r.status || 'AKTIF') === status);

    if (!rows.length) {
      el.tbodyRelawan.innerHTML = emptyOrErrorRow('relawanList', 5, 'Tidak ada relawan yang cocok.');
      return;
    }

    el.tbodyRelawan.innerHTML = rows.map(r => {
      const status = r.status || 'AKTIF';
      const divisiOptions = cache.divisiList.map(d =>
        `<option value="${escapeHtml(d)}" ${d === r.divisi ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('');
      return `
      <tr data-id="${escapeHtml(r.id)}">
        <td>${escapeHtml(r.id)}</td>
        <td>
          <div class="editable-name">
            <span class="cell-nama">${escapeHtml(r.nama)}</span>
            <button type="button" class="btn-mini btn-edit-nama" title="Ubah nama">✎</button>
          </div>
        </td>
        <td><select class="mini-select select-divisi-relawan">${divisiOptions}</select></td>
        <td><span class="badge ${status === 'AKTIF' ? 'aktif' : 'nonaktif'}">${status}</span></td>
        <td><button type="button" class="btn-mini toggle-status" data-status="${status}">${status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
      </tr>`;
    }).join('');

    el.tbodyRelawan.querySelectorAll('.toggle-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr').dataset.id;
        const newStatus = btn.dataset.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
        showLoading('Memperbarui status...');
        try {
          await apiPost('updateRelawan', { token: authToken, id, status: newStatus });
          await muatUlangRelawan();
        } catch (err) {
          showError(err.message || 'Gagal memperbarui status.');
        } finally {
          hideLoading();
        }
      });
    });

    el.tbodyRelawan.querySelectorAll('.select-divisi-relawan').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.closest('tr').dataset.id;
        showLoading('Memindahkan divisi...');
        try {
          await apiPost('updateRelawan', { token: authToken, id, divisi: sel.value });
          await muatUlangRelawan();
        } catch (err) {
          showError(err.message || 'Gagal memindahkan divisi.');
        } finally {
          hideLoading();
        }
      });
    });

    el.tbodyRelawan.querySelectorAll('.btn-edit-nama').forEach(btn => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.editable-name');
        const namaLama = wrap.querySelector('.cell-nama').textContent;
        wrap.innerHTML = `
          <input type="text" class="mini-input input-edit-nama" value="${escapeHtml(namaLama)}" style="width:140px;">
          <button type="button" class="btn-mini save-nama">✓</button>`;
        const input = wrap.querySelector('.input-edit-nama');
        input.focus();
        input.select();
        wrap.querySelector('.save-nama').addEventListener('click', () => simpanNamaBaru(wrap, input.value.trim()));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') simpanNamaBaru(wrap, input.value.trim()); });
      });
    });
  }

  async function simpanNamaBaru(wrap, namaBaru) {
    const id = wrap.closest('tr').dataset.id;
    if (!namaBaru) return;
    showLoading('Menyimpan nama...');
    try {
      await apiPost('updateRelawan', { token: authToken, id, nama: namaBaru });
      await muatUlangRelawan();
    } catch (err) {
      showError(err.message || 'Gagal menyimpan nama.');
    } finally {
      hideLoading();
    }
  }

  [el.cariRelawan, el.filterDivisiRelawan, el.filterStatusRelawan].forEach(elm => {
    elm.addEventListener('input', renderRelawanTable);
    elm.addEventListener('change', renderRelawanTable);
  });

  // ===== KELOLA DIVISI =====
  el.formTambahDivisi.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('Menambah divisi...');
    try {
      await apiPost('addDivisi', { token: authToken, nama: el.inputDivisiBaru.value.trim() });
      el.inputDivisiBaru.value = '';
      cache.divisiList = await apiGetCached('getDivisi', {}, 600000);
      fillDivisiSelects();
      renderDivisiTable();
    } catch (err) {
      showError(err.message || 'Gagal menambah divisi.');
    } finally {
      hideLoading();
    }
  });

  function renderDivisiTable() {
    if (!cache.divisiList.length) {
      el.tbodyDivisi.innerHTML = emptyOrErrorRow('divisiList', 2, 'Belum ada data divisi.');
      return;
    }
    el.tbodyDivisi.innerHTML = cache.divisiList.map(d => {
      const jumlah = cache.relawanList.filter(r => r.divisi === d && (r.status || 'AKTIF') === 'AKTIF').length;
      return `<tr><td>${escapeHtml(d)}</td><td>${jumlah}</td></tr>`;
    }).join('');
  }

  // ===== EXPORT CSV =====
  function downloadCsv(rows, filename) {
    const csv = rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function csvEscape(value) {
    const str = String(value === undefined || value === null ? '' : value);
    return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }

  // ===== AKUN RELAWAN (Tahap 2) =====
  function saranUsername(nama, id) {
    const depan = (nama || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
    const angka = (id || '').replace(/[^0-9]/g, '').slice(-3).padStart(3, '0');
    return depan + angka;
  }

  function tampilkanPasswordAlert(nama, username, password) {
    el.akunPasswordAlertText.innerHTML =
      `Password sementara untuk <strong>${escapeHtml(nama)}</strong> (username: <strong>${escapeHtml(username)}</strong>):<br>` +
      `<strong style="font-size:16px;letter-spacing:1px;">${escapeHtml(password)}</strong><br>` +
      `Catat &amp; sampaikan sekarang ke relawan — password ini tidak akan ditampilkan lagi.`;
    el.akunPasswordAlert.dataset.password = password;
    el.akunPasswordAlert.classList.remove('is-hidden');
    el.akunPasswordAlert.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  el.btnTutupPasswordAlert.addEventListener('click', () => {
    el.akunPasswordAlert.classList.add('is-hidden');
  });
  el.btnSalinPassword.addEventListener('click', async () => {
    const pw = el.akunPasswordAlert.dataset.password || '';
    try {
      await navigator.clipboard.writeText(pw);
      el.btnSalinPassword.textContent = 'Tersalin ✓';
      setTimeout(() => { el.btnSalinPassword.textContent = 'Salin'; }, 1500);
    } catch (err) {
      showError('Tidak dapat menyalin otomatis. Salin manual dari layar.');
    }
  });

  async function muatUlangAkun() {
    cache.akunList = await apiGet('getAkunRelawanList', { token: authToken });
    renderAkunTable();
  }

  function renderAkunTable() {
    const akunById = {};
    cache.akunList.forEach(a => { akunById[a.idRelawan] = a; });

    let rows = cache.relawanList.filter(r => (r.status || 'AKTIF') === 'AKTIF');
    const cari = (el.cariAkun.value || '').trim().toLowerCase();
    const filterStatus = el.filterStatusAkun.value;
    if (cari) rows = rows.filter(r => r.nama.toLowerCase().includes(cari));
    if (filterStatus === 'BELUM') rows = rows.filter(r => !akunById[r.id]);
    if (filterStatus === 'AKTIF') rows = rows.filter(r => akunById[r.id] && akunById[r.id].statusAkun === 'AKTIF');
    if (filterStatus === 'NONAKTIF') rows = rows.filter(r => akunById[r.id] && akunById[r.id].statusAkun === 'NONAKTIF');

    if (!rows.length) {
      el.tbodyAkun.innerHTML = emptyOrErrorRow('akunList', 5, 'Tidak ada relawan yang cocok.');
      return;
    }

    el.tbodyAkun.innerHTML = rows.map(r => {
      const akun = akunById[r.id];
      let akunCell;
      let aksiCell;

      if (!akun) {
        akunCell = `<span class="badge nonaktif">Belum Ada Akun</span>`;
        aksiCell = `<button type="button" class="btn-mini primary btn-buat-akun">+ Buat Akun</button>`;
      } else if (akun.statusAkun === 'NONAKTIF') {
        akunCell = `${escapeHtml(akun.username)} <span class="badge akun-nonaktif">Nonaktif</span>`;
        aksiCell = `<button type="button" class="btn-mini btn-toggle-status" data-status-baru="AKTIF">Aktifkan</button>`;
      } else {
        akunCell = `${escapeHtml(akun.username)} <span class="badge ${akun.wajibGantiPassword ? 'terlambat' : 'aktif'}">${akun.wajibGantiPassword ? 'Wajib Ganti Password' : 'Aktif'}</span>`;
        aksiCell = `<button type="button" class="btn-mini btn-reset-password">Reset Password</button>
          <button type="button" class="btn-mini btn-toggle-status" data-status-baru="NONAKTIF">Nonaktifkan</button>`;
      }

      return `
      <tr data-id="${escapeHtml(r.id)}" data-nama="${escapeHtml(r.nama)}">
        <td>${escapeHtml(r.id)}</td>
        <td>${escapeHtml(r.nama)}</td>
        <td>${escapeHtml(r.divisi)}</td>
        <td class="cell-akun">${akunCell}</td>
        <td class="cell-aksi-akun">${aksiCell}</td>
      </tr>`;
    }).join('');

    el.tbodyAkun.querySelectorAll('.btn-buat-akun').forEach(btn => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        const id = tr.dataset.id;
        const nama = tr.dataset.nama;
        tr.querySelector('.cell-aksi-akun').innerHTML = `
          <form class="akun-inline-form">
            <input type="text" class="input-username-baru" placeholder="username" value="${escapeHtml(saranUsername(nama, id))}" required>
            <input type="tel" class="input-nohp-baru" placeholder="No HP (opsional)">
            <button type="submit" class="btn-mini primary">Buat</button>
            <button type="button" class="btn-mini btn-batal-akun">Batal</button>
          </form>`;
        const form = tr.querySelector('.akun-inline-form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = form.querySelector('.input-username-baru').value.trim();
          const noHp = form.querySelector('.input-nohp-baru').value.trim();
          showLoading('Membuat akun...');
          try {
            const hasil = await apiPost('addAkunRelawan', { token: authToken, idRelawan: id, username, noHp });
            await muatUlangAkun();
            tampilkanPasswordAlert(hasil.nama, hasil.username, hasil.passwordSementara);
          } catch (err) {
            showError(err.message || 'Gagal membuat akun.');
          } finally {
            hideLoading();
          }
        });
        tr.querySelector('.btn-batal-akun').addEventListener('click', renderAkunTable);
      });
    });

    el.tbodyAkun.querySelectorAll('.btn-reset-password').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const id = tr.dataset.id;
        const nama = tr.dataset.nama;
        if (!confirm(`Reset password untuk ${nama}? Password lama langsung tidak berlaku.`)) return;
        showLoading('Mereset password...');
        try {
          const hasil = await apiPost('resetPasswordRelawan', { token: authToken, idRelawan: id });
          await muatUlangAkun();
          tampilkanPasswordAlert(nama, akunById[id] ? akunById[id].username : '-', hasil.passwordSementara);
        } catch (err) {
          showError(err.message || 'Gagal mereset password.');
        } finally {
          hideLoading();
        }
      });
    });

    el.tbodyAkun.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tr = btn.closest('tr');
        const id = tr.dataset.id;
        const nama = tr.dataset.nama;
        const statusBaru = btn.dataset.statusBaru;
        const pesanKonfirmasi = statusBaru === 'NONAKTIF'
          ? `Nonaktifkan akun ${nama}? Relawan ini tidak akan bisa login lagi, dan akan otomatis keluar pada aktivitas berikutnya jika sedang login.`
          : `Aktifkan kembali akun ${nama}?`;
        if (!confirm(pesanKonfirmasi)) return;
        showLoading(statusBaru === 'NONAKTIF' ? 'Menonaktifkan akun...' : 'Mengaktifkan akun...');
        try {
          await apiPost('updateStatusAkunRelawan', { token: authToken, idRelawan: id, statusBaru });
          await muatUlangAkun();
          showSuccess(`Akun ${nama} berhasil ${statusBaru === 'NONAKTIF' ? 'dinonaktifkan' : 'diaktifkan'}.`);
        } catch (err) {
          showError(err.message || 'Gagal mengubah status akun.');
        } finally {
          hideLoading();
        }
      });
    });
  }

  [el.cariAkun, el.filterStatusAkun].forEach(elm => {
    elm.addEventListener('input', renderAkunTable);
    elm.addEventListener('change', renderAkunTable);
  });

  // ===== INFORMASI (Modul #4) =====
  async function muatUlangInformasi() {
    cache.informasiList = await apiGet('getInformasiListAdmin', { token: authToken });
    renderInformasiAdmin();
  }

  function renderInformasiAdmin() {
    if (!cache.informasiList.length) {
      el.listInformasiAdmin.innerHTML = emptyOrErrorHtml('informasiList', 'Belum ada informasi.');
      return;
    }
    el.listInformasiAdmin.innerHTML = cache.informasiList.map(i => `
      <div class="info-card" data-id="${escapeHtml(i.id)}">
        <p class="info-card-date">${escapeHtml(i.tanggal)} · <span class="badge ${i.status === 'AKTIF' ? 'aktif' : 'akun-nonaktif'}">${i.status === 'AKTIF' ? 'Aktif' : 'Nonaktif'}</span></p>
        <h3 class="info-card-title">${escapeHtml(i.judul)}</h3>
        <p class="info-card-body">${escapeHtml(i.isi)}</p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button type="button" class="btn-mini btn-edit-informasi">Edit</button>
          <button type="button" class="btn-mini btn-toggle-informasi" data-status-baru="${i.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}">${i.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button>
        </div>
      </div>`).join('');

    el.listInformasiAdmin.querySelectorAll('.btn-edit-informasi').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.info-card');
        const id = card.dataset.id;
        const info = cache.informasiList.find(i => i.id === id);
        card.innerHTML = `
          <form class="akun-inline-form" style="flex-direction:column;align-items:stretch;gap:8px;">
            <input type="text" class="edit-judul-informasi" value="${escapeHtml(info.judul)}" required>
            <textarea class="edit-isi-informasi" rows="3" style="font-family:inherit;padding:10px 12px;border-radius:8px;border:1.5px solid var(--color-border);font-size:13.5px;resize:vertical;" required>${escapeHtml(info.isi)}</textarea>
            <div style="display:flex;gap:8px;">
              <button type="submit" class="btn-mini primary">Simpan</button>
              <button type="button" class="btn-mini btn-batal-edit-informasi">Batal</button>
            </div>
          </form>`;
        card.querySelector('form').addEventListener('submit', async (e) => {
          e.preventDefault();
          showLoading('Menyimpan informasi...');
          try {
            await apiPost('updateInformasi', {
              token: authToken, id,
              judul: card.querySelector('.edit-judul-informasi').value.trim(),
              isi: card.querySelector('.edit-isi-informasi').value.trim()
            });
            await muatUlangInformasi();
          } catch (err) {
            showError(err.message || 'Gagal menyimpan informasi.');
          } finally {
            hideLoading();
          }
        });
        card.querySelector('.btn-batal-edit-informasi').addEventListener('click', renderInformasiAdmin);
      });
    });

    el.listInformasiAdmin.querySelectorAll('.btn-toggle-informasi').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('.info-card').dataset.id;
        const statusBaru = btn.dataset.statusBaru;
        showLoading('Mengubah status...');
        try {
          await apiPost('updateStatusInformasi', { token: authToken, id, statusBaru });
          await muatUlangInformasi();
        } catch (err) {
          showError(err.message || 'Gagal mengubah status.');
        } finally {
          hideLoading();
        }
      });
    });
  }

  el.formTambahInformasi.addEventListener('submit', async (e) => {
    e.preventDefault();
    let targetPenerima;
    try { targetPenerima = ambilNilaiTargetWidget('Informasi'); } catch (err) { showError(err.message); return; }
    showLoading('Menambah informasi...');
    try {
      await apiPost('addInformasi', {
        token: authToken,
        judul: el.inputJudulInformasi.value.trim(),
        isi: el.inputIsiInformasi.value.trim(),
        targetPenerima: targetPenerima
      });
      el.formTambahInformasi.reset();
      resetTargetWidget('Informasi');
      await muatUlangInformasi();
      showSuccess('Informasi berhasil ditambahkan.');
    } catch (err) {
      showError(err.message || 'Gagal menambah informasi.');
    } finally {
      hideLoading();
    }
  });

  // ===== PERIODE KERJA (Fase 2) =====
  function fillPeriodeSelects() {
    const opts = '<option value="" disabled selected>Pilih Periode</option>' +
      cache.periodeList.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)} (${escapeHtml(p.status)})</option>`).join('');
    el.selectPeriodeGenerate.innerHTML = opts;
    el.selectPeriodeOperasional.innerHTML = opts;
    el.filterPeriodeKalender.innerHTML = '<option value="">Semua Periode</option>' +
      cache.periodeList.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)}</option>`).join('');
  }

  async function muatUlangPeriode() {
    cache.periodeList = await apiGet('getPeriodeListAdmin', { token: authToken });
    fillPeriodeSelects();
    renderPeriodeTable();
  }

  function renderPeriodeTable() {
    if (!cache.periodeList.length) {
      el.tbodyPeriode.innerHTML = emptyOrErrorRow('periodeList', 5, 'Belum ada periode kerja.');
      return;
    }
    const opsiStatus = ['DRAFT', 'AKTIF', 'SELESAI', 'DITUTUP'];
    el.tbodyPeriode.innerHTML = cache.periodeList.map(p => `
      <tr data-id="${escapeHtml(p.id)}">
        <td>${escapeHtml(p.nama)}${p.keterangan ? `<br><span style="font-size:11px;color:var(--color-text-muted);">${escapeHtml(p.keterangan)}</span>` : ''}</td>
        <td>${escapeHtml(p.tanggalMulai)}</td>
        <td>${escapeHtml(p.tanggalSelesai)}</td>
        <td>
          <select class="select-status-periode" style="font-size:12.5px;padding:4px 6px;border-radius:6px;border:1.5px solid var(--color-border);">
            ${opsiStatus.map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <a href="#" class="btn-mini btn-lihat-kalender-periode" data-id="${escapeHtml(p.id)}">Lihat Kalender</a>
          <button type="button" class="btn-mini btn-hapus-periode" data-id="${escapeHtml(p.id)}" style="background:var(--color-danger-bg);color:var(--color-danger);border-color:var(--color-danger);">Hapus</button>
        </td>
      </tr>`).join('');

    el.tbodyPeriode.querySelectorAll('.select-status-periode').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.closest('tr').dataset.id;
        const statusBaru = sel.value;
        showLoading('Mengubah status periode...');
        try {
          await apiPost('updateStatusPeriode', { token: authToken, id, status: statusBaru });
          await muatUlangPeriode();
          showSuccess('Status periode diperbarui menjadi ' + statusBaru + '.');
        } catch (err) {
          showError(err.message || 'Gagal mengubah status periode.');
          await muatUlangPeriode(); // kembalikan tampilan ke status sebenarnya di server
        } finally {
          hideLoading();
        }
      });
    });

    el.tbodyPeriode.querySelectorAll('.btn-lihat-kalender-periode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.dataset.id;
        document.querySelector('[data-panel="panelKalender"]').click();
        el.filterPeriodeKalender.value = id;
        muatUlangKalender();
      });
    });

    el.tbodyPeriode.querySelectorAll('.btn-hapus-periode').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nama = btn.closest('tr').querySelector('td').textContent.trim();
        if (!confirm(`Hapus periode "${nama}"? Hanya bisa dihapus kalau belum ada tanggal operasional di dalamnya.`)) return;
        showLoading('Menghapus periode...');
        try {
          await apiPost('deletePeriode', { token: authToken, id });
          await muatUlangPeriode();
          showSuccess('Periode dihapus.');
        } catch (err) {
          showError(err.message || 'Gagal menghapus periode.');
        } finally {
          hideLoading();
        }
      });
    });
  }

  el.formTambahPeriode.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('Menambah periode...');
    try {
      await apiPost('addPeriode', {
        token: authToken,
        nama: el.inputNamaPeriode.value.trim(),
        tanggalMulai: el.inputMulaiPeriode.value,
        tanggalSelesai: el.inputSelesaiPeriode.value,
        keterangan: el.inputKeteranganPeriode.value.trim()
      });
      el.formTambahPeriode.reset();
      await muatUlangPeriode();
      showSuccess('Periode berhasil ditambahkan (status DRAFT).');
    } catch (err) {
      showError(err.message || 'Gagal menambah periode.');
    } finally {
      hideLoading();
    }
  });

  // ===== KALENDER OPERASIONAL (Fase 3) =====
  async function muatUlangKalender() {
    cache.kalenderList = await apiGet('getKalenderListAdmin', {
      token: authToken,
      idPeriode: el.filterPeriodeKalender.value || undefined
    });
    renderKalenderTable();
  }

  function renderKalenderTable() {
    if (!cache.kalenderList.length) {
      el.tbodyKalender.innerHTML = emptyOrErrorRow('kalenderList', 5, 'Belum ada tanggal operasional.');
      return;
    }
    el.tbodyKalender.innerHTML = cache.kalenderList.map(k => `
      <tr data-id="${escapeHtml(k.id)}">
        <td>${escapeHtml(k.tanggal)}<br><span style="font-size:11px;color:var(--color-text-muted);">${escapeHtml(k.hari || '')}</span></td>
        <td>${escapeHtml(k.namaPeriode)}</td>
        <td><span class="badge ${k.status === 'AKTIF' ? 'aktif' : 'nonaktif'}">${escapeHtml(k.status)}</span></td>
        <td>${escapeHtml(k.keterangan || '-')}</td>
        <td>
          <button type="button" class="btn-mini btn-toggle-operasional" data-status-baru="${k.status === 'AKTIF' ? 'DIBATALKAN' : 'AKTIF'}">${k.status === 'AKTIF' ? 'Batalkan' : 'Aktifkan'}</button>
          <button type="button" class="btn-mini btn-hapus-operasional">Hapus</button>
        </td>
      </tr>`).join('');

    el.tbodyKalender.querySelectorAll('.btn-toggle-operasional').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr').dataset.id;
        const statusBaru = btn.dataset.statusBaru;
        showLoading('Mengubah status...');
        try {
          await apiPost('updateStatusOperasional', { token: authToken, id, status: statusBaru });
          await muatUlangKalender();
        } catch (err) {
          showError(err.message || 'Gagal mengubah status.');
        } finally {
          hideLoading();
        }
      });
    });

    el.tbodyKalender.querySelectorAll('.btn-hapus-operasional').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr').dataset.id;
        if (!confirm('Hapus tanggal operasional ini? Tidak bisa dibatalkan.')) return;
        showLoading('Menghapus...');
        try {
          await apiPost('deleteOperasional', { token: authToken, id });
          await muatUlangKalender();
        } catch (err) {
          showError(err.message || 'Gagal menghapus.');
        } finally {
          hideLoading();
        }
      });
    });
  }

  el.filterPeriodeKalender.addEventListener('change', () => {
    muatUlangKalender().catch(err => showError(err.message || 'Gagal memuat kalender.'));
  });

  el.btnHapusSemuaKalender.addEventListener('click', async () => {
    const idPeriode = el.filterPeriodeKalender.value;
    if (!idPeriode) {
      showError('Pilih satu periode dulu di dropdown sebelum menghapus semua tanggalnya.');
      return;
    }
    const namaPeriode = el.filterPeriodeKalender.options[el.filterPeriodeKalender.selectedIndex].textContent;
    if (!confirm(`Hapus SEMUA tanggal operasional pada "${namaPeriode}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    showLoading('Menghapus semua tanggal...');
    try {
      const hasil = await apiPost('hapusSemuaOperasionalPeriode', { token: authToken, idPeriode });
      await muatUlangKalender();
      showSuccess(`${hasil.dihapus} tanggal operasional dihapus.`);
    } catch (err) {
      showError(err.message || 'Gagal menghapus.');
    } finally {
      hideLoading();
    }
  });

  el.formGenerateKalender.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hariAktif = Array.from(el.checkboxHariGrid.querySelectorAll('input:checked')).map(c => Number(c.value));
    if (!el.selectPeriodeGenerate.value) { showError('Pilih periode terlebih dahulu.'); return; }
    if (!hariAktif.length) { showError('Pilih minimal satu hari dalam minggu.'); return; }
    showLoading('Membuat tanggal operasional...');
    try {
      const hasil = await apiPost('addOperasionalBulk', {
        token: authToken,
        idPeriode: el.selectPeriodeGenerate.value,
        hariAktif: hariAktif,
        keterangan: el.inputKeteranganGenerate.value.trim()
      });
      el.checkboxHariGrid.querySelectorAll('input:checked').forEach(c => { c.checked = false; });
      el.inputKeteranganGenerate.value = '';
      el.filterPeriodeKalender.value = el.selectPeriodeGenerate.value;
      await muatUlangKalender();
      showSuccess(`${hasil.ditambahkan} tanggal operasional dibuat` + (hasil.dilewati ? `, ${hasil.dilewati} dilewati (sudah ada).` : '.'));
    } catch (err) {
      showError(err.message || 'Gagal membuat tanggal operasional.');
    } finally {
      hideLoading();
    }
  });

  el.formTambahOperasional.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('Menambah tanggal operasional...');
    try {
      await apiPost('addOperasional', {
        token: authToken,
        idPeriode: el.selectPeriodeOperasional.value,
        tanggal: el.inputTanggalOperasional.value,
        keterangan: el.inputKeteranganOperasional.value.trim()
      });
      el.formTambahOperasional.reset();
      el.filterPeriodeKalender.value = el.selectPeriodeOperasional.value;
      await muatUlangKalender();
      showSuccess('Tanggal operasional ditambahkan.');
    } catch (err) {
      showError(err.message || 'Gagal menambah tanggal operasional.');
    } finally {
      hideLoading();
    }
  });

  // ===== MASTER LOKASI SPPG (Fase 4) =====
  el.btnPakaiLokasiSaya.addEventListener('click', () => {
    if (!navigator.geolocation) {
      el.pesanLokasiGps.textContent = 'Perangkat/browser ini tidak mendukung GPS.';
      return;
    }
    el.pesanLokasiGps.textContent = 'Mengambil lokasi Anda...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        el.inputLatitudeLokasi.value = pos.coords.latitude.toFixed(7);
        el.inputLongitudeLokasi.value = pos.coords.longitude.toFixed(7);
        el.pesanLokasiGps.textContent = `Lokasi terisi (akurasi ±${Math.round(pos.coords.accuracy)} meter). Periksa sebelum menyimpan.`;
      },
      (err) => {
        el.pesanLokasiGps.textContent = 'Gagal mengambil lokasi: ' + (err.message || 'izin lokasi ditolak.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  async function muatUlangLokasi() {
    cache.lokasiList = await apiGet('getLokasiListAdmin', { token: authToken });
    renderLokasiTable();
  }

  function renderLokasiTable() {
    if (!cache.lokasiList.length) {
      el.tbodyLokasi.innerHTML = emptyOrErrorRow('lokasiList', 5, 'Belum ada lokasi SPPG terdaftar. Tambahkan titik referensi resmi di atas.');
      return;
    }
    el.tbodyLokasi.innerHTML = cache.lokasiList.map(l => `
      <tr data-id="${escapeHtml(l.id)}">
        <td>${escapeHtml(l.nama)}</td>
        <td style="font-size:12px;">${l.latitude}, ${l.longitude}</td>
        <td>${l.radiusMeter} m</td>
        <td><span class="badge ${l.statusAktif === 'AKTIF' ? 'aktif' : 'nonaktif'}">${escapeHtml(l.statusAktif)}</span></td>
        <td>
          ${l.statusAktif === 'AKTIF'
            ? '<span style="font-size:11.5px;color:var(--color-text-muted);">Aktif saat ini</span>'
            : `<button type="button" class="btn-mini btn-aktifkan-lokasi">Jadikan Aktif</button> <button type="button" class="btn-mini btn-hapus-lokasi">Hapus</button>`}
        </td>
      </tr>`).join('');

    el.tbodyLokasi.querySelectorAll('.btn-aktifkan-lokasi').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr').dataset.id;
        showLoading('Mengaktifkan lokasi...');
        try {
          await apiPost('updateStatusLokasiAktif', { token: authToken, id });
          await muatUlangLokasi();
          showSuccess('Lokasi ini sekarang menjadi referensi aktif.');
        } catch (err) {
          showError(err.message || 'Gagal mengaktifkan lokasi.');
        } finally {
          hideLoading();
        }
      });
    });

    el.tbodyLokasi.querySelectorAll('.btn-hapus-lokasi').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr').dataset.id;
        if (!confirm('Hapus lokasi ini?')) return;
        showLoading('Menghapus...');
        try {
          await apiPost('deleteLokasi', { token: authToken, id });
          await muatUlangLokasi();
        } catch (err) {
          showError(err.message || 'Gagal menghapus.');
        } finally {
          hideLoading();
        }
      });
    });
  }

  el.formTambahLokasi.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('Menyimpan lokasi...');
    try {
      await apiPost('addLokasi', {
        token: authToken,
        nama: el.inputNamaLokasi.value.trim(),
        latitude: el.inputLatitudeLokasi.value,
        longitude: el.inputLongitudeLokasi.value,
        radiusMeter: el.inputRadiusLokasi.value,
        jadikanAktif: el.inputJadikanAktifLokasi.checked
      });
      el.formTambahLokasi.reset();
      el.pesanLokasiGps.textContent = '';
      await muatUlangLokasi();
      showSuccess('Lokasi berhasil disimpan.');
    } catch (err) {
      showError(err.message || 'Gagal menyimpan lokasi.');
    } finally {
      hideLoading();
    }
  });

  // ===== JADWAL & PENUGASAN (Modul #5) =====
  async function muatUlangJadwal() {
    cache.jadwalList = await apiGet('getJadwalListAdmin', { token: authToken });
    renderJadwalTable();
  }

  function renderJadwalTable() {
    if (!cache.jadwalList.length) {
      el.tbodyJadwal.innerHTML = emptyOrErrorRow('jadwalList', 6, 'Belum ada jadwal.');
      return;
    }
    el.tbodyJadwal.innerHTML = cache.jadwalList.map(j => `
      <tr data-id="${escapeHtml(j.id)}">
        <td>${escapeHtml(j.tanggal)}<br><span style="font-size:11px;color:var(--color-text-muted);">${escapeHtml(j.hari || '')}</span></td>
        <td>${escapeHtml(j.waktu || '-')}</td>
        <td>${escapeHtml(j.namaRelawan)}</td>
        <td>${escapeHtml(j.penugasan)}${j.keterangan ? `<br><span style="font-size:11px;color:var(--color-text-muted);">${escapeHtml(j.keterangan)}</span>` : ''}</td>
        <td><span class="badge ${j.status === 'Selesai' ? 'aktif' : j.status === 'Dibatalkan' ? 'nonaktif' : 'izin'}">${escapeHtml(j.status)}</span></td>
        <td>
          <button type="button" class="btn-mini btn-hapus-jadwal">Hapus</button>
        </td>
      </tr>`).join('');

    el.tbodyJadwal.querySelectorAll('.btn-hapus-jadwal').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('tr').dataset.id;
        if (!confirm('Hapus jadwal ini? Tidak bisa dibatalkan.')) return;
        showLoading('Menghapus jadwal...');
        try {
          await apiPost('deleteJadwal', { token: authToken, id });
          await muatUlangJadwal();
        } catch (err) {
          showError(err.message || 'Gagal menghapus jadwal.');
        } finally {
          hideLoading();
        }
      });
    });
  }

  el.formTambahJadwal.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('Menambah jadwal...');
    try {
      await apiPost('addJadwal', {
        token: authToken,
        tanggal: el.inputTanggalJadwal.value,
        waktu: el.inputWaktuJadwal.value,
        idRelawan: el.selectRelawanJadwal.value,
        penugasan: el.inputPenugasanJadwal.value.trim(),
        keterangan: el.inputKeteranganJadwal.value.trim(),
        status: el.selectStatusJadwal.value
      });
      el.formTambahJadwal.reset();
      el.inputTanggalJadwal.value = toDateInputValue(new Date());
      await muatUlangJadwal();
      showSuccess('Jadwal berhasil ditambahkan.');
    } catch (err) {
      showError(err.message || 'Gagal menambah jadwal.');
    } finally {
      hideLoading();
    }
  });

  // ===== DASHBOARD (OVERVIEW) — data aktual, tidak hard-code =====
  function iconInformasi_() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/></svg>'; }
  function iconJadwal_() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>'; }
  function iconSistem_() { return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8l0 4l3 2"/></svg>'; }
  function notifIcon_(kategori) {
    if (kategori === 'Informasi') return iconInformasi_();
    if (kategori === 'Sistem') return iconSistem_();
    return iconJadwal_();
  }
  function notifTypeClass_(kategori) {
    if (kategori === 'Informasi') return 'type-informasi';
    if (kategori === 'Sistem') return 'type-absensi';
    return 'type-jadwal';
  }

  function renderOverview() {
    if (!el.ovTotalRelawan) return;
    const relawanGagal = cache.errors.relawanList;
    const akunGagal = cache.errors.akunList;
    const gagalTanda = '—'; // beda dari "0" — supaya tidak terbaca sebagai "memang nol"

    const totalRelawan = cache.relawanList.length;
    const relawanAktif = cache.relawanList.filter(r => (r.status || 'AKTIF') === 'AKTIF').length;
    const akunById = {};
    cache.akunList.forEach(a => { akunById[a.idRelawan] = a; });
    let belumAkun = 0, akunAktif = 0, akunNonaktif = 0;
    cache.relawanList.forEach(r => {
      const akun = akunById[r.id];
      if (!akun) belumAkun++;
      else if (akun.statusAkun === 'AKTIF') akunAktif++;
      else akunNonaktif++;
    });

    el.ovTotalRelawan.textContent = relawanGagal ? gagalTanda : totalRelawan;
    el.ovRelawanAktif.textContent = relawanGagal ? gagalTanda : relawanAktif;
    el.ovAkunAktif.textContent = (relawanGagal || akunGagal) ? gagalTanda : akunAktif;
    el.ovBelumAkun.textContent = (relawanGagal || akunGagal) ? gagalTanda : belumAkun;
    el.ovAkunAktif2.textContent = (relawanGagal || akunGagal) ? gagalTanda : akunAktif;
    el.ovAkunNonaktif.textContent = (relawanGagal || akunGagal) ? gagalTanda : akunNonaktif;

    // "Notifikasi Baru" = notifikasi yang tercatat dalam 3 hari terakhir (data aktual, bukan statis).
    const batasWaktu = new Date();
    batasWaktu.setDate(batasWaktu.getDate() - 3);
    const notifBaru = cache.notifikasiList.filter(n => {
      const d = new Date(n.tanggal);
      return !isNaN(d.getTime()) && d >= batasWaktu;
    });
    el.ovNotifikasiBaru.textContent = cache.errors.notifikasiList ? gagalTanda : notifBaru.length;

    const aktivitas = cache.notifikasiList.slice(0, 6);
    if (!aktivitas.length) {
      el.ovAktivitasList.innerHTML = emptyOrErrorHtml('notifikasiList', 'Belum ada aktivitas terbaru.');
    } else {
      el.ovAktivitasList.innerHTML = aktivitas.map(n => `
        <div class="activity-item">
          <span class="activity-item-icon ${notifTypeClass_(n.kategori)}">${notifIcon_(n.kategori)}</span>
          <span class="activity-item-body">
            <p class="activity-title">${escapeHtml(n.judul)}</p>
            <p class="activity-desc">${escapeHtml(n.isi)}</p>
            <p class="activity-time">${escapeHtml(formatTanggalWaktuIndoShell(n.tanggal))}</p>
          </span>
        </div>`).join('');
    }
  }

  // ===== DOKUMEN =====
  let dokumenKategoriAktif = '';
  function renderDokumenAdmin() {
    let rows = cache.dokumenList;
    if (dokumenKategoriAktif) rows = rows.filter(d => d.kategori === dokumenKategoriAktif);

    if (!rows.length) {
      el.listDokumenAdmin.innerHTML = emptyOrErrorHtml('dokumenList', 'Belum ada dokumen yang tersedia.');
      return;
    }
    el.listDokumenAdmin.innerHTML = rows.map(d => `
      <div class="doc-item" data-id="${escapeHtml(d.id)}">
        <span class="doc-item-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M15 3v5h5"/></svg></span>
        <span class="doc-item-text">
          <strong>${escapeHtml(d.judul)}</strong>
          <span>${escapeHtml(d.deskripsi || '')}</span>
          <span class="badge ${d.status === 'AKTIF' ? 'aktif' : 'akun-nonaktif'}" style="margin-top:4px;display:inline-block;">${escapeHtml(d.kategori)} &middot; ${d.status === 'AKTIF' ? 'Aktif' : 'Nonaktif'}</span>
        </span>
        <button type="button" class="btn-mini btn-toggle-dokumen" data-status-baru="${d.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF'}">${d.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button>
      </div>`).join('');

    el.listDokumenAdmin.querySelectorAll('.btn-toggle-dokumen').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.closest('.doc-item').dataset.id;
        const statusBaru = btn.dataset.statusBaru;
        showLoading('Menyimpan...');
        try {
          await apiPost('updateStatusDokumen', { token: authToken, id, statusBaru });
          const dok = cache.dokumenList.find(d => d.id === id);
          if (dok) dok.status = statusBaru;
          renderDokumenAdmin();
          showSuccess('Status dokumen diperbarui.');
        } catch (err) {
          showError(err.message || 'Gagal memperbarui status dokumen.');
        } finally {
          hideLoading();
        }
      });
    });
  }

  if (el.dokumenAdminTabs) {
    el.dokumenAdminTabs.querySelectorAll('.chip-tab').forEach(chip => {
      chip.addEventListener('click', () => {
        el.dokumenAdminTabs.querySelectorAll('.chip-tab').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        dokumenKategoriAktif = chip.dataset.kat || '';
        renderDokumenAdmin();
      });
    });
  }

  if (el.formTambahDokumen) {
    el.formTambahDokumen.addEventListener('submit', async (e) => {
      e.preventDefault();
      showLoading('Menambah dokumen...');
      try {
        const res = await apiPost('addDokumen', {
          token: authToken,
          judul: el.inputJudulDokumen.value.trim(),
          deskripsi: el.inputDeskripsiDokumen.value.trim(),
          kategori: el.selectKategoriDokumen.value,
          url: el.inputUrlDokumen.value.trim()
        });
        cache.dokumenList.unshift({
          id: res.id, judul: el.inputJudulDokumen.value.trim(), deskripsi: el.inputDeskripsiDokumen.value.trim(),
          kategori: el.selectKategoriDokumen.value, url: el.inputUrlDokumen.value.trim(), status: 'AKTIF'
        });
        el.formTambahDokumen.reset();
        renderDokumenAdmin();
        showSuccess('Dokumen berhasil ditambahkan.');
      } catch (err) {
        showError(err.message || 'Gagal menambah dokumen.');
      } finally {
        hideLoading();
      }
    });
  }

  // ===== NOTIFIKASI =====
  function renderNotifikasiAdmin() {
    if (!cache.notifikasiList.length) {
      el.listNotifikasiAdmin.innerHTML = emptyOrErrorHtml('notifikasiList', 'Belum ada notifikasi baru.');
      return;
    }
    el.listNotifikasiAdmin.innerHTML = cache.notifikasiList.slice(0, 30).map(n => `
      <div class="activity-item">
        <span class="activity-item-icon ${notifTypeClass_(n.kategori)}">${notifIcon_(n.kategori)}</span>
        <span class="activity-item-body">
          <p class="activity-title">${escapeHtml(n.judul)} <span class="badge izin" style="margin-left:4px;">${escapeHtml(n.kategori)}</span></p>
          <p class="activity-desc">${escapeHtml(n.isi)}</p>
          <p class="activity-time">${escapeHtml(formatTanggalWaktuIndoShell(n.tanggal))} &middot; ${n.idRelawan === 'SEMUA' ? 'Semua Relawan' : n.idRelawan}</p>
        </span>
      </div>`).join('');
  }

  if (el.formTambahNotifikasi) {
    el.formTambahNotifikasi.addEventListener('submit', async (e) => {
      e.preventDefault();
      let idRelawanTarget;
      try { idRelawanTarget = ambilNilaiTargetWidget('Notifikasi'); } catch (err) { showError(err.message); return; }
      showLoading('Mengirim notifikasi...');
      try {
        await apiPost('addNotifikasiSistem', {
          token: authToken,
          judul: el.inputJudulNotifikasi.value.trim(),
          isi: el.inputIsiNotifikasi.value.trim(),
          kategori: 'Sistem',
          idRelawan: idRelawanTarget
        });
        el.formTambahNotifikasi.reset();
        resetTargetWidget('Notifikasi');
        const ulang = await apiGet('getNotifikasiListAdmin', { token: authToken });
        cache.notifikasiList = ulang;
        renderNotifikasiAdmin();
        renderOverview();
        showSuccess('Notifikasi berhasil dikirim.');
      } catch (err) {
        showError(err.message || 'Gagal mengirim notifikasi.');
      } finally {
        hideLoading();
      }
    });
  }

  // ===== PENGUMUMAN =====
  function renderPengumumanAdmin() {
    if (!cache.pengumumanList.length) {
      el.listPengumumanAdmin.innerHTML = emptyOrErrorHtml('pengumumanList', 'Belum ada pengumuman yang dibuat.');
      return;
    }
    el.listPengumumanAdmin.innerHTML = cache.pengumumanList.map(p => `
      <div class="info-card">
        <p class="info-card-date">${escapeHtml(p.tanggalPublikasi)} &middot; ${p.target === 'SEMUA' ? 'Semua Relawan' : escapeHtml(p.target)}</p>
        <h3 class="info-card-title">${escapeHtml(p.judul)}</h3>
        <p class="info-card-body">${escapeHtml(p.isi)}</p>
      </div>`).join('');
  }

  if (el.formPengumuman) {
    el.formPengumuman.addEventListener('submit', async (e) => {
      e.preventDefault();
      let targetNilai;
      try { targetNilai = ambilNilaiTargetWidget('Pengumuman'); } catch (err) { showError(err.message); return; }
      showLoading('Mempublikasikan pengumuman...');
      try {
        await apiPost('addPengumuman', {
          token: authToken,
          judul: el.inputJudulPengumuman.value.trim(),
          isi: el.inputIsiPengumuman.value.trim(),
          target: targetNilai,
          tanggalPublikasi: el.inputJadwalPublikasi.value
        });
        el.formPengumuman.reset();
        resetTargetWidget('Pengumuman');
        const [pengumumanUlang, informasiUlang, notifikasiUlang] = await Promise.all([
          apiGet('getPengumumanListAdmin', { token: authToken }),
          apiGet('getInformasiListAdmin', { token: authToken }),
          apiGet('getNotifikasiListAdmin', { token: authToken })
        ]);
        cache.pengumumanList = pengumumanUlang;
        cache.informasiList = informasiUlang;
        cache.notifikasiList = notifikasiUlang;
        renderPengumumanAdmin();
        renderInformasiAdmin();
        renderNotifikasiAdmin();
        renderOverview();
        showSuccess('Pengumuman berhasil dipublikasikan ke seluruh relawan.');
      } catch (err) {
        showError(err.message || 'Gagal membuat pengumuman.');
      } finally {
        hideLoading();
      }
    });
  }
})();

// ============================================================
// JEMBATAN SIPANDU — pinjam sesi relawan milik Admin sendiri secara
// otomatis, supaya SIPANDU bisa dikerjakan tanpa login relawan terpisah.
// Tidak mengubah mekanisme SIPANDU/Relawan yang sudah ada sama sekali.
// ============================================================
(function () {
  const btn = document.getElementById('btnBukaSipandu');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!window.sppgAdminToken) { showError('Sesi Admin tidak ditemukan. Silakan login ulang.'); return; }
    try {
      showLoading('Menyiapkan akses SIPANDU...');
      const sesi = await apiGet('masukSebagaiRelawanUntukSipandu', { token: window.sppgAdminToken });
      hideLoading();

      // Simpan persis dengan pola sesi relawan biasa (kunci sama dengan
      // yang dipakai auth-relawan.js), supaya sipandu.html langsung mengenali.
      localStorage.setItem('sppgRelawanSession', JSON.stringify(sesi));

      window.open('sipandu.html', '_blank');
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });
})();
