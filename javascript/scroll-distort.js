"use strict";

/**
 * scroll-distort.js
 *
 * Applies a live, scroll-triggered CRT/scroll-curl effect locked to
 * the VIEWPORT's top/bottom edges, plus horizontal glitch slices.
 * Effect activates on scroll, damped in/out. Glitch decays faster
 * than the curl. Supports negative strength (crop-in) safely via an
 * edge-overdraw buffer. Compatible with fixed navbars/footers and
 * manually-simulated "sticky bottom" AND "sticky top" elements via
 * data attributes.
 *
 * ------------------------------------------------------------------
 * PER-PAGE CONFIGURATION (via <body> data-attributes)
 * ------------------------------------------------------------------
 * All settings can be overridden per page by adding data-distort-*
 * attributes to <body>. See the DEFAULT_CONFIG object below for the
 * full list of keys (camelCase in JS → kebab-case in HTML), e.g.:
 *   fisheyeMaxStrength  →  data-distort-fisheye-max-strength
 *
 * Example:
 *   <body data-distort-fisheye-max-strength="300"
 *         data-distort-glitch-enabled="false">
 *
 * ------------------------------------------------------------------
 * HTML REQUIREMENTS
 * ------------------------------------------------------------------
 * data-distort-ignore        → element stays fixed to real viewport,
 *                               NEVER distorted (e.g. custom cursor).
 * data-distort-fixed         → element stays visually fixed to the
 *                               viewport (e.g. navbar/footer) WHILE
 *                               still being distorted by the filter.
 * data-distort-sticky-bottom → element simulates position:sticky;
 *                               bottom:0 behavior (e.g. a "sticky
 *                               until next section pushes it away"
 *                               contact/hero section), while still
 *                               being distorted by the filter.
 * data-distort-sticky-top    → element simulates position:sticky;
 *                               top:0 behavior WITHIN its nearest
 *                               [data-distort-sticky-track] ancestor
 *                               (or parentElement if none found),
 *                               while still being distorted by the
 *                               filter. Use this for pinned parallax
 *                               "stages" that release once their
 *                               track has fully scrolled past.
 * data-distort-sticky-track  → marks the container that defines the
 *                               scrollable "track" for a
 *                               [data-distort-sticky-top] child.
 * ------------------------------------------------------------------

data-distort-fisheye-max-strength      <!-- e.g. "180" or "-180" -->
data-distort-fisheye-falloff-start     <!-- e.g. "0.65" -->
data-distort-fisheye-falloff-power     <!-- e.g. "2.5" -->
data-distort-fisheye-curl-direction    <!-- "curl" or "bulge" -->
data-distort-edge-overdraw             <!-- e.g. "150" -->
data-distort-glitch-enabled            <!-- "true" or "false" -->
data-distort-glitch-max-strength       <!-- e.g. "60" -->
data-distort-glitch-slice-count        <!-- e.g. "14" -->
data-distort-glitch-regen-interval     <!-- e.g. "90" -->
data-distort-glitch-active-chance      <!-- e.g. "0.35" -->
data-distort-ease-in-speed             <!-- e.g. "0.1" -->
data-distort-ease-out-speed            <!-- e.g. "0.05" -->
data-distort-glitch-ease-out-speed     <!-- e.g. "0.15" -->
data-distort-idle-timeout              <!-- e.g. "120" -->
data-distort-velocity-to-intensity     <!-- e.g. "4" -->
data-distort-scroll-follow-speed       <!-- e.g. "0.18" -->
data-distort-enabled                   <!-- "true" or "false" — set false to fully disable on this page -->
 */

