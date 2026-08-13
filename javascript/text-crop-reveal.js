"use strict";

/**
 * text-crop-reveal.js
 *
 * Animates text so it appears to rise up from behind a rectangular
 * crop/mask. Used for two purposes on this site:
 *   1. Viewport-triggered reveals (data-crop-trigger="inview", the
 *      default) — one-shot animate-in when scrolled into view.
 *   2. Manually-driven crossfade-style transitions (data-crop-trigger
 *      ="manual", used by about-summary.js) — repeated exit/enter
 *      cycles as content changes.
 *
 * REQUIRES companion CSS for .crop-reveal-mask / .crop-reveal-inner.
 *
 * DISTANCE CONFIG:
 * data-crop-distance       — legacy/default travel distance, used as
 *                             fallback for BOTH in/out if the two
 *                             below aren't set (e.g. "100%").
 * data-crop-distance-in    — optional override: how far below resting
 *                             position the entrance starts from (e.g.
 *                             "6px" for a subtle settle-in effect).
 * data-crop-distance-out   — optional override: how far above resting
 *                             position the exit ends at (e.g. "5px").
 *
 * MANUAL API:
 * window.runCropReveal(el, onComplete)
 * window.resetCropReveal(el)
 * window.hideCropReveal(el)
 * window.hideCropRevealUpward(el, speedMultiplier, onComplete)
 * window.rebuildCropReveal(el, newText)
 */
