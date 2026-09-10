// ============================================================
// admin-pengelola-sppg.js — Kelola akun Pengelola/Admin (BARU)
// File mandiri, pola sama seperti admin-sipandu-akses.js.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }

  async function muatTabel_() {
    const tbody = document.getElementById('tbodyPengelolaSppg');
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const daftar = await apiGet('getDaftarPengelola', { token: token() });
      if (!daftar.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada akun Pengelola.</div></td></tr>';
        return;
      }
      const usernameSaya = (window.sppgAdminUsername || '').toLowerCase();
      tbody.innerHTML = daftar.map(p => `
        <tr>
          <td>${escapeHtml(p.username)}</td>
          <td>${escapeHtml(p.nama || '-')}</td>
          <td>${p.status === 'AKTIF' ? '<span style="color:#1a7a4c;font-weight:700;">Aktif</span>' : '<span style="color:#b23a3a;">Nonaktif</span>'}</td>
          <td>${p.username.toLowerCase() === usernameSaya
            ? '<span style="color:var(--color-text-muted);font-size:12px;">Akun Anda</span>'
            : `<button type="button" class="btn-mini" data-toggle-status="${escapeHtml(p.username)}" data-aktif="${p.status === 'AKTIF' ? '0' : '1'}">${p.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button>`}</td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-toggle-status]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const username = btn.dataset.toggleStatus;
          const aktifkan = btn.dataset.aktif === '1';
          if (!confirm((aktifkan ? 'Aktifkan' : 'Nonaktifkan') + ' akun "' + username + '"?')) return;
          try {
            await apiPost('setStatusPengelola', { token: token(), username: username, aktif: aktifkan });
            showSuccess('Status akun diperbarui.');
            muatTabel_();
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
      const panel = document.getElementById('panelPengelolaSppg');
      percobaan++;
      if (panel || percobaan > 20) clearInterval(interval);
      if (!panel) return;

      let sudahDimuat = false;
      const btnTab = document.querySelector('[data-panel="panelPengelolaSppg"]');
      if (btnTab) {
        btnTab.addEventListener('click', () => {
          if (sudahDimuat) return;
          sudahDimuat = true;
          muatTabel_();
        });
      }

      document.getElementById('btnTambahPengelola').addEventListener('click', async () => {
        const inputUsername = document.getElementById('inputUsernamePengelola');
        const inputNama = document.getElementById('inputNamaPengelola');
        const inputPassword = document.getElementById('inputPasswordPengelola');

        if (!inputUsername.value.trim()) { showError('Username wajib diisi.'); return; }
        if (!inputPassword.value || inputPassword.value.length < 6) { showError('Password minimal 6 karakter.'); return; }

        try {
          await apiPost('addPengelola', {
            token: token(),
            username: inputUsername.value.trim(),
            nama: inputNama.value.trim(),
            password: inputPassword.value
          });
          showSuccess('Akun Pengelola berhasil ditambahkan.');
          inputUsername.value = ''; inputNama.value = ''; inputPassword.value = '';
          muatTabel_();
        } catch (err) { showError(err.message); }
      });
    }, 300);
  });
})();
