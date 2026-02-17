#!/usr/bin/env node
/**
 * Tungsten Putty Cavity Designer for Slim Pinewood Derby Car
 * 
 * Computes optimal cavity placement & sizing to achieve:
 *   - Target total weight: 5.00 oz
 *   - Target COG: 5.0" from front (1.0" forward of rear axle)
 *
 * Uses numerical integration (Simpson's rule) for precision.
 */

// ─── Car specifications ──────────────────────────────────────────────
const CAR = {
  length: 7.0,
  width: 1.75,
  stockHeight: 1.25,

  noseHeight: 0.05,
  frontHeight: 0.25,
  rearHeight: 0.50,
  tailHeight: 0.55,
  scoopDepth: 0,

  frontAxle: 1.75,
  rearAxle: 6.0,

  rawWoodWeight: 3.42,
  wheelAxleWeight: 0.49,
};

const PUTTY_DENSITY = 11.0;
const STOCK_VOLUME = 7.0 * 1.75 * 1.25;
const WOOD_DENSITY = CAR.rawWoodWeight / STOCK_VOLUME;

const TARGET_WEIGHT = 5.0;
const TARGET_COG = 5.0;
const AXLE_MARGIN = 0.25;

const FORBIDDEN = [
  { start: CAR.frontAxle - AXLE_MARGIN, end: CAR.frontAxle + AXLE_MARGIN },
  { start: CAR.rearAxle - AXLE_MARGIN, end: CAR.rearAxle + AXLE_MARGIN },
];

// ─── Profile height function ─────────────────────────────────────────
function profileHeight(x) {
  if (x <= 0) return CAR.noseHeight;
  if (x >= CAR.length) return CAR.tailHeight;

  if (x <= CAR.frontAxle) {
    const t = x / CAR.frontAxle;
    return CAR.noseHeight + t * (CAR.frontHeight - CAR.noseHeight);
  }
  if (x <= CAR.rearAxle) {
    const t = (x - CAR.frontAxle) / (CAR.rearAxle - CAR.frontAxle);
    return CAR.frontHeight + t * (CAR.rearHeight - CAR.frontHeight);
  }
  const t = (x - CAR.rearAxle) / (CAR.length - CAR.rearAxle);
  return CAR.rearHeight + t * (CAR.tailHeight - CAR.rearHeight);
}

// ─── Numerical integration (Simpson's rule) ──────────────────────────
function integrate(fn, a, b, n = 1000) {
  if (a >= b) return 0;
  if (n % 2 !== 0) n++;
  const h = (b - a) / n;
  let sum = fn(a) + fn(b);
  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * fn(x);
  }
  return sum * h / 3;
}

// ─── Compute wood body properties ────────────────────────────────────
function computeWoodBody() {
  const volume = integrate(x => profileHeight(x) * CAR.width, 0, CAR.length);
  const weight = volume * WOOD_DENSITY;
  const moment = integrate(x => x * profileHeight(x) * CAR.width, 0, CAR.length);
  const cogX = moment / volume;
  return { volume, weight, cogX };
}

// ─── Verify the base car weight ──────────────────────────────────────
function verifyBaseWeight() {
  const profVol = integrate(x => profileHeight(x) * CAR.width, 0, CAR.length);
  const profWeight = profVol * WOOD_DENSITY;

  console.log("================================================================");
  console.log("              TUNGSTEN PUTTY CAVITY DESIGNER");
  console.log("              Slim Pinewood Derby Car");
  console.log("================================================================\n");

  console.log("BASE CAR VERIFICATION:");
  console.log("  Stock block volume:   " + STOCK_VOLUME.toFixed(4) + " in^3");
  console.log("  Stock block weight:   " + CAR.rawWoodWeight.toFixed(2) + " oz");
  console.log("  Wood density:         " + WOOD_DENSITY.toFixed(5) + " oz/in^3");
  console.log("  Profiled body volume: " + profVol.toFixed(4) + " in^3");
  console.log("  Profiled body weight: " + profWeight.toFixed(4) + " oz");
  console.log("  Wood removed by cuts: " + (CAR.rawWoodWeight - profWeight).toFixed(4) + " oz");

  return { profVol, profWeight };
}

// ─── Cavity analysis for a through-cut ───────────────────────────────
function analyzeThroughCut(xStart, xEnd, cavityWidth, label) {
  const w = cavityWidth || CAR.width;

  const cavVol = integrate(x => profileHeight(x) * w, xStart, xEnd);
  const cavMoment = integrate(x => x * profileHeight(x) * w, xStart, xEnd);
  const cavCogX = cavVol > 0 ? cavMoment / cavVol : 0;

  const woodRemoved = cavVol * WOOD_DENSITY;
  const puttyWeight = cavVol * PUTTY_DENSITY;
  const netChange = puttyWeight - woodRemoved;

  return { xStart, xEnd, cavityWidth: w, cavVol, cavCogX, woodRemoved, puttyWeight, netChange, label };
}

