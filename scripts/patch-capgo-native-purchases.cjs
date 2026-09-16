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
    if (!current.includes(replacement.find)) {
      continue;
    }

    current = current.replaceAll(replacement.find, replacement.replace);
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
