package com.capacitorjs.plugins.statusbar;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import java.lang.reflect.Method;

public class StatusBar {

    public static final String statusBarVisibilityChanged = "statusBarVisibilityChanged";
    public static final String statusBarOverlayChanged = "statusBarOverlayChanged";

    private int currentStatusBarColor = Color.TRANSPARENT;
    private final ChangeListener listener;
    private final AppCompatActivity activity;
    private String currentStyle = "DEFAULT";

    public StatusBar(AppCompatActivity activity, StatusBarConfig config, ChangeListener listener) {
        this.activity = activity;
        this.listener = listener;

        if (canUseStatusBarColor()) {
            this.currentStatusBarColor = getStatusBarColorCompat();
        }

        setBackgroundColor(config.getBackgroundColor());
        setStyle(config.getStyle());
        setOverlaysWebView(config.isOverlaysWebView());
        StatusBarInfo info = getInfo();
        info.setVisible(true);
        listener.onChange(statusBarOverlayChanged, info);
    }

    public void setStyle(String style) {
        Window window = activity.getWindow();
        View decorView = window.getDecorView();
        this.currentStyle = style;
        if (style.equals("DEFAULT")) {
            style = getStyleForTheme();
        }

        WindowInsetsControllerCompat windowInsetsControllerCompat = WindowCompat.getInsetsController(window, decorView);
        windowInsetsControllerCompat.setAppearanceLightStatusBars(!style.equals("DARK"));
    }

    private String getStyleForTheme() {
        int currentNightMode = activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        if (currentNightMode != Configuration.UI_MODE_NIGHT_YES) {
            return "LIGHT";
        }
        return "DARK";
    }

    public void updateStyle() {
        setStyle(this.currentStyle);
    }

    public void setBackgroundColor(int color) {
        currentStatusBarColor = color;

        if (!canUseStatusBarColor()) {
            return;
        }

        Window window = activity.getWindow();
        clearTranslucentStatusFlagDeprecated();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        setStatusBarColorCompat(color);

        if (currentStyle.equals("DEFAULT")) {
            boolean isLightColor = ColorUtils.calculateLuminance(color) > 0.5;
            WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(window, window.getDecorView());
            insetsController.setAppearanceLightStatusBars(isLightColor);
        }
    }

    public void hide() {
        View decorView = activity.getWindow().getDecorView();
        WindowInsetsControllerCompat windowInsetsControllerCompat = WindowCompat.getInsetsController(activity.getWindow(), decorView);
        windowInsetsControllerCompat.hide(WindowInsetsCompat.Type.statusBars());
        StatusBarInfo info = getInfo();
        info.setVisible(false);
        listener.onChange(statusBarVisibilityChanged, info);
    }

    public void show() {
        View decorView = activity.getWindow().getDecorView();
        WindowInsetsControllerCompat windowInsetsControllerCompat = WindowCompat.getInsetsController(activity.getWindow(), decorView);
        windowInsetsControllerCompat.show(WindowInsetsCompat.Type.statusBars());
        StatusBarInfo info = getInfo();
        info.setVisible(true);
        listener.onChange(statusBarVisibilityChanged, info);
    }

    public void setOverlaysWebView(Boolean overlays) {
        View decorView = activity.getWindow().getDecorView();
        int uiOptions = getSystemUiVisibilityDeprecated(decorView);
        if (overlays) {
            uiOptions = uiOptions | getSystemUiFlagLayoutStableDeprecated() | getSystemUiFlagLayoutFullscreenDeprecated();
            setSystemUiVisibilityDeprecated(decorView, uiOptions);
            if (canUseStatusBarColor()) {
                currentStatusBarColor = getStatusBarColorCompat();
                setStatusBarColorCompat(Color.TRANSPARENT);
            } else {
                currentStatusBarColor = Color.TRANSPARENT;
            }
        } else {
            uiOptions = uiOptions & ~getSystemUiFlagLayoutStableDeprecated() & ~getSystemUiFlagLayoutFullscreenDeprecated();
            setSystemUiVisibilityDeprecated(decorView, uiOptions);
            if (canUseStatusBarColor()) {
                setStatusBarColorCompat(currentStatusBarColor);
            }
        }
        listener.onChange(statusBarOverlayChanged, getInfo());
    }

