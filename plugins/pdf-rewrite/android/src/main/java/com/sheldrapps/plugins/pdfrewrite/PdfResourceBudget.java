package com.sheldrapps.plugins.pdfrewrite;

import java.io.File;

public final class PdfResourceBudget {
    public static final long MAX_INPUT_BYTES = 2L * 1024L * 1024L * 1024L;
    public static final long STORAGE_MARGIN_BYTES = 32L * 1024L * 1024L;
    public static final int COPY_BUFFER_BYTES = 256 * 1024;
    public static final long MAX_COVER_SOURCE_PIXELS = 120_000_000L;
    public static final long MAX_COVER_DECODE_PIXELS = 6_000_000L;

    private PdfResourceBudget() {
    }

    public static long requiredStorage(long sourceBytes, long extraBytes) {
        long source = Math.max(0L, sourceBytes);
        long extra = Math.max(0L, extraBytes);
        if (Long.MAX_VALUE - source < extra) return Long.MAX_VALUE;
        long total = source + extra;
        if (Long.MAX_VALUE - total < STORAGE_MARGIN_BYTES) return Long.MAX_VALUE;
        return total + STORAGE_MARGIN_BYTES;
    }

    public static void requireInput(File file, String stage) throws PdfOperationException {
        if (file == null || !file.isFile() || file.length() <= 0) {
            throw new PdfOperationException("SOURCE_FILE_NOT_FOUND", stage);
        }
        if (file.length() > MAX_INPUT_BYTES) {
            throw new PdfOperationException("PDF_TOO_LARGE", stage);
        }
    }
}
