/**
 * WCAG 2.1 AA Color Contrast Verification Script
 * 
 * Calculates contrast ratios for all theme color combinations
 * using the official WCAG relative luminance formula.
 */

// Convert hex to linear RGB
function hexToLinearRGB(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  // Linearize sRGB values
  const linearize = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  return {
    r: linearize(r),
    g: linearize(g),
    b: linearize(b)
  };
}

// Calculate relative luminance
function relativeLuminance(hex) {
  const { r, g, b } = hexToLinearRGB(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio
function contrastRatio(color1, color2) {
  const L1 = relativeLuminance(color1);
  const L2 = relativeLuminance(color2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG AA thresholds
const NORMAL_TEXT_MIN = 4.5;
const LARGE_TEXT_MIN = 3.0;
const UI_COMPONENT_MIN = 3.0;

console.log('═══════════════════════════════════════════════════════════════');
console.log(' WCAG 2.1 AA Color Contrast Verification');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── Default Theme (Cool Futuristic) ──
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ DEFAULT THEME (Cool Futuristic)                             │');
console.log('└─────────────────────────────────────────────────────────────┘\n');

const defaultBgs = {
  '--bg (#0a0f1a)': '#0a0f1a',
  '--surface (#111827)': '#111827',
  '--raised (#1a2332)': '#1a2332',
};

const defaultTextColors = {
  '--text (#ffffff)': '#ffffff',
  '--sub (#94a3b8)': '#94a3b8',
  '--muted (#728da2)': '#728da2',
};

const semanticColors = {
  '--success (#06d6a0)': '#06d6a0',
  '--warning (#f59e0b)': '#f59e0b',
  '--error (#ef4444)': '#ef4444',
  '--accent (#4cc9f0)': '#4cc9f0',
};

let allPass = true;

console.log('Text colors on backgrounds (need 4.5:1 for normal text):');
console.log('─────────────────────────────────────────────────────────');
for (const [textName, textHex] of Object.entries(defaultTextColors)) {
  for (const [bgName, bgHex] of Object.entries(defaultBgs)) {
    const ratio = contrastRatio(textHex, bgHex);
    const pass = ratio >= NORMAL_TEXT_MIN;
    if (!pass) allPass = false;
    const icon = pass ? '✓' : '✗';
    console.log(`  ${icon} ${textName} on ${bgName}: ${ratio.toFixed(2)}:1 ${pass ? '' : '⚠️ FAIL'}`);
  }
  console.log('');
}

console.log('Semantic/accent colors on backgrounds (need 3:1 for UI components):');
console.log('───────────────────────────────────────────────────────────────────');
for (const [colorName, colorHex] of Object.entries(semanticColors)) {
  for (const [bgName, bgHex] of Object.entries(defaultBgs)) {
    const ratio = contrastRatio(colorHex, bgHex);
    const pass = ratio >= UI_COMPONENT_MIN;
    if (!pass) allPass = false;
    const icon = pass ? '✓' : '✗';
    console.log(`  ${icon} ${colorName} on ${bgName}: ${ratio.toFixed(2)}:1 ${pass ? '' : '⚠️ FAIL (UI component)'}`);
  }
  console.log('');
}

console.log('Button text (#000) on accent (#4cc9f0):');
console.log('────────────────────────────────────────');
const btnRatio = contrastRatio('#000000', '#4cc9f0');
const btnPass = btnRatio >= NORMAL_TEXT_MIN;
if (!btnPass) allPass = false;
console.log(`  ${btnPass ? '✓' : '✗'} #000 on #4cc9f0: ${btnRatio.toFixed(2)}:1 ${btnPass ? '' : '⚠️ FAIL'}\n`);

// ── Dark Theme ──
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│ DARK THEME                                                  │');
console.log('└─────────────────────────────────────────────────────────────┘\n');

const darkBgs = {
  '--bg (#000000)': '#000000',
  '--surface (#0d0d0d)': '#0d0d0d',
  '--raised (#161616)': '#161616',
};

const darkTextColors = {
  '--text (#ffffff)': '#ffffff',
  '--sub (#888888)': '#888888',
  '--muted (#808080)': '#808080',
};

console.log('Text colors on backgrounds (need 4.5:1 for normal text):');
console.log('─────────────────────────────────────────────────────────');
for (const [textName, textHex] of Object.entries(darkTextColors)) {
  for (const [bgName, bgHex] of Object.entries(darkBgs)) {
    const ratio = contrastRatio(textHex, bgHex);
    const pass = ratio >= NORMAL_TEXT_MIN;
    if (!pass) allPass = false;
    const icon = pass ? '✓' : '✗';
    console.log(`  ${icon} ${textName} on ${bgName}: ${ratio.toFixed(2)}:1 ${pass ? '' : '⚠️ FAIL'}`);
  }
  console.log('');
}

console.log('Semantic/accent colors on backgrounds (need 3:1 for UI components):');
console.log('───────────────────────────────────────────────────────────────────');
for (const [colorName, colorHex] of Object.entries(semanticColors)) {
  for (const [bgName, bgHex] of Object.entries(darkBgs)) {
    const ratio = contrastRatio(colorHex, bgHex);
    const pass = ratio >= UI_COMPONENT_MIN;
    if (!pass) allPass = false;
    const icon = pass ? '✓' : '✗';
    console.log(`  ${icon} ${colorName} on ${bgName}: ${ratio.toFixed(2)}:1 ${pass ? '' : '⚠️ FAIL (UI component)'}`);
  }
  console.log('');
}

// ── Summary ──
console.log('═══════════════════════════════════════════════════════════════');
if (allPass) {
  console.log(' ✅ ALL CHECKS PASS — WCAG 2.1 AA compliant');
} else {
  console.log(' ❌ SOME CHECKS FAILED — fixes needed');
}
console.log('═══════════════════════════════════════════════════════════════');

// Print summary ranges for documentation
console.log('\n── Documentation Ranges ──\n');

function getRangeStr(textHex, bgs) {
  const ratios = Object.values(bgs).map(bg => contrastRatio(textHex, bg));
  return `${Math.min(...ratios).toFixed(1)}–${Math.max(...ratios).toFixed(1)}:1`;
}

console.log('Default theme:');
console.log(`  --text (#fff) on --bg/--surface/--raised: ${getRangeStr('#ffffff', defaultBgs)}`);
console.log(`  --sub (#94a3b8) on --bg/--surface/--raised: ${getRangeStr('#94a3b8', defaultBgs)}`);
console.log(`  --muted (#728da2) on --bg/--surface/--raised: ${getRangeStr('#728da2', defaultBgs)}`);

const semRatiosDefault = [];
for (const colorHex of Object.values(semanticColors)) {
  for (const bgHex of Object.values(defaultBgs)) {
    semRatiosDefault.push(contrastRatio(colorHex, bgHex));
  }
}
console.log(`  Semantic colors on --bg/--surface: ${Math.min(...semRatiosDefault).toFixed(1)}–${Math.max(...semRatiosDefault).toFixed(1)}:1`);
console.log(`  Button text (#000) on --accent (#4cc9f0): ${btnRatio.toFixed(1)}:1`);

console.log('\nDark theme:');
console.log(`  --text (#fff) on --bg/--surface/--raised: ${getRangeStr('#ffffff', darkBgs)}`);
console.log(`  --sub (#888888) on --bg/--surface/--raised: ${getRangeStr('#888888', darkBgs)}`);
console.log(`  --muted (#808080) on --bg/--surface/--raised: ${getRangeStr('#808080', darkBgs)}`);

const semRatiosDark = [];
for (const colorHex of Object.values(semanticColors)) {
  for (const bgHex of Object.values(darkBgs)) {
    semRatiosDark.push(contrastRatio(colorHex, bgHex));
  }
}
console.log(`  Semantic colors on --bg: ${Math.min(...semRatiosDark).toFixed(1)}–${Math.max(...semRatiosDark).toFixed(1)}:1`);
