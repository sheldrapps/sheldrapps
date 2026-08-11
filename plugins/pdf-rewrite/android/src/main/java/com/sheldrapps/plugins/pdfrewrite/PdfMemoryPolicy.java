package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.io.MemoryUsageSetting;

import java.io.File;

public final class PdfMemoryPolicy {
    private static final long LARGE_FILE_THRESHOLD_BYTES = 256L * 1024L * 1024L;

    private PdfMemoryPolicy() {
    }

    public static MemoryUsageSetting forFile(File file) {
        if (file != null && file.length() > LARGE_FILE_THRESHOLD_BYTES) {
            return MemoryUsageSetting.setupTempFileOnly();
        }
        return MemoryUsageSetting.setupMixed(PdfValidator.MEMORY_BUDGET);
    }
}
