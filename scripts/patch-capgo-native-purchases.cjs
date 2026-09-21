const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const pnpmStorePath = path.join(workspaceRoot, "node_modules", ".pnpm");
const pluginFileRelativePath = path.join(
  "node_modules",
  "@capgo",
  "native-purchases",
  "android",
  "src",
  "main",
  "java",
  "ee",
  "forgr",
  "nativepurchases",
  "NativePurchasesPlugin.java",
);
const pluginBuildFileRelativePath = path.join(
  "node_modules",
  "@capgo",
  "native-purchases",
  "android",
  "build.gradle",
);
const billingVersion = "9.1.0";

// The shared plugin still declares Billing 8.3.0. Keep its native dependency
// aligned with the Billing version used by every active app after install.

const replacements = [
  {
    find: `import android.content.pm.PackageInfo;`,
    replace: `import android.app.Activity;\nimport android.content.pm.PackageInfo;`,
  },
  {
    find: `    private BillingClient billingClient;`,
    replace: `    private BillingClient billingClient;\n    private final AtomicBoolean purchaseFlowInProgress = new AtomicBoolean(false);`,
  },
  {
    find: `                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())\n                .build();`,
    replace: `                .enableAutoServiceReconnection()\n                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())\n                .build();`,
  },
  {
    find: `                            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {\n                                Log.d(TAG, "Purchase update successful, processing first purchase");\n                                handlePurchase(purchases.get(0), purchaseCall);\n                            } else {\n                                Log.d(TAG, "Purchase update failed or purchases is null");\n                                Log.i(NativePurchasesPlugin.TAG, "onPurchasesUpdated" + billingResult);\n                                if (purchaseCall != null) {\n                                    purchaseCall.reject("Purchase is not purchased");\n                                }\n                            }\n                            closeBillingClient();`,
    replace: `                            if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {\n                                Log.d(TAG, "Purchase update successful, processing first purchase");\n                                handlePurchase(purchases.get(0), purchaseCall);\n                            } else {\n                                Log.d(TAG, "Purchase update failed or purchases is null or empty");\n                                Log.i(NativePurchasesPlugin.TAG, "onPurchasesUpdated" + billingResult);\n                                if (purchaseCall != null) {\n                                    String errorCode = purchases == null || purchases.isEmpty()\n                                        ? "EMPTY_PURCHASE_RESULT"\n                                        : "BILLING_RESPONSE_" + billingResult.getResponseCode();\n                                    purchaseCall.reject("Purchase is not purchased", errorCode);\n                                }\n                            }\n                            purchaseFlowInProgress.set(false);\n                            closeBillingClient();`,
  },
  {
    find: `    private void handlePurchase(Purchase purchase, PluginCall purchaseCall) {\n        Log.d(TAG, "handlePurchase() called");`,
    replace: `    private void handlePurchase(Purchase purchase, PluginCall purchaseCall) {\n        if (purchase == null || purchase.getProducts() == null || purchase.getProducts().isEmpty()) {\n            Log.e(TAG, "Purchase update did not contain a product");\n            if (purchaseCall != null) {\n                purchaseCall.reject("Purchase response did not contain a product", "INVALID_PURCHASE_RESULT");\n            }\n            return;\n        }\n        Log.d(TAG, "handlePurchase() called");`,
  },
  {
    find: `                            if (productType.equals("inapp") && productDetailsItem.getOneTimePurchaseOfferDetails() == null) {\n                                closeBillingClient();\n                                call.reject("No one-time purchase offer available");\n                                return;\n                            }\n`,
    replace: ``,
  },
  {
    find: `                                List<ProductDetails.OneTimePurchaseOfferDetails> oneTimeOffers =\n                                    ProductPayloadMapper.resolveOneTimePurchaseOffers(productDetailsItem);\n                                if (offerToken != null && !offerToken.isEmpty()) {`,
    replace: `                                List<ProductDetails.OneTimePurchaseOfferDetails> oneTimeOffers =\n                                    ProductPayloadMapper.resolveOneTimePurchaseOffers(productDetailsItem);\n                                if (oneTimeOffers.isEmpty()) {\n                                    closeBillingClient();\n                                    call.reject("No one-time purchase offer available");\n                                    return;\n                                }\n                                if (offerToken != null && !offerToken.isEmpty()) {`,
  },
  {
    find: `                                } else if (productDetailsItem.getOneTimePurchaseOfferDetails() == null && !oneTimeOffers.isEmpty()) {\n                                    productDetailsParams.setOfferToken(oneTimeOffers.get(0).getOfferToken());\n                                    Log.d(TAG, "Set default one-time offer token: " + oneTimeOffers.get(0).getOfferToken());\n                                }`,
    replace: `                                } else if (oneTimeOffers.size() > 1 || productDetailsItem.getOneTimePurchaseOfferDetails() == null) {\n                                    productDetailsParams.setOfferToken(oneTimeOffers.get(0).getOfferToken());\n                                    Log.d(TAG, "Set default one-time offer token: " + oneTimeOffers.get(0).getOfferToken());\n                                }`,
  },
  {
    find: `                                assert productDetailsItem.getSubscriptionOfferDetails() != null;\n                                Log.d(TAG, "Available offer details count: " + productDetailsItem.getSubscriptionOfferDetails().size());`,
    replace: `                                if (productDetailsItem.getSubscriptionOfferDetails() == null || productDetailsItem.getSubscriptionOfferDetails().isEmpty()) {\n                                    closeBillingClient();\n                                    call.reject("No subscription offer available");\n                                    return;\n                                }\n                                Log.d(TAG, "Available offer details count: " + productDetailsItem.getSubscriptionOfferDetails().size());`,
  },
  {
    find: `        Log.d(TAG, "Purchase token: " + purchase.getPurchaseToken());`,
    replace: `        Log.d(TAG, "Purchase token present: " + (purchase.getPurchaseToken() != null && !purchase.getPurchaseToken().isEmpty()));`,
  },
  {
    find: `        Log.d(TAG, "acknowledgePurchase() called with token: " + purchaseToken);`,
    replace: `        Log.d(TAG, "acknowledgePurchase() called; token present: " + (purchaseToken != null && !purchaseToken.isEmpty()));`,
  },
  {
    find: `        Log.d(TAG, "Purchase token: " + purchaseToken);`,
    replace: `        Log.d(TAG, "Purchase token present: " + (purchaseToken != null && !purchaseToken.isEmpty()));`,
  },
  {
    find: `            Log.i(NativePurchasesPlugin.TAG, "onConsumeResponse OK " + billingResult + purchaseToken);`,
    replace: `            Log.i(NativePurchasesPlugin.TAG, "onConsumeResponse OK " + billingResult);`,
  },
  {
    find: `            Log.i(NativePurchasesPlugin.TAG, "onConsumeResponse OTHER " + billingResult + purchaseToken);`,
    replace: `            Log.i(NativePurchasesPlugin.TAG, "onConsumeResponse OTHER " + billingResult);`,
  },
  {
    find: `        Log.d(TAG, "Manually acknowledging purchase with token: " + purchaseToken);`,
    replace: `        Log.d(TAG, "Manually acknowledging purchase; token present: " + (purchaseToken != null && !purchaseToken.isEmpty()));`,
  },
  {
    find: `                            call.reject("Failed to acknowledge purchase: " + billingResult.getDebugMessage());`,
    replace: `                            call.reject("Failed to acknowledge purchase (response code " + billingResult.getResponseCode() + "): " + billingResult.getDebugMessage());`,
  },
  {
    find: `                    call.reject("Failed to consume purchase: " + billingResult.getDebugMessage());`,
    replace: `                    call.reject("Failed to consume purchase (response code " + billingResult.getResponseCode() + "): " + billingResult.getDebugMessage());`,
  },
  {
    find: `import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONArray;`,
    replace: `import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;`,
  },
  {
    find: `import java.util.concurrent.atomic.AtomicInteger;

`,
    replace: `import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;

`,
  },
  {
    find: `            AtomicBoolean finished = new AtomicBoolean(false);

            Runnable maybeFinish`,
    replace: `            AtomicBoolean finished = new AtomicBoolean(false);
            AtomicBoolean queryFailed = new AtomicBoolean(false);
            AtomicReference<String> queryFailure = new AtomicReference<>();

            Runnable maybeFinish`,
  },
  {
    find: `\n        AtomicBoolean finished = new AtomicBoolean(false);

        Runnable maybeFinish`,
    replace: `\n        AtomicBoolean finished = new AtomicBoolean(false);
        AtomicBoolean queryFailed = new AtomicBoolean(false);
        AtomicReference<String> queryFailure = new AtomicReference<>();

        Runnable maybeFinish`,
  },
  {
    find: `                if (remaining <= 0 && finished.compareAndSet(false, true)) {
                    JSObject result = new JSObject();
                    result.put("purchases", allPurchases);
                    Log.d(TAG, "Returning " + allPurchases.length() + " purchases");
                    closeBillingClient();
                    call.resolve(result);
                }`,
    replace: `                if (remaining <= 0 && finished.compareAndSet(false, true)) {
                    closeBillingClient();
                    if (queryFailed.get()) {
                        String failure = queryFailure.get();
                        call.reject(failure != null ? failure : "Billing purchases query failed");
                        return;
                    }

                    JSObject result = new JSObject();
                    result.put("purchases", allPurchases);
                    Log.d(TAG, "Returning " + allPurchases.length() + " purchases");
                    call.resolve(result);
                }`,
  },
  {
    find: `            if (remaining <= 0 && finished.compareAndSet(false, true)) {
                JSObject result = new JSObject();
                result.put("purchases", allPurchases);
                Log.d(TAG, "Returning " + allPurchases.length() + " purchases");
                closeBillingClient();
                call.resolve(result);
            }`,
    replace: `            if (remaining <= 0 && finished.compareAndSet(false, true)) {
                closeBillingClient();
                if (queryFailed.get()) {
                    String failure = queryFailure.get();
                    call.reject(failure != null ? failure : "Billing purchases query failed");
                    return;
                }

                JSObject result = new JSObject();
                result.put("purchases", allPurchases);
                Log.d(TAG, "Returning " + allPurchases.length() + " purchases");
                call.resolve(result);
            }`,
  },
  {
    find: `                        } else {
                            Log.d(TAG, "In-app purchase query failed: " + billingResult.getDebugMessage());
                        }
                    } catch (Exception ex) {
                        Log.d(TAG, "Error processing in-app purchase query: " + ex.getMessage());
                    }`,
    replace: `                        } else {
                            int responseCode = billingResult != null ? billingResult.getResponseCode() : -1;
                            String debugMessage = billingResult != null ? billingResult.getDebugMessage() : "missing billing result";
                            queryFailed.set(true);
                            queryFailure.compareAndSet(
                                null,
                                "Billing purchases query failed (response code " + responseCode + "): " + debugMessage
                            );
                        }
                    } catch (Exception ex) {
                        queryFailed.set(true);
                        queryFailure.compareAndSet(null, "Billing purchases query failed while processing in-app results");
                    }`,
  },
  {
    find: `                        } else {
                            Log.d(TAG, "Subscription purchase query failed: " + billingResult.getDebugMessage());
                        }
                    } catch (Exception ex) {
                        Log.d(TAG, "Error processing subscription purchase query: " + ex.getMessage());
                    }`,
    replace: `                        } else {
                            int responseCode = billingResult != null ? billingResult.getResponseCode() : -1;
                            String debugMessage = billingResult != null ? billingResult.getDebugMessage() : "missing billing result";
                            queryFailed.set(true);
                            queryFailure.compareAndSet(
                                null,
                                "Billing purchases query failed (response code " + responseCode + "): " + debugMessage
                            );
                        }
                    } catch (Exception ex) {
                        queryFailed.set(true);
                        queryFailure.compareAndSet(null, "Billing purchases query failed while processing subscription results");
                    }`,
  },
  {
    find: `        Log.d(TAG, "Consuming purchase with token: " + purchaseToken);`,
    replace: `        Log.d(TAG, "Consuming purchase; token present: " + (purchaseToken != null && !purchaseToken.isEmpty()));`,
  },
  {
    find: `                        Log.d(TAG, "Query result: " + billingResult.getResponseCode() + " - " + billingResult.getDebugMessage());
                        Log.d(TAG, "Product details count: " + productDetailsList.size());

                        if (productDetailsList.isEmpty()) {`,
    replace: `                        Log.d(TAG, "Query result: " + billingResult.getResponseCode() + " - " + billingResult.getDebugMessage());
                        Log.d(TAG, "Product details count: " + productDetailsList.size());

                        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            closeBillingClient();
                            call.reject("Billing product query failed: " + billingResult.getDebugMessage());
                            return;
                        }

                        if (productDetailsList.isEmpty()) {`,
  },
  {
    find: `                        for (ProductDetails productDetailsItem : productDetailsList) {
                            Log.d(TAG, "Processing product: " + productDetailsItem.getProductId());
                            BillingFlowParams.ProductDetailsParams.Builder productDetailsParams =`,
    replace: `                        for (ProductDetails productDetailsItem : productDetailsList) {
                            Log.d(TAG, "Processing product: " + productDetailsItem.getProductId());
                            if (productType.equals("inapp") && productDetailsItem.getOneTimePurchaseOfferDetails() == null) {
                                closeBillingClient();
                                call.reject("No one-time purchase offer available");
                                return;
                            }
                            BillingFlowParams.ProductDetailsParams.Builder productDetailsParams =`,
  },
  {
    find: `                        BillingFlowParams billingFlowParams = billingFlowBuilder.build();

                        // Launch the billing flow
                        Log.d(TAG, "Launching billing flow");
                        BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);`,
    replace: `                        BillingFlowParams billingFlowParams = billingFlowBuilder.build();
                        if (billingClient == null || !billingClient.isReady()) {
                            closeBillingClient();
                            call.reject("Billing service disconnected before purchase");
                            return;
                        }

                        // Launch the billing flow
                        Log.d(TAG, "Launching billing flow");
                        BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);`,
  },
  {
    find: `                        Log.i(NativePurchasesPlugin.TAG, "onProductDetailsResponse2" + billingResult2);
                    }`,
    replace: `                        Log.i(NativePurchasesPlugin.TAG, "onProductDetailsResponse2" + billingResult2);
                        if (billingResult2.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            closeBillingClient();
                            call.reject("Billing flow could not be launched: " + billingResult2.getDebugMessage());
                        }
                    }`,
  },
  {
    find: `                        BillingFlowParams billingFlowParams = billingFlowBuilder.build();
                        // Launch the billing flow
                        Log.d(TAG, "Launching billing flow");
                        BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
                        Log.d(
                            TAG,
                            "Billing flow launch result: " + billingResult2.getResponseCode() + " - " + billingResult2.getDebugMessage()
                        );
                        Log.i(NativePurchasesPlugin.TAG, "onProductDetailsResponse2" + billingResult2);
                        if (billingResult2.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                            closeBillingClient();
                            call.reject("Billing flow could not be launched: " + billingResult2.getDebugMessage());
                        }`,
    replace: `                        BillingFlowParams billingFlowParams = billingFlowBuilder.build();
                        getActivity().runOnUiThread(() -> {
                            if (billingClient == null || !billingClient.isReady()) {
                                closeBillingClient();
                                call.reject("Billing service disconnected before purchase");
                                return;
                            }

                            // Google Play Billing requires this call on the app's main thread.
                            Log.d(TAG, "Launching billing flow");
                            BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);
                            Log.d(
                                TAG,
                                "Billing flow launch result: " + billingResult2.getResponseCode() + " - " + billingResult2.getDebugMessage()
                            );
                            Log.i(NativePurchasesPlugin.TAG, "onProductDetailsResponse2" + billingResult2);
                            if (billingResult2.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                                closeBillingClient();
                                call.reject("Billing flow could not be launched: " + billingResult2.getDebugMessage());
                            }
                        });`,
  },
];

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, "utf8");
  let current = original.replaceAll("\r\n", "\n");
  let changed = false;

  const duplicateGuards = [
    {
      pattern: /(\s+if \(productType\.equals\("inapp"\) && productDetailsItem\.getOneTimePurchaseOfferDetails\(\) == null\) \{\s+closeBillingClient\(\);\s+call\.reject\("No one-time purchase offer available"\);\s+return;\s+\})\s+\1/g,
      replacement: "$1",
    },
    {
      pattern: /(\s+if \(billingClient == null \|\| !billingClient\.isReady\(\) \{\s+closeBillingClient\(\);\s+call\.reject\("Billing service disconnected before purchase"\);\s+return;\s+\})\s+\1/g,
      replacement: "$1",
    },
    {
      pattern: /import java\.util\.concurrent\.atomic\.AtomicInteger;\n(?:import java\.util\.concurrent\.atomic\.AtomicReference;\n)+(?:import org\.json\.JSONArray;\n)*/g,
      replacement: `import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
`,
    },
    {
      pattern: /(\n {8,12}AtomicBoolean queryFailed = new AtomicBoolean\(false\);\n {8,12}AtomicReference<String> queryFailure = new AtomicReference<>\(\);)(?:\n {8,12}AtomicBoolean queryFailed = new AtomicBoolean\(false\);\n {8,12}AtomicReference<String> queryFailure = new AtomicReference<>\(\);)+/g,
      replacement: "$1",
    },
  ];

  for (const duplicateGuard of duplicateGuards) {
    const normalized = current.replace(duplicateGuard.pattern, duplicateGuard.replacement);
    if (normalized !== current) {
      current = normalized;
      changed = true;
    }
  }

  for (const replacement of replacements) {
    if (
      !current.includes(replacement.find) ||
      (replacement.replace.length > 0 && current.includes(replacement.replace))
    ) {
      continue;
    }

    current = current.replaceAll(replacement.find, replacement.replace);
    changed = true;
  }

  const billingResponseCodeWithoutHelper = "billingResponseCodeName(billingResult.getResponseCode())";
  if (current.includes(billingResponseCodeWithoutHelper)) {
    current = current.replaceAll(
      billingResponseCodeWithoutHelper,
      "\"BILLING_RESPONSE_\" + billingResult.getResponseCode()",
    );
    changed = true;
  }

  const activityGuard = [
    "    private boolean isActivityReadyForBilling(Activity activity) {",
    "        if (activity == null || activity.isFinishing()) {",
    "            return false;",
    "        }",
    "        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed()) {",
    "            return false;",
    "        }",
    "        return activity.hasWindowFocus();",
    "    }",
    "",
  ].join("\n");
  if (!current.includes("private boolean isActivityReadyForBilling(Activity activity)")) {
    const handlePurchaseMarker = "    private void handlePurchase(Purchase purchase, PluginCall purchaseCall) {";
    if (current.includes(handlePurchaseMarker)) {
      current = current.replace(handlePurchaseMarker, activityGuard + handlePurchaseMarker);
      changed = true;
    }
  }

  const oldPurchaseLaunch = [
    "                        BillingFlowParams billingFlowParams = billingFlowBuilder.build();",
    "                        getActivity().runOnUiThread(() -> {",
    "                            if (billingClient == null || !billingClient.isReady()) {",
    "                                closeBillingClient();",
    "                                call.reject(\"Billing service disconnected before purchase\");",
    "                                return;",
    "                            }",
    "",
    "                            // Google Play Billing requires this call on the app's main thread.",
    "                            Log.d(TAG, \"Launching billing flow\");",
    "                            BillingResult billingResult2 = billingClient.launchBillingFlow(getActivity(), billingFlowParams);",
    "                            Log.d(",
    "                                TAG,",
    "                                \"Billing flow launch result: \" + billingResult2.getResponseCode() + \" - \" + billingResult2.getDebugMessage()",
    "                            );",
    "                            Log.i(NativePurchasesPlugin.TAG, \"onProductDetailsResponse2\" + billingResult2);",
    "                            if (billingResult2.getResponseCode() != BillingClient.BillingResponseCode.OK) {",
    "                                closeBillingClient();",
    "                                call.reject(\"Billing flow could not be launched: \" + billingResult2.getDebugMessage());",
    "                            }",
    "                        });",
  ].join("\n");
  const newPurchaseLaunch = [
    "                        BillingFlowParams billingFlowParams = billingFlowBuilder.build();",
    "                        Activity activity = getActivity();",
    "                        if (!isActivityReadyForBilling(activity)) {",
    "                            closeBillingClient();",
    "                            call.reject(\"Billing activity is not in the foreground\", \"BILLING_ACTIVITY_UNAVAILABLE\");",
    "                            return;",
    "                        }",
    "                        activity.runOnUiThread(() -> {",
    "                            if (!isActivityReadyForBilling(activity) || billingClient == null || !billingClient.isReady()) {",
    "                                closeBillingClient();",
    "                                call.reject(\"Billing service is not ready for purchase\", \"BILLING_FLOW_UNAVAILABLE\");",
    "                                return;",
    "                            }",
    "                            if (!purchaseFlowInProgress.compareAndSet(false, true)) {",
    "                                closeBillingClient();",
    "                                call.reject(\"Another purchase is already in progress\", \"PURCHASE_IN_PROGRESS\");",
    "                                return;",
    "                            }",
    "",
    "                            Log.d(TAG, \"Launching billing flow\");",
    "                            BillingResult billingResult2;",
    "                            try {",
    "                                billingResult2 = billingClient.launchBillingFlow(activity, billingFlowParams);",
    "                            } catch (RuntimeException error) {",
    "                                purchaseFlowInProgress.set(false);",
    "                                closeBillingClient();",
    "                                Log.e(TAG, \"Billing flow threw before launch: \" + error.getMessage());",
    "                                call.reject(\"Billing flow could not be launched\", \"BILLING_FLOW_EXCEPTION\");",
    "                                return;",
    "                            }",
    "                            Log.d(",
    "                                TAG,",
    "                                \"Billing flow launch result: \" + (billingResult2 != null ? billingResult2.getResponseCode() : \"null\") +",
    "                                    \" - \" + (billingResult2 != null ? billingResult2.getDebugMessage() : \"missing billing result\")",
    "                            );",
    "                            Log.i(NativePurchasesPlugin.TAG, \"onProductDetailsResponse2\" + billingResult2);",
    "                            if (billingResult2 == null || billingResult2.getResponseCode() != BillingClient.BillingResponseCode.OK) {",
    "                                purchaseFlowInProgress.set(false);",
    "                                closeBillingClient();",
    "                                String debugMessage = billingResult2 != null ? billingResult2.getDebugMessage() : \"missing billing result\";",
    "                                call.reject(\"Billing flow could not be launched: \" + debugMessage, \"BILLING_FLOW_REJECTED\");",
    "                            }",
    "                        });",
  ].join("\n");
  if (current.includes(oldPurchaseLaunch)) {
    current = current.replace(oldPurchaseLaunch, newPurchaseLaunch);
    changed = true;
  }

  const obsoleteOneTimeOfferGuard = /\n\s+if \(productType\.equals\("inapp"\) && productDetailsItem\.getOneTimePurchaseOfferDetails\(\) == null\) \{\s+closeBillingClient\(\);\s+call\.reject\("No one-time purchase offer available"\);\s+return;\s+\}\n/;
  const withoutObsoleteOneTimeOfferGuard = current.replace(obsoleteOneTimeOfferGuard, "\n");
  if (withoutObsoleteOneTimeOfferGuard !== current) {
    current = withoutObsoleteOneTimeOfferGuard;
    changed = true;
  }

  if (changed) {
    try {
      fs.writeFileSync(filePath, current, "utf8");
    } catch (error) {
      console.warn(
        `[patch-capgo-native-purchases] could not patch ${filePath}: ${error.code ?? "unknown error"}`,
      );
      return false;
    }
  }

  return changed;
}

