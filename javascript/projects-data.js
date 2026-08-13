/* ================================================================
   PROJECTS CMS DATA
   — Single source of truth for:
       • Homepage Work section     → index.html
       • All projects grid         → projects/index.html
       • Case Study pages          → projects/<slug>.html

   FIX (doc accuracy): original comment claimed this file "lives at
   SITE ROOT" — inaccurate. Every path below (thumb, base, frames)
   uses a "../" prefix, and this file is loaded identically via
   <script src="../javascript/projects-data.js"> on EVERY page
   across the site (root pages AND projects/ pages alike). The "../"
   prefix is consistent site-wide because every page — including
   root-level ones — resolves assets/javascript one level up.

   REQUIRED VALUE TO KNOW: Because of the above, every path field
   below (thumb, base, frames[].src) should be used AS-IS wherever
   referenced — do NOT prepend an additional "../" when rendering
   these paths in cms-projects.js. (This was previously a real bug
   in renderCaseStudy() — see cms-projects.js notes for the fix.)

   ────────────────────────────────────────────────────────────────
   FIELD GUIDE — read this before adding/editing a project
   ────────────────────────────────────────────────────────────────
   id           : Internal stable key. NEVER change once set, even
                  if you rename the project later. Used only for
                  internal lookups — never shown in a URL.

   slug         : Editable, human-facing URL segment. Determines
                  the case study filename AND the link everywhere
                  on the site.
                  e.g. slug: "fluent-2024"
                    → file must be named: projects/fluent-2024.html
                    → link becomes:       /projects/fluent-2024
                  Rules: lowercase letters, numbers, and hyphens
                  only. No spaces, no uppercase, no symbols.

   title        : Full project name. Shown as the case study <h1>
                  and as the card title everywhere else.

   year         : Year of completion, plain text (e.g. "2024").

   behanceUrl   : Full URL to the Behance project. Powers the
                  "View on Behance ↗" button on the case study page.

   projectType  : One of "Academic", "Industry", or "Personal".
                  Shown in the case study meta row.

   client       : Client or organization name. Use "Self-Initiated"
                  if there's no external client.

   tags[]       : Array of category labels. tags[0] is treated as
                  the PRIMARY category — shown as plain text in the
                  case study meta row, and used for filter-pill
                  matching on projects/index.html.
                  ⚠️ PENDING CLEANUP: tag vocabulary isn't fully
                  standardized against the filter pills yet — see
                  auditTags() console output below for current state.

   thumb        : Card thumbnail image path AND case-study hero
                  image path (renderCaseStudy() reuses this same
                  field for both — there is no separate heroImage
                  field despite earlier drafts of this file
                  documenting one; removed that stale reference).
                  Use AS-IS, no extra "../" prefix needed.

   base         : Hover-preview video (work cards) AND the final
                  looping video shown at the end of a case study's
                  frame list. Optional — if omitted, work cards fall
                  back to showing just the static thumb.

   description  : 1–3 sentence project summary shown on the case
                  study page.

   frames[]     : Array of media blocks shown stacked on the case
                  study page, in listed order. Each frame needs:
                    type : "image", "video", or "split"
                    src  : path, used AS-IS (not used when type
                           is "split" — see below)

                  SPLIT FRAMES (2 images side by side):
                    {
                      type: "split",
                      images: [
                        { src: "../assets/images/left.jpg" },
                        { src: "../assets/images/right.jpg" }
                      ]
                    }
                  Stacks to full-width on mobile (<768px) via CSS.

   summary      : Optional closing paragraph shown after all frames.
                  Leave out entirely (or "") if not needed.

   featured     : true  → also appears on homepage Work section.
                  false → appears only on projects/index.html.
================================================================ */

