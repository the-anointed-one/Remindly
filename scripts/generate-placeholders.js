/**
 * generate-placeholders.js
 *
 * Generates visually distinct placeholder images for all UI slots.
 * Uses sharp (already installed as a Next.js dependency).
 *
 * Run: node scripts/generate-placeholders.js
 *
 * Each placeholder has:
 *   - A unique gradient background colour
 *   - A centred label showing the filename and dimensions
 *   - A subtle grid overlay for depth
 *
 * Replace any file in /frontend/public/placeholders/ with a real image
 * of the same filename and it will be picked up immediately.
 */

const sharp = require('/Users/cjid/Documents/Attendlyx/frontend/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '../frontend/public/placeholders');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Placeholder definitions ────────────────

const placeholders = [
  // Hero carousel slides  (1920 × 1080 — full-width cinematic)
  {
    file: 'hero-slide-1.jpg',
    w: 1920, h: 1080,
    bg: '#0a1628',
    grad1: '#1e3a5f',
    grad2: '#0a1628',
    accent: '#3b82f6',
    label: 'Hero Slide 1',
    sub: 'Replace with your hero background · 1920×1080',
  },
  {
    file: 'hero-slide-2.jpg',
    w: 1920, h: 1080,
    bg: '#130d26',
    grad1: '#2d1b69',
    grad2: '#130d26',
    accent: '#8b5cf6',
    label: 'Hero Slide 2',
    sub: 'Replace with your hero background · 1920×1080',
  },
  {
    file: 'hero-slide-3.jpg',
    w: 1920, h: 1080,
    bg: '#051a1a',
    grad1: '#0d3d3d',
    grad2: '#051a1a',
    accent: '#06b6d4',
    label: 'Hero Slide 3',
    sub: 'Replace with your hero background · 1920×1080',
  },
  {
    file: 'hero-slide-4.jpg',
    w: 1920, h: 1080,
    bg: '#0f1a0a',
    grad1: '#1a3a10',
    grad2: '#0f1a0a',
    accent: '#22c55e',
    label: 'Hero Slide 4',
    sub: 'Replace with your hero background · 1920×1080',
  },

  // Industry card images  (800 × 520 — 4:3-ish card)
  {
    file: 'industry-dentist.jpg',
    w: 800, h: 520,
    bg: '#0d1f3c',
    grad1: '#1a3a6b',
    grad2: '#0d1f3c',
    accent: '#60a5fa',
    label: 'Dental Practice',
    sub: 'industry-dentist.jpg · 800×520',
  },
  {
    file: 'industry-salon.jpg',
    w: 800, h: 520,
    bg: '#2a0a1f',
    grad1: '#5a1a3a',
    grad2: '#2a0a1f',
    accent: '#f472b6',
    label: 'Hair &amp; Beauty Salon',
    sub: 'industry-salon.jpg · 800×520',
  },
  {
    file: 'industry-coach.jpg',
    w: 800, h: 520,
    bg: '#1a0e00',
    grad1: '#4a2a00',
    grad2: '#1a0e00',
    accent: '#f59e0b',
    label: 'Life &amp; Business Coach',
    sub: 'industry-coach.jpg · 800×520',
  },
  {
    file: 'industry-webinar.jpg',
    w: 800, h: 520,
    bg: '#0d0a2e',
    grad1: '#1e1460',
    grad2: '#0d0a2e',
    accent: '#818cf8',
    label: 'Webinars &amp; Online Events',
    sub: 'industry-webinar.jpg · 800×520',
  },
  {
    file: 'industry-event.jpg',
    w: 800, h: 520,
    bg: '#1f0a0a',
    grad1: '#4a1010',
    grad2: '#1f0a0a',
    accent: '#f87171',
    label: 'In-Person Events',
    sub: 'industry-event.jpg · 800×520',
  },

  // Industry landing page hero  (1440 × 480 — wide banner)
  {
    file: 'industry-hero.jpg',
    w: 1440, h: 480,
    bg: '#060d1f',
    grad1: '#0f1e40',
    grad2: '#060d1f',
    accent: '#3b82f6',
    label: 'Industry Hero Banner',
    sub: 'industry-hero.jpg · 1440×480 — Replace with industry-specific photography',
  },

  // Workflow illustration  (1440 × 360 — wide strip)
  {
    file: 'industry-workflow.jpg',
    w: 1440, h: 360,
    bg: '#080f1c',
    grad1: '#111f3a',
    grad2: '#080f1c',
    accent: '#06b6d4',
    label: 'Workflow Dashboard Preview',
    sub: 'industry-workflow.jpg · 1440×360 — Replace with a real dashboard screenshot',
  },
];

// ── SVG builder ────────────────────────────

function buildSvg({ w, h, bg, grad1, grad2, accent, label, sub }) {
  const cx = w / 2;
  const cy = h / 2;

  // Grid line spacing — proportional to image size
  const gridSpacing = Math.round(Math.min(w, h) / 12);
  const gridLines = [];
  for (let x = 0; x <= w; x += gridSpacing) {
    gridLines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" />`);
  }
  for (let y = 0; y <= h; y += gridSpacing) {
    gridLines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" />`);
  }

  const fontSize = Math.round(Math.min(w, h) * 0.045);
  const subFontSize = Math.round(fontSize * 0.55);
  const iconSize = Math.round(fontSize * 1.6);
  const labelY = cy + iconSize * 0.6;
  const subY = labelY + fontSize * 1.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${grad1}" />
      <stop offset="100%" stop-color="${grad2}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.18" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${w}" height="${h}" fill="url(#bg)" />
  <rect width="${w}" height="${h}" fill="url(#glow)" />

  <!-- Grid overlay -->
  <g stroke="${accent}" stroke-opacity="0.07" stroke-width="1">
    ${gridLines.join('\n    ')}
  </g>

  <!-- Corner markers -->
  <rect x="20" y="20" width="24" height="2" fill="${accent}" opacity="0.5" />
  <rect x="20" y="20" width="2" height="24" fill="${accent}" opacity="0.5" />
  <rect x="${w - 44}" y="20" width="24" height="2" fill="${accent}" opacity="0.5" />
  <rect x="${w - 22}" y="20" width="2" height="24" fill="${accent}" opacity="0.5" />
  <rect x="20" y="${h - 22}" width="24" height="2" fill="${accent}" opacity="0.5" />
  <rect x="20" y="${h - 44}" width="2" height="24" fill="${accent}" opacity="0.5" />
  <rect x="${w - 44}" y="${h - 22}" width="24" height="2" fill="${accent}" opacity="0.5" />
  <rect x="${w - 22}" y="${h - 44}" width="2" height="24" fill="${accent}" opacity="0.5" />

  <!-- Accent circle behind icon -->
  <circle cx="${cx}" cy="${cy - iconSize * 0.8}" r="${iconSize * 1.2}"
    fill="${accent}" fill-opacity="0.06"
    stroke="${accent}" stroke-opacity="0.2" stroke-width="1" />

  <!-- Camera / image icon -->
  <text x="${cx}" y="${cy - iconSize * 0.4}"
    text-anchor="middle" dominant-baseline="middle"
    font-size="${iconSize}" fill="${accent}" opacity="0.7">🖼</text>

  <!-- Label -->
  <text x="${cx}" y="${labelY}"
    text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}" font-weight="700" fill="#ffffff" opacity="0.9">
    ${label}
  </text>

  <!-- Sub-label -->
  <text x="${cx}" y="${subY}"
    text-anchor="middle" dominant-baseline="middle"
    font-family="system-ui, -apple-system, monospace"
    font-size="${subFontSize}" fill="${accent}" opacity="0.6">
    ${sub}
  </text>

  <!-- Accent bottom bar -->
  <rect x="0" y="${h - 4}" width="${w}" height="4" fill="${accent}" opacity="0.4" />
</svg>`;
}

// ── Generate ───────────────────────────────

async function run() {
  let generated = 0;

  for (const p of placeholders) {
    const svg = buildSvg(p);
    const outPath = path.join(OUT_DIR, p.file);

    try {
      await sharp(Buffer.from(svg))
        .jpeg({ quality: 90, mozjpeg: true })
        .toFile(outPath);

      const stat = fs.statSync(outPath);
      console.log(`  ✓  ${p.file.padEnd(28)} ${p.w}×${p.h}  ${(stat.size / 1024).toFixed(1)} KB`);
      generated++;
    } catch (err) {
      console.error(`  ✗  ${p.file}: ${err.message}`);
    }
  }

  console.log(`\nDone — ${generated}/${placeholders.length} placeholder images written to:\n  ${OUT_DIR}\n`);
  console.log('To replace a placeholder, drop a real image with the same filename into');
  console.log('  frontend/public/placeholders/');
  console.log('and it will be used immediately.\n');
}

run().catch(console.error);
