// SPPG JEUNGJING — LOGIC HALAMAN RIWAYAT ABSENSI (riwayat.html)
// Menggunakan fungsi bersama dari common.js (apiGet, dst.) dan auth-relawan.js.

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jumat", 'Sabtu'];
const NAMA_BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** tanggal dalam format "dd/MM/yyyy" -> objek Date. */
function parseTanggalDMY(tanggalStr) {
  const [dd, mm, yyyy] = tanggalStr.split('/').map(Number);
  return new Date(yyyy, mm - 1, dd);
}

function badgeClassUntukStatus(status) {
  const peta = { 'Hadir': 'hadir', 'Terlambat': 'terlambat', 'Izin': 'izin', 'Sakit': 'sakit', 'Tidak Hadir': 'tidak-hadir', 'Tidak Ada Jadwal': 'tidak-ada-jadwal', 'Belum Berjalan': 'belum-berjalan' };
  return peta[status] || 'tidak-hadir';
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('riwayatMain');
  const list = document.getElementById('riwayatList');

  try {
    showLoading('Memuat riwayat absensi...');
    const hasil = await apiGet('getRiwayatAbsensiRelawan', { token: sesi.token });
    hideLoading();

    // Subjudul mengikuti PERIODE AKTIF dari data Admin -- bukan teks tetap.
    const sub = document.getElementById('riwayatSub');
    if (sub) {
      sub.textContent = hasil.periode
        ? `Periode ${hasil.periode.nama} (${hasil.periode.tanggalMulai} – ${hasil.periode.tanggalSelesai})`
        : 'Belum ada periode kerja yang dibuat Admin.';
    }

    const riwayat = hasil.items || [];
    if (!riwayat.length) {
      list.innerHTML = '<div class="empty-state">Belum ada tanggal operasional aktif pada periode ini.</div>';
      main.style.display = 'block';
      return;
    }

    list.innerHTML = riwayat.map(r => {
      const d = parseTanggalDMY(r.tanggal);
      const namaHari = NAMA_HARI[d.getDay()];
      const tglSingkat = `${d.getDate()} ${NAMA_BULAN_SINGKAT[d.getMonth()]}`;
      const jamText = (r.jamMasuk || r.jamPulang)
        ? `Masuk ${r.jamMasuk ? r.jamMasuk.slice(0, 5) : '—'} · Pulang ${r.jamPulang ? r.jamPulang.slice(0, 5) : '—'}`
        : (r.akanDatang ? 'Jadwal operasional mendatang' : 'Tidak ada catatan absensi');

      return `
      <div class="riwayat-item is-${badgeClassUntukStatus(r.status)}">
        <div class="riwayat-item-date">
          <span class="riwayat-day-name">${namaHari}</span>
          <span class="riwayat-day-num">${tglSingkat}</span>
        </div>
        <div class="riwayat-item-detail">
          <div class="riwayat-item-top">
            <span class="riwayat-badge ${badgeClassUntukStatus(r.status)}">${r.status}</span>
          </div>
          <div class="riwayat-item-jam">${jamText}</div>
          ${r.keterangan ? `<div class="riwayat-item-ket">${escapeHtml(r.keterangan)}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    main.style.display = 'block';
  } catch (err) {
    hideLoading();
    // OPTIMASI: sebelumnya SEMUA error di sini (termasuk gangguan
    // jaringan/timeout biasa) langsung dianggap "sesi berakhir" dan
    // memaksa kembali ke Login -- padahal error jaringan BUKAN berarti
    // sesinya tidak valid. Sekarang dibedakan: cuma redirect ke Login
    // kalau pesannya memang menandakan sesi tidak valid/berakhir.
    if (apakahErrorSesiTidakValid(err.message)) {
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
      return;
    }
    showError(err.message || 'Gagal memuat riwayat.');
    main.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;text-align:center;">
        <p style="margin:0 0 12px;font-size:14px;color:#55606f;">Data belum dapat dimuat. Periksa koneksi internet Anda.</p>
        <button type="button" id="btnCobaLagiRiwayat" class="btn-outline">↻ Coba Lagi</button>
      </div>`;
    main.style.display = 'block';
    const btnCobaLagi = document.getElementById('btnCobaLagiRiwayat');
    if (btnCobaLagi) btnCobaLagi.addEventListener('click', () => window.location.reload());
  }
});
