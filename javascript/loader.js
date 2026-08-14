(function () {
  'use strict';

  /* =========================================================
     CONFIGURATION
     ========================================================= */
  const CONFIG = {
    MIN_LOADING_TIME_MS: 2000,    // Minimum load time in ms
    SHOW_TEXT_AND_PERCENT: false, // Set to true to show percentage/subtext
    
    // Selectors
    wrapperSelector: '#loader-wrapper',
    barSelector: '#loader-bar',
    percentSelector: '#loader-percent', // Optional
    msgSelector: '#loader-msg'           // Optional
  };

  /* =========================================================
     INITIALIZATION & GUARD CLAUSE
     ========================================================= */
  const wrapperEl = document.querySelector(CONFIG.wrapperSelector);

  // CRITICAL GUARD: If this page does not have a loader, exit immediately!
  if (!wrapperEl) {
    document.body.classList.add('is-ready');
    return;
  }

  const barEl = document.querySelector(CONFIG.barSelector);
  const percentEl = document.querySelector(CONFIG.percentSelector);
  const msgEl = document.querySelector(CONFIG.msgSelector);

  // Hide percentage and subtext if configured
  if (!CONFIG.SHOW_TEXT_AND_PERCENT) {
    if (percentEl) percentEl.style.display = 'none';
    if (msgEl) msgEl.style.display = 'none';
  }

  /* =========================================================
     REAL LOADING & TIME TRACKING
     ========================================================= */
  const startTime = Date.now();
  
  // FIX FOR CACHED/FAST LOADS: Check document.readyState immediately
  let isWindowLoaded = document.readyState === 'complete';

  if (!isWindowLoaded) {
    window.addEventListener('load', () => { isWindowLoaded = true; }, { once: true });
  }

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

  /* =========================================================
     ANTICIPATION LOADER LOOP
     ========================================================= */
  let currentProgress = 0;
  let tick = 0;

  function updateLoader() {
    tick++;
    const elapsedTime = Date.now() - startTime;
    const timeProgress = Math.min((elapsedTime / CONFIG.MIN_LOADING_TIME_MS) * 100, 100);

    const assetRatio = totalResources > 0 ? (loadedResources / totalResources) : 1;
    let domRatio = document.readyState === 'complete' || isWindowLoaded ? 1 : 0.5;
    const realProgress = ((assetRatio * 0.6) + (domRatio * 0.4)) * 100;

    const fullyReady = (document.readyState === 'complete' || isWindowLoaded) && (elapsedTime >= CONFIG.MIN_LOADING_TIME_MS);
    let target = Math.min(realProgress, timeProgress);

    if (fullyReady) {
      target = 100;
    } else {
      target = Math.min(target, 99);
    }

    // Anticipation rhythm
    const cycle = tick % 90;
    let increment = 0.4;

    if (cycle < 30) {
      increment = 0.9;  // Burst
    } else if (cycle < 60) {
      increment = 0.1;  // Slow / Stall
    } else {
      increment = 0.4;  // Crawl
    }

    if (fullyReady) {
      increment = 3.0; // Quick finish once fully ready
    }

    // Advance progress bar
    if (currentProgress < target) {
      currentProgress += increment;
      if (currentProgress > target) currentProgress = target;
    } else if (currentProgress < 99 && !fullyReady) {
      currentProgress += 0.03;
    }

    if (currentProgress > 100) currentProgress = 100;

    // Render bar and text
    if (barEl) barEl.style.width = `${currentProgress}%`;
    if (CONFIG.SHOW_TEXT_AND_PERCENT && percentEl) {
      percentEl.textContent = `${Math.floor(currentProgress)}%`;
    }

    // Completion check
    if (currentProgress >= 100 && fullyReady) {
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
      if (wrapperEl) wrapperEl.classList.add('loaded');
      document.body.classList.add('is-ready');
      document.body.style.overflow = '';

      setTimeout(() => {
        if (wrapperEl) wrapperEl.style.display = 'none';
        initPageEffects();
      }, 1200);

    }, 300);
  }

  function initPageEffects() {
    console.log("Page revealed. Initializing page scripts and animations...");
  }

  // Start loader loop
  requestAnimationFrame(updateLoader);

})();