// ─── Cavity analysis for a bottom pocket ─────────────────────────────
function analyzeBottomPocket(xStart, xEnd, depth, cavityWidth, label) {
  const w = cavityWidth || CAR.width;

  const cavVol = integrate(x => {
    const maxDepth = profileHeight(x);
    const actualDepth = Math.min(depth, maxDepth);
    return actualDepth * w;
  }, xStart, xEnd);

  const cavMoment = integrate(x => {
    const maxDepth = profileHeight(x);
    const actualDepth = Math.min(depth, maxDepth);
    return x * actualDepth * w;
  }, xStart, xEnd);

  const cavCogX = cavVol > 0 ? cavMoment / cavVol : 0;
  const woodRemoved = cavVol * WOOD_DENSITY;
  const puttyWeight = cavVol * PUTTY_DENSITY;
  const netChange = puttyWeight - woodRemoved;

  return { xStart, xEnd, depth, cavityWidth: w, cavVol, cavCogX, woodRemoved, puttyWeight, netChange, label };
}

// ─── Full car weight & COG with cavity ───────────────────────────────
function computeCarWithCavity(baseProfWeight, cavities, puttyFillFraction) {
  if (puttyFillFraction === undefined) puttyFillFraction = 1.0;

  let totalWoodRemoved = 0;
  let totalPuttyWeight = 0;

  for (const c of cavities) {
    totalWoodRemoved += c.woodRemoved;
    totalPuttyWeight += c.cavVol * PUTTY_DENSITY * puttyFillFraction;
  }

  const woodWeight = baseProfWeight - totalWoodRemoved;
  const puttyWeight = totalPuttyWeight;
  const wheelWeight = CAR.wheelAxleWeight;
  const totalWeight = woodWeight + puttyWeight + wheelWeight;

  const baseWoodMoment = integrate(x => x * profileHeight(x) * CAR.width * WOOD_DENSITY, 0, CAR.length);

  let cavityWoodMoment = 0;
  for (const c of cavities) {
    cavityWoodMoment += integrate(x => x * profileHeight(x) * c.cavityWidth * WOOD_DENSITY, c.xStart, c.xEnd);
  }

  const remainingWoodMoment = baseWoodMoment - cavityWoodMoment;

  let puttyMoment = 0;
  for (const c of cavities) {
    puttyMoment += c.cavCogX * c.cavVol * PUTTY_DENSITY * puttyFillFraction;
  }

  const perAxleWeight = wheelWeight / 2;
  const wheelMoment = perAxleWeight * CAR.frontAxle + perAxleWeight * CAR.rearAxle;

  const totalMoment = remainingWoodMoment + puttyMoment + wheelMoment;
  const cogX = totalMoment / totalWeight;

  return { woodWeight, puttyWeight, wheelWeight, totalWeight, cogX };
}

// ─── Solve for fill fraction to hit target weight ────────────────────
function solveForTargetWeight(baseProfWeight, cavities) {
  const totalWoodRemoved = cavities.reduce((s, c) => s + c.woodRemoved, 0);
  const totalMaxPutty = cavities.reduce((s, c) => s + c.cavVol * PUTTY_DENSITY, 0);

  const woodWeight = baseProfWeight - totalWoodRemoved;
  const wheelWeight = CAR.wheelAxleWeight;

  const neededPutty = TARGET_WEIGHT - woodWeight - wheelWeight;
  const fillFraction = neededPutty / totalMaxPutty;

  return fillFraction;
}

