(() => {
  'use strict';

  if (typeof CanvasRenderingContext2D === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const proto = CanvasRenderingContext2D.prototype;

  // İlk enjeksiyonda gerçek prototip metotlarını sakla; betik yeniden yüklenirse çift sarmalama yapma
  if (!window.__pawCanvasOrigMethods) {
    window.__pawCanvasOrigMethods = {
      fillRect: proto.fillRect,
      strokeRect: proto.strokeRect,
      clearRect: proto.clearRect,
      fillText: proto.fillText,
      strokeText: proto.strokeText,
      fill: proto.fill,
      stroke: proto.stroke,
      drawImage: proto.drawImage
    };
  }
  const {
    fillRect: origFillRect,
    strokeRect: origStrokeRect,
    clearRect: origClearRect,
    fillText: origFillText,
    strokeText: origStrokeText,
    fill: origFill,
    stroke: origStroke,
    drawImage: origDrawImage
  } = window.__pawCanvasOrigMethods;

  const NAMED_COLORS = {
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
    transparent: [0, 0, 0, 0]
  };

  const MAX_REGIONS_PER_CANVAS = 2000;
  const BOLD_FONT_RE = /\b(?:bold|bolder|semibold|demibold|[6-9]00)\b/i;

  function isActive() {
    return (
      Boolean(root) &&
      root.getAttribute('data-paw-dark') === 'true' &&
      root.getAttribute('data-paw-mode') !== 'invert'
    );
  }

  function isGridCanvas(canvas) {
    if (!canvas) return false;
    if (canvas.__pawIsGridCanvas === true) return true;

    if (
      canvas.classList &&
      (canvas.classList.contains('dataContent') || canvas.classList.contains('canvas'))
    ) {
      canvas.__pawIsGridCanvas = true;
      return true;
    }

    const idLower = typeof canvas.id === 'string' ? canvas.id.toLowerCase() : '';
    if (idLower.includes('canvasgrid') || idLower.includes('tm1mdv')) {
      canvas.__pawIsGridCanvas = true;
      return true;
    }

    if (
      typeof canvas.closest === 'function' &&
      canvas.closest(
        '.CanvasGrid, .canvasWrapper, .tm1mdvWidget, .pa-canvas-grid-container, .pa-dimension-editor-container, .pa-widget-wrapper'
      )
    ) {
      canvas.__pawIsGridCanvas = true;
      return true;
    }

    if (!canvas.isConnected && canvas.width >= 120 && canvas.height >= 60) {
      return true;
    }

    return false;
  }

  function markNativeCanvas(canvas) {
    if (!canvas) return;
    canvas.__pawNativeThemed = true;
    if (
      canvas.isConnected &&
      typeof canvas.getAttribute === 'function' &&
      canvas.getAttribute('data-paw-canvas-native') !== 'true'
    ) {
      canvas.setAttribute('data-paw-canvas-native', 'true');
    }
  }

  const COLOR_CACHE = new Map();
  const MAX_COLOR_CACHE = 256;

  function cacheColor(key, val) {
    if (COLOR_CACHE.size >= MAX_COLOR_CACHE) {
      COLOR_CACHE.clear();
    }
    COLOR_CACHE.set(key, val);
    return val;
  }

  function parseColor(style) {
    if (typeof style !== 'string') return null;
    if (COLOR_CACHE.has(style)) return COLOR_CACHE.get(style);

    const s = style.trim().toLowerCase();
    if (!s) return cacheColor(style, null);
    if (NAMED_COLORS[s]) return cacheColor(style, NAMED_COLORS[s]);

    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3 || hex.length === 4) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
        return cacheColor(style, Number.isNaN(r) ? null : [r, g, b, a]);
      }
      if (hex.length === 6 || hex.length === 8) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return cacheColor(style, Number.isNaN(r) ? null : [r, g, b, a]);
      }
      return cacheColor(style, null);
    }

    const rgbMatch = s.match(
      /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/
    );
    if (rgbMatch) {
      const r = Number(rgbMatch[1]);
      const g = Number(rgbMatch[2]);
      const b = Number(rgbMatch[3]);
      let a = 1;
      if (rgbMatch[4] !== undefined) {
        a = rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : Number(rgbMatch[4]);
      }
      return cacheColor(style, [r, g, b, a]);
    }

    return cacheColor(style, null);
  }

  function transformPoint(ctx, x, y) {
    if (typeof ctx.getTransform === 'function') {
      const m = ctx.getTransform();
      if (m) {
        return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
      }
    }
    return [x, y];
  }

  function pushRegion(ctx, x, y, w, h, type) {
    const canvas = ctx.canvas;
    if (!canvas) return;
    if (Math.abs(w) <= 4 || Math.abs(h) <= 4) return;

    const [tx1, ty1] = transformPoint(ctx, x, y);
    const [tx2, ty2] = transformPoint(ctx, x + w, y + h);
    const x1 = Math.min(tx1, tx2);
    const y1 = Math.min(ty1, ty2);
    const x2 = Math.max(tx1, tx2);
    const y2 = Math.max(ty1, ty2);

    if (!canvas.__pawRegions) {
      canvas.__pawRegions = [];
    }

    const regions = canvas.__pawRegions;
    // Tam tuval yeniden boyandığında eski bölgeleri temizle
    if (
      canvas.width > 0 &&
      canvas.height > 0 &&
      x2 - x1 >= canvas.width * 0.85 &&
      y2 - y1 >= canvas.height * 0.85
    ) {
      regions.length = 0;
    } else if (regions.length > 0) {
      const last = regions[regions.length - 1];
      if (last.x1 === x1 && last.y1 === y1 && last.x2 === x2 && last.y2 === y2) {
        last.type = type;
        return;
      }
      if (regions.length >= MAX_REGIONS_PER_CANVAS) {
        regions.splice(0, regions.length - MAX_REGIONS_PER_CANVAS / 2);
      }
    }

    regions.push({ x1, y1, x2, y2, type });
  }

  function findRegionType(ctx, x, y) {
    const canvas = ctx.canvas;
    const regions = canvas && canvas.__pawRegions;
    if (!regions || regions.length === 0) return null;

    const [px, py] = transformPoint(ctx, x, y);
    for (let i = regions.length - 1; i >= 0; i--) {
      const r = regions[i];
      if (px >= r.x1 - 2 && px <= r.x2 + 2 && py >= r.y1 - 2 && py <= r.y2 + 4) {
        return r.type;
      }
    }
    return null;
  }

  function mapFillRectColor(rgba, w, h) {
    if (!rgba || rgba[3] < 0.05) return null;

    const [r, g, b, a] = rgba;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const spread = max - min;
    const isLine = Math.abs(w) <= 2 || Math.abs(h) <= 2;

    if (isLine) {
      if (spread <= 25 && min >= 185) {
        return { color: a < 0.99 ? `rgba(38, 44, 58, ${a})` : '#262c3a', regionType: null };
      }
      return null;
    }

    // Seçili / vurgulanan mavi hücre
    if (b > r + 10 && min >= 180) {
      return { color: a < 0.99 ? `rgba(29, 59, 102, ${a})` : '#1d3b66', regionType: null };
    }

    // Koşullu yeşil veri girişine açık hücre (#DFF0D8 vb.)
    if (g > r + 6 && min >= 180) {
      return { color: a < 0.99 ? `rgba(21, 40, 31, ${a})` : '#15281f', regionType: 'writable' };
    }

    if (spread <= 22) {
      // Veri girişine açık (Writable) N-seviye hücre (#FFFFFF / #FEFEFE)
      if (min >= 250) {
        return { color: a < 0.99 ? `rgba(26, 32, 44, ${a})` : '#1a202c', regionType: 'writable' };
      }
      // Salt-okunur / kilitli / C-seviye gölgeli hücre (#EBEBEB..#F5F5F5 veya #DCDCDC)
      if ((min >= 233 && max <= 249) || (min >= 215 && max <= 222)) {
        return { color: a < 0.99 ? `rgba(18, 21, 28, ${a})` : '#12151c', regionType: 'readonly' };
      }
      // Satır / Sütun Başlıkları (#E0E0E0)
      if (min >= 223 && max <= 232) {
        return { color: a < 0.99 ? `rgba(32, 38, 50, ${a})` : '#202632', regionType: 'header' };
      }
      // Başlık kenarlıkları (#C6C6C6..#D6D6D6)
      if (min >= 190 && max <= 214) {
        return { color: a < 0.99 ? `rgba(46, 54, 70, ${a})` : '#2e3646', regionType: null };
      }
    }

    return null;
  }

  function mapStrokeColor(rgba) {
    if (!rgba || rgba[3] < 0.05) return null;
    const [r, g, b, a] = rgba;
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    const spread = max - min;

    if (spread > 25) return null;

    if (min >= 215) {
      return a < 0.99 ? `rgba(38, 44, 58, ${a})` : '#262c3a';
    }
    if (min >= 180) {
      return a < 0.99 ? `rgba(46, 54, 70, ${a})` : '#2e3646';
    }
    if (max <= 115) {
      return a < 0.99 ? `rgba(184, 196, 212, ${a})` : '#b8c4d4';
    }
    return null;
  }

  proto.clearRect = function clearRect(x, y, w, h) {
    if (isActive() && isGridCanvas(this.canvas)) {
      const regions = this.canvas && this.canvas.__pawRegions;
      if (regions && this.canvas.width > 0 && this.canvas.height > 0) {
        const [tx1, ty1] = transformPoint(this, x, y);
        const [tx2, ty2] = transformPoint(this, x + w, y + h);
        if (
          Math.abs(tx2 - tx1) >= this.canvas.width * 0.7 &&
          Math.abs(ty2 - ty1) >= this.canvas.height * 0.7
        ) {
          regions.length = 0;
        }
      }
    }
    return origClearRect.call(this, x, y, w, h);
  };

  proto.fillRect = function fillRect(x, y, w, h) {
    if (!isActive()) {
      if (this.canvas && this.canvas.hasAttribute && this.canvas.hasAttribute('data-paw-canvas-native')) {
        this.canvas.removeAttribute('data-paw-canvas-native');
      }
      return origFillRect.call(this, x, y, w, h);
    }

    if (!isGridCanvas(this.canvas)) {
      return origFillRect.call(this, x, y, w, h);
    }

    const origFillStyle = this.fillStyle;
    const rgba = parseColor(origFillStyle);
    const mapped = mapFillRectColor(rgba, w, h);

    if (!mapped) {
      return origFillRect.call(this, x, y, w, h);
    }

    markNativeCanvas(this.canvas);
    if (mapped.regionType) {
      pushRegion(this, x, y, w, h, mapped.regionType);
    }

    try {
      this.fillStyle = mapped.color;
      return origFillRect.call(this, x, y, w, h);
    } finally {
      this.fillStyle = origFillStyle;
    }
  };

  proto.strokeRect = function strokeRect(x, y, w, h) {
    if (!isActive() || !isGridCanvas(this.canvas)) {
      return origStrokeRect.call(this, x, y, w, h);
    }

    const origStrokeStyle = this.strokeStyle;
    const mapped = mapStrokeColor(parseColor(origStrokeStyle));
    if (!mapped) {
      return origStrokeRect.call(this, x, y, w, h);
    }

    markNativeCanvas(this.canvas);
    try {
      this.strokeStyle = mapped;
      return origStrokeRect.call(this, x, y, w, h);
    } finally {
      this.strokeStyle = origStrokeStyle;
    }
  };

  proto.stroke = function stroke() {
    if (!isActive() || !isGridCanvas(this.canvas)) {
      return origStroke.apply(this, arguments);
    }

    const origStrokeStyle = this.strokeStyle;
    const mapped = mapStrokeColor(parseColor(origStrokeStyle));
    if (!mapped) {
      return origStroke.apply(this, arguments);
    }

    markNativeCanvas(this.canvas);
    try {
      this.strokeStyle = mapped;
      return origStroke.apply(this, arguments);
    } finally {
      this.strokeStyle = origStrokeStyle;
    }
  };

  proto.fill = function fill() {
    if (!isActive() || !isGridCanvas(this.canvas)) {
      return origFill.apply(this, arguments);
    }

    const origFillStyle = this.fillStyle;
    const rgba = parseColor(origFillStyle);
    if (!rgba || rgba[3] < 0.05) {
      return origFill.apply(this, arguments);
    }

    const min = Math.min(rgba[0], rgba[1], rgba[2]);
    const max = Math.max(rgba[0], rgba[1], rgba[2]);
    if (max - min > 25) {
      return origFill.apply(this, arguments);
    }

    let nextColor = null;
    if (max <= 115) {
      nextColor = '#b8c4d4';
    } else if (min >= 245) {
      nextColor = '#1a202c';
    } else if (min >= 210) {
      nextColor = '#202632';
    }

    if (!nextColor) {
      return origFill.apply(this, arguments);
    }

    markNativeCanvas(this.canvas);
    try {
      this.fillStyle = nextColor;
      return origFill.apply(this, arguments);
    } finally {
      this.fillStyle = origFillStyle;
    }
  };

  proto.fillText = function fillText(text, x, y, maxWidth) {
    if (!isActive() || !isGridCanvas(this.canvas)) {
      return maxWidth !== undefined
        ? origFillText.call(this, text, x, y, maxWidth)
        : origFillText.call(this, text, x, y);
    }

    const origFillStyle = this.fillStyle;
    const origFont = this.font || '';
    const rgba = parseColor(origFillStyle);

    if (!rgba || rgba[3] < 0.05) {
      return maxWidth !== undefined
        ? origFillText.call(this, text, x, y, maxWidth)
        : origFillText.call(this, text, x, y);
    }

    const min = Math.min(rgba[0], rgba[1], rgba[2]);
    const max = Math.max(rgba[0], rgba[1], rgba[2]);
    const isNeutral = max - min <= 35;

    if (!isNeutral || max > 160) {
      return maxWidth !== undefined
        ? origFillText.call(this, text, x, y, maxWidth)
        : origFillText.call(this, text, x, y);
    }

    markNativeCanvas(this.canvas);
    const isBold = BOLD_FONT_RE.test(origFont);
    const regionType = findRegionType(this, x, y);
    const isHeaderCell = max <= 45 || regionType === 'header';

    try {
      if (isHeaderCell) {
        if (isBold) {
          this.fillStyle = '#b4c0ce';
        } else {
          this.fillStyle = regionType === 'readonly' ? '#7d8899' : '#a6b3c2';
        }
      } else if (isBold) {
        this.fillStyle = '#a5b3c4';
      } else {
        this.fillStyle = regionType === 'readonly' ? '#6e7b8c' : '#96a6ba';
      }

      return maxWidth !== undefined
        ? origFillText.call(this, text, x, y, maxWidth)
        : origFillText.call(this, text, x, y);
    } finally {
      this.fillStyle = origFillStyle;
    }
  };

  proto.strokeText = function strokeText(text, x, y, maxWidth) {
    if (!isActive() || !isGridCanvas(this.canvas)) {
      return maxWidth !== undefined
        ? origStrokeText.call(this, text, x, y, maxWidth)
        : origStrokeText.call(this, text, x, y);
    }

    const origStrokeStyle = this.strokeStyle;
    const mapped = mapStrokeColor(parseColor(origStrokeStyle));
    if (!mapped) {
      return maxWidth !== undefined
        ? origStrokeText.call(this, text, x, y, maxWidth)
        : origStrokeText.call(this, text, x, y);
    }

    markNativeCanvas(this.canvas);
    try {
      this.strokeStyle = mapped;
      return maxWidth !== undefined
        ? origStrokeText.call(this, text, x, y, maxWidth)
        : origStrokeText.call(this, text, x, y);
    } finally {
      this.strokeStyle = origStrokeStyle;
    }
  };

  proto.drawImage = function drawImage(image) {
    if (!isActive() || !image) {
      return origDrawImage.apply(this, arguments);
    }

    if (image.__pawNativeThemed === true) {
      markNativeCanvas(this.canvas);
      return origDrawImage.apply(this, arguments);
    }

    if (!isGridCanvas(this.canvas)) {
      return origDrawImage.apply(this, arguments);
    }

    const argLen = arguments.length;
    const imgW = Number(image.naturalWidth || image.width || 0);
    const imgH = Number(image.naturalHeight || image.height || 0);
    let dw = imgW;
    let dh = imgH;
    if (argLen >= 9) {
      dw = Number(arguments[7]) || 0;
      dh = Number(arguments[8]) || 0;
    } else if (argLen >= 5) {
      dw = Number(arguments[3]) || 0;
      dh = Number(arguments[4]) || 0;
    }

    const isIconDraw =
      (dw > 0 && dw <= 64 && dh > 0 && dh <= 64) ||
      (argLen < 9 && imgW > 0 && imgW <= 64 && imgH > 0 && imgH <= 64);

    if (!isIconDraw) {
      return origDrawImage.apply(this, arguments);
    }

    markNativeCanvas(this.canvas);
    const origFilter = this.filter;
    try {
      this.filter =
        origFilter && origFilter !== 'none'
          ? `${origFilter} brightness(0) invert(0.92)`
          : 'brightness(0) invert(0.92)';
      return origDrawImage.apply(this, arguments);
    } finally {
      this.filter = origFilter;
    }
  };
})();
