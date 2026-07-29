package com.refaz.loan

import android.app.Activity
import android.util.Log
import android.widget.FrameLayout
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback

class AdsManager(private val activity: Activity, private val bannerContainer: FrameLayout) {
    private val tag = "AdsManager"
    private var bannerView: AdView? = null
    private var interstitial: InterstitialAd? = null
    private var rewarded: RewardedAd? = null

    var adsRemoved: Boolean = false
        set(value) { field = value; if (value) hideBanner() else showBanner() }

    fun start() { if (adsRemoved) return; showBanner(); loadInterstitial(); loadRewarded() }

    fun showBanner() {
        if (adsRemoved) return
        activity.runOnUiThread {
            if (bannerView == null) {
                val adView = AdView(activity)
                adView.adUnitId = AdConfig.bannerId
                adView.setAdSize(adaptiveSize())
                bannerContainer.removeAllViews(); bannerContainer.addView(adView)
                adView.loadAd(AdRequest.Builder().build()); bannerView = adView
            }
            bannerContainer.visibility = FrameLayout.VISIBLE
        }
    }
    fun hideBanner() { activity.runOnUiThread { bannerContainer.visibility = FrameLayout.GONE } }

    private fun adaptiveSize(): AdSize {
        val m = activity.resources.displayMetrics
        val widthPx = if (bannerContainer.width > 0) bannerContainer.width else m.widthPixels
        return AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, (widthPx / m.density).toInt())
    }

    private fun loadInterstitial() {
        if (adsRemoved) return
        InterstitialAd.load(activity, AdConfig.interstitialId, AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitial = ad
                    ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                        override fun onAdDismissedFullScreenContent() { interstitial = null; loadInterstitial() }
                        override fun onAdFailedToShowFullScreenContent(e: AdError) { interstitial = null; loadInterstitial() }
                    }
                }
                override fun onAdFailedToLoad(error: LoadAdError) { Log.w(tag, "interstitial: ${error.message}"); interstitial = null }
            })
    }
    fun showInterstitial() {
        if (adsRemoved) return
        activity.runOnUiThread { val ad = interstitial; if (ad != null) ad.show(activity) else loadInterstitial() }
    }

    private fun loadRewarded() {
        RewardedAd.load(activity, AdConfig.rewardedId, AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) { rewarded = ad }
                override fun onAdFailedToLoad(error: LoadAdError) { Log.w(tag, "rewarded: ${error.message}"); rewarded = null }
            })
    }
    fun showRewarded(onResult: (Boolean) -> Unit) {
        activity.runOnUiThread {
            val ad = rewarded
            if (ad == null) { loadRewarded(); onResult(false); return@runOnUiThread }
            var earned = false
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
                override fun onAdDismissedFullScreenContent() { rewarded = null; loadRewarded(); onResult(earned) }
                override fun onAdFailedToShowFullScreenContent(e: AdError) { rewarded = null; loadRewarded(); onResult(false) }
            }
            ad.show(activity) { earned = true }
        }
    }
    fun destroy() { bannerView?.destroy(); bannerView = null }
}
