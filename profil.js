// SPPG JEUNGJING — LOGIC HALAMAN PROFIL RELAWAN (profil.html)
// Menggunakan fungsi bersama dari common.js (apiGet, apiPost, dst.)
// dan auth-relawan.js (ambilSesiRelawan, dst.)

document.addEventListener('DOMContentLoaded', async () => {
  const sesi = ambilSesiRelawan();
  if (!sesi || !sesi.token) {
    window.location.href = 'login.html';
    return;
  }

  const main = document.getElementById('profilMain');
  let profilTerakhir = null;

  function formatTanggalWaktu_(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  async function muatProfil() {
    try {
      showLoading('Memuat profil...');
      const profil = await (window.sppgProfilPromise || apiGet('getProfilRelawan', { token: sesi.token }));
      hideLoading();
      profilTerakhir = profil;

      document.getElementById('namaRelawan').textContent = profil.nama;
      document.getElementById('idRelawan').textContent = profil.id;
      document.getElementById('divisiRelawan').textContent = profil.divisi;
      document.getElementById('statusRelawan').textContent = profil.status;
      document.getElementById('usernameRelawan').textContent = profil.username;

      document.getElementById('inputNoHp').value = profil.noHp || '';
      document.getElementById('inputEmail').value = profil.email || '';
      document.getElementById('inputTanggalLahir').value = profil.tanggalLahir || '';
      document.getElementById('inputJenisKelamin').value = profil.jenisKelamin || '';
      document.getElementById('inputAlamat').value = profil.alamat || '';

      const kd = profil.kontakDarurat || {};
      document.getElementById('inputKontakDaruratNama').value = kd.nama || '';
      document.getElementById('inputKontakDaruratHubungan').value = kd.hubungan || '';
      document.getElementById('inputKontakDaruratNoHp').value = kd.noHp || '';

      // NIK -- kalau SUDAH pernah diisi (nikSudahDiisi), tampilkan MASKED &
      // KUNCI input (readonly) -- sesuai spesifikasi "terkunci setelah valid,
      // perubahan selanjutnya hanya lewat Admin". Kalau BELUM diisi, biarkan
      // terbuka untuk diisi user.
      const inputNik = document.getElementById('inputNik');
      const infoNik = document.getElementById('infoNik');
      const badgeNik = document.getElementById('nikBadge');
      if (profil.nikSudahDiisi) {
        inputNik.value = profil.nikMasked;
        inputNik.readOnly = true;
        inputNik.style.background = '#f6f7f9';
        infoNik.textContent = 'NIK sudah tersimpan dan terkunci. Hubungi Admin untuk perubahan.';
        badgeNik.textContent = '🔒';
      } else {
        inputNik.value = '';
        inputNik.readOnly = false;
        infoNik.textContent = 'NIK akan terkunci otomatis setelah tersimpan — perubahan selanjutnya hanya lewat Admin.';
        badgeNik.textContent = '✏️';
      }

      // Keanggotaan SPPG (duplikat tampilan readonly)
      document.getElementById('idRelawan2').textContent = profil.id;
      document.getElementById('divisiRelawan2').textContent = profil.divisi;
      document.getElementById('tanggalBergabungRelawan').textContent = profil.tanggalBergabung || '—';
      document.getElementById('statusRelawan2').textContent = profil.status;

      // Akses -- murni informasi
      const akses = profil.akses || {};
      document.getElementById('roleRelawan').textContent = akses.role || 'Relawan';
      document.getElementById('hakAksesRelawan').textContent = akses.hakAkses || 'Standar';
      document.getElementById('terakhirLoginRelawan').textContent = formatTanggalWaktu_(akses.terakhirLogin);

      // Foto profil
      const pratinjau = document.getElementById('fotoProfilPratinjau');
      if (profil.fotoProfilUrl) {
        pratinjau.innerHTML = `<img src="${profil.fotoProfilUrl}" alt="Foto profil" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        pratinjau.textContent = (profil.nama || '?').trim().charAt(0).toUpperCase();
      }

      // Kelayakan ganti username -- backend yang menentukan. TIDAK PERNAH
      // menampilkan angka hari cooldown ke user (sesuai spesifikasi) --
      // kalau belum boleh, tombol dinonaktifkan dengan pesan generik saja.
      const info = document.getElementById('infoGantiUsername');
      const btnGanti = document.getElementById('btnGantiUsername');
      const gu = profil.gantiUsername || { boleh: true };
      if (gu.boleh) {
        info.textContent = '';
        btnGanti.disabled = false;
      } else {
        info.textContent = 'Data ini belum dapat diubah saat ini.';
        btnGanti.disabled = true;
      }

      main.style.display = 'block';
    } catch (err) {
      hideLoading();
      // Sesi kedaluwarsa ATAU akun baru saja dinonaktifkan Admin → kembali ke
      // login, tapi bawa pesannya supaya relawan tahu alasannya, bukan
      // tampilan form kosong yang membingungkan.
      hapusSesiRelawan();
      simpanNotisLogin(err.message || 'Sesi telah berakhir. Silakan login kembali.');
      window.location.href = 'login.html';
    }
  }

  document.getElementById('profilForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      showLoading('Menyimpan profil...');
      const payload = {
        token: sesi.token,
        noHp: document.getElementById('inputNoHp').value.trim(),
        email: document.getElementById('inputEmail').value.trim(),
        tanggalLahir: document.getElementById('inputTanggalLahir').value,
        jenisKelamin: document.getElementById('inputJenisKelamin').value,
        alamat: document.getElementById('inputAlamat').value.trim(),
        kontakDaruratNama: document.getElementById('inputKontakDaruratNama').value.trim(),
        kontakDaruratHubungan: document.getElementById('inputKontakDaruratHubungan').value,
        kontakDaruratNoHp: document.getElementById('inputKontakDaruratNoHp').value.trim()
      };
      // NIK cuma dikirim kalau BELUM terkunci (field masih editable) --
      // supaya tidak sengaja mengirim ulang nilai bertopeng (masked) sebagai "NIK baru".
      if (!profilTerakhir || !profilTerakhir.nikSudahDiisi) {
        const nikDiketik = document.getElementById('inputNik').value.trim();
        if (nikDiketik) payload.nik = nikDiketik;
      }

      const hasil = await apiPost('updateProfilRelawan', payload);
      hideLoading();
      if (hasil.ditolak && hasil.ditolak.length) {
        // Sebagian field tersimpan, sebagian belum bisa diubah -- pesan
        // GENERIK saja, tidak menyebut field/hari spesifik.
        showError('Sebagian data tersimpan. Data ini belum dapat diubah saat ini.');
      } else {
        showSuccess('Profil berhasil disimpan.');
      }
      await muatProfil();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  // ---- Foto profil: diperkecil dulu di perangkat sebelum diunggah,
  // supaya tidak mengulang masalah unggahan berat seperti swafoto absensi.
  document.getElementById('btnSimpanFoto').addEventListener('click', async () => {
    const berkas = document.getElementById('inputFotoProfil').files[0];
    if (!berkas) { showError('Pilih foto dulu.'); return; }
    try {
      showLoading('Menyiapkan foto...');
      const dataUrl = await perkecilGambar_(berkas, 400);
      const hasil = await apiPost('simpanFotoProfilRelawan', { token: sesi.token, fotoBase64: dataUrl }, 45000);
      hideLoading();
      showSuccess('Foto profil disimpan.');
      document.getElementById('fotoProfilPratinjau').innerHTML =
        `<img src="${hasil.fotoProfilUrl}" alt="Foto profil" style="width:100%;height:100%;object-fit:cover;">`;
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  function perkecilGambar_(berkas, maksSisi) {
    return new Promise((resolve, reject) => {
      const pembaca = new FileReader();
      pembaca.onerror = () => reject(new Error('Gagal membaca berkas foto.'));
      pembaca.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Berkas yang dipilih bukan gambar yang didukung.'));
        img.onload = () => {
          const skala = Math.min(1, maksSisi / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * skala);
          c.height = Math.round(img.height * skala);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = pembaca.result;
      };
      pembaca.readAsDataURL(berkas);
    });
  }

  // ---- Ganti username -- field tunggal, konfirmasi via dialog sebelum submit
  // (bukan ketik-ulang) supaya lebih ringkas, tetap ada jeda sebelum aksi
  // yang menyentuh jalur login ini benar-benar dijalankan.
  document.getElementById('btnGantiUsername').addEventListener('click', async () => {
    const baru = document.getElementById('inputUsernameBaru').value.trim().toLowerCase();
    if (!baru) { showError('Username baru belum diisi.'); return; }
    if (!confirm('Setelah diubah, Anda login memakai username "' + baru + '". Lanjutkan?')) return;
    try {
      showLoading('Mengubah username...');
      await apiPost('gantiUsernameRelawan', { token: sesi.token, usernameBaru: baru });
      hideLoading();
      showSuccess('Username berhasil diubah menjadi ' + baru + '.');
      document.getElementById('inputUsernameBaru').value = '';
      await muatProfil();
    } catch (err) {
      hideLoading();
      showError(err.message);
    }
  });

  document.getElementById('btnKeluar').addEventListener('click', async () => {
    try {
      await apiPost('logoutRelawan', { token: sesi.token });
    } catch (err) {
      // Tetap lanjutkan keluar di sisi perangkat meski panggilan logout server gagal
      // (mis. sedang offline) — sesi di server akan kedaluwarsa otomatis maksimal 6 jam.
    }
    hapusSesiRelawan();
    window.location.href = 'index.html';
  });

  muatProfil();
});
