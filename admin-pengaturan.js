// ============================================================
// admin-pengaturan.js — Pengaturan Portal fungsional (BARU)
// File mandiri, pola sama seperti modul admin-* lainnya.
// ============================================================

(function () {
  'use strict';

  function token() { return window.sppgAdminToken; }
  let sudahMuatForm = false;
  let sudahMuatLog = false;

  async function muatFormPengaturan_() {
    try {
      const p = await apiGet('getPengaturanPortal', { token: token() });
      document.getElementById('inputNamaPortal').value = p.NAMA_PORTAL || '';
      document.getElementById('inputTemplateNotif').value = p.TEMPLATE_NOTIFIKASI_DEFAULT || '';
      const selTz = document.getElementById('inputTimezone');
      if (p.TIMEZONE_SISTEM) selTz.value = p.TIMEZONE_SISTEM;
    } catch (err) {
      showError('Gagal memuat pengaturan: ' + err.message);
    }
  }

  async function simpan_(payload, pesanSukses) {
    try {
      await apiPost('setPengaturanPortal', Object.assign({ token: token() }, payload));
      showSuccess(pesanSukses);
    } catch (err) { showError(err.message); }
  }

  async function muatLogAktivitas_() {
    const tbody = document.getElementById('tbodyLogAktivitas');
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Memuat...</div></td></tr>';
    try {
      const log = await apiGet('getLogAktivitas', { token: token() });
      if (!log.length) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Belum ada aktivitas tercatat.</div></td></tr>';
        return;
      }
      tbody.innerHTML = log.map(l => `
        <tr>
          <td style="white-space:nowrap;">${escapeHtml(formatTanggalWaktuIndoShell(l.waktu))}</td>
          <td>${escapeHtml(l.aktor || '-')}</td>
          <td>${escapeHtml(l.aksi || '-')}</td>
          <td>${escapeHtml(l.modul || '-')}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="color:#b23a3a;">${escapeHtml(err.message)}</div></td></tr>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    let percobaan = 0;
    const interval = setInterval(() => {
      const panel = document.getElementById('panelPengaturan');
      percobaan++;
      if (panel || percobaan > 20) clearInterval(interval);
      if (!panel) return;

      const btnTab = document.querySelector('[data-panel="panelPengaturan"]');
      if (btnTab) {
        btnTab.addEventListener('click', () => {
          if (!sudahMuatForm) { sudahMuatForm = true; muatFormPengaturan_(); }
        });
      }

      // Log Aktivitas dimuat saat kategori 6 dibuka (details/summary), bukan
      // langsung saat panel Pengaturan dibuka -- supaya tidak ada request
      // yang tidak perlu kalau admin cuma mau lihat kategori lain.
      const detailsLog = document.querySelectorAll('#panelPengaturan details')[5];
      if (detailsLog) {
        detailsLog.addEventListener('toggle', () => {
          if (detailsLog.open && !sudahMuatLog) { sudahMuatLog = true; muatLogAktivitas_(); }
        });
      }

      document.getElementById('btnSimpanPortal').addEventListener('click', () => {
        simpan_({ NAMA_PORTAL: document.getElementById('inputNamaPortal').value.trim() }, 'Nama Portal disimpan.');
      });
      document.getElementById('btnSimpanNotif').addEventListener('click', () => {
        simpan_({ TEMPLATE_NOTIFIKASI_DEFAULT: document.getElementById('inputTemplateNotif').value }, 'Template notifikasi disimpan.');
      });
      document.getElementById('btnSimpanSistem').addEventListener('click', () => {
        simpan_({ TIMEZONE_SISTEM: document.getElementById('inputTimezone').value }, 'Zona waktu disimpan.');
      });
    }, 300);
  });
})();