// ─── Print cavity result ─────────────────────────────────────────────
function printResult(label, baseProfWeight, cavities, fillFraction) {
  console.log("\n" + "-".repeat(65));
  console.log("  DESIGN: " + label);
  console.log("-".repeat(65));

  for (const c of cavities) {
    console.log('  Cavity: x = ' + c.xStart.toFixed(3) + '" to ' + c.xEnd.toFixed(3) + '" (span: ' + (c.xEnd - c.xStart).toFixed(3) + '")');
    if (c.depth !== undefined) {
      console.log('          depth = ' + c.depth.toFixed(3) + '" from bottom');
    }
    console.log('          width = ' + c.cavityWidth.toFixed(3) + '" (car width = ' + CAR.width + '")');
    console.log('          volume = ' + c.cavVol.toFixed(4) + ' in^3');
    console.log('          centroid = ' + c.cavCogX.toFixed(3) + '" from front');
    console.log('          wood removed = ' + c.woodRemoved.toFixed(4) + ' oz');
    console.log('          max putty = ' + c.puttyWeight.toFixed(4) + ' oz (if 100% filled)');
  }

  if (fillFraction === null || fillFraction === undefined) {
    fillFraction = solveForTargetWeight(baseProfWeight, cavities);
  }

  const result = computeCarWithCavity(baseProfWeight, cavities, fillFraction);

  console.log("\n  Fill fraction: " + (fillFraction * 100).toFixed(1) + "% of cavity volume");
  console.log("  Putty weight:  " + result.puttyWeight.toFixed(4) + " oz");
  console.log("  Putty volume:  " + (result.puttyWeight / PUTTY_DENSITY).toFixed(4) + " in^3");
  console.log("  Wood weight:   " + result.woodWeight.toFixed(4) + " oz");
  console.log("  Wheel weight:  " + result.wheelWeight.toFixed(2) + " oz");
  console.log("  -----------------------------------");
  console.log("  TOTAL WEIGHT:  " + result.totalWeight.toFixed(4) + " oz  (target: " + TARGET_WEIGHT.toFixed(2) + " oz)  " + (Math.abs(result.totalWeight - TARGET_WEIGHT) < 0.01 ? 'PASS' : 'FAIL'));
  console.log('  COG FROM FRONT: ' + result.cogX.toFixed(4) + '"  (target: ' + TARGET_COG.toFixed(2) + '")  ' + (Math.abs(result.cogX - TARGET_COG) < 0.1 ? 'PASS' : 'FAIL'));
  console.log('  COG FROM REAR AXLE: ' + (CAR.rearAxle - result.cogX).toFixed(4) + '" forward');

  const cogError = result.cogX - TARGET_COG;
  if (Math.abs(cogError) >= 0.1) {
    console.log('  ** COG error: ' + (cogError > 0 ? '+' : '') + cogError.toFixed(4) + '" (' + (cogError > 0 ? 'too far back' : 'too far forward') + ')');
  }

  return Object.assign({}, result, { fillFraction: fillFraction });
}

// ─── DESIGN A ────────────────────────────────────────────────────────
function designA(baseProfWeight) {
  const xStart = 2.0;
  const xEnd = 5.75;
  const cav = analyzeThroughCut(xStart, xEnd, CAR.width, "Between-axles through-cut");
  return printResult("A -- Single between-axles through-cut (full width)", baseProfWeight, [cav]);
}

// ─── DESIGN B ────────────────────────────────────────────────────────
function designB(baseProfWeight) {
  const xStart = 6.25;
  const xEnd = 6.9;
  const depth = 0.55;
  const cav = analyzeBottomPocket(xStart, xEnd, depth, CAR.width, "Rear pocket");
  return printResult("B -- Rear pocket behind rear axle (full depth)", baseProfWeight, [cav]);
}

// ─── DESIGN C ────────────────────────────────────────────────────────
function designC(baseProfWeight) {
  const cav1 = analyzeThroughCut(4.0, 5.75, CAR.width, "Mid-rear through-cut");
  const cav2 = analyzeThroughCut(6.25, 6.9, CAR.width, "Behind-rear-axle through-cut");
  return printResult("C -- Split cavities (mid-rear + behind rear axle)", baseProfWeight, [cav1, cav2]);
}

// ─── DESIGN D ────────────────────────────────────────────────────────
function designD(baseProfWeight) {
  const cav = analyzeThroughCut(4.5, 5.75, 1.25, "Narrow rear through-cut");
  return printResult('D -- Narrow (1.25") rear through-cut with wood sides', baseProfWeight, [cav]);
}

// ─── DESIGN E ────────────────────────────────────────────────────────
function designE(baseProfWeight) {
  const cav = analyzeThroughCut(6.25, 6.95, CAR.width, "Behind-rear-axle through-cut");
  return printResult("E -- Behind rear axle only (through-cut, full width)", baseProfWeight, [cav]);
}

