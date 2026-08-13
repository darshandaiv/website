"use strict";

/**
 * smooth-scrollbar.js
 *
 * 1. Replaces the native browser scrollbar with a custom, styleable
 *    track + thumb (visual only, syncs with window.scrollY).
 *    RUNS ON ALL SCREEN SIZES — the visual thumb/track always
 *    renders, so the scrollbar's LOOK stays consistent everywhere.
 *
 * 2. Adds inertia/momentum to mouse wheel scrolling, plus
 *    click-to-jump and drag-to-scroll on the thumb — DESKTOP ONLY
 *    (>= CONFIG.minViewportWidth). These are mouse-driven
 *    interactions with no clean touch equivalent, and previously
 *    caused scroll-jank on mobile — now skipped entirely below the
 *    breakpoint. Mobile keeps its native touch-scroll physics,
 *    with the custom thumb just visually following along.
 *
 * FIX (jump-to-top bug): inertiaTarget was only ever initialized
 * ONCE at load time (`let inertiaTarget = window.scrollY`), and
 * never resynced afterward whenever the page was idle (no active
 * wheel/drag input). Any scroll-position change that happened
 * through a path other than the wheel handler — a restored scroll
 * position on refresh, DevTools panel opening/closing (which
 * resizes the viewport and can shift native scroll), or a
 * middle-mouse autoscroll — left inertiaTarget stale at its old
 * value. The next time the user scrolled the wheel even slightly,
 * onWheel's delta got added on top of that STALE inertiaTarget,
 * and the resulting window.scrollTo() snapped the page back to
 * wherever that stale value was (often ~0). FIXED by continuously
 * resyncing inertiaTarget to the real window.scrollY every frame
 * while idle (no inertia in flight) — see tick()'s else branch.
 *
 * ------------------------------------------------------------------
 * ALL SETTINGS — EDIT THE CONFIG OBJECT BELOW
 * ------------------------------------------------------------------
 */
