// ============================================================
// SPPG JEUNGJING — Izin, Sakit & Cuti (pengajuan.html)
// Halaman MANDIRI, terpisah dari Presensi (absensi.html/script.js).
// Memakai backend yang SAMA (ajukanIzinSakit, Absensi.gs) -- cuma
// alur/tampilannya yang dipindah ke sini, bukan logic baru.
// ============================================================

let jenisDipilih = null; // 'Izin' | 'Sakit' | 'Cuti'
let sesiPengajuan = null;

document.addEventListener('DOMContentLoaded', () => {
  sesiPengajuan = ambilSesiRelawan();
  if (!sesiPengajuan || !sesiPengajuan.token) { window.location.href = 'login.html'; return; }

  const el = {
    btnPilihIzin: document.getElementById('btnPilihIzin'),
    btnPilihSakit: document.getElementById('btnPilihSakit'),
    btnPilihCuti: document.getElementById('btnPilihCuti'),
    inputKeterangan: document.getElementById('inputKeteranganPengajuan'),
    btnKirim: document.getElementById('btnKirimPengajuan'),
    overlaySukses: document.getElementById('overlaySuksesPengajuan'),
    suksesTeks: document.getElementById('suksesPengajuanTeks'),
    btnTutupSukses: document.getElementById('btnTutupSuksesPengajuan')
  };

  function pilihJenis(jenis) {
    jenisDipilih = jenis;
    el.btnPilihIzin.classList.toggle('selected', jenis === 'Izin');
    el.btnPilihSakit.classList.toggle('selected', jenis === 'Sakit');
    el.btnPilihCuti.classList.toggle('selected', jenis === 'Cuti');
    perbaruiTombol();
  }

  function perbaruiTombol() {
    el.btnKirim.disabled = !(jenisDipilih && el.inputKeterangan.value.trim());
  }

  el.btnPilihIzin.addEventListener('click', () => pilihJenis('Izin'));
  el.btnPilihSakit.addEventListener('click', () => pilihJenis('Sakit'));
  el.btnPilihCuti.addEventListener('click', () => pilihJenis('Cuti'));
  el.inputKeterangan.addEventListener('input', perbaruiTombol);

  el.btnKirim.addEventListener('click', async () => {
    if (!jenisDipilih || !el.inputKeterangan.value.trim()) return;
    el.btnKirim.disabled = true;
    showLoading('Mengirim pengajuan...');
    try {
      await apiPost('ajukanIzinSakit', {
        token: sesiPengajuan.token,
        jenisPengajuan: jenisDipilih,
        keterangan: el.inputKeterangan.value.trim()
      });
      hideLoading();
      el.suksesTeks.textContent = 'Pengajuan ' + jenisDipilih + ' Anda telah tercatat.';
      el.overlaySukses.classList.remove('is-hidden');
    } catch (err) {
      hideLoading();
      showError(err.message);
      perbaruiTombol();
    }
  });

  el.btnTutupSukses.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });
});
