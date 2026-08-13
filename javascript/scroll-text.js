"use strict";

/**
 * scroll-text.js
 *
 * SCROLL-LINKED LINE-BY-LINE TEXT REVEAL ENGINE
 * Groups words dynamically based on their physical wrap coordinates,
 * illuminating text smoothly line-by-line as it enters the scroll view.
 *
 * REQUIRED VALUE TO KNOW: Targets every element with class
 * .scroll-reveal-text — currently used only on case-study pages
 * (case-body description + case-summary paragraph, injected by
 * renderCaseStudy() in cms-projects.js). That's why this script is
 * only loaded on projects/<slug>.html pages, not sitewide.
 */

class ScrollLineReveal {
    constructor(element) {
        this.element = element;
        this.originalText = element.textContent.trim();
        this.init();
    }

    init() {
        this.splitTextIntoWords();
        this.groupWordsIntoLines();
        this.handleScroll();

        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
        window.addEventListener('resize', () => {
            // Re-group wraps on resize (essential for responsive mobile rotation)
            this.groupWordsIntoLines();
            this.handleScroll();
        }, { passive: true });
    }

    /**
     * Initial split: wrap each word in a temporary tag so we can
     * measure positions.
     */
    splitTextIntoWords() {
        const words = this.originalText.split(/\s+/);
        this.element.innerHTML = words.map((word) => `<span class="temp-word">${word}</span>`).join(' ');
    }

    /**
     * Grouping algorithm: measures the vertical coordinate of each
     * word, wrapping elements with matching 'top' values inside
     * unified line wrappers.
     */
    groupWordsIntoLines() {
        const tempWords = this.element.querySelectorAll('.temp-word');
        if (tempWords.length === 0) return;

        const linesMap = {};

        tempWords.forEach((word) => {
            const top = word.offsetTop;
            if (!linesMap[top]) linesMap[top] = [];
            linesMap[top].push(word.textContent);
        });

        const sortedTops = Object.keys(linesMap).sort((a, b) => Number(a) - Number(b));
        this.element.innerHTML = sortedTops
            .map((top) => {
                const lineText = linesMap[top].join(' ');
                return `<div class="reveal-line-wrap"><span class="reveal-line">${lineText}</span></div>`;
            })
            .join('\n');

        this.lines = this.element.querySelectorAll('.reveal-line');
    }

    handleScroll() {
        if (!this.lines) return;

        const viewportHeight = window.innerHeight;

        this.lines.forEach((line) => {
            const rect = line.getBoundingClientRect();

            // REQUIRED VALUES: illumination boundary range — tune here
            // if the reveal feels too early/late relative to scroll.
            const triggerStart = viewportHeight * 0.82; // Lines enter from bottom
            const triggerEnd = viewportHeight * 0.45;   // Lines reach upper viewport half

            let progress = (triggerStart - rect.top) / (triggerStart - triggerEnd);
            progress = Math.max(0, Math.min(1, progress));

            line.style.setProperty('--line-reveal-progress', progress);
        });
    }
}

// Auto-run: instantiates on every matching element once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const targets = document.querySelectorAll('.scroll-reveal-text');
    targets.forEach((target) => new ScrollLineReveal(target));
});