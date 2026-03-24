package com.sheldrapps.covercreatorforkindle;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin;

public class MainActivity extends BridgeActivity {
    private boolean runtimeFlagsExposed = false;

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
            runOnUiThread(() -> relaunchApp());
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
}
