package com.sheldrapps.plugins.epubrewrite;

final class CompatStrings {
    private CompatStrings() {
    }

    static boolean isBlank(String value) {
        if (value == null) {
            return true;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isWhitespace(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    static boolean isNotBlank(String value) {
        return !isBlank(value);
    }
}
