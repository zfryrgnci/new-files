package com.refaz.loan

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebSettings
import android.widget.FrameLayout
import android.widget.LinearLayout
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.android.gms.ads.MobileAds
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

class MainActivity : android.app.Activity() {

    private lateinit var webView: WebView
    private lateinit var ads: AdsManager
    private lateinit var billing: BillingManager
    private lateinit var consentInformation: ConsentInformation
    @Volatile private var adsInitialized = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        webView = WebView(this)
        val bannerContainer = FrameLayout(this)
        root.addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        root.addView(bannerContainer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(root)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webView.setBackgroundColor(0xFF000000.toInt())

        ads = AdsManager(this, bannerContainer)
        billing = BillingManager(applicationContext) { removed ->
            runOnUiThread {
                ads.adsRemoved = removed
                webView.evaluateJavascript("window.NativeGame && window.NativeGame.onAdsRemovedChanged($removed);", null)
            }
        }
        webView.addJavascriptInterface(GameBridge(), "AndroidBridge")
        webView.loadUrl("file:///android_asset/game/index.html")

        billing.start()
        gatherConsentThenInitAds()
    }

    private fun gatherConsentThenInitAds() {
        val params = ConsentRequestParameters.Builder().build()
        consentInformation = UserMessagingPlatform.getConsentInformation(this)
        consentInformation.requestConsentInfoUpdate(this, params, {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) { initAdsOnce() }
        }, { initAdsOnce() })
        if (consentInformation.canRequestAds()) initAdsOnce()
    }

    private fun initAdsOnce() {
        if (adsInitialized) return
        adsInitialized = true
        MobileAds.initialize(this) {
            runOnUiThread { ads.adsRemoved = billing.adsRemoved; ads.start() }
        }
    }

    inner class GameBridge {
        @JavascriptInterface fun isAdsRemoved(): String = billing.adsRemoved.toString()
        @JavascriptInterface fun showBanner() = ads.showBanner()
        @JavascriptInterface fun hideBanner() = ads.hideBanner()
        @JavascriptInterface fun showInterstitial() = ads.showInterstitial()
        @JavascriptInterface fun showRewarded() {
            ads.showRewarded { granted ->
                runOnUiThread { webView.evaluateJavascript("window.NativeGame && window.NativeGame.onReward($granted);", null) }
            }
        }
        @JavascriptInterface fun purchaseRemoveAds() {
            runOnUiThread { billing.launchPurchase(this@MainActivity) }
        }
        @JavascriptInterface fun share(text: String) {
            runOnUiThread {
                val i = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }
                startActivity(Intent.createChooser(i, "Share"))
            }
        }
    }

    private fun hideSystemBars() {
        val c = WindowInsetsControllerCompat(window, window.decorView)
        c.hide(WindowInsetsCompat.Type.systemBars())
        c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); if (hasFocus) hideSystemBars() }
    override fun onPause() { super.onPause(); webView.evaluateJavascript("window.NativeGame && window.NativeGame.onPause();", null); webView.onPause() }
    override fun onResume() { super.onResume(); webView.onResume(); webView.evaluateJavascript("window.NativeGame && window.NativeGame.onResume();", null) }
    override fun onDestroy() { ads.destroy(); webView.destroy(); super.onDestroy() }
    @Deprecated("Back handling")
    override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
}
