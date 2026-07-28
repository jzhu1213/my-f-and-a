/**
 * WCAG 2.1 AA Color Contrast Verification Script
 *
 * Calculates contrast ratios for all theme color combinations using the
 * official WCAG relative luminance formula. Updated to reflect the current
 * warm-purple default theme and dark theme values from globals.css, plus
 * GlassCard effective-surface checks (rgba(255,255,255,0.03) blended over
 * each background surface).
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert hex (#rrggbb) to linear RGB channels. */
function hexToLinearRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const linearize = (c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return { r: linearize(r), g: linearize(g), b: linearize(b) };
}

/** Parse hex to 0-255 sRGB channels. */
function hexToRGB(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** Blend rgba overlay (0-255 + alpha 0-1) over an opaque hex background, return hex. */
function blendOver(bgHex, overlayR, overlayG, overlayB, overlayA) {
  const bg = hexToRGB(bgHex);
  const r = Math.round(overlayR * overlayA + bg.r * (1 - overlayA));
  const g = Math.round(overlayG * overlayA + bg.g * (1 - overlayA));
  const b = Math.round(overlayB * overlayA + bg.b * (1 - overlayA));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Calculate relative luminance per WCAG 2.1. */
function relativeLuminance(hex) {
  const { r, g, b } = hexToLinearRGB(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Calculate contrast ratio between two hex colors. */
function contrastRatio(color1, color2) {
  const L1 = relativeLuminance(color1);
  const L2 = relativeLuminance(color2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── WCAG AA Thresholds ─────────────────────────────────────────────────────

const NORMAL_TEXT_MIN = 4.5;
const LARGE_TEXT_MIN = 3.0;
const UI_COMPONENT_MIN = 3.0;

// ── Theme Definitions (current values from globals.css) ────────────────────

// Default warm-purple theme
const defaultBgs = {
  '--bg (#12121f)': '#12121f',
  '--surface (#1a1a2e)': '#1a1a2e',
  '--raised (#22223a)': '#22223a',
};

const defaultTextColors = {
  '--text (#ffffff)': '#ffffff',
  '--sub (#b4b4d4)': '#b4b4d4',
  '--muted (#9494b8)': '#9494b8',
};

// Dark theme
const darkBgs = {
  '--bg (#000000)': '#000000',
  '--surface (#0d0d0d)': '#0d0d0d',
  '--raised (#161616)': '#161616',
};

const darkTextColors = {
  '--text (#ffffff)': '#ffffff',
  '--sub (#888888)': '#888888',
  '--muted (#868686)': '#868686',
};

// Semantic/accent colors (shared across both themes)
const semanticColors = {
  '--success (#4ade80)': '#4ade80',
  '--warning (#fbbf24)': '#fbbf24',
  '--error (#f87171)': '#f87171',
  '--blue (#60a5fa)': '#60a5fa',
  '--accent (#818cf8)': '#818cf8',
};

// ── GlassCard effective surface (rgba(255,255,255,0.03) over each bg) ──────

function glassCardSurfaces(bgs) {
  const result = {};
  for (const [name, hex] of Object.entries(bgs)) {
    const blended = blendOver(hex, 255, 255, 255, 0.03);
    const shortName = name.replace(/--(\w+)\s.*/, '$1');
    result[`glass on ${shortName} (${blended})`] = blended;
  }
  return result;
}

// ── Run Checks ─────────────────────────────────────────────────────────────

let allPass = true;

function checkSection(title, textColors, bgColors, threshold, thresholdLabel) {
  console.log(`${thresholdLabel} (need ${threshold}:1):`);
  console.log('─'.repeat(65));
  for (const [textName, textHex] of Object.entries(textColors)) {
    for (const [bgName, bgHex] of Object.entries(bgColors)) {
      const ratio = contrastRatio(textHex, bgHex);
      const pass = ratio >= threshold;
      if (!pass) allPass = false;
      const icon = pass ? '✓' : '✗';
      console.log(`  ${icon} ${textName} on ${bgName}: ${ratio.toFixed(2)}:1 ${pass ? '' : '⚠️ FAIL'}`);
    }
    console.log('');
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(' WCAG 2.1 AA Color Contrast Verification');
console.log(' (Updated for current warm-purple + dark themes)');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── Default (Warm Purple) Theme ──
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ DEFAULT THEME (Warm Purple)                                 │');
console.log('└─────────────────────────────────────────────────────────────┘\n');

checkSection(
  'Default text on backgrounds',
  defaultTextColors,
  defaultBgs,
  NORMAL_TEXT_MIN,
  'Text colors on backgrounds'
);

checkSection(
  'Default semantic on backgrounds',
  semanticColors,
  defaultBgs,
  UI_COMPONENT_MIN,
  'Semantic/accent colors on backgrounds (UI components / large text)'
);

// GlassCard surfaces for default theme
const defaultGlassBgs = glassCardSurfaces(defaultBgs);
console.log('┌─ GlassCard effective surfaces (rgba(255,255,255,0.03) over bg) ─┐\n');
checkSection(
  'Text on GlassCard (default)',
  defaultTextColors,
  defaultGlassBgs,
  NORMAL_TEXT_MIN,
  'Text colors on GlassCard surfaces'
);

checkSection(
  'Semantic on GlassCard (default)',
  semanticColors,
  defaultGlassBgs,
  UI_COMPONENT_MIN,
  'Semantic/accent colors on GlassCard surfaces'
);

// Button text on accent
console.log('Button text (#000) on accent (#818cf8):');
console.log('─'.repeat(40));
const btnRatio = contrastRatio('#000000', '#818cf8');
const btnPass = btnRatio >= NORMAL_TEXT_MIN;
if (!btnPass) allPass = false;
console.log(`  ${btnPass ? '✓' : '✗'} #000 on #818cf8: ${btnRatio.toFixed(2)}:1 ${btnPass ? '' : '⚠️ FAIL'}\n`);

// ── Dark Theme ──
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ DARK THEME                                                  │');
console.log('└─────────────────────────────────────────────────────────────┘\n');

checkSection(
  'Dark text on backgrounds',
  darkTextColors,
  darkBgs,
  NORMAL_TEXT_MIN,
  'Text colors on backgrounds'
);

checkSection(
  'Dark semantic on backgrounds',
  semanticColors,
  darkBgs,
  UI_COMPONENT_MIN,
  'Semantic/accent colors on backgrounds (UI components / large text)'
);

// GlassCard surfaces for dark theme
const darkGlassBgs = glassCardSurfaces(darkBgs);
console.log('┌─ GlassCard effective surfaces (rgba(255,255,255,0.03) over bg) ─┐\n');
checkSection(
  'Text on GlassCard (dark)',
  darkTextColors,
  darkGlassBgs,
  NORMAL_TEXT_MIN,
  'Text colors on GlassCard surfaces'
);

checkSection(
  'Semantic on GlassCard (dark)',
  semanticColors,
  darkGlassBgs,
  UI_COMPONENT_MIN,
  'Semantic/accent colors on GlassCard surfaces'
);

// ── Summary ──
console.log('═══════════════════════════════════════════════════════════════');
if (allPass) {
  console.log(' ✅ ALL CHECKS PASS — WCAG 2.1 AA compliant');
} else {
  console.log(' ❌ SOME CHECKS FAILED — fixes needed');
}
console.log('═══════════════════════════════════════════════════════════════');

// ── Documentation ranges ──
console.log('\n── Documentation Ranges ──\n');

function getRangeStr(textHex, bgs) {
  const ratios = Object.values(bgs).map((bg) => contrastRatio(textHex, bg));
  return `${Math.min(...ratios).toFixed(1)}–${Math.max(...ratios).toFixed(1)}:1`;
}

console.log('Default theme (warm purple):');
console.log(`  --text (#fff) on --bg/--surface/--raised: ${getRangeStr('#ffffff', defaultBgs)}`);
console.log(`  --sub (#b4b4d4) on --bg/--surface/--raised: ${getRangeStr('#b4b4d4', defaultBgs)}`);
console.log(`  --muted (#9494b8) on --bg/--surface/--raised: ${getRangeStr('#9494b8', defaultBgs)}`);
console.log(`  --text (#fff) on GlassCard surfaces: ${getRangeStr('#ffffff', defaultGlassBgs)}`);

console.log('\nDark theme:');
console.log(`  --text (#fff) on --bg/--surface/--raised: ${getRangeStr('#ffffff', darkBgs)}`);
console.log(`  --sub (#888) on --bg/--surface/--raised: ${getRangeStr('#888888', darkBgs)}`);
console.log(`  --muted (#868686) on --bg/--surface/--raised: ${getRangeStr('#868686', darkBgs)}`);
console.log(`  --text (#fff) on GlassCard surfaces: ${getRangeStr('#ffffff', darkGlassBgs)}`);

process.exit(allPass ? 0 : 1);
