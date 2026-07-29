/* =====================================================================
 * APP BRIDGE — ads + subscription (Pro) for utility apps.
 * Safe no-op in a plain browser (no AndroidBridge present).
 * ===================================================================== */
(function () {
  'use strict';
  var B = window.AndroidBridge || null;
  var isPro = false;
  function safe(fn){ try{ return fn(); }catch(e){ return undefined; } }
  function has(){ return !!B; }

  window.Native = {
    hasNative: has,
    isPro: function(){ return isPro; },
    showInterstitial: function(){ if(isPro||!has()||!B.showInterstitial) return; safe(function(){B.showInterstitial();}); },
    subscribe: function(plan){ if(!has()||!B.subscribe) return; safe(function(){B.subscribe(String(plan));}); },
    restore: function(){ if(has()&&B.restore) safe(function(){B.restore();}); },
    share: function(text){ if(has()&&B.share) safe(function(){B.share(String(text));}); }
  };

  window.NativeGame = {
    onProChanged: function(v){
      isPro = (v===true||v==='true');
      syncBanner();
      if(window.__setPro) safe(function(){ window.__setPro(isPro); });
    },
    onPrices: function(mon,year){ if(window.__setPrices) safe(function(){ window.__setPrices(mon,year); }); },
    onPause: function(){ if(window.__onPause) safe(window.__onPause); },
    onResume: function(){ if(window.__onResume) safe(window.__onResume); }
  };

  function syncBanner(){
    if(!has()) return;
    if(isPro) safe(function(){ B.hideBanner&&B.hideBanner(); });
    else safe(function(){ B.showBanner&&B.showBanner(); });
  }

  function boot(){
    if(has()&&B.isPro){ isPro = safe(function(){ return B.isPro()==='true'||B.isPro()===true; })||false; }
    if(window.__setPro) window.__setPro(isPro);
    syncBanner();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
