// ============================================================
// SPPG JEUNGJING — MODUL SHIFT & KOREKSI (Dashboard Admin)
// File BARU, terpisah dari admin.js. Memakai window.sppgAdminToken
// (hook yang sama dipakai admin-stok.js) dan fungsi bersama common.js.
// ============================================================

(function () {
  'use strict';

  const el = {
    tabBtn: document.querySelector('.admin-tab-btn[data-panel="panelShift"]'),
    subtabs: document.querySelectorAll('.shift-subtab'),
    subs: document.querySelectorAll('.shift-sub'),

    formShiftDivisi: document.getElementById('formShiftDivisi'),
    shiftDivisiPeriode: document.getElementById('shiftDivisiPeriode'),
    shiftDivisiNama: document.getElementById('shiftDivisiNama'),
    shiftDivisiJamMasuk: document.getElementById('shiftDivisiJamMasuk'),
    shiftDivisiJamPulang: document.getElementById('shiftDivisiJamPulang'),
    shiftDivisiKeterangan: document.getElementById('shiftDivisiKeterangan'),
    tbodyShiftDivisi: document.getElementById('tbodyShiftDivisi'),

    formPenugasanKhusus: document.getElementById('formPenugasanKhusus'),
    khususOperasional: document.getElementById('khususOperasional'),
    khususRelawan: document.getElementById('khususRelawan'),
    khususJamMasuk: document.getElementById('khususJamMasuk'),
    khususJamPulang: document.getElementById('khususJamPulang'),
    khususCatatan: document.getElementById('khususCatatan'),
    tbodyPenugasanKhusus: document.getElementById('tbodyPenugasanKhusus'),

    koreksiRelawan: document.getElementById('koreksiRelawan'),
    koreksiTanggalPresensi: document.getElementById('koreksiTanggalPresensi'),
    btnCariKoreksi: document.getElementById('btnCariKoreksi'),
    koreksiHasil: document.getElementById('koreksiHasil')
  };

  if (!el.tabBtn) return;

  const cache = { periode: [], kalender: [], relawan: [] };
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
      const target = document.getElementById('shiftSub' + btn.dataset.sub.charAt(0).toUpperCase() + btn.dataset.sub.slice(1));
      if (target) target.style.display = 'block';
    });
  });
  el.subtabs[0].classList.add('active');

  window.addEventListener('sppg-admin-ready', () => { if (!sudahInit) { sudahInit = true; initShift(); } });
  if (window.sppgAdminToken && !sudahInit) { sudahInit = true; initShift(); }

  async function initShift() {
    try {
      const [periode, divisi, relawan, kalender] = await Promise.all([
        apiGet('getPeriodeListAdmin', { token: token() }),
        apiGetCached('getDivisi', {}, 600000),
        apiGet('getRelawan', { semua: 1 }),
        apiGet('getKalenderListAdmin', { token: token() })
      ]);
      cache.periode = periode;
      cache.relawan = relawan;
      cache.kalender = kalender;

      el.shiftDivisiPeriode.innerHTML = '<option value="">Pilih Periode...</option>' +
        periode.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nama)}</option>`).join('');
      el.shiftDivisiNama.innerHTML = '<option value="">Pilih Divisi...</option>' +
        divisi.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      el.khususRelawan.innerHTML = '<option value="">Pilih Relawan...</option>' +
        relawan.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
      el.koreksiRelawan.innerHTML = '<option value="">Pilih Relawan...</option>' +
        relawan.map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.nama)}</option>`).join('');
      el.khususOperasional.innerHTML = '<option value="">Pilih Tanggal Operasional...</option>' +
        kalender.map(k => `<option value="${escapeHtml(k.id)}">${escapeHtml(k.tanggal)} (${escapeHtml(k.namaPeriode)})</option>`).join('');
    } catch (err) {
      // diam-diam di init awal, pesan error akan muncul saat user benar-benar interaksi
    }
  }

  // --------------------------------------------------------
  // SHIFT DIVISI
  // --------------------------------------------------------
  el.shiftDivisiPeriode.addEventListener('change', muatShiftDivisi);

  async function muatShiftDivisi() {
    const idPeriode = el.shiftDivisiPeriode.value;
    if (!idPeriode) { el.tbodyShiftDivisi.innerHTML = '<tr><td colspan="5"><div class="empty-state">Pilih periode di atas dulu.</div></td></tr>'; return; }
    el.tbodyShiftDivisi.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const list = await apiGet('getShiftDivisiListAdmin', { token: token(), idPeriode });
      if (!list.length) { el.tbodyShiftDivisi.innerHTML = '<tr><td colspan="5"><div class="empty-state">Belum ada Shift Divisi untuk periode ini.</div></td></tr>'; return; }
      const namaPeriode = (cache.periode.find(p => p.id === idPeriode) || {}).nama || idPeriode;
      el.tbodyShiftDivisi.innerHTML = list.map(s => `
        <tr>
          <td>${escapeHtml(namaPeriode)}</td>
          <td>${escapeHtml(s.namaDivisi)}</td>
          <td>${escapeHtml(s.jamMasuk)}</td>
          <td>${escapeHtml(s.jamPulang || '-')}</td>
          <td><button type="button" class="btn-mini" data-hapus-shift="${escapeHtml(s.id)}">Hapus</button></td>
        </tr>`).join('');
      el.tbodyShiftDivisi.querySelectorAll('[data-hapus-shift]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('deleteShiftDivisi', { token: token(), id: btn.dataset.hapusShift });
            showSuccess('Shift Divisi dihapus.');
            muatShiftDivisi();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.formShiftDivisi.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('addShiftDivisi', {
        token: token(),
        idPeriode: el.shiftDivisiPeriode.value,
        namaDivisi: el.shiftDivisiNama.value,
        jamMasuk: el.shiftDivisiJamMasuk.value,
        jamPulang: el.shiftDivisiJamPulang.value,
        keterangan: el.shiftDivisiKeterangan.value.trim()
      });
      showSuccess('Shift Divisi tersimpan.');
      el.shiftDivisiJamMasuk.value = ''; el.shiftDivisiJamPulang.value = ''; el.shiftDivisiKeterangan.value = '';
      muatShiftDivisi();
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // PENUGASAN KHUSUS
  // --------------------------------------------------------
  el.khususOperasional.addEventListener('change', muatPenugasanKhusus);

  async function muatPenugasanKhusus() {
    const idOperasional = el.khususOperasional.value;
    if (!idOperasional) { el.tbodyPenugasanKhusus.innerHTML = '<tr><td colspan="5"><div class="empty-state">Pilih tanggal operasional di atas dulu.</div></td></tr>'; return; }
    el.tbodyPenugasanKhusus.innerHTML = '<tr><td colspan="5"><div class="empty-state">Memuat data...</div></td></tr>';
    try {
      const list = await apiGet('getPenugasanKhususListAdmin', { token: token(), idOperasional });
      if (!list.length) { el.tbodyPenugasanKhusus.innerHTML = '<tr><td colspan="5"><div class="empty-state">Belum ada penugasan khusus untuk tanggal ini.</div></td></tr>'; return; }
      el.tbodyPenugasanKhusus.innerHTML = list.map(p => `
        <tr>
          <td>${escapeHtml(p.namaRelawan)}</td>
          <td>${escapeHtml(p.jamMasuk)}</td>
          <td>${escapeHtml(p.jamPulang || '-')}</td>
          <td>${escapeHtml(p.catatan || '-')}</td>
          <td><button type="button" class="btn-mini" data-hapus-khusus="${escapeHtml(p.id)}">Hapus</button></td>
        </tr>`).join('');
      el.tbodyPenugasanKhusus.querySelectorAll('[data-hapus-khusus]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await apiPost('deletePenugasanKhusus', { token: token(), id: btn.dataset.hapusKhusus });
            showSuccess('Penugasan khusus dihapus.');
            muatPenugasanKhusus();
          } catch (err) { showError(err.message); }
        });
      });
    } catch (err) {
      showError(err.message);
    }
  }

  el.formPenugasanKhusus.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('addPenugasanKhusus', {
        token: token(),
        idOperasional: el.khususOperasional.value,
        idRelawan: el.khususRelawan.value,
        jamMasuk: el.khususJamMasuk.value,
        jamPulang: el.khususJamPulang.value,
        catatan: el.khususCatatan.value.trim()
      });
      showSuccess('Penugasan khusus tersimpan.');
      el.khususJamMasuk.value = ''; el.khususJamPulang.value = ''; el.khususCatatan.value = '';
      muatPenugasanKhusus();
    } catch (err) {
      showError(err.message);
    }
  });

  // --------------------------------------------------------
  // KOREKSI TANGGAL OPERASIONAL
  // --------------------------------------------------------
  function keTanggalDMY_(inputDateValue) {
    // input[type=date] value = "yyyy-mm-dd" -> ubah ke "dd/MM/yyyy"
    if (!inputDateValue) return '';
    const [y, m, d] = inputDateValue.split('-');
    return d + '/' + m + '/' + y;
  }

  el.btnCariKoreksi.addEventListener('click', async () => {
    const idRelawan = el.koreksiRelawan.value;
    const tanggalPresensi = keTanggalDMY_(el.koreksiTanggalPresensi.value);
    if (!idRelawan || !tanggalPresensi) { showError('Pilih relawan dan tanggal presensi dulu.'); return; }

    el.koreksiHasil.innerHTML = '<div class="empty-state">Mencari...</div>';
    try {
      const hasil = await apiGet('cariAbsensiUntukKoreksi', { token: token(), idRelawan, tanggalPresensi });
      if (!hasil.length) { el.koreksiHasil.innerHTML = '<div class="empty-state">Tidak ada absensi ditemukan untuk relawan & tanggal ini.</div>'; return; }

      const opsiTujuan = '<option value="">Pilih tanggal operasional yang benar...</option>' +
        cache.kalender.map(k => `<option value="${escapeHtml(k.id)}">${escapeHtml(k.tanggal)} (${escapeHtml(k.namaPeriode)}) — ${escapeHtml(k.hari)}</option>`).join('');

      el.koreksiHasil.innerHTML = hasil.map((h, i) => `
        <div class="shift-koreksi-row">
          <div class="profile-identity-list">
            <div class="profile-identity-row"><span>Jenis</span><span>${escapeHtml(h.jenis)}</span></div>
            <div class="profile-identity-row"><span>Jam</span><span>${escapeHtml(h.jam)}</span></div>
            <div class="profile-identity-row"><span>Tanggal Operasional Saat Ini</span><span>${escapeHtml(h.tanggalTercatatSaatIni)}</span></div>
          </div>
          <select id="koreksiTujuan${i}">${opsiTujuan}</select>
          <button type="button" class="btn-mini primary" style="margin-top:8px;" data-koreksi-jenis="${escapeHtml(h.jenis)}" data-koreksi-tujuan-idx="${i}">Koreksi ke Tanggal Ini</button>
        </div>`).join('');

      el.koreksiHasil.querySelectorAll('[data-koreksi-jenis]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idOperasionalBaru = document.getElementById('koreksiTujuan' + btn.dataset.koreksiTujuanIdx).value;
          if (!idOperasionalBaru) { showError('Pilih tanggal operasional tujuan dulu.'); return; }
          if (!confirm('Yakin pindahkan absensi ' + btn.dataset.koreksiJenis + ' ini ke tanggal operasional yang dipilih? Jam/timestamp asli tidak berubah.')) return;
          try {
            const hasilKoreksi = await apiPost('koreksiTanggalOperasionalAbsensi', {
              token: token(), idRelawan, jenis: btn.dataset.koreksiJenis,
              tanggalLama: tanggalPresensi, idOperasionalBaru
            });
            showSuccess('Berhasil dikoreksi ke ' + hasilKoreksi.tanggalBaru + '.');
            el.btnCariKoreksi.click();
          } catch (err) {
            showError(err.message);
          }
        });
      });
    } catch (err) {
      el.koreksiHasil.innerHTML = '';
      showError(err.message);
    }
  });
})();
