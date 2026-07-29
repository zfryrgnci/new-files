/* =====================================================================
 * Quantum Ascent — native monetization adapter + control fixes
 * ===================================================================== */
(function () {
  'use strict';

  // 1) Rewarded revive at the last checkpoint.
  var origRevive = window.watchAdToRevive;
  window.watchAdToRevive = function () {
    if (!window.Native || !window.Native.hasNative()) { origRevive(); return; }
    var btn = document.getElementById('btn-revive');
    if (btn) btn.innerText = 'Loading ad…';
    window.Native.showRewarded(function (granted) {
      if (btn) btn.innerText = 'Watch Ad: Restore';
      if (granted) origRevive();
    });
  };

  // 2) Real interstitial instead of the simulated "COMMERCIAL BREAK" screen.
  var origFinishAd = window.finishAd;
  window.showAdScreen = function () {
    if (window.Native) window.Native.showInterstitial();
    if (typeof origFinishAd === 'function') origFinishAd();
  };

  // 3) Pause / resume the physics loop.
  var wasPlaying = false;
  window.__onPause = function () { try { wasPlaying = isPlaying; isPlaying = false; } catch (e) {} };
  window.__onResume = function () {
    try { if (wasPlaying) { isPlaying = true; lastTime = performance.now(); requestAnimationFrame(loop); } } catch (e) {}
  };

  // 4) FIX THE JUMP (▲) AND DASH (⚡) BUTTONS.
  //    The game's touch handler set `window.justPressedUp`, but the game reads
  //    the top-level `justPressedUp` variable (not a window property) — so touch
  //    jumps never registered. We rebind with handlers that set the real vars.
  function bindTap(id, key, pressedVar) {
    var el = document.getElementById(id);
    if (!el) return;
    var down = function (e) {
      e.preventDefault();
      // Set the pressed-flag unconditionally: the game's own handler runs first
      // and would have already set keys.up, so a "!keys.up" guard would never fire.
      try {
        if (pressedVar === 'up') justPressedUp = true;
        if (pressedVar === 'dash') justPressedDash = true;
      } catch (err) {}
      try { keys[key] = true; } catch (err) {}
    };
    var up = function (e) { e.preventDefault(); try { keys[key] = false; } catch (err) {} };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
  }
  bindTap('btn-up', 'up', 'up');
  bindTap('btn-dash', 'dash', 'dash');

  // 5) Raise the on-screen controls so they aren't jammed at the very bottom.
  var css = document.createElement('style');
  css.textContent =
    '#controls{bottom:max(56px,calc(env(safe-area-inset-bottom) + 38px)) !important;}' +
    '.ctrl-btn{background:rgba(255,255,255,.08) !important;}';
  document.head.appendChild(css);
})();
