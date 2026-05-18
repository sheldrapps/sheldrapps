package com.sheldrapps.epubcoverchanger;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.content.ComponentName;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin;

import java.util.Arrays;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private boolean runtimeFlagsExposed = false;
    private static final String ALIAS_PREFIX = "com.sheldrapps.epubcoverchanger.MainActivityAlias_";
    private static final String DEFAULT_ALIAS_LOCALE = "system";
    private static final List<String> ALL_ALIAS_LOCALES = Arrays.asList(
        "system",
        "en-US",
        "es-MX",
        "de-DE",
        "fr-FR",
        "it-IT",
        "pt-BR",
        "zh-TW",
        "hi-IN",
        "ar-SA",
        "ja-JP",
        "ko-KR",
        "zh-CN",
        "ru-RU"
    );

    private static final class RuntimeBridge {
        private final boolean debugBuild;

        private RuntimeBridge(boolean debugBuild) {
            this.debugBuild = debugBuild;
        }

        @JavascriptInterface
        public boolean isDebugBuild() {
            return debugBuild;
        }
    }

    private final class AppControlBridge {
        @JavascriptInterface
        public void restartApp() {
            runOnUiThread(() -> relaunchApp());
        }

        @JavascriptInterface
        public void restartForLocale(String localeTag) {
            runOnUiThread(() -> {
                String targetLocale = setActiveLauncherAliasLocale(localeTag);
                relaunchAppForAliasLocale(targetLocale);
            });
        }
    }

    private final class LauncherAliasBridge {
        @JavascriptInterface
        public void setActiveLocale(String localeTag) {
            runOnUiThread(() -> setActiveLauncherAliasLocale(localeTag));
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(EpubRewritePlugin.class);
        super.onCreate(savedInstanceState);
        exposeRuntimeFlags();
        enableEdgeToEdge();
        forceSoftInputAdjustNothing();
    }

    @Override
    public void onStart() {
        super.onStart();
        exposeRuntimeFlags();
    }

    @Override
    public void onResume() {
        super.onResume();
        exposeRuntimeFlags();
    }

    private void exposeRuntimeFlags() {
        if (runtimeFlagsExposed) {
            return;
        }

        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        boolean debugBuild =
            (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

        bridge.getWebView().addJavascriptInterface(
            new RuntimeBridge(debugBuild),
            "SheldrappsRuntime"
        );
        bridge.getWebView().addJavascriptInterface(
            new AppControlBridge(),
            "SheldrappsAppControl"
        );
        bridge.getWebView().addJavascriptInterface(
            new LauncherAliasBridge(),
            "SheldrappsLauncherAlias"
        );
        runtimeFlagsExposed = true;
    }

    private void enableEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());

        if (controller != null) {
            boolean isNightMode =
                (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES;
            controller.setAppearanceLightNavigationBars(!isNightMode);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = getWindow().getAttributes();
            attrs.layoutInDisplayCutoutMode =
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attrs);
        }
    }

    private void forceSoftInputAdjustNothing() {
        int current = getWindow().getAttributes().softInputMode;
        int preservedState = current & WindowManager.LayoutParams.SOFT_INPUT_MASK_STATE;
        getWindow().setSoftInputMode(
            preservedState | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
        );
    }

    private void relaunchApp() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(this, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_MAIN);
            launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        }

        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TASK
        );

        startActivity(launchIntent);
        Runtime.getRuntime().exit(0);
    }

    private void relaunchAppForAliasLocale(String locale) {
        String targetLocale = resolveAliasLocale(locale);
        ComponentName aliasComponent = buildAliasComponentName(targetLocale);

        Intent aliasLaunchIntent = new Intent(Intent.ACTION_MAIN);
        aliasLaunchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        aliasLaunchIntent.setComponent(aliasComponent);
        aliasLaunchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TASK
        );

        try {
            startActivity(aliasLaunchIntent);
            Runtime.getRuntime().exit(0);
            return;
        } catch (Exception ignored) {
            // Fallback below.
        }

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(this, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_MAIN);
            launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        }

        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TASK
        );

        startActivity(launchIntent);
        Runtime.getRuntime().exit(0);
    }

    private String setActiveLauncherAliasLocale(String localeTag) {
        final String targetLocale = resolveAliasLocale(localeTag);

        PackageManager pm = getPackageManager();
        String pkg = getPackageName();

        for (String locale : ALL_ALIAS_LOCALES) {
            ComponentName component = new ComponentName(pkg, ALIAS_PREFIX + localeToAliasSuffix(locale));
            int state = locale.equals(targetLocale)
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            pm.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP);
        }

        return targetLocale;
    }

    private String resolveAliasLocale(String localeTag) {
        if (localeTag == null || localeTag.trim().isEmpty()) {
            return DEFAULT_ALIAS_LOCALE;
        }

        String normalized = localeTag.trim().replace('_', '-');
        if ("system".equalsIgnoreCase(normalized)) {
            return "system";
        }
        for (String locale : ALL_ALIAS_LOCALES) {
            if (locale.equalsIgnoreCase(normalized)) {
                return locale;
            }
        }

        String[] parts = normalized.split("-", 2);
        String language = parts[0].toLowerCase();
        String region = parts.length > 1 ? parts[1].toUpperCase() : "";

        switch (language) {
            case "es":
                return "es-MX";
            case "en":
                return "en-US";
            case "de":
                return "de-DE";
            case "fr":
                return "fr-FR";
            case "it":
                return "it-IT";
            case "pt":
            case "pr":
                return "pt-BR";
            case "zh":
                return "CN".equals(region) ? "zh-CN" : "zh-TW";
            case "hi":
                return "hi-IN";
            case "ar":
                return "ar-SA";
            case "ja":
                return "ja-JP";
            case "ko":
                return "ko-KR";
            case "ru":
                return "ru-RU";
            default:
                return DEFAULT_ALIAS_LOCALE;
        }
    }

    private String localeToAliasSuffix(String locale) {
        return locale.replace('-', '_');
    }

    private ComponentName buildAliasComponentName(String locale) {
        return new ComponentName(
            getPackageName(),
            ALIAS_PREFIX + localeToAliasSuffix(locale)
        );
    }
}
