/* =====================================================================
 * GENERIC NATIVE BRIDGE  (game-agnostic)
 * ---------------------------------------------------------------------
 * Dropped into any WebView game to connect it to native AdMob + Play
 * Billing. Safe no-op in a plain browser (no AndroidBridge present).
 *
 * Exposes:
 *   Native.showInterstitial()
 *   Native.showRewarded(cb)      cb(granted:boolean)
 *   Native.purchaseRemoveAds()
 *   Native.isAdsRemoved()        boolean
 *
 * The native Kotlin layer calls back into:  window.NativeGame.*
 * A per-game adapter (loaded AFTER this file) wires the game's own
 * game-over / revive functions to these helpers.
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
    }
  };

  // Called by native code.
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

  // Floating "Remove Ads" button (only when native billing is available).
  var removeBtn;
  function injectRemoveBtn() {
    if (!has()) return;
    removeBtn = document.createElement('button');
    removeBtn.textContent = 'REMOVE ADS';
    removeBtn.setAttribute('style',
      'position:fixed;left:8px;bottom:8px;z-index:9999;padding:6px 10px;' +
      'font:700 11px sans-serif;color:#fff;background:rgba(0,0,0,.55);' +
      'border:1px solid #fff;border-radius:6px;');
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
