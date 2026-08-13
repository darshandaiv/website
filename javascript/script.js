"use strict";

/* ================================================================
   SCRIPT.JS — CORE SITE INTERACTIONS
   Handles global UI behaviour shared across every page:
   custom cursor, fullscreen menu, scroll progress, nav video
   previews, reusable interaction attachers, and the live clock
   (hello.html only).

   NOTE: CMS/project-rendering logic (work grid, case studies) now
   lives in cms-projects.js. This file must load BEFORE
   cms-projects.js, since it exposes initInteractions() on window
   for that file to reuse on dynamically injected content.

   NOTE: The rotating "copy email / button" cursor ticker widget
   (previously embedded inline in this file) now lives in its own
   file: cursor-copy-ticker.js. Load it separately where needed.
================================================================ */

/* ================================================================
   SECTION 1 — CUSTOM CURSOR
   Two layers:
   • cursorDot  → sticks exactly to the mouse (no lag)
   • cursorRing → lerps (smoothly follows) behind using rAF
================================================================ */
import { renderWorkSection } from './cms-projects.js';


const cursorDot  = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');

let mx = 0, my = 0; // Raw mouse position
let rx = 0, ry = 0; // Ring's lerped position

document.addEventListener('mousemove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (cursorDot) {
        cursorDot.style.left = mx + 'px';
        cursorDot.style.top  = my + 'px';
    }
});

function tickCursor() {
    rx += (mx - rx) * 0.11;
    ry += (my - ry) * 0.11;
    if (cursorRing) {
        cursorRing.style.left = rx + 'px';
        cursorRing.style.top  = ry + 'px';
    }
    requestAnimationFrame(tickCursor);
}
tickCursor();

document.addEventListener('mousedown', () => {
    cursorDot?.classList.add('clicked');
    cursorRing?.classList.add('clicked');
});
document.addEventListener('mouseup', () => {
    cursorDot?.classList.remove('clicked');
    cursorRing?.classList.remove('clicked');
});

document.addEventListener('mouseleave', () => {
    if (cursorDot) cursorDot.style.opacity = '0';
    if (cursorRing) cursorRing.style.opacity = '0';
});
document.addEventListener('mouseenter', () => {
    if (cursorDot) cursorDot.style.opacity = '1';
    if (cursorRing) cursorRing.style.opacity = '1';
});

/* ================================================================
   SECTION 2 — FULLSCREEN MENU
================================================================ */
const menuBtn = document.getElementById('menuBtn');
const fsMenu  = document.getElementById('fsMenu');
let menuIsOpen = false;

function openMenu() {
    if (!menuBtn || !fsMenu) return;
    menuIsOpen = true;
    menuBtn.classList.add('is-open');
    fsMenu.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
    if (!menuBtn || !fsMenu) return;
    menuIsOpen = false;
    menuBtn.classList.remove('is-open');
    fsMenu.classList.remove('is-open');
    document.body.style.overflow = '';
    menuBtn.setAttribute('aria-expanded', 'false');
}

menuBtn?.addEventListener('click', () => (menuIsOpen ? closeMenu() : openMenu()));

document.querySelectorAll('.fs-close-trigger').forEach((link) => {
    link.addEventListener('click', closeMenu);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuIsOpen) closeMenu();
});

/* ================================================================
   SECTION 3 — NAV MENU LINK HOVER VIDEO PREVIEW
================================================================ */
const mainVideo   = document.getElementById('display-video');
const videoSource = document.getElementById('video-source');
const navLinks    = document.querySelectorAll('.fs-nav-link');

navLinks.forEach((link) => {
    link.addEventListener('mouseenter', function () {
        if (!mainVideo || !videoSource) return;
        const newVideoSrc = this.getAttribute('data-video');

        mainVideo.classList.remove('slide-in');
        videoSource.src = newVideoSrc;
        mainVideo.load();

        mainVideo
            .play()
            .then(() => mainVideo.classList.add('slide-in'))
            .catch(() => {}); // Autoplay may be blocked — fails silently, no UI impact
    });

    link.addEventListener('mouseleave', function () {
        mainVideo?.classList.remove('slide-in');
    });
});

