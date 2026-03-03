package com.sheldrapps.covercreatorforkindle;

import android.os.Bundle;
import android.os.Build;
import android.content.res.Configuration;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableEdgeToEdge();
        forceSoftInputAdjustNothing();
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
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
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
}
