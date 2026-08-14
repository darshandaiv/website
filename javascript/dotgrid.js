// dotgrid.js
(function () {

  const CFG = {
    cellSize:       50,   // Desktop cell size (px)
    cellSizeMobile: 30,   // Mobile cell size (px) - increase for larger/fewer dots
    threshold:      0.2,
    dotRatio:       0.07,
    barMin:         1.0,
    barMax:         0.9,
    brightness:     0.25,
    contrast:       28,
    alphaBase:      0,
    alphaScale:     1,
    color:          '#ffffff',
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const contrastFactor = (259 * (CFG.contrast + 255)) / (255 * (259 - CFG.contrast));

  let dotgridReady = false;

  // Signalled by app.js when model is loaded
  window.startDotgrid = function () {
    dotgridReady = true;
  };

  window.addEventListener('load', () => {

    const srcCanvas = document.getElementById('scene');
    if (!srcCanvas) {
      console.warn('[dotgrid] #scene not found');
      return;
    }

    const container = srcCanvas.parentElement;
    if (!container) {
      console.warn('[dotgrid] no parent element');
      return;
    }

    // Overlay canvas
    const overlay = document.createElement('canvas');
    overlay.setAttribute('data-distort-ignore', '');
    overlay.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:10',
      'background:transparent'
    ].join(';');

    document.body.appendChild(overlay);
    const oc = overlay.getContext('2d');

    const sampleCanvas = document.createElement('canvas');
    const sc = sampleCanvas.getContext('2d', { willReadFrequently: true });

    function isMobileDevice() {
      return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);
    }

    function getActiveCellSize() {
      return isMobileDevice() ? CFG.cellSizeMobile : CFG.cellSize;
    }

    function drawDots() {
      requestAnimationFrame(drawDots);

      // Wait until app.js signals ready
      if (!dotgridReady) return;

      // Track container bounding box on screen
      const rect = container.getBoundingClientRect();

      // Offscreen check
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        overlay.style.display = 'none';
        return;
      }
      overlay.style.display = 'block';

      // Snap overlay positioning to container bounds
      const cw   = Math.floor(rect.width);
      const ch   = Math.floor(rect.height);
      const top  = Math.floor(rect.top);
      const left = Math.floor(rect.left);

      overlay.style.top    = top + 'px';
      overlay.style.left   = left + 'px';
      overlay.style.width  = cw + 'px';
      overlay.style.height = ch + 'px';

      if (overlay.width !== cw || overlay.height !== ch) {
        overlay.width  = cw;
        overlay.height = ch;
      }

      if (!cw || !ch) return;

      // Calculate grid using dynamic mobile/desktop cell size
      const currentCellSize = getActiveCellSize();
      const cols = Math.max(2, Math.round(cw / currentCellSize));
      const rows = Math.max(2, Math.round(ch / currentCellSize));

      sampleCanvas.width  = cols;
      sampleCanvas.height = rows;

      let pixels;
      try {
        sc.drawImage(srcCanvas, 0, 0, cols, rows);
        pixels = sc.getImageData(0, 0, cols, rows).data;
      } catch (e) {
        console.warn('[dotgrid] Cannot read canvas pixels — serve via HTTP server');
        return;
      }

      const cellW = cw / cols;
      const cellH = ch / rows;

      oc.clearRect(0, 0, cw, ch);
      oc.fillStyle = CFG.color;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];

          let luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          luma = clamp(luma + CFG.brightness, 0, 1);
          luma = clamp(contrastFactor * (luma - 0.5) + 0.5, 0, 1);

          if (luma <= CFG.threshold) continue;

          const maxDiam = Math.min(cellW, cellH) * CFG.dotRatio;
          const diam    = Math.max(0.5, maxDiam * (CFG.barMin + luma * (CFG.barMax - CFG.barMin)));

          oc.globalAlpha = clamp(CFG.alphaBase + luma * CFG.alphaScale, 0, 1);
          oc.beginPath();
          oc.arc(x * cellW + cellW * 0.5, y * cellH + cellH * 0.5, diam * 0.5, 0, Math.PI * 2);
          oc.fill();
        }
      }
    }

    drawDots();
    console.log('[dotgrid] overlay initialized');
  });

})();