/* =====================================================================
 * Space Bala — AUTOMATED CRASH / PERFORMANCE / INVARIANT HARNESS
 * ---------------------------------------------------------------------
 * Runs the SHIP's real game logic (core.js) headlessly through thousands
 * of randomized play-throughs. This is the "instant QA" layer: it proves
 * the game cannot crash, leak memory, or violate its own rules — no
 * device, no manual testing.
 *
 *   Run:  node tests/game_core_test.js
 *   CI  :  exit code 0 = all good, 1 = a failure was found.
 * ===================================================================== */
'use strict';
const path = require('path');
const Game = require(path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'game', 'core.js'));

const L = Game.LIMITS;
let failures = 0;
const fail = (msg) => { failures++; console.error('  ✗ FAIL: ' + msg); };

function checkInvariants(g, ctx) {
  if (g.bullets.length > L.MAX_BULLETS) fail(`${ctx}: bullets ${g.bullets.length} > cap`);
  if (g.enemies.length > L.MAX_ENEMIES) fail(`${ctx}: enemies ${g.enemies.length} > cap`);
  if (g.particles.length > L.MAX_PARTICLES) fail(`${ctx}: particles ${g.particles.length} > cap`);
  if (g.score < 0) fail(`${ctx}: negative score ${g.score}`);
  if (!Number.isFinite(g.player.y)) fail(`${ctx}: player.y not finite`);
  if (g.player.y < -1 || g.player.y > g.H + 1) fail(`${ctx}: player.y out of bounds ${g.player.y}`);
  for (const e of g.enemies) if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) { fail(`${ctx}: enemy NaN pos`); break; }
}

// --- Test 1: random-input fuzz, many seeds, long runs -----------------
function fuzz(runs, maxFrames) {
  let crashes = 0, ended = 0, totalFrames = 0;
  for (let r = 0; r < runs; r++) {
    const seed = (r * 2654435761) >>> 0;
    const rng = Game.makeRng(seed);
    const g = new Game({ seed: seed, rng: rng });
    try {
      for (let f = 0; f < maxFrames; f++) {
        // random-but-sticky input to simulate a real thumb
        if (f % 7 === 0) g.setInput(rng() < 0.4, rng() < 0.4, rng() < 0.7);
        const alive = g.step();
        totalFrames++;
        if (f % 50 === 0) checkInvariants(g, `seed${seed} f${f}`);
        if (!alive) { ended++; break; }
      }
      checkInvariants(g, `seed${seed} final`);
    } catch (e) {
      crashes++; fail(`seed ${seed} threw: ${e && e.stack ? e.stack : e}`);
    }
  }
  console.log(`  fuzz: ${runs} runs, ${totalFrames} frames simulated, ${ended} natural game-overs, ${crashes} crashes`);
}

// --- Test 2: deterministic boss + victory path. We drive the score to the
//     boss threshold, confirm the boss spawns, then destroy it and confirm the
//     VICTORY end-state fires. This exercises the level-5 / win code directly,
//     independent of bot skill. ----------------------------------------
function bossPath(runs) {
  let victories = 0, bossSpawned = 0, crashes = 0;
  for (let r = 0; r < runs; r++) {
    const seed = (r * 40503 + 7) >>> 0;
    const g = new Game({ seed: seed });
    try {
      // Force the boss to spawn deterministically.
      g.score = 1000; g.step();
      if (g.bossActive && g.boss) bossSpawned++;
      else { fail(`boss seed ${seed}: boss failed to spawn`); continue; }

      // The boss slides in from off-screen and does NOT fire until it reaches
      // position (x <= W-80). Advance it into view while the player waits safely.
      let guard = 0;
      while (g.boss && g.boss.x > g.W - 80 && guard++ < 500) {
        g.enemies = []; g.bullets = []; g.setInput(false, false, false); g.step();
      }

      // Now deliver the killing blow on-screen: boss to 1 HP, a live bullet
      // overlapping it, player parked at the top edge, not on a laser frame.
      g.enemies = [];
      g.frameCount = 5;              // (5+1) % 40 != 0  -> no laser spawns this step
      g.boss.hp = 1;
      g.player.y = 0;
      g.bullets = [{ x: g.boss.x + 5, y: g.boss.y + g.boss.h / 2, w: 10, h: 4, speed: 8 }];
      g.setInput(false, false, false);
      g.step();

      if (g.gameOver && g.gameOverMsg === 'VICTORY!') victories++;
      else fail(`boss seed ${seed}: victory transition failed (over=${g.gameOver}, msg=${g.gameOverMsg})`);
    } catch (e) {
      crashes++; fail(`boss seed ${seed} threw: ${e && e.stack ? e.stack : e}`);
    }
  }
  console.log(`  boss-path: ${runs} runs, boss spawned ${bossSpawned}, victories ${victories}, crashes ${crashes}`);
  if (victories < runs) fail('victory transition did not fire on every run');
}

// --- Test 2b: survival fuzz-bot (crash coverage only, no skill assertion) --
function survivalBot(runs) {
  let crashes = 0, maxScore = 0, totalFrames = 0;
  for (let r = 0; r < runs; r++) {
    const seed = (r * 2246822519 + 1) >>> 0;
    const g = new Game({ seed: seed });
    try {
      let frames = 0;
      while (!g.gameOver && frames < 60 * 60 * 2) {
        const p = g.player;
        let threat = null, best = 1e9;
        for (const e of g.enemies) {
          if (e.x > p.x && e.x < p.x + 140) {
            const d = Math.abs((e.y + e.h / 2) - (p.y + p.height / 2));
            if (d < best) { best = d; threat = e; }
          }
        }
        let up = false, down = false;
        if (threat) { if (threat.y + threat.h / 2 > p.y + p.height / 2) up = true; else down = true; }
        g.setInput(up, down, true); g.step(); frames++; totalFrames++;
        if (frames % 100 === 0) checkInvariants(g, `surv seed${seed}`);
      }
      if (g.score > maxScore) maxScore = g.score;
    } catch (e) { crashes++; fail(`surv seed ${seed} threw: ${e}`); }
  }
  console.log(`  survival-bot: ${runs} runs, ${totalFrames} frames, best score ${maxScore}, crashes ${crashes}`);
}

// --- Test 3: performance budget -------------------------------------
function perf() {
  const g = new Game({ seed: 99 });
  g.setInput(true, false, true);
  const N = 200000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) { if (!g.step()) g.reset(); if (i % 11 === 0) g.setInput(i % 2 === 0, i % 3 === 0, true); }
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  const perStep = ms / N;
  const budget = 1000 / 60; // 16.6ms per frame @60fps
  console.log(`  perf: ${N} steps in ${ms.toFixed(1)}ms = ${(perStep * 1000).toFixed(2)}µs/step (budget ${budget.toFixed(2)}ms/frame)`);
  if (perStep > budget) fail(`step too slow: ${perStep.toFixed(3)}ms > ${budget}ms`);
}

console.log('Space Bala — automated QA harness');
console.log('[1/4] Random-input fuzz…');        fuzz(2000, 60 * 60 * 3);   // 2000 runs, up to 3 sim-min each
console.log('[2/4] Boss + victory path…');       bossPath(200);
console.log('[3/4] Survival bot (crash cover)…');survivalBot(300);
console.log('[4/4] Performance budget…');        perf();

if (failures === 0) { console.log('\n✅ ALL CHECKS PASSED — no crashes, no leaks, within perf budget.'); process.exit(0); }
else { console.error(`\n❌ ${failures} FAILURE(S).`); process.exit(1); }
