/* =====================================================================
 * Neon Snake — native monetization adapter + on-screen D-pad
 * ===================================================================== */
(function () {
  'use strict';

  // 1) Rewarded "revive".
  var origRevive = window.watchAdToRevive;
  window.watchAdToRevive = function () {
    if (!window.Native || !window.Native.hasNative()) { origRevive(); return; }
    var btn = document.getElementById('btn-revive');
    if (btn) btn.innerText = 'Loading ad…';
    window.Native.showRewarded(function (granted) {
      if (btn) btn.innerText = 'Watch Ad to Revive (1x)';
      if (granted) origRevive();
    });
  };

  // 2) Interstitial every 2nd game over.
  var goCount = 0;
  var origGameOver = window.gameOver;
  window.gameOver = function () {
    origGameOver.apply(this, arguments);
    goCount++;
    if (goCount % 2 === 0 && window.Native) window.Native.showInterstitial();
  };

  // 3) Pause / resume.
  var wasPlaying = false;
  window.__onPause = function () { try { wasPlaying = isPlaying; isPlaying = false; } catch (e) {} };
  window.__onResume = function () {
    try { if (wasPlaying) { isPlaying = true; lastRender = performance.now(); requestAnimationFrame(loop); } } catch (e) {}
  };

  // 4) ON-SCREEN D-PAD (the game previously only supported swipe).
  //    Buttons set the same nextDx/nextDy the keyboard handler uses, with the
  //    same "can't reverse into yourself" guard.
  function setDir(d) {
    try {
      if (d === 'up' && dy === 0) { nextDx = 0; nextDy = -1; }
      else if (d === 'down' && dy === 0) { nextDx = 0; nextDy = 1; }
      else if (d === 'left' && dx === 0) { nextDx = -1; nextDy = 0; }
      else if (d === 'right' && dx === 0) { nextDx = 1; nextDy = 0; }
    } catch (e) {}
  }

  var css = document.createElement('style');
  css.textContent =
    '#nsPad{position:fixed;left:50%;transform:translateX(-50%);' +
    'bottom:max(18px,env(safe-area-inset-bottom));z-index:9000;display:none;' +
    'flex-direction:column;align-items:center;gap:8px;pointer-events:none;}' +
    '#nsPad .row{display:flex;gap:8px;}' +
    '#nsPad button{pointer-events:auto;width:60px;height:60px;border-radius:12px;' +
    'font-size:24px;font-weight:900;color:#45f3ff;background:rgba(11,12,16,.55);' +
    'border:2px solid rgba(69,243,255,.5);box-shadow:0 0 12px rgba(69,243,255,.25);' +
    'touch-action:none;-webkit-user-select:none;user-select:none;}' +
    '#nsPad button:active{background:#45f3ff;color:#000;}';
  document.head.appendChild(css);

  var pad = document.createElement('div');
  pad.id = 'nsPad';
  pad.innerHTML =
    '<button data-d="up">▲</button>' +
    '<div class="row"><button data-d="left">◄</button>' +
    '<button data-d="down">▼</button>' +
    '<button data-d="right">►</button></div>';
  document.body.appendChild(pad);

  Array.prototype.forEach.call(pad.querySelectorAll('button'), function (b) {
    var d = b.getAttribute('data-d');
    var press = function (e) { e.preventDefault(); setDir(d); };
    b.addEventListener('touchstart', press, { passive: false });
    b.addEventListener('mousedown', press);
  });

  // Show the pad only while a round is in progress.
  setInterval(function () {
    try { pad.style.display = isPlaying ? 'flex' : 'none'; } catch (e) {}
  }, 150);
})();
