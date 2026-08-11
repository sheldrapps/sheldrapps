package com.sheldrapps.pdfmergerandsplitter;

import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import com.getcapacitor.BridgeActivity;
import com.sheldrapps.plugins.pdfrewrite.PdfRewritePlugin;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

public class MainActivity extends BridgeActivity {
    private static final String LOG_TAG = "PMAS.Lifecycle";
    private static final String PROCESS_SESSION_ID = UUID.randomUUID().toString();
    private static final String ALIAS_PREFIX = "com.sheldrapps.pdfmergerandsplitter.MainActivityAlias_";
    private static final String DEFAULT_ALIAS_LOCALE = "system";
    private static final List<String> ALL_ALIAS_LOCALES = Arrays.asList(
        "system", "en-US", "es-MX", "de-DE", "fr-FR", "it-IT", "pt-BR",
        "zh-TW", "hi-IN", "ar-SA", "ja-JP", "ko-KR", "zh-CN", "ru-RU"
    );
    private final String instanceId = UUID.randomUUID().toString();
    private boolean runtimeFlagsExposed;

    private final class RuntimeBridge {
        @JavascriptInterface public boolean isDebugBuild() { return isDebugBuildEnabled(); }
        @JavascriptInterface public String getLifecycleSessionId() { return PROCESS_SESSION_ID; }
        @JavascriptInterface public String getLifecycleInstanceId() { return instanceId; }
        @JavascriptInterface public void log(String message) { Log.i(LOG_TAG, message); }
    }

    private final class AppControlBridge {
        @JavascriptInterface public void restartApp() { runOnUiThread(MainActivity.this::relaunchApp); }
        @JavascriptInterface public void restartForLocale(String localeTag) {
            runOnUiThread(() -> relaunchAppForAliasLocale(setActiveLauncherAliasLocale(localeTag)));
        }
    }

    private final class LauncherAliasBridge {
        @JavascriptInterface public void setActiveLocale(String localeTag) {
            runOnUiThread(() -> setActiveLauncherAliasLocale(localeTag));
        }
    }

    @Override protected void onCreate(Bundle state) {
        registerPlugin(PdfRewritePlugin.class);
        logLifecycle("onCreate");
        super.onCreate(state);
        normalizeWebViewTextZoom();
        exposeRuntimeFlags();
        forceSoftInputAdjustNothing();
    }

    @Override public void onStart() { super.onStart(); exposeRuntimeFlags(); }
    @Override public void onResume() { super.onResume(); exposeRuntimeFlags(); }

    private boolean isDebugBuildEnabled() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private void logLifecycle(String event) {
        if (isDebugBuildEnabled()) Log.d(LOG_TAG, "session=" + PROCESS_SESSION_ID + " " + event);
    }

    private void exposeRuntimeFlags() {
        if (runtimeFlagsExposed || bridge == null || bridge.getWebView() == null) return;
        bridge.getWebView().addJavascriptInterface(new RuntimeBridge(), "SheldrappsRuntime");
        bridge.getWebView().addJavascriptInterface(new AppControlBridge(), "SheldrappsAppControl");
        bridge.getWebView().addJavascriptInterface(new LauncherAliasBridge(), "SheldrappsLauncherAlias");
        runtimeFlagsExposed = true;
    }

    private void normalizeWebViewTextZoom() {
        if (bridge != null && bridge.getWebView() != null) bridge.getWebView().getSettings().setTextZoom(100);
    }

    private void forceSoftInputAdjustNothing() {
        int state = getWindow().getAttributes().softInputMode & WindowManager.LayoutParams.SOFT_INPUT_MASK_STATE;
        getWindow().setSoftInputMode(state | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
    }

    private void relaunchApp() {
        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent == null) intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        Runtime.getRuntime().exit(0);
    }

    private void relaunchAppForAliasLocale(String locale) {
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.setComponent(buildAliasComponentName(resolveAliasLocale(locale)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        try { startActivity(intent); } catch (Exception ignored) { relaunchApp(); return; }
        Runtime.getRuntime().exit(0);
    }

    private String setActiveLauncherAliasLocale(String localeTag) {
        String target = resolveAliasLocale(localeTag);
        PackageManager manager = getPackageManager();
        String packageName = getPackageName();

        if (isAliasEnabled(manager, packageName, target)) {
            return target;
        }

        for (String locale : ALL_ALIAS_LOCALES) {
            ComponentName component = new ComponentName(packageName, ALIAS_PREFIX + localeToAliasSuffix(locale));
            int state = locale.equals(target)
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            manager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP);
        }
        return target;
    }

    private boolean isAliasEnabled(PackageManager manager, String packageName, String locale) {
        ComponentName component = new ComponentName(packageName, ALIAS_PREFIX + localeToAliasSuffix(locale));
        int state = manager.getComponentEnabledSetting(component);
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && isManifestAliasEnabled(manager, component));
    }

    private boolean isManifestAliasEnabled(PackageManager manager, ComponentName component) {
        try {
            return manager.getActivityInfo(component, PackageManager.GET_META_DATA).enabled;
        } catch (PackageManager.NameNotFoundException ignored) {
            return false;
        }
    }

    private String resolveAliasLocale(String localeTag) {
        if (localeTag == null || localeTag.trim().isEmpty()) return DEFAULT_ALIAS_LOCALE;
        String normalized = localeTag.trim().replace('_', '-');
        if ("system".equalsIgnoreCase(normalized)) return DEFAULT_ALIAS_LOCALE;
        for (String locale : ALL_ALIAS_LOCALES) if (locale.equalsIgnoreCase(normalized)) return locale;
        String language = normalized.split("-", 2)[0].toLowerCase();
        switch (language) {
            case "es": return "es-MX";
            case "de": return "de-DE";
            case "fr": return "fr-FR";
            case "it": return "it-IT";
            case "pt": return "pt-BR";
            case "zh": return normalized.toLowerCase().endsWith("-cn") ? "zh-CN" : "zh-TW";
            case "hi": return "hi-IN";
            case "ar": return "ar-SA";
            case "ja": return "ja-JP";
            case "ko": return "ko-KR";
            case "ru": return "ru-RU";
            default: return "en-US";
        }
    }

    private String localeToAliasSuffix(String locale) { return locale.replace('-', '_'); }

    private ComponentName buildAliasComponentName(String locale) {
        return new ComponentName(getPackageName(), ALIAS_PREFIX + localeToAliasSuffix(locale));
    }
}
