"use strict";

/**
 * about-summary.js
 *
 * Controls navigation clicks, 8-second auto-play timer, smooth dual-layer
 * image crossfading, and triggers text crop reveal transitions.
 *
 * REBUILT: Text exit → entrance is now CHAINED via the onComplete
 * callback exposed by hideCropRevealUpward() in text-crop-reveal.js,
 * instead of a fixed guessed setTimeout offset. The entrance now
 * starts the exact instant the exit animation actually finishes —
 * no dead gap, no overlap, and it stays correctly in sync even if
 * data-crop-speed / data-crop-exit-speed / data-crop-stagger are
 * ever tuned later on #showcaseText.
 */
(function () {
  "use strict";

  // ==========================================================================
  // CONFIGURATION & CONTROLS
  // ==========================================================================
  const AUTOPLAY_INTERVAL = 15000; // Auto-play cycle time (10 seconds)
  let isAutoPlayEnabled   = true; // Master toggle for auto-play

  // Showcase Data Items
  const showcaseData = [
    {
      id: "01",
      label: "Ahhem... Hey There!",
      text: "I'm Darshan, Motion Designer & Creative Technologist. I break down complex brand problems, and rebuild them into motion & experiences that people connect with.",
      image: "../assets/images/11.jpg"
    },
    {
      id: "02",
      label: "Did someone say airplanes?",
      text: "Certified avgeek. In my free time, I'm probably planespotting, flying a plane in MSFS, or tracking flights. My absolute favorite is the A380.",
      image: "../assets/images/10.jpg"
    },
    {
      id: "03",
      label: "My Current Game Obsession",
      text: "I love immersive open-world RPGs and fast-paced strategic games, helps my mind into critical thinking. 'Control' is my current all time favorite.",
      image: "../assets/images/control-review.jpg"
    },
    {
      id: "04",
      label: "Oh, the random things I Google!",
      text: "I genuinely owe my Google search bar an apology. It's severely overworked because I get curious about the most random things at any point in time.",
      image: "../assets/images/21.jpg"
    },
    {
      id: "05",
      label: "Count me in for any adventure!",
      text: "Always down for an adventure. Cause going completely off-script & embracing real-world chaos makes me feel alive & clears space for creativity.",
      image: "../assets/images/04.jpg"
    }
  ];

  // Internal State
  let currentIndex = 0;
  let autoPlayTimer = null;
  let isAnimating = false;

  // DOM References
  const navList = document.getElementById("showcaseNav");
  const showcaseText = document.getElementById("showcaseText");
  let activeImgEl = document.getElementById("showcaseImageActive");
  let nextImgEl = document.getElementById("showcaseImageNext");

  /**
   * Initializes navigation elements, loads initial item, and starts timer.
   */
  function init() {
    if (!navList || !showcaseText || !activeImgEl || !nextImgEl) return;

    // Render Navigation List Items
    navList.innerHTML = "";
    showcaseData.forEach((item, index) => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.className = `nav-item ${index === 0 ? "active" : ""}`;
      button.innerHTML = `<span>${item.id}</span> <span>${item.label}</span>`;

      button.addEventListener("click", () => {
        selectItem(index);
        resetAutoPlay();
      });

      li.appendChild(button);
      navList.appendChild(li);
    });

    // Set initial image and text
    const initialData = showcaseData[0];
    activeImgEl.src = initialData.image;
    activeImgEl.alt = initialData.label;

    if (window.rebuildCropReveal) {
      window.rebuildCropReveal(showcaseText, initialData.text);
      window.runCropReveal(showcaseText);
    } else {
      showcaseText.textContent = initialData.text;
    }

    // Start auto-play cycle if enabled
    if (isAutoPlayEnabled) {
      startAutoPlay();
    }
  }

  /**
   * Handles transitioning to a selected showcase item index.
   */
  function selectItem(index) {
    if (index === currentIndex || isAnimating) return;
    isAnimating = true;

    // Update Navigation Active State
    const navButtons = navList.querySelectorAll(".nav-item");
    navButtons.forEach((btn) => btn.classList.remove("active")); // turn ALL off
    if (navButtons[index]) navButtons[index].classList.add("active"); // turn only the right one on

    const newContent = showcaseData[index];

    // 1. IMAGE CROSSFADE — runs on its own independent timer, unrelated
    //    to text timing (this is a plain CSS opacity transition, not
    //    part of the crop-reveal engine).
    nextImgEl.src = newContent.image;
    nextImgEl.alt = newContent.label;
    nextImgEl.classList.add("next");

    setTimeout(() => {
      activeImgEl.src = newContent.image;
      activeImgEl.alt = newContent.label;
      nextImgEl.classList.remove("next");
      activeImgEl.classList.add("active");
    }, 850);

    // 2. TEXT EXIT → ENTRANCE, chained via onComplete callback.
    //    Entrance fires the exact instant the exit animation finishes
    //    (computed from real duration + stagger inside
    //    text-crop-reveal.js) — no dead gap, no overlap.
    if (window.hideCropRevealUpward) {
      window.hideCropRevealUpward(showcaseText, undefined, () => {
        if (window.rebuildCropReveal && window.runCropReveal) {
          window.rebuildCropReveal(showcaseText, newContent.text);
          window.runCropReveal(showcaseText);
        } else {
          showcaseText.textContent = newContent.text;
        }

        currentIndex = index;
        isAnimating = false;
      });
    } else {
      // Fallback if the crop-reveal engine isn't loaded at all
      showcaseText.textContent = newContent.text;
      currentIndex = index;
      isAnimating = false;
    }
  }

  /**
   * Starts the 8-second auto-play timer.
   */
  function startAutoPlay() {
    if (!isAutoPlayEnabled) return;
    autoPlayTimer = setInterval(() => {
      const nextIndex = (currentIndex + 1) % showcaseData.length;
      selectItem(nextIndex);
    }, AUTOPLAY_INTERVAL);
  }

  /**
   * Resets and restarts the auto-play timer on manual user interaction.
   */
  function resetAutoPlay() {
    if (autoPlayTimer) clearInterval(autoPlayTimer);
    startAutoPlay();
  }

  // Initialize script execution on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();