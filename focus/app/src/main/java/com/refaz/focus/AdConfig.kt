package com.refaz.focus

/**
 * THE ONLY FILE YOU EDIT FOR MONETIZATION.
 * Ships with Google's official TEST ad ids (safe). For real income: create AdMob
 * units, paste ids, set USE_TEST_ADS=false, and set the real App ID in
 * app/build.gradle.kts (manifestPlaceholders["admobAppId"]).
 *
 * SUBSCRIPTION: in Play Console create a subscription with id = SUB_PRODUCT
 * ("focus_pro") and two base plans with ids "monthly" and "yearly".
 */
object AdConfig {
    const val USE_TEST_ADS = true

    private const val TEST_BANNER = "ca-app-pub-3940256099942544/6300978111"
    private const val TEST_INTERSTITIAL = "ca-app-pub-3940256099942544/1033173712"

    private const val REAL_BANNER = "ca-app-pub-0000000000000000/0000000000"
    private const val REAL_INTERSTITIAL = "ca-app-pub-0000000000000000/0000000000"
    private const val TEST_REWARDED = "ca-app-pub-3940256099942544/5224354917"
    private const val REAL_REWARDED = "ca-app-pub-0000000000000000/0000000000"

    val bannerId get() = if (USE_TEST_ADS) TEST_BANNER else REAL_BANNER
    val interstitialId get() = if (USE_TEST_ADS) TEST_INTERSTITIAL else REAL_INTERSTITIAL
    val rewardedId get() = if (USE_TEST_ADS) TEST_REWARDED else REAL_REWARDED

    const val SUB_PRODUCT = "focus_pro"
    const val PLAN_MONTHLY = "monthly"
    const val PLAN_YEARLY = "yearly"
}
