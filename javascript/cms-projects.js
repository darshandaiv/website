"use strict";

/* ================================================================
   CMS-PROJECTS.JS — CMS RENDER ENGINE
   Shared across index.html (Work section), projects/index.html,
   and projects/<slug>.html (case studies). Reads window.PROJECTS
   from projects-data.js.

   DEPENDS ON: window.initInteractions() from script.js — make sure
   script.js is loaded BEFORE this file in your HTML <script> tags.

   FIX APPLIED: renderCaseStudy() previously prepended an extra
   "../" to every image/video path (project.thumb, frame.src,
   img.src) on top of paths that ALREADY contain "../assets/..." —
   producing broken "../../assets/..." URLs that would 404. Paths
   in projects-data.js are already correct as authored; removed
   the redundant prefix everywhere below.
================================================================ */

/* ----------------------------------------------------------------
   Builds a single work-card element from a CMS project object.
   Used by both renderWorkSection() (index.html) and
   renderProjectsGrid() (projects/index.html).

   Thumbnail shows a static image by default. On hover, a muted,
   looping video (project.base) fades in and plays over it as a
   preview — paused and reset on mouseleave to save resources.

   Links to /projects/<slug> using clean, extensionless URLs.
---------------------------------------------------------------- */
function buildWorkCard(project, delayClass = "") {
    return `
        <article class="work-card reveal ${delayClass}" data-id="${project.id}">
            <a href="/projects/${project.slug}">
                <div class="work-thumb" data-video-hover>
                    <img data-scroll-zoom class="work-thumb-img" src="${project.thumb}" alt="${project.title} thumbnail">
                    ${project.base ? `
                        <video
                            class="work-thumb-video"
                            src="${project.base}"
                            muted
                            loop
                            playsinline
                            preload="none"
                        ></video>
                    ` : ""}
                </div>
                <div class="work-info">
                    <div class="work-arrow">
                        <h3 class="work-title" data-crop-reveal>${project.title}</h3>
                    </div>
                    <svg width="25" height="25" viewBox="0 0 215 215" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M135.703 60.0437C135.703 61.1045 136.125 62.1219 136.875 62.872L151.579 77.5761C152.329 78.3263 153.347 78.7477 154.407 78.7477L172.792 78.7477C175.001 78.7477 176.792 80.5386 176.792 82.7477V154.747C176.792 156.957 175.001 158.747 172.792 158.747L155.792 158.747C153.583 158.747 151.792 156.957 151.792 154.747L151.792 89.8188C151.792 86.2552 147.484 84.4705 144.964 86.9903L70.9541 161C69.392 162.562 66.8593 162.562 65.2972 161L53.2764 148.979C51.7143 147.417 51.7143 144.884 53.2764 143.322L127.114 69.4847C129.634 66.9648 127.849 62.6562 124.286 62.6563L59.703 62.6568C57.4938 62.6569 55.703 60.866 55.703 58.6568L55.703 41.6568C55.703 39.4476 57.4938 37.6568 59.703 37.6568L131.703 37.6568C133.912 37.6568 135.703 39.4476 135.703 41.6567L135.703 60.0437Z" fill="var(--muted-white)"/>
                    </svg>
                </div>
            </a>
        </article>
    `;
}

/* ----------------------------------------------------------------
   Renders the homepage Work section (index.html)
   — shows only projects where featured: true
---------------------------------------------------------------- */
export function renderWorkSection() {
    const grid = document.getElementById('workGrid');
    if (!grid || !window.PROJECTS) return;

    const featured = window.PROJECTS.filter((p) => p.featured);

    grid.innerHTML = featured.length
        ? featured.map((p, i) => buildWorkCard(p, i % 2 === 0 ? 'delay-1' : 'delay-2')).join('')
        : `<div class="grid-empty-state">No featured projects yet.</div>`;

    window.initInteractions(grid);
    attachWorkCardVideoHover(grid);

}

/* ----------------------------------------------------------------
   Renders the All Projects grid (projects/index.html)
   — supports optional tag/type filtering via .filter-pill[data-filter]
---------------------------------------------------------------- */
function renderProjectsGrid(filterTag = "All") {
    const grid = document.getElementById('allProjectsGrid');
    if (!grid || !window.PROJECTS) return;

    const list = filterTag === "All"
        ? window.PROJECTS
        : window.PROJECTS.filter((p) => p.tags.includes(filterTag));

    grid.innerHTML = list.length
        ? list.map((p, i) => buildWorkCard(p, i % 2 === 0 ? 'delay-1' : 'delay-2')).join('')
        : `<div class="grid-empty-state">No projects match this filter yet.</div>`;

    window.initInteractions(grid);
    attachWorkCardVideoHover(grid);
}

