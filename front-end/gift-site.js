(function () {
  'use strict';
  var themeToggle = document.querySelector('[data-gift-theme-toggle]');
  function applyTheme(theme) {
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-gift-theme', next);
    if (themeToggle) {
      themeToggle.textContent = next === 'dark' ? 'Modo claro' : 'Modo escuro';
      themeToggle.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    }
    try { localStorage.setItem('ella_sorriu_public_theme', next); } catch (_) { /* preferência local */ }
  }
  try {
    var savedTheme = localStorage.getItem('ella_sorriu_public_theme');
    applyTheme(document.body.classList.contains('gift-site-preview') ? document.documentElement.dataset.giftTheme :
      (savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : document.documentElement.dataset.giftTheme));
  } catch (_) { applyTheme(document.documentElement.dataset.giftTheme); }
  if (themeToggle) themeToggle.addEventListener('click', function () {
    applyTheme(document.documentElement.dataset.giftTheme === 'dark' ? 'light' : 'dark');
  });
  var audio = document.querySelector('[data-gift-audio]');
  var musicButton = document.querySelector('[data-music-toggle]');
  var externalMusic = document.body.dataset.musicExternal === 'true';
  var externalMusicLink = document.querySelector('.gift-music-link');
  var playButton = document.querySelector('[data-photo-play]');
  function syncMusicControls() {
    if (!audio) return;
    var playing = !audio.paused && !audio.ended;
    [musicButton, playButton].forEach(function (button) {
      if (!button) return;
      button.textContent = playing ? 'Ⅱ Pausar' : '♪ Reproduzir';
      button.setAttribute('aria-label', playing ? 'Pausar música' : 'Reproduzir música');
      button.setAttribute('aria-pressed', String(playing));
    });
  }
  function playMusic() {
    if (!audio) return;
    audio.play().then(syncMusicControls).catch(function () {
      syncMusicControls();
      if (musicButton) musicButton.textContent = '♪ Tentar reproduzir';
    });
  }
  function toggleMusic() {
    if (!audio) return;
    if (audio.paused) playMusic();
    else audio.pause();
    syncMusicControls();
  }
  if (musicButton) musicButton.addEventListener('click', toggleMusic);
  if (audio) {
    ['play', 'pause', 'ended', 'error'].forEach(function (event) { audio.addEventListener(event, syncMusicControls); });
    syncMusicControls();
  }
  var volumeToggle = document.querySelector('[data-volume-toggle]');
  var volumePanel = document.querySelector('[data-volume-panel]');
  var volumeInput = document.querySelector('[data-volume]');
  if (audio && volumeToggle && volumePanel && volumeInput) {
    function syncVolume() {
      var level = audio.muted ? 0 : Math.round(audio.volume * 100);
      volumeInput.value = level;
      volumeInput.setAttribute('aria-valuetext', level + '%');
      document.querySelector('[data-volume-value]').textContent = level + '%';
      volumeToggle.setAttribute('aria-label', 'Ajustar volume, ' + level + '%');
      volumeToggle.querySelector('[data-volume-waves]').toggleAttribute('hidden', level === 0);
      volumeToggle.querySelector('[data-volume-muted]').toggleAttribute('hidden', level !== 0);
    }
    function closeVolume() { volumePanel.hidden = true; volumeToggle.setAttribute('aria-expanded', 'false'); }
    volumeToggle.addEventListener('click', function () {
      volumePanel.hidden = !volumePanel.hidden;
      volumeToggle.setAttribute('aria-expanded', String(!volumePanel.hidden));
      if (!volumePanel.hidden) volumeInput.focus();
    });
    volumeInput.addEventListener('input', function () {
      audio.volume = Number(volumeInput.value) / 100;
      audio.muted = audio.volume === 0;
      syncVolume();
    });
    audio.addEventListener('volumechange', syncVolume);
    document.addEventListener('click', function (event) { if (!event.target.closest('.gift-volume-control')) closeVolume(); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !volumePanel.hidden) { closeVolume(); volumeToggle.focus(); }
    });
    syncVolume();
  }
  var dialog = document.querySelector('[data-photo-dialog]');
  var large = dialog.querySelector('[data-photo-large]');
  var description = dialog.querySelector('[data-photo-description]');
  var note = dialog.querySelector('[data-photo-note]');
  document.querySelectorAll('[data-photo-open]').forEach(function (button) {
    button.addEventListener('click', function () {
      large.src = button.dataset.photoSrc;
      large.alt = button.querySelector('img').alt;
      description.textContent = button.dataset.photoDescription || button.querySelector('img').alt || 'Foto do presente';
      note.textContent = button.dataset.photoNote || '';
      description.hidden = false;
      note.hidden = !note.textContent.trim();
      playButton.hidden = (!audio && !externalMusicLink) || button.dataset.photoMusic !== 'true';
      if (externalMusicLink) playButton.textContent = '↗ Abrir música';
      else syncMusicControls();
      dialog.showModal();
    });
  });
  playButton.addEventListener('click', function () {
    if (externalMusicLink) window.open(externalMusicLink.href, '_blank', 'noopener,noreferrer');
    else toggleMusic();
  });
  document.querySelector('[data-photo-close]').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () { large.removeAttribute('src'); });
  var shareStatus = document.querySelector('[data-share-status]');
  var shareUrl = document.body.dataset.shareUrl || window.location.href;
  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (shareStatus) shareStatus.textContent = 'Link copiado. Cole na conversa ou no Instagram.';
    } catch (_) {
      if (shareStatus) shareStatus.textContent = 'Copie este link: ' + shareUrl;
    }
  }
  var shareButton = document.querySelector('[data-share-site]');
  if (shareButton) shareButton.addEventListener('click', async function () {
    if (navigator.share) {
      try { await navigator.share({ title: document.title, text: 'Olha este presente especial', url: shareUrl }); }
      catch (error) { if (error.name !== 'AbortError' && shareStatus) shareStatus.textContent = 'Não foi possível abrir o menu de compartilhamento.'; }
    } else await copyShareUrl();
  });
  var instagramButton = document.querySelector('[data-copy-instagram]');
  if (instagramButton) instagramButton.addEventListener('click', copyShareUrl);
  var downloadButton = document.querySelector('[data-download-qr]');
  if (downloadButton) downloadButton.addEventListener('click', function () {
    var qr = document.querySelector('[data-gift-qr]');
    var image = new Image();
    image.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = 1000; canvas.height = 1000;
      var context = canvas.getContext('2d');
      context.fillStyle = '#fffaf5'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        if (!blob) { if (shareStatus) shareStatus.textContent = 'Não foi possível gerar o PNG deste QR.'; return; }
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = 'ella-sorriu-qr.png'; link.click();
        setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        if (shareStatus) shareStatus.textContent = 'QR salvo como imagem PNG.';
      }, 'image/png');
    };
    image.onerror = function () { if (shareStatus) shareStatus.textContent = 'Não foi possível carregar o QR para salvar.'; };
    image.src = qr.currentSrc || qr.src;
  });
  document.querySelectorAll('.gift-carousel-section').forEach(function (section) {
    var track = section.querySelector('[data-carousel-track]');
    section.querySelector('[data-carousel-prev]').addEventListener('click', function () {
      track.scrollBy({ left: -track.clientWidth * .82, behavior: 'smooth' });
    });
    section.querySelector('[data-carousel-next]').addEventListener('click', function () {
      track.scrollBy({ left: track.clientWidth * .82, behavior: 'smooth' });
    });
  });
  if (!document.body.classList.contains('gift-site-preview') && 'IntersectionObserver' in window && document.documentElement.dataset.giftMotion !== 'reduce' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -30px 0px', threshold: .08 });
    document.querySelectorAll('.gift-memories, .gift-music, .gift-letters, .gift-carousel-section, .gift-closing')
      .forEach(function (section) { section.classList.add('gift-reveal'); observer.observe(section); });
  }
}());
