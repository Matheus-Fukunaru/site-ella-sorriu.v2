(function () {
  'use strict';
  var form = document.querySelector('[data-gift-builder-form]');
  if (!form) return;
  var preview = document.querySelector('[data-gift-preview]');
  var previewArt = document.querySelector('[data-preview-art]');
  var occasionArtCache = new Map();
  var requestedArt = '';
  function updateOccasionArt(occasion) {
    if (!previewArt || requestedArt === occasion) return;
    requestedArt = occasion;
    previewArt.replaceChildren();
    if (!occasionArtCache.has(occasion)) {
      occasionArtCache.set(occasion, fetch('/api/gift-sites/occasion-art?v=55&occasion=' + encodeURIComponent(occasion))
        .then(function (response) {
          if (!response.ok) throw new Error('Ilustração indisponível');
          return response.text();
        }).catch(function (error) { occasionArtCache.delete(occasion); throw error; }));
    }
    occasionArtCache.get(occasion).then(function (html) {
      if (requestedArt !== occasion) return;
      var art = new DOMParser().parseFromString(html, 'text/html').querySelector('.gift-themed-art');
      if (art) previewArt.replaceChildren(art);
    }).catch(function () { if (requestedArt === occasion) requestedArt = ''; });
  }
  var feedback = document.querySelector('[data-gift-feedback]');
  var result = document.querySelector('[data-gift-result]');
  var slugState = document.querySelector('[data-slug-state]');
  var photoList = document.querySelector('[data-gift-photo-list]');
  var carouselsWrap = document.querySelector('[data-gift-carousels]');
  var phoneDialog = document.querySelector('[data-phone-dialog]');
  var phoneFrame = document.querySelector('[data-phone-iframe]');
  var previewGallery = document.querySelector('[data-preview-gallery]');
  var photoCount = document.querySelector('[data-photo-count]');
  var carouselCount = document.querySelector('[data-carousel-count]');
  var allPhotoMusic = document.querySelector('[data-all-photo-music]');
  var newPhotoMusic = false;
  var libraryTracks = [], libraryGenre = '', libraryPlaying = '';
  var libraryPlayer = document.querySelector('[data-library-player]');
  var libraryList = document.querySelector('[data-library-list]');
  var libraryStatus = document.querySelector('[data-library-status]');
  var musicPickerToggle = document.querySelector('[data-music-picker-toggle]');
  var musicLibraryPanel = document.querySelector('[data-music-library-panel]');
  var photos = [], carousels = [], musicUrl = '', musicFilename = '', extraLetters = 0, pending = 0, slugTimer, slugAvailable = false, phoneRefreshTimer, phoneRequestId = 0;
  function field(name) { return form.elements[name]; }
  function value(name) { return field(name) ? field(name).value : ''; }
  function checked(name) { var input = form.querySelector('input[name="' + name + '"]:checked'); return input ? input.value : ''; }
  function node(tag, className, text) { var el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
  function message(text, type) { feedback.textContent = text || ''; feedback.className = 'gift-builder-feedback' + (type ? ' is-' + type : ''); }
  function payload() {
    return { recipientName: value('recipientName'), senderName: value('senderName'), occasion: value('occasion'), personStyle: value('personStyle'),
      slug: value('slug'), photoUrl: value('photoUrl'), style: checked('style'), theme: value('theme'),
      reducedMotion: false, smoothReading: true, fontStyle: 'classic',
      letterOne: value('letterOne'), letterTwo: value('letterTwo'), letterThree: value('letterThree'),
      letters: [value('letterOne'), value('letterTwo'), value('letterThree')].concat(Array.from(form.querySelectorAll('[data-extra-letter]')).map(function (input) { return input.value; })),
      extraNote: value('extraNote'), showTitle: Boolean(field('showTitle') && field('showTitle').checked), pageTitle: value('pageTitle'),
      photos: photos, carousels: carousels, musicUrl: musicUrl,
      musicTitle: value('musicTitle'), photoLayout: value('photoLayout') };
  }
  function updatePreview() {
    syncAllPhotoMusic();
    syncLibrarySelection();
    preview.dataset.style = checked('style') || 'ella';
    preview.dataset.occasion = value('occasion');
    updateOccasionArt(value('occasion'));
    preview.dataset.personStyle = value('personStyle') || 'neutral';
    preview.dataset.font = 'classic';
    var occasionLines = {
      'Aniversário': 'Hoje é o seu dia',
      'Namoro': 'Nossa história',
      'Casamento': 'O nosso sim',
      'Amizade': 'Pela nossa amizade',
      'Dia das Mães': 'Um carinho para mãe',
      'Dia dos Pais': 'Um presente com presença',
      'Dia das Crianças': 'Pequenas alegrias',
      'Agradecimento': 'Com gratidão',
      'Formatura': 'Você chegou até aqui',
      'Natal': 'Um carinho de Natal',
      'Dia dos Namorados': 'Para nós dois',
      'Páscoa': 'Um carinho nesta Páscoa',
      'Bodas': 'A nossa história',
      'Boa sorte': 'Vai dar certo',
      'Novo emprego': 'Uma nova fase'
    };
    preview.querySelector('.gift-preview-kicker').textContent = occasionLines[value('occasion')] || 'Um presente feito para você';
    var titleEnabled = !field('showTitle') || field('showTitle').checked;
    var customTitle = value('pageTitle').trim();
    if (field('pageTitle')) field('pageTitle').disabled = !titleEnabled;
    var titleField = document.querySelector('[data-page-title-field]');
    if (titleField) titleField.classList.toggle('is-disabled', !titleEnabled);
    preview.querySelector('[data-preview-title]').hidden = !titleEnabled;
    preview.querySelector('[data-preview-title-prefix]').hidden = Boolean(customTitle);
    preview.querySelector('[data-preview-recipient]').textContent = customTitle || value('recipientName').trim() || 'alguém especial';
    preview.querySelector('[data-preview-sender]').textContent = 'Com carinho, ' + (value('senderName').trim() || 'você');
    preview.querySelector('[data-preview-letter-one]').textContent = value('letterOne').trim() || 'Escreva sua primeira cartinha e ela aparecerá aqui.';
    preview.querySelector('[data-preview-letter-two]').textContent = value('letterTwo').trim() || 'A segunda mensagem fica logo abaixo.';
    var third = value('letterThree').trim();
    preview.querySelector('[data-preview-letter-three]').textContent = third;
    preview.querySelector('[data-preview-letter-three-wrap]').hidden = !third;
    preview.querySelectorAll('.gift-preview-extra-letter').forEach(function (card) { card.remove(); });
    Array.from(form.querySelectorAll('[data-extra-letter]')).forEach(function (input, index) {
      if (!input.value.trim()) return;
      var card = node('article', 'gift-preview-extra-letter');
      card.append(node('small', '', String(index + 4).padStart(2, '0')), node('p', '', input.value.trim()));
      preview.querySelector('.gift-preview-letters').append(card);
    });
    var photo = photos.length ? photos[0].url : value('photoUrl');
    var photoWrap = preview.querySelector('[data-preview-photo]');
    photoWrap.classList.toggle('has-image', Boolean(photo));
    photoWrap.style.backgroundImage = photo ? 'url("' + photo + '")' : '';
    previewGallery.replaceChildren();
    photos.forEach(function (item, index) {
      var image = node('img'); image.src = item.url;
      image.alt = item.description || 'Foto escolhida ' + (index + 1);
      image.loading = 'lazy'; previewGallery.append(image);
    });
    photoCount.textContent = photos.length ? photos.length + (photos.length === 1 ? ' foto escolhida' : ' fotos escolhidas') + ' · até 10 fotos' : 'Nenhuma foto escolhida · até 10 fotos';
    var media = [photos.length + (photos.length === 1 ? ' foto' : ' fotos')];
    media.push(musicUrl ? '♪ ' + (value('musicTitle').trim() || musicFilename || 'Música escolhida') : 'música pendente');
    if (carousels.length) media.push(carousels.length + (carousels.length === 1 ? ' carrossel' : ' carrosséis'));
    preview.querySelector('[data-preview-media]').textContent = media.join(' · ');
    preview.querySelector('.gift-preview-qr').src = '/api/gift-sites/qr-sample/classic?v=54';
    var theme = value('theme') === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-gift-builder-theme', theme);
    document.documentElement.setAttribute('data-gift-motion', 'smooth');
    try { localStorage.setItem('ella_sorriu_public_theme', theme); } catch (_) { /* preferência visual */ }
    form.querySelectorAll('.gift-choice').forEach(function (label) {
      label.classList.toggle('is-selected', label.querySelector('input').checked);
    });
  }
  function checkSlug() {
    var slug = value('slug').trim();
    slugAvailable = false; clearTimeout(slugTimer);
    if (slug.length < 3) { slugState.textContent = 'Digite para verificar'; slugState.className = 'gift-slug-state'; return; }
    slugState.textContent = 'Verificando…';
    slugTimer = setTimeout(function () {
      fetch('/api/gift-sites/slug-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: slug }) })
        .then(function (r) { return r.json(); }).then(function (data) {
          if (slug !== value('slug').trim()) return;
          slugAvailable = Boolean(data.available);
          slugState.textContent = slugAvailable ? 'Disponível ✓' : 'Indisponível';
          slugState.className = 'gift-slug-state ' + (slugAvailable ? 'is-available' : 'is-unavailable');
        }).catch(function () { slugState.textContent = 'Não foi possível verificar agora'; });
    }, 300);
  }
  function syncLibrarySelection() {
    if (!libraryList) return;
    libraryList.querySelectorAll('[data-track-url]').forEach(function (button) {
      var selected = button.dataset.trackUrl === musicUrl;
      button.textContent = selected ? 'Selecionada ✓' : 'Escolher';
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  function searchText(text) { return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function renderLibrary() {
    var query = searchText(document.querySelector('[data-library-search]').value.trim());
    var tracks = libraryTracks.filter(function (track) { return (!libraryGenre || track.genre === libraryGenre) && searchText(track.title + ' ' + track.artist).includes(query); });
    libraryList.replaceChildren();
    libraryStatus.textContent = !libraryTracks.length ? 'A biblioteca está sendo preparada. Por enquanto, você pode enviar seu áudio ou usar um link abaixo.'
      : !tracks.length ? 'Nenhuma música encontrada. Tente outro nome ou estilo.' : tracks.length + (tracks.length === 1 ? ' música disponível' : ' músicas disponíveis');
    tracks.forEach(function (track) {
      var card = node('article', 'music-track'), copy = node('div'), actions = node('div', 'music-track-actions');
      copy.append(node('strong', '', track.title), node('small', '', track.artist + ' · ' + track.genre));
      var listen = node('button', '', 'Ouvir'), choose = node('button', '', 'Escolher');
      listen.type = choose.type = 'button'; listen.dataset.listenUrl = track.url; choose.dataset.trackUrl = track.url;
      listen.setAttribute('aria-label', 'Ouvir ' + track.title + ', ' + track.artist);
      choose.setAttribute('aria-label', 'Escolher ' + track.title + ', ' + track.artist);
      listen.addEventListener('click', function () {
        if (libraryPlaying === track.url && !libraryPlayer.paused) { libraryPlayer.pause(); return; }
        document.querySelector('[data-music-preview]').pause();
        libraryPlaying = track.url; libraryPlayer.src = track.url; libraryPlayer.hidden = false;
        libraryPlayer.setAttribute('aria-label', 'Ouvir ' + track.title);
        libraryPlayer.play().catch(function () { libraryStatus.textContent = 'Não foi possível tocar esta música. Tente novamente.'; });
      });
      choose.addEventListener('click', function () {
        libraryPlayer.pause(); musicUrl = track.url; musicFilename = track.title;
        field('musicLink').value = ''; field('musicTitle').value = track.title + ' — ' + track.artist;
        var player = document.querySelector('[data-music-preview]'); player.pause(); player.src = track.url; player.hidden = false;
        document.querySelector('[data-music-state]').textContent = 'Música escolhida: ' + track.title + ' — ' + track.artist + '. Pronta para o seu site.';
        updatePreview(); schedulePhoneRefresh();
      });
      actions.append(listen, choose); card.append(copy, actions); libraryList.append(card);
    });
    syncLibrarySelection(); syncLibraryPlayback();
  }
  function syncLibraryPlayback() {
    libraryList.querySelectorAll('[data-listen-url]').forEach(function (button) {
      var playing = button.dataset.listenUrl === libraryPlaying && !libraryPlayer.paused;
      button.textContent = playing ? 'Pausar' : 'Ouvir'; button.setAttribute('aria-pressed', String(playing));
    });
  }
  if (musicPickerToggle && musicLibraryPanel) {
    musicPickerToggle.addEventListener('click', function () {
      var open = musicLibraryPanel.hidden;
      musicLibraryPanel.hidden = !open;
      musicPickerToggle.setAttribute('aria-expanded', String(open));
      musicPickerToggle.textContent = open ? '× Fechar músicas' : '♫ Escolher música';
      if (open) document.querySelector('[data-library-search]').focus();
    });
  }
  if (libraryPlayer) ['play', 'pause', 'ended'].forEach(function (event) { libraryPlayer.addEventListener(event, syncLibraryPlayback); });
  if (libraryPlayer) document.querySelector('[data-music-preview]').addEventListener('play', function () { libraryPlayer.pause(); });
  if (document.querySelector('[data-library-search]')) document.querySelector('[data-library-search]').addEventListener('input', renderLibrary);
  fetch('/api/music-library').then(function (response) { if (!response.ok) throw new Error(); return response.json(); }).then(function (catalog) {
    libraryTracks = catalog.tracks;
    ['Todos'].concat(catalog.genres).forEach(function (genre, index) {
      var button = node('button', '', genre); button.type = 'button'; button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', function () {
        libraryGenre = index === 0 ? '' : genre;
        document.querySelectorAll('[data-library-filters] button').forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); });
        renderLibrary();
      });
      document.querySelector('[data-library-filters]').append(button);
    });
    renderLibrary();
  }).catch(function () { libraryStatus.textContent = 'A biblioteca está indisponível no momento. Você ainda pode enviar seu áudio ou usar um link abaixo.'; });
  function loadImageForResize(file) {
    if (typeof window.createImageBitmap === 'function') {
      return window.createImageBitmap(file).then(function (bitmap) {
        return { image: bitmap, width: bitmap.width, height: bitmap.height, release: function () { bitmap.close(); } };
      }).catch(function () { return loadImageElement(file); });
    }
    return loadImageElement(file);
  }
  function loadImageElement(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), image = new Image();
      image.onload = function () {
        resolve({ image: image, width: image.naturalWidth, height: image.naturalHeight,
          release: function () { URL.revokeObjectURL(url); } });
      };
      image.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler esta foto. Escolha outra imagem.')); };
      image.src = url;
    });
  }
  function imageBlob(canvas, type, quality) {
    return new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
  }
  async function shrinkImage(file) {
    if (file.size <= 1024 * 1024) return file;
    var source = await loadImageForResize(file);
    try {
      var canvas = document.createElement('canvas');
      for (var maxSide of [1200, 1000, 800]) {
        var scale = Math.min(1, maxSide / Math.max(source.width, source.height));
        canvas.width = Math.max(1, Math.round(source.width * scale));
        canvas.height = Math.max(1, Math.round(source.height * scale));
        canvas.getContext('2d').drawImage(source.image, 0, 0, canvas.width, canvas.height);
        var webp = await imageBlob(canvas, 'image/webp', .7);
        if (webp && webp.type === 'image/webp' && webp.size <= 1024 * 1024) return webp;
        var jpeg = await imageBlob(canvas, 'image/jpeg', .68);
        if (jpeg && jpeg.size <= 1024 * 1024) return jpeg;
      }
      throw new Error('Não foi possível reduzir esta foto para 1 MB. Escolha outra imagem.');
    } finally { source.release(); }
  }
  async function upload(file, type, source) {
    var isVideoAudio = type === 'audio' && source === 'video';
    pending += 1; message(isVideoAudio ? 'Extraindo a música do vídeo…' : 'Enviando ' + (type === 'image' ? 'foto' : 'música') + '…');
    try {
      var content = type === 'image' ? await shrinkImage(file) : file;
      var limit = type === 'image' ? 1024 * 1024 : (isVideoAudio ? 70 * 1024 * 1024 : 8 * 1024 * 1024);
      if (!content || content.size > limit)
        throw new Error(type === 'image' ? 'A foto precisa ter até 1 MB após a otimização.' : (isVideoAudio ? 'O vídeo precisa ter até 70 MB.' : 'A música precisa ter até 8 MB.'));
      var response = await fetch('/api/gift-sites/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Gift-Media-Type': type, 'X-Gift-Media-Source': source || type },
        body: content
      });
      var data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Não foi possível enviar o arquivo.');
      return data.url;
    } finally { pending -= 1; }
  }
  function renderPhotos(items, container) {
    container.replaceChildren();
    items.forEach(function (photo, index) {
      var row = node('div', 'gift-photo-row'), image = node('img'), fields = node('div', 'gift-photo-fields');
      image.src = photo.url; image.alt = 'Foto ' + (index + 1);
      [['Descrição da foto', 'description', 240], ['Algo mais ao tocar na foto (opcional)', 'note', 200]].forEach(function (detail) {
        var label = node('label', '', detail[0]), input = node('input');
        input.maxLength = detail[2]; input.value = photo[detail[1]]; input.placeholder = detail[1] === 'note' ? 'Uma lembrança especial...' : 'O que esta foto conta?';
        input.addEventListener('input', function () { photo[detail[1]] = input.value; updatePreview(); }); label.append(input); fields.append(label);
      });
      var play = node('label', 'gift-photo-play'), checkbox = node('input');
      checkbox.type = 'checkbox'; checkbox.checked = photo.playMusic;
      checkbox.addEventListener('change', function () { photo.playMusic = checkbox.checked; updatePreview(); schedulePhoneRefresh(); });
      play.append(checkbox, document.createTextNode('Mostrar botão de música ao abrir esta foto'));
      var actions = node('div', 'gift-photo-actions');
      [['Subir', index - 1], ['Descer', index + 1]].forEach(function (choice) {
        var move = node('button', 'gift-text-action', choice[0]); move.type = 'button';
        move.disabled = choice[1] < 0 || choice[1] >= items.length;
        move.setAttribute('aria-label', 'Mover foto ' + (index + 1) + ' para ' + (choice[0] === 'Subir' ? 'cima' : 'baixo'));
        move.addEventListener('click', function () {
          [items[index], items[choice[1]]] = [items[choice[1]], items[index]];
          renderPhotos(items, container); updatePreview(); schedulePhoneRefresh();
        });
        actions.append(move);
      });
      var remove = node('button', 'gift-text-action', 'Remover foto'); remove.type = 'button';
      remove.addEventListener('click', function () { items.splice(index, 1); renderPhotos(items, container); updatePreview(); schedulePhoneRefresh(); });
      actions.append(remove); fields.append(play, actions); row.append(image, fields); container.append(row);
    });
  }
  async function addPhotos(files, items, max, container) {
    var selected = Array.from(files);
    if (items.length + selected.length > max) throw new Error('Este grupo aceita até ' + max + ' fotos.');
    for (var file of selected) {
      items.push({ url: await upload(file, 'image'), description: '', note: '', playMusic: newPhotoMusic });
      renderPhotos(items, container); updatePreview();
    }
    updatePreview(); schedulePhoneRefresh(); message('Fotos adicionadas.', 'success');
  }
  function renderCarousels() {
    carouselsWrap.replaceChildren();
    carouselCount.textContent = carousels.length ? carousels.length + (carousels.length === 1 ? ' carrossel adicionado' : ' carrosséis adicionados') + ' · até 10 fotos em cada um.' : 'Adicione até dois carrosséis, com até dez fotos em cada um.';
    carousels.forEach(function (carousel, index) {
      var block = node('div', 'gift-carousel-block'), heading = node('div', 'gift-carousel-head');
      heading.append(node('h4', '', 'Carrossel ' + (index + 1)));
      var remove = node('button', 'gift-text-action', 'Remover carrossel'); remove.type = 'button';
      remove.addEventListener('click', function () { carousels.splice(index, 1); renderCarousels(); updatePreview(); schedulePhoneRefresh(); }); heading.append(remove);
      var title = node('label', '', 'Título'), input = node('input');
      input.maxLength = 80; input.placeholder = 'Ex.: Nossos momentos'; input.value = carousel.title;
      input.addEventListener('input', function () { carousel.title = input.value; updatePreview(); schedulePhoneRefresh(); }); title.append(input);
      var picker = node('label', 'gift-upload-label', 'Fotos do carrossel (até 10)'), files = node('input'), list = node('div', 'gift-photo-editor');
      files.type = 'file'; files.accept = 'image/jpeg,image/png,image/webp'; files.multiple = true;
      files.addEventListener('change', async function () {
        try { await addPhotos(files.files, carousel.photos, 10, list); } catch (error) { message(error.message, 'error'); }
        files.value = '';
      });
      picker.append(files); block.append(heading, title, picker, list); carouselsWrap.append(block); renderPhotos(carousel.photos, list);
    });
    updatePreview(); schedulePhoneRefresh();
  }
  function syncAllPhotoMusic() {
    var all = photos.concat(carousels.flatMap(function (carousel) { return carousel.photos; }));
    var selected = all.filter(function (photo) { return photo.playMusic; }).length;
    allPhotoMusic.checked = all.length ? selected === all.length : newPhotoMusic;
    allPhotoMusic.indeterminate = selected > 0 && selected < all.length;
  }
  allPhotoMusic.addEventListener('input', function () {
    newPhotoMusic = allPhotoMusic.checked;
    photos.concat(carousels.flatMap(function (carousel) { return carousel.photos; })).forEach(function (photo) { photo.playMusic = newPhotoMusic; });
    renderPhotos(photos, photoList); renderCarousels(); updatePreview(); schedulePhoneRefresh();
  });
  document.querySelector('[data-gift-photos]').addEventListener('change', async function () {
    try { await addPhotos(this.files, photos, 10, photoList); } catch (error) { message(error.message, 'error'); }
    this.value = '';
  });
  document.querySelector('[data-gift-music]').addEventListener('change', async function () {
    if (!this.files.length) return;
    try {
      var selectedFile = this.files[0];
      var isVideo = selectedFile.type.indexOf('video/') === 0;
      var usedServerExtraction = false;
      var audioFile = selectedFile;
      if (isVideo) {
        try { audioFile = await extractVideoAudio(selectedFile); }
        catch (_) { usedServerExtraction = true; audioFile = selectedFile; }
      }
      musicUrl = await upload(audioFile, 'audio', usedServerExtraction ? 'video' : 'audio');
      musicFilename = selectedFile.name;
      var player = document.querySelector('[data-music-preview]');
      player.src = musicUrl; player.hidden = false;
      document.querySelector('[data-music-link]').value = '';
      document.querySelector('[data-music-state]').textContent = isVideo
        ? 'Música extraída do vídeo e pronta. A reprodução começa somente após a interação da pessoa.'
        : 'Música pronta: ' + selectedFile.name + '. Ela toca somente após a interação da pessoa.';
      updatePreview(); schedulePhoneRefresh(); message('Música adicionada.', 'success');
    } catch (error) { message(error.message, 'error'); }
    this.value = '';
  });
  async function extractVideoAudio(file) {
    var AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType || !window.MediaRecorder) throw new Error('Este navegador não consegue extrair áudio do vídeo. Cole um link da música/vídeo ou envie um arquivo de áudio.');
    var context = new AudioContextType();
    var objectUrl = URL.createObjectURL(file);
    var video = document.createElement('video');
    video.preload = 'auto'; video.playsInline = true; video.src = objectUrl;
    try {
      await new Promise(function (resolve, reject) {
        video.onloadedmetadata = resolve;
        video.onerror = function () { reject(new Error('Não foi possível abrir este vídeo. Envie MP4 ou WebM com áudio.')); };
      });
      if (!video.duration || video.duration > 600) throw new Error('Para extrair a trilha, o vídeo precisa ter até 10 minutos.');
      var source = context.createMediaElementSource(video);
      var destination = context.createMediaStreamDestination();
      source.connect(destination);
      await context.resume();
      if (!destination.stream.getAudioTracks().length) throw new Error('Este vídeo não tem trilha de áudio.');
      var mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find(function (type) { return MediaRecorder.isTypeSupported(type); });
      if (!mime) throw new Error('Este navegador não oferece gravação de áudio extraído. Use um link ou envie áudio.');
      var recorder = new MediaRecorder(destination.stream, { mimeType: mime });
      var chunks = [];
      var finished = new Promise(function (resolve, reject) {
        recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onerror = function () { reject(new Error('Falha ao extrair o áudio. Tente outro vídeo ou envie a música diretamente.')); };
        recorder.onstop = function () {
          var blob = new Blob(chunks, { type: mime.split(';')[0] });
          if (blob.size > 8 * 1024 * 1024) reject(new Error('O áudio extraído passou de 8 MB. Envie um vídeo menor ou cole um link.'));
          else resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webm', { type: mime.split(';')[0] }));
        };
      });
      recorder.start(1000);
      await video.play();
      await new Promise(function (resolve, reject) {
        video.onended = resolve;
        video.onerror = function () { reject(new Error('A leitura do vídeo foi interrompida.')); };
      });
      recorder.stop();
      return await finished;
    } finally {
      video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(objectUrl);
      await context.close().catch(function () {});
    }
  }
  document.querySelector('[data-music-link]').addEventListener('input', function () {
    var link = this.value.trim();
    musicUrl = link;
    musicFilename = '';
    var player = document.querySelector('[data-music-preview]');
    player.pause(); player.removeAttribute('src'); player.hidden = true;
    document.querySelector('[data-music-state]').textContent = link ? 'Link selecionado. Se for vídeo ou streaming, o botão abre o serviço escolhido.' : 'Escolha um arquivo, envie um vídeo para extrair a música ou cole um link HTTPS.';
    updatePreview(); schedulePhoneRefresh();
  });
  function searchMusic(provider) {
    var query = document.querySelector('[data-song-search]').value.trim();
    if (!query) { message('Digite o nome da música ou artista para buscar.', 'error'); return; }
    var url = provider === 'youtube'
      ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query)
      : 'https://open.spotify.com/search/' + encodeURIComponent(query);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  async function importMusicLink() {
    var linkInput = document.querySelector('[data-music-link]');
    var link = linkInput.value.trim();
    if (!link) { message('Cole um link HTTPS direto de áudio ou vídeo antes de importar.', 'error'); linkInput.focus(); return; }
    if (/youtube\.com|youtu\.be|spotify\.com/i.test(link)) {
      musicUrl = link;
      musicFilename = '';
      document.querySelector('[data-music-state]').textContent = 'YouTube e Spotify ficam como link externo. Para tocar dentro do site, envie o áudio/vídeo ou use um link direto de mídia.';
      updatePreview(); schedulePhoneRefresh();
      return;
    }
    pending += 1; message('Importando o link e cortando em até 1min30s…');
    try {
      var response = await fetch('/api/gift-sites/media/import-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link })
      });
      var data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Não foi possível importar esse link.');
      musicUrl = data.url; musicFilename = 'Música importada';
      linkInput.value = '';
      var player = document.querySelector('[data-music-preview]');
      player.src = musicUrl; player.hidden = false;
      document.querySelector('[data-music-state]').textContent = 'Link importado e salvo como áudio interno de até 1min30s.';
      updatePreview(); schedulePhoneRefresh(); message('Música importada.', 'success');
    } catch (error) { message(error.message, 'error'); }
    finally { pending -= 1; }
  }
  document.querySelector('[data-search-youtube]').addEventListener('click', function () { searchMusic('youtube'); });
  document.querySelector('[data-search-spotify]').addEventListener('click', function () { searchMusic('spotify'); });
  document.querySelector('[data-import-music-link]').addEventListener('click', importMusicLink);
  document.querySelector('[data-add-letter]').addEventListener('click', function () {
    if (extraLetters >= 5) return message('Você pode escrever até oito cartinhas.', 'error');
    extraLetters += 1;
    var label = node('label', '', 'Cartinha extra ' + extraLetters);
    var textarea = node('textarea');
    textarea.dataset.extraLetter = 'true'; textarea.maxLength = 1800; textarea.placeholder = 'Mais uma lembrança para guardar...';
    var remove = node('button', 'gift-text-action', 'Remover cartinha'); remove.type = 'button';
    remove.addEventListener('click', function () {
      label.remove(); extraLetters -= 1;
      document.querySelectorAll('[data-extra-letters] label').forEach(function (item, index) { item.firstChild.textContent = 'Cartinha extra ' + (index + 1); });
      document.querySelector('[data-add-letter]').disabled = false; updatePreview(); schedulePhoneRefresh();
    });
    label.append(textarea, remove); document.querySelector('[data-extra-letters]').append(label);
    textarea.focus(); updatePreview(); schedulePhoneRefresh();
    if (extraLetters >= 5) this.disabled = true;
  });
  document.querySelector('[data-add-carousel]').addEventListener('click', function () {
    if (carousels.length >= 2) return message('Você pode adicionar até dois carrosséis.', 'error');
    carousels.push({ title: '', photos: [] }); renderCarousels();
  });
  async function refreshPhone() {
    if (pending) return message('Aguarde o envio dos arquivos antes de abrir a prévia.', 'error');
    var requestId = ++phoneRequestId;
    phoneFrame.srcdoc = '<p style="font-family:sans-serif;padding:24px">Preparando a prévia…</p>';
    try {
      var previewPayload = payload();
      if (musicUrl) previewPayload.musicUrl = musicUrl;
      var response = await fetch('/api/gift-sites/preview-html', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(previewPayload)
      });
      if (!response.ok) { var failure = await response.json(); throw new Error(failure.message || 'Não foi possível gerar a prévia.'); }
      var html = await response.text();
      if (phoneDialog.open && requestId === phoneRequestId) phoneFrame.srcdoc = html;
    } catch (error) {
      if (phoneDialog.open && requestId === phoneRequestId) {
        phoneFrame.srcdoc = '<!doctype html><meta charset="utf-8"><style>body{font:16px Manrope,Arial,sans-serif;padding:28px;color:#34252b;background:#f4eee7;line-height:1.6}strong{color:#842b49}</style><strong>A prévia não carregou.</strong><p>' + String(error.message || 'Tente atualizar.').replace(/[&<>"]/g, function (ch) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]; }) + '</p>';
        message(error.message, 'error');
      }
    }
  }
  function schedulePhoneRefresh() {
    if (!phoneDialog.open) return;
    clearTimeout(phoneRefreshTimer);
    phoneRefreshTimer = setTimeout(refreshPhone, 280);
  }
  function openPhone() { phoneDialog.showModal(); refreshPhone(); }
  document.querySelectorAll('[data-open-phone]').forEach(function (button) { button.addEventListener('click', openPhone); });
  document.querySelector('[data-refresh-phone]').addEventListener('click', refreshPhone);
  document.querySelector('[data-close-phone]').addEventListener('click', function () { phoneDialog.close(); });
  preview.addEventListener('click', openPhone);
  preview.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPhone(); } });
  phoneDialog.addEventListener('click', function (event) { if (event.target === phoneDialog) phoneDialog.close(); });
  phoneDialog.addEventListener('close', function () { phoneFrame.srcdoc = '<!doctype html><meta charset="utf-8">'; });
  form.addEventListener('input', function (event) { if (event.target.name === 'slug') checkSlug(); updatePreview(); schedulePhoneRefresh(); });
  form.addEventListener('change', function () { updatePreview(); schedulePhoneRefresh(); });
  form.addEventListener('submit', async function (event) {
    event.preventDefault(); message('');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    if (pending) return message('Aguarde o envio das fotos e da música.', 'error');
    if (!musicUrl) { message('Escolha uma música para acompanhar o site.', 'error'); document.querySelector('[data-gift-music]').focus(); return; }
    if (!slugAvailable) { message('Escolha uma URL disponível antes de continuar.', 'error'); field('slug').focus(); return; }
    message('Criando o seu site…');
    try {
      var response = await fetch('/api/gift-sites/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload())
      });
      var data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Não foi possível criar o site.');
      result.replaceChildren(); result.hidden = false;
      result.append(node('p', 'kicker', 'Pronto para testar'), node('h2', '', 'Seu site foi criado.'), node('p', '', data.message));
      var link = node('a', '', 'Abrir o site ↗');
      link.href = data.url; link.target = '_blank'; link.rel = 'noopener';
      result.append(link, node('p', 'gift-form-note', 'URL de teste: ' + data.shareUrl));
      message('Site criado com sucesso.', 'success');
      result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) { message(error.message, 'error'); }
  });
  updatePreview();
}());