// ─── DESIGN F -- optimizer ───────────────────────────────────────────
function designF(baseProfWeight) {
  console.log("\n" + "-".repeat(65));
  console.log("  DESIGN F -- OPTIMIZER: Find cavity that hits BOTH targets");
  console.log("-".repeat(65));

  const bestResults = [];
  const validRegions = [
    { start: 0, end: 1.5 },
    { start: 2.0, end: 5.75 },
    { start: 6.25, end: 7.0 },
  ];

  for (const region of validRegions) {
    for (let xS = region.start; xS < region.end - 0.05; xS += 0.01) {
      for (let xE = xS + 0.05; xE <= region.end; xE += 0.01) {
        const cav = analyzeThroughCut(xS, xE, CAR.width);
        const fillFrac = solveForTargetWeight(baseProfWeight, [cav]);
        if (fillFrac < 0 || fillFrac > 1.0) continue;

        const result = computeCarWithCavity(baseProfWeight, [cav], fillFrac);
        const cogErr = Math.abs(result.cogX - TARGET_COG);
        const wtErr = Math.abs(result.totalWeight - TARGET_WEIGHT);

        if (cogErr < 0.05 && wtErr < 0.01) {
          bestResults.push({
            xStart: xS, xEnd: xE, fillFrac, cogErr, wtErr,
            cogX: result.cogX, totalWeight: result.totalWeight,
            region: "[" + region.start + ", " + region.end + "]",
            cavVol: cav.cavVol,
            puttyWeight: cav.cavVol * PUTTY_DENSITY * fillFrac,
          });
        }
      }
    }
  }

  console.log("\n  Searching for two-cavity solutions...");

  const twoResults = [];

  for (let r_start = 6.25; r_start <= 6.5; r_start += 0.05) {
    for (let r_end = r_start + 0.1; r_end <= 7.0; r_end += 0.05) {
      const rearCav = analyzeThroughCut(r_start, r_end, CAR.width);
      for (let f_start = 3.0; f_start <= 5.5; f_start += 0.05) {
        for (let f_end = f_start + 0.1; f_end <= 5.75; f_end += 0.05) {
          const frontCav = analyzeThroughCut(f_start, f_end, CAR.width);
          const allCavs = [frontCav, rearCav];

          const fillFrac = solveForTargetWeight(baseProfWeight, allCavs);
          if (fillFrac < 0.01 || fillFrac > 1.0) continue;

          const result = computeCarWithCavity(baseProfWeight, allCavs, fillFrac);
          const cogErr = Math.abs(result.cogX - TARGET_COG);
          const wtErr = Math.abs(result.totalWeight - TARGET_WEIGHT);

          if (cogErr < 0.03 && wtErr < 0.01) {
            twoResults.push({
              frontCav: { xStart: f_start, xEnd: f_end },
              rearCav: { xStart: r_start, xEnd: r_end },
              fillFrac, cogErr, wtErr,
              cogX: result.cogX, totalWeight: result.totalWeight,
              totalCavVol: frontCav.cavVol + rearCav.cavVol,
              puttyWeight: result.puttyWeight,
            });
          }
        }
      }
    }
  }

  bestResults.sort((a, b) => a.cogErr - b.cogErr);

  console.log("\n  SINGLE-CAVITY solutions found: " + bestResults.length);
  if (bestResults.length > 0) {
    console.log("  Top 5:");
    for (let i = 0; i < Math.min(5, bestResults.length); i++) {
      const r = bestResults[i];
      console.log("    " + (i + 1) + '. x=[' + r.xStart.toFixed(2) + ', ' + r.xEnd.toFixed(2) + '] fill=' + (r.fillFrac * 100).toFixed(1) + '% wt=' + r.totalWeight.toFixed(3) + ' cog=' + r.cogX.toFixed(3) + '" vol=' + r.cavVol.toFixed(4) + ' in^3 putty=' + r.puttyWeight.toFixed(3) + ' oz');
    }

    const best = bestResults[0];
    const cav = analyzeThroughCut(best.xStart, best.xEnd, CAR.width, "Optimized single cavity");
    printResult('F.1 -- Best single cavity [' + best.xStart.toFixed(2) + '", ' + best.xEnd.toFixed(2) + '"]', baseProfWeight, [cav], best.fillFrac);
  }

  twoResults.sort((a, b) => a.cogErr - b.cogErr);

  console.log("\n  TWO-CAVITY solutions found: " + twoResults.length);
  if (twoResults.length > 0) {
    console.log("  Top 5:");
    for (let i = 0; i < Math.min(5, twoResults.length); i++) {
      const r = twoResults[i];
      console.log("    " + (i + 1) + '. front=[' + r.frontCav.xStart.toFixed(2) + ', ' + r.frontCav.xEnd.toFixed(2) + '] rear=[' + r.rearCav.xStart.toFixed(2) + ', ' + r.rearCav.xEnd.toFixed(2) + '] fill=' + (r.fillFrac * 100).toFixed(1) + '% wt=' + r.totalWeight.toFixed(3) + ' cog=' + r.cogX.toFixed(3) + '" putty=' + r.puttyWeight.toFixed(3) + ' oz');
    }

    const best = twoResults[0];
    const fCav = analyzeThroughCut(best.frontCav.xStart, best.frontCav.xEnd, CAR.width, "Front cavity");
    const rCav = analyzeThroughCut(best.rearCav.xStart, best.rearCav.xEnd, CAR.width, "Rear cavity");
    printResult("F.2 -- Best two-cavity", baseProfWeight, [fCav, rCav], best.fillFrac);
  }

  return { bestResults, twoResults };
}

