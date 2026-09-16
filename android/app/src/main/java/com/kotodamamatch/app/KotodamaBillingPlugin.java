package com.kotodamamatch.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import com.android.billingclient.api.*;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

/** A single non-consumable full-game purchase. Never consumes or auto-purchases. */
@CapacitorPlugin(name = "KotodamaBilling")
public class KotodamaBillingPlugin extends Plugin {
    static final String PRODUCT = "kotodama_full_game";
    private static final String PUBLIC_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu29OxqMkDEBOlwkGHy8FYSvWIK435UqTTtkSyCUo8dwEl3N5Iw1jAaTg10SGlmb9PVc3pWLL5PlyLmKUgC5plCWhc0EzOUAwq6dFVqe6qtJQKyUaXPRLWePC4LNnK35ec+vLCSH0SohN1ehE055r3Te2XhYki+kiIvnx3ewLepQjMP9MDI3i2D7doOV+9KZeRS1vqgei11E4FCIwMIR8P7RyQW013hdsz6mCqlXK77oY4RHjlusjecxtHDOH0nEKSJNvBfiiDrVvaoPgtJZBdVK9s5oxiKJujyhSyaruordjTscueIduJ6cbMOhJd74rZnUVBhL712VmDCyzZ6+YLQIDAQAB";
    private BillingClient client;
    private SharedPreferences receipts;
    private boolean owned;
    private boolean pending;
    private boolean connecting;
    private boolean purchaseInFlight;
    private String price = "";
    private String message = "";
    private final List<Runnable> waiting = new ArrayList<>();
    private final Set<String> acknowledgedThisSession = new HashSet<>();
    private final BillingRefreshEpoch refreshEpoch = new BillingRefreshEpoch();

