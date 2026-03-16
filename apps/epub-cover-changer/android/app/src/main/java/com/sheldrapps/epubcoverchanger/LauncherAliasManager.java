package com.sheldrapps.epubcoverchanger;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.util.Log;

import java.util.Locale;

final class LauncherAliasManager {
    private static final String TAG = "LauncherAliasManager";
    private static final String[] SUPPORTED_ALIAS_CODES = {
        "en",
        "es",
        "fr",
        "it",
        "pt",
        "de"
    };
    private static final String DEFAULT_ALIAS_CODE = "en";

    private LauncherAliasManager() {}

    static void applyLocale(Context context, String localeTag) {
        PackageManager packageManager = context.getPackageManager();
        String targetAliasCode = resolveAliasCode(localeTag);

        for (String aliasCode : SUPPORTED_ALIAS_CODES) {
            ComponentName componentName = buildAliasComponent(context, aliasCode);
            int newState =
                aliasCode.equals(targetAliasCode)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;

            try {
                if (packageManager.getComponentEnabledSetting(componentName) != newState) {
                    packageManager.setComponentEnabledSetting(
                        componentName,
                        newState,
                        PackageManager.DONT_KILL_APP
                    );
                }
            } catch (RuntimeException error) {
                Log.w(TAG, "Failed to update alias " + componentName.getClassName(), error);
            }
        }
    }

    private static ComponentName buildAliasComponent(Context context, String aliasCode) {
        String packageName = context.getPackageName();
        return new ComponentName(packageName, packageName + ".Launcher_" + aliasCode);
    }

    private static String resolveAliasCode(String localeTag) {
        if (localeTag == null) {
            return DEFAULT_ALIAS_CODE;
        }

        String normalized = localeTag
            .trim()
            .replace('_', '-')
            .toLowerCase(Locale.US);

        if (normalized.startsWith("es")) {
            return "es";
        }
        if (normalized.startsWith("fr")) {
            return "fr";
        }
        if (normalized.startsWith("it")) {
            return "it";
        }
        if (normalized.startsWith("pt") || normalized.startsWith("pr")) {
            return "pt";
        }
        if (normalized.startsWith("de")) {
            return "de";
        }
        if (normalized.startsWith("en")) {
            return "en";
        }

        return DEFAULT_ALIAS_CODE;
    }
}