// ─── DESIGN G -- differential fill ───────────────────────────────────
function designG(baseProfWeight) {
  console.log("\n" + "-".repeat(65));
  console.log("  DESIGN G -- DIFFERENTIAL FILL: Different fill per cavity");
  console.log("-".repeat(65));

  const configurations = [
    { fStart: 3.5, fEnd: 5.75, rStart: 6.25, rEnd: 6.95, name: "wide mid + full rear" },
    { fStart: 4.5, fEnd: 5.75, rStart: 6.25, rEnd: 6.95, name: "narrow mid + full rear" },
    { fStart: 5.0, fEnd: 5.75, rStart: 6.25, rEnd: 6.95, name: "short mid + full rear" },
    { fStart: 2.0, fEnd: 5.75, rStart: 6.25, rEnd: 6.95, name: "full span + full rear" },
    { fStart: 4.0, fEnd: 5.75, rStart: 6.25, rEnd: 6.75, name: "mid-rear + short rear" },
  ];

  const results = [];

  for (const cfg of configurations) {
    const fCav = analyzeThroughCut(cfg.fStart, cfg.fEnd, CAR.width);
    const rCav = analyzeThroughCut(cfg.rStart, cfg.rEnd, CAR.width);

    const woodWeight = baseProfWeight - fCav.woodRemoved - rCav.woodRemoved;
    const wheelWeight = CAR.wheelAxleWeight;

    const P1 = fCav.cavVol * PUTTY_DENSITY;
    const P2 = rCav.cavVol * PUTTY_DENSITY;
    const RHS1 = TARGET_WEIGHT - woodWeight - wheelWeight;

    const baseWoodMoment = integrate(x => x * profileHeight(x) * CAR.width * WOOD_DENSITY, 0, CAR.length);
    const fCavWoodMoment = integrate(x => x * profileHeight(x) * CAR.width * WOOD_DENSITY, cfg.fStart, cfg.fEnd);
    const rCavWoodMoment = integrate(x => x * profileHeight(x) * CAR.width * WOOD_DENSITY, cfg.rStart, cfg.rEnd);
    const remainingWoodMoment = baseWoodMoment - fCavWoodMoment - rCavWoodMoment;

    const perAxleWeight = wheelWeight / 2;
    const wheelMoment = perAxleWeight * CAR.frontAxle + perAxleWeight * CAR.rearAxle;

    const M1 = fCav.cavCogX * P1;
    const M2 = rCav.cavCogX * P2;
    const RHS2 = TARGET_COG * TARGET_WEIGHT - remainingWoodMoment - wheelMoment;

    const det = P1 * M2 - P2 * M1;
    if (Math.abs(det) < 1e-10) continue;

    const f1 = (RHS1 * M2 - RHS2 * P2) / det;
    const f2 = (RHS2 * P1 - RHS1 * M1) / det;

    const feasible = f1 >= 0 && f1 <= 1.0 && f2 >= 0 && f2 <= 1.0;

    console.log("\n  Config: " + cfg.name);
    console.log('    Front cavity [' + cfg.fStart.toFixed(2) + ', ' + cfg.fEnd.toFixed(2) + ']: vol=' + fCav.cavVol.toFixed(4) + ' in^3, cog=' + fCav.cavCogX.toFixed(3) + '"');
    console.log('    Rear cavity  [' + cfg.rStart.toFixed(2) + ', ' + cfg.rEnd.toFixed(2) + ']: vol=' + rCav.cavVol.toFixed(4) + ' in^3, cog=' + rCav.cavCogX.toFixed(3) + '"');
    console.log("    Solution: f1=" + f1.toFixed(4) + " (" + (f1 * 100).toFixed(1) + "%), f2=" + f2.toFixed(4) + " (" + (f2 * 100).toFixed(1) + "%)");
    console.log("    Feasible: " + (feasible ? "YES" : "NO (fill fraction out of 0-100% range)"));

    if (feasible) {
      const actualPutty1 = f1 * P1;
      const actualPutty2 = f2 * P2;
      const totalWt = woodWeight + actualPutty1 + actualPutty2 + wheelWeight;
      const totalMoment = remainingWoodMoment + f1 * M1 + f2 * M2 + wheelMoment;
      const actualCog = totalMoment / totalWt;

      console.log("    Verification:");
      console.log("      Wood:   " + woodWeight.toFixed(4) + " oz");
      console.log("      Putty1: " + actualPutty1.toFixed(4) + " oz (" + (f1 * fCav.cavVol).toFixed(4) + " in^3)");
      console.log("      Putty2: " + actualPutty2.toFixed(4) + " oz (" + (f2 * rCav.cavVol).toFixed(4) + " in^3)");
      console.log("      Wheels: " + wheelWeight.toFixed(2) + " oz");
      console.log("      TOTAL:  " + totalWt.toFixed(4) + " oz   (target: " + TARGET_WEIGHT + ")  " + (Math.abs(totalWt - TARGET_WEIGHT) < 0.01 ? "PASS" : "FAIL"));
      console.log('      COG:    ' + actualCog.toFixed(4) + '"  (target: ' + TARGET_COG + '")  ' + (Math.abs(actualCog - TARGET_COG) < 0.01 ? "PASS" : "FAIL"));
      console.log("      Total putty: " + (actualPutty1 + actualPutty2).toFixed(4) + " oz (" + (f1 * fCav.cavVol + f2 * rCav.cavVol).toFixed(4) + " in^3)");

      results.push({
        cfg, f1, f2, actualPutty1, actualPutty2, totalWt, actualCog, woodWeight,
        fCav, rCav,
      });
    }
  }

  return results;
}

