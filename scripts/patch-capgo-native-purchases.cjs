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

const replacements = [
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
];

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const original = fs.readFileSync(filePath, "utf8");
  let current = original.replaceAll("\r\n", "\n");
  let changed = false;

  const duplicateGuards = [
    /(\s+if \(productType\.equals\("inapp"\) && productDetailsItem\.getOneTimePurchaseOfferDetails\(\) == null\) \{\s+closeBillingClient\(\);\s+call\.reject\("No one-time purchase offer available"\);\s+return;\s+\})\s+\1/g,
    /(\s+if \(billingClient == null \|\| !billingClient\.isReady\(\) \{\s+closeBillingClient\(\);\s+call\.reject\("Billing service disconnected before purchase"\);\s+return;\s+\})\s+\1/g,
  ];

  for (const duplicateGuard of duplicateGuards) {
    const normalized = current.replace(duplicateGuard, "$1");
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
    fs.writeFileSync(filePath, current, "utf8");
  }

  return changed;
}

function main() {
  const candidates = [path.join(workspaceRoot, pluginFileRelativePath)];

  if (fs.existsSync(pnpmStorePath)) {
    for (const entry of fs.readdirSync(pnpmStorePath, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("@capgo+native-purchases@")) {
        continue;
      }

      candidates.push(path.join(pnpmStorePath, entry.name, pluginFileRelativePath));
    }
  }

  const uniqueCandidates = [...new Set(candidates.map((candidate) => {
    try {
      return fs.realpathSync(candidate);
    } catch {
      return candidate;
    }
  }))];
  const patchedCount = uniqueCandidates.filter(patchFile).length;
  console.log(
    patchedCount > 0
      ? `[patch-capgo-native-purchases] patched ${patchedCount} file(s)`
      : "[patch-capgo-native-purchases] no changes needed",
  );
}

main();
