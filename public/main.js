(function () {
  const $ = (id) => document.getElementById(id);
  const overlayToggle = $('overlay-toggle');
  const overlayStatus = $('overlay-status');
  const builtinList = $('builtin-list');
  const customList = $('custom-list');
  const customArea = $('custom-area');
  const customEmpty = $('custom-empty');
  const customDirLabel = $('custom-dir-label');
  const pickFolder = $('pick-folder');
  const previewImg = $('preview-img');
  const previewSolid = $('preview-solid');
  const displayList = $('display-list');
  const sizeEl = $('size');
  const sizeVal = $('size-val');
  const hueEl = $('hue');
  const hueVal = $('hue-val');
  const rotationEl = $('rotation');
  const rotationVal = $('rotation-val');
  const opacityEl = $('opacity');
  const opacityVal = $('opacity-val');
  const posX = $('pos-x');
  const posY = $('pos-y');
  const pixelInputs = $('pixel-inputs');
  const setFromCursor = $('set-from-cursor');
  const fillToggle = $('fill-toggle');
  const fillColorEl = $('fill-color');
  const outlineToggle = $('outline-toggle');
  const outlineWidthEl = $('outline-width');
  const outlineColorEl = $('outline-color');
  const outlineControls = $('outline-controls');
  const glowToggle = $('glow-toggle');
  const glowColorEl = $('glow-color');
  const profileSelect = $('profile-select');
  const profileName = $('profile-name');
  const profileSave = $('profile-save');
  const profileDelete = $('profile-delete');
  const profileMsg = $('profile-msg');
  const allDisplaysToggle = $('all-displays-toggle');
  const trayToggle = $('tray-toggle');
  const rememberToggle = $('remember-toggle');
  const toggleHotkeyEl = $('toggle-hotkey');
  const randomBtn = $('random-btn');
  const resetBtn = $('reset-btn');
  const githubLink = $('github-link');
  const discordLink = $('discord-link');

  if (!window.dilates || !window.CrossStyle) return;

  let displays = [];
  let builtinNames = [];
  let config = {
    size: 48,
    hue: 0,
    rotation: 0,
    opacity: 1,
    crosshair: '',
    positionMode: 'center',
    x: 0,
    y: 0,
    displayId: null,
    customDir: null,
    customFile: null,
    fillColor: null,
    outline: false,
    outlineWidth: 2,
    outlineColor: '#000000',
    glow: false,
    glowColor: '#6c8cff',
    overlayOn: false,
    showOnAllDisplays: false,
    tray: true,
    toggleHotkey: 'CommandOrControl+Shift+X',
    profiles: {},
    activeProfile: null,
  };

  function applyConfig() {
    window.dilates.configUpdate(config);
    updatePreview();
  }

  // ---------- Preview ----------
  async function updatePreview() {
    const url = await window.dilates.getCrosshairUrl();
    const px = Math.max(16, Math.min(180, config.size));
    if (config.fillColor) {
      previewImg.classList.add('hidden');
      previewSolid.classList.remove('hidden');
      previewSolid.style.width = px + 'px';
      previewSolid.style.height = px + 'px';
      window.CrossStyle.applyToSolid(previewSolid, { ...config, imageUrl: url });
    } else {
      previewSolid.classList.add('hidden');
      previewImg.classList.remove('hidden');
      window.CrossStyle.applyToImg(previewImg, { ...config, imageUrl: url });
      previewImg.style.width = px + 'px';
      previewImg.style.height = px + 'px';
      previewImg.style.maxWidth = 'none';
      previewImg.style.maxHeight = 'none';
    }
  }

  // ---------- Crosshair gallery ----------
  function makeTile({ src, name, type, label }) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'crosshair-tile';
    tile.dataset.name = name;
    tile.dataset.type = type;
    tile.title = label || name.replace(/\.(png|svg)$/i, '').replace(/[-_]/g, ' ');
    const img = document.createElement('img');
    img.alt = tile.title;
    img.src = src;
    img.onerror = () => { tile.style.opacity = '0.3'; };
    tile.appendChild(img);
    return tile;
  }

  function renderBuiltin(items) {
    builtinNames = items || [];
    builtinList.innerHTML = '';
    items.forEach((name) => {
      const tile = makeTile({ src: 'crosshairs/' + encodeURIComponent(name), name, type: 'builtin' });
      if (config.crosshair === name && !config.customFile) tile.classList.add('selected');
      tile.onclick = () => selectCrosshair(name, null);
      builtinList.appendChild(tile);
    });
  }

  function renderCustom(items) {
    customList.innerHTML = '';
    customEmpty.classList.toggle('hidden', !config.customDir || (items || []).length > 0);
    (items || []).forEach((name) => {
      const fileUrl = 'file://' + encodeURI(config.customDir + '/' + name).replace(/#/g, '%23');
      const tile = makeTile({ src: fileUrl, name, type: 'custom' });
      if (config.customFile === name) tile.classList.add('selected');
      tile.onclick = () => selectCrosshair(config.crosshair, name);
      customList.appendChild(tile);
    });
  }

  function markSelection() {
    document.querySelectorAll('.crosshair-tile').forEach((el) => el.classList.remove('selected'));
    const q = config.customFile
      ? `.crosshair-tile[data-type="custom"][data-name="${CSS.escape(config.customFile)}"]`
      : `.crosshair-tile[data-type="builtin"][data-name="${CSS.escape(config.crosshair)}"]`;
    const el = document.querySelector(q);
    if (el) el.classList.add('selected');
  }

  function selectCrosshair(builtinName, customName) {
    config.crosshair = builtinName || config.crosshair;
    config.customFile = customName;
    markSelection();
    applyConfig();
  }

  // ---------- Displays ----------
  function renderDisplays(list) {
    displays = list || [];
    displayList.innerHTML = '';
    const selectedId = config.displayId;
    const hasSelected = displays.some((d) => d.id === selectedId);
    displays.forEach((d, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'display-card';
      const isSelected = hasSelected ? d.id === selectedId : d.isPrimary;
      if (isSelected) card.classList.add('selected');
      card.innerHTML = `
        <svg class="monitor-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="13" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>
          <span class="display-name">Display ${i + 1}${d.isPrimary ? ' <span class="badge">Primary</span>' : ''}</span>
          <span class="display-res">${d.width} × ${d.height}</span>
        </span>`;
      card.onclick = () => {
        config.displayId = d.id;
        displayList.querySelectorAll('.display-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        applyConfig();
      };
      displayList.appendChild(card);
    });
  }

  // ---------- Overlay toggle ----------
  function setOverlayStatus(on) {
    overlayStatus.textContent = on ? 'Overlay on' : 'Overlay off';
    overlayStatus.classList.toggle('on', on);
    overlayStatus.classList.toggle('off', !on);
  }

  overlayToggle.addEventListener('change', () => {
    if (overlayToggle.checked) window.dilates.overlayShow();
    else window.dilates.overlayHide();
    setOverlayStatus(overlayToggle.checked);
  });

  // ---------- Tabs ----------
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const isCustom = tab.dataset.tab === 'custom';
      builtinList.classList.toggle('hidden', isCustom);
      customArea.classList.toggle('hidden', !isCustom);
    });
  });

  // ---------- Style sliders ----------
  sizeEl.addEventListener('input', () => {
    config.size = Number(sizeEl.value);
    sizeVal.textContent = config.size + ' px';
    applyConfig();
  });
  hueEl.addEventListener('input', () => {
    config.hue = Number(hueEl.value);
    hueVal.textContent = config.hue + '°';
    applyConfig();
  });
  rotationEl.addEventListener('input', () => {
    config.rotation = Number(rotationEl.value);
    rotationVal.textContent = config.rotation + '°';
    applyConfig();
  });
  opacityEl.addEventListener('input', () => {
    config.opacity = Number(opacityEl.value) / 100;
    opacityVal.textContent = Math.round(config.opacity * 100) + '%';
    applyConfig();
  });

  // ---------- Effects ----------
  fillToggle.addEventListener('change', () => {
    config.fillColor = fillToggle.checked ? fillColorEl.value : null;
    fillColorEl.classList.toggle('hidden', !fillToggle.checked);
    applyConfig();
  });
  fillColorEl.addEventListener('input', () => {
    if (!config.fillColor) return;
    config.fillColor = fillColorEl.value;
    applyConfig();
  });

  outlineToggle.addEventListener('change', () => {
    config.outline = outlineToggle.checked;
    outlineControls.classList.toggle('hidden', !outlineToggle.checked);
    applyConfig();
  });
  outlineWidthEl.addEventListener('input', () => {
    config.outlineWidth = Number(outlineWidthEl.value);
    applyConfig();
  });
  outlineColorEl.addEventListener('input', () => {
    config.outlineColor = outlineColorEl.value;
    applyConfig();
  });

  glowToggle.addEventListener('change', () => {
    config.glow = glowToggle.checked;
    glowColorEl.classList.toggle('hidden', !glowToggle.checked);
    applyConfig();
  });
  glowColorEl.addEventListener('input', () => {
    config.glowColor = glowColorEl.value;
    applyConfig();
  });

  // ---------- Position ----------
  document.querySelectorAll('input[name="position"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      config.positionMode = radio.value;
      pixelInputs.classList.toggle('hidden', radio.value !== 'pixel');
      applyConfig();
    });
  });

  posX.addEventListener('change', () => {
    config.x = Number(posX.value) || 0;
    applyConfig();
  });
  posY.addEventListener('change', () => {
    config.y = Number(posY.value) || 0;
    applyConfig();
  });

  setFromCursor.addEventListener('click', () => {
    window.dilates.setPositionFromCursor();
  });

  window.dilates.onSetPositionFromCursor(() => {
    window.dilates.setPositionFromCursor();
  });

  // ---------- Profiles ----------
  function renderProfiles() {
    const names = Object.keys(config.profiles || {}).sort((a, b) => a.localeCompare(b));
    profileSelect.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = names.length ? 'Select profile…' : 'No profiles yet';
    profileSelect.appendChild(none);
    names.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      profileSelect.appendChild(opt);
    });
    profileSelect.value = config.activeProfile || '';
  }

  let profileMsgTimer = null;
  function showProfileMsg(text, isError) {
    profileMsg.textContent = text || '';
    profileMsg.classList.toggle('error', !!isError);
    if (profileMsgTimer) clearTimeout(profileMsgTimer);
    if (text) profileMsgTimer = setTimeout(() => { profileMsg.textContent = ''; }, 3500);
  }

  profileSelect.addEventListener('change', async () => {
    const name = profileSelect.value;
    if (!name) return;
    const res = await window.dilates.applyProfile(name);
    if (res && res.ok) showProfileMsg(`Loaded "${name}".`);
    else showProfileMsg((res && res.error) || 'Could not load profile.', true);
  });

  profileSave.addEventListener('click', async () => {
    const name = profileName.value.trim();
    if (!name) {
      showProfileMsg('Enter a name for the profile first.', true);
      profileName.focus();
      return;
    }
    const res = await window.dilates.saveProfile(name);
    if (res && res.ok) {
      profileName.value = '';
      showProfileMsg(`Saved "${name}".`);
    } else {
      showProfileMsg((res && res.error) || 'Could not save profile.', true);
    }
  });

  profileName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') profileSave.click();
  });

  profileDelete.addEventListener('click', async () => {
    const name = profileSelect.value;
    if (!name) {
      showProfileMsg('Select a profile to delete.', true);
      return;
    }
    await window.dilates.deleteProfile(name);
    showProfileMsg(`Deleted "${name}".`);
  });

  // ---------- General ----------
  allDisplaysToggle.addEventListener('change', () => {
    config.showOnAllDisplays = allDisplaysToggle.checked;
    applyConfig();
  });

  trayToggle.addEventListener('change', () => {
    config.tray = trayToggle.checked;
    applyConfig();
  });

  rememberToggle.checked = true;
  rememberToggle.title = 'The overlay reappears automatically if it was on when you closed the app.';

  let hotkeyTimer = null;
  toggleHotkeyEl.addEventListener('change', async () => {
    const value = toggleHotkeyEl.value.trim();
    if (hotkeyTimer) clearTimeout(hotkeyTimer);
    const res = await window.dilates.setToggleHotkey(value);
    toggleHotkeyEl.value = res.accelerator || config.toggleHotkey;
    toggleHotkeyEl.classList.toggle('invalid', !res.ok);
    if (hotkeyTimer) clearTimeout(hotkeyTimer);
    hotkeyTimer = setTimeout(() => toggleHotkeyEl.classList.remove('invalid'), 3000);
  });

  randomBtn.addEventListener('click', () => {
    if (!builtinNames.length) return;
    const others = builtinNames.filter((n) => !config.customFile && n !== config.crosshair);
    const pool = others.length ? others : builtinNames;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    selectCrosshair(pick, null);
  });

  resetBtn.addEventListener('click', async () => {
    await window.dilates.resetConfig();
  });

  // ---------- Custom folder ----------
  pickFolder.addEventListener('click', async () => {
    const dir = await window.dilates.openFolderDialog();
    if (!dir) return;
    config.customDir = dir;
    customDirLabel.textContent = dir;
    customDirLabel.title = dir;
    const list = await window.dilates.getCustomCrosshairs(dir);
    renderCustom(list);
    applyConfig();
  });

  // ---------- Links ----------
  const ext = (el, url) => el.addEventListener('click', (e) => {
    e.preventDefault();
    window.dilates.openExternal(url);
  });
  ext(githubLink, 'https://github.com/dilates/crosshair');
  ext(discordLink, 'https://discord.gg/cheese');

  // ---------- Sync from main process ----------
  function syncFromConfig(c) {
    config = { ...config, ...c };
    sizeEl.value = config.size;
    sizeVal.textContent = config.size + ' px';
    hueEl.value = config.hue;
    hueVal.textContent = config.hue + '°';
    rotationEl.value = config.rotation;
    rotationVal.textContent = config.rotation + '°';
    const op = Math.round((config.opacity ?? 1) * 100);
    opacityEl.value = op;
    opacityVal.textContent = op + '%';

    // Effects
    const hasFill = !!config.fillColor;
    fillToggle.checked = hasFill;
    fillColorEl.classList.toggle('hidden', !hasFill);
    if (hasFill) fillColorEl.value = config.fillColor;
    outlineToggle.checked = !!config.outline;
    outlineControls.classList.toggle('hidden', !config.outline);
    outlineWidthEl.value = config.outlineWidth ?? 2;
    outlineColorEl.value = config.outlineColor || '#000000';
    glowToggle.checked = !!config.glow;
    glowColorEl.classList.toggle('hidden', !config.glow);
    glowColorEl.value = config.glowColor || '#6c8cff';

    posX.value = config.x;
    posY.value = config.y;
    const posRadio = document.querySelector(`input[name="position"][value="${config.positionMode || 'center'}"]`);
    if (posRadio) posRadio.checked = true;
    pixelInputs.classList.toggle('hidden', config.positionMode !== 'pixel');
    if (config.customDir) {
      customDirLabel.textContent = config.customDir;
      customDirLabel.title = config.customDir;
      window.dilates.getCustomCrosshairs(config.customDir).then(renderCustom);
    }

    // Overlay switch (also syncs when toggled via hotkey or tray)
    overlayToggle.checked = !!config.overlayOn;
    setOverlayStatus(!!config.overlayOn);

    // General
    allDisplaysToggle.checked = !!config.showOnAllDisplays;
    trayToggle.checked = config.tray !== false;
    if (document.activeElement !== toggleHotkeyEl) {
      toggleHotkeyEl.value = config.toggleHotkey || '';
    }

    renderProfiles();
    markSelection();
    renderDisplays(displays);
    updatePreview();
  }

  window.dilates.onConfig(syncFromConfig);
  window.dilates.onDisplays(renderDisplays);

  // ---------- Init ----------
  Promise.all([
    window.dilates.getConfig(),
    window.dilates.getBuiltinCrosshairs(),
    window.dilates.getDisplays(),
  ]).then(([c, builtin, displayInfo]) => {
    config = { ...config, ...c };
    if (builtin.length && !config.crosshair) config.crosshair = builtin[0];
    renderBuiltin(builtin);
    renderDisplays(displayInfo);
    syncFromConfig(config);
  });
})();