// ─── DESIGN H -- precise single cavity ───────────────────────────────
function designH(baseProfWeight) {
  console.log("\n" + "-".repeat(65));
  console.log("  DESIGN H -- PRECISE SINGLE CAVITY with 100% fill");
  console.log("-".repeat(65));
  console.log("  Strategy: single cavity, 100% putty fill, find exact span");
  console.log("  that achieves both weight and COG targets simultaneously.\n");

  const neededVol = (TARGET_WEIGHT - baseProfWeight - CAR.wheelAxleWeight) / (PUTTY_DENSITY - WOOD_DENSITY);
  console.log("  Needed cavity volume (100% fill): " + neededVol.toFixed(5) + " in^3");
  console.log("  (This gives " + (neededVol * PUTTY_DENSITY).toFixed(4) + " oz of putty, " + (neededVol * WOOD_DENSITY).toFixed(4) + " oz wood removed)");
  console.log("  Net addition: " + (neededVol * (PUTTY_DENSITY - WOOD_DENSITY)).toFixed(4) + " oz\n");

  const baseWoodMoment = integrate(x => x * profileHeight(x) * CAR.width * WOOD_DENSITY, 0, CAR.length);
  const perAxleWeight = CAR.wheelAxleWeight / 2;
  const wheelMoment = perAxleWeight * CAR.frontAxle + perAxleWeight * CAR.rearAxle;

  const neededCavMomentGeom = (TARGET_COG * TARGET_WEIGHT - baseWoodMoment - wheelMoment) / (PUTTY_DENSITY - WOOD_DENSITY);
  const neededCavCentroid = neededCavMomentGeom / neededVol;

  console.log("  Base wood moment:     " + baseWoodMoment.toFixed(5) + " oz*in");
  console.log("  Wheel moment:         " + wheelMoment.toFixed(5) + " oz*in");
  console.log('  Needed cav centroid:  ' + neededCavCentroid.toFixed(4) + '" from front');
  console.log("  Needed cav volume:    " + neededVol.toFixed(5) + " in^3");

  const validRegions = [
    { start: 0, end: 1.5, name: "nose" },
    { start: 2.0, end: 5.75, name: "between axles" },
    { start: 6.25, end: 7.0, name: "behind rear axle" },
  ];

  console.log('\n  Searching valid regions for single cavity with centroid at ' + neededCavCentroid.toFixed(3) + '"...');

  let foundSolution = false;

  for (const region of validRegions) {
    let bestErr = Infinity;
    let bestSol = null;

    for (let xS = region.start; xS <= region.end - 0.01; xS += 0.005) {
      let lo = xS + 0.001;
      let hi = region.end;

      const maxVol = integrate(x => profileHeight(x) * CAR.width, xS, hi);
      if (maxVol < neededVol) continue;

      for (let iter = 0; iter < 100; iter++) {
        const mid = (lo + hi) / 2;
        const vol = integrate(x => profileHeight(x) * CAR.width, xS, mid);
        if (vol < neededVol) lo = mid;
        else hi = mid;
      }
      const xE = (lo + hi) / 2;

      if (xE > region.end) continue;

      const vol = integrate(x => profileHeight(x) * CAR.width, xS, xE);
      const mom = integrate(x => x * profileHeight(x) * CAR.width, xS, xE);
      const centroid = mom / vol;

      const err = Math.abs(centroid - neededCavCentroid);
      if (err < bestErr) {
        bestErr = err;
        bestSol = { xS, xE, vol, centroid };
      }
    }

    if (bestSol) {
      const match = bestErr < 0.05;
      console.log("\n  Region: " + region.name + " [" + region.start + ", " + region.end + "]");
      console.log('    Best: x=[' + bestSol.xS.toFixed(4) + ', ' + bestSol.xE.toFixed(4) + ']');
      console.log("    Volume: " + bestSol.vol.toFixed(5) + " in^3 (need " + neededVol.toFixed(5) + ")");
      console.log('    Centroid: ' + bestSol.centroid.toFixed(4) + '" (need ' + neededCavCentroid.toFixed(4) + '")');
      console.log("    Centroid error: " + bestErr.toFixed(4) + '" -- ' + (match ? "MATCH!" : "no match"));

      if (match) {
        foundSolution = true;
        const cav = analyzeThroughCut(bestSol.xS, bestSol.xE, CAR.width, "Optimized in " + region.name);
        printResult("H -- Optimal single cavity in " + region.name, baseProfWeight, [cav], 1.0);
      }
    }
  }

  if (!foundSolution) {
    console.log("\n  No single-cavity solution achieves both targets exactly.");
    console.log("  The needed centroid may not be achievable in any single valid region.");
    console.log("  => Differential-fill two-cavity solution (Design G) is recommended.");
  }
}

