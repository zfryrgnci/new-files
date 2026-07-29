/* =====================================================================
 * Space Bala — RENDER + INPUT + NATIVE BRIDGE layer
 * ---------------------------------------------------------------------
 * Wraps SpaceBalaCore with: an HTML5 canvas renderer (DPR-aware, neon
 * glow), touch + keyboard controls, and a bridge to the native Android
 * layer for AdMob interstitial / rewarded ads and the Remove-Ads IAP.
 *
 * Runs unchanged in a plain browser (GitHub Pages) — when the native
 * bridge is absent every ad call becomes a safe no-op.
 * ===================================================================== */
(function () {
  'use strict';

  var LOGICAL_W = 300, LOGICAL_H = 400;

  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d', { alpha: false });
  var scoreEl = document.getElementById('score');
  var overlay = document.getElementById('ad-overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var restartBtn = document.getElementById('restart-btn');
  var reviveBtn = document.getElementById('revive-btn');
  var removeAdsBtn = document.getElementById('remove-ads-btn');

  // ---- Native bridge (Android JavascriptInterface named "AndroidBridge")
  var Bridge = window.AndroidBridge || null;
  function hasBridge() { return !!Bridge; }
  function bridgeSafe(fn) { try { return fn(); } catch (e) { return undefined; } }

  var adsRemoved = false;
  var gameOverCount = 0;         // show interstitial every 2nd game over
  var revivedThisRun = false;    // one rewarded revive per run
  var pendingRewardCb = null;

  function syncAdsRemoved() {
    if (hasBridge() && Bridge.isAdsRemoved) {
      adsRemoved = bridgeSafe(function () { return Bridge.isAdsRemoved() === 'true' || Bridge.isAdsRemoved() === true; }) || false;
    }
    updateRemoveAdsBtn();
    if (hasBridge()) { adsRemoved ? bridgeSafe(function(){ Bridge.hideBanner && Bridge.hideBanner(); })
                                  : bridgeSafe(function(){ Bridge.showBanner && Bridge.showBanner(); }); }
  }
  function updateRemoveAdsBtn() {
    if (!removeAdsBtn) return;
    // Hide the IAP button in a plain browser (no native billing available).
    removeAdsBtn.style.display = (adsRemoved || !hasBridge()) ? 'none' : 'inline-block';
  }

  // Called BY native code (see MainActivity.kt evaluateJavascript calls).
  window.SpaceBala = {
    onReward: function (granted) {
      var cb = pendingRewardCb; pendingRewardCb = null;
      if (cb) cb(!!granted);
    },
    onAdsRemovedChanged: function (v) {
      adsRemoved = (v === true || v === 'true');
      updateRemoveAdsBtn();
      syncAdsRemoved();
    },
    onPause: function () { running = false; },
    onResume: function () { if (!game.gameOver) { running = true; requestAnimationFrame(loop); } }
  };

  function showInterstitial() {
    if (adsRemoved || !hasBridge()) return;
    bridgeSafe(function () { Bridge.showInterstitial && Bridge.showInterstitial(); });
  }
  function showRewarded(cb) {
    if (!hasBridge() || !Bridge.showRewarded) { cb(false); return; }
    pendingRewardCb = cb;
    var ok = bridgeSafe(function () { Bridge.showRewarded(); return true; });
    if (!ok) { pendingRewardCb = null; cb(false); }
  }
  function purchaseRemoveAds() {
    if (!hasBridge() || !Bridge.purchaseRemoveAds) return;
    bridgeSafe(function () { Bridge.purchaseRemoveAds(); });
  }

  // ---- Game instance --------------------------------------------------
  var game = new SpaceBalaCore({
    width: LOGICAL_W, height: LOGICAL_H,
    seed: (Date.now() & 0x7fffffff),
    onGameOver: handleGameOver
  });

  function handleGameOver(msg) {
    gameOverCount++;
    overlayTitle.textContent = msg;
    // Offer a one-time rewarded revive (only on a normal death, not victory)
    var canRevive = hasBridge() && !revivedThisRun && msg === 'GAME OVER';
    reviveBtn.style.display = canRevive ? 'inline-block' : 'none';
    overlay.style.display = 'flex';
    if (gameOverCount % 2 === 0) showInterstitial();
  }

  function newGame() {
    revivedThisRun = false;
    game.reset();
    overlay.style.display = 'none';
    start();
  }

  function revive() {
    showRewarded(function (granted) {
      if (!granted) return;
      revivedThisRun = true;
      // Clear the field around the player and resume with a fresh life + i-frames.
      game.enemies = [];
      game.bullets = [];
      game.gameOver = false;
      game.lives = Math.max(1, game.lives);
      game.invuln = 120;
      game.player.y = LOGICAL_H / 2;
      overlay.style.display = 'none';
      start();
    });
  }

  // ---- Rendering ------------------------------------------------------
  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  function draw() {
    var sx = canvas.width / LOGICAL_W, sy = canvas.height / LOGICAL_H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);

    ctx.fillStyle = '#100010';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.fillStyle = '#662266';
    for (var i = 0; i < game.stars.length; i++) {
      var s = game.stars[i];
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    var p = game.player;
    // Blink the ship while invulnerable (skip drawing on alternate frames).
    var blink = game.invuln > 0 && (Math.floor(game.invuln / 5) % 2 === 0);
    if (!blink) {
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff00ff'; ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.width, p.y + p.height / 2);
      ctx.lineTo(p.x, p.y + p.height);
      ctx.closePath(); ctx.fill();
    }

    ctx.shadowColor = '#00ffff'; ctx.fillStyle = '#00ffff';
    for (var b = 0; b < game.bullets.length; b++) {
      var bl = game.bullets[b]; ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
    }

    for (var e = 0; e < game.enemies.length; e++) {
      var en = game.enemies[e];
      if (en.type === 'asteroid') {
        ctx.shadowBlur = 0; ctx.fillStyle = '#666666'; ctx.fillRect(en.x, en.y, en.w, en.h);
        if (en.hp < 5) { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(en.x + 5, en.y + 5, en.w - 10, en.h - 10); }
      } else {
        ctx.shadowBlur = 10; ctx.shadowColor = en.color; ctx.fillStyle = en.color;
        ctx.fillRect(en.x, en.y, en.w, en.h);
      }
    }

    if (game.bossActive && game.boss) {
      var bo = game.boss;
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 20; ctx.fillStyle = '#880000';
      ctx.fillRect(bo.x, bo.y, bo.w, bo.h);
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(bo.x + 10, bo.y + 10, 20, 20);
      ctx.fillRect(bo.x + 10, bo.y + 50, 20, 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#550000'; ctx.fillRect(bo.x, bo.y - 15, bo.w, 5);
      ctx.fillStyle = '#00ff88'; ctx.fillRect(bo.x, bo.y - 15, bo.w * (bo.hp / bo.maxHp), 5);
    }

    for (var q = 0; q < game.particles.length; q++) {
      var pt = game.particles[q];
      ctx.shadowColor = pt.color; ctx.shadowBlur = 10; ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 3, 3);
    }
    ctx.shadowBlur = 0;
  }

  // ---- Fixed-timestep loop (frame-rate independent) -------------------
  var running = false;
  var STEP_MS = 1000 / 60;
  var acc = 0, last = 0;

  function loop(ts) {
    if (!running) return;
    if (!last) last = ts;
    var dt = ts - last; last = ts;
    if (dt > 250) dt = 250; // avoid spiral of death after backgrounding
    acc += dt;
    var steps = 0;
    while (acc >= STEP_MS && steps < 5) {
      if (!game.step()) { running = false; break; }
      acc -= STEP_MS; steps++;
    }
    scoreEl.textContent = game.score + '  [Lv ' + game.level + ']  ' +
      new Array(Math.max(0, game.lives) + 1).join('♥');
    draw();
    if (running) requestAnimationFrame(loop);
  }

  function start() {
    resize();
    running = true; last = 0; acc = 0;
    requestAnimationFrame(loop);
  }

  // ---- Input ----------------------------------------------------------
  function bindHold(el, setter) {
    if (!el) return;
    var on = function (ev) { ev.preventDefault(); setter(true); };
    var off = function (ev) { ev.preventDefault(); setter(false); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
  bindHold(document.getElementById('btn-up'), function (v) { game.keys.up = v; });
  bindHold(document.getElementById('btn-down'), function (v) { game.keys.down = v; });
  bindHold(document.getElementById('btn-fire'), function (v) { game.keys.fire = v; });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') game.keys.up = true;
    if (e.key === 'ArrowDown') game.keys.down = true;
    if (e.key === ' ' || e.key === 'Enter') game.keys.fire = true;
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === 'ArrowUp') game.keys.up = false;
    if (e.key === 'ArrowDown') game.keys.down = false;
    if (e.key === ' ' || e.key === 'Enter') game.keys.fire = false;
  });

  restartBtn.addEventListener('click', newGame);
  reviveBtn.addEventListener('click', revive);
  if (removeAdsBtn) removeAdsBtn.addEventListener('click', purchaseRemoveAds);

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; }
    else if (!game.gameOver) { running = true; last = 0; requestAnimationFrame(loop); }
  });

  // ---- Boot -----------------------------------------------------------
  syncAdsRemoved();
  start();
})();
