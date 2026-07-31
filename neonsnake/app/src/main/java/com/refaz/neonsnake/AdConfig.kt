package com.refaz.neonsnake

/**
 * THE ONLY FILE YOU EDIT FOR MONETIZATION.
 * Ships with Google's official TEST ad ids (safe, no ban risk). To earn real
 * money: create an AdMob account, make Banner/Interstitial/Rewarded units,
 * paste the ids below, set USE_TEST_ADS=false, and set the real App ID in
 * app/build.gradle.kts (manifestPlaceholders["admobAppId"]).
 */
object AdConfig {
    const val USE_TEST_ADS = true

    private const val TEST_BANNER = "ca-app-pub-3940256099942544/6300978111"
    private const val TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712"
    private const val TEST_REWARDED = "ca-app-pub-3940256099942544/5224354917"

    private const val REAL_BANNER = "ca-app-pub-8054232338509216/5302367489"
    private const val REAL_INTERSTITIAL = "ca-app-pub-8054232338509216/1361122476"
    private const val REAL_REWARDED = "ca-app-pub-8054232338509216/8815785244"

    val bannerId get() = if (USE_TEST_ADS) TEST_BANNER else REAL_BANNER
    val interstitialId get() = if (USE_TEST_ADS) TEST_INTERSTITIAL else REAL_INTERSTITIAL
    val rewardedId get() = if (USE_TEST_ADS) TEST_REWARDED else REAL_REWARDED

    const val REMOVE_ADS_SKU = "remove_ads"
}