// ─── ASCII diagram ───────────────────────────────────────────────────
function drawAsciiDiagram(cavities) {
  console.log("\n  SIDE PROFILE (not to scale):");
  console.log("  Front <-----------------------------------------------> Rear");

  const cols = 70;
  const rows = 10;

  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));

  for (let c = 0; c < cols; c++) {
    const x = (c / (cols - 1)) * CAR.length;
    const h = profileHeight(x);
    const hNorm = h / 0.6;
    const topRow = rows - 1 - Math.round(hNorm * (rows - 1));

    let inCavity = false;
    for (const cav of cavities) {
      if (x >= cav.xStart && x <= cav.xEnd) inCavity = true;
    }

    for (let r = topRow; r < rows; r++) {
      grid[r][c] = inCavity ? '#' : 'W';
    }
  }

  const frontAxleCol = Math.round((CAR.frontAxle / CAR.length) * (cols - 1));
  const rearAxleCol = Math.round((CAR.rearAxle / CAR.length) * (cols - 1));
  if (grid[rows - 1]) {
    grid[rows - 1][frontAxleCol] = 'F';
    grid[rows - 1][rearAxleCol] = 'R';
  }

  for (const row of grid) {
    console.log("  " + row.join(''));
  }
  console.log("  " + "-".repeat(cols));

  let ruler = "  0\"";
  const pad1 = frontAxleCol - 3;
  const pad2 = rearAxleCol - frontAxleCol - 5;
  const pad3 = cols - rearAxleCol - 4;
  ruler += " ".repeat(Math.max(0, pad1)) + '1.75"';
  ruler += " ".repeat(Math.max(0, pad2)) + '6.0"';
  ruler += " ".repeat(Math.max(0, pad3)) + '7"';
  console.log(ruler);
  console.log("  W = wood   # = putty cavity   F = front axle   R = rear axle");
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════
function main() {
  const { profVol, profWeight } = verifyBaseWeight();
  const body = computeWoodBody();

  console.log('\n  Profiled body COG:    ' + body.cogX.toFixed(4) + '" from front');
  console.log("  Weight budget:");
  console.log("    Wood (profiled):    " + profWeight.toFixed(4) + " oz");
  console.log("    Wheels+axles:       " + CAR.wheelAxleWeight.toFixed(2) + " oz");
  console.log("    Subtotal:           " + (profWeight + CAR.wheelAxleWeight).toFixed(4) + " oz");
  console.log("    Target total:       " + TARGET_WEIGHT.toFixed(2) + " oz");
  console.log("    Need to add (net):  " + (TARGET_WEIGHT - profWeight - CAR.wheelAxleWeight).toFixed(4) + " oz");
  console.log("    Putty-wood net density: " + (PUTTY_DENSITY - WOOD_DENSITY).toFixed(4) + " oz/in^3");
  console.log("    => Need cavity volume:  " + ((TARGET_WEIGHT - profWeight - CAR.wheelAxleWeight) / (PUTTY_DENSITY - WOOD_DENSITY)).toFixed(5) + " in^3 (if 100% filled)");

  console.log("\n\n================================================================");
  console.log("              CAVITY DESIGN ANALYSIS");
  console.log("================================================================");

  designA(profWeight);
  designB(profWeight);
  designC(profWeight);
  designD(profWeight);
  designE(profWeight);
  designF(profWeight);
  const gResults = designG(profWeight);
  designH(profWeight);

  // ─── RECOMMENDATION ──────────────────────────────────────────────
  console.log("\n\n================================================================");
  console.log("              RECOMMENDATION");
  console.log("================================================================");

  // Use the best feasible Design G result
  // Try the "narrow mid + full rear" config as the primary recommendation
  // but iterate through all G results to find the best one

  if (gResults.length > 0) {
    // Sort by how close COG is to target
    gResults.sort((a, b) => Math.abs(a.actualCog - TARGET_COG) - Math.abs(b.actualCog - TARGET_COG));
    const best = gResults[0];

    const fStart = best.cfg.fStart;
    const fEnd = best.cfg.fEnd;
    const rStart = best.cfg.rStart;
    const rEnd = best.cfg.rEnd;
    const f1 = best.f1;
    const f2 = best.f2;
    const fCav = best.fCav;
    const rCav = best.rCav;

    console.log("\n  RECOMMENDED: Two-cavity with differential putty fill");
    console.log('  (Config: "' + best.cfg.name + '")\n');

    console.log("  CAVITY 1 (between axles, rear portion):");
    console.log('    Position:  x = ' + fStart.toFixed(2) + '" to ' + fEnd.toFixed(2) + '" (' + (fEnd - fStart).toFixed(2) + '" span)');
    console.log('    Width:     ' + CAR.width + '" (full width, through-cut)');
    console.log('    Height:    ' + profileHeight(fStart).toFixed(3) + '" to ' + profileHeight(fEnd).toFixed(3) + '" (profile height)');
    console.log("    Volume:    " + fCav.cavVol.toFixed(4) + " in^3");
    console.log("    Fill:      " + (f1 * 100).toFixed(1) + "% -> " + best.actualPutty1.toFixed(4) + " oz of putty (" + (f1 * fCav.cavVol).toFixed(4) + " in^3)");

    console.log("\n  CAVITY 2 (behind rear axle):");
    console.log('    Position:  x = ' + rStart.toFixed(2) + '" to ' + rEnd.toFixed(2) + '" (' + (rEnd - rStart).toFixed(2) + '" span)');
    console.log('    Width:     ' + CAR.width + '" (full width, through-cut)');
    console.log('    Height:    ' + profileHeight(rStart).toFixed(3) + '" to ' + profileHeight(rEnd).toFixed(3) + '" (profile height)');
    console.log("    Volume:    " + rCav.cavVol.toFixed(4) + " in^3");
    console.log("    Fill:      " + (f2 * 100).toFixed(1) + "% -> " + best.actualPutty2.toFixed(4) + " oz of putty (" + (f2 * rCav.cavVol).toFixed(4) + " in^3)");

    console.log("\n  RESULT:");
    console.log("    Wood remaining:  " + best.woodWeight.toFixed(4) + " oz");
    console.log("    Total putty:     " + (best.actualPutty1 + best.actualPutty2).toFixed(4) + " oz (" + (f1 * fCav.cavVol + f2 * rCav.cavVol).toFixed(4) + " in^3)");
    console.log("    Wheels+axles:    " + CAR.wheelAxleWeight.toFixed(2) + " oz");
    console.log("    -----------------------------------");
    console.log("    TOTAL WEIGHT:    " + best.totalWt.toFixed(4) + " oz  <- target: " + TARGET_WEIGHT.toFixed(2));
    console.log('    COG FROM FRONT:  ' + best.actualCog.toFixed(4) + '"  <- target: ' + TARGET_COG.toFixed(2) + '"');
    console.log('    COG FROM REAR:   ' + (CAR.rearAxle - best.actualCog).toFixed(4) + '" fwd of rear axle');

    drawAsciiDiagram([
      { xStart: fStart, xEnd: fEnd },
      { xStart: rStart, xEnd: rEnd },
    ]);

    console.log("\n  PRACTICAL NOTES:");
    console.log('    - Cut two through-slots with a scroll saw or band saw');
    console.log('    - Slot 1: ' + (fEnd - fStart).toFixed(2) + '" long, centered at x=' + ((fStart + fEnd) / 2).toFixed(2) + '" from front');
    console.log('    - Slot 2: ' + (rEnd - rStart).toFixed(2) + '" long, centered at x=' + ((rStart + rEnd) / 2).toFixed(2) + '" from front');
    console.log("    - Pack putty into each cavity (measure by weight, not volume)");
    console.log("    - Slot 1 gets " + best.actualPutty1.toFixed(3) + " oz of putty");
    console.log("    - Slot 2 gets " + best.actualPutty2.toFixed(3) + " oz of putty");
    console.log("    - Total putty to buy: " + (best.actualPutty1 + best.actualPutty2).toFixed(3) + " oz = " + ((best.actualPutty1 + best.actualPutty2) * 28.35).toFixed(1) + " grams");
    console.log("    - A 1 oz package of tungsten putty should be sufficient");
    console.log("    - After packing putty, verify weight on scale and adjust");
  } else {
    console.log("\n  No feasible two-cavity differential-fill solution found.");
    console.log("  Review the single-cavity options from Design F above.");
  }

  console.log("\n================================================================\n");
}

main();
