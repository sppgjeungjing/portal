// ============================================================
// public-nav.js — Sidebar navigasi (slide dari kanan) Website Publik.
// Dipakai bersama di semua halaman publik lewat markup yang sama persis
// (lihat komponen di setiap file .html: .pub-menu-btn, .pub-sidebar, dst).
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const btnBuka = document.querySelector('.pub-menu-btn');
  const sidebar = document.querySelector('.pub-sidebar');
  const overlay = document.querySelector('.pub-overlay');
  const btnTutup = document.querySelector('.pub-sidebar-close');
  if (!btnBuka || !sidebar || !overlay) return;

  function buka() { sidebar.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function tutup() { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = ''; }

  btnBuka.addEventListener('click', buka);
  if (btnTutup) btnTutup.addEventListener('click', tutup);
  overlay.addEventListener('click', tutup);

  // Tandai menu aktif berdasarkan file halaman saat ini.
  const halamanIni = window.location.pathname.split('/').pop() || 'index.html';
  sidebar.querySelectorAll('a[href]').forEach(a => {
    if (a.getAttribute('href') === halamanIni) a.classList.add('is-active');
  });
});
