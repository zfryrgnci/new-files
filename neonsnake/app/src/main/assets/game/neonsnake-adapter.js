/* =====================================================================
 * Neon Snake — native monetization adapter
 * Runs AFTER the game script + native-bridge.js. Wires the game's own
 * functions to real AdMob calls. In a plain browser it degrades to the
 * original free behavior.
 * ===================================================================== */
(function () {
  'use strict';

  // 1) Rewarded "revive": only revive if the user actually earned the reward.
  var origRevive = window.watchAdToRevive;
  window.watchAdToRevive = function () {
    if (!window.Native || !window.Native.hasNative()) { origRevive(); return; } // browser: free
    var btn = document.getElementById('btn-revive');
    if (btn) btn.innerText = 'Loading ad…';
    window.Native.showRewarded(function (granted) {
      if (btn) btn.innerText = 'Watch Ad to Revive (1x)';
      if (granted) origRevive();
    });
  };

  // 2) Interstitial on every 2nd game over.
  var goCount = 0;
  var origGameOver = window.gameOver;
  window.gameOver = function () {
    origGameOver.apply(this, arguments);
    goCount++;
    if (goCount % 2 === 0 && window.Native) window.Native.showInterstitial();
  };

  // 3) Pause / resume the loop when the app is backgrounded.
  var wasPlaying = false;
  window.__onPause = function () {
    try { wasPlaying = isPlaying; isPlaying = false; } catch (e) {}
  };
  window.__onResume = function () {
    try {
      if (wasPlaying) { isPlaying = true; lastRender = performance.now(); requestAnimationFrame(loop); }
    } catch (e) {}
  };
})();
