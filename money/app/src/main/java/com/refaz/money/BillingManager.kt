package com.refaz.money

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.*

/**
 * Google Play Billing wrapper for the "Streak Pro" SUBSCRIPTION.
 * Restores an active subscription on launch, exposes monthly/yearly prices,
 * and reports Pro status via onProChanged.
 */
class BillingManager(
    private val context: Context,
    private val onProChanged: (Boolean) -> Unit,
    private val onPrices: (String, String) -> Unit
) : PurchasesUpdatedListener, BillingClientStateListener {

    private val prefs = context.getSharedPreferences("money_prefs", Context.MODE_PRIVATE)
    private var details: ProductDetails? = null

    private val client: BillingClient = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()

    var isPro: Boolean
        get() = prefs.getBoolean("is_pro", false)
        private set(v) { prefs.edit().putBoolean("is_pro", v).apply(); onProChanged(v) }

    fun start() { onProChanged(isPro); client.startConnection(this) }

    override fun onBillingSetupFinished(r: BillingResult) {
        if (r.responseCode == BillingClient.BillingResponseCode.OK) { queryProduct(); restore() }
    }
    override fun onBillingServiceDisconnected() { client.startConnection(this) }

    private fun queryProduct() {
        val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(AdConfig.SUB_PRODUCT)
                .setProductType(BillingClient.ProductType.SUBS).build()
        )).build()
        client.queryProductDetailsAsync(params) { res, list ->
            if (res.responseCode == BillingClient.BillingResponseCode.OK && list.isNotEmpty()) {
                details = list[0]
                val mon = priceFor(AdConfig.PLAN_MONTHLY)
                val yr = priceFor(AdConfig.PLAN_YEARLY)
                onPrices(mon ?: "Monthly", yr ?: "Yearly")
            }
        }
    }

    private fun priceFor(basePlan: String): String? {
        val offer = details?.subscriptionOfferDetails?.firstOrNull { it.basePlanId == basePlan } ?: return null
        return offer.pricingPhases.pricingPhaseList.firstOrNull()?.formattedPrice
    }

    /** plan = "monthly" or "yearly" */
    fun subscribe(activity: Activity, plan: String) {
        val d = details ?: run { queryProduct(); return }
        val offer = d.subscriptionOfferDetails?.firstOrNull { it.basePlanId == plan }
            ?: d.subscriptionOfferDetails?.firstOrNull() ?: return
        val pp = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(d).setOfferToken(offer.offerToken).build()
        client.launchBillingFlow(activity,
            BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(pp)).build())
    }

    fun restore() {
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        client.queryPurchasesAsync(params) { res, purchases ->
            if (res.responseCode == BillingClient.BillingResponseCode.OK) {
                val active = purchases.any { it.products.contains(AdConfig.SUB_PRODUCT) &&
                        it.purchaseState == Purchase.PurchaseState.PURCHASED }
                purchases.forEach { ack(it) }
                if (isPro != active) isPro = active
            }
        }
    }

    override fun onPurchasesUpdated(r: BillingResult, purchases: MutableList<Purchase>?) {
        if (r.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            purchases.forEach { ack(it) }
            if (purchases.any { it.products.contains(AdConfig.SUB_PRODUCT) &&
                    it.purchaseState == Purchase.PurchaseState.PURCHASED }) {
                if (!isPro) isPro = true
            }
        }
    }

    private fun ack(p: Purchase) {
        if (p.purchaseState == Purchase.PurchaseState.PURCHASED && !p.isAcknowledged) {
            client.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.purchaseToken).build()) { }
        }
    }
}
