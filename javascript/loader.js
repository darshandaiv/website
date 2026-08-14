(function () {
  'use strict';

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  const CONFIG = {
    MIN_LOADING_TIME_MS: 2000,    // Minimum load time in ms (e.g., 3000 = 3 seconds)
    SHOW_TEXT_AND_PERCENT: false, // Set to true to show percentage/subtext, false to hide
    
    // Selectors
    wrapperSelector: '#loader-wrapper',
    barSelector: '#loader-bar',
    percentSelector: '#loader-percent', // Optional
    msgSelector: '#loader-msg'           // Optional
  };

  /* =========================================================
     INITIALIZATION & TEXT TOGGLE
     ========================================================= */
  const wrapperEl = document.querySelector(CONFIG.wrapperSelector);
  const barEl = document.querySelector(CONFIG.barSelector);
  const percentEl = document.querySelector(CONFIG.percentSelector);
  const msgEl = document.querySelector(CONFIG.msgSelector);

  // Hide or show percentage and subtext according to CONFIG
  if (!CONFIG.SHOW_TEXT_AND_PERCENT) {
    if (percentEl) percentEl.style.display = 'none';
    if (msgEl) msgEl.style.display = 'none';
  }

  /* =========================================================
     REAL LOADING & TIME TRACKING
     ========================================================= */
  const startTime = Date.now();
  let isWindowLoaded = false;
  let totalResources = 0;
  let loadedResources = 0;

  // Asset tracker
  const trackables = document.querySelectorAll('img, script[src], link[rel="stylesheet"], video, audio');
  totalResources = trackables.length;

  function onItemLoaded() { loadedResources++; }

  if (totalResources > 0) {
    trackables.forEach((el) => {
      if (el.complete || el.readyState === 4) {
        onItemLoaded();
      } else {
        el.addEventListener('load', onItemLoaded, { once: true });
        el.addEventListener('error', onItemLoaded, { once: true });
      }
    });
  }

  window.addEventListener('load', () => { isWindowLoaded = true; });

  /* =========================================================
     ANTICIPATION LOADER LOOP (PROGRESS AND SLOW)
     ========================================================= */
  let currentProgress = 0;
  let tick = 0;

  function updateLoader() {
    tick++;
    const elapsedTime = Date.now() - startTime;
    const timeProgress = Math.min((elapsedTime / CONFIG.MIN_LOADING_TIME_MS) * 100, 100);

    // Asset and DOM loading progress calculation
    const assetRatio = totalResources > 0 ? (loadedResources / totalResources) : 1;
    let domRatio = document.readyState === 'complete' || isWindowLoaded ? 1 : 0.5;
    const realProgress = ((assetRatio * 0.6) + (domRatio * 0.4)) * 100;

    // Target progress capped at 99% until both actual load and min time elapse
    let target = Math.min(realProgress, timeProgress);
    
    const isFullyLoaded = isWindowLoaded && (elapsedTime >= CONFIG.MIN_LOADING_TIME_MS);
    if (isFullyLoaded) {
      target = 100;
    } else {
      target = Math.min(target, 99);
    }

    // Anticipation rhythm: Burst -> Slow -> Crawl cycle
    const cycle = tick % 90;
    let increment = 0.4;

    if (cycle < 30) {
      increment = 0.9;  // Burst
    } else if (cycle < 60) {
      increment = 0.1;  // Slow / Stall (Creates anticipation)
    } else {
      increment = 0.4;  // Crawl
    }

    if (isFullyLoaded) {
      increment = 3.0; // Quick finish once fully ready
    }

    // Advance progress bar
    if (currentProgress < target) {
      currentProgress += increment;
      if (currentProgress > target) currentProgress = target;
    } else if (currentProgress < 99 && !isFullyLoaded) {
      currentProgress += 0.03; // Slight trickle
    }

    if (currentProgress > 100) currentProgress = 100;

    // Render bar and optional text
    if (barEl) barEl.style.width = `${currentProgress}%`;
    if (CONFIG.SHOW_TEXT_AND_PERCENT && percentEl) {
      percentEl.textContent = `${Math.floor(currentProgress)}%`;
    }

    // Complete check
    if (currentProgress >= 100 && isFullyLoaded) {
      finishLoading();
    } else {
      requestAnimationFrame(updateLoader);
    }
  }

  /* =========================================================
     COMPLETION & PAGE REVEAL
     ========================================================= */
  function finishLoading() {
    setTimeout(() => {
      // Split horizontally open
      if (wrapperEl) wrapperEl.classList.add('loaded');
      document.body.classList.add('is-ready');
      document.body.style.overflow = '';

      // Hide loader and trigger page script effects
      setTimeout(() => {
        if (wrapperEl) wrapperEl.style.display = 'none';
        initPageEffects();
      }, 1200);

    }, 300);
  }

  /* =========================================================
     TRIGGER PAGE EFFECTS (AFTER LOAD REVEAL)
     ========================================================= */
  function initPageEffects() {
    // Put your page animation/script initialization code here
    console.log("Page revealed. Initializing page scripts and animations...");
  }

  // Start loader
  requestAnimationFrame(updateLoader);

})();