function patchBillingVersion(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, "utf8");
  const find = '    def billing_version = "8.3.0"';
  const replace = `    def billing_version = "${billingVersion}"`;
  if (!original.includes(find) || original.includes(replace)) {
    return false;
  }

  fs.writeFileSync(filePath, original.replace(find, replace), "utf8");
  return true;
}

function main() {
  const candidates = [path.join(workspaceRoot, pluginFileRelativePath)];
  const buildCandidates = [path.join(workspaceRoot, pluginBuildFileRelativePath)];

  if (fs.existsSync(pnpmStorePath)) {
    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@capgo+native-purchases@")) {
        continue;
      }

      candidates.push(path.join(pnpmStorePath, entry.name, pluginFileRelativePath));
      buildCandidates.push(path.join(pnpmStorePath, entry.name, pluginBuildFileRelativePath));
    }
  }

  const uniqueCandidates = [...new Set(candidates.map((candidate) => {
    try {
      return fs.realpathSync(candidate);
    } catch {
      return candidate;
    }
  }))];
  const uniqueBuildCandidates = [...new Set(buildCandidates.map((candidate) => {
    try {
      return fs.realpathSync(candidate);
    } catch {
      return candidate;
    }
  }))];
  const patchedCount =
    uniqueCandidates.filter(patchFile).length +
    uniqueBuildCandidates.filter(patchBillingVersion).length;
  console.log(
    patchedCount > 0
      ? `[patch-capgo-native-purchases] patched ${patchedCount} file(s)`
      : "[patch-capgo-native-purchases] no changes needed",
  );
}

main();