const PROJECTS = [
  {
    id: "fluent-design",
    slug: "fluent-design",
    title: "Microsoft Fluent Design",
    year: "2025",
    behanceUrl: "https://www.behance.net/gallery/225140073/Microsoft-Fluent-Design-Voice-Typing-UX-Film",
    projectType: "Academic",
    client: "Microsoft",
    tags: ["Motion", "3D Graphics"],
    thumb: "../assets/images/fluent-design/01.avif",
    base: "../assets/videos/waves.mp4",
    description: "A 3D CGI motion design film exploring the user experience of Windows Voice Typing (Win + H) feature. This personal project conceptualizes hands-free input with a focus on Microsoft Fluent Design principles, showcasing seamless voice activation, dynamic transcription, and productivity.",
    frames: [
      { type: "image", src: "../assets/images/fluent-design/04.gif" },
      {
        type: "split",
        images: [
          { src: "../assets/images/fluent-design/05.avif" },
          { src: "../assets/images/fluent-design/08.webp" }
        ]
      },
      { type: "image", src: "../assets/images/fluent-design/06.webp" },
      { type: "image", src: "../assets/images/fluent-design/03.avif" },
      { type: "image", src: "../assets/images/fluent-design/02.gif" }
    ],
    summary: "Before diving into 3D, I first laid out the entire sequence through storyboards. I then synced these rough visuals with the chosen audio track to create a basic animatic. This crucial early step gave me a clear sense of the final pacing and flow, which proved invaluable in streamlining the animation process. This project truly pushed my animation skills, allowing me to craft unique and beautiful visuals with swift, seamless transitions. I perfectly matched the video's flow to the audio's beats. It was truly rewarding to successfully execute complex techniques and achieve results I hadn't attempted before.",
    featured: true
  },
  {
    id: "oroma",
    slug: "oroma",
    title: "Oroma™",
    year: "2024",
    behanceUrl: "https://www.behance.net/gallery/225868561/Oroma-Branding-Project",
    projectType: "Academic",
    client: "Oroma",
    tags: ["Branding", "Packaging"],
    thumb: "../assets/images/oroma/02.avif",
    base: "../assets/images/oroma/05.avif",
    description: "Oroma is a hypothetical smart aroma diffuser brand. The core idea is to create a brand identity that embodies serenity, bliss, peace, and calmness, centered around innovative aroma diffuser technology. The brand name, 'Oroma' (derived from 'Oro' meaning gold and 'Aroma'), suggests a premium & enriching sensory experience.",
    frames: [
      { type: "image", src: "../assets/images/oroma/01.avif" },
      {
        type: "split",
        images: [
          { src: "../assets/images/oroma/03.avif" },
          { src: "../assets/images/oroma/04.webp" }
        ]
      },
      { type: "image", src: "../assets/images/oroma/06.avif" },
      { type: "image", src: "../assets/images/oroma/07.webp" },
      {
        type: "split",
        images: [
          { src: "../assets/images/oroma/08.avif" },
          { src: "../assets/images/oroma/09.avif" }
        ]
      },
      { type: "image", src: "../assets/images/oroma/10.avif" }
    ],
    summary: "Ultimately, Oroma positions itself as a premium brand. Its sleek design and sophisticated palette evoke calm, while technological integration ensures user confidence. Oroma aims to enrich lives with elevated, thoughtfully crafted aroma experiences. The elegant visual identity, combined with a sophisticated color palette, successfully evokes a sense of calm and serenity. This aesthetic impact directly supports the brand's promise of well-being, creating an emotional connection with the user before they even experience the product itself.",
    featured: true
  },
  {
    id: "nimbus-08",
    slug: "nimbus-08",
    title: "The Nimbus 08",
    year: "2025",
    behanceUrl: "https://www.behance.net/gallery/220497317/Nimbus-08-Intergalactic-Cargo-ship",
    projectType: "Academic",
    client: "University Capstone",
    tags: ["3D Graphics", "Concept Art"],
    thumb: "../assets/images/nimbus-08/01.avif",
    base: "../assets/images/nimbus-08/02.gif",
    description: "The Nimbus 08 is a versatile cargo vessel designed for long-haul missions across the cosmos. Its sleek, aerodynamic design and powerful ion engines allow it to traverse vast distances with efficiency & speed. Detachable Voyager module, which can be separated from the main vessel for independent exploration and scientific missions collecting valuable data and samples. The Nimbus 08 is built for it's gigantic capacity to ship cargo over stellar distances. It has two huge cargo sectors in it's belly with an in-built hydraulic elevator to move cargo easily.",
    frames: [
      { type: "image", src: "../assets/images/nimbus-08/09.webp" },
      { type: "image", src: "../assets/images/nimbus-08/10.webp" },
      {
        type: "split",
        images: [
          { src: "../assets/images/nimbus-08/03.avif" },
          { src: "../assets/images/nimbus-08/04.avif" }
        ]
      },
      { type: "image", src: "../assets/images/nimbus-08/08.webp" },
      { type: "image", src: "../assets/images/nimbus-08/07.webp" },
      { type: "image", src: "../assets/images/nimbus-08/05.webp" }
    ],
    summary: "This project reinforced how much accessibility and performance constraints can actually sharpen creative decisions rather than limit them — the strongest visual solutions came directly from working within Microsoft's cross-platform technical requirements, not despite them.",
    featured: true
  },
  {
    id: "dantaushadhi",
    slug: "dantaushadhi",
    title: "Dantaushadhi",
    year: "2025",
    behanceUrl: "https://www.behance.net/gallery/223844687/Dantaushadhi-Package-Redesigning-Project",
    projectType: "Academic",
    client: "Self-Initiated",
    tags: ["Packaging", "Product Design"],
    thumb: "../assets/images/dantaushadhi/01.avif",
    base: "../assets/images/dantaushadhi/02.webp",
    description: "The current packaging suffers from a harsh, uninviting color scheme and outdated, inconsistent typography that lacks visual hierarchy. Poor image placement and cluttered layout disrupt readability and fail to highlight key product information. There's no clear brand identity, making it appear generic and forgettable. Additionally, the wide bottle opening leads to unhygienic and inconvenient product usage.",
    frames: [
      { type: "image", src: "../assets/images/dantaushadhi/05.avif" },
      {
        type: "split",
        images: [
          { src: "../assets/images/dantaushadhi/06.gif" },
          { src: "../assets/images/dantaushadhi/04.webp" }
        ]
      },
      { type: "image", src: "../assets/images/dantaushadhi/08.webp" },
      { type: "image", src: "../assets/images/dantaushadhi/09.webp" },
      { type: "image", src: "../assets/images/dantaushadhi/10.avif" }
    ],
    summary: "Through this redesign, I successfully transformed a generic, uninviting product into a visually trustworthy and sophisticated brand. The new packaging's blend of cultural authenticity and modern design not only creates a memorable presence but also builds immediate trust with the consumer. Furthermore, I provided a scalable design foundation that ensures future product lines will maintain a cohesive brand identity, while also solving the functional issues of the original packaging to enhance the overall user experience.",
    featured: false
  },
  {
    id: "void-one-ui",
    slug: "void-one-ui",
    title: "Void One UI",
    year: "2022",
    behanceUrl: "https://www.behance.net/gallery/223237727/Void-One-UI-Smart-Watch-Interface-Design",
    projectType: "Academic",
    client: "Self-Initiated",
    tags: ["Interaction", "Interface Design"],
    thumb: "../assets/images/void/06.avif",
    base: "../assets/images/void/01.gif",
    description: "Void One Ul is a conceptual Apple Watch interface inspired by the silence and sophistication of space. Designed for space exploration enthusiasts, it brings the feeling of cosmic navigation right to your wrist.",
    frames: [
      { type: "image", src: "../assets/images/void/04.webp" },
      { type: "image", src: "../assets/images/void/07.webp" },
      {
        type: "split",
        images: [
          { src: "../assets/images/void/02.webp" },
          { src: "../assets/images/void/03.webp" }
        ]
      },
      { type: "image", src: "../assets/images/void/08.webp" },
      { type: "image", src: "../assets/images/void/09.webp" },
      { type: "image", src: "../assets/images/void/05.webp" }
    ],
    summary: "This project demonstrates my ability to take a broad, conceptual idea and execute it with meticulous detail and a strong understanding of user experience. The resulting interface successfully evokes the intended feeling of cosmic navigation, proving my skill in creating immersive and emotionally resonant designs.",
    featured: true
  },
  {
    id: "origami-shores",
    slug: "origami-shores",
    title: "Origami Shores",
    year: "2022",
    behanceUrl: "https://www.behance.net/gallery/187892205/The-Origami-Shores-Childrens-Book",
    projectType: "Academic",
    client: "Self-Initiated",
    tags: ["Publication", "3D Graphics"],
    thumb: "../assets/images/origami/01.avif",
    base: "../assets/images/origami/02.webp",
    description: "The art style employed in this project combines the warmth and expressive qualities of traditional painting with the precision and dimensionality of 3D rendered Illustrations. I embarked on this project as a personal exploration into visual storytelling. My initial research was a poetic journey into the concept of contrasting dreams and a search for harmony in their simplicity.",
    frames: [
      { type: "image", src: "../assets/images/origami/06.webp" },
      { type: "image", src: "../assets/images/origami/07.webp" },
      {
        type: "split",
        images: [
          { src: "../assets/images/origami/04.webp" },
          { src: "../assets/images/origami/03.webp" }
        ]
      },
      { type: "image", src: "../assets/images/origami/08.webp" },
      { type: "image", src: "../assets/images/origami/09.webp" },
      { type: "image", src: "../assets/images/origami/05.webp" }
    ],
    summary: "This project demonstrates my ability to take a conceptual, narrative-driven idea and translate it into a fully realized 3D world. It showcases my skills in environment creation, asset modeling, and visual storytelling, proving my capacity to create emotionally resonant scenes. 'The Origami Shores' stands as a testament to my passion for personal exploration and my commitment to crafting thoughtful, narrative-rich work.",
    featured: false
  }

  /* ================================================================
     👇 HOW TO ADD A NEW PROJECT 👇
     1. Copy the entire block below (from { to the matching }),
        including a leading comma if this isn't the last item.
     2. Paste it above this comment, as a new array item.
     3. Fill in every field — delete the placeholder text.
     4. Set featured: true for the homepage Work section, or false
        to keep it only on projects/index.html.
     5. Create a matching file: projects/<your-slug>.html
        (copy an existing case-study file and change only its
        data-project-slug attribute on <body>).
     6. Save. Refresh index.html / projects/index.html — it appears
        automatically. Nothing else needs to be touched.

  {
    id: "your-unique-id",
    slug: "your-url-slug",
    title: "Project Title Here",
    year: "2025",
    behanceUrl: "https://www.behance.net/yourusername",
    projectType: "Personal",
    client: "Client Name or Self-Initiated",
    tags: ["Tag One", "Tag Two"],
    thumb: "../assets/images/your-thumbnail.jpg",
    base: "../assets/videos/your-preview.mp4",
    description: "One to three sentence summary of the project.",
    frames: [
      { type: "image", src: "../assets/images/frame-1.jpg" },
      { type: "video", src: "../assets/videos/frame-2.mp4" }
    ],
    featured: false
  },

  ================================================================ */
];

