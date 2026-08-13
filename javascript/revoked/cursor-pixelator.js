// /**
//  * =========================================================================
//  * CURSOR PIXELATOR & TRAILING LENS ENGINE
//  * =========================================================================
//  * Creates a pixelated trailing lens that follows the cursor smoothly.
//  * Supports screen-sampling or customized blurring/color overlays.
//  *
//  * BEHAVIOR NOTES:
//  * - Trail blocks are always fully opaque — no alpha/fade decay at all.
//  * - Trail LENGTH (number of points kept) is driven by cursor velocity:
//  *   moving fast extends the trail up to maxParticles, coming to rest
//  *   actively collapses the trail back down to zero over time.
//  */

// const PIXEL_CONFIG = {
//     // --- BASIC CONTROLS ---
//     pixelSize: 15,           // DENSITY: Width and height of each block (Higher = more pixelated)
//     lensRadius: 15,          // LENS SIZE: Circular crop radius around cursor points
//     maxParticles: 60,        // CAPACITY: Max trailing steps drawn simultaneously at full speed

//     // --- STYLE & COLOR CONTROLS ---
//     useScreenColors: false,  // COLOR MODE: 'true' to sample screen below, 'false' to use custom solid color
//     customColor: '#563CFF',  // SOLID COLOR: Color used if useScreenColors is false (hex, rgb, or css variables)

//     // --- LAYERING ---
//     zIndex: 10003,             // STACKING: z-index of the canvas overlay

//     // --- VELOCITY-DRIVEN TRAIL LENGTH ---
//     velocityToLength: 1,     // SENSITIVITY: px/frame of cursor movement needed to reach max trail length. Lower = trail grows longer with less movement.
//     trailGrowSpeed: 35,     // GROW RATE: How quickly the trail extends toward its target length when moving (0-1, higher = snappier growth)
//     trailShrinkSpeed: 0.05,   // SHRINK RATE: How quickly the trail collapses toward zero when at rest (0-1, higher = faster collapse)

//     // --- OPTIMIZATIONS ---
//     sampleOffset: 2           // SAMPLING: Speed scale of screen color readings (Lower = more precise colors)
// };

// class CursorPixelator {
//     constructor() {
//         // Create full screen overlay canvas
//         this.canvas = document.createElement('canvas');
//         this.canvas.id = 'cursorPixelCanvas';
//         this.ctx = this.canvas.getContext('2d');

//         // Setup overlay styling (Always click-through!)
//         this.canvas.style.position = 'fixed';
//         this.canvas.style.inset = '0';
//         this.canvas.style.width = '100vw';
//         this.canvas.style.height = '100vh';
//         this.canvas.style.pointerEvents = 'none';
//         this.canvas.style.zIndex = String(PIXEL_CONFIG.zIndex);

//         // Apply hardware-accelerated blur directly via CSS filter if requested
//         if (PIXEL_CONFIG.trailBlur > 0) {
//             this.canvas.style.filter = `blur(${PIXEL_CONFIG.trailBlur}px)`;
//             this.canvas.style.transform = 'translate3d(0,0,0)'; // Triggers GPU composition
//         }

//         document.body.appendChild(this.canvas);

//         // Tracking parameters
//         this.mouseX = -1000;
//         this.mouseY = -1000;
//         this.trail = [];
//         this.animationId = null;

//         // Velocity-driven trail length state
//         this.currentMaxLength = 0;   // Smoothly eased current cap on trail length
//         this.targetMaxLength = 0;    // Target cap based on latest velocity reading

//         this.init();
//     }

//     init() {
//         this.resize();
//         window.addEventListener('resize', () => this.resize());

//         // Track last known coordinates to draw connecting bridge points (stops gaps!)
//         let lastX = null;
//         let lastY = null;

//         document.addEventListener('mousemove', (e) => {
//             const currentX = e.clientX;
//             const currentY = e.clientY;

//             if (lastX !== null && lastY !== null) {
//                 const dx = currentX - lastX;
//                 const dy = currentY - lastY;
//                 const distance = Math.sqrt(dx * dx + dy * dy);

//                 // Map movement distance this frame to a target trail length —
//                 // faster movement = longer trail, capped at maxParticles.
//                 const velocityRatio = Math.min(distance / PIXEL_CONFIG.velocityToLength, 1);
//                 this.targetMaxLength = velocityRatio * PIXEL_CONFIG.maxParticles;

//                 // If mouse traveled further than half the lens size, fill gap
//                 const stepLimit = PIXEL_CONFIG.lensRadius * 0.4;

//                 if (distance > stepLimit) {
//                     const steps = Math.ceil(distance / stepLimit);
//                     for (let i = 1; i <= steps; i++) {
//                         const ratio = i / steps;
//                         const interpX = lastX + dx * ratio;
//                         const interpY = lastY + dy * ratio;
//                         this.addTrailPoint(interpX, interpY);
//                     }
//                 } else {
//                     this.addTrailPoint(currentX, currentY);
//                 }
//             } else {
//                 this.addTrailPoint(currentX, currentY);
//             }

