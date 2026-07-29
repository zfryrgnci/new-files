package com.refaz.money

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
import com.google.android.gms.ads.MobileAds
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

class MainActivity : android.app.Activity() {

    private lateinit var webView: WebView
    private lateinit var ads: AdsManager
    private lateinit var billing: BillingManager
    private lateinit var consent: ConsentInformation
    @Volatile private var adsInit = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, true)

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        webView = WebView(this)
        val banner = FrameLayout(this)
        root.addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        root.addView(banner, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(root)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        ads = AdsManager(this, banner)
        billing = BillingManager(applicationContext,
            onProChanged = { pro -> runOnUiThread {
                ads.adsRemoved = pro
                webView.evaluateJavascript("window.NativeGame && window.NativeGame.onProChanged($pro);", null)
            } },
            onPrices = { mon, yr -> runOnUiThread {
                webView.evaluateJavascript(
                    "window.NativeGame && window.NativeGame.onPrices(${jsStr(mon)}, ${jsStr(yr)});", null)
            } })

        webView.addJavascriptInterface(Bridge(), "AndroidBridge")
        webView.loadUrl("file:///android_asset/game/index.html")

        billing.start()
        consentThenAds()
    }

    private fun jsStr(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    private fun consentThenAds() {
        consent = UserMessagingPlatform.getConsentInformation(this)
        consent.requestConsentInfoUpdate(this, ConsentRequestParameters.Builder().build(), {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) { initAds() }
        }, { initAds() })
        if (consent.canRequestAds()) initAds()
    }
    private fun initAds() {
        if (adsInit) return; adsInit = true
        MobileAds.initialize(this) { runOnUiThread { ads.adsRemoved = billing.isPro; ads.start() } }
    }

    inner class Bridge {
        @JavascriptInterface fun isPro(): String = billing.isPro.toString()
        @JavascriptInterface fun showBanner() = ads.showBanner()
        @JavascriptInterface fun hideBanner() = ads.hideBanner()
        @JavascriptInterface fun showInterstitial() = ads.showInterstitial()
        @JavascriptInterface fun subscribe(plan: String) { runOnUiThread { billing.subscribe(this@MainActivity, plan) } }
        @JavascriptInterface fun restore() { runOnUiThread { billing.restore() } }
        @JavascriptInterface fun share(text: String) {
            runOnUiThread {
                val i = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }
                startActivity(Intent.createChooser(i, "Share"))
            }
        }
    }

    override fun onPause() { super.onPause(); webView.onPause() }
    override fun onResume() { super.onResume(); webView.onResume(); billing.restore() }
    override fun onDestroy() { ads.destroy(); webView.destroy(); super.onDestroy() }
    @Deprecated("Back")
    override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
}
