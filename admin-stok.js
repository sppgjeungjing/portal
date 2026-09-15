// ============================================================
// SPPG JEUNGJING — MODUL STOK & PERSEDIAAN (Dashboard Admin)
// File BARU, terpisah dari admin.js supaya tidak mengubah logic
// yang sudah ada. Memakai window.sppgAdminToken (lihat hook kecil
// di admin.js) dan fungsi bersama dari common.js (apiGet/apiPost).
// ============================================================

(function () {
  'use strict';

  const el = {
    tabBtn: document.querySelector('.admin-tab-btn[data-panel="panelStok"]'),
    subtabs: document.querySelectorAll('.stok-subtab'),
    subs: document.querySelectorAll('.stok-sub'),

    stokTotalJenis: document.getElementById('stokTotalJenis'),
    stokAman: document.getElementById('stokAman'),
    stokMenipis: document.getElementById('stokMenipis'),
    stokHabis: document.getElementById('stokHabis'),
    stokPerluPerhatian: document.getElementById('stokPerluPerhatian'),

    stokCariBarang: document.getElementById('stokCariBarang'),
    stokFilterKategori: document.getElementById('stokFilterKategori'),
    stokFilterStatus: document.getElementById('stokFilterStatus'),
    btnCariBarang: document.getElementById('btnCariBarang'),
    btnBukaTambahBarang: document.getElementById('btnBukaTambahBarang'),
    tbodyStokBarang: document.getElementById('tbodyStokBarang'),

    masukSumber: document.getElementById('masukSumber'),
    masukDaftarItem: document.getElementById('masukDaftarItem'),
    btnTambahBarisMasuk: document.getElementById('btnTambahBarisMasuk'),
    masukKeterangan: document.getElementById('masukKeterangan'),
    btnSimpanMasuk: document.getElementById('btnSimpanMasuk'),

    keluarTujuan: document.getElementById('keluarTujuan'),
    keluarDaftarItem: document.getElementById('keluarDaftarItem'),
    btnTambahBarisKeluar: document.getElementById('btnTambahBarisKeluar'),
    keluarKeterangan: document.getElementById('keluarKeterangan'),
    btnSimpanKeluar: document.getElementById('btnSimpanKeluar'),

    riwayatFilterJenis: document.getElementById('riwayatFilterJenis'),
    btnMuatRiwayat: document.getElementById('btnMuatRiwayat'),
    tbodyStokRiwayat: document.getElementById('tbodyStokRiwayat'),

    formTambahKategori: document.getElementById('formTambahKategori'),
    inputKategoriBaru: document.getElementById('inputKategoriBaru'),
    inputKategoriKeterangan: document.getElementById('inputKategoriKeterangan'),
    tbodyStokKategori: document.getElementById('tbodyStokKategori'),

    formTambahSatuan: document.getElementById('formTambahSatuan'),
    inputSatuanBaru: document.getElementById('inputSatuanBaru'),
    tbodyStokSatuan: document.getElementById('tbodyStokSatuan'),

    selectRelawanAkses: document.getElementById('selectRelawanAkses'),
    btnTambahPetugas: document.getElementById('btnTambahPetugas'),
    tbodyPetugasStok: document.getElementById('tbodyPetugasStok'),

    modalBarang: document.getElementById('modalBarang'),
    modalBarangJudul: document.getElementById('modalBarangJudul'),
    formModalBarang: document.getElementById('formModalBarang'),
    modalBarangId: document.getElementById('modalBarangId'),
    modalBarangNama: document.getElementById('modalBarangNama'),
    modalBarangKategori: document.getElementById('modalBarangKategori'),
    modalBarangSubkategori: document.getElementById('modalBarangSubkategori'),
    modalBarangSatuan: document.getElementById('modalBarangSatuan'),
    modalBarangMinimum: document.getElementById('modalBarangMinimum'),
    modalBarangStokAwal: document.getElementById('modalBarangStokAwal'),
    modalBarangKeterangan: document.getElementById('modalBarangKeterangan'),
    btnBatalModalBarang: document.getElementById('btnBatalModalBarang'),

    modalDetailBarang: document.getElementById('modalDetailBarang'),
    detailBarangNama: document.getElementById('detailBarangNama'),
    detailBarangSub: document.getElementById('detailBarangSub'),
    detailBarangStok: document.getElementById('detailBarangStok'),
    detailBarangMinimum: document.getElementById('detailBarangMinimum'),
    detailBarangTotalMasuk: document.getElementById('detailBarangTotalMasuk'),
    detailBarangTotalKeluar: document.getElementById('detailBarangTotalKeluar'),
    detailBarangRiwayat: document.getElementById('detailBarangRiwayat'),
    btnTutupDetailBarang: document.getElementById('btnTutupDetailBarang')
  };

  if (!el.tabBtn) return; // panel Stok tidak ada di halaman ini -- aman keluar

  const cache = { kategori: [], satuan: [], barang: [], relawanSemua: [] };
  let sudahInit = false;

  function token() { return window.sppgAdminToken; }

  // --------------------------------------------------------
  // SUB-TAB
  // --------------------------------------------------------
  el.subtabs.forEach(btn => {
    btn.addEventListener('click', () => {
      el.subtabs.forEach(b => b.classList.remove('active'));
      el.subs.forEach(s => { s.style.display = 'none'; });
      btn.classList.add('active');
      const target = document.getElementById('stokSub' + kapital_(btn.dataset.sub));
      if (target) target.style.display = 'block';

      if (btn.dataset.sub === 'ringkasan') muatDashboard();
      else if (btn.dataset.sub === 'barang') muatDataBarang();
      else if (btn.dataset.sub === 'kategori') { muatKategoriAdmin(); muatSatuanAdmin(); }
      else if (btn.dataset.sub === 'akses') muatHakAkses();
      // 'masuk' & 'keluar': cukup pastikan minimal 1 baris item ada
      else if (btn.dataset.sub === 'masuk' && !el.masukDaftarItem.children.length) tambahBarisItem_(el.masukDaftarItem);
      else if (btn.dataset.sub === 'keluar' && !el.keluarDaftarItem.children.length) tambahBarisItem_(el.keluarDaftarItem);
    });
  });
  // set default tab aktif secara visual (sub HTML "ringkasan" sudah display:block bawaan)
  el.subtabs[0].classList.add('active');

  function kapital_(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // --------------------------------------------------------
  // INIT — dipanggil sekali begitu admin berhasil login
  // --------------------------------------------------------
  window.addEventListener('sppg-admin-ready', () => { if (!sudahInit) { sudahInit = true; initStok(); } });
  // Jaga-jaga kalau event sudah lewat sebelum listener terpasang (race kecil)
  if (window.sppgAdminToken && !sudahInit) { sudahInit = true; initStok(); }

  async function initStok() {
    try {
      await Promise.all([muatKategoriUntukDropdown(), muatSatuanUntukDropdown()]);
      await muatDashboard();
    } catch (err) {
      // Diam-diam saja di init awal -- pesan error akan tetap muncul saat user benar-benar buka tab Stok.
    }
    // Staff: lihat-lihat saja di modul Stok, tidak bisa mencatat transaksi
    // (ditegakkan juga di backend -- ini cuma supaya tombolnya tidak jadi
    // jalan buntu kalau diklik).
    if (window.sppgAdminRole === 'STAFF') {
      [el.btnSimpanMasuk, el.btnSimpanKeluar].forEach(btn => {
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = 'Khusus Admin/Petugas Stok';
        btn.title = 'Akun Staff hanya bisa melihat data Stok, tidak bisa mencatat transaksi.';
      });
    }
  }

  // --------------------------------------------------------
  // DASHBOARD
  // --------------------------------------------------------
  async function muatDashboard() {
    try {
      const d = await apiGet('getStokDashboard', { token: token() });
      el.stokTotalJenis.textContent = d.totalJenisBarang;
      el.stokAman.textContent = d.stokAman;
      el.stokMenipis.textContent = d.stokMenipis;
      el.stokHabis.textContent = d.stokHabis;

      if (!d.perluPerhatian.length) {
        el.stokPerluPerhatian.innerHTML = '<div class="empty-state">Semua stok dalam kondisi aman. 🎉</div>';
        return;
      }
      el.stokPerluPerhatian.innerHTML = d.perluPerhatian.map(b => `
        <div class="stok-perhatian-row">
          <div><p>${escapeHtml(b.nama)}</p><small>Stok: ${b.stok} ${escapeHtml(b.satuan)} · Minimum: ${b.minimum} ${escapeHtml(b.satuan)}</small></div>
          <span class="stok-badge stok-badge-${b.status.toLowerCase()}">${b.status === 'HABIS' ? '🔴 Habis' : '🟡 Menipis'}</span>
        </div>`).join('');
    } catch (err) {
      showError(err.message);
    }
  }

  // --------------------------------------------------------
  // KATEGORI + SATUAN (dropdown ringan, dipakai form Tambah/Edit Barang & filter)
  // --------------------------------------------------------
  async function muatKategoriUntukDropdown() {
    cache.kategori = await apiGet('getKategoriBarang', { token: token() });
    const opsi = cache.kategori.map(k => `<option value="${escapeHtml(k.id)}">${escapeHtml(k.nama)}</option>`).join('');
    el.stokFilterKategori.innerHTML = '<option value="">Semua Kategori</option>' + opsi;
    el.modalBarangKategori.innerHTML = '<option value="">Pilih Kategori</option>' + opsi;
  }

  async function muatSatuanUntukDropdown() {
    cache.satuan = await apiGet('getSatuanList', { token: token() });
    el.modalBarangSatuan.innerHTML = '<option value="">Pilih Satuan</option>' +
      cache.satuan.map(s => `<option value="${escapeHtml(s.nama)}">${escapeHtml(s.nama)}</option>`).join('');
  }

  // --------------------------------------------------------
  // KATEGORI (kelola, Admin)
  // --------------------------------------------------------
  async function muatKategoriAdmin() {
    el.tbodyStokKategori.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const list = await apiGet('getKategoriBarangAdmin', { token: token() });
      if (!list.length) { el.tbodyStokKategori.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada kategori.</div></td></tr>'; return; }
      el.tbodyStokKategori.innerHTML = list.map(k => `
        <tr>
          <td>${escapeHtml(k.nama)}</td>
          <td>${escapeHtml(k.keterangan || '-')}</td>
          <td>${k.aktif ? '<span class="stok-badge stok-badge-aman">Aktif</span>' : '<span class="stok-badge stok-badge-habis">Nonaktif</span>'}</td>
          <td><button type="button" class="btn-mini" data-toggle-kategori="${escapeHtml(k.id)}" data-aktif="${k.aktif ? '0' : '1'}">${k.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
        </tr>`).join('');
      el.tbodyStokKategori.querySelectorAll('[data-toggle-kategori]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('updateStatusKategoriAktif', { token: token(), id: btn.dataset.toggleKategori, aktif: btn.dataset.aktif === '1' });
            showSuccess('Status kategori diperbarui.');
            await Promise.all([muatKategoriAdmin(), muatKategoriUntukDropdown()]);
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.formTambahKategori.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('addKategoriStok', { token: token(), nama: el.inputKategoriBaru.value.trim(), keterangan: el.inputKategoriKeterangan.value.trim() });
      el.inputKategoriBaru.value = '';
      el.inputKategoriKeterangan.value = '';
      showSuccess('Kategori ditambahkan.');
      await Promise.all([muatKategoriAdmin(), muatKategoriUntukDropdown()]);
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // SATUAN (kelola, Admin) — master terkontrol
  // --------------------------------------------------------
  async function muatSatuanAdmin() {
    el.tbodyStokSatuan.innerHTML = '<tr><td colspan="3"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const list = await apiGet('getSatuanListAdmin', { token: token() });
      if (!list.length) { el.tbodyStokSatuan.innerHTML = '<tr><td colspan="3"><div class="empty-state">Belum ada satuan.</div></td></tr>'; return; }
      el.tbodyStokSatuan.innerHTML = list.map(s => `
        <tr>
          <td>${escapeHtml(s.nama)}</td>
          <td>${s.aktif ? '<span class="stok-badge stok-badge-aman">Aktif</span>' : '<span class="stok-badge stok-badge-habis">Nonaktif</span>'}</td>
          <td><button type="button" class="btn-mini" data-toggle-satuan="${escapeHtml(s.id)}" data-aktif="${s.aktif ? '0' : '1'}">${s.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button></td>
        </tr>`).join('');
      el.tbodyStokSatuan.querySelectorAll('[data-toggle-satuan]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('updateStatusSatuanAktif', { token: token(), id: btn.dataset.toggleSatuan, aktif: btn.dataset.aktif === '1' });
            showSuccess('Status satuan diperbarui.');
            await Promise.all([muatSatuanAdmin(), muatSatuanUntukDropdown()]);
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.formTambahSatuan.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('addSatuan', { token: token(), nama: el.inputSatuanBaru.value.trim() });
      el.inputSatuanBaru.value = '';
      showSuccess('Satuan ditambahkan.');
      await Promise.all([muatSatuanAdmin(), muatSatuanUntukDropdown()]);
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // DATA BARANG
  // --------------------------------------------------------
  async function muatDataBarang() {
    el.tbodyStokBarang.innerHTML = '<tr><td colspan="7"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      cache.barang = await apiGet('getDataBarangList', {
        token: token(),
        kategori: el.stokFilterKategori.value,
        status: el.stokFilterStatus.value,
        cari: el.stokCariBarang.value.trim()
      });
      if (!cache.barang.length) { el.tbodyStokBarang.innerHTML = '<tr><td colspan="7"><div class="empty-state">Belum ada barang. Tambahkan lewat tombol "+ Tambah Barang".</div></td></tr>'; return; }

      el.tbodyStokBarang.innerHTML = cache.barang.map(b => `
        <tr>
          <td>${escapeHtml(b.kode)}</td>
          <td>${escapeHtml(b.nama)}</td>
          <td>${escapeHtml(b.namaKategori)}${b.subkategori ? ' <span style="color:var(--color-text-muted);font-size:11.5px;">· ' + escapeHtml(b.subkategori) + '</span>' : ''}</td>
          <td>${b.stok} ${escapeHtml(b.satuan)}</td>
          <td>${b.stokMinimum} ${escapeHtml(b.satuan)}</td>
          <td><span class="stok-badge stok-badge-${b.status.toLowerCase()}">${b.status === 'AMAN' ? '🟢' : b.status === 'MENIPIS' ? '🟡' : '🔴'} ${b.status}</span></td>
          <td style="display:flex;gap:6px;">
            <button type="button" class="btn-mini" data-detail-barang="${escapeHtml(b.id)}">Detail</button>
            <button type="button" class="btn-mini" data-edit-barang="${escapeHtml(b.id)}">Edit</button>
          </td>
        </tr>`).join('');

      el.tbodyStokBarang.querySelectorAll('[data-detail-barang]').forEach(btn => {
        btn.addEventListener('click', () => bukaDetailBarang(btn.dataset.detailBarang));
      });
      el.tbodyStokBarang.querySelectorAll('[data-edit-barang]').forEach(btn => {
        btn.addEventListener('click', () => bukaModalBarang(cache.barang.find(x => x.id === btn.dataset.editBarang)));
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.btnCariBarang.addEventListener('click', muatDataBarang);
  el.stokCariBarang.addEventListener('keydown', (e) => { if (e.key === 'Enter') muatDataBarang(); });

  // --------------------------------------------------------
  // MODAL TAMBAH / EDIT BARANG
  // --------------------------------------------------------
  function bukaModalBarang(barang) {
    el.formModalBarang.reset();
    if (barang) {
      el.modalBarangJudul.textContent = 'Edit Barang';
      el.modalBarangId.value = barang.id;
      el.modalBarangNama.value = barang.nama;
      el.modalBarangKategori.value = barang.idKategori;
      el.modalBarangSubkategori.value = barang.subkategori || '';
      el.modalBarangSatuan.value = barang.satuan;
      el.modalBarangMinimum.value = barang.stokMinimum;
      el.modalBarangStokAwal.style.display = 'none'; // stok tidak diedit langsung di sini -- hanya lewat transaksi
    } else {
      el.modalBarangJudul.textContent = 'Tambah Barang';
      el.modalBarangId.value = '';
      el.modalBarangStokAwal.style.display = 'block';
    }
    el.modalBarang.classList.remove('is-hidden');
  }
  el.btnBukaTambahBarang.addEventListener('click', () => bukaModalBarang(null));
  el.btnBatalModalBarang.addEventListener('click', () => el.modalBarang.classList.add('is-hidden'));
  el.modalBarang.addEventListener('click', (e) => { if (e.target === el.modalBarang) el.modalBarang.classList.add('is-hidden'); });

  el.formModalBarang.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = !!el.modalBarangId.value;
    const payload = {
      token: token(),
      id: el.modalBarangId.value,
      nama: el.modalBarangNama.value.trim(),
      idKategori: el.modalBarangKategori.value,
      subkategori: el.modalBarangSubkategori.value.trim(),
      satuan: el.modalBarangSatuan.value,
      stokMinimum: Number(el.modalBarangMinimum.value),
      stokAwal: Number(el.modalBarangStokAwal.value || 0),
      keterangan: el.modalBarangKeterangan.value.trim()
    };
    try {
      await apiPost(isEdit ? 'updateBarang' : 'addBarang', payload);
      showSuccess(isEdit ? 'Barang diperbarui.' : 'Barang baru ditambahkan.');
      el.modalBarang.classList.add('is-hidden');
      await muatDataBarang();
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // MODAL DETAIL BARANG
  // --------------------------------------------------------
  async function bukaDetailBarang(idBarang) {
    el.modalDetailBarang.classList.remove('is-hidden');
    el.detailBarangRiwayat.innerHTML = '<div class="empty-state">Memuat data...</div>';
    try {
      const d = await apiGet('getDetailBarang', { token: token(), idBarang });
      el.detailBarangNama.textContent = d.nama;
      el.detailBarangSub.textContent = d.kode + ' · ' + d.namaKategori + (d.subkategori ? ' · ' + d.subkategori : '');
      el.detailBarangStok.textContent = d.stok + ' ' + d.satuan;
      el.detailBarangMinimum.textContent = d.stokMinimum + ' ' + d.satuan;
      el.detailBarangTotalMasuk.textContent = d.totalMasuk + ' ' + d.satuan;
      el.detailBarangTotalKeluar.textContent = d.totalKeluar + ' ' + d.satuan;

      if (!d.riwayat.length) { el.detailBarangRiwayat.innerHTML = '<div class="empty-state">Belum ada pergerakan stok.</div>'; return; }
      el.detailBarangRiwayat.innerHTML = d.riwayat.map(r => `
        <div class="stok-perhatian-row">
          <div><p>${r.jenis === 'MASUK' ? '📥' : '📤'} ${r.jumlah} ${escapeHtml(d.satuan)} · ${escapeHtml(r.nomorTransaksi)}</p>
          <small>${escapeHtml(r.tanggal)} · Petugas: ${escapeHtml(r.petugas)} · Stok ${r.stokSebelum} → ${r.stokSesudah}</small></div>
        </div>`).join('');
    } catch (err) {
      el.detailBarangRiwayat.innerHTML = '';
      showError(err.message);
    }
  }
  el.btnTutupDetailBarang.addEventListener('click', () => el.modalDetailBarang.classList.add('is-hidden'));
  el.modalDetailBarang.addEventListener('click', (e) => { if (e.target === el.modalDetailBarang) el.modalDetailBarang.classList.add('is-hidden'); });

  // --------------------------------------------------------
  // BARANG MASUK / KELUAR — baris item dinamis (multi-item)
  // --------------------------------------------------------
  function opsiBarang_(daftar) {
    const sumber = daftar || cache.barang;
    const opsi = sumber.map(b => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.nama)} (stok: ${b.stok} ${escapeHtml(b.satuan)})</option>`).join('');
    return '<option value="">Pilih barang...</option>' + opsi;
  }

  async function pastikanBarangTermuat_() {
    if (!cache.barang.length) {
      try { cache.barang = await apiGet('getDataBarangList', { token: token() }); } catch (err) { showError(err.message); }
    }
  }

  function tambahBarisItem_(container) {
    const baris = document.createElement('div');
    baris.className = 'stok-item-row';
    baris.innerHTML = `
      <input type="text" class="stok-item-cari" placeholder="🔍 Cari ID/nama barang..." autocomplete="off">
      <select class="stok-item-barang">${opsiBarang_()}</select>
      <input type="number" class="stok-item-jumlah" placeholder="Jumlah" min="0.01" step="0.01">
      <button type="button" title="Hapus baris">🗑</button>`;
    baris.querySelector('button').addEventListener('click', () => baris.remove());

    const inputCari = baris.querySelector('.stok-item-cari');
    const select = baris.querySelector('.stok-item-barang');
    inputCari.addEventListener('input', () => {
      const kata = inputCari.value.trim().toLowerCase();
      const nilaiTerpilihSebelumnya = select.value;
      const hasil = !kata ? cache.barang : cache.barang.filter(b =>
        String(b.id).toLowerCase().includes(kata) ||
        String(b.nama).toLowerCase().includes(kata) ||
        String(b.kode || '').toLowerCase().includes(kata)
      );
      select.innerHTML = opsiBarang_(hasil);
      // Kalau barang yang sebelumnya dipilih masih ada di hasil filter, pertahankan pilihannya.
      if (hasil.some(b => b.id === nilaiTerpilihSebelumnya)) select.value = nilaiTerpilihSebelumnya;
    });

    container.appendChild(baris);
  }

  el.btnTambahBarisMasuk.addEventListener('click', async () => { await pastikanBarangTermuat_(); tambahBarisItem_(el.masukDaftarItem); });
  el.btnTambahBarisKeluar.addEventListener('click', async () => { await pastikanBarangTermuat_(); tambahBarisItem_(el.keluarDaftarItem); });

  function ambilItemDariContainer_(container) {
    return Array.from(container.querySelectorAll('.stok-item-row')).map(baris => ({
      idBarang: baris.querySelector('.stok-item-barang').value,
      jumlah: Number(baris.querySelector('.stok-item-jumlah').value)
    })).filter(it => it.idBarang && it.jumlah > 0);
  }

  el.btnSimpanMasuk.addEventListener('click', async () => {
    const items = ambilItemDariContainer_(el.masukDaftarItem);
    if (!items.length) { showError('Isi minimal 1 barang dengan jumlah yang valid.'); return; }
    try {
      showLoading('Menyimpan transaksi barang masuk...');
      const hasil = await apiPost('simpanBarangMasuk', { token: token(), sumberTujuan: el.masukSumber.value.trim(), keterangan: el.masukKeterangan.value.trim(), items });
      hideLoading();
      showSuccess('Barang masuk tersimpan (' + hasil.nomorTransaksi + ').');
      el.masukDaftarItem.innerHTML = ''; el.masukSumber.value = ''; el.masukKeterangan.value = '';
      tambahBarisItem_(el.masukDaftarItem);
      cache.barang = []; // paksa muat ulang biar stok di dropdown ter-update
      await muatDashboard();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  el.btnSimpanKeluar.addEventListener('click', async () => {
    const items = ambilItemDariContainer_(el.keluarDaftarItem);
    if (!items.length) { showError('Isi minimal 1 barang dengan jumlah yang valid.'); return; }
    try {
      showLoading('Menyimpan transaksi barang keluar...');
      const hasil = await apiPost('simpanBarangKeluar', { token: token(), sumberTujuan: el.keluarTujuan.value.trim(), keterangan: el.keluarKeterangan.value.trim(), items });
      hideLoading();
      showSuccess('Barang keluar tersimpan (' + hasil.nomorTransaksi + ').');
      el.keluarDaftarItem.innerHTML = ''; el.keluarTujuan.value = ''; el.keluarKeterangan.value = '';
      tambahBarisItem_(el.keluarDaftarItem);
      cache.barang = [];
      await muatDashboard();
    } catch (err) {
      hideLoading();
      // Pesan "Stok tidak mencukupi" dari backend akan tampil apa adanya di sini.
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // RIWAYAT
  // --------------------------------------------------------
  el.btnMuatRiwayat.addEventListener('click', async () => {
    el.tbodyStokRiwayat.innerHTML = '<tr><td colspan="7"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const list = await apiGet('getRiwayatStokList', { token: token(), jenis: el.riwayatFilterJenis.value });
      if (!list.length) { el.tbodyStokRiwayat.innerHTML = '<tr><td colspan="7"><div class="empty-state">Belum ada transaksi.</div></td></tr>'; return; }
      el.tbodyStokRiwayat.innerHTML = list.map(r => `
        <tr>
          <td>${escapeHtml(r.tanggal)}</td>
          <td>${escapeHtml(r.nomorTransaksi)}</td>
          <td>${r.jenis === 'MASUK' ? '📥 Masuk' : '📤 Keluar'}</td>
          <td>${escapeHtml(r.namaBarang)}</td>
          <td>${r.jumlah} ${escapeHtml(r.satuan)}</td>
          <td>${escapeHtml(r.petugas)}</td>
          <td>${escapeHtml(r.keterangan || '-')}</td>
        </tr>`).join('');
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // HAK AKSES (Petugas Stok)
  // --------------------------------------------------------
  async function muatHakAkses() {
    el.tbodyPetugasStok.innerHTML = '<tr><td colspan="3"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      if (!cache.relawanSemua.length) cache.relawanSemua = await apiGet('getRelawan', { semua: 1 });
      el.selectRelawanAkses.innerHTML = '<option value="">Pilih relawan...</option>' +
        cache.relawanSemua.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');

      const list = await apiGet('getDaftarPetugasStok', { token: token() });
      if (!list.length) { el.tbodyPetugasStok.innerHTML = '<tr><td colspan="3"><div class="empty-state">Belum ada Petugas Stok.</div></td></tr>'; return; }
      el.tbodyPetugasStok.innerHTML = list.map(p => `
        <tr>
          <td>${escapeHtml(p.nama)}</td>
          <td>${escapeHtml(p.username)}</td>
          <td><button type="button" class="btn-mini" data-cabut-petugas="${escapeHtml(p.idRelawan)}">Cabut Akses</button></td>
        </tr>`).join('');
      el.tbodyPetugasStok.querySelectorAll('[data-cabut-petugas]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('setRoleStok', { token: token(), idRelawan: btn.dataset.cabutPetugas, jadikanPetugas: false });
            showSuccess('Akses Petugas Stok dicabut.');
            await muatHakAkses();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.btnTambahPetugas.addEventListener('click', async () => {
    const idRelawan = el.selectRelawanAkses.value;
    if (!idRelawan) { showError('Pilih relawan terlebih dahulu.'); return; }
    try {
      await apiPost('setRoleStok', { token: token(), idRelawan, jadikanPetugas: true });
      showSuccess('Relawan dijadikan Petugas Stok.');
      await muatHakAkses();
    } catch (err) {
      showError(err.message);
    }
  });
})();
