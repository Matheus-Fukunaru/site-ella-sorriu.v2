(function () {
  var storageKey = 'ella_sorriu_admin_theme';
  var densityStorageKey = 'ella_sorriu_admin_density';
  var allowedThemes = ['light', 'dark'];
  var preference = 'light';

  try {
    var saved = window.localStorage.getItem(storageKey);
    if (allowedThemes.indexOf(saved) !== -1) preference = saved;
    else if (saved === 'system') window.localStorage.setItem(storageKey, 'light');
  } catch (error) {
    preference = 'light';
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-admin-theme', preference);
    document.documentElement.setAttribute('data-admin-theme-preference', preference);
    document.dispatchEvent(new CustomEvent('admin-theme-change', { detail: { preference: preference } }));
  }

  function setTheme(value) {
    if (allowedThemes.indexOf(value) === -1) return;
    preference = value;
    try { window.localStorage.setItem(storageKey, value); } catch (error) { /* preferência apenas visual */ }
    applyTheme();
  }

  window.ellaSorriuAdminTheme = {
    get: function () { return preference; },
    set: setTheme
  };
  applyTheme();

  var density = 'comfortable';
  try {
    var savedDensity = window.localStorage.getItem(densityStorageKey);
    if (savedDensity === 'compact') density = 'compact';
  } catch (error) { density = 'comfortable'; }
  document.documentElement.setAttribute('data-admin-density', density);
  window.ellaSorriuAdminDensity = {
    get: function () { return density; },
    set: function (value) {
      density = value === 'compact' ? 'compact' : 'comfortable';
      document.documentElement.setAttribute('data-admin-density', density);
      try { window.localStorage.setItem(densityStorageKey, density); } catch (error) { /* preferência visual */ }
    }
  };
}());

