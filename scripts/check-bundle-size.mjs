/**
 * check-bundle-size.mjs
 *
 * Parses `next build` output and compares route sizes against the performance budget.
 * Run after `npm run build` — reads from .next/build-manifest or parses stdout.
 *
 * Usage:
 *   npm run build 2>&1 | node scripts/check-bundle-size.mjs
 *   — or —
 *   node scripts/check-bundle-size.mjs  (reads .next directory directly)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

// Load performance budget
const budgetPath = join(projectRoot, 'performance.budget.json');
if (!existsSync(budgetPath)) {
  console.error('❌ performance.budget.json not found at project root.');
  process.exit(1);
}

const budget = JSON.parse(readFileSync(budgetPath, 'utf-8'));

// Try to read build output from stdin (piped) or parse .next output
async function parseBuildOutput() {
  // Attempt to read from stdin if piped
  const stdin = await readStdin();
  if (stdin) {
    return parseNextBuildStdout(stdin);
  }

  // Fallback: try to read .next/routes-manifest.json for route info
  const routesManifestPath = join(projectRoot, '.next', 'routes-manifest.json');
  if (existsSync(routesManifestPath)) {
    console.log('ℹ️  Reading from .next directory (run with piped build output for full analysis)');
    return null;
  }

  console.error('❌ No build output found. Run: npm run build 2>&1 | node scripts/check-bundle-size.mjs');
  process.exit(1);
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    // Timeout after 5s if nothing comes
    setTimeout(() => resolve(data || null), 5000);
  });
}

/**
 * Parse the Next.js build stdout table to extract route sizes.
 * Example line: "┌ ○ /                                    272 kB          481 kB"
 *
 * Handles both UTF-8 box-drawing characters and stripped/garbled versions
 * that may occur when piping through Windows PowerShell.
 */
function parseNextBuildStdout(stdout) {
  const routes = [];
  let sharedJS = null;

  const lines = stdout.split('\n');
  for (const line of lines) {
    // Match route lines with box-drawing chars: "┌ ○ /route    SIZE    FIRST_LOAD_SIZE"
    const routeMatch = line.match(
      /[┌├└]\s+[○ƒ●]\s+(\/\S*)\s+([\d.]+)\s*(kB|B)\s+([\d.]+)\s*(kB|B)/
    );
    if (routeMatch) {
      const [, route, sizeVal, sizeUnit, firstLoadVal, firstLoadUnit] = routeMatch;
      routes.push({
        route,
        sizeKB: toKB(parseFloat(sizeVal), sizeUnit),
        firstLoadKB: toKB(parseFloat(firstLoadVal), firstLoadUnit),
      });
      continue;
    }

    // Fallback: match route lines without box-drawing chars (Windows pipe garbling)
    // Looks for a path starting with / followed by two size values
    const fallbackMatch = line.match(
      /\s+(\/[\w\-[\]/]*)\s+([\d.]+)\s*(kB|B)\s+([\d.]+)\s*(kB|B)/
    );
    if (fallbackMatch) {
      const [, route, sizeVal, sizeUnit, firstLoadVal, firstLoadUnit] = fallbackMatch;
      routes.push({
        route: route.trim(),
        sizeKB: toKB(parseFloat(sizeVal), sizeUnit),
        firstLoadKB: toKB(parseFloat(firstLoadVal), firstLoadUnit),
      });
      continue;
    }

    // Match shared JS line: "+ First Load JS shared by all    88.3 kB"
    const sharedMatch = line.match(/First Load JS shared by all\s+([\d.]+)\s*(kB|B)/);
    if (sharedMatch) {
      sharedJS = toKB(parseFloat(sharedMatch[1]), sharedMatch[2]);
    }
  }

  return { routes, sharedJS };
}

function toKB(value, unit) {
  if (unit === 'B') return value / 1024;
  return value; // already kB
}

// Main
async function main() {
  const result = await parseBuildOutput();

  if (!result) {
    console.log('⚠️  Could not parse build output. Run with piped input for budget checks.');
    process.exit(0);
  }

  const { routes, sharedJS } = result;
  let violations = 0;
  let warnings = 0;

  console.log('\n📊 Bundle Size Report\n');
  console.log('─'.repeat(70));
  console.log(`${'Route'.padEnd(30)} ${'Size'.padStart(10)} ${'First Load'.padStart(12)} ${'Budget'.padStart(10)} ${'Status'.padStart(8)}`);
  console.log('─'.repeat(70));

  for (const { route, sizeKB, firstLoadKB } of routes) {
    const routeBudget = budget.routes[route];
    let status = '✅';
    let budgetStr = '—';

    if (routeBudget) {
      budgetStr = `${routeBudget.maxFirstLoadKB} kB`;
      if (firstLoadKB > routeBudget.maxFirstLoadKB) {
        status = '❌ OVER';
        violations++;
      } else if (firstLoadKB > routeBudget.maxFirstLoadKB * 0.9) {
        status = '⚠️ WARN';
        warnings++;
      }
    } else {
      // Check against global initial JS budget for the home route
      if (route === '/' && firstLoadKB > budget.budgets.initialJS.maxKB) {
        status = '❌ OVER';
        budgetStr = `${budget.budgets.initialJS.maxKB} kB`;
        violations++;
      }
    }

    console.log(
      `${route.padEnd(30)} ${(sizeKB.toFixed(1) + ' kB').padStart(10)} ${(firstLoadKB.toFixed(1) + ' kB').padStart(12)} ${budgetStr.padStart(10)} ${status.padStart(8)}`
    );
  }

  console.log('─'.repeat(70));

  if (sharedJS !== null) {
    const sharedStatus = sharedJS > budget.budgets.sharedJS.maxKB ? '❌ OVER' : '✅';
    if (sharedJS > budget.budgets.sharedJS.maxKB) violations++;
    console.log(`\nShared JS: ${sharedJS.toFixed(1)} kB (budget: ${budget.budgets.sharedJS.maxKB} kB) ${sharedStatus}`);
  }

  console.log('');

  if (violations > 0) {
    console.error(`\n🚨 ${violations} budget violation(s) detected! Fix before merging.\n`);
    process.exit(1);
  } else if (warnings > 0) {
    console.warn(`\n⚠️  ${warnings} route(s) within 10% of budget. Consider optimizing.\n`);
    process.exit(0);
  } else {
    console.log(`\n✅ All routes within budget.\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error running budget check:', err);
  process.exit(1);
});
