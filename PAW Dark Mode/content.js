(() => {
  'use strict';

  if (window.__pawDarkModeInitialized) {
    return;
  }
  window.__pawDarkModeInitialized = true;

  const DEFAULT_SETTINGS = {
    enabled: true,
    palette: 'carbon',
    mode: 'smart',
    brightness: 100,
    contrast: 100,
    warmth: 0
  };

  const SHADOW_CSS = `
    :host { color-scheme: dark; }
    button.push-button,
    button.bx--btn {
      background-color: transparent !important;
      color: var(--paw-text-primary, #e8e8e8) !important;
      border-color: transparent !important;
    }
    button.push-button:hover,
    button.bx--btn:hover {
      background-color: var(--paw-bg-hover, #333333) !important;
    }
    :host(.is-checked) button.push-button,
    button.push-button[aria-pressed="true"],
    button.push-button[aria-selected="true"] {
      background-color: var(--paw-bg-selected, #263449) !important;
      color: #ffffff !important;
      border-color: transparent !important;
    }
    svg.ba-common-svgIcon,
    svg.svgIcon,
    svg:not([fill="none"]) {
      fill: currentColor !important;
      color: var(--paw-text-primary, #e8e8e8) !important;
    }
    svg use {
      fill: currentColor !important;
    }
    [data-paw-bg="1"] { background-color: var(--paw-bg-base, #161616) !important; }
    [data-paw-bg="2"] { background-color: var(--paw-bg-surface, #1c1c1c) !important; }
    [data-paw-bg="3"] { background-color: var(--paw-bg-layer, #262626) !important; }
    [data-paw-bg="active"] { background-color: var(--paw-bg-selected, #263449) !important; color: #ffffff !important; }
    [data-paw-hover-bg="1"] { background-color: var(--paw-bg-hover, #333333) !important; color: var(--paw-text-primary, #e8e8e8) !important; }
    [data-paw-bg="transparent"] { background-color: transparent !important; }
    [data-paw-text="1"] { color: var(--paw-text-primary, #e8e8e8) !important; }
    [data-paw-text="2"] { color: var(--paw-text-secondary, #c6c6c6) !important; }
    [data-paw-text="link"] { color: var(--paw-link, #78a9ff) !important; }
    [data-paw-border="1"] { border-color: var(--paw-border-subtle, #393939) !important; }
    [data-paw-bt="1"] { border-top-color: var(--paw-border-subtle, #393939) !important; }
    [data-paw-br="1"] { border-right-color: var(--paw-border-subtle, #393939) !important; }
    [data-paw-bb="1"] { border-bottom-color: var(--paw-border-subtle, #393939) !important; }
    [data-paw-bl="1"] { border-left-color: var(--paw-border-subtle, #393939) !important; }
    [data-paw-svg-fill="light"] { fill: var(--paw-text-primary, #e8e8e8) !important; color: var(--paw-text-primary, #e8e8e8) !important; }
    [data-paw-svg-stroke="light"] { stroke: var(--paw-text-primary, #e8e8e8) !important; }
    [data-paw-fill="transparent"] { fill: transparent !important; }
  `;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'BR', 'HR', 'HEAD', 'TITLE'
  ]);

  const CARBON_LIGHT_CLASSES = ['carbon-theme-white', 'carbon-theme-g10', 'carbon-theme-g90'];

  let currentSettings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let shadowObservers = [];
  let hookedShadowRoots = new WeakSet();
  const activeShadowRoots = new Set();
  let hookedShadowStyles = new Set();
  let processedSheets = new WeakSet();
  let dynamicStyleEl = null;
  let dynamicCssBuffer = [];
  let lastHoverTarget = null;

  const pendingQueue = new Map(); // Element -> boolean (forceRecheck)
  let batchScheduled = false;
  let sheetScanScheduled = false;

  const root = document.documentElement;
  const DARK_SCOPE = 'html[data-paw-dark="true"]';

  // ---------------- Renk Yardımcıları ----------------

  const NAMED_COLORS = {
    transparent: [0, 0, 0, 0],
    white: [255, 255, 255, 1],
    snow: [255, 250, 250, 1],
    ivory: [255, 255, 240, 1],
    whitesmoke: [245, 245, 245, 1],
    ghostwhite: [248, 248, 255, 1],
    aliceblue: [240, 248, 255, 1],
    gainsboro: [220, 220, 220, 1],
    lightgray: [211, 211, 211, 1],
    lightgrey: [211, 211, 211, 1],
    silver: [192, 192, 192, 1],
    darkgray: [169, 169, 169, 1],
    darkgrey: [169, 169, 169, 1],
    gray: [128, 128, 128, 1],
    grey: [128, 128, 128, 1],
    dimgray: [105, 105, 105, 1],
    dimgrey: [105, 105, 105, 1],
    black: [0, 0, 0, 1],
    red: [255, 0, 0, 1],
    blue: [0, 0, 255, 1],
    darkblue: [0, 0, 139, 1],
    navy: [0, 0, 128, 1],
    green: [0, 128, 0, 1],
    purple: [128, 0, 128, 1]
  };

  const COLOR_CACHE = new Map();
  const MAX_COLOR_CACHE = 512;

  function cacheParsedColor(key, val) {
    if (COLOR_CACHE.size >= MAX_COLOR_CACHE) {
      COLOR_CACHE.clear();
    }
    COLOR_CACHE.set(key, val);
    return val;
  }

  function parseColor(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;
    if (COLOR_CACHE.has(colorStr)) return COLOR_CACHE.get(colorStr);

    const s = colorStr.trim().toLowerCase();
    if (!s || s === 'none' || s === 'inherit' || s === 'initial' || s === 'unset' || s === 'currentcolor') {
      return cacheParsedColor(colorStr, null);
    }
    if (NAMED_COLORS[s]) return cacheParsedColor(colorStr, NAMED_COLORS[s]);

    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
        return cacheParsedColor(colorStr, Number.isNaN(r) ? null : [r, g, b, a]);
      }
      if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return cacheParsedColor(colorStr, Number.isNaN(r) ? null : [r, g, b, a]);
      }
      return cacheParsedColor(colorStr, null);
    }

    const rgbMatch = s.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (rgbMatch) {
      const r = Number(rgbMatch[1]);
      const g = Number(rgbMatch[2]);
      const b = Number(rgbMatch[3]);
      let a = 1;
      if (rgbMatch[4] !== undefined) {
        a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : Number(rgbMatch[4]);
      }
      return cacheParsedColor(colorStr, [r, g, b, a]);
    }

    const hslMatch = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (hslMatch) {
      const h = ((Number(hslMatch[1]) % 360) + 360) % 360;
      const sat = Math.max(0, Math.min(1, Number(hslMatch[2]) / 100));
      const lig = Math.max(0, Math.min(1, Number(hslMatch[3]) / 100));
      let a = 1;
      if (hslMatch[4] !== undefined) {
        a = hslMatch[4].endsWith('%') ? parseFloat(hslMatch[4]) / 100 : Number(hslMatch[4]);
      }
      const c = (1 - Math.abs(2 * lig - 1)) * sat;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = lig - c / 2;
      let r1 = 0, g1 = 0, b1 = 0;
      if (h < 60) { r1 = c; g1 = x; }
      else if (h < 120) { r1 = x; g1 = c; }
      else if (h < 180) { g1 = c; b1 = x; }
      else if (h < 240) { g1 = x; b1 = c; }
      else if (h < 300) { r1 = x; b1 = c; }
      else { r1 = c; b1 = x; }
      return cacheParsedColor(colorStr, [
        Math.round((r1 + m) * 255),
        Math.round((g1 + m) * 255),
        Math.round((b1 + m) * 255),
        a
      ]);
    }

    return cacheParsedColor(colorStr, null);
  }

  function resolveCssVarFallbacks(rawValue) {
    if (!rawValue || typeof rawValue !== 'string') return rawValue;
    if (!rawValue.includes('var(')) return rawValue;

    let result = '';
    let i = 0;
    while (i < rawValue.length) {
      const idx = rawValue.indexOf('var(', i);
      if (idx === -1) {
        result += rawValue.slice(i);
        break;
      }
      result += rawValue.slice(i, idx);

      let depth = 1;
      let j = idx + 4;
      let commaPos = -1;
      while (j < rawValue.length && depth > 0) {
        const ch = rawValue[j];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if (ch === ',' && depth === 1 && commaPos === -1) commaPos = j;
        j++;
      }
      if (depth !== 0 || commaPos === -1) {
        return null;
      }
      const fallback = rawValue.slice(commaPos + 1, j - 1).trim();
      const resolvedFallback = resolveCssVarFallbacks(fallback);
      if (!resolvedFallback) return null;
      result += resolvedFallback;
      i = j;
    }
    return result;
  }

  function parseCssColorValue(rawValue) {
    if (!rawValue) return null;
    const resolved = resolveCssVarFallbacks(rawValue);
    if (!resolved) return null;
    return parseColor(resolved);
  }

  function isTransparent(rgba) {
    return !rgba || rgba[3] < 0.05;
  }

  function isNeutralLight(rgba, minThreshold = 195) {
    if (!rgba || rgba[3] < 0.05) return false;
    const min = Math.min(rgba[0], rgba[1], rgba[2]);
    const max = Math.max(rgba[0], rgba[1], rgba[2]);
    return min >= minThreshold && (max - min) <= 30;
  }

  function isLightBlueTint(rgba) {
    if (!rgba || rgba[3] < 0.05) return false;
    const min = Math.min(rgba[0], rgba[1], rgba[2]);
    return rgba[2] > rgba[0] + 15 && min >= 190;
  }

  function isNeutralDark(rgba, maxThreshold = 115) {
    if (!rgba || rgba[3] < 0.25) return false;
    const min = Math.min(rgba[0], rgba[1], rgba[2]);
    const max = Math.max(rgba[0], rgba[1], rgba[2]);
    return max <= maxThreshold && (max - min) <= 30;
  }

  function isDarkBlue(rgba) {
    if (!rgba || rgba[3] < 0.25) return false;
    return rgba[2] > rgba[0] + 40 && rgba[2] > 100 && rgba[0] < 40;
  }

  // CodeMirror 6 açık sözdizimi renklerini VS Code Dark+ tonlarına çevirir
  function mapCodeSyntaxColor(rgba) {
    if (!rgba || rgba[3] < 0.25) return null;
    const [r, g, b] = rgba;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (max <= 70 && max - min <= 25) return '#d4d8e2';
    if (max <= 140 && max - min <= 25) return '#9da5b4';
    if (r >= 130 && b >= 160 && g <= 80) return '#c586c0';
    if (r >= 200 && g <= 60 && b <= 60) return '#ff7b72';
    if (r >= 120 && r <= 215 && g <= 80 && b <= 80) return '#ce9178';
    if (b >= 140 && g >= 70 && r <= 70) return '#79c0ff';
    if (b >= 190 && g <= 60 && r <= 60) return '#569cd6';
    if (b >= 100 && b < 190 && g <= 60 && r <= 60) return '#9cdcfe';
    if (g >= 95 && r <= 70 && b <= 70) return '#6a9955';
    return null;
  }

  // ---------------- Carbon G100 Sınıf Senkronizasyonu ----------------

  function syncCarbonThemeClass(enabled) {
    if (!root || !root.classList || typeof root.classList.contains !== 'function') return;

    if (enabled) {
      let capturedOrig = null;
      for (let i = 0; i < CARBON_LIGHT_CLASSES.length; i++) {
        const cls = CARBON_LIGHT_CLASSES[i];
        if (root.classList.contains(cls)) {
          if (!capturedOrig) capturedOrig = cls;
          root.classList.remove(cls);
        }
      }
      if (capturedOrig && !root.hasAttribute('data-paw-orig-carbon-class')) {
        root.setAttribute('data-paw-orig-carbon-class', capturedOrig);
      }
      if (!root.classList.contains('carbon-theme-g100')) {
        root.setAttribute('data-paw-added-g100', '1');
        root.classList.add('carbon-theme-g100');
      }
    } else {
      const orig = root.getAttribute('data-paw-orig-carbon-class');
      if (orig || root.hasAttribute('data-paw-added-g100')) {
        root.classList.remove('carbon-theme-g100');
        root.removeAttribute('data-paw-added-g100');
      }
      if (orig) {
        root.classList.add(orig);
        root.removeAttribute('data-paw-orig-carbon-class');
      }
    }
  }

  // ---------------- CSSOM Stil Sayfası Tarayıcısı ----------------

  function splitTopLevelCommas(selectorText) {
    const parts = [];
    let current = '';
    let parenDepth = 0;
    let bracketDepth = 0;
    let quote = null;

    for (let i = 0; i < selectorText.length; i++) {
      const ch = selectorText[i];
      if (quote) {
        current += ch;
        if (ch === quote && selectorText[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        current += ch;
      } else if (ch === '(') {
        parenDepth++;
        current += ch;
      } else if (ch === ')') {
        if (parenDepth > 0) parenDepth--;
        current += ch;
      } else if (ch === '[') {
        bracketDepth++;
        current += ch;
      } else if (ch === ']') {
        if (bracketDepth > 0) bracketDepth--;
        current += ch;
      } else if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  function scopeSelector(selectorText) {
    if (!selectorText || selectorText.includes('data-paw-')) return null;
    const parts = splitTopLevelCommas(selectorText);
    const scoped = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      if (/^(?:html|:root)(?=[\s.:[#>,+~]|$)/i.test(part)) {
        scoped.push(part.replace(/^(?:html|:root)/i, DARK_SCOPE));
      } else {
        scoped.push(`${DARK_SCOPE} ${part}`);
      }
    }
    return scoped.length ? scoped.join(', ') : null;
  }

  function inspectCssRules(cssRules, outLines) {
    for (let i = 0; i < cssRules.length; i++) {
      const rule = cssRules[i];

      if (rule.type === CSSRule.STYLE_RULE) {
        if (!rule.selectorText) continue;

        // PAW'ın yerleşik Carbon tema bloklarını yeniden yazma (G100 zaten etkinleştirilir)
        if (/\.(?:carbon-theme-(?:white|g10|g90|g100)|cds--(?:white|g10|g90|g100)|bx--(?:white|g10))\b/i.test(rule.selectorText)) {
          continue;
        }

        const selector = scopeSelector(rule.selectorText);
        if (!selector) continue;

        const style = rule.style;
        const decls = [];
        const isSyntaxRule = /(?:[\u037b-\u037d][0-9a-z_-]+|\.cm-(?!editor|gutters|scroller|content|line|activeLine|selectionBackground|selectionLayer|cursor)|\.CodeMirror-|\.ace_|\.mtk)/i.test(rule.selectorText);

        // Arka plan kontrolü
        const isProtectedComponentRule = /(?:\.cm-selectionBackground|\.cm-selectionLayer|\.cm-content|\.cm-line|\.cm-activeLine|\.cm-cursor|\.view-overlays|\.selected-text|\.ace_selection|\.CodeMirror-selected|\.pa--dimensionoverview)/i.test(rule.selectorText);
        const isTreeItemChildRule = /\.(?:ba-common-treeItem|ba-common-listItem)(?:[^\s,>~+]*)\s+[^\s,]/i.test(rule.selectorText);
        let bgStr = style.backgroundColor;
        if (!bgStr && style.background && !/url\(|gradient\(/i.test(style.background)) {
          bgStr = style.background;
        }
        const isHoverRule = /:(?:hover|focus|active)/i.test(rule.selectorText);
        const bgRgba = (!isProtectedComponentRule && !isTreeItemChildRule) ? parseCssColorValue(bgStr) : null;
        if (bgRgba && !isTransparent(bgRgba)) {
          if (isLightBlueTint(bgRgba)) {
            decls.push('background-color: var(--paw-bg-selected) !important;');
          } else if (isNeutralLight(bgRgba, isHoverRule ? 165 : 195)) {
            const minRgb = Math.min(bgRgba[0], bgRgba[1], bgRgba[2]);
            const looksSelected = /(?:active|selected|aria-selected|aria-pressed|--current)/i.test(rule.selectorText);
            if (isHoverRule) {
              decls.push('background-color: var(--paw-bg-hover) !important;');
            } else if (looksSelected && /button|tab|nav|rail|toolbar|menu/i.test(rule.selectorText)) {
              decls.push('background-color: var(--paw-bg-selected) !important;');
            } else if (minRgb >= 248) {
              decls.push('background-color: var(--paw-bg-base) !important;');
            } else if (minRgb >= 232) {
              decls.push('background-color: var(--paw-bg-surface) !important;');
            } else {
              decls.push('background-color: var(--paw-bg-layer) !important;');
            }
          }
        }

        // Metin rengi veya CM6 sözdizimi rengi kontrolü
        const colorRgba = parseCssColorValue(style.color);
        if (colorRgba) {
          if (isSyntaxRule) {
            const mappedSyntax = mapCodeSyntaxColor(colorRgba);
            if (mappedSyntax) {
              decls.push(`color: ${mappedSyntax} !important;`);
            }
          } else if (isNeutralDark(colorRgba, 115)) {
            const maxRgb = Math.max(colorRgba[0], colorRgba[1], colorRgba[2]);
            decls.push(
              maxRgb <= 55
                ? 'color: var(--paw-text-primary) !important;'
                : 'color: var(--paw-text-secondary) !important;'
            );
          } else if (isDarkBlue(colorRgba)) {
            decls.push('color: var(--paw-accent) !important;');
          }
        }

        // Kenarlık rengi kontrolü
        if (!isProtectedComponentRule && !isSyntaxRule) {
          const borderTargets = [
            ['borderColor', 'border-color'],
            ['borderTopColor', 'border-top-color'],
            ['borderRightColor', 'border-right-color'],
            ['borderBottomColor', 'border-bottom-color'],
            ['borderLeftColor', 'border-left-color']
          ];
          for (let b = 0; b < borderTargets.length; b++) {
            const [propKey, cssName] = borderTargets[b];
            const bRgba = parseCssColorValue(style[propKey]);
            if (bRgba && isNeutralLight(bRgba, 190)) {
              decls.push(`${cssName}: var(--paw-border-subtle) !important;`);
            }
          }
        }

        // SVG fill / stroke kontrolü
        const fillRgba = parseCssColorValue(style.fill);
        if (fillRgba && isNeutralDark(fillRgba, 120)) {
          decls.push('fill: var(--paw-text-primary) !important;');
        }
        const strokeRgba = parseCssColorValue(style.stroke);
        if (strokeRgba && isNeutralDark(strokeRgba, 120)) {
          decls.push('stroke: var(--paw-text-primary) !important;');
        }

        if (decls.length > 0) {
          outLines.push(`${selector} { ${decls.join(' ')} }`);
        }
      } else if (rule.type === CSSRule.MEDIA_RULE && rule.cssRules) {
        const inner = [];
        inspectCssRules(rule.cssRules, inner);
        if (inner.length > 0) {
          const mediaText = rule.conditionText || (rule.media && rule.media.mediaText) || 'all';
          outLines.push(`@media ${mediaText} {\n${inner.join('\n')}\n}`);
        }
      } else if (typeof CSSRule.SUPPORTS_RULE !== 'undefined' && rule.type === CSSRule.SUPPORTS_RULE && rule.cssRules) {
        const inner = [];
        inspectCssRules(rule.cssRules, inner);
        if (inner.length > 0) {
          outLines.push(`@supports ${rule.conditionText} {\n${inner.join('\n')}\n}`);
        }
      } else if (rule.cssRules) {
        inspectCssRules(rule.cssRules, outLines);
      }
    }
  }

  function ensureDynamicStyleElement() {
    if (dynamicStyleEl && dynamicStyleEl.isConnected) return dynamicStyleEl;
    dynamicStyleEl = document.getElementById('paw-dynamic-dark-styles');
    if (!dynamicStyleEl) {
      dynamicStyleEl = document.createElement('style');
      dynamicStyleEl.id = 'paw-dynamic-dark-styles';
      const targetParent = document.head || root;
      targetParent.insertBefore(dynamicStyleEl, targetParent.firstChild);
    }
    return dynamicStyleEl;
  }

  function processStyleSheets() {
    if (!currentSettings.enabled) {
      if (dynamicStyleEl) dynamicStyleEl.disabled = true;
      return;
    }

    const sheets = document.styleSheets;
    if (!sheets || sheets.length === 0) return;

    const newLines = [];
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      if (processedSheets.has(sheet)) continue;

      const ownerNode = sheet.ownerNode;
      if (ownerNode && (ownerNode.id === 'paw-dynamic-dark-styles' || (ownerNode.href && ownerNode.href.includes('dark-theme.css')))) {
        processedSheets.add(sheet);
        continue;
      }

      try {
        const rules = sheet.cssRules;
        if (!rules || rules.length === 0) continue;
        processedSheets.add(sheet);
        inspectCssRules(rules, newLines);
      } catch (_crossOriginErr) {
        processedSheets.add(sheet);
      }
    }

    const styleEl = ensureDynamicStyleElement();
    styleEl.disabled = false;

    if (newLines.length > 0) {
      dynamicCssBuffer.push(...newLines);
      styleEl.textContent = dynamicCssBuffer.join('\n');
    }
  }

  function scheduleSheetScan() {
    if (sheetScanScheduled) return;
    sheetScanScheduled = true;
    setTimeout(() => {
      sheetScanScheduled = false;
      processStyleSheets();
    }, 60);
  }

  // ---------------- Shadow DOM Desteği ----------------

  function hookShadowRoot(sr) {
    if (!sr || hookedShadowRoots.has(sr)) return;
    hookedShadowRoots.add(sr);
    activeShadowRoots.add(sr);

    let style = sr.querySelector('style[data-paw-shadow-style]');
    if (!style) {
      style = document.createElement('style');
      style.setAttribute('data-paw-shadow-style', 'true');
      style.textContent = SHADOW_CSS;
      sr.appendChild(style);
    } else {
      style.disabled = false;
    }
    hookedShadowStyles.add(style);

    const srObserver = new MutationObserver((mutations) => {
      if (!currentSettings.enabled) return;
      handleMutations(mutations);
    });
    srObserver.observe(sr, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-carbon-theme', 'aria-selected', 'aria-pressed']
    });
    shadowObservers.push(srObserver);

    for (let i = 0; i < sr.children.length; i++) {
      enqueueSubtree(sr.children[i], false);
    }
  }

  // ---------------- SVG İkon & İllüstrasyon İşleyicisi ----------------

  function isUiIconSvg(svgEl) {
    const rect = svgEl.getBoundingClientRect();
    const w = rect.width || parseFloat(svgEl.getAttribute('width')) || 0;
    const h = rect.height || parseFloat(svgEl.getAttribute('height')) || 0;

    if (w > 0 && w <= 40 && h <= 40) return true;
    if (svgEl.closest('button, [role="button"], [role="tab"], [role="treeitem"], [role="menuitem"], header, nav, aside, [class*="toolbar"], [class*="icon"], [class*="action"]')) {
      return w <= 48 && h <= 48;
    }
    return false;
  }

  function scrubSvgElement(svgEl) {
    const svgComp = window.getComputedStyle(svgEl);
    const svgBg = parseColor(svgComp.backgroundColor);
    if (svgBg && isNeutralLight(svgBg, 195)) {
      svgEl.setAttribute('data-paw-bg', 'transparent');
    }

    const shapes = svgEl.querySelectorAll('path, rect, circle, polygon, line, polyline, ellipse, use');

    if (isUiIconSvg(svgEl)) {
      const rootFillAttr = svgEl.getAttribute('fill');
      if (rootFillAttr !== 'none' && rootFillAttr !== 'transparent') {
        const rootFill = parseColor(svgComp.fill);
        if (rootFill && isNeutralDark(rootFill, 120)) {
          svgEl.setAttribute('data-paw-svg-fill', 'light');
        }
      }
      const rootStrokeAttr = svgEl.getAttribute('stroke');
      if (rootStrokeAttr !== 'none' && rootStrokeAttr !== 'transparent') {
        const rootStroke = parseColor(svgComp.stroke);
        if (rootStroke && isNeutralDark(rootStroke, 120)) {
          svgEl.setAttribute('data-paw-svg-stroke', 'light');
        }
      }

      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        if (shape.id === '_Transparent_Rectangle_') continue;

        const fillAttr = shape.getAttribute('fill');
        if (fillAttr !== 'none' && fillAttr !== 'transparent') {
          const shapeComp = window.getComputedStyle(shape);
          if (shapeComp.opacity !== '0') {
            const fillRgba = parseColor(shapeComp.fill);
            if (fillRgba && isNeutralDark(fillRgba, 120)) {
              shape.setAttribute('data-paw-svg-fill', 'light');
            }
          }
        }

        const strokeAttr = shape.getAttribute('stroke');
        if (strokeAttr !== 'none' && strokeAttr !== 'transparent') {
          const shapeComp = window.getComputedStyle(shape);
          if (shapeComp.opacity !== '0') {
            const strokeRgba = parseColor(shapeComp.stroke);
            if (strokeRgba && isNeutralDark(strokeRgba, 120)) {
              shape.setAttribute('data-paw-svg-stroke', 'light');
            }
          }
        }
      }
    } else {
      const svgRect = svgEl.getBoundingClientRect();
      const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
      const refW = (vb && vb.width) || svgRect.width || 0;
      const refH = (vb && vb.height) || svgRect.height || 0;

      for (let i = 0; i < shapes.length; i++) {
        const shape = shapes[i];
        const tag = shape.tagName.toLowerCase();
        if (tag !== 'rect' && tag !== 'path') continue;

        const shapeComp = window.getComputedStyle(shape);
        const fillRgba = parseColor(shapeComp.fill);
        if (!fillRgba || !isNeutralLight(fillRgba, 225)) continue;

        if (tag === 'rect') {
          const rw = parseFloat(shape.getAttribute('width')) || shape.getBoundingClientRect().width;
          const rh = parseFloat(shape.getAttribute('height')) || shape.getBoundingClientRect().height;
          if ((refW > 0 && rw >= refW * 0.6 && rh >= refH * 0.6) || (rw >= 120 && rh >= 120)) {
            if (!shape.hasAttribute('data-paw-orig-fill')) {
              shape.setAttribute('data-paw-orig-fill', shape.getAttribute('fill') || '');
            }
            shape.setAttribute('data-paw-fill', 'transparent');
          }
        }
      }
    }
  }

  function scrubSpriteSymbols(scopeRoot) {
    if (!scopeRoot || !scopeRoot.querySelectorAll) return;
    const symbols = scopeRoot.querySelectorAll('symbol, defs');
    for (let i = 0; i < symbols.length; i++) {
      const sym = symbols[i];
      const nodes = sym.querySelectorAll('path, rect, circle, polygon, line, polyline, ellipse, g');
      for (let j = 0; j < nodes.length; j++) {
        const node = nodes[j];
        if (node.id === '_Transparent_Rectangle_') continue;

        const fillAttr = node.getAttribute('fill');
        const tagLower = node.tagName.toLowerCase();
        const strokeAttr = node.getAttribute('stroke');
        if (fillAttr && fillAttr !== 'none' && fillAttr !== 'transparent' && fillAttr !== 'currentColor') {
          const fillRgba = parseColor(fillAttr);
          if (fillRgba && isNeutralDark(fillRgba, 120)) {
            if (!node.hasAttribute('data-paw-orig-fill')) {
              node.setAttribute('data-paw-orig-fill', fillAttr);
            }
            node.setAttribute('fill', 'currentColor');
          }
        } else if (
          fillAttr === null &&
          !strokeAttr &&
          (tagLower === 'path' || tagLower === 'rect' || tagLower === 'circle' || tagLower === 'polygon') &&
          !node.closest('[fill="none"]')
        ) {
          if (!node.hasAttribute('data-paw-orig-fill')) {
            node.setAttribute('data-paw-orig-fill', '');
          }
          node.setAttribute('fill', 'currentColor');
        }
        const styleFill = node.style && node.style.fill;
        if (styleFill && styleFill !== 'none' && styleFill !== 'transparent' && styleFill !== 'currentColor') {
          const sFillRgba = parseColor(styleFill);
          if (sFillRgba && isNeutralDark(sFillRgba, 120)) {
            if (!node.hasAttribute('data-paw-orig-style-fill')) {
              node.setAttribute('data-paw-orig-style-fill', styleFill);
            }
            node.style.setProperty('fill', 'currentColor', 'important');
          }
        }

        if (strokeAttr && strokeAttr !== 'none' && strokeAttr !== 'transparent' && strokeAttr !== 'currentColor') {
          const strokeRgba = parseColor(strokeAttr);
          if (strokeRgba && isNeutralDark(strokeRgba, 120)) {
            if (!node.hasAttribute('data-paw-orig-stroke')) {
              node.setAttribute('data-paw-orig-stroke', strokeAttr);
            }
            node.setAttribute('stroke', 'currentColor');
          }
        }
        const styleStroke = node.style && node.style.stroke;
        if (styleStroke && styleStroke !== 'none' && styleStroke !== 'transparent' && styleStroke !== 'currentColor') {
          const sStrokeRgba = parseColor(styleStroke);
          if (sStrokeRgba && isNeutralDark(sStrokeRgba, 120)) {
            if (!node.hasAttribute('data-paw-orig-style-stroke')) {
              node.setAttribute('data-paw-orig-style-stroke', styleStroke);
            }
            node.style.setProperty('stroke', 'currentColor', 'important');
          }
        }
      }
    }
  }

  const EMPTY_STATE_GRAY_MAP = {
    '#f3f3f3': '#52525c',
    '#f4f4f4': '#52525c',
    '#dcdcdc': '#3f3f48',
    '#bebebe': '#2c2c34',
    '#bdbdbd': '#2c2c34',
    '#bcbcbc': '#2c2c34',
    '#a4a4a4': '#363640',
    '#a1a1a1': '#363640',
    '#a0a0a0': '#363640',
    '#919191': '#5e5e6b',
    '#8c8c8c': '#5e5e6b',
    '#8b8b8b': '#5e5e6b',
    '#6f6f6f': '#4a4a55',
    '#565656': '#62626f',
    '#4d4d4d': '#464652',
    '#3d3d3d': '#7a7a88',
    '#353535': '#383842',
    '#282828': '#26262f',
    '#171717': '#18181f'
  };

  const EMPTY_STATE_GRAY_RE = /#(?:f3f3f3|f4f4f4|dcdcdc|bebebe|bdbdbd|bcbcbc|a4a4a4|a1a1a1|a0a0a0|919191|8c8c8c|8b8b8b|6f6f6f|565656|4d4d4d|3d3d3d|353535|282828|171717)\b/gi;

  // data:image/svg+xml illüstrasyonlarındaki sabit beyaz arka plan dikdörtgenini temizler
  function scrubDataUriSvgImage(imgEl) {
    if (!imgEl || imgEl.tagName.toLowerCase() !== 'img') return;
    const src = imgEl.getAttribute('src') || '';
    if (!src.startsWith('data:image/svg+xml') || imgEl.hasAttribute('data-paw-orig-src')) {
      return;
    }

    const commaIdx = src.indexOf(',');
    if (commaIdx === -1) return;

    const meta = src.slice(0, commaIdx);
    const payload = src.slice(commaIdx + 1);
    const isBase64 = /;base64\b/i.test(meta);

    let svgText = '';
    try {
      svgText = isBase64 ? atob(payload) : decodeURIComponent(payload);
    } catch (_decodeErr) {
      return;
    }

    let nextSvg = svgText.replace(/<rect\b[^>]*>/gi, (rectTag) => {
      const fillMatch = rectTag.match(/\bfill\s*=\s*(['"])([^'"]+)\1/i);
      if (!fillMatch) return rectTag;
      const fillRgba = parseColor(fillMatch[2]);
      if (!fillRgba || !isNeutralLight(fillRgba, 215)) return rectTag;

      const wMatch = rectTag.match(/\bwidth\s*=\s*(['"])([^'"]+)\1/i);
      const hMatch = rectTag.match(/\bheight\s*=\s*(['"])([^'"]+)\1/i);
      const isLargeDim = (m) => {
        if (!m) return false;
        const val = m[2].trim();
        if (val === '100%') return true;
        const num = parseFloat(val);
        return !Number.isNaN(num) && num >= 200;
      };
      if (!isLargeDim(wMatch) || !isLargeDim(hMatch)) return rectTag;

      return rectTag.replace(/\bfill\s*=\s*(['"])([^'"]+)\1/i, "fill='none'");
    });

    const isEmptyStateIllust =
      (imgEl.classList && imgEl.classList.contains('pa-empty-state-image')) ||
      svgText.includes('LightTheme_');
    if (isEmptyStateIllust) {
      nextSvg = nextSvg.replace(EMPTY_STATE_GRAY_RE, (hex) => EMPTY_STATE_GRAY_MAP[hex.toLowerCase()] || hex);
    }

    if (nextSvg === svgText) return;

    try {
      const encoded = isBase64 ? btoa(nextSvg) : encodeURIComponent(nextSvg);
      imgEl.setAttribute('data-paw-orig-src', src);
      imgEl.setAttribute('src', `${meta},${encoded}`);
    } catch (_encodeErr) {
      // btoa ASCII dışına denk gelirse orijinal görseli koru
    }
  }

  // ---------------- Computed-Style DOM Temizleyici ----------------

  function scrubElement(el, forceRecheck = false) {
    if (!(el instanceof Element)) return;
    if (SKIP_TAGS.has(el.tagName)) return;

    if (el.shadowRoot) {
      hookShadowRoot(el.shadowRoot);
    }

    // Carbon alt tema özniteliğini g100 yap
    const carbonTheme = el.getAttribute('data-carbon-theme');
    if (carbonTheme === 'white' || carbonTheme === 'g10' || carbonTheme === 'g90') {
      if (!el.hasAttribute('data-paw-orig-carbon-theme')) {
        el.setAttribute('data-paw-orig-carbon-theme', carbonTheme);
      }
      el.setAttribute('data-carbon-theme', 'g100');
    }

    // SVG özel işleme
    const tagLower = el.tagName.toLowerCase();
    if (tagLower === 'svg') {
      scrubSvgElement(el);
      return;
    }
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') {
      const parentSvg = el.closest('svg');
      if (parentSvg) scrubSvgElement(parentSvg);
      return;
    }
    if (tagLower === 'img') {
      scrubDataUriSvgImage(el);
    }

    if (forceRecheck) {
      el.removeAttribute('data-paw-bg');
      el.removeAttribute('data-paw-text');
      el.removeAttribute('data-paw-border');
      el.removeAttribute('data-paw-bt');
      el.removeAttribute('data-paw-br');
      el.removeAttribute('data-paw-bb');
      el.removeAttribute('data-paw-bl');
    }

    const computed = window.getComputedStyle(el);

    const isEmptyState = Boolean(
      el.closest &&
      el.closest('.pa-empty-state-container, .flex-layout-empty-state-container, .flex-layout-empty-state')
    );
    const isDimensionOverview = Boolean(el.closest && el.closest('.pa--dimensionoverview'));
    const treeAncestor = el.closest && el.closest('.ba-common-treeItem, .ba-common-listItem');
    const isTreeItemChild = Boolean(treeAncestor && treeAncestor !== el);

    const primaryMatch = el.closest && el.closest(
      'button.blue-button-class, .bx--btn--primary:not(.bx--btn--icon-only), .cds--btn--primary:not(.cds--btn--icon-only)'
    );
    const isInChromeBar = Boolean(
      primaryMatch &&
      primaryMatch.closest &&
      primaryMatch.closest('header, nav, aside, [role="banner"], [aria-label="Application Bar"], .toolpane')
    );
    const isPrimaryBtn = Boolean(
      primaryMatch &&
      (!isInChromeBar || (primaryMatch.classList && primaryMatch.classList.contains('blue-button-class')))
    );

    const isCodeEditorLayer = Boolean(
      el.closest &&
      el.closest('.cm-editor, .monaco-editor, .ace_editor, .CodeMirror') &&
      el.matches('.cm-gutters, .cm-content, .cm-line, .cm-activeLine, .cm-selectionLayer, .cm-selectionBackground, .cm-cursorLayer, .cm-cursor, .view-overlays, .view-lines, .view-line, .selected-text, .ace_layer, .CodeMirror-lines')
    );

    if (isEmptyState) {
      el.setAttribute('data-paw-bg', 'transparent');
    } else if (isCodeEditorLayer || isDimensionOverview || isPrimaryBtn || isTreeItemChild) {
      if (el.hasAttribute('data-paw-bg')) {
        el.removeAttribute('data-paw-bg');
      }
      if (isDimensionOverview) {
        el.removeAttribute('data-paw-border');
        el.removeAttribute('data-paw-bt');
        el.removeAttribute('data-paw-br');
        el.removeAttribute('data-paw-bb');
        el.removeAttribute('data-paw-bl');
      }
      if (isPrimaryBtn && el.hasAttribute('data-paw-text')) {
        el.removeAttribute('data-paw-text');
      }
    } else {
      const bgRgba = parseColor(computed.backgroundColor);
      if (isTransparent(bgRgba)) {
        if (el.hasAttribute('data-paw-bg')) {
          el.removeAttribute('data-paw-bg');
        }
      } else if (isLightBlueTint(bgRgba)) {
        el.setAttribute('data-paw-bg', 'active');
      } else if (isNeutralLight(bgRgba, 195)) {
        const minRgb = Math.min(bgRgba[0], bgRgba[1], bgRgba[2]);
        const rect = el.getBoundingClientRect();
        const isSmallControl =
          rect.height > 0 && rect.height <= 64 && rect.width > 0 && rect.width <= 280;
        const isSelectedControl =
          isSmallControl &&
          el.matches('button, [role="button"], [role="tab"], .cds--side-nav__link, .bx--side-nav__link, [aria-selected="true"], [aria-pressed="true"]') &&
          (
            el.matches('[aria-selected="true"], [aria-pressed="true"], [class*="active"], [class*="selected"], [class*="current"], [class*="toggled"]') ||
            minRgb >= 248
          );

        if (isSelectedControl) {
          el.setAttribute('data-paw-bg', 'active');
        } else if (el.matches('.pa-plan-home-tile, .pa-plan-home-tile-content, .pa-tile, .bx--tile, .cds--tile')) {
          el.setAttribute('data-paw-bg', '2');
        } else if (minRgb >= 248) {
          el.setAttribute('data-paw-bg', '1');
        } else if (minRgb >= 232) {
          el.setAttribute('data-paw-bg', '2');
        } else {
          el.setAttribute('data-paw-bg', '3');
        }
      }
    }

    // Metin rengi kontrolü
    if (!isPrimaryBtn) {
      const colorRgba = parseColor(computed.color);
      if (isNeutralDark(colorRgba, 115)) {
        const maxRgb = Math.max(colorRgba[0], colorRgba[1], colorRgba[2]);
        el.setAttribute('data-paw-text', maxRgb <= 55 ? '1' : '2');
      } else if (isDarkBlue(colorRgba)) {
        el.setAttribute('data-paw-text', 'link');
      }
    }

    // Kenar-bazlı görünür kenarlık rengi (tek kenar ayırıcıyı 4 kenar kutuya çevirmez)
    if (!isDimensionOverview && !isEmptyState) {
      const borderSides = [
        [computed.borderTopWidth, computed.borderTopStyle, computed.borderTopColor, 'data-paw-bt'],
        [computed.borderRightWidth, computed.borderRightStyle, computed.borderRightColor, 'data-paw-br'],
        [computed.borderBottomWidth, computed.borderBottomStyle, computed.borderBottomColor, 'data-paw-bb'],
        [computed.borderLeftWidth, computed.borderLeftStyle, computed.borderLeftColor, 'data-paw-bl']
      ];
      for (let s = 0; s < borderSides.length; s++) {
        const [bw, bs, bc, attr] = borderSides[s];
        if (bs !== 'none' && parseFloat(bw) > 0) {
          const bRgba = parseColor(bc);
          if (bRgba && isNeutralLight(bRgba, 190)) {
            el.setAttribute(attr, '1');
          }
        }
      }
    }
  }

  // ---------------- Kuyruk ve Zaman Dilimli (Batched) İşleme ----------------

  function enqueueElement(el, forceRecheck = false) {
    if (!(el instanceof Element)) return;
    if (SKIP_TAGS.has(el.tagName)) return;

    const prev = pendingQueue.get(el);
    pendingQueue.set(el, Boolean(prev || forceRecheck));

    if (!batchScheduled) {
      batchScheduled = true;
      requestAnimationFrame(processBatch);
    }
  }

  function enqueueSubtree(target, forceRecheck = false) {
    if (!(target instanceof Element)) return;
    if (SKIP_TAGS.has(target.tagName)) return;

    enqueueElement(target, forceRecheck);
    if (target.tagName.toLowerCase() === 'svg') return;

    const descendants = target.querySelectorAll('*');
    for (let i = 0; i < descendants.length; i++) {
      const child = descendants[i];
      if (SKIP_TAGS.has(child.tagName)) continue;
      if (child.namespaceURI === 'http://www.w3.org/2000/svg' && child.tagName.toLowerCase() !== 'svg') {
        continue;
      }
      enqueueElement(child, forceRecheck);
    }
  }

  function processBatch() {
    batchScheduled = false;
    if (!currentSettings.enabled) {
      pendingQueue.clear();
      return;
    }

    const start = performance.now();
    const iterator = pendingQueue.entries();

    for (const [el, forceRecheck] of iterator) {
      pendingQueue.delete(el);
      if (el.isConnected) {
        scrubElement(el, forceRecheck);
      }
      if (performance.now() - start >= 8) {
        break;
      }
    }

    if (pendingQueue.size > 0) {
      batchScheduled = true;
      requestAnimationFrame(processBatch);
    }
  }

  function scheduleFullScrub() {
    processStyleSheets();
    scrubSpriteSymbols(document);
    enqueueSubtree(document.body || root, true);
  }

  // ---------------- DOM Geri Yükleme & Gözlemci Yönetimi ----------------

  function clearHookedAttributes(scopeRoot) {
    const carbonEls = scopeRoot.querySelectorAll('[data-paw-orig-carbon-theme]');
    for (let i = 0; i < carbonEls.length; i++) {
      const orig = carbonEls[i].getAttribute('data-paw-orig-carbon-theme');
      if (orig) carbonEls[i].setAttribute('data-carbon-theme', orig);
      carbonEls[i].removeAttribute('data-paw-orig-carbon-theme');
    }

    const spriteFills = scopeRoot.querySelectorAll('[data-paw-orig-fill], [data-paw-orig-stroke], [data-paw-orig-style-fill], [data-paw-orig-style-stroke]');
    for (let i = 0; i < spriteFills.length; i++) {
      const el = spriteFills[i];
      if (!el.hasAttribute('data-paw-fill') && el.hasAttribute('data-paw-orig-fill')) {
        const origFill = el.getAttribute('data-paw-orig-fill');
        if (origFill === '') {
          el.removeAttribute('fill');
        } else {
          el.setAttribute('fill', origFill);
        }
      }
      if (el.hasAttribute('data-paw-orig-stroke')) {
        el.setAttribute('stroke', el.getAttribute('data-paw-orig-stroke'));
      }
      if (el.hasAttribute('data-paw-orig-style-fill') && el.style) {
        el.style.setProperty('fill', el.getAttribute('data-paw-orig-style-fill'));
      }
      if (el.hasAttribute('data-paw-orig-style-stroke') && el.style) {
        el.style.setProperty('stroke', el.getAttribute('data-paw-orig-style-stroke'));
      }
      el.removeAttribute('data-paw-orig-fill');
      el.removeAttribute('data-paw-orig-stroke');
      el.removeAttribute('data-paw-orig-style-fill');
      el.removeAttribute('data-paw-orig-style-stroke');
    }

    const origImgs = scopeRoot.querySelectorAll('[data-paw-orig-src]');
    for (let i = 0; i < origImgs.length; i++) {
      const origSrc = origImgs[i].getAttribute('data-paw-orig-src');
      if (origSrc) origImgs[i].setAttribute('src', origSrc);
      origImgs[i].removeAttribute('data-paw-orig-src');
    }

    const hooked = scopeRoot.querySelectorAll(
      '[data-paw-bg], [data-paw-hover-bg], [data-paw-text], [data-paw-border], [data-paw-bt], [data-paw-br], [data-paw-bb], [data-paw-bl], [data-paw-svg-fill], [data-paw-svg-stroke], [data-paw-fill], [data-paw-canvas-native]'
    );
    for (let i = 0; i < hooked.length; i++) {
      const el = hooked[i];
      el.removeAttribute('data-paw-bg');
      el.removeAttribute('data-paw-hover-bg');
      el.removeAttribute('data-paw-text');
      el.removeAttribute('data-paw-border');
      el.removeAttribute('data-paw-bt');
      el.removeAttribute('data-paw-br');
      el.removeAttribute('data-paw-bb');
      el.removeAttribute('data-paw-bl');
      el.removeAttribute('data-paw-svg-fill');
      el.removeAttribute('data-paw-svg-stroke');
      el.removeAttribute('data-paw-fill');
      el.removeAttribute('data-paw-canvas-native');
    }
  }

  function restoreDomAttributes() {
    if (dynamicStyleEl) {
      dynamicStyleEl.disabled = true;
    }
    hookedShadowStyles.forEach((styleEl) => {
      styleEl.disabled = true;
    });

    clearHookedAttributes(document);
    activeShadowRoots.forEach((sr) => {
      clearHookedAttributes(sr);
    });
    activeShadowRoots.clear();
  }

  function handleMutations(mutations) {
    if (!currentSettings.enabled) return;

    let needSheetScan = false;

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      if (mutation.type === 'childList') {
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          if (node.tagName === 'STYLE' || node.tagName === 'LINK') {
            if (node.id !== 'paw-dynamic-dark-styles') {
              needSheetScan = true;
              if (node.tagName === 'LINK') {
                node.addEventListener('load', scheduleSheetScan, { once: true });
              }
            }
            continue;
          }
          if (node.namespaceURI === 'http://www.w3.org/2000/svg') {
            const tLower = node.tagName.toLowerCase();
            if (tLower === 'symbol' || tLower === 'defs') {
              scrubSpriteSymbols(node.parentElement || document);
              continue;
            }
            if (tLower !== 'svg') {
              const parentSvg = node.closest('svg');
              if (parentSvg) {
                scrubSpriteSymbols(parentSvg);
                enqueueElement(parentSvg, true);
              }
              continue;
            }
            scrubSpriteSymbols(node);
          } else if (node.querySelector && node.querySelector('symbol, defs')) {
            scrubSpriteSymbols(node);
          }
          enqueueSubtree(node, false);
        }
      } else if (mutation.type === 'attributes') {
        if (mutation.target === root && mutation.attributeName === 'class') {
          syncCarbonThemeClass(true);
        } else if (mutation.target instanceof Element) {
          enqueueElement(mutation.target, true);
        }
      }
    }

    if (needSheetScan) {
      scheduleSheetScan();
    }
  }

  function startObserver() {
    if (dynamicStyleEl) dynamicStyleEl.disabled = false;
    hookedShadowStyles.forEach((styleEl) => {
      styleEl.disabled = false;
    });

    if (observer) return;
    observer = new MutationObserver(handleMutations);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-carbon-theme', 'aria-selected', 'aria-pressed']
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    for (let i = 0; i < shadowObservers.length; i++) {
      shadowObservers[i].disconnect();
    }
    shadowObservers = [];
    hookedShadowRoots = new WeakSet();
    pendingQueue.clear();
  }

  // ---------------- Ayar Yönetimi & Yaşam Döngüsü ----------------

  function triggerCanvasGridRedraw() {
    if (typeof Event === 'function' && typeof window.dispatchEvent === 'function') {
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
      });
    }
  }

  function applySettingsToRoot(settings) {
    const prevEnabled = currentSettings.enabled;
    const prevPalette = currentSettings.palette;
    currentSettings = { ...DEFAULT_SETTINGS, ...settings, mode: 'smart', palette: 'carbon' };

    root.setAttribute('data-paw-frame', window.top === window.self ? 'top' : 'sub');
    root.setAttribute('data-paw-dark', currentSettings.enabled ? 'true' : 'false');
    root.setAttribute('data-paw-palette', 'carbon');
    root.setAttribute('data-paw-mode', 'smart');

    syncCarbonThemeClass(Boolean(currentSettings.enabled));

    const brightness = Number(currentSettings.brightness ?? 100);
    const contrast = Number(currentSettings.contrast ?? 100);
    const warmth = Number(currentSettings.warmth ?? 0);

    root.style.setProperty('--paw-brightness', (brightness / 100).toFixed(2));
    root.style.setProperty('--paw-contrast', (contrast / 100).toFixed(2));
    root.style.setProperty('--paw-warmth', (warmth / 100).toFixed(2));

    const isFiltered = brightness !== 100 || contrast !== 100 || warmth !== 0;
    if (currentSettings.enabled && isFiltered) {
      root.setAttribute('data-paw-filtered', 'true');
    } else {
      root.removeAttribute('data-paw-filtered');
    }

    if (currentSettings.enabled) {
      startObserver();
      scheduleFullScrub();
    } else {
      stopObserver();
      restoreDomAttributes();
    }

    if (
      document.readyState !== 'loading' &&
      (prevEnabled !== currentSettings.enabled ||
        prevPalette !== currentSettings.palette ||
        document.querySelectorAll('canvas').length > 0)
    ) {
      triggerCanvasGridRedraw();
    }
  }

  // Sayfa yüklenirken beyaz parlamayı (FOUC) önlemek için anında uygula
  applySettingsToRoot(DEFAULT_SETTINGS);

  function loadSettings() {
    if (typeof chrome === 'undefined' || !chrome.storage) return;

    const storageArea = chrome.storage.sync || chrome.storage.local;
    storageArea.get(DEFAULT_SETTINGS, (items) => {
      if (chrome.runtime && chrome.runtime.lastError && chrome.storage.local) {
        chrome.storage.local.get(DEFAULT_SETTINGS, (localItems) => {
          applySettingsToRoot(localItems || DEFAULT_SETTINGS);
        });
        return;
      }
      applySettingsToRoot(items || DEFAULT_SETTINGS);
    });
  }

  loadSettings();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (currentSettings.enabled) {
        syncCarbonThemeClass(true);
        scheduleFullScrub();
      }
    });
  }

  window.addEventListener('load', () => {
    if (currentSettings.enabled) {
      syncCarbonThemeClass(true);
      scheduleFullScrub();
    }
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      const updated = { ...currentSettings };
      let changed = false;
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (changes[key]) {
          updated[key] = changes[key].newValue;
          changed = true;
        }
      }
      if (changed) {
        applySettingsToRoot(updated);
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || !message.type) return;

      if (message.type === 'PAW_UPDATE_SETTINGS' && message.settings) {
        applySettingsToRoot(message.settings);
        sendResponse({ ok: true });
      } else if (message.type === 'PAW_GET_STATUS') {
        sendResponse({ ok: true, settings: currentSettings });
      }
    });
  }

  // Gerçek zamanlı hover beyazlama yakalayıcısı
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('mouseover', (e) => {
      if (!currentSettings.enabled) return;
      const target = e.target;
      if (!(target instanceof Element) || target === lastHoverTarget) return;
      lastHoverTarget = target;
      if (target.tagName === 'CANVAS' || SKIP_TAGS.has(target.tagName)) return;
      if (
        target.closest &&
        target.closest(
          '.cm-editor, .monaco-editor, .ace_editor, .CodeMirror, .pa-empty-state-container, .flex-layout-empty-state, .pa--dimensionoverview, .ba-common-treeItem, .ba-common-listItem, button.blue-button-class, .bx--btn--primary:not(.bx--btn--icon-only), .cds--btn--primary:not(.cds--btn--icon-only)'
        )
      ) {
        return;
      }
      let cur = target;
      let depth = 0;
      while (cur && cur instanceof Element && depth < 5) {
        if (!SKIP_TAGS.has(cur.tagName)) {
          const comp = window.getComputedStyle(cur);
          const bgRgba = parseColor(comp.backgroundColor);
          if (bgRgba && (isNeutralLight(bgRgba, 175) || isLightBlueTint(bgRgba))) {
            cur.setAttribute('data-paw-hover-bg', '1');
          }
          const colorRgba = parseColor(comp.color);
          if (colorRgba && isNeutralDark(colorRgba, 115)) {
            cur.setAttribute('data-paw-text', '1');
          }
        }
        cur = cur.parentElement;
        depth++;
      }
    }, { passive: true, capture: true });

    document.addEventListener('mouseout', (e) => {
      if (lastHoverTarget === e.target) {
        lastHoverTarget = null;
      }
      let cur = e.target;
      let depth = 0;
      const related = e.relatedTarget;
      while (cur && cur instanceof Element && depth < 5) {
        if (cur.hasAttribute('data-paw-hover-bg')) {
          if (!related || !(related instanceof Node) || !cur.contains(related)) {
            cur.removeAttribute('data-paw-hover-bg');
          }
        }
        cur = cur.parentElement;
        depth++;
      }
    }, { passive: true, capture: true });
  }
})();