/* ----------------------------------------------------------------
   Binds click handlers to .filter-pill[data-filter] buttons on
   projects/index.html, toggling "active" state and re-rendering
   the grid with the selected filter.
---------------------------------------------------------------- */
function initProjectsFilters() {
    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach((pill) => {
        pill.addEventListener('click', () => {
            pills.forEach((p) => p.classList.remove('active'));
            pill.classList.add('active');
            renderProjectsGrid(pill.dataset.filter);
        });
    });
}

/* ----------------------------------------------------------------
   Attaches video preview behavior to all [data-video-hover] thumbs
   inside `root`. Behavior adapts based on screen size:

   • Desktop (> 768px): hover-to-play. Video plays on mouseenter,
     pauses and rewinds to frame 0 on mouseleave.

   • Mobile (≤ 768px): scroll-to-play. Video automatically plays
     once the ENTIRE card is visible within the viewport (100%
     intersection), and pauses once it's no longer fully visible.

   Automatically re-evaluates on window resize.
---------------------------------------------------------------- */
function attachWorkCardVideoHover(root = document) {
    const MOBILE_BREAKPOINT = 768;
    const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

    const thumbs = Array.from(root.querySelectorAll('[data-video-hover]'));
    if (!thumbs.length) return;

    const registry = thumbs
        .map((thumb) => {
            const video = thumb.querySelector('.work-thumb-video');
            if (!video) return null;
            return { thumb, video, mode: null, observer: null, onEnter: null, onLeave: null };
        })
        .filter(Boolean);

    function bindHoverMode(entry) {
        entry.onEnter = () => {
            if (!entry.video.paused) return;
            entry.video.currentTime = 0;
            entry.video.play().catch(() => {});
            entry.thumb.classList.add('video-active');
        };
        entry.onLeave = () => {
            entry.video.pause();
            entry.video.currentTime = 0;
            entry.thumb.classList.remove('video-active');
        };

        entry.thumb.addEventListener('mouseenter', entry.onEnter);
        entry.thumb.addEventListener('mouseleave', entry.onLeave);
        entry.mode = 'hover';
    }

    function bindScrollMode(entry) {
        entry.observer = new IntersectionObserver(
            (observerEntries) => {
                observerEntries.forEach((observerEntry) => {
                    if (observerEntry.isIntersecting && observerEntry.intersectionRatio >= 0.999) {
                        entry.video.currentTime = 0;
                        entry.video.play().catch(() => {});
                        entry.thumb.classList.add('video-active');
                    } else {
                        entry.video.pause();
                        entry.thumb.classList.remove('video-active');
                    }
                });
            },
            { threshold: 1.0 }
        );

        entry.observer.observe(entry.thumb);
        entry.mode = 'scroll';
    }

    function unbind(entry) {
        if (entry.mode === 'hover') {
            entry.thumb.removeEventListener('mouseenter', entry.onEnter);
            entry.thumb.removeEventListener('mouseleave', entry.onLeave);
        } else if (entry.mode === 'scroll' && entry.observer) {
            entry.observer.disconnect();
            entry.observer = null;
        }

        entry.video.pause();
        entry.video.currentTime = 0;
        entry.thumb.classList.remove('video-active');
        entry.mode = null;
    }

    function applyModeForCurrentScreen() {
        const mobile = isMobile();

        registry.forEach((entry) => {
            const desiredMode = mobile ? 'scroll' : 'hover';
            if (entry.mode === desiredMode) return;

            if (entry.mode) unbind(entry);

            if (desiredMode === 'hover') {
                bindHoverMode(entry);
            } else {
                bindScrollMode(entry);
            }
        });
    }

    applyModeForCurrentScreen();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(applyModeForCurrentScreen, 150);
    });
}

