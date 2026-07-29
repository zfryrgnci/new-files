/* =====================================================================
 * Quantum Ascent — native monetization adapter
 * Replaces the game's SIMULATED ad screen + fake revive with real AdMob
 * interstitial and rewarded ads. Degrades to free behavior in a browser.
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

  // 2) Real interstitial in place of the simulated "COMMERCIAL BREAK" screen.
  var origFinishAd = window.finishAd;
  window.showAdScreen = function () {
    if (window.Native) window.Native.showInterstitial();
    // Continue straight into the next level; the native interstitial overlays it.
    if (typeof origFinishAd === 'function') origFinishAd();
  };

  // 3) Pause / resume the physics loop when backgrounded (also covers the
  //    moment a native interstitial takes over the screen).
  var wasPlaying = false;
  window.__onPause = function () { try { wasPlaying = isPlaying; isPlaying = false; } catch (e) {} };
  window.__onResume = function () {
    try { if (wasPlaying) { isPlaying = true; lastTime = performance.now(); requestAnimationFrame(loop); } } catch (e) {}
  };
})();
