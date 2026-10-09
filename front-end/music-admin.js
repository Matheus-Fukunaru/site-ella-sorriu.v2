(function () {
  'use strict';
  var form = document.querySelector('[data-music-upload]');
  if (!form) return;
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    var status = form.querySelector('[data-music-upload-status]'), button = form.querySelector('button');
    var file = form.elements.audio.files[0];
    if (!file || file.size > 8 * 1024 * 1024) { status.textContent = 'Escolha um áudio de até 8 MB.'; return; }
    button.disabled = true; status.textContent = 'Enviando a música…';
    try {
      var response = await fetch('/admin/music/upload', { method: 'POST', headers: {
        'Content-Type': 'application/octet-stream', 'X-CSRF-Token': form.elements._csrf.value,
        'X-Track-Title': encodeURIComponent(form.elements.title.value), 'X-Track-Artist': encodeURIComponent(form.elements.artist.value),
        'X-Track-Genre': encodeURIComponent(form.elements.genre.value), 'X-Track-Authorized': form.elements.authorized.checked ? 'yes' : 'no'
      }, body: file });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.success) throw new Error(data.message || 'Não foi possível cadastrar. Confira sua sessão e tente novamente.');
      window.location.assign('/admin/music?saved=1');
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
  document.querySelectorAll('audio').forEach(function (player) {
    player.addEventListener('play', function () { document.querySelectorAll('audio').forEach(function (other) { if (other !== player) other.pause(); }); });
  });
}());
