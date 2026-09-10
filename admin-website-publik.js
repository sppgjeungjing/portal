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
        });
      }
    }, 300);
  });
})();
