"use strict";

/**
 * scroll-zoom.js
 *
 * Attach to any <img> via a data attribute:
 *   <img src="..." data-scroll-zoom>
 *
 * Behavior:
 * - Image starts zoomed IN (larger than its natural size).
 * - As it scrolls into view, it settles down to its normal size (zoom out).
 * - As it scrolls OUT of view (either direction, top or bottom), it zooms
 *   back in again.
 * - This is NOT a one-time animation — it uses IntersectionObserver's
 *   ongoing enter/exit callbacks, so it replays every single time the
 *   image crosses in/out of the viewport, in both scroll directions.
 *
 * Configure via data attributes (all optional):
 *   data-scroll-zoom-scale="1.3"     -> starting zoom scale (default 1.25)
 *   data-scroll-zoom-duration="900"  -> transition duration in ms (default 800)
 *   data-scroll-zoom-threshold="0.15" -> how much of image must be visible (default 0.1)
 */
(function () {
  "use strict";

  const CONFIG = {
    attr: "data-scroll-zoom",
    defaultScale: 1.3,
    defaultDuration: 3000,
    defaultThreshold: 0.05,
    defaultEasing: "cubic-bezier(0.506, 0.004, 0, 0.993)"
  };

  const styleId = "scroll-zoom-styles";

  function injectBaseStyles() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [${CONFIG.attr}] {
        will-change: transform;
        transform-origin: center center;
        backface-visibility: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  function setupImage(img) {
    const scale = parseFloat(img.getAttribute("data-scroll-zoom-scale")) || CONFIG.defaultScale;
    const duration = parseInt(img.getAttribute("data-scroll-zoom-duration"), 10) || CONFIG.defaultDuration;
    const threshold = parseFloat(img.getAttribute("data-scroll-zoom-threshold")) || CONFIG.defaultThreshold;

    // Inline transition so per-image duration overrides work without
    // needing separate CSS rules per element.
    img.style.transition = `transform ${duration}ms ${CONFIG.defaultEasing}`;

    // Start zoomed in.
    img.style.transform = `scale(${scale})`;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // In view -> settle to natural size (zoom out).
            img.style.transform = "scale(1)";
          } else {
            // Out of view (top or bottom) -> zoom back in, ready to
            // replay the effect next time it re-enters.
            img.style.transform = `scale(${scale})`;
          }
        });
      },
      {
        threshold,
        root: null,
        rootMargin: "0px"
      }
    );

    observer.observe(img);
  }

  function init() {
    injectBaseStyles();
    const images = document.querySelectorAll(`[${CONFIG.attr}]`);
    images.forEach((img) => {
      // If the image hasn't finished loading, dimensions/layout can
      // shift right as the effect starts — wait for load if needed,
      // otherwise set up immediately.
      if (img.complete) {
        setupImage(img);
      } else {
        img.addEventListener("load", () => setupImage(img), { once: true });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();