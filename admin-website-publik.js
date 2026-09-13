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

  document.addEventListener('DOMContentLoaded', () => {
    let percobaan = 0;
    const interval = setInterval(() => {
      const panel = document.getElementById('panelWebsitePublik');
      percobaan++;
      if (panel || percobaan > 20) clearInterval(interval);
      if (!panel) return;

      const btnTab = document.querySelector('[data-panel="panelWebsitePublik"]');
      if (btnTab) {
        btnTab.addEventListener('click', () => {
          if (sudahDimuat) return;
          sudahDimuat = true;
          muatDaftar_();
          muatDataPenerimaan_();
          muatMenuWebsite_();
        });
      }

      document.getElementById('btnTambahDataPenerimaan').addEventListener('click', async () => {
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
    }, 300);
  });
})();