//             lastX = currentX;
//             lastY = currentY;
//         });

//         // Start render loop
//         this.tick();
//     }

//     resize() {
//         const dpr = window.devicePixelRatio || 1;
//         this.canvas.width = window.innerWidth * dpr;
//         this.canvas.height = window.innerHeight * dpr;
//         this.ctx.scale(dpr, dpr);
//     }

//     addTrailPoint(x, y) {
//         if (x < 0 || y < 0) return;

//         // Capture or assign colors
//         const colors = PIXEL_CONFIG.useScreenColors ? this.captureScreenColors(x, y) : this.createSolidColors();

//         this.trail.push({
//             x: x,
//             y: y,
//             colors: colors
//         });

//         // Hard safety cap — never exceed the absolute maximum, regardless
//         // of current velocity-based target (prevents runaway growth).
//         if (this.trail.length > PIXEL_CONFIG.maxParticles) {
//             this.trail.shift();
//         }
//     }

//     /**
//      * Generates local coordinates using the selected solid config color (no sampling).
//      */
//     createSolidColors() {
//         const colors = [];
//         const radius = PIXEL_CONFIG.lensRadius;
//         const step = PIXEL_CONFIG.pixelSize;

//         for (let ox = -radius; ox < radius; ox += step) {
//             for (let oy = -radius; oy < radius; oy += step) {
//                 colors.push({
//                     ox: ox,
//                     oy: oy,
//                     color: PIXEL_CONFIG.customColor
//                 });
//             }
//         }
//         return colors;
//     }

//     tick() {
//         this.updateTrailLength();
//         this.draw();
//         this.animationId = requestAnimationFrame(() => this.tick());
//     }

//     /**
//      * Eases currentMaxLength toward targetMaxLength every frame, using
//      * different rates for growing (fast movement) vs shrinking (at rest).
//      * Then trims the actual trail array down to that length from the
//      * OLDEST end, so the tail collapses toward the cursor when idle,
//      * rather than the whole trail vanishing at once.
//      */
//     updateTrailLength() {
//         const rate = this.targetMaxLength > this.currentMaxLength
//             ? PIXEL_CONFIG.trailGrowSpeed
//             : PIXEL_CONFIG.trailShrinkSpeed;

//         this.currentMaxLength += (this.targetMaxLength - this.currentMaxLength) * rate;

//         // Snap fully to zero once close enough, so the trail can
//         // completely disappear at rest rather than asymptotically
//         // approaching zero forever.
//         if (this.targetMaxLength === 0 && this.currentMaxLength < 0.5) {
//             this.currentMaxLength = 0;
//         }

//         const allowedLength = Math.round(this.currentMaxLength);

//         // Trim from the oldest end (start of array) if we're over the
//         // current allowed length — this is what makes the tail actively
//         // collapse toward the cursor when at rest, instead of just
//         // stopping new points from being added.
//         while (this.trail.length > allowedLength) {
//             this.trail.shift();
//         }

//         // Passive decay of the velocity signal itself — if no new
//         // mousemove events fire (cursor truly at rest), targetMaxLength
//         // needs to fall back toward 0 over time too, otherwise it stays
//         // pinned at whatever the last movement's velocity was.
//         this.targetMaxLength *= 0.85;
//         if (this.targetMaxLength < 0.5) this.targetMaxLength = 0;
//     }

//     draw() {
//         const width = window.innerWidth;
//         const height = window.innerHeight;
//         this.ctx.clearRect(0, 0, width, height);

//         // Turn off smoothing to keep pixels sharp
//         this.ctx.imageSmoothingEnabled = false;

//         // Fully opaque — no alpha/fade logic at all.
//         this.ctx.globalAlpha = 1.0;

//         // Render trail points (all fully opaque, length controlled
//         // entirely by updateTrailLength() trimming the array itself)
//         for (let i = 0; i < this.trail.length; i++) {
//             const point = this.trail[i];

//             point.colors.forEach(item => {
//                 const px = point.x + item.ox;
//                 const py = point.y + item.oy;

//                 const dist = Math.sqrt(item.ox * item.ox + item.oy * item.oy);
//                 if (dist < PIXEL_CONFIG.lensRadius) {
//                     this.ctx.fillStyle = item.color;

//                     this.ctx.fillRect(
//                         Math.floor(px / PIXEL_CONFIG.pixelSize) * PIXEL_CONFIG.pixelSize,
//                         Math.floor(py / PIXEL_CONFIG.pixelSize) * PIXEL_CONFIG.pixelSize,
//                         PIXEL_CONFIG.pixelSize,
//                         PIXEL_CONFIG.pixelSize
//                     );
//                 }
//             });
//         }
//     }
// }

// // Auto-run: Instantiates on load (Desktop only)
// document.addEventListener('DOMContentLoaded', () => {
//     if (window.innerWidth >= 768) {
//         new CursorPixelator();
//     }
// });