(function () {
  'use strict';

  // ==========================================================
  // DEFAULT CONFIG
  // ==========================================================
  const DEFAULT_CONFIG = {
    lineHeightMultiplier: 1.18,
    lineStagger:   60,
    letterStagger: 10,
  };

  // ==========================================================
  // FONT-READY GATE — awaited exactly once, at top-level init().
  // ==========================================================
  const fontsReady = (document.fonts && document.fonts.ready)
    ? document.fonts.ready
    : Promise.resolve();

  // ==========================================================
  // SPLIT — preserves nested HTML tags like <span>01</span>
  // ==========================================================
  function splitIntoUnits(element, unitType, lineHeightPx) {
    const animatedSpans = [];

    function createMaskedUnit(content, parentContainer) {
      const mask = document.createElement('span');
      mask.className = 'crop-reveal-mask';
      mask.style.display = 'inline-block';
      mask.style.overflow = 'hidden';
      mask.style.verticalAlign = 'bottom';
      if (lineHeightPx) mask.style.height = `${lineHeightPx}px`;

      const inner = document.createElement('span');
      inner.className = 'crop-reveal-inner';
      inner.style.display = 'inline-block';
      inner.style.willChange = 'transform, opacity';
      inner.style.backfaceVisibility = 'hidden';
      inner.textContent = content;
      if (lineHeightPx) inner.style.lineHeight = `${lineHeightPx}px`;

      mask.appendChild(inner);
      parentContainer.appendChild(mask);
      animatedSpans.push(inner);
    }

    function processNode(node, container) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (!text) return;

        if (unitType === 'letter') {
          const words = text.split(' ');
          words.forEach((word, wordIndex) => {
            if (word.length > 0) {
              const wordWrapper = document.createElement('span');
              wordWrapper.className = 'crop-word-wrapper';
              wordWrapper.style.display = 'inline-block';
              wordWrapper.style.whiteSpace = 'nowrap';
              word.split('').forEach((char) => createMaskedUnit(char, wordWrapper));
              container.appendChild(wordWrapper);
            }
            if (wordIndex < words.length - 1) {
              container.appendChild(document.createTextNode(' '));
            }
          });
        } else if (unitType === 'word') {
          const words = text.split(' ').filter((w) => w.length > 0);
          words.forEach((word, i) => {
            createMaskedUnit(word, container);
            if (i < words.length - 1) container.appendChild(document.createTextNode(' '));
          });
        } else {
          createMaskedUnit(text, container);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const clone = node.cloneNode(false);
        container.appendChild(clone);
        Array.from(node.childNodes).forEach((child) => processNode(child, clone));
      }
    }

    const originalNodes = Array.from(element.childNodes);
    element.textContent = '';
    originalNodes.forEach((node) => processNode(node, element));

    return animatedSpans;
  }

  // ==========================================================
  // GROUP UNITS BY VISUAL LINE
  // ==========================================================
  function groupUnitsByLines(units) {
    if (!units || units.length === 0) return [];

    const lines = [];
    let currentLine = [];
    let currentTop = null;

    units.forEach((unit) => {
      const top = Math.round(unit.getBoundingClientRect().top);
      if (currentTop === null || Math.abs(top - currentTop) < 4) {
        currentLine.push(unit);
        if (currentTop === null) currentTop = top;
      } else {
        if (currentLine.length > 0) lines.push(currentLine);
        currentLine = [unit];
        currentTop = top;
      }
    });

    if (currentLine.length > 0) lines.push(currentLine);
    return lines;
  }

  // ==========================================================
  // HELPERS
  // ==========================================================
  function computeLineHeightPx(element, multiplier) {
    const computed = window.getComputedStyle(element);
    let base = parseFloat(computed.lineHeight);
    if (isNaN(base)) base = (parseFloat(computed.fontSize) || 16) * 1.15;
    return base * multiplier;
  }

  function getConfig(element) {
    const speed = parseFloat(element.getAttribute('data-crop-speed'));
    const speedMultiplier = !isNaN(speed) && speed > 0 ? speed : 0.4;

    const baseDuration = parseInt(element.getAttribute('data-crop-duration'), 10) || 2000;
    const baseStagger  = parseInt(element.getAttribute('data-crop-stagger'), 10)  || 40;

    const attrLineStagger   = parseInt(element.getAttribute('data-crop-line-stagger'),   10);
    const attrLetterStagger = parseInt(element.getAttribute('data-crop-letter-stagger'), 10);
    const attrLHM = parseFloat(element.getAttribute('data-crop-line-height-multiplier'));
    const inviewThreshold = parseFloat(element.getAttribute('data-crop-inview-threshold'));

    const fallbackDistance = element.getAttribute('data-crop-distance') || '100%';
    const inDistanceAttr  = element.getAttribute('data-crop-distance-in');
    const outDistanceAttr = element.getAttribute('data-crop-distance-out');

    return {
      unit:                 element.getAttribute('data-crop-unit') || 'letter',
      duration:             Math.round(baseDuration * speedMultiplier),
      easing:               element.getAttribute('data-crop-easing') || 'cubic-bezier(0.16, 1, 0.3, 1)',
      stagger:              Math.round(baseStagger * speedMultiplier),
      lineStagger:          !isNaN(attrLineStagger)   ? attrLineStagger   : DEFAULT_CONFIG.lineStagger,
      letterStagger:        !isNaN(attrLetterStagger) ? attrLetterStagger : DEFAULT_CONFIG.letterStagger,
      delay:                parseInt(element.getAttribute('data-crop-delay'), 10) || 500,
      distanceIn:           inDistanceAttr  || fallbackDistance,
      distanceOut:          outDistanceAttr || fallbackDistance,
      lineHeightMultiplier: !isNaN(attrLHM) ? attrLHM : DEFAULT_CONFIG.lineHeightMultiplier,
      inviewThreshold:      !isNaN(inviewThreshold) ? inviewThreshold : 0.2,
      inviewMargin:         element.getAttribute('data-crop-inview-margin') || '0px',
    };
  }

  function forceReflow(units) {
    if (units && units.length > 0) void units[0].offsetHeight;
  }

  // ==========================================================
  // COMPLETION HELPER — real transitionend, with safety-net timeout
  // ==========================================================
  function onUnitTransitionComplete(unit, estimatedMs, callback) {
    let fired = false;

    function finish() {
      if (fired) return;
      fired = true;
      unit.removeEventListener('transitionend', onEnd);
      clearTimeout(safetyTimer);
      callback();
    }

    function onEnd(e) {
      if (e.propertyName === 'transform' || e.propertyName === 'opacity') {
        finish();
      }
    }

    unit.addEventListener('transitionend', onEnd);
    const safetyTimer = setTimeout(finish, estimatedMs + 120);
  }

  // ==========================================================
  // CORE — PREPARE
  // Initial hidden position uses distanceIn (this is where the
  // entrance animation starts FROM).
  // ==========================================================
  function prepareCropReveal(element) {
    if (element.dataset.cropRevealPrepared === 'true') return;
    element.dataset.cropRevealPrepared = 'true';

    const config = getConfig(element);
    const lineHeightPx = computeLineHeightPx(element, config.lineHeightMultiplier);
    const units = splitIntoUnits(element, config.unit, lineHeightPx);

    units.forEach((unit) => {
      unit.style.transition = 'none';
      unit.style.transform  = `translateY(${config.distanceIn})`;
      unit.style.opacity    = '0';
    });

    forceReflow(units);

    element._cropRevealConfig = config;
    element._cropRevealUnits  = units;
  }

  // ==========================================================
  // CORE — RUN (animate IN)
  // Always animates TO translateY(0) — the starting position
  // (distanceIn) was already set by prepareCropReveal/resetCropReveal.
  // ==========================================================
  function runCropReveal(element, onComplete) {
    if (!element) return;

    if (element.dataset.cropRevealPrepared !== 'true') {
      prepareCropReveal(element);
    }

    if (element.dataset.cropRevealDone === 'true') {
      if (onComplete) onComplete();
      return;
    }

    element.dataset.cropRevealDone = 'true';

    const config = element._cropRevealConfig;
    const units  = element._cropRevealUnits;
    const isLetter = config.unit === 'letter';

    let lastUnit = units[units.length - 1];
    let maxTotalTime = config.delay + config.duration;

    requestAnimationFrame(() => {
      if (isLetter) {
        const lineGroups = groupUnitsByLines(units);
        lineGroups.forEach((lineUnits, lineIndex) => {
          const lineDelay = config.delay + lineIndex * config.lineStagger;
          lineUnits.forEach((unit, i) => {
            const d = lineDelay + i * config.letterStagger;
            unit.style.transition = `transform ${config.duration}ms ${config.easing} ${d}ms, opacity ${config.duration}ms ${config.easing} ${d}ms`;
            unit.style.transform  = 'translateY(0)';
            unit.style.opacity    = '1';

            const total = d + config.duration;
            if (total >= maxTotalTime) {
              maxTotalTime = total;
              lastUnit = unit;
            }
          });
        });
      } else {
        units.forEach((unit, i) => {
          const d = config.delay + i * config.stagger;
          unit.style.transition = `transform ${config.duration}ms ${config.easing} ${d}ms, opacity ${config.duration}ms ${config.easing} ${d}ms`;
          unit.style.transform  = 'translateY(0)';
          unit.style.opacity    = '1';

          const total = d + config.duration;
          if (total >= maxTotalTime) {
            maxTotalTime = total;
            lastUnit = unit;
          }
        });
      }

      if (onComplete) {
        onUnitTransitionComplete(lastUnit, maxTotalTime, onComplete);
      }
    });
  }

  // ==========================================================
  // CORE — RESET (instantly re-hide to entrance starting point)
  // ==========================================================
  function resetCropReveal(element) {
    if (!element || !element._cropRevealUnits) return;
    element.dataset.cropRevealDone = 'false';

    const config = element._cropRevealConfig;
    element._cropRevealUnits.forEach((unit) => {
      unit.style.transition = 'none';
      unit.style.transform  = `translateY(${config.distanceIn})`;
      unit.style.opacity    = '0';
    });

    forceReflow(element._cropRevealUnits);
  }

  // ==========================================================
  // CORE — HIDE DOWNWARD (exits toward distanceOut, downward)
  // ==========================================================
  function hideCropReveal(element) {
    if (!element || !element._cropRevealUnits) return;
    element.dataset.cropRevealDone = 'false';

    const config = element._cropRevealConfig;
    const stagger = Math.round(config.stagger * 0.5);

    requestAnimationFrame(() => {
      element._cropRevealUnits.forEach((unit, i) => {
        unit.style.transition = `transform ${config.duration}ms ${config.easing} ${i * stagger}ms, opacity ${config.duration}ms ${config.easing} ${i * stagger}ms`;
        unit.style.transform  = `translateY(${config.distanceOut})`;
        unit.style.opacity    = '0';
      });
    });
  }

  // ==========================================================
  // CORE — HIDE UPWARD (exits toward NEGATED distanceOut, upward)
  // ==========================================================
  function hideCropRevealUpward(element, speedMultiplierOverride, onComplete) {
    if (!element || !element._cropRevealUnits) {
      if (onComplete) onComplete();
      return;
    }
    element.dataset.cropRevealDone = 'false';

    const config = element._cropRevealConfig;
    const attrSpeed = parseFloat(element.getAttribute('data-crop-exit-speed'));
    const sm = !isNaN(speedMultiplierOverride) ? speedMultiplierOverride
             : (!isNaN(attrSpeed) ? attrSpeed : 0.5);

    const exitDuration = Math.round(config.duration * sm);
    const exitEasing   = 'cubic-bezier(0.6, 0, 0.98, 0.34)';
    const isLetter     = config.unit === 'letter';
    const dist         = String(config.distanceOut).trim();
    const negated      = dist.startsWith('-') ? dist.slice(1) : `-${dist}`;

    let lastUnit = element._cropRevealUnits[element._cropRevealUnits.length - 1];
    let maxTotalTime = exitDuration;

    requestAnimationFrame(() => {
      if (isLetter) {
        const exitLineStagger   = Math.round(config.lineStagger   * 0.4);
        const exitLetterStagger = Math.round(config.letterStagger * 0.3);
        const lineGroups = groupUnitsByLines(element._cropRevealUnits);

        lineGroups.forEach((lineUnits, lineIndex) => {
          const lineDelay = lineIndex * exitLineStagger;
          lineUnits.forEach((unit, i) => {
            const d = lineDelay + i * exitLetterStagger;
            unit.style.transition = `transform ${exitDuration}ms ${exitEasing} ${d}ms, opacity ${exitDuration}ms ${exitEasing} ${d}ms`;
            unit.style.transform  = `translateY(${negated})`;
            unit.style.opacity    = '0';

            const total = d + exitDuration;
            if (total >= maxTotalTime) {
              maxTotalTime = total;
              lastUnit = unit;
            }
          });
        });
      } else {
        const exitStagger = Math.round(config.stagger * sm);
        element._cropRevealUnits.forEach((unit, i) => {
          const d = i * exitStagger;
          unit.style.transition = `transform ${exitDuration}ms ${exitEasing} ${d}ms, opacity ${exitDuration}ms ${exitEasing} ${d}ms`;
          unit.style.transform  = `translateY(${negated})`;
          unit.style.opacity    = '0';

          const total = d + exitDuration;
          if (total >= maxTotalTime) {
            maxTotalTime = total;
            lastUnit = unit;
          }
        });
      }

      if (onComplete) {
        onUnitTransitionComplete(lastUnit, maxTotalTime, onComplete);
      }
    });
  }

  // ==========================================================
  // CORE — REBUILD (dynamic content swap)
  // ==========================================================
  function rebuildCropReveal(element, newText) {
    if (!element) return;

    if (element._cropRevealUnits) {
      element._cropRevealUnits.forEach((unit) => {
        unit.style.transition = 'none';
      });
    }

    delete element.dataset.cropRevealPrepared;
    delete element.dataset.cropRevealDone;
    element.textContent = newText;

    prepareCropReveal(element);
  }

  // ==========================================================
  // PUBLIC API
  // ==========================================================
  function runAll(target, onComplete) {
    if (target) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      runCropReveal(el, onComplete);
      return;
    }
    document.querySelectorAll('[data-crop-reveal]').forEach((el) => runCropReveal(el));
  }

  window.runCropReveal        = runAll;
  window.resetCropReveal      = resetCropReveal;
  window.hideCropReveal       = hideCropReveal;
  window.hideCropRevealUpward = hideCropRevealUpward;
  window.rebuildCropReveal    = rebuildCropReveal;

  // ==========================================================
  // INVIEW TRIGGER
  // ==========================================================
  function setupInviewTrigger(element) {
    const config = element._cropRevealConfig || getConfig(element);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runCropReveal(element);
            observer.disconnect();
          }
        });
      },
      { threshold: config.inviewThreshold, rootMargin: config.inviewMargin }
    );
    observer.observe(element);
  }

  // ==========================================================
  // AUTO INIT — waits for fonts.ready exactly once, at the top.
  // ==========================================================
  function init() {
    fontsReady.then(() => {
      const elements = document.querySelectorAll('[data-crop-reveal]');
      elements.forEach((element) => {
        prepareCropReveal(element);

        const trigger = element.getAttribute('data-crop-trigger') || 'inview';
        if (trigger === 'load') {
          runCropReveal(element);
        } else if (trigger === 'inview') {
          setupInviewTrigger(element);
        }
        // 'manual' → wait for window.runCropReveal() call
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();