window.PROJECTS = PROJECTS;

/* ================================================================
   VALIDATION HELPERS
   Run automatically on load, print warnings to the browser console
   if something above looks broken. Don't stop the site from
   working — just help catch mistakes early. Kept intentionally,
   not dead code.
================================================================ */
(function validateProjects() {
    const seenSlugs = {};
    const validTypes = ["Academic", "Industry", "Personal"];
    const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

    PROJECTS.forEach(p => {
        if (!p.slug) {
            console.warn(`[CMS WARNING] Project "${p.title || p.id}" is missing a slug. Its case study link will be broken.`);
            return;
        }

        if (seenSlugs[p.slug]) {
            console.warn(`[CMS WARNING] Duplicate slug "${p.slug}" found on "${seenSlugs[p.slug]}" and "${p.title}". Their case study links will collide — rename one.`);
        }
        seenSlugs[p.slug] = p.title;

        if (!slugPattern.test(p.slug)) {
            console.warn(`[CMS WARNING] Slug "${p.slug}" on "${p.title}" contains invalid characters. Use only lowercase letters, numbers, and hyphens (e.g. "my-project-2024").`);
        }

        if (!validTypes.includes(p.projectType)) {
            console.warn(`[CMS WARNING] "${p.title}" has projectType "${p.projectType}" — expected one of: ${validTypes.join(", ")}.`);
        }

        if (typeof p.featured !== "boolean") {
            console.warn(`[CMS WARNING] "${p.title}" has featured: ${JSON.stringify(p.featured)} — should be true or false (no quotes).`);
        }

        if (!p.frames || p.frames.length === 0) {
            console.warn(`[CMS WARNING] "${p.title}" has no frames[] — its case study page will be missing project media.`);
        }
    });
})();

(function auditTags() {
    const tagMap = {};
    PROJECTS.forEach(p => {
        p.tags.forEach(tag => {
            if (!tagMap[tag]) tagMap[tag] = [];
            tagMap[tag].push(p.title);
        });
    });
    console.log("[CMS TAG AUDIT]", tagMap);
})();