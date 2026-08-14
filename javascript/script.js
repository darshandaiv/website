"use strict";

/* ================================================================
   SCRIPT.JS — CORE SITE INTERACTIONS
================================================================ */

// 1. Import dependencies and modular scripts
import * as THREE from 'three'; 

import './app.js';
import './loader.js';
import './projects-data.js';
import './cms-projects.js';
import './scroll-distort.js';
import './logo-ticker.js';
import './text-crop-reveal.js';
import './smooth-scrollbar.js';
import './cursor-copy-ticker.js';
import './scroll-zoom.js';
import './dotgrid.js';
import './static-grid.js';

/* ================================================================
   SECTION 1 — CUSTOM CURSOR
================================================================ */
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
        if (!newVideoSrc) return;

        mainVideo.classList.remove('slide-in');
        videoSource.src = newVideoSrc;
        mainVideo.load();

        mainVideo
            .play()
            .then(() => mainVideo.classList.add('slide-in'))
            .catch(() => {});
    });

    link.addEventListener('mouseleave', function () {
        mainVideo?.classList.remove('slide-in');
    });
});

/* ================================================================
   SECTION 4 — REUSABLE INTERACTION ATTACHERS
================================================================ */
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

function attachMagnetic(root = document) {
    if (window.innerWidth < 768) return;

    root.querySelectorAll('.mag-target').forEach((el) => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = e.clientX - cx;
            const dy = e.clientY - cy;

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

function initInteractions(root = document) {
    attachCursorHover(root);
    attachMagnetic(root);
    attachReveal(root);
}
window.initInteractions = initInteractions;

/* ================================================================
   SECTION 5 — TEXT TICKER
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

    function applyFontSize(el, config) {
        const containerHeight = el.clientHeight;
        if (containerHeight <= 0) return;

        const targetSize = containerHeight * config.heightRatio;
        const clampedSize = Math.max(config.minFontSize, Math.min(config.maxFontSize, targetSize));

        el.style.fontSize = clampedSize + 'px';
    }

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
================================================================ */
function updateDateTime() {
    const timeEl = document.getElementById('live-time');
    if (!timeEl) return;

    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}

if (document.getElementById('live-time')) {
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

/* ================================================================
   SECTION 7 — INITIAL PAGE-LOAD INTERACTION BINDING
================================================================ */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initInteractions(document));
} else {
    initInteractions(document);
}