    @Override public void load() {
        receipts = getContext().getSharedPreferences("kotodama_play_receipt", Context.MODE_PRIVATE);
        try {
            Purchase cached = new Purchase(receipts.getString("data", ""), receipts.getString("signature", ""));
            owned = valid(cached) && cached.isAcknowledged();
        } catch (Exception ignored) { owned = false; }
        client = BillingClient.newBuilder(getContext()).setListener((result, purchases) -> main(() -> {
            purchaseInFlight = false;
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                boolean handled = false;
                if (purchases != null) for (Purchase purchase : purchases) {
                    if (valid(purchase)) {
                        completePurchase(purchase, null, refreshEpoch.begin());
                        handled = true; break;
                    }
                }
                // Callback lists are partial; only a full query may revoke ownership.
                if (!handled) refresh(null);
            } else if (result.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
                refresh(null);
            } else {
                message = result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED
                    ? "購入をキャンセルしました。料金は発生していません。" : "購入を完了できませんでした。Google Playを確認して再試行してください。";
                emit();
            }
        })).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
          .enableAutoServiceReconnection().build();
    }

    private void main(Runnable action) { getActivity().runOnUiThread(action); }
    private boolean valid(Purchase p) {
        try { return p.getPurchaseState() == Purchase.PurchaseState.PURCHASED
            && p.getProducts().contains(PRODUCT)
            && getContext().getPackageName().equals(p.getPackageName())
            && PlayPurchaseVerifier.verify(Base64.decode(PUBLIC_KEY, Base64.DEFAULT), p.getOriginalJson(), Base64.decode(p.getSignature(), Base64.DEFAULT));
        } catch (IllegalArgumentException invalidEncoding) { return false; }
    }
    private JSObject state() {
        JSObject out = new JSObject();
        out.put("owned", owned); out.put("pending", pending);
        out.put("price", price); out.put("message", message);
        out.put("productId", PRODUCT); out.put("busy", purchaseInFlight);
        return out;
    }
    private void emit() { notifyListeners("purchaseState", state()); }
    private void connected(Runnable action) {
        if (client.isReady()) { action.run(); return; }
        waiting.add(action);
        if (connecting) return;
        connecting = true;
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) { main(() -> {
                connecting = false;
                List<Runnable> queued = new ArrayList<>(waiting); waiting.clear();
                // Callers receive a normal error result from the Billing API if setup failed.
                for (Runnable next : queued) next.run();
            }); }
            @Override public void onBillingServiceDisconnected() { }
        });
    }

    @PluginMethod public void getStatus(PluginCall call) { main(() -> {
        // Expose only the locally signature-verified, acknowledged receipt immediately.
        // Offline owners must not wait for a network connection to start the game.
        call.resolve(state());
        connected(() -> refresh(null));
    }); }
    @PluginMethod public void restore(PluginCall call) { main(() -> connected(() -> refresh(call))); }

    private void refresh(PluginCall call) {
        final long epoch = refreshEpoch.begin();
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> main(() -> {
                if (!refreshEpoch.accepts(epoch)) { if (call != null) call.resolve(state()); return; }
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    message = "Google Playに接続できません。通信を確認して「購入を復元・再確認」を押してください。";
                    if (call != null) call.resolve(state()); emit(); return;
                }
                pending = false;
                Purchase found = null;
                for (Purchase p : purchases) {
                    if (!p.getProducts().contains(PRODUCT)) continue;
                    if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
                    if (valid(p)) found = p;
                }
                if (found == null) {
                    owned = false; receipts.edit().clear().apply();
                    message = pending ? "お支払いの完了を待っています。再購入せず、完了後に再確認してください。" : "";
                    if (call != null) call.resolve(state()); emit(); return;
                }
                completePurchase(found, call, epoch);
            }));
    }
    private void completePurchase(Purchase purchase, PluginCall call, long epoch) {
        if (purchase.isAcknowledged() || acknowledgedThisSession.contains(purchase.getPurchaseToken())) {
            grant(purchase); if (call != null) call.resolve(state()); return;
        }
        client.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
            acknowledgement -> main(() -> {
                if (!refreshEpoch.accepts(epoch)) { if (call != null) call.resolve(state()); return; }
                if (acknowledgement.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    acknowledgedThisSession.add(purchase.getPurchaseToken());
                    grant(purchase);
                    // One bounded refresh obtains the acknowledged offline receipt.
                    refresh(call);
                } else {
                    message = "購入の確認処理が完了していません。再購入せず、通信を確認して復元してください。";
                    if (call != null) call.resolve(state()); emit();
                }
            }));
    }
    private void grant(Purchase p) {
        receipts.edit().putString("data", p.getOriginalJson()).putString("signature", p.getSignature()).apply();
        owned = true; pending = false; message = ""; emit();
    }
    @PluginMethod public void getProduct(PluginCall call) { main(() -> connected(() -> queryProduct(call, false))); }
    @PluginMethod public void purchase(PluginCall call) { main(() -> {
        if (owned || pending || purchaseInFlight) { call.reject("購入済み、支払い保留中、または購入処理中です。復元・再確認してください。"); return; }
        purchaseInFlight = true;
        connected(() -> queryProduct(call, true));
    }); }
    private void queryProduct(PluginCall call, boolean launch) {
        QueryProductDetailsParams.Product item = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRODUCT).setProductType(BillingClient.ProductType.INAPP).build();
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(item)).build(),
            (result, details) -> main(() -> {
                List<ProductDetails> products = details.getProductDetailsList();
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || products.isEmpty()) {
                    if (launch) purchaseInFlight = false;
                    call.reject("購入商品を取得できません。Google Play版で通信を確認してください。"); emit(); return;
                }
                ProductDetails product = products.get(0);
                ProductDetails.OneTimePurchaseOfferDetails offer = product.getOneTimePurchaseOfferDetails();
                if (offer == null) { if (launch) purchaseInFlight = false; call.reject("購入できる商品がありません。"); return; }
                price = offer.getFormattedPrice();
                if (!launch) { call.resolve(state()); return; }
                BillingFlowParams.ProductDetailsParams params = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(product).setOfferToken(offer.getOfferToken()).build();
                BillingResult launched = client.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(params)).build());
                if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    purchaseInFlight = false; call.reject("Google Playの購入画面を開けませんでした。"); emit();
                } else { emit(); JSObject out = new JSObject(); out.put("launched", true); call.resolve(out); }
            }));
    }
    @Override protected void handleOnResume() {
        if (client != null) main(() -> connected(() -> refresh(null)));
    }
    @Override protected void handleOnDestroy() {
        if (client != null) client.endConnection();
        waiting.clear();
    }
}