document.addEventListener('DOMContentLoaded', function () {
  var emailSettingsForm = document.querySelector('[data-email-settings-form]');
  if (emailSettingsForm) {
    var senderEmail = emailSettingsForm.elements.sender_email;
    var smtpHost = emailSettingsForm.elements.smtp_host;
    var smtpPort = emailSettingsForm.elements.smtp_port;
    var smtpUser = emailSettingsForm.elements.smtp_user;
    senderEmail.addEventListener('change', function () {
      if (!/@gmail\.com$/i.test(senderEmail.value.trim())) return;
      if (!smtpHost.value.trim()) smtpHost.value = 'smtp.gmail.com';
      if (!smtpPort.value.trim()) smtpPort.value = '465';
      if (!smtpUser.value.trim()) smtpUser.value = senderEmail.value.trim();
      var secure = emailSettingsForm.querySelector('input[name="smtp_secure"][value="true"]');
      if (secure) secure.checked = true;
    });
  }
  var themeButtons = document.querySelectorAll('[data-admin-theme-option]');
  function syncThemeButtons() {
    if (!window.ellaSorriuAdminTheme) return;
    var selected = window.ellaSorriuAdminTheme.get();
    themeButtons.forEach(function (button) {
      var active = button.dataset.adminThemeOption === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
  }
  themeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      window.ellaSorriuAdminTheme.set(button.dataset.adminThemeOption);
    });
  });
  document.addEventListener('admin-theme-change', syncThemeButtons);
  syncThemeButtons();

  var densityButtons = document.querySelectorAll('[data-admin-density-option]');
  function syncDensityButtons() {
    var selected = window.ellaSorriuAdminDensity.get();
    densityButtons.forEach(function (button) {
      var active = button.dataset.adminDensityOption === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
  }
  densityButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      window.ellaSorriuAdminDensity.set(button.dataset.adminDensityOption);
      syncDensityButtons();
    });
  });
  syncDensityButtons();

  var orderPreferenceKeys = {
    pageSize: 'ella_sorriu_admin_orders_page_size',
    sort: 'ella_sorriu_admin_orders_sort',
    refresh: 'ella_sorriu_admin_orders_refresh'
  };
  function getOrderPreference(key, allowed, fallback) {
    try {
      var value = window.localStorage.getItem(orderPreferenceKeys[key]);
      return allowed.indexOf(value) !== -1 ? value : fallback;
    } catch (error) { return fallback; }
  }
  var orderPreferences = {
    pageSize: getOrderPreference('pageSize', ['10', '20', '50'], '20'),
    sort: getOrderPreference('sort', ['newest', 'oldest'], 'newest'),
    refresh: getOrderPreference('refresh', ['0', '30', '60'], '0')
  };
  function saveOrderPreference(key, value) {
    orderPreferences[key] = value;
    try { window.localStorage.setItem(orderPreferenceKeys[key], value); } catch (error) { /* preferência visual */ }
  }
  function bindOrderPreferenceButtons(selector, key) {
    var buttons = document.querySelectorAll(selector);
    function sync() {
      buttons.forEach(function (button) {
        var active = button.getAttribute(selector.slice(1, -1).split('=')[0]) === orderPreferences[key];
        button.classList.toggle('active', active);
        button.setAttribute('aria-checked', String(active));
      });
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var attribute = key === 'pageSize' ? 'data-orders-page-size' : key === 'sort' ? 'data-orders-sort' : 'data-orders-refresh';
        saveOrderPreference(key, button.getAttribute(attribute));
        sync();
      });
    });
    sync();
  }
  bindOrderPreferenceButtons('[data-orders-page-size]', 'pageSize');
  bindOrderPreferenceButtons('[data-orders-sort]', 'sort');
  bindOrderPreferenceButtons('[data-orders-refresh]', 'refresh');

  var clientPreferenceKeys = {
    pageSize: 'ella_sorriu_admin_clients_page_size',
    sort: 'ella_sorriu_admin_clients_sort'
  };
  function getClientPreference(key, allowed, fallback) {
    try {
      var value = window.localStorage.getItem(clientPreferenceKeys[key]);
      return allowed.indexOf(value) !== -1 ? value : fallback;
    } catch (error) { return fallback; }
  }
  var clientPreferences = {
    pageSize: getClientPreference('pageSize', ['10', '20', '50'], '20'),
    sort: getClientPreference('sort', ['newest', 'oldest'], 'newest')
  };
  function saveClientPreference(key, value) {
    clientPreferences[key] = value;
    try { window.localStorage.setItem(clientPreferenceKeys[key], value); } catch (error) { /* preferência visual */ }
  }
  function bindClientPreferenceButtons(selector, key) {
    var buttons = document.querySelectorAll(selector);
    var attribute = key === 'pageSize' ? 'data-clients-page-size' : 'data-clients-sort';
    function sync() {
      buttons.forEach(function (button) {
        var active = button.getAttribute(attribute) === clientPreferences[key];
        button.classList.toggle('active', active);
        button.setAttribute('aria-checked', String(active));
      });
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        saveClientPreference(key, button.getAttribute(attribute));
        sync();
      });
    });
    sync();
  }
  bindClientPreferenceButtons('[data-clients-page-size]', 'pageSize');
  bindClientPreferenceButtons('[data-clients-sort]', 'sort');

  var ordersTable = document.querySelector('[data-orders-table]');
  if (ordersTable) {
    var orderRows = Array.from(ordersTable.querySelectorAll('[data-order-row]'));
    var currentOrderPage = 1;
    var tableWrap = ordersTable.closest('.admin-table-wrap');
    var pagination = document.createElement('nav');
    var previousButton = document.createElement('button');
    var paginationStatus = document.createElement('span');
    var nextButton = document.createElement('button');
    pagination.className = 'orders-pagination';
    pagination.setAttribute('aria-label', 'Paginação dos pedidos');
    previousButton.type = nextButton.type = 'button';
    previousButton.textContent = '← Anterior';
    nextButton.textContent = 'Próxima →';
    pagination.append(previousButton, paginationStatus, nextButton);
    tableWrap.insertAdjacentElement('afterend', pagination);

    function renderOrderPage() {
      var pageSize = Number(orderPreferences.pageSize);
      orderRows.sort(function (first, second) {
        var difference = Number(first.dataset.orderCreated) - Number(second.dataset.orderCreated);
        return orderPreferences.sort === 'oldest' ? difference : -difference;
      });
      var body = ordersTable.tBodies[0];
      orderRows.forEach(function (row) { body.appendChild(row); });
      var totalPages = Math.max(1, Math.ceil(orderRows.length / pageSize));
      currentOrderPage = Math.min(currentOrderPage, totalPages);
      var start = (currentOrderPage - 1) * pageSize;
      orderRows.forEach(function (row, index) { row.hidden = index < start || index >= start + pageSize; });
      paginationStatus.textContent = 'Página ' + currentOrderPage + ' de ' + totalPages;
      previousButton.disabled = currentOrderPage === 1;
      nextButton.disabled = currentOrderPage === totalPages;
      pagination.hidden = totalPages <= 1;
    }
    previousButton.addEventListener('click', function () { currentOrderPage -= 1; renderOrderPage(); window.scrollTo({ top: tableWrap.offsetTop - 90, behavior: 'smooth' }); });
    nextButton.addEventListener('click', function () { currentOrderPage += 1; renderOrderPage(); window.scrollTo({ top: tableWrap.offsetTop - 90, behavior: 'smooth' }); });
    renderOrderPage();
    if (Number(orderPreferences.refresh) > 0) window.setTimeout(function () { window.location.reload(); }, Number(orderPreferences.refresh) * 1000);
  }

  var clientsTable = document.querySelector('[data-clients-table]');
  if (clientsTable) {
    var clientRows = Array.from(clientsTable.querySelectorAll('[data-client-row]'));
    var currentClientPage = 1;
    var clientsTableWrap = clientsTable.closest('.admin-table-wrap');
    var clientsPagination = document.createElement('nav');
    var clientsPreviousButton = document.createElement('button');
    var clientsPaginationStatus = document.createElement('span');
    var clientsNextButton = document.createElement('button');
    clientsPagination.className = 'orders-pagination clients-pagination';
    clientsPagination.setAttribute('aria-label', 'Paginação dos clientes');
    clientsPreviousButton.type = clientsNextButton.type = 'button';
    clientsPreviousButton.textContent = '← Anterior';
    clientsNextButton.textContent = 'Próxima →';
    clientsPagination.append(clientsPreviousButton, clientsPaginationStatus, clientsNextButton);
    clientsTableWrap.insertAdjacentElement('afterend', clientsPagination);

    function renderClientPage() {
      var pageSize = Number(clientPreferences.pageSize);
      clientRows.sort(function (first, second) {
        var difference = Number(first.dataset.clientUpdated) - Number(second.dataset.clientUpdated);
        return clientPreferences.sort === 'oldest' ? difference : -difference;
      });
      var body = clientsTable.tBodies[0];
      clientRows.forEach(function (row) { body.appendChild(row); });
      var totalPages = Math.max(1, Math.ceil(clientRows.length / pageSize));
      currentClientPage = Math.min(currentClientPage, totalPages);
      var start = (currentClientPage - 1) * pageSize;
      clientRows.forEach(function (row, index) { row.hidden = index < start || index >= start + pageSize; });
      clientsPaginationStatus.textContent = 'Página ' + currentClientPage + ' de ' + totalPages;
      clientsPreviousButton.disabled = currentClientPage === 1;
      clientsNextButton.disabled = currentClientPage === totalPages;
      clientsPagination.hidden = totalPages <= 1;
    }
    clientsPreviousButton.addEventListener('click', function () { currentClientPage -= 1; renderClientPage(); window.scrollTo({ top: clientsTableWrap.offsetTop - 90, behavior: 'smooth' }); });
    clientsNextButton.addEventListener('click', function () { currentClientPage += 1; renderClientPage(); window.scrollTo({ top: clientsTableWrap.offsetTop - 90, behavior: 'smooth' }); });
    renderClientPage();
  }

  var settingsPhone = document.querySelector('[data-settings-phone]');
  if (settingsPhone) {
    function maskSettingsPhone(value) {
      var digits = String(value || '').replace(/\D/g, '');
      if (digits.slice(0, 2) === '55') digits = digits.slice(2);
      digits = digits.slice(0, 11);
      if (!digits) return '+55 ';
      if (digits.length <= 2) return '+55 (' + digits;
      var local = digits.slice(2);
      var split = digits.length > 10 ? 5 : 4;
      return '+55 (' + digits.slice(0, 2) + ') ' + local.slice(0, split) + (local.length > split ? '-' + local.slice(split) : '');
    }
    settingsPhone.value = maskSettingsPhone(settingsPhone.value);
    settingsPhone.addEventListener('input', function () {
      settingsPhone.value = maskSettingsPhone(settingsPhone.value);
      settingsPhone.setSelectionRange(settingsPhone.value.length, settingsPhone.value.length);
    });
  }

  var auditFilterButtons = document.querySelectorAll('[data-audit-filter]');
  var auditItems = document.querySelectorAll('[data-audit-category]');
  var auditEmpty = document.querySelector('.audit-empty');
  auditFilterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var filter = button.dataset.auditFilter;
      var visibleCount = 0;
      auditFilterButtons.forEach(function (item) {
        var active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      auditItems.forEach(function (item) {
        var visible = filter === 'all' || item.dataset.auditCategory === filter;
        item.hidden = !visible;
        if (visible) visibleCount += 1;
      });
      if (auditEmpty) auditEmpty.hidden = visibleCount !== 0;
    });
  });

  document.querySelectorAll('[data-phone-display]').forEach(function (element) {
    var digits = element.textContent.replace(/\D/g, '');
    if (digits.length > 11 && digits.slice(0, 2) === '55') digits = digits.slice(2);
    if (digits.length === 10 || digits.length === 11) {
      element.textContent = '(' + digits.slice(0, 2) + ') ' +
        digits.slice(2, -4) + '-' + digits.slice(-4);
    }
  });
  var menuButton = document.querySelector('.admin-menu-toggle');
  var navigation = document.querySelector('.admin-navigation');
  if (menuButton && navigation) {
    menuButton.addEventListener('click', function () {
      var open = navigation.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded', String(open));
      var label = menuButton.querySelector('.sr-only');
      if (label) label.textContent = open ? 'Fechar menu' : 'Abrir menu';
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
        navigation.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.focus();
      }
    });
  }

  var deleteForm = document.querySelector('[data-confirm-delete]');
  if (deleteForm) {
    deleteForm.addEventListener('submit', function (event) {
      if (!window.confirm('Excluir este pedido definitivamente?')) event.preventDefault();
    });
  }

  var copyButton = document.querySelector('[data-copy-invite]');
  var inviteLink = document.getElementById('invite-link');
  if (copyButton && inviteLink) {
    copyButton.addEventListener('click', function () {
      function showCopied() {
        var feedback = document.querySelector('.copy-feedback');
        if (feedback) feedback.hidden = false;
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(inviteLink.value).then(showCopied).catch(function () {
          inviteLink.select();
          inviteLink.setSelectionRange(0, inviteLink.value.length);
        });
      } else {
        inviteLink.select();
        inviteLink.setSelectionRange(0, inviteLink.value.length);
      }
    });
  }

  document.querySelectorAll('select[data-admin-role-select]').forEach(function (select, selectIndex) {
    var wrapper = document.createElement('div');
    var trigger = document.createElement('button');
    var value = document.createElement('span');
    var arrow = document.createElement('span');
    var list = document.createElement('div');
    var listId = 'admin-role-options-' + selectIndex;
    var optionElements = [];
    var activeIndex = Math.max(0, select.selectedIndex);

    wrapper.className = 'admin-role-select';
    trigger.type = 'button';
    trigger.className = 'admin-role-select-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', listId);
    arrow.className = 'admin-role-select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '⌄';
    list.className = 'admin-role-select-options';
    list.id = listId;
    list.setAttribute('role', 'listbox');
    list.hidden = true;

    Array.from(select.options).forEach(function (option, optionIndex) {
      var item = document.createElement('div');
      item.className = 'admin-role-select-option';
      item.id = listId + '-option-' + optionIndex;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      item.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        choose(optionIndex);
      });
      list.appendChild(item);
      optionElements.push(item);
    });

    function sync() {
      activeIndex = Math.max(0, select.selectedIndex);
      value.textContent = select.options[activeIndex].textContent;
      optionElements.forEach(function (item, index) {
        var selected = index === activeIndex;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      trigger.setAttribute('aria-activedescendant', optionElements[activeIndex].id);
    }

    function open() {
      document.querySelectorAll('.admin-role-select.is-open').forEach(function (other) {
        if (other !== wrapper && other.closeAdminRoleSelect) other.closeAdminRoleSelect();
      });
      wrapper.classList.add('is-open');
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      activeIndex = Math.max(0, select.selectedIndex);
      trigger.setAttribute('aria-activedescendant', optionElements[activeIndex].id);
    }

    function close() {
      wrapper.classList.remove('is-open');
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    function choose(index) {
      activeIndex = Math.max(0, Math.min(index, select.options.length - 1));
      if (select.selectedIndex !== activeIndex) {
        select.selectedIndex = activeIndex;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      sync();
      close();
      trigger.focus();
    }

    function move(step) {
      if (list.hidden) open();
      activeIndex = (activeIndex + step + optionElements.length) % optionElements.length;
      trigger.setAttribute('aria-activedescendant', optionElements[activeIndex].id);
      optionElements.forEach(function (item, index) {
        item.classList.toggle('is-active', index === activeIndex);
      });
    }

    trigger.addEventListener('click', function () {
      if (list.hidden) open(); else close();
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (list.hidden) open(); else choose(activeIndex);
      } else if (event.key === 'Escape' && !list.hidden) {
        event.preventDefault(); close();
      } else if (event.key === 'Tab') close();
    });
    select.addEventListener('change', sync);
    wrapper.closeAdminRoleSelect = close;

    select.classList.add('admin-role-select-native');
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    trigger.appendChild(value);
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);
    wrapper.appendChild(list);
    sync();
  });

  document.addEventListener('pointerdown', function (event) {
    document.querySelectorAll('.admin-role-select.is-open').forEach(function (wrapper) {
      if (!wrapper.contains(event.target) && wrapper.closeAdminRoleSelect) wrapper.closeAdminRoleSelect();
    });
  });

  document.querySelectorAll('[data-role-form]').forEach(function (form) {
    var select = form.querySelector('select[name="role"]');
    var confirmation = form.querySelector('.owner-confirmation');
    if (!select || !confirmation) return;
    function updateOwnerConfirmation() {
      confirmation.hidden = select.value !== 'owner';
      var input = confirmation.querySelector('input');
      if (input) input.required = select.value === 'owner';
    }
    select.addEventListener('change', updateOwnerConfirmation);
    updateOwnerConfirmation();
  });

  var productForm = document.querySelector('[data-product-edit-form]');
  if (productForm) {
    var photoInput = productForm.querySelector('[data-product-image-upload]');
    var photoField = productForm.querySelector('[data-product-photos]');
    var photoList = productForm.querySelector('[data-product-photo-list]');
    var uploadStatus = productForm.querySelector('[data-product-upload-status]');
    var csrfField = productForm.querySelector('[name="_csrf"]');
    var previewImage = productForm.querySelector('[data-product-preview-image]');
    var previewPlaceholder = productForm.querySelector('[data-product-preview-placeholder]');
    var previewName = productForm.querySelector('[data-product-preview-name]');
    var previewCategory = productForm.querySelector('[data-product-preview-category]');
    var previewPrice = productForm.querySelector('[data-product-preview-price]');
    var previewDescription = productForm.querySelector('[data-product-preview-description]');
    var nameField = productForm.querySelector('[name="name"]');
    var categoryField = productForm.querySelector('[name="category_id"]');
    var priceField = productForm.querySelector('[name="price"]');
    var descriptionField = productForm.querySelector('[name="description"]');
    var photos = [];
    try { photos = JSON.parse(photoField.value || '[]'); } catch (_) { photos = []; }
    function updatePreview() {
      previewName.textContent = nameField.value.trim() || 'Nome do produto';
      previewCategory.textContent = categoryField.selectedOptions[0] && categoryField.value ? categoryField.selectedOptions[0].textContent : 'Categoria';
      var price = Number(String(priceField.value || '').replace(',', '.'));
      previewPrice.textContent = Number.isFinite(price) && price > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price) : 'Valor sob consulta';
      previewDescription.textContent = descriptionField.value.trim() || 'Descrição do produto';
      if (photos.length) { previewImage.src = '/admin/products/media/' + encodeURIComponent(photos[0]); previewImage.hidden = false; previewPlaceholder.hidden = true; }
      else { previewImage.removeAttribute('src'); previewImage.hidden = true; previewPlaceholder.hidden = false; }
    }
    function renderPhotos() {
      photoField.value = JSON.stringify(photos);
      photoList.replaceChildren();
      photos.forEach(function (filename, index) {
        var item = document.createElement('figure');
        var image = document.createElement('img');
        var remove = document.createElement('button');
        item.className = 'product-photo-preview';
        image.src = '/admin/products/media/' + encodeURIComponent(filename);
        image.alt = 'Foto do produto';
        image.loading = 'lazy';
        remove.type = 'button';
        remove.className = 'product-photo-remove';
        remove.textContent = 'Remover';
        remove.setAttribute('aria-label', 'Remover foto ' + (index + 1));
        remove.addEventListener('click', function () { photos.splice(index, 1); renderPhotos(); });
        item.append(image, remove);
        photoList.appendChild(item);
      });
      updatePreview();
    }
    renderPhotos();
    [nameField, categoryField, priceField, descriptionField].forEach(function (field) { field.addEventListener('input', updatePreview); field.addEventListener('change', updatePreview); });
    if (photoInput) photoInput.addEventListener('change', async function () {
      var selected = Array.prototype.slice.call(photoInput.files || []);
      if (!selected.length) return;
      uploadStatus.textContent = '';
      for (var index = 0; index < selected.length; index += 1) {
        if (photos.length >= 6) { uploadStatus.textContent = 'O limite é de seis fotos por produto.'; break; }
        var file = selected[index];
        if (file.size > 3 * 1024 * 1024 || ['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) === -1) {
          uploadStatus.textContent = 'Escolha imagens JPG, PNG ou WebP de até 3 MB.';
          continue;
        }
        uploadStatus.textContent = 'Enviando foto ' + (index + 1) + ' de ' + selected.length + '…';
        try {
          var response = await fetch('/admin/products/media/upload', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': csrfField.value },
            body: file
          });
          var result = null;
          try { result = await response.json(); } catch (_) { /* resposta inesperada não deve expor detalhes */ }
          if (!response.ok || !result || !result.success) throw new Error(result && result.message || 'Não foi possível enviar a foto. Atualize a página e tente novamente.');
          photos.push(result.filename);
          renderPhotos();
        } catch (error) {
          uploadStatus.textContent = error.message || 'Não foi possível enviar a foto.';
          break;
        }
      }
      if (photos.length && !uploadStatus.textContent.includes('limite') && !uploadStatus.textContent.includes('Escolha')) uploadStatus.textContent = 'Fotos prontas para salvar.';
      photoInput.value = '';
    });
  }
});