(function () {
    'use strict';

    // ==========================================================
    // CONFIGURATION
    // ==========================================================
    const CONFIG = {
        minViewportWidth: 768, // Below this: visual thumb/track only, no wheel inertia or drag interaction

        // ---- Scrollbar positioning & sizing ----
        edgeOffset: 4,
        trackWidth: 4,
        trackWidthHover: 8,
        minThumbHeight: 40,
        verticalMargin: 12,

        // ---- Scrollbar colors ----
        trackColor: 'rgba(255, 255, 255, 0.06)',
        thumbColor: 'rgba(255, 255, 255, 0.35)',
        thumbColorHover: 'rgba(255, 255, 255, 0.6)',
        thumbColorDrag: 'var(--accent-pink, #563CFF)',

        // ---- Scrollbar motion ----
        thumbFollowSpeed: 0.2,
        widthTransitionDuration: 180,
        colorTransitionDuration: 180,

        // ---- Scrollbar auto-hide ----
        autoHide: true,
        idleTimeout: 1000,
        fadeDuration: 250,

        // ---- Wheel inertia (desktop only) ----
        inertiaEnabled: true,
        wheelMultiplier: 0.04,
        inertiaFriction: 0.96,
        maxVelocity: 160,

        // ---- Layering ----
        zIndex: 10001
    };
    // ==========================================================
    // END CONFIGURATION
    // ==========================================================

    function getScrollableHeight() {
        const spacer = document.getElementById('scroll-distort-spacer');
        const contentHeight = spacer
            ? spacer.offsetHeight
            : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

        return Math.max(contentHeight - window.innerHeight, 1);
    }

    function injectStyles() {
    const styleId = 'smooth-scrollbar-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        html {
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        html::-webkit-scrollbar {
            display: none;
        }

        #smoothScrollbarTrack {
            position: fixed;
            top: ${CONFIG.verticalMargin}px;
            bottom: ${CONFIG.verticalMargin}px;
            right: ${CONFIG.edgeOffset}px;
            width: ${CONFIG.trackWidthHover}px;
            z-index: ${CONFIG.zIndex};
            opacity: 0;
            transition: opacity ${CONFIG.fadeDuration}ms ease;
        }
        #smoothScrollbarTrack.visible {
            opacity: 1;
        }
        #smoothScrollbarTrack.interactive {
            cursor: pointer;
        }

        /* NEW: fully hide the custom scrollbar below the desktop breakpoint.
           No thumb/track, no opacity flicker, nothing rendered at all. */
        @media (max-width: ${CONFIG.minViewportWidth - 1}px) {
            #smoothScrollbarTrack {
                display: none !important;
            }
        }

        #smoothScrollbarTrackBg {
            position: absolute;
            top: 0;
            right: 0;
            width: ${CONFIG.trackWidth}px;
            height: 100%;
            background: ${CONFIG.trackColor};
            border-radius: ${CONFIG.trackWidthHover}px;
            transition: width ${CONFIG.widthTransitionDuration}ms ease;
        }
        #smoothScrollbarTrack.interactive:hover #smoothScrollbarTrackBg,
        #smoothScrollbarTrack.dragging #smoothScrollbarTrackBg {
            width: ${CONFIG.trackWidthHover}px;
        }

        #smoothScrollbarThumb {
            position: absolute;
            top: 0;
            right: 0;
            width: ${CONFIG.trackWidth}px;
            border-radius: ${CONFIG.trackWidthHover}px;
            background: ${CONFIG.thumbColor};
            transition: width ${CONFIG.widthTransitionDuration}ms ease,
                        background ${CONFIG.colorTransitionDuration}ms ease;
            will-change: transform;
        }
        #smoothScrollbarTrack.interactive:hover #smoothScrollbarThumb {
            width: ${CONFIG.trackWidthHover}px;
            background: ${CONFIG.thumbColorHover};
        }
        #smoothScrollbarTrack.dragging #smoothScrollbarThumb {
            width: ${CONFIG.trackWidthHover}px;
            background: ${CONFIG.thumbColorDrag};
        }
    `;
    document.head.appendChild(style);
}

    function buildScrollbar() {
        const track = document.createElement('div');
        track.id = 'smoothScrollbarTrack';
        track.setAttribute('data-distort-ignore', '');

        const trackBg = document.createElement('div');
        trackBg.id = 'smoothScrollbarTrackBg';

        const thumb = document.createElement('div');
        thumb.id = 'smoothScrollbarThumb';

        track.appendChild(trackBg);
        track.appendChild(thumb);
        document.body.appendChild(track);

        return { track, thumb };
    }

    /* Main controller — builds the visual thumb/track on EVERY
       screen size, and conditionally wires up desktop-only wheel
       inertia + drag/click interactions based on CONFIG.minViewportWidth. */
    function init() {
        injectStyles();
        const { track, thumb } = buildScrollbar();

        const isDesktop = window.innerWidth >= CONFIG.minViewportWidth;
        if (isDesktop) track.classList.add('interactive');

        let trackHeight = track.clientHeight;
        let thumbHeight = CONFIG.minThumbHeight;
        let displayedThumbTop = 0;
        let isDragging = false;
        let idleTimer = null;
        let rafId = null;

        // ---- Inertia state (desktop only) ----
        let inertiaVelocity = 0;
        // FIX: no longer initialized once and left stale. tick()'s
        // idle branch below continuously resyncs this to the real
        // window.scrollY every frame, so it's always accurate the
        // instant a wheel event needs to read/add to it — regardless
        // of how scrollY got to its current value (refresh restore,
        // DevTools resize, middle-mouse autoscroll, etc).
        let inertiaTarget = window.scrollY;

        function recalculateThumbSize() {
            trackHeight = track.clientHeight;
            const scrollableHeight = getScrollableHeight();
            const totalContentHeight = scrollableHeight + window.innerHeight;

            const visibleRatio = Math.min(window.innerHeight / totalContentHeight, 1);
            thumbHeight = Math.max(CONFIG.minThumbHeight, trackHeight * visibleRatio);
            thumb.style.height = thumbHeight + 'px';
        }

        function showScrollbar() {
            track.classList.add('visible');
            if (!CONFIG.autoHide) return;

            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (!isDragging) track.classList.remove('visible');
            }, CONFIG.idleTimeout);
        }

        function scrollFractionToThumbTop(fraction) {
            const maxThumbTravel = trackHeight - thumbHeight;
            return fraction * maxThumbTravel;
        }

        function thumbTopToScrollFraction(thumbTop) {
            const maxThumbTravel = trackHeight - thumbHeight;
            if (maxThumbTravel <= 0) return 0;
            return Math.max(0, Math.min(1, thumbTop / maxThumbTravel));
        }

        /* --------------------------------------------------------
           DESKTOP-ONLY: wheel interception → inertia physics
        -------------------------------------------------------- */
        function onWheel(e) {
            if (!CONFIG.inertiaEnabled) return;
            e.preventDefault();

            const delta = Math.max(-CONFIG.maxVelocity, Math.min(CONFIG.maxVelocity, e.deltaY * CONFIG.wheelMultiplier));
            inertiaVelocity += delta;

            showScrollbar();
        }

        /* Main animation loop — ALWAYS runs (visual thumb-follow
           happens on every screen size). The inertia physics block
           only executes real motion when isDesktop is true AND
           there's active velocity. FIX: the idle/else branch now
           continuously resyncs inertiaTarget to the real scrollY
           every single frame, instead of only zeroing velocity —
           this is what prevents the "snap back to top" bug, since
           inertiaTarget can never go stale while idle. */
        function tick() {
            if (isDesktop && Math.abs(inertiaVelocity) > 0.05) {
                const scrollableHeight = getScrollableHeight();

                inertiaTarget += inertiaVelocity;
                inertiaTarget = Math.max(0, Math.min(scrollableHeight, inertiaTarget));

                inertiaVelocity *= CONFIG.inertiaFriction;

                window.scrollTo({ top: inertiaTarget, left: 0, behavior: 'auto' });
            } else {
                inertiaVelocity = 0;
                // FIX: keep inertiaTarget locked to reality whenever
                // there's no active inertia motion — covers page
                // refresh scroll-restore, DevTools open/close resize,
                // middle-mouse autoscroll, keyboard scroll, or any
                // other non-wheel scroll source. Without this, the
                // NEXT wheel event would add its delta on top of a
                // stale target and snap the page to the wrong place.
                inertiaTarget = window.scrollY;
            }

            // Visual thumb follow — runs on EVERY screen size, always
            // tracks native window.scrollY (mobile relies entirely on
            // native touch-scroll; this just mirrors it visually).
            const scrollableHeight = getScrollableHeight();
            const scrollFraction = Math.max(0, Math.min(1, window.scrollY / scrollableHeight));
            const targetThumbTop = scrollFractionToThumbTop(scrollFraction);

            if (!isDragging) {
                displayedThumbTop += (targetThumbTop - displayedThumbTop) * CONFIG.thumbFollowSpeed;
            } else {
                displayedThumbTop = targetThumbTop;
            }

            thumb.style.transform = `translateY(${displayedThumbTop}px)`;
            rafId = requestAnimationFrame(tick);
        }

        function onScroll() {
            showScrollbar();
        }

        /* --------------------------------------------------------
           DESKTOP-ONLY: click-to-jump + drag-to-scroll on thumb
        -------------------------------------------------------- */
        function onTrackClick(e) {
            if (e.target === thumb || isDragging) return;

            const trackRect = track.getBoundingClientRect();
            const clickY = e.clientY - trackRect.top;
            const targetThumbTop = Math.max(0, Math.min(trackHeight - thumbHeight, clickY - thumbHeight / 2));
            const fraction = thumbTopToScrollFraction(targetThumbTop);

            const scrollableHeight = getScrollableHeight();
            inertiaTarget = fraction * scrollableHeight;
            inertiaVelocity = 0;
            window.scrollTo({ top: inertiaTarget, behavior: 'auto' });
            showScrollbar();
        }

        let dragStartY = 0;
        let dragStartThumbTop = 0;

        function onThumbMouseDown(e) {
            e.preventDefault();
            isDragging = true;
            track.classList.add('dragging');
            dragStartY = e.clientY;
            dragStartThumbTop = displayedThumbTop;

            document.addEventListener('mousemove', onThumbDrag);
            document.addEventListener('mouseup', onThumbDragEnd);
        }

        function onThumbDrag(e) {
            const deltaY = e.clientY - dragStartY;
            const newThumbTop = Math.max(0, Math.min(trackHeight - thumbHeight, dragStartThumbTop + deltaY));
            const fraction = thumbTopToScrollFraction(newThumbTop);

            const scrollableHeight = getScrollableHeight();
            inertiaTarget = fraction * scrollableHeight;
            inertiaVelocity = 0;
            window.scrollTo({ top: inertiaTarget, behavior: 'auto' });

            displayedThumbTop = newThumbTop;
            thumb.style.transform = `translateY(${displayedThumbTop}px)`;
        }

        function onThumbDragEnd() {
            isDragging = false;
            track.classList.remove('dragging');
            document.removeEventListener('mousemove', onThumbDrag);
            document.removeEventListener('mouseup', onThumbDragEnd);
            showScrollbar();
        }

        recalculateThumbSize();
        showScrollbar();

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', recalculateThumbSize);

        // Wheel/click/drag listeners ONLY bound on desktop — this is
        // the core fix: mobile gets zero extra event listeners beyond
        // scroll/resize, so native touch-scroll physics stay untouched.
        if (isDesktop) {
            window.addEventListener('wheel', onWheel, { passive: false });
            track.addEventListener('click', onTrackClick);
            thumb.addEventListener('mousedown', onThumbMouseDown);
        }

        const contentTarget = document.getElementById('scroll-distort-spacer') || document.body;
        new ResizeObserver(recalculateThumbSize).observe(contentTarget);

        rafId = requestAnimationFrame(tick);

        // Handles rotating a tablet/resizing a window across the
        // breakpoint — reloads to cleanly re-bind (or unbind) the
        // desktop-only interaction listeners rather than patching
        // live state, same pattern used in expedition.js originally.
        let lastWidth = window.innerWidth;
        window.addEventListener('resize', () => {
            const currentWidth = window.innerWidth;
            const currentlyDesktop = currentWidth >= CONFIG.minViewportWidth;
            if (currentWidth === lastWidth) return;
            lastWidth = currentWidth;

            if (currentlyDesktop !== isDesktop) {
                location.reload();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();