(() => {
  'use strict';

  const DEFAULT_SETTINGS = {
    enabled: true,
    palette: 'carbon',
    mode: 'smart',
    brightness: 100,
    contrast: 100,
    warmth: 0
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let feedbackTimer = null;

  const enabledToggle = document.getElementById('enabledToggle');
  const statusBadge = document.getElementById('statusBadge');
  const controlsArea = document.getElementById('controlsArea');
  const brightnessRange = document.getElementById('brightnessRange');
  const contrastRange = document.getElementById('contrastRange');
  const warmthRange = document.getElementById('warmthRange');
  const brightnessVal = document.getElementById('brightnessVal');
  const contrastVal = document.getElementById('contrastVal');
  const warmthVal = document.getElementById('warmthVal');
  const resetBtn = document.getElementById('resetBtn');
  const injectBtn = document.getElementById('injectBtn');
  const feedbackMsg = document.getElementById('feedbackMsg');

  function showFeedback(text, isError = false) {
    feedbackMsg.textContent = text;
    feedbackMsg.classList.toggle('error', isError);
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
    }
    feedbackTimer = setTimeout(() => {
      feedbackMsg.textContent = '';
      feedbackMsg.classList.remove('error');
    }, 3000);
  }

  function renderUI(settings) {
    currentSettings = { ...DEFAULT_SETTINGS, ...settings, palette: 'carbon' };

    enabledToggle.checked = Boolean(currentSettings.enabled);
    statusBadge.textContent = currentSettings.enabled ? 'Active' : 'Inactive';
    statusBadge.classList.toggle('active', Boolean(currentSettings.enabled));
    controlsArea.classList.toggle('disabled', !currentSettings.enabled);

    brightnessRange.value = currentSettings.brightness;
    contrastRange.value = currentSettings.contrast;
    warmthRange.value = currentSettings.warmth;

    brightnessVal.textContent = `${currentSettings.brightness}%`;
    contrastVal.textContent = `${currentSettings.contrast}%`;
    warmthVal.textContent = `${currentSettings.warmth}%`;
  }

  function saveAndBroadcast(partialUpdate) {
    currentSettings = { ...currentSettings, ...partialUpdate, mode: 'smart', palette: 'carbon' };
    renderUI(currentSettings);

    const storageArea = chrome.storage.sync || chrome.storage.local;
    storageArea.set(currentSettings, () => {
      if (chrome.runtime.lastError && chrome.storage.local) {
        chrome.storage.local.set(currentSettings);
      }
    });

    sendSettingsToActiveTab(currentSettings);
  }

  function sendSettingsToActiveTab(settings) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || typeof tab.id !== 'number') return;

      chrome.tabs.sendMessage(
        tab.id,
        { type: 'PAW_UPDATE_SETTINGS', settings },
        () => {
          // Content script henüz yüklü değilse sessizce yoksay
          void chrome.runtime.lastError;
        }
      );
    });
  }

  async function applyToActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs && tabs[0];

      if (!tab || typeof tab.id !== 'number') {
        showFeedback('Active tab not found.', true);
        return;
      }

      const url = tab.url || '';
      if (!url || /^(chrome|edge|about|chrome-extension):/i.test(url)) {
        showFeedback('Theme cannot be applied to this browser page.', true);
        return;
      }

      // Kullanıcı "Mevcut Sekmeye Uygula" dediğinde tema kapalıysa otomatik aktif et
      if (!currentSettings.enabled) {
        saveAndBroadcast({ enabled: true });
      }

      const alreadyInjected = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'PAW_GET_STATUS' }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(Boolean(resp && resp.ok));
        });
      });

      if (!alreadyInjected) {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id, allFrames: true },
          files: ['dark-theme.css']
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['canvas-theme.js'],
          world: 'MAIN'
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.js']
        });
      }

      // Sayfa yenilemelerinde (F5) kalıcı olması için dinamik içerik betiği kaydet
      let persisted = false;
      try {
        const parsedUrl = new URL(url);
        const originPattern = `${parsedUrl.origin}/*`;
        const scriptId = `paw-dark-custom-${parsedUrl.hostname.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;
        const canvasScriptId = `${scriptId}-canvas`;

        let hasPerm = true;
        if (chrome.permissions && chrome.permissions.contains) {
          hasPerm = await chrome.permissions.contains({ origins: [originPattern] });
          if (!hasPerm && chrome.permissions.request) {
            hasPerm = await chrome.permissions.request({ origins: [originPattern] });
          }
        }

        if (hasPerm && chrome.scripting.registerContentScripts) {
          const existing = await chrome.scripting.getRegisteredContentScripts({
            ids: [scriptId, canvasScriptId]
          });
          const existingIds = new Set((existing || []).map((s) => s.id));
          const toRegister = [];

          if (!existingIds.has(canvasScriptId)) {
            toRegister.push({
              id: canvasScriptId,
              matches: [originPattern],
              js: ['canvas-theme.js'],
              runAt: 'document_start',
              world: 'MAIN',
              allFrames: true,
              persistAcrossSessions: true
            });
          }

          if (!existingIds.has(scriptId)) {
            toRegister.push({
              id: scriptId,
              matches: [originPattern],
              css: ['dark-theme.css'],
              js: ['content.js'],
              runAt: 'document_start',
              allFrames: true,
              persistAcrossSessions: true
            });
          }

          if (toRegister.length > 0) {
            await chrome.scripting.registerContentScripts(toRegister);
          }
          persisted = true;
        }
      } catch (_persistErr) {
        persisted = false;
      }

      sendSettingsToActiveTab(currentSettings);
      showFeedback(
        persisted
          ? 'Theme applied and saved for this domain!'
          : 'Dark theme applied to the current tab!'
      );
    } catch (err) {
      showFeedback(`Failed to apply theme: ${err && err.message ? err.message : 'Unknown error'}`, true);
    }
  }

  // Olay Dinleyicileri
  enabledToggle.addEventListener('change', () => {
    saveAndBroadcast({ enabled: enabledToggle.checked });
  });

  brightnessRange.addEventListener('input', () => {
    saveAndBroadcast({ brightness: Number(brightnessRange.value) });
  });

  contrastRange.addEventListener('input', () => {
    saveAndBroadcast({ contrast: Number(contrastRange.value) });
  });

  warmthRange.addEventListener('input', () => {
    saveAndBroadcast({ warmth: Number(warmthRange.value) });
  });

  resetBtn.addEventListener('click', () => {
    saveAndBroadcast({ ...DEFAULT_SETTINGS });
    showFeedback('Settings reset to defaults.');
  });

  injectBtn.addEventListener('click', () => {
    applyToActiveTab();
  });

  // Başlangıçta kayıtlı ayarları yükle
  const storageArea = chrome.storage.sync || chrome.storage.local;
  storageArea.get(DEFAULT_SETTINGS, (items) => {
    if (chrome.runtime.lastError && chrome.storage.local) {
      chrome.storage.local.get(DEFAULT_SETTINGS, (localItems) => {
        renderUI(localItems || DEFAULT_SETTINGS);
      });
      return;
    }
    renderUI(items || DEFAULT_SETTINGS);
  });
})();