/* ================================================================
   SECTION 4 — REUSABLE INTERACTION ATTACHERS
   These attach cursor-hover states, magnetic movement, and scroll
   reveal to any matching elements — including ones injected
   dynamically later by cms-projects.js (work cards, case study
   frames), which is why each one accepts an optional `root` param
   instead of always querying the whole document.
================================================================ */

/* Adds "hovered" cursor state to any interactive element found
   inside `root` (defaults to the whole document). */
function attachCursorHover(root = document) {
    const interactiveEls = 'a, button, .work-card, .service-row, .mag-pill, .social-btn, .fs-nav-link';
    root.querySelectorAll(interactiveEls).forEach((el) => {
        el.addEventListener('mouseenter', () => {
            cursorDot?.classList.add('hovered');
            cursorRing?.classList.add('hovered');
        });
        el.addEventListener('mouseleave', () => {
            cursorDot?.classList.remove('hovered');
            cursorRing?.classList.remove('hovered');
        });
    });
}

/* Adds magnetic "pull toward cursor" movement to [.mag-target]
   elements inside `root`. Skipped on mobile/tablet (<768px) since
   there's no cursor to react to. */
function attachMagnetic(root = document) {
    if (window.innerWidth < 768) return;

    root.querySelectorAll('.mag-target').forEach((el) => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = e.clientX - cx;
            const dy = e.clientY - cy;

            // REQUIRED VALUES: tuning read from data-attributes on the
            // element. Falls back to sensible defaults if not provided.
            const strength = parseFloat(el.getAttribute('data-mag-strength')) || 0.38;
            const speed    = parseFloat(el.getAttribute('data-mag-speed')) || 0.15;

            el.style.transform  = `translate(${dx * strength}px, ${dy * strength}px)`;
            el.style.transition = `transform ${speed}s ease-out`;
        });

        el.addEventListener('mouseleave', () => {
            const resetSpeed = parseFloat(el.getAttribute('data-mag-reset-speed')) || 0.55;

            el.style.transform  = 'translate(0, 0)';
            el.style.transition = `transform ${resetSpeed}s cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
        });
    });
}

/* Observes [.reveal] elements inside `root` and adds the .visible
   class once they scroll into view, triggering their CSS reveal
   transition. Each element is only observed once. */
function attachReveal(root = document) {
    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -48px 0px' }
    );

    root.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));
}

/* Runs all interaction attachers on a freshly-rendered root.
   Exposed on window so cms-projects.js can call it after injecting
   dynamic markup (work cards, case study content, etc). */
function initInteractions(root = document) {
    attachCursorHover(root);
    attachMagnetic(root);
    attachReveal(root);
}
window.initInteractions = initInteractions;

/* ================================================================
   SECTION 5 — TEXT TICKER
   Auto-scrolling text ticker where the font-size is calculated to
   exactly fill the height of its container, and recalculates on
   window resize (or container resize, via ResizeObserver).

   FIX: [data-ticker] now uses overflow:hidden instead of visible.
   The internal .ticker-track is DELIBERATELY built 2x+ wider than
   its container (see ensureEnoughClones()) to create the seamless
   infinite-scroll illusion — that's correct and intentional. The
   bug was that nothing was ever clipping that oversized track to
   its container's bounds, so the extra width bled out and caused
   horizontal overflow on the whole page (confirmed cause of a
   mobile scroll-stall bug elsewhere in the site). Clipping it here,
   at the ticker's own container level, fixes the overflow at its
   actual source — no other page-level overflow-x rules needed.
================================================================ */
(function () {
    'use strict';

    const styleId = 'text-ticker-styles';
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = `
            [data-ticker] {
                overflow: hidden;
                white-space: nowrap;
                display: flex;
                align-items: center;
                position: relative;
            }
            [data-ticker] .ticker-track {
                display: flex;
                align-items: center;
                white-space: nowrap;
                will-change: transform;
            }
            [data-ticker] .ticker-track .ticker-clone {
                display: inline-flex;
                align-items: center;
                white-space: nowrap;
            }
        `;
        document.head.appendChild(styleSheet);
    }

    /* Reads config from CSS custom properties (via getComputedStyle),
       with sensible fallbacks. Values naturally update on resize since
       getConfig() is called fresh each time initTicker() runs. */
    function getCssVar(el, name, fallback) {
        const raw = getComputedStyle(el).getPropertyValue(name).trim();
        return raw === '' ? fallback : raw;
    }

    function getCssVarNumber(el, name, fallback) {
        const raw = getCssVar(el, name, null);
        if (raw === null) return fallback;
        const parsed = parseFloat(raw);
        return isNaN(parsed) ? fallback : parsed;
    }

    function getConfig(el) {
        return {
            speed: getCssVarNumber(el, '--ticker-speed', 200),
            direction: getCssVar(el, '--ticker-direction', 'left'),
            gap: getCssVarNumber(el, '--ticker-gap', 40),
            heightRatio: getCssVarNumber(el, '--ticker-height-ratio', 0.9),
            minFontSize: getCssVarNumber(el, '--ticker-min-font-size', 10),
            maxFontSize: getCssVarNumber(el, '--ticker-max-font-size', 500),
            hoverBehavior: getCssVar(el, '--ticker-hover-behavior', 'none'),
            hoverSpeedMultiplier: getCssVarNumber(el, '--ticker-hover-speed-multiplier', 0.3),
            hoverTransition: getCssVarNumber(el, '--ticker-hover-transition', 300)
        };
    }

    /* Builds the internal track structure once, wrapping the
       original content in a "ticker-clone" span, so we can safely
       duplicate it multiple times for seamless looping. */
    function buildTrack(el) {
        const config = getConfig(el);

        let originalContent = el.getAttribute('data-ticker-content');
        if (originalContent === null) {
            originalContent = el.innerHTML.trim();
            el.setAttribute('data-ticker-content', originalContent);
        }

        el.innerHTML = '';

        const track = document.createElement('div');
        track.className = 'ticker-track';

        const firstClone = document.createElement('div');
        firstClone.className = 'ticker-clone';
        firstClone.innerHTML = originalContent;
        firstClone.style.marginRight = config.gap + 'px';

        track.appendChild(firstClone);
        el.appendChild(track);

        return { track, config };
    }

    /* Sizes the font so the text height fills the container,
       scaled by heightRatio, clamped between min/max font sizes. */
    function applyFontSize(el, config) {
        const containerHeight = el.clientHeight;
        if (containerHeight <= 0) return;

        const targetSize = containerHeight * config.heightRatio;
        const clampedSize = Math.max(config.minFontSize, Math.min(config.maxFontSize, targetSize));

        el.style.fontSize = clampedSize + 'px';
    }

    /* Ensures enough clones exist in the track to seamlessly cover
       at least 2x the container's width (so there's always content
       ready to scroll into view without gaps). This intentionally
       makes .ticker-track wider than its container — that's why
       [data-ticker] above now clips with overflow:hidden. */
    function ensureEnoughClones(el, track, config) {
        const containerWidth = el.clientWidth;
        const originalContent = el.getAttribute('data-ticker-content');

        track.innerHTML = '';
        const baseClone = document.createElement('div');
        baseClone.className = 'ticker-clone';
        baseClone.innerHTML = originalContent;
        baseClone.style.marginRight = config.gap + 'px';
        track.appendChild(baseClone);

        const singleWidth = baseClone.getBoundingClientRect().width + config.gap;
        if (singleWidth <= 0) return { singleWidth: 0 };

        const clonesNeeded = Math.max(2, Math.ceil((containerWidth * 2) / singleWidth) + 1);

        for (let i = 1; i < clonesNeeded; i++) {
            const clone = document.createElement('div');
            clone.className = 'ticker-clone';
            clone.innerHTML = originalContent;
            clone.style.marginRight = config.gap + 'px';
            track.appendChild(clone);
        }

        return { singleWidth };
    }

    /* Runs the continuous scroll animation via requestAnimationFrame,
       looping the track position seamlessly once it has scrolled past
       exactly one "single item" width. Speed eases toward a target
       multiplier on hover (1 = normal, 0 = stopped, between = slowed),
       based on data-ticker-hover-behavior. */
    function animateTicker(el, track, config, singleWidth) {
        let position = 0;
        let lastTimestamp = null;
        let rafId = null;

        let currentSpeedMultiplier = 1;
        let targetSpeedMultiplier = 1;

        const directionMultiplier = config.direction === 'right' ? 1 : -1;

        const legacyPause = el.getAttribute('data-ticker-pause-on-hover') === 'true';
        const hoverBehavior = legacyPause ? 'stop' : config.hoverBehavior;

        if (hoverBehavior === 'slow' || hoverBehavior === 'stop') {
            const hoverTarget = hoverBehavior === 'stop' ? 0 : config.hoverSpeedMultiplier;

            el.addEventListener('mouseenter', () => { targetSpeedMultiplier = hoverTarget; });
            el.addEventListener('mouseleave', () => { targetSpeedMultiplier = 1; });
        }

        const easingRate = 1000 / Math.max(config.hoverTransition, 16);

        function step(timestamp) {
            if (lastTimestamp === null) lastTimestamp = timestamp;
            const deltaSeconds = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            const easeAmount = Math.min(deltaSeconds * easingRate, 1);
            currentSpeedMultiplier += (targetSpeedMultiplier - currentSpeedMultiplier) * easeAmount;

            if (singleWidth > 0 && currentSpeedMultiplier > 0.0005) {
                position += directionMultiplier * config.speed * currentSpeedMultiplier * deltaSeconds;

                if (position <= -singleWidth) position += singleWidth;
                if (position >= singleWidth) position -= singleWidth;

                track.style.transform = `translateX(${position}px)`;
            }

            rafId = requestAnimationFrame(step);
        }

        rafId = requestAnimationFrame(step);

        return { stop: () => cancelAnimationFrame(rafId) };
    }

    /* Initializes a single ticker element: builds the track, sizes
       the font, clones enough copies, and starts the animation.
       Re-run on resize to recalculate everything from scratch. */
    function initTicker(el) {
        if (el._tickerInstance) el._tickerInstance.stop();

        const { track, config } = buildTrack(el);
        applyFontSize(el, config);

        const { singleWidth } = ensureEnoughClones(el, track, config);

        el._tickerInstance = animateTicker(el, track, config, singleWidth);
    }

    function handleResize() {
        document.querySelectorAll('[data-ticker]').forEach((el) => initTicker(el));
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 150);
    });

    function observeContainerResize(el) {
        const observer = new ResizeObserver(() => {
            clearTimeout(el._tickerResizeTimeout);
            el._tickerResizeTimeout = setTimeout(() => initTicker(el), 100);
        });
        observer.observe(el);
    }

    function init() {
        document.querySelectorAll('[data-ticker]').forEach((el) => {
            initTicker(el);
            observeContainerResize(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.initTextTicker = init;
})();

/* ================================================================
   SECTION 6 — LIVE CLOCK (hello.html only)
   FIX: added a guard clause since #live-time only exists on
   hello.html — previously this threw a silent error on every other
   page, every second, via setInterval.
================================================================ */
function updateDateTime() {
    const timeEl = document.getElementById('live-time');
    if (!timeEl) return; // Not on this page — nothing to update

    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}

updateDateTime();
setInterval(updateDateTime, 1000);

/* ================================================================
   SECTION 7 — INITIAL PAGE-LOAD INTERACTION BINDING
   Attaches cursor/magnetic/reveal to elements that exist statically
   on page load. Dynamically injected content (work cards, case
   study body) calls initInteractions() separately from
   cms-projects.js after render.
================================================================ */
initInteractions(document);


document.addEventListener('DOMContentLoaded', () => {
    renderWorkSection();
});