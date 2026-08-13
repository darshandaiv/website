"use strict";

/* ================================================================
   SECTION 2 — INTERACTIVE GRID BACKGROUND (Canvas)
   ...
   CELL_RATIO controls the shape of each individual cell:
     1    = square cells (default, same as original)
     1.78 = 16:9 widescreen-shaped cells
     0.5  = tall cells (half as wide as they are tall)
     2    = wide cells (twice as wide as they are tall)
   CELL_WIDTH stays fixed at BASE_CELL_SIZE; CELL_HEIGHT is derived
   from the ratio, so density stays predictable as you tweak this.
================================================================ */
const gridCanvas = document.getElementById('grid-canvas');
const gCtx       = gridCanvas.getContext('2d');

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const BASE_CELL_SIZE = 100; // base width for each cell, in px
const CELL_RATIO     = 1;   // width-to-height ratio — 1 = square, >1 = wider, <1 = taller

const CELL_WIDTH  = BASE_CELL_SIZE;
const CELL_HEIGHT = BASE_CELL_SIZE / CELL_RATIO;

let gMouseX = -9999;
let gMouseY = -9999;

let isMobileGrid = window.innerWidth < 768;
let autoAngle = 0;

function resizeGrid() {
    gridCanvas.width  = window.innerWidth;
    gridCanvas.height = window.innerHeight;
    isMobileGrid = window.innerWidth < 768;
}
resizeGrid();
window.addEventListener('resize', resizeGrid);

document.addEventListener('mousemove', e => {
    if (isMobileGrid) return;
    gMouseX = e.clientX;
    gMouseY = e.clientY;
});

function drawGrid() {
    gCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    if (isMobileGrid) {
        autoAngle += 0.006;
        const cx = gridCanvas.width  / 2;
        const cy = gridCanvas.height / 2;
        const radiusX = gridCanvas.width  * 0.35;
        const radiusY = gridCanvas.height * 0.25;
        gMouseX = cx + Math.cos(autoAngle) * radiusX;
        gMouseY = cy + Math.sin(autoAngle * 2) * radiusY;
    }

    const cols        = Math.ceil(gridCanvas.width  / CELL_WIDTH)  + 1;
    const rows        = Math.ceil(gridCanvas.height / CELL_HEIGHT) + 1;
    const GLOW_RADIUS = 800;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x  = c * CELL_WIDTH;
            const y  = r * CELL_HEIGHT;
            const dx = x - gMouseX;
            const dy = y - gMouseY;
            const d  = Math.sqrt(dx * dx + dy * dy);

            const bright = Math.max(0, 1 - d / GLOW_RADIUS);
            const alpha  = bright * 0;

            gCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
            gCtx.lineWidth   = bright > 0 ? 1 : 0.35;
            gCtx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);

            if (bright > 0.38) {
                gCtx.beginPath();
                gCtx.arc(x, y, bright * 1, 0, Math.PI * 2);
                gCtx.fillStyle = `rgba(86, 100, 255,${bright * 5})`;
                gCtx.fill();
            }
        }
    }
    requestAnimationFrame(drawGrid);
}
drawGrid();