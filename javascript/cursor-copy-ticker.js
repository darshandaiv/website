"use strict";

/**
 * cursor-copy-ticker.js
 *
 * Replaces the cursor with a circular rotating ticker while hovering
 * any element with the `.ticker` class (or a custom selector).
 * Follows the mouse smoothly, rotates continuously.
 *
 * Two modes, set per-element via data-ticker-mode:
 *
 * - "copy" (default): copies an email/text to the clipboard on
 *   click, briefly showing a "Copied!" color/text state.
 *
 * - "button": runs a custom action on click instead — either
 *   navigating to a URL (data-ticker-href) or calling a named global
 *   function (data-ticker-action). No clipboard/copy behavior.
 *
 * The displayed text can be overridden per-element in EITHER mode
 * via data-ticker-text, without touching the global CONFIG defaults.
 *
 * Disabled entirely below the configured mobile breakpoint, since
 * this is a hover-driven interaction with no touch equivalent.
 *
 * ------------------------------------------------------------------
 * SETUP
 * ------------------------------------------------------------------
 * Copy mode (default — no data-ticker-mode needed):
 *   <div class="ticker" data-ticker data-copy-email="hello@x.com">
 *
 * Button mode, link:
 *   <div class="ticker" data-ticker data-ticker-mode="button"
 *        data-ticker-text="VIEW PROJECT • " data-ticker-href="/work">
 *
 * Button mode, custom JS function:
 *   <div class="ticker" data-ticker data-ticker-mode="button"
 *        data-ticker-text="PLAY REEL • " data-ticker-action="openReelModal">
 *
 * ------------------------------------------------------------------
 * REQUIRED VALUE TO KNOW: All tuning knobs live in CONFIG below —
 * edit there, not inline in HTML, unless overriding per-element via
 * the data-ticker-* attributes documented in readElementConfig().
 * ------------------------------------------------------------------
 * LOAD ORDER: Independent of script.js — no shared state. Can be
 * loaded in any order relative to it, as long as it loads after
 * the DOM elements with .ticker exist (handled via DOMContentLoaded
 * guard below regardless).
 */
