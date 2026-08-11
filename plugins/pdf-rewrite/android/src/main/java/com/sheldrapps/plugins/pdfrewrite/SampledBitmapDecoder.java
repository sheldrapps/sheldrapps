package com.sheldrapps.plugins.pdfrewrite;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.File;

public final class SampledBitmapDecoder {
    public Bitmap decode(File file) throws Exception {
        if (file == null || !file.isFile() || file.length() <= 0) {
            throw new PdfOperationException("INVALID_COVER", "cover");
        }

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
        long width = Math.max(0, bounds.outWidth);
        long height = Math.max(0, bounds.outHeight);
        long pixels = safeMultiply(width, height);
        if (width <= 0 || height <= 0 || pixels <= 0 || pixels > PdfResourceBudget.MAX_COVER_SOURCE_PIXELS) {
            throw new PdfOperationException("COVER_TOO_LARGE", "cover");
        }

        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sampleSizeFor(pixels, PdfResourceBudget.MAX_COVER_DECODE_PIXELS);
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        if (bitmap == null) throw new PdfOperationException("INVALID_COVER", "cover");

        long decodedPixels = safeMultiply(bitmap.getWidth(), bitmap.getHeight());
        if (decodedPixels > PdfResourceBudget.MAX_COVER_DECODE_PIXELS) {
            bitmap.recycle();
            throw new PdfOperationException("COVER_TOO_LARGE", "cover");
        }
        return bitmap;
    }

    private int sampleSizeFor(long pixels, long maximumPixels) {
        int sample = 1;
        while (pixels / ((long) sample * sample) > maximumPixels && sample <= 16384) {
            sample *= 2;
        }
        return sample;
    }

    private long safeMultiply(long left, long right) {
        if (left <= 0 || right <= 0 || left > Long.MAX_VALUE / right) return Long.MAX_VALUE;
        return left * right;
    }
}
