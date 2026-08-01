package com.refaz.neonsnake

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.*

class BillingManager(private val context: Context, private val onEntitlementChanged: (Boolean) -> Unit)
    : PurchasesUpdatedListener, BillingClientStateListener {

    private val prefs = context.getSharedPreferences("game_prefs", Context.MODE_PRIVATE)
    private var productDetails: ProductDetails? = null
    private val billingClient: BillingClient = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()

    var adsRemoved: Boolean
        get() = prefs.getBoolean("ads_removed", false)
        private set(value) { prefs.edit().putBoolean("ads_removed", value).apply(); onEntitlementChanged(value) }

    fun start() { onEntitlementChanged(adsRemoved); billingClient.startConnection(this) }

    override fun onBillingSetupFinished(result: BillingResult) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK) { queryProduct(); restorePurchases() }
    }
    override fun onBillingServiceDisconnected() { billingClient.startConnection(this) }

    private fun queryProduct() {
        val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(AdConfig.REMOVE_ADS_SKU)
                .setProductType(BillingClient.ProductType.INAPP).build()
        )).build()
        billingClient.queryProductDetailsAsync(params) { result, queryResult ->
            val list = queryResult.productDetailsList
            if (result.responseCode == BillingClient.BillingResponseCode.OK && list.isNotEmpty()) productDetails = list[0]
        }
    }
    fun launchPurchase(activity: Activity) {
        val details = productDetails ?: run { queryProduct(); return }
        val pp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build()
        billingClient.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(pp)).build())
    }
    fun restorePurchases() {
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) for (p in purchases)
                if (p.products.contains(AdConfig.REMOVE_ADS_SKU)) handlePurchase(p)
        }
    }
    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) for (p in purchases) handlePurchase(p)
    }
    private fun handlePurchase(purchase: Purchase) {
        if (!purchase.products.contains(AdConfig.REMOVE_ADS_SKU)) return
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            if (!purchase.isAcknowledged) {
                billingClient.acknowledgePurchase(
                    AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()) { }
            }
            if (!adsRemoved) adsRemoved = true
        }
    }
}
