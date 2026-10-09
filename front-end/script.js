(function () {
  'use strict';

  var publicThemeKey = 'ella_sorriu_public_theme';
  var publicMotionKey = 'ella_sorriu_public_motion';
  var publicContrastKey = 'ella_sorriu_public_contrast';
  var publicTextKey = 'ella_sorriu_public_text';
  var publicThemePreference = 'light';
  var publicMotionPreference = 'normal';
  var publicContrastPreference = 'normal';
  var publicTextPreference = 'normal';
  try {
    var savedPublicTheme = window.localStorage.getItem(publicThemeKey);
    if (['light', 'dark'].indexOf(savedPublicTheme) !== -1) publicThemePreference = savedPublicTheme;
    else if (savedPublicTheme === 'system') window.localStorage.setItem(publicThemeKey, 'light');
  } catch (error) { publicThemePreference = 'light'; }
  try {
    if (window.localStorage.getItem(publicMotionKey) === 'reduce') publicMotionPreference = 'reduce';
    if (window.localStorage.getItem(publicContrastKey) === 'high') publicContrastPreference = 'high';
    if (window.localStorage.getItem(publicTextKey) === 'large') publicTextPreference = 'large';
  } catch (error) { /* preferências padrão permanecem ativas */ }

  function applyPublicTheme() {
    document.documentElement.setAttribute('data-public-theme', publicThemePreference);
    document.documentElement.setAttribute('data-public-theme-preference', publicThemePreference);
    document.documentElement.setAttribute('data-public-motion', publicMotionPreference);
    document.documentElement.setAttribute('data-public-contrast', publicContrastPreference);
    document.documentElement.setAttribute('data-public-text', publicTextPreference);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = publicThemePreference === 'dark' ? '#171718' : '#f3eee7';
  }
  function setPublicTheme(value) {
    if (['light', 'dark'].indexOf(value) === -1) return;
    publicThemePreference = value;
    try { window.localStorage.setItem(publicThemeKey, value); } catch (error) { /* preferência visual */ }
    applyPublicTheme();
    document.querySelectorAll('[data-public-theme-option]').forEach(function (button) {
      var active = button.dataset.publicThemeOption === publicThemePreference;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.setAttribute('aria-checked', String(active));
    });
  }
  function setPublicPreference(kind, value) {
    var key;
    if (kind === 'motion' && ['normal', 'reduce'].indexOf(value) !== -1) { publicMotionPreference = value; key = publicMotionKey; }
    if (kind === 'contrast' && ['normal', 'high'].indexOf(value) !== -1) { publicContrastPreference = value; key = publicContrastKey; }
    if (kind === 'text' && ['normal', 'large'].indexOf(value) !== -1) { publicTextPreference = value; key = publicTextKey; }
    if (!key) return;
    try { window.localStorage.setItem(key, value); } catch (error) { /* preferência não sensível */ }
    applyPublicTheme();
  }
  applyPublicTheme();

  if (window.location.protocol === 'file:') {
    var page = /pedido\.html$/i.test(window.location.pathname) ? '/pedido.html' :
      (/produto\.html$/i.test(window.location.pathname) ? '/produto.html' : '/');
    window.location.replace('http://127.0.0.1:3000' + page + window.location.search + window.location.hash);
    return;
  }


  document.documentElement.classList.remove('no-js');

  document.addEventListener('DOMContentLoaded', function () {
    var body = document.body;
    var header = document.querySelector('.site-header');
    var menuButton = document.querySelector('.menu-toggle');
    var menu = document.querySelector('.main-nav');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.querySelectorAll('[data-public-theme-option]').forEach(function (button) {
      button.addEventListener('click', function () { setPublicTheme(button.dataset.publicThemeOption); });
    });
    setPublicTheme(publicThemePreference);
    function bindPublicPreference(selector, kind, selectedValue) {
      var buttons = document.querySelectorAll(selector);
      function sync(value) {
        buttons.forEach(function (button) {
          var active = button.getAttribute(selector.slice(1, -1)) === value;
          button.classList.toggle('active', active);
          button.setAttribute('aria-checked', String(active));
        });
      }
      buttons.forEach(function (button) {
        button.addEventListener('click', function () {
          var value = button.getAttribute(selector.slice(1, -1));
          setPublicPreference(kind, value);
          sync(value);
        });
      });
      sync(selectedValue);
    }
    bindPublicPreference('[data-public-motion-option]', 'motion', publicMotionPreference);
    bindPublicPreference('[data-public-text-option]', 'text', publicTextPreference);
    var contrastControl = document.querySelector('[data-public-contrast-option]');
    if (contrastControl) {
      contrastControl.checked = publicContrastPreference === 'high';
      contrastControl.addEventListener('change', function () { setPublicPreference('contrast', contrastControl.checked ? 'high' : 'normal'); });
    }

    var preferences = document.querySelector('[data-public-preferences]');
    var preferencesOpen = document.querySelector('[data-public-preferences-open]');
    var preferencesClose = preferences && preferences.querySelectorAll('[data-public-preferences-close]');
    var lastPreferenceFocus = null;
    function openPreferences() {
      if (!preferences) return;
      lastPreferenceFocus = document.activeElement;
      preferences.hidden = false;
      document.body.classList.add('public-preferences-open');
      if (header) header.classList.remove('menu-open');
      body.classList.remove('menu-is-open');
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
      window.requestAnimationFrame(function () { preferences.classList.add('is-open'); preferences.querySelector('.public-preferences-close').focus(); });
    }
    function closePreferences() {
      if (!preferences || preferences.hidden) return;
      preferences.classList.remove('is-open');
      document.body.classList.remove('public-preferences-open');
      window.setTimeout(function () { preferences.hidden = true; if (lastPreferenceFocus) lastPreferenceFocus.focus(); }, 220);
    }
    if (preferencesOpen) preferencesOpen.addEventListener('click', openPreferences);
    if (preferencesClose) preferencesClose.forEach(function (button) { button.addEventListener('click', closePreferences); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && preferences && !preferences.hidden) closePreferences();
      if (event.key === 'Tab' && preferences && !preferences.hidden) {
        var focusable = Array.from(preferences.querySelectorAll('.public-preferences-panel button, .public-preferences-panel input')).filter(function (element) { return !element.disabled; });
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        body.classList.add('is-ready');
      });
    });

    function updateHeader() {
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 24);
    }

    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });

    if (menuButton && header) {
      function closeMenu() {
        header.classList.remove('menu-open');
        body.classList.remove('menu-is-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.querySelector('.sr-only').textContent = 'Abrir menu';
      }

      menuButton.addEventListener('click', function () {
        var open = header.classList.toggle('menu-open');
        body.classList.toggle('menu-is-open', open);
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.querySelector('.sr-only').textContent = open ? 'Fechar menu' : 'Abrir menu';
      });

      if (menu) {
        menu.addEventListener('click', function (event) {
          if (!event.target.closest('a')) return;
          closeMenu();
        });
      }

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && header.classList.contains('menu-open')) {
          closeMenu();
          menuButton.focus();
        }
      });

      window.addEventListener('resize', function () {
        if (window.innerWidth > 1050) closeMenu();
      });
    }

    var reveals = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      reveals.forEach(function (element) { observer.observe(element); });
    } else {
      reveals.forEach(function (element) { element.classList.add('is-visible'); });
    }

    var catalogPromise = setupProductCatalog();
    setupProductDetail(catalogPromise);
    catalogPromise.then(function (catalog) { setupOrderForm(catalog); });
  });

  function setupProductCatalog() {
    var filterContainer = document.querySelector('.catalog-categories');
    var productGrid = document.querySelector('[data-product-grid]');
    var title = document.querySelector('[data-catalog-title]');
    return fetch('/api/products', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (catalog) {
        if (!catalog || !Array.isArray(catalog.products)) return null;
        if (filterContainer && productGrid) {
          filterContainer.replaceChildren();
          productGrid.replaceChildren();
          var all = document.createElement('button');
          all.type = 'button'; all.className = 'catalog-category is-active'; all.dataset.catalogFilter = 'all';
          all.setAttribute('aria-pressed', 'true');
          var allImage = document.createElement('span'); allImage.className = 'catalog-category-image';
          var allImg = document.createElement('img'); allImg.src = catalog.products[0] && catalog.products[0].photos[0] || '/imagens/produtos/presente-girassol.jpeg'; allImg.alt = ''; allImg.loading = 'lazy'; allImage.appendChild(allImg);
          var allLabel = document.createElement('span'); allLabel.textContent = 'Todos'; all.append(allImage, allLabel); filterContainer.appendChild(all);
          var grouped = {};
          catalog.products.forEach(function (item) {
            if (!grouped[item.categorySlug]) grouped[item.categorySlug] = { name: item.categoryName, image: item.photos[0] || '', products: [] };
            grouped[item.categorySlug].products.push(item);
            var card = document.createElement('article'); card.className = 'product-card'; card.dataset.productCategory = item.categorySlug;
            var imageLink = document.createElement('a'); imageLink.className = 'product-image'; imageLink.href = '/produto.html?produto=' + encodeURIComponent(item.slug); imageLink.setAttribute('aria-label', 'Ver detalhes de ' + item.name);
            if (item.photos.length) { var image = document.createElement('img'); image.src = item.photos[0]; image.alt = 'Foto de ' + item.name; image.loading = 'lazy'; image.width = 1200; image.height = 1600; imageLink.appendChild(image); }
            else { imageLink.classList.add('product-image-pending'); var pending = document.createElement('span'); pending.textContent = 'Foto em breve'; imageLink.appendChild(pending); }
            var copy = document.createElement('div'); copy.className = 'product-copy';
            var kind = document.createElement('p'); kind.className = 'product-kind'; kind.textContent = item.categoryName;
            var name = document.createElement('h3'); name.textContent = item.name;
            var price = document.createElement('p'); price.className = 'product-price'; price.textContent = item.priceCents == null ? 'Valor sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.priceCents / 100);
            var details = document.createElement('a'); details.className = 'product-link'; details.href = imageLink.href; details.append(document.createTextNode('Ver detalhes ')); var arrow = document.createElement('span'); arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '→'; details.appendChild(arrow);
            copy.append(kind, name, price, details); card.append(imageLink, copy); productGrid.appendChild(card);
          });
          Object.keys(grouped).forEach(function (slug) {
            var group = grouped[slug]; var button = document.createElement('button'); button.type = 'button'; button.className = 'catalog-category'; button.dataset.catalogFilter = slug; button.setAttribute('aria-pressed', 'false');
            var imageWrap = document.createElement('span'); imageWrap.className = 'catalog-category-image';
            var image = document.createElement('img'); image.src = group.image || '/imagens/produtos/presente-girassol.jpeg'; image.alt = ''; image.loading = 'lazy'; imageWrap.appendChild(image);
            var label = document.createElement('span'); label.textContent = group.name; button.append(imageWrap, label); filterContainer.appendChild(button);
          });
          filterContainer.querySelectorAll('[data-catalog-filter]').forEach(function (button) {
            button.addEventListener('click', function () {
              filterContainer.querySelectorAll('[data-catalog-filter]').forEach(function (item) { var active = item === button; item.classList.toggle('is-active', active); item.setAttribute('aria-pressed', String(active)); });
              productGrid.querySelectorAll('[data-product-category]').forEach(function (card) { card.hidden = button.dataset.catalogFilter !== 'all' && card.dataset.productCategory !== button.dataset.catalogFilter; });
              if (title) title.textContent = button.dataset.catalogFilter === 'all' ? 'Todos os presentes' : (grouped[button.dataset.catalogFilter] || {}).name || 'Presentes';
            });
          });
        }
        return catalog;
      }).catch(function () { return null; });
  }

  function fallbackProducts() {
    return {
      'doce-amanhecer': {
        name: 'Doce Amanhecer',
        formValue: 'Doce Amanhecer',
        kind: 'Café da manhã · Personalizado',
        price: 'Valor sob consulta',
        description: 'Uma composição real da Ella Sorriu para começar o dia com afeto. Os detalhes são ajustados durante o atendimento.',
        images: [{ src: '/imagens/produtos/presente-girassol.jpeg', alt: 'Presente personalizado com girassol, caneca e mensagem' }]
      },
      'com-todo-amor': {
        name: 'Com Todo Amor',
        formValue: 'Com Todo Amor',
        kind: 'Romântico',
        price: 'Valor sob consulta',
        description: 'Uma proposta romântica da seleção Ella Sorriu. A composição e as personalizações são combinadas durante o atendimento.',
        images: []
      },
      'momento-especial': {
        name: 'Momento Especial',
        formValue: 'Momento Especial',
        kind: 'Celebração · Flores',
        price: 'Valor sob consulta',
        description: 'Uma composição real da Ella Sorriu para celebrar momentos especiais. Os detalhes são ajustados durante o atendimento.',
        images: [{ src: '/imagens/produtos/cesta-carolina.jpg', alt: 'Box personalizada com orquídea, chocolates e balão de coração roxo' }]
      },
      personalizada: {
        name: 'Monte do seu jeito',
        formValue: 'Quero montar uma cesta personalizada',
        kind: 'Personalizado',
        price: 'Valor sob consulta',
        description: 'Um ponto de partida para criar uma composição personalizada com a identidade de quem vai receber.',
        images: [{ src: '/imagens/produtos/presente-girassol.jpeg', alt: 'Exemplo real de presente personalizado Ella Sorriu' }]
      }
    };
  }

  function setupProductDetail(catalogPromise) {
    var detail = document.querySelector('[data-product-detail]');
    if (!detail) return;
    var products = fallbackProducts();
    var key = new URLSearchParams(window.location.search).get('produto');
    var name = detail.querySelector('[data-product-name]');
    var kind = detail.querySelector('[data-product-kind]');
    var price = detail.querySelector('[data-product-price]');
    var description = detail.querySelector('[data-product-description]');
    var mainImage = detail.querySelector('[data-product-main-image]');
    var productVideo = detail.querySelector('[data-product-video]');
    var pending = detail.querySelector('[data-product-image-pending]');
    var thumbnails = detail.querySelector('[data-product-thumbnails]');
    var orderLink = detail.querySelector('[data-product-order-link]');
    var product3dLink = detail.querySelector('[data-product-3d-link]');
    function renderProduct(product) {
      if (!product) {
        document.title = 'Produto indisponível | Ella Sorriu';
        name.textContent = 'Este produto não está disponível';
        kind.textContent = 'Catálogo Ella Sorriu';
        price.textContent = '';
        description.textContent = 'Volte aos presentes para conhecer as opções publicadas no momento.';
        orderLink.hidden = true;
        mainImage.hidden = true; pending.hidden = true; thumbnails.hidden = true;
        return;
      }
      orderLink.hidden = false;
      document.title = product.name + ' | Ella Sorriu';
      name.textContent = product.name;
      kind.textContent = product.kind;
      price.textContent = product.price;
      description.textContent = product.description || 'Os detalhes desta composição são definidos durante o atendimento.';
      if (productVideo) { productVideo.hidden = !product.videoUrl; productVideo.src = product.videoUrl || ''; }
      orderLink.href = '/pedido.html?produto=' + encodeURIComponent(key || 'doce-amanhecer') + '&cesta=' + encodeURIComponent(product.formValue);
      if (product3dLink) product3dLink.href = '/presente-3d.html?produto=' + encodeURIComponent(key || 'doce-amanhecer');
      thumbnails.replaceChildren();
      if (!product.images.length) {
        mainImage.hidden = true; pending.hidden = false; thumbnails.hidden = true; return;
      }
      function showImage(index) {
        var image = product.images[index];
        mainImage.src = image.src; mainImage.alt = image.alt; mainImage.hidden = false; pending.hidden = true;
        thumbnails.querySelectorAll('button').forEach(function (button, buttonIndex) { var active = buttonIndex === index; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
      }
      if (product.images.length > 1) {
        product.images.forEach(function (image, index) {
          var button = document.createElement('button'); var thumbnail = document.createElement('img');
          button.type = 'button'; button.setAttribute('aria-label', 'Mostrar imagem ' + (index + 1) + ' de ' + product.name); button.setAttribute('aria-pressed', 'false');
          thumbnail.src = image.src; thumbnail.alt = ''; thumbnail.loading = 'lazy'; button.appendChild(thumbnail); button.addEventListener('click', function () { showImage(index); }); thumbnails.appendChild(button);
        });
      } else thumbnails.hidden = true;
      showImage(0);
    }
    Promise.resolve(catalogPromise).then(function (catalog) {
      var product = catalog && catalog.products && catalog.products.find(function (item) { return item.slug === key; });
      if (product) {
        return {
          name: product.name, formValue: product.name, kind: product.categoryName,
          price: product.priceCents == null ? 'Valor sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.priceCents / 100),
          description: product.description,
          images: (product.photos || []).map(function (src) { return { src: src, alt: 'Foto de ' + product.name }; })
          , videoUrl: product.videoUrl || ''
        };
      }
      if (!key) return products['doce-amanhecer'];
      if (!/^[a-z0-9-]{1,80}$/i.test(key)) return null;
      return fetch('/api/products/' + encodeURIComponent(key), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (item) {
          if (!item) return products[key] || null;
          return { name: item.name, formValue: item.name, kind: item.categoryName, price: item.priceCents == null ? 'Valor sob consulta' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.priceCents / 100), description: item.description, images: (item.photos || []).map(function (src) { return { src: src, alt: 'Foto de ' + item.name }; }) };
        }).catch(function () { return products[key] || null; });
    }).then(renderProduct);
  }

  function setupOrderForm(catalog) {
    var form = document.getElementById('order-form');
    if (!form) return;

    var phone = form.elements.whatsapp;
    setupBasketChoice(form, catalog);
    var orderSettings = { minimumLeadDays: 0, autoOpenWhatsapp: true };
    fetch('/api/public-settings', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (settings) {
        if (!settings) return;
        orderSettings = settings;
        var directLink = document.querySelector('[data-main-whatsapp-link]');
        if (directLink && /^55\d{10,11}$/.test(settings.whatsappNumber || '')) {
          directLink.href = 'https://wa.me/' + settings.whatsappNumber + '?text=' + encodeURIComponent('Olá! Gostaria de fazer um pedido.');
        }
        document.dispatchEvent(new CustomEvent('ella-order-settings-loaded', { detail: settings }));
      }).catch(function () { /* valores padrão preservam o formulário */ });
    function nationalPhoneDigits(value) {
      var text = String(value || '');
      var digits = text.replace(/\D/g, '');
      if (/^\s*\+55/.test(text) || (digits.length > 11 && digits.slice(0, 2) === '55')) {
        digits = digits.slice(2);
      }
      return digits.slice(0, 11);
    }

    function maskPhone(value) {
      var digits = nationalPhoneDigits(value);
      if (!digits) return '';
      if (digits.length <= 2) return '+55 (' + digits;
      var local = digits.slice(2);
      var split = digits.length > 10 ? 5 : 4;
      return '+55 (' + digits.slice(0, 2) + ') ' + local.slice(0, split) +
        (local.length > split ? '-' + local.slice(split) : '');
    }
    phone.addEventListener('input', function () {
      var before = phone.value.slice(0, phone.selectionStart);
      var count = nationalPhoneDigits(before).length;
      var atEnd = phone.selectionStart === phone.value.length;
      phone.value = maskPhone(phone.value);
      var pos = phone.value.indexOf('(') + 1;
      while (pos < phone.value.length && count > 0) {
        if (/\d/.test(phone.value[pos])) count--;
        pos++;
      }
      if (atEnd) pos = phone.value.length;
      phone.setSelectionRange(pos, pos);
    });
    phone.addEventListener('keydown', function (event) {
      var pos = phone.selectionStart;
      if (event.key === 'Backspace' && pos === phone.selectionEnd && pos > 0 &&
          /\D/.test(phone.value[pos - 1])) {
        event.preventDefault();
        var start = pos - 1;
        while (start > 0 && /\D/.test(phone.value[start])) start--;
        phone.value = phone.value.slice(0, start) + phone.value.slice(pos);
        phone.setSelectionRange(start, start);
        phone.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    function enhanceSelect(select) {
      var field = select.closest('.field');
      var label = field && field.querySelector('label[for="' + select.id + '"]');
      var wrapper = document.createElement('div');
      var trigger = document.createElement('button');
      var value = document.createElement('span');
      var arrow = document.createElement('span');
      var list = document.createElement('div');
      var optionButtons = [];
      var activeIndex = Math.max(select.selectedIndex, 1);

      wrapper.className = 'custom-select';
      trigger.type = 'button';
      trigger.className = 'custom-select-trigger';
      trigger.id = select.id + '-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', select.id + '-options');
      value.className = 'custom-select-value';
      arrow.className = 'custom-select-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '⌄';
      trigger.append(value, arrow);

      list.className = 'custom-select-options';
      list.id = select.id + '-options';
      list.setAttribute('role', 'listbox');
      list.hidden = true;

      Array.prototype.forEach.call(select.options, function (option, index) {
        if (option.disabled && !option.value) return;
        var optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = 'custom-select-option';
        optionButton.setAttribute('role', 'option');
        optionButton.setAttribute('data-index', String(index));
        optionButton.tabIndex = -1;
        optionButton.textContent = option.textContent;
        optionButton.addEventListener('click', function () {
          choose(index);
        });
        list.appendChild(optionButton);
        optionButtons.push(optionButton);
      });

      select.parentNode.insertBefore(wrapper, select);
      wrapper.append(select, trigger, list);
      select.classList.add('custom-select-native');
      if (label) label.setAttribute('for', trigger.id);

      function sync() {
        var selected = select.options[select.selectedIndex];
        value.textContent = selected ? selected.textContent : 'Selecione uma opção';
        trigger.classList.toggle('is-placeholder', !select.value);
        trigger.setAttribute('aria-label', (label ? label.textContent.trim() + ': ' : '') + value.textContent);
        optionButtons.forEach(function (button) {
          var chosen = Number(button.dataset.index) === select.selectedIndex;
          button.classList.toggle('is-selected', chosen);
          button.setAttribute('aria-selected', String(chosen));
        });
        if (select.value) trigger.classList.remove('is-invalid');
      }

      function focusActive() {
        var button = optionButtons.find(function (item) {
          return Number(item.dataset.index) === activeIndex;
        }) || optionButtons[0];
        if (button) button.focus();
      }

      function open() {
        document.querySelectorAll('.custom-select.is-open').forEach(function (other) {
          if (other !== wrapper) other.querySelector('.custom-select-trigger').click();
        });
        wrapper.classList.add('is-open');
        list.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        activeIndex = select.value ? select.selectedIndex : Number(optionButtons[0].dataset.index);
        window.requestAnimationFrame(focusActive);
      }

      function close(focusTrigger) {
        wrapper.classList.remove('is-open');
        list.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (focusTrigger) trigger.focus();
      }

      function choose(index) {
        select.selectedIndex = index;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
        close(true);
      }

      function move(direction) {
        var current = optionButtons.findIndex(function (item) {
          return Number(item.dataset.index) === activeIndex;
        });
        current = Math.max(0, current);
        current = Math.min(optionButtons.length - 1, Math.max(0, current + direction));
        activeIndex = Number(optionButtons[current].dataset.index);
        focusActive();
      }

      trigger.addEventListener('click', function () {
        if (list.hidden) open(); else close(false);
      });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (list.hidden) open();
          else move(event.key === 'ArrowDown' ? 1 : -1);
        }
      });
      list.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          move(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          activeIndex = Number(optionButtons[event.key === 'Home' ? 0 : optionButtons.length - 1].dataset.index);
          focusActive();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          choose(activeIndex);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          close(true);
        } else if (event.key === 'Tab') {
          close(false);
        }
      });
      document.addEventListener('click', function (event) {
        if (!wrapper.contains(event.target)) close(false);
      });
      select.addEventListener('change', sync);
      select.addEventListener('invalid', function (event) {
        event.preventDefault();
        trigger.classList.add('is-invalid');
        trigger.focus();
      });
      form.addEventListener('reset', function () {
        window.setTimeout(sync, 0);
      });
      sync();
    }

    Array.prototype.forEach.call(form.querySelectorAll('select'), enhanceSelect);

    var feedback = document.getElementById('form-feedback');
    var submitButton = form.querySelector('.order-submit');
    var submitLabel = form.querySelector('.submit-label');
    var friendlyMessages = {
      nome: 'Conte para a gente o seu nome.',
      whatsapp: 'Informe seu WhatsApp com DDD.',
      cesta: 'Escolha uma opção de presente.',
      ocasiao: 'Selecione a ocasião.',
      cidade: 'Informe a cidade da entrega.'
    };

    Object.keys(friendlyMessages).forEach(function (fieldName) {
      var field = form.elements[fieldName];
      if (!field) return;
      field.addEventListener('invalid', function () {
        field.setCustomValidity(friendlyMessages[fieldName]);
      });
      field.addEventListener('input', function () { field.setCustomValidity(''); });
      field.addEventListener('change', function () { field.setCustomValidity(''); });
    });

    var datePicker = form.querySelector('[data-date-picker]');
    var dateField = form.elements.data_desejada;
    if (datePicker && dateField) {
      var dateTrigger = datePicker.querySelector('.date-trigger');
      var dateValue = datePicker.querySelector('.date-value');
      var calendar = datePicker.querySelector('.date-calendar');
      var calendarMonth = datePicker.querySelector('.calendar-month');
      var calendarDays = datePicker.querySelector('.calendar-days');
      var previousMonthButton = datePicker.querySelector('.calendar-prev');
      var nextMonthButton = datePicker.querySelector('.calendar-next');
      var clearDateButton = datePicker.querySelector('.calendar-clear');
      var todayButton = datePicker.querySelector('.calendar-today');
      var today = new Date();
      var minimumDate = new Date();
      var selectedDate = null;
      var displayedMonth;

      today.setHours(0, 0, 0, 0);
      minimumDate.setHours(0, 0, 0, 0);
      displayedMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);

      document.addEventListener('ella-order-settings-loaded', function (event) {
        var days = Math.max(0, Math.min(30, Number(event.detail.minimumLeadDays) || 0));
        minimumDate = new Date(today);
        minimumDate.setDate(minimumDate.getDate() + days);
        displayedMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
        todayButton.hidden = days > 0;
        if (!calendar.hidden) renderCalendar();
      });

      function twoDigits(value) {
        return String(value).padStart(2, '0');
      }

      function toIsoDate(date) {
        return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
      }

      function sameDate(first, second) {
        return first && second &&
          first.getFullYear() === second.getFullYear() &&
          first.getMonth() === second.getMonth() &&
          first.getDate() === second.getDate();
      }

      function renderCalendar() {
        var year = displayedMonth.getFullYear();
        var month = displayedMonth.getMonth();
        var firstWeekday = new Date(year, month, 1).getDay();
        var numberOfDays = new Date(year, month + 1, 0).getDate();
        var firstAllowedMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);

        calendarMonth.textContent = displayedMonth.toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric'
        });
        previousMonthButton.disabled = displayedMonth <= firstAllowedMonth;
        calendarDays.replaceChildren();

        for (var blank = 0; blank < firstWeekday; blank += 1) {
          var spacer = document.createElement('span');
          spacer.className = 'calendar-spacer';
          spacer.setAttribute('aria-hidden', 'true');
          calendarDays.appendChild(spacer);
        }

        for (var day = 1; day <= numberOfDays; day += 1) {
          var date = new Date(year, month, day);
          var dayButton = document.createElement('button');
          dayButton.type = 'button';
          dayButton.className = 'calendar-day';
          dayButton.textContent = String(day);
          dayButton.dataset.date = toIsoDate(date);
          dayButton.setAttribute('role', 'gridcell');
          dayButton.setAttribute('aria-label', date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }));
          dayButton.disabled = date < minimumDate;

          if (sameDate(date, today)) dayButton.classList.add('is-today');
          if (sameDate(date, selectedDate)) {
            dayButton.classList.add('is-selected');
            dayButton.setAttribute('aria-selected', 'true');
          }

          calendarDays.appendChild(dayButton);
        }
      }

      function openCalendar() {
        calendar.hidden = false;
        dateTrigger.setAttribute('aria-expanded', 'true');
        renderCalendar();
      }

      function closeCalendar() {
        calendar.hidden = true;
        dateTrigger.setAttribute('aria-expanded', 'false');
      }

      function chooseDate(date) {
        selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        displayedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        dateField.value = toIsoDate(selectedDate);
        dateValue.textContent = selectedDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
        closeCalendar();
        dateTrigger.focus();
      }

      dateTrigger.addEventListener('click', function () {
        if (calendar.hidden) openCalendar();
        else closeCalendar();
      });

      previousMonthButton.addEventListener('click', function () {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
        renderCalendar();
      });

      nextMonthButton.addEventListener('click', function () {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
        renderCalendar();
      });

      calendarDays.addEventListener('click', function (event) {
        var dayButton = event.target.closest('.calendar-day');
        if (!dayButton || dayButton.disabled) return;
        var parts = dayButton.dataset.date.split('-').map(Number);
        chooseDate(new Date(parts[0], parts[1] - 1, parts[2]));
      });

      clearDateButton.addEventListener('click', function () {
        selectedDate = null;
        dateField.value = '';
        dateValue.textContent = 'Escolha uma data';
        closeCalendar();
        dateTrigger.focus();
      });

      todayButton.addEventListener('click', function () {
        chooseDate(today);
      });

      document.addEventListener('click', function (event) {
        if (!datePicker.contains(event.target)) closeCalendar();
      });

      datePicker.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !calendar.hidden) {
          closeCalendar();
          dateTrigger.focus();
        }
      });

      form.addEventListener('reset', function () {
        window.setTimeout(function () {
          selectedDate = null;
          displayedMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
          dateValue.textContent = 'Escolha uma data';
          closeCalendar();
        }, 0);
      });
    }

    function showFeedback(kind, message) {
      if (!feedback) return;
      feedback.hidden = false;
      feedback.textContent = message;
      feedback.className = 'form-feedback form-feedback-' + kind;
      feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setLoading(loading) {
      submitButton.disabled = loading;
      submitButton.setAttribute('aria-busy', String(loading));
      if (submitLabel) submitLabel.textContent = loading ? 'Enviando…' : 'Enviar pedido';
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.elements.ocasiao.value) { form.reportValidity(); return; }
      if (!form.elements.cesta.value) {
        form.querySelector('[data-basket-error]').textContent = 'Escolha um presente para continuar.';
        form.querySelector('[data-basket-error]').hidden = false;
        var firstBasket = form.querySelector('[data-basket-options] button:not([hidden])');
        if (firstBasket) firstBasket.focus();
        return;
      }
      if (!form.reportValidity()) return;

      var payload = {};
      new FormData(form).forEach(function (value, key) {
        payload[key] = value;
      });

      payload.whatsapp = nationalPhoneDigits(payload.whatsapp);

      setLoading(true);
      var nextStep = document.querySelector('[data-order-next]');
      if (nextStep) nextStep.hidden = true;
      if (feedback) feedback.hidden = true;

      fetch(form.action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          return response.text().then(function (body) {
            var data;
            try {
              data = JSON.parse(body);
            } catch (error) {
              data = null;
            }
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          setLoading(false);
          if (result.ok && result.data && result.data.success) {
            showFeedback('success', result.data.message || 'Pedido enviado! Entraremos em contato em breve.');
            form.reset();
            if (nextStep && result.data.whatsappUrl) {
              nextStep.querySelector('[data-order-whatsapp]').href = result.data.whatsappUrl;
              nextStep.hidden = false;
              nextStep.focus();
            }
            return;
          }
          showFeedback(
            'error',
            result.data && result.data.message
              ? result.data.message
              : 'Não foi possível salvar seu pedido agora. Tente novamente ou fale conosco pelo WhatsApp abaixo.'
          );
        })
        .catch(function () {
          setLoading(false);
          showFeedback(
            'error',
            'Não foi possível conectar ao sistema de pedidos. Nada foi enviado. Tente novamente ou fale conosco pelo WhatsApp abaixo.'
          );
        });
    });
  }
  function setupBasketChoice(form, catalog) {
    var params = new URLSearchParams(window.location.search);
    var requestedSlug = params.get('produto');
    var requestedName = params.get('cesta');
    var fallback = fallbackProducts();
    if (!requestedSlug && requestedName === fallback.personalizada.formValue) requestedSlug = 'personalizada';
    var fallbackCategories = { 'doce-amanhecer': 'cafe-da-manha', 'com-todo-amor': 'romanticos', 'momento-especial': 'celebracoes', personalizada: 'personalizados' };
    // Reuse the shop's existing categories; no product is reclassified or duplicated.
    var occasionCategories = {
      'Aniversário': ['celebracoes'],
      'Namoro': ['romanticos'],
      'Dia dos Namorados': ['romanticos'],
      'Casamento': ['celebracoes', 'romanticos'],
      'Agradecimento': ['cafe-da-manha', 'personalizados'],
      'Pedido de desculpas': ['romanticos', 'personalizados']
    };
    var products = catalog && Array.isArray(catalog.products) ? catalog.products.map(function (item) {
      return { slug: item.slug, name: item.name, value: item.name, category: item.categorySlug, photo: (item.photos || [])[0] };
    }) : Object.keys(fallback).map(function (slug) {
      var item = fallback[slug];
      return { slug: slug, name: item.name, value: item.formValue, category: fallbackCategories[slug], photo: item.images[0] && item.images[0].src };
    });
    if (!products.some(function (item) { return item.slug === 'personalizada'; })) {
      products.push({ slug: 'personalizada', name: 'Monte do seu jeito', value: fallback.personalizada.formValue, category: 'personalizados' });
    }
    var summary = form.querySelector('[data-basket-summary]');
    var preview = form.querySelector('[data-basket-preview]');
    var picker = form.querySelector('[data-basket-picker]');
    var options = form.querySelector('[data-basket-options]');
    var error = form.querySelector('[data-basket-error]');
    var field = form.elements.cesta;
    var occasion = form.elements.ocasiao;
    var help = form.querySelector('[data-basket-help]');
    var selectedProduct = null;
    function matchesOccasion(product) {
      if (!occasion.value) return false;
      var categories = occasionCategories[occasion.value];
      return occasion.value === 'Outra' || Boolean(categories && categories.includes(product.category));
    }
    function filterBaskets() {
      var available = products.filter(matchesOccasion);
      options.querySelectorAll('button').forEach(function (button) {
        var matches = available.some(function (product) { return product.slug === button.dataset.slug; });
        button.hidden = !matches; button.disabled = !matches;
      });
      options.hidden = !occasion.value;
      help.textContent = !occasion.value ? 'Escolha a ocasião acima para ver os presentes disponíveis.'
        : available.length ? 'Presentes para ' + occasion.value.toLowerCase() + '. Escolha pela foto.'
        : 'Ainda não há presentes nesta categoria. Fale conosco pelo WhatsApp abaixo para montar seu pedido.';
      var incompatible = selectedProduct && occasion.value && !matchesOccasion(selectedProduct);
      if (incompatible) {
        field.value = ''; selectedProduct = null; summary.hidden = true; picker.hidden = false;
        error.textContent = 'A ocasião mudou. Escolha um presente compatível abaixo.'; error.hidden = false;
        options.querySelectorAll('button').forEach(function (button) { button.setAttribute('aria-pressed', 'false'); });
        document.querySelector('[data-order-title]').textContent = 'Monte seu presente';
      }
    }

    function contents(product) {
      var fragment = document.createDocumentFragment();
      if (product.photo) {
        var image = document.createElement('img');
        image.src = product.photo; image.alt = 'Foto de ' + product.name;
        image.width = 360; image.height = 360;
        fragment.appendChild(image);
      } else {
        var placeholder = document.createElement('span');
        placeholder.className = 'basket-photo-placeholder';
        placeholder.textContent = product.slug === 'personalizada' ? 'Um presente do seu jeito' : 'Foto em breve';
        fragment.appendChild(placeholder);
      }
      var caption = document.createElement('span'); caption.className = 'basket-caption';
      var title = document.createElement('strong'); title.textContent = product.name;
      var note = document.createElement('small'); note.textContent = 'Personalize os detalhes abaixo.';
      caption.append(title, note); fragment.appendChild(caption);
      return fragment;
    }
    function choose(product, focusChange) {
      selectedProduct = product;
      field.value = product.value;
      preview.replaceChildren(contents(product));
      summary.hidden = false; picker.hidden = true; error.hidden = true;
      options.querySelectorAll('button').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.slug === product.slug));
      });
      document.querySelector('[data-order-title]').textContent = 'Personalize seu presente';
      if (focusChange) form.querySelector('[data-basket-change]').focus();
    }
    products.forEach(function (product) {
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'basket-option'; button.dataset.slug = product.slug;
      button.setAttribute('aria-label', 'Escolher ' + product.name);
      button.setAttribute('aria-pressed', 'false'); button.appendChild(contents(product));
      button.addEventListener('click', function () { if (matchesOccasion(product)) choose(product, true); });
      options.appendChild(button);
    });
    var initial = products.find(function (product) {
      return requestedSlug ? product.slug === requestedSlug : product.value === requestedName;
    });
    if (initial) { field.defaultValue = initial.value; choose(initial, false); }
    filterBaskets();
    if (!initial && (requestedSlug || requestedName)) {
      error.textContent = 'Este presente não está disponível. Escolha uma ocasião para ver outras opções.'; error.hidden = false;
    }
    occasion.addEventListener('change', function () { error.hidden = true; filterBaskets(); });
    form.querySelector('[data-basket-change]').addEventListener('click', function () {
      picker.hidden = false;
      var selected = options.querySelector('[aria-pressed="true"]:not([hidden])') || options.querySelector('button:not([hidden])');
      if (selected) selected.focus();
      else if (!occasion.value) {
        var trigger = occasion.parentElement.querySelector('.custom-select-trigger');
        if (trigger) trigger.focus();
      }
    });
    form.addEventListener('reset', function () {
      window.setTimeout(function () {
        if (initial) choose(initial, false);
        else {
          field.value = ''; selectedProduct = null;
          summary.hidden = true; picker.hidden = false; error.hidden = true;
          options.querySelectorAll('button').forEach(function (button) { button.setAttribute('aria-pressed', 'false'); });
          document.querySelector('[data-order-title]').textContent = 'Monte seu presente';
        }
        filterBaskets();
      }, 0);
    });
  }
}());