(function () {
    'use strict';

    // ==========================================================
    // CONFIGURATION
    // ==========================================================
    const CONFIG = {
        triggerSelector: '.ticker',
        defaultEmail: 'hello@example.com',
        minViewportWidth: 768,

        size: 150,
        circlePadding: 30,

        // --- Default state text (used in "copy" mode, and as the
        //     fallback in "button" mode if data-ticker-text isn't set) ---
        text: 'COPY EMAIL • COPY EMAIL • COPY EMAIL • ',
        copiedText: 'COPIED! • COPIED! • COPIED! • COPIED! •',
        defaultButtonText: 'CLICK HERE • CLICK HERE • ',

        rotationSpeed: 70,
        fontSize: 16,
        letterSpacing: 1,

        // --- Default state colors ---
        textColor: 'var(--dark)',
        backgroundColor: 'var(--white)',
        borderColor: 'none',

        // --- "Copied!" state colors (copy mode only) ---
        copiedTextColor: 'var(--white)',
        copiedBackgroundColor: 'var(--purple)',
        copiedBorderColor: 'var(--purple)',

        // --- "Clicked" flash colors (button mode only, optional) ---
        buttonClickFlashEnabled: true,
        buttonClickedTextColor: 'var(--white)',
        buttonClickedBackgroundColor: 'var(--purple)',
        buttonClickedBorderColor: 'var(--purple)',
        buttonClickFlashDuration: 400, // ms the flash color holds before reverting (shorter than copiedDisplayDuration since there's no "confirmation message" to read)

        followSpeed: 0.1,
        scaleInDuration: 250,
        scaleOutDuration: 200,
        pressedScale: 0.82,
        pressedTransitionDuration: 120,
        colorTransitionDuration: 200,

        copiedDisplayDuration: 2500,

        zIndex: 10005,
        hideNativeCursorClass: 'copy-ticker-active'
    };
    // ==========================================================
    // END CONFIGURATION
    // ==========================================================

    const RADIUS = 96;

    /* Injects the circular rotating text cursor's DOM structure. */
    function buildCursorElement() {
        const wrapper = document.createElement('div');
        wrapper.id = 'copyTickerCursor';
        wrapper.setAttribute('data-distort-ignore', '');
        wrapper.setAttribute('aria-hidden', 'true');

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 200 200');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');

        const circle = document.createElementNS(svgNS, 'circle');
        circle.id = 'copyTickerCircle';
        circle.setAttribute('cx', '100');
        circle.setAttribute('cy', '100');
        circle.setAttribute('r', String(RADIUS));
        circle.setAttribute('fill', CONFIG.backgroundColor);
        circle.setAttribute('stroke', CONFIG.borderColor);
        circle.setAttribute('stroke-width', '1');
        circle.style.transition = `fill ${CONFIG.colorTransitionDuration}ms ease, stroke ${CONFIG.colorTransitionDuration}ms ease`;

        const textRadius = Math.max(10, RADIUS - CONFIG.circlePadding);

        const textPath = document.createElementNS(svgNS, 'path');
        const pathId = 'copyTickerTextPath';
        textPath.setAttribute('id', pathId);
        textPath.setAttribute(
            'd',
            `M100,100 m-${textRadius},0 a${textRadius},${textRadius} 0 1,1 ${textRadius * 2},0 a${textRadius},${textRadius} 0 1,1 -${textRadius * 2},0`
        );
        textPath.setAttribute('fill', 'none');

        const text = document.createElementNS(svgNS, 'text');
        text.id = 'copyTickerText';
        text.setAttribute('font-size', CONFIG.fontSize);
        text.setAttribute('letter-spacing', CONFIG.letterSpacing);
        text.setAttribute('fill', CONFIG.textColor);
        text.style.fontFamily = 'var(--bodyFont, sans-serif)';
        text.style.textTransform = 'uppercase';
        text.style.transition = `fill ${CONFIG.colorTransitionDuration}ms ease`;

        const textPathRef = document.createElementNS(svgNS, 'textPath');
        textPathRef.setAttributeNS('http://www.w3.org/1999/xlink', 'href', `#${pathId}`);
        textPathRef.setAttribute('href', `#${pathId}`);
        textPathRef.textContent = CONFIG.text;

        text.appendChild(textPathRef);

        const rotatingGroup = document.createElementNS(svgNS, 'g');
        rotatingGroup.id = 'copyTickerRotatingGroup';
        rotatingGroup.appendChild(textPath);
        rotatingGroup.appendChild(text);

        svg.appendChild(circle);
        svg.appendChild(rotatingGroup);
        wrapper.appendChild(svg);
        document.body.appendChild(wrapper);

        return { wrapper, circle, text, textPathRef, rotatingGroup };
    }

    /* Injects required CSS styling */
    function injectStyles() {
        const styleId = 'copy-ticker-cursor-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #copyTickerCursor {
                position: fixed;
                top: 0;
                left: 0;
                width: ${CONFIG.size}px;
                height: ${CONFIG.size}px;
                margin-left: -${CONFIG.size / 2}px;
                margin-top: -${CONFIG.size / 2}px;
                pointer-events: none;
                z-index: ${CONFIG.zIndex};
                opacity: 0;
                transform: scale(0.4);
                transition: opacity ${CONFIG.scaleOutDuration}ms ease,
                            transform ${CONFIG.scaleOutDuration}ms ease;
                will-change: left, top, transform, opacity;
                font-weight: 600;
            }
            #copyTickerCursor.active {
                opacity: 1;
                transform: scale(1);
                transition: opacity ${CONFIG.scaleInDuration}ms ease,
                            transform ${CONFIG.scaleInDuration}ms ease;
            }
            #copyTickerCursor.pressed {
                transform: scale(${CONFIG.pressedScale});
                mix-blend-mode: normal;
                transition: transform ${CONFIG.pressedTransitionDuration}ms ease;
            }
            #copyTickerCursor svg {
                display: block;
            }

            body.${CONFIG.hideNativeCursorClass} .cursor-dot,
            body.${CONFIG.hideNativeCursorClass} .cursor-ring {
                opacity: 0 !important;
            }
        `;
        document.head.appendChild(style);
    }

    /* Clipboard helpers (copy mode only) */
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const tempInput = document.createElement('textarea');
        tempInput.value = text;
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.warn('[copy-ticker] Clipboard copy failed:', err);
        }
        document.body.removeChild(tempInput);
    }

    /* Reads per-element configuration from its data-attributes. */
    function readElementConfig(el) {
        const mode = el.getAttribute('data-ticker-mode') === 'button' ? 'button' : 'copy';

        return {
            mode,
            email: el.getAttribute('data-copy-email') || CONFIG.defaultEmail,
            customText: el.getAttribute('data-ticker-text') || null,
            href: el.getAttribute('data-ticker-href') || null,
            hrefTarget: el.getAttribute('data-ticker-href-target') || '_self',
            actionName: el.getAttribute('data-ticker-action') || null
        };
    }

    /* Main controller */
    function init() {
        if (window.innerWidth < CONFIG.minViewportWidth) return;

        injectStyles();
        const { wrapper, circle, text, textPathRef, rotatingGroup } = buildCursorElement();

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let displayX = mouseX;
        let displayY = mouseY;

        let rotationAngle = 0;
        let lastFrameTime = null;
        let isActive = false;
        let activeElementConfig = null;
        let flashTimeout = null;
        let rafId = null;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function tick(timestamp) {
            if (lastFrameTime === null) lastFrameTime = timestamp;
            const deltaSeconds = (timestamp - lastFrameTime) / 1000;
            lastFrameTime = timestamp;

            displayX += (mouseX - displayX) * CONFIG.followSpeed;
            displayY += (mouseY - displayY) * CONFIG.followSpeed;
            wrapper.style.left = displayX + 'px';
            wrapper.style.top = displayY + 'px';

            rotationAngle = (rotationAngle + CONFIG.rotationSpeed * deltaSeconds) % 360;
            rotatingGroup.setAttribute('transform', `rotate(${rotationAngle} 100 100)`);

            rafId = requestAnimationFrame(tick);
        }
        rafId = requestAnimationFrame(tick);

        /* Sets circle/text colors. state = 'default' | 'copied' | 'buttonFlash' */
        function setColors(state) {
            if (state === 'copied') {
                circle.setAttribute('fill', CONFIG.copiedBackgroundColor);
                circle.setAttribute('stroke', CONFIG.copiedBorderColor);
                text.setAttribute('fill', CONFIG.copiedTextColor);
            } else if (state === 'buttonFlash') {
                circle.setAttribute('fill', CONFIG.buttonClickedBackgroundColor);
                circle.setAttribute('stroke', CONFIG.buttonClickedBorderColor);
                text.setAttribute('fill', CONFIG.buttonClickedTextColor);
            } else {
                circle.setAttribute('fill', CONFIG.backgroundColor);
                circle.setAttribute('stroke', CONFIG.borderColor);
                text.setAttribute('fill', CONFIG.textColor);
            }
        }

        /* Resolves the correct resting-state text for an element,
           based on its mode and optional data-ticker-text override. */
        function resolveRestingText(elConfig) {
            if (elConfig.customText) return elConfig.customText;
            return elConfig.mode === 'button' ? CONFIG.defaultButtonText : CONFIG.text;
        }

        function activate(elConfig) {
            isActive = true;
            activeElementConfig = elConfig;
            wrapper.classList.add('active');
            document.body.classList.add(CONFIG.hideNativeCursorClass);

            textPathRef.textContent = resolveRestingText(elConfig);
            setColors('default');
        }

        function deactivate() {
            isActive = false;
            wrapper.classList.remove('active');
            wrapper.classList.remove('pressed');
            document.body.classList.remove(CONFIG.hideNativeCursorClass);
            clearTimeout(flashTimeout);
            setColors('default');
            activeElementConfig = null;
        }

        /* Copy-mode click handling */
        function handleCopyClick(elConfig) {
            copyToClipboard(elConfig.email);

            textPathRef.textContent = CONFIG.copiedText;
            setColors('copied');

            clearTimeout(flashTimeout);
            flashTimeout = setTimeout(() => {
                if (isActive) {
                    textPathRef.textContent = resolveRestingText(elConfig);
                    setColors('default');
                }
            }, CONFIG.copiedDisplayDuration);
        }

        /* Button-mode click handling — runs a URL navigation or a
           named global function, with an optional brief color flash. */
        function handleButtonClick(elConfig, triggerEl) {
            if (CONFIG.buttonClickFlashEnabled) {
                setColors('buttonFlash');
                clearTimeout(flashTimeout);
                flashTimeout = setTimeout(() => {
                    if (isActive) setColors('default');
                }, CONFIG.buttonClickFlashDuration);
            }

            if (elConfig.actionName) {
                const fn = window[elConfig.actionName];
                if (typeof fn === 'function') {
                    fn(triggerEl);
                } else {
                    console.warn(`[copy-ticker] data-ticker-action="${elConfig.actionName}" is not a function on window.`);
                }
            } else if (elConfig.href) {
                if (elConfig.hrefTarget === '_blank') {
                    window.open(elConfig.href, '_blank');
                } else {
                    window.location.href = elConfig.href;
                }
            }
        }

        function handleClick(e) {
            if (!isActive || !activeElementConfig) return;

            if (activeElementConfig.mode === 'button') {
                handleButtonClick(activeElementConfig, e.currentTarget);
            } else {
                handleCopyClick(activeElementConfig);
            }
        }

        function handleMouseDown() {
            if (!isActive) return;
            wrapper.classList.add('pressed');
        }

        function handleMouseUp() {
            wrapper.classList.remove('pressed');
        }

        document.querySelectorAll(CONFIG.triggerSelector).forEach((el) => {
            const elConfig = readElementConfig(el);

            el.addEventListener('mouseenter', () => activate(elConfig));
            el.addEventListener('mouseleave', deactivate);
            el.addEventListener('click', handleClick);
            el.addEventListener('mousedown', handleMouseDown);
        });

        document.addEventListener('mouseup', handleMouseUp);

        window.addEventListener('resize', () => {
            if (window.innerWidth < CONFIG.minViewportWidth && isActive) {
                deactivate();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();