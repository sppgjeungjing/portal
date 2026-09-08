// SPPG JEUNGJING — LOGIC HALAMAN PENGATURAN AKUN (pengaturan.html)
// Menggunakan fungsi bersama dari common.js (apiGet, apiPost, dst.)
// dan auth-relawan.js (ambilSesiRelawan, dst.)
// Ganti Password kini halaman terpisah — lihat ganti-password.js.

function formatTanggalWaktuIndo(isoString) {
  if (!isoString) return 'Belum pernah login';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Belum pernah login';
  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const p2 = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${namaBulan[d.getMonth()]} ${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('pengaturanMain');

  async function muatPengaturan() {
    try {
      showLoading('Memuat pengaturan...');
      const data = await apiGet('getPengaturanAkun', { token: sesi.token });
      hideLoading();

      document.getElementById('statusAkun').textContent = data.statusAkun === 'AKTIF' ? 'Aktif' : 'Nonaktif';
      document.getElementById('loginTerakhir').textContent = formatTanggalWaktuIndo(data.loginTerakhir);

      // Ringkasan identitas -- diambil dari profil supaya tidak perlu
      // menambah data baru di endpoint pengaturan.
      try {
        const profil = await (window.sppgProfilPromise || apiGet('getProfilRelawan', { token: sesi.token }));
        document.getElementById('setIdRelawan').textContent = profil.id || '—';
        document.getElementById('setDivisi').textContent = profil.divisi || '—';
        document.getElementById('setUsername').textContent = profil.username || '—';
      } catch (e) { /* bagian pelengkap -- jangan gagalkan seluruh halaman */ }

      main.style.display = 'block';
    } catch (err) {
      hideLoading();
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
    }
  }

  document.getElementById('btnKeluar').addEventListener('click', async () => {
    try {
      await apiPost('logoutRelawan', { token: sesi.token });
    } catch (err) {
      // Tetap lanjutkan keluar di sisi perangkat meski panggilan logout server gagal.
    }
    hapusSesiRelawan();
    window.location.href = 'index.html';
  });

  muatPengaturan();
});


// ---- Ukuran teks besar: disimpan di perangkat masing-masing, tidak perlu
// data baru di server. Berguna untuk relawan yang kesulitan membaca teks kecil.
(function () {
  const KUNCI = 'sppg_teks_besar';
  function terapkan(aktif) {
    document.documentElement.style.fontSize = aktif ? '112.5%' : '';
  }
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggleTeksBesar');
    if (!toggle) return;
    let aktif = false;
    try { aktif = localStorage.getItem(KUNCI) === '1'; } catch (e) { /* penyimpanan tidak tersedia */ }
    toggle.checked = aktif;
    terapkan(aktif);
    toggle.addEventListener('change', () => {
      terapkan(toggle.checked);
      try { localStorage.setItem(KUNCI, toggle.checked ? '1' : '0'); } catch (e) { /* abaikan */ }
    });
  });
})();

// ---- Unduh riwayat absensi periode aktif sebagai CSV
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnUnduhAbsensi');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const sesi = ambilSesiRelawan();
    if (!sesi || !sesi.token) return;
    try {
      showLoading('Menyiapkan berkas...');
      const hasil = await apiGet('getRiwayatAbsensiRelawan', { token: sesi.token });
      hideLoading();
      const baris = [['Tanggal', 'Hari', 'Jam Masuk', 'Jam Pulang', 'Status', 'Keterangan']];
      (hasil.items || []).forEach(r => baris.push([r.tanggal, r.hari, r.jamMasuk, r.jamPulang, r.status, r.keterangan]));
      const csv = baris.map(b => b.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'riwayat-absensi-saya.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });
});

// ---- Notifikasi HP (Firebase Cloud Messaging) ----
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnAktifkanNotifHp');
  const status = document.getElementById('statusNotifHp');
  if (!btn) return;

  function perbaruiTampilanStatus_() {
    if (!('Notification' in window)) {
      status.textContent = 'Browser ini tidak mendukung notifikasi.';
      btn.disabled = true;
      return;
    }
    if (Notification.permission === 'granted') {
      status.textContent = '✅ Notifikasi HP aktif.';
      btn.textContent = '🔕 Matikan Notifikasi HP';
    } else if (Notification.permission === 'denied') {
      status.textContent = '⚠️ Izin notifikasi diblokir. Aktifkan lewat pengaturan browser/HP kamu.';
      btn.textContent = '🔔 Aktifkan Notifikasi HP';
    } else {
      status.textContent = 'Notifikasi HP belum diaktifkan.';
      btn.textContent = '🔔 Aktifkan Notifikasi HP';
    }
  }
  perbaruiTampilanStatus_();

  btn.addEventListener('click', async () => {
    const sesi = ambilSesiRelawan();
    if (!sesi || !sesi.token) return;
    try {
      showLoading('Memproses...');
      if (Notification.permission === 'granted') {
        await nonaktifkanNotifikasiHp(sesi.token);
      } else {
        await aktifkanNotifikasiHp(sesi.token);
      }
      hideLoading();
      showSuccess('Berhasil diperbarui.');
      perbaruiTampilanStatus_();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });
});
