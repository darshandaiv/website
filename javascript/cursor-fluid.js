// ─────────────────────────────────────────────────────
// INDEPENDENT NATIVE LIQUID CURSOR TRAIL OVERLAY
// ─────────────────────────────────────────────────────
(function () {
  // 1. Create full-screen overlay canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'fluid-cursor-canvas';
  document.body.appendChild(canvas);

  // CSS Styling
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '9999', // Place over entire website
    mixBlendMode: 'screen',
    opacity: '0.7'
  });

  const ctx = canvas.getContext('2d');
  let points = [];
  const maxPoints = 25;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // Track mouse coordinates
  window.addEventListener('mousemove', (e) => {
    points.push({
      x: e.clientX,
      y: e.clientY,
      size: 40 + Math.random() * 20,
      alpha: 1.0,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2
    });

    if (points.length > maxPoints) {
      points.shift();
    }
  });

  // Render fluid trail loop
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha *= 0.94; // Fade out gradually
      p.size *= 0.96;  // Shrink gradually

      if (p.alpha > 0.01) {
        // Draw fluid radial gradient blob
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `rgba(138, 43, 226, ${p.alpha})`);  // Fluid Violet
        gradient.addColorStop(0.5, `rgba(0, 191, 255, ${p.alpha * 0.5})`); // Cyan Wave
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Filter out dead particles
    points = points.filter(p => p.alpha > 0.01);

    requestAnimationFrame(animate);
  }

  animate();
})();