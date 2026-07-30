/* =====================================================================
 * GENERIC NATIVE BRIDGE  (game-agnostic)
 * Connects any WebView game to native AdMob + Play Billing.
 * Safe no-op in a plain browser (no AndroidBridge present).
 * ===================================================================== */
(function () {
  'use strict';
  var B = window.AndroidBridge || null;
  var pendingReward = null;
  var adsRemoved = false;

  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function has() { return !!B; }

  window.Native = {
    hasNative: has,
    isAdsRemoved: function () { return adsRemoved; },
    showInterstitial: function () {
      if (adsRemoved || !has() || !B.showInterstitial) return;
      safe(function () { B.showInterstitial(); });
    },
    showRewarded: function (cb) {
      cb = cb || function () {};
      if (!has() || !B.showRewarded) { cb(false); return; }
      pendingReward = cb;
      var ok = safe(function () { B.showRewarded(); return true; });
      if (!ok) { pendingReward = null; cb(false); }
    },
    purchaseRemoveAds: function () {
      if (!has() || !B.purchaseRemoveAds) return;
      safe(function () { B.purchaseRemoveAds(); });
    },
    share: function (text) { if (has() && B.share) safe(function () { B.share(String(text)); }); }
  };

  window.NativeGame = {
    onReward: function (granted) { var c = pendingReward; pendingReward = null; if (c) c(!!granted); },
    onAdsRemovedChanged: function (v) {
      adsRemoved = (v === true || v === 'true');
      syncBanner(); updateRemoveBtn();
      if (window.__onAdsRemoved) safe(function () { window.__onAdsRemoved(adsRemoved); });
    },
    onPause: function () { if (window.__onPause) safe(window.__onPause); },
    onResume: function () { if (window.__onResume) safe(window.__onResume); }
  };

  function syncBanner() {
    if (!has()) return;
    if (adsRemoved) safe(function () { B.hideBanner && B.hideBanner(); });
    else safe(function () { B.showBanner && B.showBanner(); });
  }

  // Small "Remove Ads" button pinned to the RIGHT EDGE, vertically centered,
  // so it never overlaps the game's top HUD or bottom control buttons.
  var removeBtn;
  function injectRemoveBtn() {
    if (!has()) return;
    removeBtn = document.createElement('button');
    removeBtn.textContent = '✕ ADS';
    removeBtn.setAttribute('style',
      'position:fixed;right:3px;top:50%;transform:translateY(-50%);z-index:9999;' +
      'padding:4px 6px;font:700 10px sans-serif;color:#fff;background:rgba(0,0,0,.45);' +
      'border:1px solid rgba(255,255,255,.55);border-radius:6px;opacity:.8;');
    removeBtn.onclick = function () { window.Native.purchaseRemoveAds(); };
    document.body.appendChild(removeBtn);
    updateRemoveBtn();
  }
  function updateRemoveBtn() {
    if (!removeBtn) return;
    removeBtn.style.display = adsRemoved ? 'none' : 'block';
  }

  function boot() {
    if (has() && B.isAdsRemoved) {
      adsRemoved = safe(function () { return B.isAdsRemoved() === 'true' || B.isAdsRemoved() === true; }) || false;
    }
    injectRemoveBtn();
    syncBanner();
    updateRemoveBtn();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
