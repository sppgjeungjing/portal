// ============================================================
// admin-website-publik.js — Kelola konten Website Publik (BARU)
// File mandiri, terhubung LANGSUNG ke Website Publik lewat backend
// yang sama (setKontenPublik -> disimpan -> getKontenPublik dibaca
// Website Publik) -- bukan cuma form kosong tanpa efek.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }
  let sudahDimuat = false;

  async function muatDaftar_() {
    const wadah = document.getElementById('wpuDaftarHalaman');
    wadah.innerHTML = 'Memuat...';
    try {
      const daftar = await apiGet('getSemuaKontenPublikAdmin', { token: token() });
      wadah.innerHTML = daftar.map(h => `
        <details class="panel-block" style="margin-bottom:12px;">
          <summary style="cursor:pointer;font-weight:700;color:var(--color-navy);font-size:14px;">${escapeHtml(h.label)} <span style="font-weight:400;font-size:12px;color:var(--color-text-muted);">(${escapeHtml(h.file)})</span></summary>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px;">
            ${h.field.map(f => `
              <label style="font-size:12.5px;font-weight:600;color:var(--color-text-muted);">
                ${escapeHtml(f.label)} ${!f.isi ? '<span style="color:#b9852f;font-weight:700;">(belum diisi)</span>' : ''}
                <textarea data-halaman="${escapeHtml(h.halaman)}" data-kunci="${escapeHtml(f.kunci)}" rows="2" style="display:block;width:100%;margin-top:4px;font-family:inherit;padding:8px 10px;border-radius:8px;border:1.5px solid var(--color-border);" placeholder="Belum diisi -- teks asli di halaman akan tetap tampil sampai ini diisi">${escapeHtml(f.isi)}</textarea>
              </label>
            `).join('')}
            <button type="button" class="btn-mini primary" data-simpan-halaman="${escapeHtml(h.halaman)}" style="align-self:flex-start;">Simpan ${escapeHtml(h.label)}</button>
          </div>
        </details>
      `).join('');

      wadah.querySelectorAll('[data-simpan-halaman]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const halaman = btn.dataset.simpanHalaman;
          const textareas = wadah.querySelectorAll(`textarea[data-halaman="${halaman}"]`);
          btn.disabled = true;
          try {
            // Simpan SEMUA field halaman ini satu per satu (masing-masing
            // baris independen di sheet, jadi aman diulang / sebagian gagal
            // tidak merusak yang lain).
            for (const ta of textareas) {
              await apiPost('setKontenPublik', { token: token(), halaman: ta.dataset.halaman, kunci: ta.dataset.kunci, isi: ta.value });
            }
            showSuccess('Konten "' + halaman + '" tersimpan dan langsung dipakai Website Publik.');
            muatDaftar_();
          } catch (err) {
            showError(err.message);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      wadah.innerHTML = `<div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div>`;
    }
  }

  async function muatDataPenerimaan_() {
    const tbody = document.getElementById('tbodyDataPenerimaan');
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const daftar = await apiGet('getDataPenerimaanAdmin', { token: token() });
      if (!daftar.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada data.</div></td></tr>';
        return;
      }
      tbody.innerHTML = daftar.map(d => `
        <tr>
          <td><input type="text" value="${escapeHtml(d.kategori)}" data-field="kategori" data-id="${escapeHtml(d.id)}" style="width:120px;"></td>
          <td><input type="number" value="${d.jumlah}" data-field="jumlah" data-id="${escapeHtml(d.id)}" style="width:80px;"></td>
          <td>${d.aktif ? '<span style="color:#1a7a4c;font-weight:700;">Aktif</span>' : '<span style="color:#b23a3a;">Nonaktif</span>'}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-mini primary" data-simpan-dp="${escapeHtml(d.id)}">Simpan</button>
            <button type="button" class="btn-mini" data-toggle-dp="${escapeHtml(d.id)}" data-aktif="${d.aktif ? '0' : '1'}">${d.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button type="button" class="btn-mini" data-hapus-dp="${escapeHtml(d.id)}" style="color:#b23a3a;">Hapus</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-simpan-dp]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.simpanDp;
          const kategori = tbody.querySelector(`[data-field="kategori"][data-id="${id}"]`).value;
          const jumlah = tbody.querySelector(`[data-field="jumlah"][data-id="${id}"]`).value;
          try {
            await apiPost('updateDataPenerimaan', { token: token(), id, kategori, jumlah });
            showSuccess('Data Penerimaan tersimpan.');
          } catch (err) { showError(err.message); }
        });
      });
      tbody.querySelectorAll('[data-toggle-dp]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('toggleAktifDataPenerimaan', { token: token(), id: btn.dataset.toggleDp, aktif: btn.dataset.aktif === '1' });
            muatDataPenerimaan_();
          } catch (err) { showError(err.message); }
        });
      });
      tbody.querySelectorAll('[data-hapus-dp]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Hapus kategori ini?')) return;
          try {
            await apiPost('deleteDataPenerimaan', { token: token(), id: btn.dataset.hapusDp });
            muatDataPenerimaan_();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  async function muatMenuWebsite_() {
    const tbody = document.getElementById('tbodyMenuWebsite');
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const daftar = await apiGet('getMenuWebsiteAdmin', { token: token() });
      tbody.innerHTML = daftar.map(m => `
        <tr>
          <td><input type="text" value="${escapeHtml(m.label)}" data-field="label" data-id="${escapeHtml(m.id)}" style="width:140px;"></td>
          <td><input type="number" value="${m.urutan}" data-field="urutan" data-id="${escapeHtml(m.id)}" style="width:60px;"></td>
          <td>${m.aktif ? '<span style="color:#1a7a4c;font-weight:700;">Aktif</span>' : '<span style="color:#b23a3a;">Nonaktif</span>'}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-mini primary" data-simpan-menu="${escapeHtml(m.id)}">Simpan</button>
            <button type="button" class="btn-mini" data-toggle-menu="${escapeHtml(m.id)}" data-aktif="${m.aktif ? '0' : '1'}">${m.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-simpan-menu]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.simpanMenu;
          const label = tbody.querySelector(`[data-field="label"][data-id="${id}"]`).value;
          const urutan = tbody.querySelector(`[data-field="urutan"][data-id="${id}"]`).value;
          try {
            await apiPost('updateMenuWebsite', { token: token(), id, label, urutan });
            showSuccess('Menu tersimpan.');
          } catch (err) { showError(err.message); }
        });
      });
      tbody.querySelectorAll('[data-toggle-menu]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('updateMenuWebsite', { token: token(), id: btn.dataset.toggleMenu, aktif: btn.dataset.aktif === '1' });
            muatMenuWebsite_();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  const KATEGORI_MENU = [
    { key: 'kecil', label: 'Porsi Kecil' },
    { key: 'besar', label: 'Porsi Besar' },
    { key: 'balita', label: 'Balita' },
    { key: 'bumil', label: 'Ibu Hamil' },
    { key: 'busui', label: 'Ibu Menyusui' }
  ];
  const GIZI_MENU = [
    { key: 'kkal', label: 'Kkal' },
    { key: 'protein', label: 'g Protein' },
    { key: 'lemak', label: 'g Lemak' },
    { key: 'karbo', label: 'g Karbo' },
    { key: 'serat', label: 'g Serat' }
  ];

  /** Render 5 baris (per kategori) x 5 kolom (per zat gizi) input teks -- dibuat sekali oleh JS, bukan ditulis tangan di HTML, supaya konsisten & gampang dirawat. */
  function renderFormGiziMenuHarian_() {
    const wadah = document.getElementById('wadahGiziMenuHarian');
    if (!wadah || wadah.dataset.dirender) return; // cuma render sekali
    wadah.dataset.dirender = '1';
    wadah.innerHTML = KATEGORI_MENU.map(kat => `
      <div>
        <p style="font-size:12px;font-weight:700;color:var(--color-navy);margin:0 0 4px;">${kat.label}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${GIZI_MENU.map(g => `<input type="text" id="gizi_${kat.key}_${g.key}" placeholder="${g.label}" style="width:100px;" title="${kat.label} — ${g.label}">`).join('')}
        </div>
      </div>
    `).join('');
  }

  function ambilNilaiGizi_(kat) {
    const hasil = {};
    GIZI_MENU.forEach(g => {
      const el = document.getElementById('gizi_' + kat + '_' + g.key);
      hasil[g.key] = el ? el.value.trim() : '';
    });
    return hasil;
  }

  function isiNilaiGizi_(kat, nilai) {
    GIZI_MENU.forEach(g => {
      const el = document.getElementById('gizi_' + kat + '_' + g.key);
      if (el) el.value = (nilai && nilai[g.key]) || '';
    });
  }

  /**
   * Membaca teks format WhatsApp yang biasa dikirim, mis.:
   *   "📋 Data Menu Hari  Senin 07/09/26"
   *   "Menu: NASI + RENDANG SAPI + ..."
   *   "Komposisi: Nasi + lauk hewani + ..."
   *   "- Porsi kecil: 525,85 kkal | 20,09 g protein | 23,63 g lemak | 57,425 g karbo | 0,9 g serat"
   * Cukup toleran: spasi sebelum satuan boleh ada/tidak ada ("729,25kkal" atau
   * "525,85 kkal" sama-sama kebaca), urutan baris bebas, baris yang tidak
   * dikenali diabaikan (tidak menyebabkan error).
   */
  function baca_TeksMenuHarian_(teks) {
    const hasil = { tanggal: '', hari: '', menu: '', komposisi: '', gizi: {} };
    const baris = String(teks || '').split('\n').map(b => b.trim()).filter(Boolean);
    let adaGiziTerbaca = false;

    baris.forEach(b => {
      let m;
      if ((m = b.match(/Data Menu Hari\s+([A-Za-z]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i))) {
        hasil.hari = m[1];
        hasil.tanggal = m[2];
        return;
      }
      if (/^menu\s*:/i.test(b)) { hasil.menu = b.replace(/^menu\s*:/i, '').trim(); return; }
      if (/^komposisi\s*:/i.test(b)) { hasil.komposisi = b.replace(/^komposisi\s*:/i, '').trim(); return; }

      const mKat = b.match(/^-?\s*(Porsi\s+kecil|Porsi\s+besar|Balita|Ibu\s+hamil|Ibu\s+menyusui)\s*:\s*(.*)$/i);
      if (mKat) {
        const namaKat = mKat[1].toLowerCase().replace(/\s+/g, ' ');
        const kunciKat = namaKat.indexOf('kecil') !== -1 ? 'kecil'
          : namaKat.indexOf('besar') !== -1 ? 'besar'
          : namaKat.indexOf('balita') !== -1 ? 'balita'
          : namaKat.indexOf('hamil') !== -1 ? 'bumil'
          : namaKat.indexOf('menyusui') !== -1 ? 'busui' : null;
        if (!kunciKat) return;
        const bagian = mKat[2].split('|').map(s => s.trim());
        const urutanGizi = ['kkal', 'protein', 'lemak', 'karbo', 'serat'];
        const nilai = {};
        bagian.forEach((s, i) => {
          const mAngka = s.match(/^([\d.,]+)/);
          if (mAngka && urutanGizi[i]) { nilai[urutanGizi[i]] = mAngka[1]; adaGiziTerbaca = true; }
        });
        hasil.gizi[kunciKat] = nilai;
      }
    });

    return { hasil, berhasil: !!(hasil.tanggal || hasil.menu || adaGiziTerbaca) };
  }

  function pasangBacaOtomatisMenuHarian_() {
    const btn = document.getElementById('btnBacaMenuHarian');
    const ta = document.getElementById('taTempelMenuHarian');
    const status = document.getElementById('statusBacaMenuHarian');
    if (!btn || !ta) return;
    btn.addEventListener('click', () => {
      renderFormGiziMenuHarian_();
      const { hasil, berhasil } = baca_TeksMenuHarian_(ta.value);
      if (!berhasil) {
        status.textContent = '⚠️ Tidak ada yang bisa dibaca dari teks ini. Isi manual saja di bawah.';
        status.style.color = '#b9852f';
        return;
      }
      document.getElementById('mhTanggal').value = hasil.tanggal;
      document.getElementById('mhHari').value = hasil.hari;
      document.getElementById('mhMenu').value = hasil.menu;
      document.getElementById('mhKomposisi').value = hasil.komposisi;
      KATEGORI_MENU.forEach(kat => isiNilaiGizi_(kat.key, hasil.gizi[kat.key]));
      status.textContent = '✅ Berhasil dibaca. Cek dulu isinya di bawah sebelum Simpan.';
      status.style.color = '#1a7a4c';
    });
  }

  function kosongkanFormMenuHarian_() {
    document.getElementById('mhEditId').value = '';
    document.getElementById('mhTanggal').value = '';
    document.getElementById('mhHari').value = '';
    document.getElementById('mhMenu').value = '';
    document.getElementById('mhKomposisi').value = '';
    KATEGORI_MENU.forEach(kat => isiNilaiGizi_(kat.key, {}));
    document.getElementById('taTempelMenuHarian').value = '';
    document.getElementById('statusBacaMenuHarian').textContent = '';
    document.getElementById('btnSimpanMenuHarian').textContent = 'Simpan Menu Hari Ini';
    document.getElementById('btnBatalEditMenuHarian').style.display = 'none';
  }

  function pasangSimpanMenuHarian_() {
    const btn = document.getElementById('btnSimpanMenuHarian');
    const btnBatal = document.getElementById('btnBatalEditMenuHarian');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const tanggal = document.getElementById('mhTanggal').value.trim();
      if (!tanggal) { showError('Tanggal wajib diisi (format DD/MM/YY).'); return; }
      const payload = {
        token: token(),
        tanggal: tanggal,
        hari: document.getElementById('mhHari').value.trim(),
        menu: document.getElementById('mhMenu').value.trim(),
        komposisi: document.getElementById('mhKomposisi').value.trim(),
        gizi: {}
      };
      KATEGORI_MENU.forEach(kat => { payload.gizi[kat.key] = ambilNilaiGizi_(kat.key); });

      const editId = document.getElementById('mhEditId').value;
      btn.disabled = true;
      try {
        if (editId) {
          payload.id = editId;
          await apiPost('updateMenuHarianPublik', payload);
          showSuccess('Menu Hari Ini diperbarui.');
        } else {
          await apiPost('simpanMenuHarianPublik', payload);
          showSuccess('Menu Hari Ini tersimpan dan langsung tampil di Website Publik.');
        }
        kosongkanFormMenuHarian_();
        muatDaftarMenuHarian_();
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false;
      }
    });
    if (btnBatal) btnBatal.addEventListener('click', kosongkanFormMenuHarian_);
  }

  async function muatDaftarMenuHarian_() {
    renderFormGiziMenuHarian_();
    const tbody = document.getElementById('tbodyMenuHarian');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const daftar = await apiGet('getMenuHarianListAdmin', { token: token() });
      if (!daftar.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada menu tersimpan.</div></td></tr>';
        return;
      }
      tbody.innerHTML = daftar.map(m => `
        <tr>
          <td style="white-space:nowrap;">${escapeHtml(m.hari || '')} ${escapeHtml(m.tanggal || '')}</td>
          <td>${escapeHtml(m.menu || '')}</td>
          <td>${m.aktif ? '<span style="color:#1a7a4c;font-weight:700;">Aktif</span>' : '<span style="color:#b23a3a;">Nonaktif</span>'}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-mini" data-edit-mh="${escapeHtml(m.id)}">Edit</button>
            <button type="button" class="btn-mini" data-toggle-mh="${escapeHtml(m.id)}" data-aktif="${m.aktif ? '0' : '1'}">${m.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
            <button type="button" class="btn-mini" data-hapus-mh="${escapeHtml(m.id)}" style="color:#b23a3a;">Hapus</button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-edit-mh]').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = daftar.find(x => x.id === btn.dataset.editMh);
          if (!m) return;
          document.getElementById('mhEditId').value = m.id;
          document.getElementById('mhTanggal').value = m.tanggal || '';
          document.getElementById('mhHari').value = m.hari || '';
          document.getElementById('mhMenu').value = m.menu || '';
          document.getElementById('mhKomposisi').value = m.komposisi || '';
          KATEGORI_MENU.forEach(kat => isiNilaiGizi_(kat.key, m.gizi && m.gizi[kat.key]));
          document.getElementById('btnSimpanMenuHarian').textContent = 'Simpan Perubahan';
          document.getElementById('btnBatalEditMenuHarian').style.display = 'inline-block';
          document.getElementById('mhTanggal').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      tbody.querySelectorAll('[data-toggle-mh]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('toggleAktifMenuHarianPublik', { token: token(), id: btn.dataset.toggleMh, aktif: btn.dataset.aktif === '1' });
            muatDaftarMenuHarian_();
          } catch (err) { showError(err.message); }
        });
      });
      tbody.querySelectorAll('[data-hapus-mh]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Hapus menu ini?')) return;
          try {
            await apiPost('deleteMenuHarianPublik', { token: token(), id: btn.dataset.hapusMh });
            muatDaftarMenuHarian_();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  // FASE 2: panelWebsitePublik dikonfirmasi HTML statis -- disederhanakan jadi langsung sinkron.
  const btnTab = document.querySelector('[data-panel="panelWebsitePublik"]');
  if (btnTab) {
    btnTab.addEventListener('click', () => {
      if (sudahDimuat) return;
      sudahDimuat = true;
      muatDaftar_();
      muatDataPenerimaan_();
      muatPenerimaManfaat_();
      muatMenuWebsite_();
      renderFormGiziMenuHarian_();
      pasangBacaOtomatisMenuHarian_();
      pasangSimpanMenuHarian_();
      muatDaftarMenuHarian_();
    });
  }

  const btnTambahPenerimaan = document.getElementById('btnTambahDataPenerimaan');
  if (btnTambahPenerimaan) {
    btnTambahPenerimaan.addEventListener('click', async () => {
      const inputKategori = document.getElementById('inputKategoriPenerimaan');
      const inputJumlah = document.getElementById('inputJumlahPenerimaanBaru');
      if (!inputKategori.value.trim()) { showError('Nama kategori wajib diisi.'); return; }
      try {
        await apiPost('addDataPenerimaan', { token: token(), kategori: inputKategori.value.trim(), jumlah: inputJumlah.value || 0 });
        showSuccess('Kategori baru ditambahkan.');
        inputKategori.value = ''; inputJumlah.value = '';
        muatDataPenerimaan_();
      } catch (err) { showError(err.message); }
    });
  }

  // ==================================================================
  // BARU: Penerima Manfaat rinci per instansi (PK/PB / Bumil/Busui/Balita)
  // ==================================================================
  const pmEl = {
    btnBuka: document.getElementById('btnBukaFormPM'),
    form: document.getElementById('formPenerimaManfaat'),
    editId: document.getElementById('pmEditId'),
    kategori: document.getElementById('pmKategori'),
    instansi: document.getElementById('pmInstansi'),
    fieldPesertaDidik: document.getElementById('pmFieldPesertaDidik'),
    field3B: document.getElementById('pmField3B'),
    pk: document.getElementById('pmPk'), pb: document.getElementById('pmPb'),
    bumil: document.getElementById('pmBumil'), busui: document.getElementById('pmBusui'), balita: document.getElementById('pmBalita'),
    jumlahPreview: document.getElementById('pmJumlahPreview'),
    btnBatal: document.getElementById('btnBatalPM'),
    tbody: document.getElementById('tbodyPenerimaManfaat')
  };

  function tampilkanFieldSesuaiKategoriPM_() {
    const isPesertaDidik = pmEl.kategori.value === 'PESERTA_DIDIK';
    pmEl.fieldPesertaDidik.style.display = isPesertaDidik ? 'flex' : 'none';
    pmEl.field3B.style.display = isPesertaDidik ? 'none' : 'flex';
    hitungJumlahPreviewPM_();
  }

  function hitungJumlahPreviewPM_() {
    let jumlah;
    if (pmEl.kategori.value === 'PESERTA_DIDIK') {
      jumlah = (Number(pmEl.pk.value) || 0) + (Number(pmEl.pb.value) || 0);
    } else {
      jumlah = (Number(pmEl.bumil.value) || 0) + (Number(pmEl.busui.value) || 0) + (Number(pmEl.balita.value) || 0);
    }
    pmEl.jumlahPreview.textContent = jumlah;
  }

  function resetFormPM_() {
    pmEl.editId.value = '';
    pmEl.kategori.value = '';
    pmEl.instansi.value = '';
    pmEl.pk.value = 0; pmEl.pb.value = 0; pmEl.bumil.value = 0; pmEl.busui.value = 0; pmEl.balita.value = 0;
    pmEl.fieldPesertaDidik.style.display = 'none';
    pmEl.field3B.style.display = 'none';
    pmEl.jumlahPreview.textContent = '0';
    document.getElementById('btnSimpanPM').textContent = 'Simpan';
  }

  if (pmEl.btnBuka) {
    pmEl.btnBuka.addEventListener('click', () => {
      resetFormPM_();
      pmEl.form.style.display = pmEl.form.style.display === 'none' ? 'flex' : 'none';
    });
  }
  if (pmEl.btnBatal) {
    pmEl.btnBatal.addEventListener('click', () => { resetFormPM_(); pmEl.form.style.display = 'none'; });
  }
  if (pmEl.kategori) pmEl.kategori.addEventListener('change', tampilkanFieldSesuaiKategoriPM_);
  [pmEl.pk, pmEl.pb, pmEl.bumil, pmEl.busui, pmEl.balita].forEach(el => {
    if (el) el.addEventListener('input', hitungJumlahPreviewPM_);
  });

  async function muatPenerimaManfaat_() {
    if (!pmEl.tbody) return;
    pmEl.tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const daftar = await apiGet('getPenerimaManfaatAdmin', { token: token() });
      if (!daftar.length) {
        pmEl.tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">Belum ada data Penerima Manfaat.</div></td></tr>';
        return;
      }
      pmEl.tbody.innerHTML = daftar.map(r => `
        <tr data-id="${escapeHtml(r.id)}">
          <td>${r.kategori === 'PESERTA_DIDIK' ? 'Peserta Didik' : '3B'}</td>
          <td>${escapeHtml(r.instansi)}</td>
          <td>${r.kategori === 'PESERTA_DIDIK' ? r.pk : '—'}</td>
          <td>${r.kategori === 'PESERTA_DIDIK' ? r.pb : '—'}</td>
          <td>${r.kategori === '3B' ? r.bumil : '—'}</td>
          <td>${r.kategori === '3B' ? r.busui : '—'}</td>
          <td>${r.kategori === '3B' ? r.balita : '—'}</td>
          <td><strong>${r.jumlah}</strong></td>
          <td><span class="badge ${r.status === 'AKTIF' ? 'aktif' : 'nonaktif'}">${escapeHtml(r.status)}</span></td>
          <td style="white-space:nowrap;">
            <button type="button" class="btn-mini btn-edit-pm">Edit</button>
            <button type="button" class="btn-mini btn-toggle-pm" data-aktif="${r.status === 'AKTIF' ? '0' : '1'}">${r.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button>
          </td>
        </tr>`).join('');

      pmEl.tbody.querySelectorAll('.btn-edit-pm').forEach(btn => {
        btn.addEventListener('click', () => {
          const tr = btn.closest('tr');
          const id = tr.dataset.id;
          const r = daftar.find(x => x.id === id);
          if (!r) return;
          pmEl.editId.value = r.id;
          pmEl.kategori.value = r.kategori;
          pmEl.instansi.value = r.instansi;
          pmEl.pk.value = r.pk; pmEl.pb.value = r.pb;
          pmEl.bumil.value = r.bumil; pmEl.busui.value = r.busui; pmEl.balita.value = r.balita;
          tampilkanFieldSesuaiKategoriPM_();
          document.getElementById('btnSimpanPM').textContent = 'Simpan Perubahan';
          pmEl.form.style.display = 'flex';
          pmEl.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
      pmEl.tbody.querySelectorAll('.btn-toggle-pm').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.closest('tr').dataset.id;
          const aktifBaru = btn.dataset.aktif === '1';
          if (!confirm((aktifBaru ? 'Aktifkan' : 'Nonaktifkan') + ' data ini? ' + (aktifBaru ? '' : 'Data TIDAK dihapus, cuma disembunyikan dari Website Publik.'))) return;
          try {
            await apiPost('setStatusPenerimaManfaat', { token: token(), id: id, aktif: aktifBaru });
            showSuccess('Status diperbarui.');
            muatPenerimaManfaat_();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      pmEl.tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  if (pmEl.form) {
    pmEl.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pmEl.kategori.value) { showError('Pilih kategori dulu.'); return; }
      if (!pmEl.instansi.value.trim()) { showError('Nama instansi wajib diisi.'); return; }
      const payload = {
        token: token(),
        kategori: pmEl.kategori.value,
        instansi: pmEl.instansi.value.trim(),
        pk: pmEl.pk.value, pb: pmEl.pb.value,
        bumil: pmEl.bumil.value, busui: pmEl.busui.value, balita: pmEl.balita.value
      };
      const btnSimpan = document.getElementById('btnSimpanPM');
      btnSimpan.disabled = true; // anti-double-click
      try {
        if (pmEl.editId.value) {
          payload.id = pmEl.editId.value;
          await apiPost('updatePenerimaManfaat', payload);
          showSuccess('Data Penerima Manfaat diperbarui.');
        } else {
          await apiPost('addPenerimaManfaat', payload);
          showSuccess('Penerima Manfaat baru ditambahkan.');
        }
        resetFormPM_();
        pmEl.form.style.display = 'none';
        muatPenerimaManfaat_();
      } catch (err) {
        showError(err.message);
      } finally {
        btnSimpan.disabled = false;
      }
    });
  }
})();
