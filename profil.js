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

  async function muatProfil() {
    try {
      showLoading('Memuat profil...');
      const profil = await (window.sppgProfilPromise || apiGet('getProfilRelawan', { token: sesi.token }));
      hideLoading();

      document.getElementById('namaRelawan').textContent = profil.nama;
      document.getElementById('divisiRelawan').textContent = 'Relawan ' + profil.divisi;
      document.getElementById('idRelawan').textContent = profil.id;
      document.getElementById('statusRelawan').textContent = profil.status;
      document.getElementById('usernameRelawan').textContent = profil.username;
      document.getElementById('inputNoHp').value = profil.noHp || '';
      document.getElementById('inputEmail').value = profil.email || '';
      document.getElementById('inputTanggalLahir').value = profil.tanggalLahir || '';
      document.getElementById('inputJenisKelamin').value = profil.jenisKelamin || '';
      document.getElementById('inputAlamat').value = profil.alamat || '';

      // Foto profil
      const pratinjau = document.getElementById('fotoProfilPratinjau');
      if (profil.fotoProfilUrl) {
        pratinjau.innerHTML = `<img src="${profil.fotoProfilUrl}" alt="Foto profil" style="width:100%;height:100%;object-fit:cover;">`;
      } else {
        pratinjau.textContent = (profil.nama || '?').trim().charAt(0).toUpperCase();
      }

      // Kelayakan ganti username -- backend yang menentukan, layar hanya menampilkan.
      const info = document.getElementById('infoGantiUsername');
      const wrap = document.getElementById('formGantiUsernameWrap');
      const gu = profil.gantiUsername || { boleh: true, sisaHari: 0 };
      if (gu.boleh) {
        info.textContent = 'Username sekarang: ' + profil.username + '. Bisa diubah sekarang.';
        wrap.style.display = 'block';
      } else {
        info.textContent = 'Username sekarang: ' + profil.username + '. Bisa diubah lagi dalam ' + gu.sisaHari + ' hari.';
        wrap.style.display = 'none';
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
      await apiPost('updateProfilRelawan', {
        token: sesi.token,
        noHp: document.getElementById('inputNoHp').value.trim(),
        email: document.getElementById('inputEmail').value.trim(),
        tanggalLahir: document.getElementById('inputTanggalLahir').value,
        jenisKelamin: document.getElementById('inputJenisKelamin').value,
        alamat: document.getElementById('inputAlamat').value.trim()
      });
      hideLoading();
      showSuccess('Profil berhasil disimpan.');
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

  // ---- Ganti username (menyentuh jalur login -- konfirmasi ketik ulang wajib)
  document.getElementById('btnGantiUsername').addEventListener('click', async () => {
    const baru = document.getElementById('inputUsernameBaru').value.trim().toLowerCase();
    const ulang = document.getElementById('inputUsernameBaru2').value.trim().toLowerCase();
    if (!baru) { showError('Username baru belum diisi.'); return; }
    if (baru !== ulang) { showError('Ketikan ulang username tidak sama.'); return; }
    if (!confirm('Setelah diubah, Anda login memakai username "' + baru + '". Lanjutkan?')) return;
    try {
      showLoading('Mengubah username...');
      await apiPost('gantiUsernameRelawan', { token: sesi.token, usernameBaru: baru });
      hideLoading();
      showSuccess('Username berhasil diubah menjadi ' + baru + '.');
      document.getElementById('inputUsernameBaru').value = '';
      document.getElementById('inputUsernameBaru2').value = '';
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
