// ============================================================
// SPPG JEUNGJING — LOGIC DASHBOARD RELAWAN (dashboard.html)
// Struktur baru sesuai brief: Hero, Status Operasional, Jadwal Saya,
// Ringkasan SIPRES (Kehadiran Hari Ini + Detail Presensi + Ringkasan
// Kehadiran), Informasi Penting. SATU pemanggilan getDashboardLengkapRelawan
// (bukan banyak request terpisah) -- backend-nya sendiri memanggil ulang
// fungsi-fungsi yang sudah ada (tidak duplikat logic).
// ============================================================

let _leafletDimuat = false;
function pastikanLeafletTermuat_() {
  if (_leafletDimuat) return Promise.resolve();
  return new Promise((resolve) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => { _leafletDimuat = true; resolve(); };
    script.onerror = () => resolve(); // gagal muat peta -- jangan hentikan seluruh Dashboard
    document.head.appendChild(script);
  });
}

function tampilkanPeta_(idWadah, lat, lng) {
  const wadah = document.getElementById(idWadah);
  if (lat == null || lng == null) {
    wadah.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#8a93a3;">Lokasi belum tersedia</div>';
    return;
  }
  if (!window.L) { wadah.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#8a93a3;">Peta gagal dimuat</div>'; return; }

  const peta = L.map(idWadah, { zoomControl: false, attributionControl: false }).setView([lat, lng], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(peta);
  L.marker([lat, lng]).addTo(peta);
  setTimeout(() => peta.invalidateSize(), 200); // wadah baru muncul dari is-hidden -- ukurannya perlu dihitung ulang
}

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) { window.location.href = 'login.html'; return; }

  const main = document.getElementById('dashboardMain');

  // ---- MENU UTAMA: tombol "Lainnya" -- dipasang PALING AWAL, TIDAK
  // bergantung pada berhasil/gagalnya pemuatan data Dashboard di bawah.
  // (Sebelumnya listener ini ditaruh di akhir alur async yang panjang --
  // kalau ada satu saja data yang gagal di tengah jalan, listener ini
  // tidak pernah terpasang sama sekali, membuat tombol terlihat aktif
  // tapi sebenarnya tidak bisa diklik.)
  const btnLainnya = document.getElementById('btnMenuLainnya');
  if (btnLainnya) {
    btnLainnya.addEventListener('click', () => {
      const burger = document.querySelector('.shell-topbar-burger');
      if (burger) burger.click();
    });
  }

  try {
    showLoading('Memuat dashboard...');
    const d = await apiGet('getDashboardLengkapRelawan', { token: sesi.token });
    hideLoading();

    // ---- HERO ----
    document.getElementById('heroNamaRelawan').textContent = d.identitas.nama || '–';
    const statusAkunEl = document.getElementById('heroStatusAkun');
    const aktif = d.identitas.statusAkun !== 'NONAKTIF';
    statusAkunEl.textContent = aktif ? '● AKUN AKTIF' : '● AKUN NONAKTIF';
    statusAkunEl.style.background = aktif ? 'rgba(255,255,255,.15)' : 'rgba(178,58,58,.35)';
    document.getElementById('heroIdDivisi').textContent = (d.identitas.id || '–') + ' • ' + (d.identitas.divisi || '–');

    // ---- KOTAK INFORMASI OPERASIONAL ----
    const namaHari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][new Date().getDay()];
    const tglFormat = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('infoOperasionalTanggal').textContent = '📅 ' + namaHari + ', ' + tglFormat;
    document.getElementById('infoOperasionalStatus').textContent = d.statusOperasional.label;

    // ---- JADWAL SAYA ----
    const jadwalWrap = document.getElementById('jadwalSayaHariIni');
    if (d.jadwalHariIni) {
      const j = d.jadwalHariIni;
      jadwalWrap.innerHTML = `
        <div class="card-item" style="padding:14px 16px;">
          <p style="margin:0;font-size:14px;font-weight:800;">${escapeHtml(j.waktu || 'Sepanjang hari')}</p>
          <p style="margin:3px 0 0;font-size:13px;color:#55606f;">${escapeHtml(j.penugasan || '–')}</p>
          <span style="display:inline-block;margin-top:8px;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:#eef0f3;">${escapeHtml(j.status || 'Terjadwal')}</span>
        </div>`;
    } else {
      jadwalWrap.innerHTML = '<p class="empty-state">Tidak ada jadwal khusus hari ini.</p>';
    }

    // ---- KEHADIRAN HARI INI ----
    const p = d.presensiHariIni;
    document.getElementById('ringkasJamMasuk').textContent = (p.masuk && p.masuk.sudah) ? p.masuk.jam : '–';
    document.getElementById('ringkasJamPulang').textContent = (p.pulang && p.pulang.sudah) ? p.pulang.jam : '–';
    let statusHariIni = 'Belum Absen';
    if (p.masuk && p.masuk.sudah && p.masuk.isIzinSakit) statusHariIni = p.masuk.keterangan;
    else if (p.masuk && p.masuk.sudah && p.pulang && p.pulang.sudah) statusHariIni = 'Selesai';
    else if (p.masuk && p.masuk.sudah) statusHariIni = 'Sedang Bertugas';
    document.getElementById('ringkasStatusHariIni').textContent = statusHariIni;

    // ---- DETAIL PRESENSI (toggle) ----
    document.getElementById('detailTanggal').textContent = p.operasional && p.operasional.tanggal ? p.operasional.tanggal : tglFormat;
    document.getElementById('detailJamMasuk').textContent = (p.masuk && p.masuk.sudah) ? p.masuk.jam : '–';
    document.getElementById('detailJamPulang').textContent = (p.pulang && p.pulang.sudah) ? p.pulang.jam : '—';
    document.getElementById('detailDurasi').textContent = p.durasi || '–';

    const radiusTeks = p.lokasiSppg ? ('Radius Presensi ' + p.lokasiSppg.radiusMeter + ' meter') : 'Radius Presensi –';
    document.getElementById('radiusLokasiMasuk').textContent = radiusTeks;
    document.getElementById('radiusLokasiPulang').textContent = radiusTeks;

    // ---- TITIK PATOKAN & RADIUS DIIZINKAN ----
    // Koordinat mentah dapur TIDAK ditampilkan (sesuai instruksi) -- cuma
    // radius diizinkan vs jarak aktual, dengan kesimpulan valid/tidaknya.
    const patokanWrap = document.getElementById('patokanRadiusInfo');
    if (p.lokasiSppg) {
      const radiusDiizinkan = p.lokasiSppg.radiusMeter;
      const jarakMasuk = (p.masuk && p.masuk.sudah && p.masuk.jarakMeter != null) ? Math.round(p.masuk.jarakMeter) : null;
      let html = `<p style="margin:0;">Radius Diizinkan: <strong>${radiusDiizinkan} m</strong></p>`;
      if (jarakMasuk != null) {
        const valid = jarakMasuk <= radiusDiizinkan;
        html += `<p style="margin:2px 0 0;">Jarak Aktual (saat Masuk): <strong>${jarakMasuk} m</strong></p>`;
        html += `<p style="margin:2px 0 0;color:${valid ? '#1a7a4c' : '#b23a3a'};">${jarakMasuk} m ${valid ? '≤' : '>'} ${radiusDiizinkan} m — presensi ${valid ? 'valid' : 'di luar radius'}</p>`;
      }
      patokanWrap.innerHTML = html;
    } else {
      patokanWrap.innerHTML = '<p style="margin:0;">Data lokasi acuan belum diatur Admin.</p>';
    }

    if (p.masuk && p.masuk.sudah && p.masuk.fotoUrl) {
      document.getElementById('swafotoMasukWrap').innerHTML = `<img src="${p.masuk.fotoUrl}" alt="Swafoto masuk" style="width:100%;height:100%;object-fit:cover;">`;
    }
    if (p.pulang && p.pulang.sudah && p.pulang.fotoUrl) {
      document.getElementById('swafotoPulangWrap').innerHTML = `<img src="${p.pulang.fotoUrl}" alt="Swafoto pulang" style="width:100%;height:100%;object-fit:cover;">`;
    }

    let petaSudahDimuat = false;
    document.getElementById('btnToggleDetailPresensi').addEventListener('click', async function () {
      const wrap = document.getElementById('detailPresensiWrap');
      const sedangTerbuka = !wrap.classList.contains('is-hidden');
      if (sedangTerbuka) {
        wrap.classList.add('is-hidden');
        this.textContent = 'Detail Presensi ▾';
        return;
      }
      wrap.classList.remove('is-hidden');
      this.textContent = 'Detail Presensi ▴';

      if (!petaSudahDimuat) {
        petaSudahDimuat = true;
        await pastikanLeafletTermuat_();
        tampilkanPeta_('petaLokasiMasuk', p.masuk && p.masuk.sudah ? p.masuk.latitude : null, p.masuk && p.masuk.sudah ? p.masuk.longitude : null);
        tampilkanPeta_('petaLokasiPulang', p.pulang && p.pulang.sudah ? p.pulang.latitude : null, p.pulang && p.pulang.sudah ? p.pulang.longitude : null);
      }
    });

    // ---- RINGKASAN KEHADIRAN (4 kategori) ----
    document.getElementById('totalHadirPeriode').textContent = d.ringkasanKehadiran.totalHadir;
    document.getElementById('totalTerlambatPeriode').textContent = d.ringkasanKehadiran.terlambat;
    document.getElementById('totalIzinSakitPeriode').textContent = d.ringkasanKehadiran.izinSakit;
    document.getElementById('totalTidakHadirPeriode').textContent = d.ringkasanKehadiran.tidakHadir;

    // ---- INFORMASI PENTING ----
    const infoWrap = document.getElementById('infoPentingList');
    if (d.informasiPenting && d.informasiPenting.length) {
      infoWrap.innerHTML = d.informasiPenting.map(i => `
        <div class="info-card">
          <h3 class="info-card-title">${escapeHtml(i.judul)}</h3>
          <p class="info-card-body">${escapeHtml(i.isi)}</p>
        </div>`).join('');
    } else {
      infoWrap.innerHTML = '<p class="empty-state">Belum ada informasi penting saat ini.</p>';
    }

    main.style.display = 'block';
  } catch (err) {
    hideLoading();
    showError(err.message || 'Gagal memuat dashboard.');
  }
});