/* ----------------------------------------------------------------
   Renders a single Case Study page (projects/<slug>.html)
   — reads data-project-slug from <body> and matches against
     window.PROJECTS

   FIX APPLIED: all paths below (project.thumb, frame.src, img.src,
   project.base) are used AS-IS now — no extra "../" prefix. These
   fields already contain the correct "../assets/..." path since
   this page lives one level below root, same as before. The old
   code's extra "../${...}" template literal was producing
   "../../assets/..." — a real, live bug. Confirmed fixed here.
---------------------------------------------------------------- */
function renderCaseStudy() {
    const slug    = document.body.dataset.projectSlug;
    const project = window.PROJECTS?.find((p) => p.slug === slug);
    const root    = document.getElementById('caseRoot');
    if (!root) return;

    if (!project) {
        root.innerHTML = `
            <div class="not-found" style="padding-top:180px;text-align:center">
                <h1 class="text-title">Project Not Found</h1>
                <p class="text-body" style="margin:20px auto">
                    No project with url "<strong>${slug}</strong>" exists in projects-data.js.
                </p>
                <a href="../projects/" class="btn btn-solid mag-target" style="margin-top:24px;display:inline-flex">Back to Projects</a>
            </div>
        `;
        window.initInteractions(root);
        return;
    }

    document.title = `${project.title} — Darshan Daiv`;

    /* Handles 3 frame types: "image", "video", "split". */
    const framesHTML = project.frames
        .map((frame) => {
            if (frame.type === "video") {
                return `
                    <div class="case-frame reveal">
                        <video class="case-frame-media" data-scroll-zoom src="${frame.src}" autoplay loop muted playsinline></video>
                        ${frame.caption ? `<p class="case-frame-caption">${frame.caption}</p>` : ""}
                    </div>`;
            }

            if (frame.type === "split") {
                const splitItemsHTML = frame.images
                    .map(
                        (img) => `
                    <div class="case-frame-split-item">
                        <img data-scroll-zoom class="case-frame-media" src="${img.src}" alt="${img.caption || project.title}">
                        ${img.caption ? `<p class="case-frame-caption">${img.caption}</p>` : ""}
                    </div>
                `
                    )
                    .join("");

                return `
                    <div class="case-frame case-frame-split reveal">
                        ${splitItemsHTML}
                    </div>`;
            }

            // Default: "image"
            return `
                <div class="case-frame reveal">
                    <img data-scroll-zoom class="case-frame-media" src="${frame.src}" alt="${frame.caption || project.title}">
                    ${frame.caption ? `<p class="case-frame-caption">${frame.caption}</p>` : ""}
                </div>`;
        })
        .join("");

    root.innerHTML = `
        <section class="case-hero">
            <div class="container-text">
                <div class="case-hero-top reveal">
                    <div>
                        <p class="text-eyebrow" data-crop-reveal>${project.projectType} · ${project.year}</p>
                        <h1 class="case-title" data-crop-reveal>${project.title}</h1>
                    </div>
                    <a href="${project.behanceUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-solid mag-target" data-crop-reveal>View on Behance ↗</a>
                </div>

                <div class="case-meta-row reveal delay-1" style="padding-top: 40px; padding-bottom: 20px;">
                    <div class="case-meta-item">
                        <p class="text-eyebrow" data-crop-reveal>Client</p>
                        <p class="ci-value" data-crop-reveal>${project.client}</p>
                    </div>
                    <div class="case-meta-item">
                        <p class="text-eyebrow" data-crop-reveal>Type</p>
                        <p class="ci-value" data-crop-reveal>${project.projectType}</p>
                    </div>
                    <div class="case-meta-item">
                        <p class="text-eyebrow" data-crop-reveal>Category</p>
                        <p class="ci-value" data-crop-reveal>${project.tags[0]}</p>
                    </div>
                    <div class="case-meta-item">
                        <p class="text-eyebrow" data-crop-reveal>Year</p>
                        <p class="ci-value" data-crop-reveal>${project.year}</p>
                    </div>
                </div>
            </div>

            <div class="case-hero-image reveal delay-2">
                <img src="${project.thumb}" alt="${project.title} hero image" data-scroll-zoom>
            </div>
        </section>

        <section class="case-body">
            <div class="container-text">
                <p class="text-subtitle scroll-reveal-text" style="max-width:100%; font-weight: 400;">${project.description}</p>
            </div>
        </section>

        <section class="case-frames">
            <div class="container">
                ${framesHTML}
                ${project.base ? `
                <div class="case-frame reveal">
                    <video
                        class="case-frame-media"
                        src="${project.base}"
                        muted
                        loop
                        autoplay
                        playsinline
                        preload="none"
                    ></video>
                </div>
                ` : ""}
            </div>
        </section>

        ${project.summary ? `
        <section class="case-summary">
            <div class="container-text">
                <p class="text-eyebrow" data-crop-reveal>Summary</p>
                <p class="text-subtitle scroll-reveal-text" style="max-width:100%; font-weight: 400;">${project.summary}</p>
            </div>
        </section>
        ` : ""}

        <section class="case-next">
            <div class="container reveal" style="text-align:center;padding:60px 0">
                <a href="../projects/" class="btn btn-ghost mag-target">← Back to All Projects</a>
            </div>
        </section>
    `;

    window.initInteractions(root);
}