    private boolean shouldSetStatusBarColor(boolean hasOptOut) {
        boolean canSetStatusBar;
        int deviceApi = Build.VERSION.SDK_INT;
        if (deviceApi < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            canSetStatusBar = true;
        } else if (deviceApi == Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            canSetStatusBar = hasOptOut;
        } else {
            canSetStatusBar = false;
        }
        return canSetStatusBar;
    }

    private boolean isEdgeToEdgeOptOutEnabled(Window window) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            TypedValue value = new TypedValue();
            window.getContext().getTheme().resolveAttribute(android.R.attr.windowOptOutEdgeToEdgeEnforcement, value, true);
            return value.data != 0;
        }
        return false;
    }

    private boolean canUseStatusBarColor() {
        return shouldSetStatusBarColor(isEdgeToEdgeOptOutEnabled(activity.getWindow()));
    }

    private boolean getIsOverlaid() {
        return (
            (getSystemUiVisibilityDeprecated(activity.getWindow().getDecorView()) & getSystemUiFlagLayoutFullscreenDeprecated()) ==
            getSystemUiFlagLayoutFullscreenDeprecated()
        );
    }

    public StatusBarInfo getInfo() {
        Window window = activity.getWindow();
        WindowInsetsCompat windowInsetsCompat = ViewCompat.getRootWindowInsets(window.getDecorView());
        boolean isVisible = windowInsetsCompat != null && windowInsetsCompat.isVisible(WindowInsetsCompat.Type.statusBars());
        StatusBarInfo info = new StatusBarInfo();
        info.setStyle(getStyle());
        info.setOverlays(getIsOverlaid());
        info.setVisible(isVisible);
        info.setColor(String.format("#%06X", (0xFFFFFF & currentStatusBarColor)));
        info.setHeight(getStatusBarHeight());
        return info;
    }

    private String getStyle() {
        View decorView = activity.getWindow().getDecorView();
        String style = "DARK";
        WindowInsetsControllerCompat windowInsetsControllerCompat = WindowCompat.getInsetsController(activity.getWindow(), decorView);
        if (windowInsetsControllerCompat.isAppearanceLightStatusBars()) {
            style = "LIGHT";
        }
        return style;
    }

    private int getStatusBarHeight() {
        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsets insets = activity.getWindowManager().getCurrentWindowMetrics().getWindowInsets();
            return (int) (insets.getInsets(WindowInsets.Type.statusBars()).top / metrics.density);
        }

        WindowInsets insets = activity.getWindow().getDecorView().getRootWindowInsets();
        if (insets != null) {
            return getSystemWindowInsetTopDeprecated(insets, metrics);
        }

        return 0;
    }

    public interface ChangeListener {
        void onChange(String eventName, StatusBarInfo info);
    }

    private int getStatusBarColorCompat() {
        try {
            Method method = Window.class.getMethod("getStatusBarColor");
            Object value = method.invoke(activity.getWindow());
            if (value instanceof Integer) {
                return (Integer) value;
            }
        } catch (Exception ignored) {
        }
        return currentStatusBarColor;
    }

    private void setStatusBarColorCompat(int color) {
        try {
            Method method = Window.class.getMethod("setStatusBarColor", Integer.TYPE);
            method.invoke(activity.getWindow(), color);
        } catch (Exception ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    private void clearTranslucentStatusFlagDeprecated() {
        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
    }

    @SuppressWarnings("deprecation")
    private int getSystemUiVisibilityDeprecated(View decorView) {
        return decorView.getSystemUiVisibility();
    }

    @SuppressWarnings("deprecation")
    private void setSystemUiVisibilityDeprecated(View decorView, int uiOptions) {
        decorView.setSystemUiVisibility(uiOptions);
    }

    @SuppressWarnings("deprecation")
    private int getSystemUiFlagLayoutStableDeprecated() {
        return View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
    }

    @SuppressWarnings("deprecation")
    private int getSystemUiFlagLayoutFullscreenDeprecated() {
        return View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
    }

    @SuppressWarnings("deprecation")
    private int getSystemWindowInsetTopDeprecated(WindowInsets insets, DisplayMetrics metrics) {
        return (int) (insets.getSystemWindowInsetTop() / metrics.density);
    }
}
