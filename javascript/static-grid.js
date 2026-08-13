// static-grid.js
// Embeds grid canvas directly inside container for bulletproof stacking order
(function () {

  const DEFAULT_CFG = {
    cellSize:        50,        // Desktop cell spacing (px)
    cellSizeMobile:  30,        // Mobile cell spacing (px)
    dotRatio:        0.07,      // Ratio of cell size for dot diameter (0 to 1)
    color:           '#ffffff', // Dot color
    opacity:         0.5,       // Grid opacity (0 to 1)
    radius:          250,       // Mouse attraction radius (px)
    maxPull:         60,        // Maximum dot displacement (px)
    attractionSpeed: 0.12,      // Attraction responsiveness
    returnSpeed:     0.06       // Spring back responsiveness
  };

  function isMobileDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.innerWidth <= 768);
  }

  function parseElementConfig(el) {
    return {
      cellSize:        parseFloat(el.dataset.gridCellSize)        || DEFAULT_CFG.cellSize,
      cellSizeMobile:  parseFloat(el.dataset.gridCellSizeMobile)  || DEFAULT_CFG.cellSizeMobile,
      dotRatio:        parseFloat(el.dataset.gridDotRatio)        || DEFAULT_CFG.dotRatio,
      color:           el.dataset.gridColor                       || DEFAULT_CFG.color,
      opacity:         parseFloat(el.dataset.gridOpacity)         || DEFAULT_CFG.opacity,
      radius:          parseFloat(el.dataset.gridRadius)          || DEFAULT_CFG.radius,
      maxPull:         parseFloat(el.dataset.gridMaxPull)         || DEFAULT_CFG.maxPull
    };
  }

  // Mouse tracking & velocity calculation
  const mouse = {
    x: -9999,
    y: -9999,
    prevX: -9999,
    prevY: -9999,
    velocity: 0,
    targetVelocity: 0
  };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    if (mouse.prevX !== -9999) {
      const dx = mouse.x - mouse.prevX;
      const dy = mouse.y - mouse.prevY;
      const speed = Math.sqrt(dx * dx + dy * dy);
      mouse.targetVelocity = Math.min(speed, 50);
    }

    mouse.prevX = mouse.x;
    mouse.prevY = mouse.y;
  }, { passive: true });

  function setupContainerStacking(container) {
    const computedPos = window.getComputedStyle(container).position;
    if (computedPos === 'static') {
      container.style.position = 'relative';
    }

    // Elevate elements marked with [data-grid-above]
    const aboveElements = container.querySelectorAll('[data-grid-above]');
    aboveElements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'static') {
        el.style.position = 'relative';
      }
      el.style.zIndex = '2';
    });
  }

  function initGridForElement(container) {
    const config = parseElementConfig(container);

    setupContainerStacking(container);

    // FIX: Insert canvas directly inside the container as the FIRST child
    const canvas = document.createElement('canvas');
    canvas.setAttribute('data-distort-ignore', '');
    canvas.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:0',
      'background:transparent'
    ].join(';');

    container.insertBefore(canvas, container.firstChild);
    const oc = canvas.getContext('2d');

    let dots = [];
    let currentCols = 0;
    let currentRows = 0;

    function buildDots(cols, rows, cellW, cellH) {
      dots = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const originX = x * cellW + cellW * 0.5;
          const originY = y * cellH + cellH * 0.5;
          dots.push({
            originX,
            originY,
            x: originX,
            y: originY
          });
        }
      }
    }

    function drawGrid() {
      requestAnimationFrame(drawGrid);

      // Velocity decay
      mouse.velocity += (mouse.targetVelocity - mouse.velocity) * 0.1;
      mouse.targetVelocity *= 0.85;

      const rect = container.getBoundingClientRect();

      // Skip render if offscreen
      if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) {
        return;
      }

      const cw = Math.floor(container.clientWidth);
      const ch = Math.floor(container.clientHeight);

      if (!cw || !ch) return;

      // Sync internal pixel buffer size to CSS size
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      const cellSize = isMobileDevice() ? config.cellSizeMobile : config.cellSize;
      const cols     = Math.max(2, Math.round(cw / cellSize));
      const rows     = Math.max(2, Math.round(ch / cellSize));

      const cellW = cw / cols;
      const cellH = ch / rows;

      if (cols !== currentCols || rows !== currentRows) {
        currentCols = cols;
        currentRows = rows;
        buildDots(cols, rows, cellW, cellH);
      }

      oc.clearRect(0, 0, cw, ch);
      oc.fillStyle   = config.color;
      oc.globalAlpha = config.opacity;

      // Calculate dot radius based on cell size ratio (0 to 1)
      const effectiveCellSize = Math.min(cellW, cellH);
      const radius = (effectiveCellSize * config.dotRatio) / 2;

      // Convert global mouse coordinates to container-relative coordinates
      const mouseContainerX = mouse.x - rect.left;
      const mouseContainerY = mouse.y - rect.top;
      const normalizedVel   = Math.min(mouse.velocity / 30, 1);

      // Render & animate dots
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        const dx = mouseContainerX - dot.originX;
        const dy = mouseContainerY - dot.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetX = dot.originX;
        let targetY = dot.originY;

        if (dist < config.radius && normalizedVel > 0.05) {
          const factor = (1 - dist / config.radius) * normalizedVel;
          const pull   = config.maxPull * factor;
          const angle  = Math.atan2(dy, dx);

          targetX = dot.originX + Math.cos(angle) * pull;
          targetY = dot.originY + Math.sin(angle) * pull;
        }

        const isAttracting = (targetX !== dot.originX || targetY !== dot.originY);
        const lerpSpeed    = isAttracting ? DEFAULT_CFG.attractionSpeed : DEFAULT_CFG.returnSpeed;

        dot.x += (targetX - dot.x) * lerpSpeed;
        dot.y += (targetY - dot.y) * lerpSpeed;

        oc.beginPath();
        oc.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        oc.fill();
      }
    }

    drawGrid();
  }

  window.addEventListener('load', () => {
    const targets = document.querySelectorAll('[data-static-grid]');
    if (!targets.length) return;

    targets.forEach(initGridForElement);
  });

})();