(function () {
    'use strict';

    // ==========================================================
    // DEFAULT CONFIGURATION (overridable per-page via data-attrs)
    // ==========================================================

    const DEFAULT_CONFIG = {
        fisheyeMaxStrength: 300,
        fisheyeFalloffStart: 0.65,
        fisheyeFalloffPower: 4,
        fisheyeCurlDirection: 'curl',

        edgeOverdraw: 150,

        glitchEnabled: false,
        glitchMaxStrength: 60,
        glitchSliceCount: 14,
        glitchRegenInterval: 90,
        glitchActiveChance: 0.35,

        easeInSpeed: 0.1,
        easeOutSpeed: 0.04,
        glitchEaseOutSpeed: 0.15,
        idleTimeout: 120,

        velocityToIntensity: 4,

        scrollFollowSpeed: 0.18,

        enabled: true
    };

    /* ----------------------------------------------------------------
       Reads data-distort-* attributes from <body> and merges them
       over DEFAULT_CONFIG, converting camelCase keys to kebab-case
       attribute names and parsing numbers/booleans appropriately.
    ---------------------------------------------------------------- */
    function loadConfig() {
        const config = { ...DEFAULT_CONFIG };
        const body = document.body;

        Object.keys(DEFAULT_CONFIG).forEach((key) => {
            const attrName = 'distort' + key.charAt(0).toUpperCase() + key.slice(1);
            const kebab = attrName.replace(/([A-Z])/g, '-$1').toLowerCase();
            const dataKey = kebab.replace(/^-/, ''); // e.g. "distort-fisheye-max-strength"
            const raw = body.dataset[toCamel(dataKey)];

            if (raw === undefined) return;

            const defaultVal = DEFAULT_CONFIG[key];
            if (typeof defaultVal === 'boolean') {
                config[key] = raw === 'true';
            } else if (typeof defaultVal === 'number') {
                const parsed = parseFloat(raw);
                if (!isNaN(parsed)) config[key] = parsed;
            } else {
                config[key] = raw;
            }
        });

        return config;
    }

    function toCamel(kebab) {
        return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    }

    const CONFIG = loadConfig();
    // ==========================================================
    // END CONFIGURATION
    // ==========================================================

    // FIX: disable the entire virtual-scroll/displacement pipeline on
    // mobile — it was causing a horizontal drift bug during scroll,
    // likely from address-bar show/hide resize events interacting with
    // the fisheye displacement map's rounding. This effect is primarily
    // a desktop hover/scroll-feel enhancement anyway; mobile gets
    // native, unmodified scrolling instead.
    const MOBILE_DISTORT_BREAKPOINT = 0;
    if (!CONFIG.enabled || window.innerWidth < MOBILE_DISTORT_BREAKPOINT) return;

    const FILTER_ID = 'scroll-distort-filter';
    const CLIP_ID = 'scroll-distort-clip';
    const VIEWPORT_ID = 'scroll-distort-viewport';
    const CONTENT_ID = 'scroll-distort-content';
    const SPACER_ID = 'scroll-distort-spacer';

    /* ----------------------------------------------------------------
       Sets up the virtual-scroll + overdraw structure.
       #scroll-distort-clip     → fixed, EXACTLY 100vh, overflow:hidden.
       #scroll-distort-viewport → taller by 2×edgeOverdraw, filter applied here.
       #scroll-distort-content  → your real page content, translateY'd.
       Elements with [data-distort-ignore] are excluded entirely.
       Elements with [data-distort-fixed] / [data-distort-sticky-bottom]
       / [data-distort-sticky-top] stay INSIDE content (still distorted),
       handled specially in tick().
    ---------------------------------------------------------------- */
    function setupVirtualScroll() {
        const existingViewport = document.getElementById(VIEWPORT_ID);
        if (existingViewport) {
            return {
                clip: document.getElementById(CLIP_ID),
                viewport: existingViewport,
                content: document.getElementById(CONTENT_ID),
                spacer: document.getElementById(SPACER_ID)
            };
        }

        const overdraw = CONFIG.edgeOverdraw;

        const clip = document.createElement('div');
        clip.id = CLIP_ID;
        clip.style.position = 'fixed';
        clip.style.top = '0';
        clip.style.left = '0';
        clip.style.width = '100%';
        clip.style.height = '100vh';
        clip.style.overflow = 'hidden';
        clip.style.zIndex = '0';

        const viewport = document.createElement('div');
        viewport.id = VIEWPORT_ID;
        viewport.style.position = 'absolute';
        viewport.style.top = `-${overdraw}px`;
        viewport.style.left = '0';
        viewport.style.width = '100%';
        viewport.style.height = `calc(100vh + ${overdraw * 2}px)`;

        const content = document.createElement('div');
        content.id = CONTENT_ID;
        content.style.position = 'relative';
        content.style.top = `${overdraw}px`;
        content.style.willChange = 'transform';

        const children = Array.from(document.body.childNodes);
        children.forEach((node) => {
            const isIgnored = node.nodeType === 1 && node.hasAttribute('data-distort-ignore');
            const isScript = node.nodeType === 1 && node.tagName === 'SCRIPT';
            if (isIgnored || isScript) return;
            content.appendChild(node);
        });

        viewport.appendChild(content);
        clip.appendChild(viewport);
        document.body.insertBefore(clip, document.body.firstChild);

        const spacer = document.createElement('div');
        spacer.id = SPACER_ID;
        spacer.style.width = '1px';
        spacer.style.pointerEvents = 'none';
        spacer.style.visibility = 'hidden';
        document.body.appendChild(spacer);

        function syncSpacerHeight() {
            spacer.style.height = content.scrollHeight + 'px';
        }
        syncSpacerHeight();
        window.addEventListener('resize', syncSpacerHeight);
        new ResizeObserver(syncSpacerHeight).observe(content);

        return { clip, viewport, content, spacer };
    }

    /* ----------------------------------------------------------------
       Generates the top/bottom-only displacement map, accounting for
       the overdraw buffer (excluded from the falloff calc since it's
       hidden sampling material, not visible content).
    ---------------------------------------------------------------- */
    function generateFisheyeMap(size, falloffStart, falloffPower, direction, overdrawRatio) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;

        const directionSign = direction === 'curl' ? -1 : 1;

        for (let y = 0; y < size; y++) {
            const rawFrac = y / size;

            const visibleFrac = (rawFrac - overdrawRatio) / (1 - overdrawRatio * 2);
            const clampedFrac = Math.max(0, Math.min(1, visibleFrac));
            const ny = clampedFrac * 2 - 1;

            const distFromCenter = Math.min(Math.abs(ny), 1);
            const remainingRange = Math.max(1 - falloffStart, 0.0001);
            const t = Math.max(0, (distFromCenter - falloffStart) / remainingRange);
            const shaped = Math.pow(Math.min(t, 1), falloffPower);

            const dirY = ny === 0 ? 0 : Math.sign(ny) * shaped * directionSign;
            const gValue = Math.round((dirY * 0.5 + 0.5) * 255);

            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                data[i]     = 128;
                data[i + 1] = gValue;
                data[i + 2] = 128;
                data[i + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }

    /* ----------------------------------------------------------------
       Generates the CRT glitch-slice displacement map.
    ---------------------------------------------------------------- */
    function generateGlitchSliceMap(width, height, sliceCount, activeChance) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const sliceHeight = height / sliceCount;

        for (let i = 0; i < sliceCount; i++) {
            const isActive = Math.random() < activeChance;
            const value = isActive
                ? Math.round(128 + (Math.random() * 2 - 1) * 127)
                : 128;

            ctx.fillStyle = `rgb(${value}, 128, 128)`;
            ctx.fillRect(0, Math.floor(i * sliceHeight), width, Math.ceil(sliceHeight) + 1);
        }

        return canvas.toDataURL();
    }

    /* ----------------------------------------------------------------
       Injects the SVG filter definition.
    ---------------------------------------------------------------- */
    function injectSvgFilter(overdrawRatio) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('width', '0');
        svg.setAttribute('height', '0');
        svg.style.position = 'absolute';
        svg.style.pointerEvents = 'none';
        svg.setAttribute('data-distort-ignore', '');
        svg.setAttribute('aria-hidden', 'true');

        const fisheyeMapUri = generateFisheyeMap(
            512,
            CONFIG.fisheyeFalloffStart,
            CONFIG.fisheyeFalloffPower,
            CONFIG.fisheyeCurlDirection,
            overdrawRatio
        );
        const glitchMapUri = generateGlitchSliceMap(
            64,
            512,
            CONFIG.glitchSliceCount,
            CONFIG.glitchActiveChance
        );

        svg.innerHTML = `
            <defs>
                <filter id="${FILTER_ID}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">

                    <feImage id="fisheyeMapImage" href="${fisheyeMapUri}" x="0" y="0" width="100%" height="100%" result="fisheyeMap" preserveAspectRatio="none"/>
                    <feDisplacementMap
                        id="fisheyeDisplacement"
                        in="SourceGraphic"
                        in2="fisheyeMap"
                        scale="0"
                        xChannelSelector="R"
                        yChannelSelector="G"
                        result="bulged"
                    />

                    <feImage id="glitchMapImage" href="${glitchMapUri}" x="0" y="0" width="100%" height="100%" result="glitchMap" preserveAspectRatio="none"/>
                    <feDisplacementMap
                        id="glitchDisplacement"
                        in="bulged"
                        in2="glitchMap"
                        scale="0"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />

                </filter>
            </defs>
        `;

        document.body.appendChild(svg);

        return {
            fisheyeDisplacement: svg.querySelector('#fisheyeDisplacement'),
            glitchDisplacement: svg.querySelector('#glitchDisplacement'),
            glitchMapImage: svg.querySelector('#glitchMapImage'),
            fisheyeMapImage: svg.querySelector('#fisheyeMapImage')
        };
    }

    /* ----------------------------------------------------------------
       Main controller
    ---------------------------------------------------------------- */
    function initScrollDistort() {
        const { viewport, content } = setupVirtualScroll();

        const overdrawRatio = CONFIG.edgeOverdraw / (window.innerHeight + CONFIG.edgeOverdraw * 2);
        const filterEls = injectSvgFilter(overdrawRatio);

        viewport.style.filter = `url(#${FILTER_ID})`;

        let currentIntensity = 0;
        let currentGlitchIntensity = 0;
        let targetIntensity = 0;

        let lastScrollY = window.scrollY;
        let idleTimer = null;
        let glitchRegenTimer = null;
        let rafId = null;
        let displayedScrollY = window.scrollY;

        // Elements that stay visually fixed to the viewport (navbar, footer)
        // while still living inside the distorted content tree.
        const fixedElements = Array.from(content.querySelectorAll('[data-distort-fixed]'));

        // Elements simulating position:sticky; bottom:0 behavior.
        const stickyBottomElements = Array.from(content.querySelectorAll('[data-distort-sticky-bottom]'))
            .map((el) => {
                const rect = el.getBoundingClientRect();
                const staticTop = rect.top + displayedScrollY;
                const height = el.offsetHeight;
                const nextSiblingTop = staticTop + height;
                return { el, staticTop, height, nextSiblingTop };
            });

        // Elements simulating position:sticky; top:0 behavior WITHIN
        // their nearest [data-distort-sticky-track] ancestor (or
        // parentElement if none specified). Stored in a mutable array
        // so it can be re-measured on demand via
        // window.scrollDistort.refreshStickyTop() — useful after other
        // scripts dynamically resize the track (e.g. expedition.js
        // setting its scroll-space height after auto-trim math runs).
        let stickyTopElements = [];

        function measureStickyTopElements() {
            const elements = Array.from(content.querySelectorAll('[data-distort-sticky-top]'));

            // CRITICAL: clear any existing pin-transform BEFORE measuring.
            // getBoundingClientRect() returns the VISUAL (post-transform)
            // position — if the element already has a transform applied
            // from a previous frame's pin calculation, re-measuring here
            // would capture a corrupted baseline permanently offset by
            // whatever transform happened to be active at this instant.
            elements.forEach((el) => {
                el.style.transform = 'none';
            });

            stickyTopElements = elements.map((el) => {
                const track = el.closest('[data-distort-sticky-track]') || el.parentElement;
                const elRect = el.getBoundingClientRect();
                const trackRect = track.getBoundingClientRect();
                return {
                    el,
                    track,
                    staticTop: elRect.top + displayedScrollY,
                    trackStaticTop: trackRect.top + displayedScrollY,
                    trackHeight: track.offsetHeight
                };
            });
        }

        measureStickyTopElements();

        function regenerateGlitchMap() {
            const newMapUri = generateGlitchSliceMap(
                64,
                512,
                CONFIG.glitchSliceCount,
                CONFIG.glitchActiveChance
            );
            filterEls.glitchMapImage.setAttribute('href', newMapUri);
        }

        function startGlitchRegenLoop() {
            if (glitchRegenTimer || !CONFIG.glitchEnabled) return;
            glitchRegenTimer = setInterval(regenerateGlitchMap, CONFIG.glitchRegenInterval);
        }

        function stopGlitchRegenLoop() {
            clearInterval(glitchRegenTimer);
            glitchRegenTimer = null;
        }

        function onScroll() {
            const currentScrollY = window.scrollY;
            const delta = Math.abs(currentScrollY - lastScrollY);
            lastScrollY = currentScrollY;

            const velocityRatio = Math.min(delta / CONFIG.velocityToIntensity, 1);
            targetIntensity = Math.max(targetIntensity, velocityRatio);

            startGlitchRegenLoop();

            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                targetIntensity = 0;
            }, CONFIG.idleTimeout);

            if (!rafId) rafId = requestAnimationFrame(tick);
        }

        function applyIntensity(intensity, glitchIntensity) {
            const fisheyeScale = intensity * CONFIG.fisheyeMaxStrength;
            filterEls.fisheyeDisplacement.setAttribute('scale', fisheyeScale.toFixed(2));

            const glitchScale = CONFIG.glitchEnabled ? glitchIntensity * CONFIG.glitchMaxStrength : 0;
            filterEls.glitchDisplacement.setAttribute('scale', glitchScale.toFixed(2));
        }

        function tick() {
            // Curl easing (slower fade out)
            const speed = currentIntensity < targetIntensity
                ? CONFIG.easeInSpeed
                : CONFIG.easeOutSpeed;
            currentIntensity += (targetIntensity - currentIntensity) * speed;

            // Glitch easing (faster fade out)
            const glitchSpeed = currentGlitchIntensity < targetIntensity
                ? CONFIG.easeInSpeed
                : CONFIG.glitchEaseOutSpeed;
            currentGlitchIntensity += (targetIntensity - currentGlitchIntensity) * glitchSpeed;
            if (currentGlitchIntensity < 0.001) currentGlitchIntensity = 0;

            // Virtual scroll position smoothing — THIS moves the page
            displayedScrollY += (window.scrollY - displayedScrollY) * CONFIG.scrollFollowSpeed;
            content.style.transform = `translateY(${-displayedScrollY}px)`;

            // Counter-cancel translate on [data-distort-fixed] elements
            fixedElements.forEach((el) => {
                el.style.transform = `translateY(${displayedScrollY}px)`;
            });

            // Manual sticky-BOTTOM simulation
            stickyBottomElements.forEach(({ el, staticTop, height, nextSiblingTop }) => {
                const viewportHeight = window.innerHeight;

                const naturalTop = staticTop - displayedScrollY;
                const stuckTop = viewportHeight - height;
                const maxAllowedTop = nextSiblingTop - height - displayedScrollY;

                const finalTop = Math.max(naturalTop, Math.min(stuckTop, maxAllowedTop));
                const extraOffset = finalTop - naturalTop;

                el.style.transform = `translateY(${extraOffset}px)`;
            });

            // Manual sticky-TOP simulation (mirrors sticky-bottom logic,
            // but pins at viewport top:0 instead of bottom, and releases
            // once the track's bottom edge has fully scrolled past,
            // instead of releasing when a next-sibling collides).
            stickyTopElements.forEach(({ el, staticTop, trackStaticTop, trackHeight }) => {
                const elHeight = el.offsetHeight;

                const naturalTop = staticTop - displayedScrollY;
                const trackBottomNatural = trackStaticTop + trackHeight - displayedScrollY;
                const releaseTop = trackBottomNatural - elHeight;

                const finalTop = Math.max(naturalTop, Math.min(0, releaseTop));
                const extraOffset = finalTop - naturalTop;

                el.style.transform = `translateY(${extraOffset}px)`;
            });

            if (currentGlitchIntensity === 0) {
                stopGlitchRegenLoop();
            }

            const closeEnoughToTarget = Math.abs(currentIntensity - targetIntensity) < 0.001;
            const closeEnoughScroll = Math.abs(window.scrollY - displayedScrollY) < 0.5;

            if (closeEnoughToTarget && targetIntensity === 0 && currentGlitchIntensity === 0) {
                currentIntensity = 0;
                applyIntensity(0, 0);
                stopGlitchRegenLoop();

                if (closeEnoughScroll) {
                    displayedScrollY = window.scrollY;
                    content.style.transform = `translateY(${-displayedScrollY}px)`;
                    rafId = null;
                    return;
                }
            }

            applyIntensity(currentIntensity, currentGlitchIntensity);
            rafId = requestAnimationFrame(tick);
        }

        window.addEventListener('scroll', onScroll, { passive: true });

        let lastResizeWidth = window.innerWidth;

        window.addEventListener('resize', () => {
            const currentWidth = window.innerWidth;

            // Ignore mobile address-bar-driven height-only resize events —
            // only react to genuine width changes (rotation/window resize).
            if (currentWidth === lastResizeWidth) return;
            lastResizeWidth = currentWidth;

            const newOverdrawRatio = CONFIG.edgeOverdraw / (window.innerHeight + CONFIG.edgeOverdraw * 2);
            const newMapUri = generateFisheyeMap(
                512,
                CONFIG.fisheyeFalloffStart,
                CONFIG.fisheyeFalloffPower,
                CONFIG.fisheyeCurlDirection,
                newOverdrawRatio
            );
            filterEls.fisheyeMapImage.setAttribute('href', newMapUri);

            stickyBottomElements.forEach((entry) => {
                entry.el.style.transform = 'none'; // clear stale pin-transform before re-measuring
                const rect = entry.el.getBoundingClientRect();
                entry.staticTop = rect.top + displayedScrollY;
                entry.height = entry.el.offsetHeight;
                entry.nextSiblingTop = entry.staticTop + entry.height;
            });

            measureStickyTopElements();
        });

        window.scrollDistort = {
            setIntensity: (value) => {
                targetIntensity = Math.max(0, Math.min(1, value));
                startGlitchRegenLoop();
                if (!rafId) rafId = requestAnimationFrame(tick);
            },
            disable: () => { viewport.style.filter = ''; },
            enable: () => { viewport.style.filter = `url(#${FILTER_ID})`; },
            // Call this after dynamically resizing a
            // [data-distort-sticky-track] element (e.g. after
            // expedition.js sets its scroll-space height), so the
            // sticky-top math re-measures against the correct size.
            refreshStickyTop: () => {
                measureStickyTopElements();
            }
        };

        // Kick off an initial tick immediately so content positions
        // correctly on load, rather than waiting for the first scroll.
        rafId = requestAnimationFrame(tick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollDistort);
    } else {
        initScrollDistort();
    }

})();