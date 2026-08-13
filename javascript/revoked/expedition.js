"use strict";

/**
 * expedition.js
 *
 * 3 WAVES of 3 images each, with crop-reveal text per wave.
 *
 * Waves 1 & 2: normal in -> hold -> out cycle.
 * Wave 3 (last): in -> hold FOREVER — no exit animation at all.
 *
 * The pinned stage (#exp-fixed-stage) uses scroll-distort.js's
 * [data-distort-sticky-top] / [data-distort-sticky-track] mechanism
 * for its pin/release behavior (true CSS position:sticky/fixed
 * cannot be used here since scroll-distort.js transforms its content
 * wrapper, which breaks native sticky/fixed containing-block math).
 */

(function () {

    const CONFIG = {

        SCROLL_DAMPING: 0.18,

        AUTO_TRIM_SCROLL_SPACE: true,

        SCROLL_SPACE_VH: 700,

        WAVE_COUNT: 3,
        WAVE_SPAN: 0.20,
        WAVE_OVERLAP: 0.0,
        WAVE_PACKING_ADJUST: 0.075,

        TEXT_IN_START:  0.00,
        TEXT_IN_END:    0.16,
        IMG_RISE_START: 0.22,
        IMG_RISE_END:   0.38,
        IMG_EXIT_START: 0.60,
        IMG_EXIT_END:   0.70,
        TEXT_OUT_START: 0.64,
        TEXT_OUT_END:   0.74,

        IMG_START_OFFSETS: [1000, 1100, 1000],
        IMG_RISE_STAGGER: 0.02,
        IMG_DRIFT_DISTANCE: 40,
        IMG_EXIT_BUFFER: 100,

        TEXT_EXIT_SPEED_MULTIPLIER: 0.35,

        WAVE_1_SKIP_ENTRANCE: false,
        WAVE_LAST_SKIP_EXIT: true,
        WAVE_LAST_HOLD: 0.12,

        // Per-wave control: true = that wave's images are already in
        // their resting position on page load (no rise-in animation
        // at all for that wave). false = normal behavior, images
        // start below the screen and rise in on scroll.
        // Index 0 = wave 1, 1 = wave 2, 2 = wave 3.
        
        // Base value for desktop. Overridden dynamically below for
        // screens under 900px, where images should always rise in
        // normally rather than start already in place.
        WAVE_IMAGES_START_IN_PLACE_DESKTOP: [true, false, false],
        WAVE_IMAGES_START_IN_PLACE_MOBILE:  [false, false, false],
        MOBILE_BREAKPOINT: 900,
    };

    function getWaveImagesStartInPlace() {
        return window.innerWidth < CONFIG.MOBILE_BREAKPOINT
            ? CONFIG.WAVE_IMAGES_START_IN_PLACE_MOBILE
            : CONFIG.WAVE_IMAGES_START_IN_PLACE_DESKTOP;
    }

    function initExpeditionParallax() {
        const scrollSpace = document.getElementById('exp-scroll-space');
        const fixedStage  = document.getElementById('exp-fixed-stage');

        if (!scrollSpace || !fixedStage) return;

        let vh = window.innerHeight;

        const imageIdGroups = [
            ['exp-img1', 'exp-img2', 'exp-img3'],
            ['exp-img4', 'exp-img5', 'exp-img6'],
            ['exp-img7', 'exp-img8', 'exp-img9'],
        ];

        const waves = [];

        let runningStart = 0;

        for (let i = 0; i < CONFIG.WAVE_COUNT; i++) {
            const spanMultiplier = CONFIG.WAVE_SPAN_MULTIPLIERS
                ? (CONFIG.WAVE_SPAN_MULTIPLIERS[i] ?? 1)
                : 1;
            const thisWaveSpan = CONFIG.WAVE_SPAN * spanMultiplier;

            const waveStart = runningStart;
            runningStart += thisWaveSpan - CONFIG.WAVE_OVERLAP - CONFIG.WAVE_PACKING_ADJUST;

            const isLastWave = i === CONFIG.WAVE_COUNT - 1;
            const imagesStartInPlace = !!getWaveImagesStartInPlace()[i];

            function toGlobal(localFraction) {
                return waveStart + localFraction * thisWaveSpan;
            }

            const images = imageIdGroups[i].map((id, imgIndex) => ({
                el: document.getElementById(id),
                riseDelay: imgIndex * CONFIG.IMG_RISE_STAGGER,
                startOffset: imagesStartInPlace
                    ? 0
                    : CONFIG.IMG_START_OFFSETS[imgIndex % CONFIG.IMG_START_OFFSETS.length],
            }));

            waves.push({
                textInStart:  toGlobal(CONFIG.TEXT_IN_START),
                textInEnd:    toGlobal(CONFIG.TEXT_IN_END),
                imgRiseStart: toGlobal(CONFIG.IMG_RISE_START),
                imgRiseEnd:   toGlobal(CONFIG.IMG_RISE_END),
                imgExitStart: toGlobal(CONFIG.IMG_EXIT_START),
                imgExitEnd:   toGlobal(CONFIG.IMG_EXIT_END),
                textOutStart: toGlobal(CONFIG.TEXT_OUT_START),
                textOutEnd:   toGlobal(CONFIG.TEXT_OUT_END),
                textEl: document.querySelector(`.exp-wave-text[data-wave="${i + 1}"]`),
                skipEntranceAnim: i === 0 && CONFIG.WAVE_1_SKIP_ENTRANCE,
                skipExitAnim: isLastWave && CONFIG.WAVE_LAST_SKIP_EXIT,
                imagesStartInPlace,
                cropRevealed: false,
                images,
            });
        }

        let effectiveScrollSpaceVh = CONFIG.SCROLL_SPACE_VH;

        if (CONFIG.AUTO_TRIM_SCROLL_SPACE) {
            const lastWave = waves[waves.length - 1];

            const lastEventEnd = lastWave.skipExitAnim
                ? Math.min(lastWave.imgRiseEnd + CONFIG.WAVE_LAST_HOLD * CONFIG.WAVE_SPAN, 1)
                : Math.max(lastWave.textOutEnd, lastWave.imgExitEnd);

            if (lastEventEnd > 0 && lastEventEnd < 1) {
                effectiveScrollSpaceVh = CONFIG.SCROLL_SPACE_VH * lastEventEnd;

                const rescale = (v) => v / lastEventEnd;
                waves.forEach((wave) => {
                    wave.textInStart  = rescale(wave.textInStart);
                    wave.textInEnd    = rescale(wave.textInEnd);
                    wave.imgRiseStart = rescale(wave.imgRiseStart);
                    wave.imgRiseEnd   = rescale(wave.imgRiseEnd);
                    wave.imgExitStart = rescale(wave.imgExitStart);
                    wave.imgExitEnd   = rescale(wave.imgExitEnd);
                    wave.textOutStart = rescale(wave.textOutStart);
                    wave.textOutEnd   = rescale(wave.textOutEnd);
                });
            }
        }

        scrollSpace.style.height = `${effectiveScrollSpaceVh}vh`;

        function tryRefreshSticky(attempts = 0) {
            if (window.scrollDistort && window.scrollDistort.refreshStickyTop) {
                window.scrollDistort.refreshStickyTop();
            } else if (attempts < 20) {
                setTimeout(() => tryRefreshSticky(attempts + 1), 50);
            }
        }
        tryRefreshSticky();

        function easeIn(t) { return t * t; }
        function easeOut(t) { return 1 - Math.pow(1 - t, 2); }
        function clamp01(t) { return Math.max(0, Math.min(1, t)); }

        function forceShowInstantly(wave) {
            if (!wave.textEl) return false;
            if (!wave.textEl._cropRevealUnits) return false;

            wave.textEl._cropRevealUnits.forEach((unit) => {
                unit.style.transitionProperty = 'none';
                unit.style.transform = 'translateY(0)';
                unit.style.opacity = '1';
            });
            wave.textEl.dataset.cropRevealDone = 'true';
            wave.cropRevealed = true;
            return true;
        }

        waves.forEach((wave) => {
            if (!wave.skipEntranceAnim) return;
            if (forceShowInstantly(wave)) return;

            let attempts = 0;
            const maxAttempts = 50;
            const retryInterval = setInterval(() => {
                attempts++;
                if (forceShowInstantly(wave) || attempts >= maxAttempts) {
                    clearInterval(retryInterval);
                }
            }, 50);
        });

        let smoothedProgress = 0;
        let progressInitialized = false;

        function updateExpedition() {
            const rect = scrollSpace.getBoundingClientRect();
            const maxScroll = scrollSpace.offsetHeight - window.innerHeight;

            if (maxScroll <= 0) return;

            const scrolledIntoSection = -rect.top;
            const rawProgress = clamp01(scrolledIntoSection / maxScroll);

            if (!progressInitialized) {
                smoothedProgress = rawProgress;
                progressInitialized = true;
            } else {
                smoothedProgress += (rawProgress - smoothedProgress) * CONFIG.SCROLL_DAMPING;
            }

            const progress = smoothedProgress;

            const isInSection = rect.top <= window.innerHeight && rect.bottom >= 0;
            fixedStage.classList.toggle('is-active', isInSection);

            if (!isInSection) return;

            waves.forEach((wave) => {

                if (wave.textEl) {
                    if (wave.skipExitAnim) {
                        if (progress >= wave.textInStart) {
                            if (!wave.cropRevealed) {
                                if (wave.skipEntranceAnim) {
                                    forceShowInstantly(wave);
                                } else {
                                    window.resetCropReveal(wave.textEl);
                                    window.runCropReveal(wave.textEl);
                                    wave.cropRevealed = true;
                                }
                            }
                        } else if (wave.cropRevealed) {
                            window.hideCropRevealUpward(wave.textEl, CONFIG.TEXT_EXIT_SPEED_MULTIPLIER);
                            wave.cropRevealed = false;
                        }
                    } else {
                        const shouldBeRevealed = progress >= wave.textInStart && progress < wave.textOutStart;

                        if (shouldBeRevealed && !wave.cropRevealed) {
                            if (wave.skipEntranceAnim) {
                                forceShowInstantly(wave);
                            } else {
                                window.resetCropReveal(wave.textEl);
                                window.runCropReveal(wave.textEl);
                                wave.cropRevealed = true;
                            }
                        } else if (!shouldBeRevealed && wave.cropRevealed) {
                            window.hideCropRevealUpward(wave.textEl, CONFIG.TEXT_EXIT_SPEED_MULTIPLIER);
                            wave.cropRevealed = false;
                        }
                    }
                }

                wave.images.forEach((item) => {
                    if (!item.el) return;

                    const imgHeight = item.el.offsetHeight || 400;
                    const exitDistance = vh + imgHeight + CONFIG.IMG_EXIT_BUFFER;

                    const riseStart = wave.imgRiseStart + item.riseDelay;
                    const riseEnd   = wave.imgRiseEnd + item.riseDelay;

                    const imgProgress = wave.skipExitAnim
                        ? Math.min(progress, wave.imgExitStart)
                        : progress;

                    let y;

                    if (wave.imagesStartInPlace && imgProgress < wave.imgExitStart) {
                        y = 0;
                    } else if (imgProgress < riseStart) {
                        y = item.startOffset;
                    } else if (imgProgress <= riseEnd) {
                        const riseRange = riseEnd - riseStart;
                        const riseProgress = riseRange > 0
                            ? clamp01((imgProgress - riseStart) / riseRange)
                            : 1;
                        y = item.startOffset * (1 - easeOut(riseProgress));
                    } else if (imgProgress <= wave.imgExitStart) {
                        const driftRange = wave.imgExitStart - riseEnd;
                        const driftProgress = driftRange > 0
                            ? clamp01((imgProgress - riseEnd) / driftRange)
                            : 0;
                        y = -driftProgress * CONFIG.IMG_DRIFT_DISTANCE;
                    } else if (imgProgress <= wave.imgExitEnd) {
                        const exitRange = wave.imgExitEnd - wave.imgExitStart;
                        const exitProgress = exitRange > 0
                            ? clamp01((imgProgress - wave.imgExitStart) / exitRange)
                            : 1;
                        y = -CONFIG.IMG_DRIFT_DISTANCE - easeIn(exitProgress) * exitDistance;
                    } else {
                        y = -CONFIG.IMG_DRIFT_DISTANCE - exitDistance;
                    }

                    item.el.style.transform = `translateY(${y}px)`;
                });
            });
        }

        function raf() {
            updateExpedition();
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        let lastWidth = window.innerWidth;
        let lastWasMobile = window.innerWidth < CONFIG.MOBILE_BREAKPOINT;
        let resizeDebounceTimer = null;

        function recalcOnResize() {
            vh = window.innerHeight;
            scrollSpace.style.height = `${effectiveScrollSpaceVh}vh`;
            tryRefreshSticky();
            updateExpedition();
        }

        window.addEventListener('resize', () => {
            const currentWidth = window.innerWidth;
            const currentIsMobile = currentWidth < CONFIG.MOBILE_BREAKPOINT;

            if (currentWidth === lastWidth) return;
            lastWidth = currentWidth;

            // If we've crossed the mobile/desktop breakpoint, the
            // imagesStartInPlace values baked into each wave object
            // are now stale — full re-init is the simplest reliable
            // fix rather than trying to patch live wave state.
            if (currentIsMobile !== lastWasMobile) {
                lastWasMobile = currentIsMobile;
                location.reload();
                return;
            }

            clearTimeout(resizeDebounceTimer);
            resizeDebounceTimer = setTimeout(recalcOnResize, 150);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExpeditionParallax);
    } else {
        initExpeditionParallax();
    }

})();