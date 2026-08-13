"use strict";

/**
 * logo-ticker.js
 *
 * Drives .logo-ticker-track elements via a manual JS-controlled
 * position loop (NOT CSS @keyframes) — avoids animation-duration
 * jump/glitch issues since position is a plain JS number updated
 * every frame via requestAnimationFrame.
 *
 * TWO independent slowdown sources that combine together:
 *   1. SCROLL slowdown — ticker slows while the page is being
 *      scrolled, eases back to normal once scrolling stops.
 *   2. HOVER slowdown — ticker slows (NOT stops) while the mouse
 *      hovers over it, eases back to normal on mouse leave.
 *
 * Both are configurable via the CONFIG block below, or per-ticker
 * via data-attributes on the .logo-ticker-track element (see list).
 */
(function () {
    'use strict';

    // ================================================================
    // CONFIG — adjust default behavior here
    // ================================================================
    const CONFIG = {
        // Base scroll speed, in pixels per second, before any slowdown.
        PX_PER_SECOND: 100,

        // ---- SCROLL-TRIGGERED SLOWDOWN ----
        SCROLL_SLOWDOWN_AMOUNT: 0.75,   // 0 = scrolling has no effect, 1 = nearly stops during fast scroll
        SCROLL_RECOVERY_SPEED:  0.05,   // 0-1, how fast it eases back to normal after scroll stops
        SCROLL_VELOCITY_RATIO:  60,     // px of page-scroll-delta needed to hit max scroll slowdown

        // ---- HOVER-TRIGGERED SLOWDOWN ----
        HOVER_SLOWDOWN_AMOUNT: 0.7,     // 0 = hover has no effect, 1 = nearly stops on hover
        HOVER_TRANSITION_SPEED: 0.08,   // 0-1, how fast it eases into/out of the hover-slowed state

        // Absolute minimum speed multiplier, regardless of how much
        // combined slowdown is applied — prevents it from ever
        // fully freezing dead (set to 0 if you WANT it to fully stop).
        MIN_SPEED_MULTIPLIER: 0.03,
    };
    // ================================================================
    // END CONFIG
    // ================================================================

    function getTickerOverrides(track) {
        const pxPerSecond          = parseFloat(track.getAttribute('data-ticker-px-per-second'));
        const scrollSlowdownAmount = parseFloat(track.getAttribute('data-ticker-scroll-slowdown'));
        const scrollRecoverySpeed  = parseFloat(track.getAttribute('data-ticker-scroll-recovery-speed'));
        const hoverSlowdownAmount  = parseFloat(track.getAttribute('data-ticker-hover-slowdown'));
        const hoverTransitionSpeed = parseFloat(track.getAttribute('data-ticker-hover-transition-speed'));

        return {
            pxPerSecond:          !isNaN(pxPerSecond)          ? pxPerSecond          : CONFIG.PX_PER_SECOND,
            scrollSlowdownAmount: !isNaN(scrollSlowdownAmount) ? scrollSlowdownAmount : CONFIG.SCROLL_SLOWDOWN_AMOUNT,
            scrollRecoverySpeed:  !isNaN(scrollRecoverySpeed)  ? scrollRecoverySpeed  : CONFIG.SCROLL_RECOVERY_SPEED,
            hoverSlowdownAmount:  !isNaN(hoverSlowdownAmount)  ? hoverSlowdownAmount  : CONFIG.HOVER_SLOWDOWN_AMOUNT,
            hoverTransitionSpeed: !isNaN(hoverTransitionSpeed) ? hoverTransitionSpeed : CONFIG.HOVER_TRANSITION_SPEED,
        };
    }

    function initTicker(track) {
        const opts = getTickerOverrides(track);

        let halfWidth = track.scrollWidth / 2;
        function recalcHalfWidth() {
            halfWidth = track.scrollWidth / 2;
        }
        window.addEventListener('resize', recalcHalfWidth);
        new ResizeObserver(recalcHalfWidth).observe(track);

        let position = 0;

        // Two independent slowdown states, combined multiplicatively
        let currentScrollSlowdown = 0;
        let targetScrollSlowdown  = 0;

        let currentHoverSlowdown = 0;
        let targetHoverSlowdown  = 0;

        let lastTimestamp = null;

        function frame(timestamp) {
            if (lastTimestamp === null) lastTimestamp = timestamp;
            const deltaSeconds = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;

            currentScrollSlowdown += (targetScrollSlowdown - currentScrollSlowdown) * opts.scrollRecoverySpeed;
            currentHoverSlowdown  += (targetHoverSlowdown  - currentHoverSlowdown)  * opts.hoverTransitionSpeed;

            // Combine both slowdown sources multiplicatively — if both
            // are active at once, the ticker slows down by BOTH effects
            // stacked together, rather than only the stronger one winning.
            const scrollMultiplier = 1 - currentScrollSlowdown * opts.scrollSlowdownAmount;
            const hoverMultiplier  = 1 - currentHoverSlowdown  * opts.hoverSlowdownAmount;

            const combinedMultiplier = Math.max(
                scrollMultiplier * hoverMultiplier,
                CONFIG.MIN_SPEED_MULTIPLIER
            );

            const effectiveSpeed = opts.pxPerSecond * combinedMultiplier;
            position -= effectiveSpeed * deltaSeconds;

            if (Math.abs(position) >= halfWidth) {
                position += halfWidth;
            }

            track.style.transform = `translateX(${position}px)`;

            requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);

        track._logoTicker = {
            registerScrollDelta(delta) {
                const velocityRatio = Math.min(Math.abs(delta) / CONFIG.SCROLL_VELOCITY_RATIO, 1);
                targetScrollSlowdown = Math.max(targetScrollSlowdown, velocityRatio);
            },
            decayScrollTarget() {
                targetScrollSlowdown = 0;
            },
            setHovering(isHovering) {
                targetHoverSlowdown = isHovering ? 1 : 0;
            }
        };
    }

    function init() {
        const tracks = document.querySelectorAll('.logo-ticker-track');
        if (tracks.length === 0) return;

        tracks.forEach(initTicker);

        // Hover slowdown (independent of scroll slowdown)
        tracks.forEach((track) => {
            const wrap = track.closest('.logo-ticker-wrap') || track.parentElement;
            wrap.addEventListener('mouseenter', () => track._logoTicker?.setHovering(true));
            wrap.addEventListener('mouseleave', () => track._logoTicker?.setHovering(false));
        });

        // Scroll slowdown (independent of hover slowdown)
        let lastScrollY = window.scrollY;
        let idleTimer = null;

        window.addEventListener('scroll', () => {
            const currentScrollY = window.scrollY;
            const delta = currentScrollY - lastScrollY;
            lastScrollY = currentScrollY;

            tracks.forEach((track) => {
                track._logoTicker?.registerScrollDelta(delta);
            });

            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                tracks.forEach((track) => {
                    track._logoTicker?.decayScrollTarget();
                });
            }, 120);
        }, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();