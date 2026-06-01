// Simple hash-based routing for album pages
// album.html?id=beyonce-cowboy-carter-2024

function getAlbumIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function navigateToAlbum(albumId) {
  window.location.href = `/album.html?id=${encodeURIComponent(albumId)}`;
}

function navigateTo(path) {
  window.location.href = path;
}

function setActiveNav() {
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (href === filename || href === '/' + filename ||
        (filename === 'index.html' && href === 'index.html') ||
        (filename === '' && href === 'index.html'))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

export { getAlbumIdFromUrl, navigateToAlbum, navigateTo, setActiveNav };
