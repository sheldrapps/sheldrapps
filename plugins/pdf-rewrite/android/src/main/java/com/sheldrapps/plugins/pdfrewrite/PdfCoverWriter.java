package com.sheldrapps.plugins.pdfrewrite;

import android.graphics.Bitmap;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream;
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle;
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory;
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject;
import java.io.File;

/** Same JPEG cover construction used by PCM, exposed for merge/split outputs. */
public final class PdfCoverWriter {
    private final SampledBitmapDecoder decoder = new SampledBitmapDecoder();

    public int prependImageCover(PDDocument output, File image, float quality) throws Exception {
        Bitmap bitmap = decoder.decode(image);
        try {
            PDRectangle box = new PDRectangle(Math.max(1, bitmap.getWidth()), Math.max(1, bitmap.getHeight()));
            PDPage page = new PDPage(box);
            // Operations add the cover before importing content, therefore addPage keeps it first.
            output.addPage(page);
            PDImageXObject pdfImage = JPEGFactory.createFromImage(output, bitmap, Math.min(1f, Math.max(.1f, quality)));
            try (PDPageContentStream stream = new PDPageContentStream(output, page)) { stream.drawImage(pdfImage, 0, 0, box.getWidth(), box.getHeight()); }
            return 1;
        } finally { if (!bitmap.isRecycled()) bitmap.recycle(); }
    }
}
