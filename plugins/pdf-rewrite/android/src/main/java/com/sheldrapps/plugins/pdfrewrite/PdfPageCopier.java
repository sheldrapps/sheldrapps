package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.pdmodel.PDDocument;

/** importPage deliberately happens while the source document is still alive. */
public final class PdfPageCopier {
    public int copy(PDDocument source, PDDocument target, int fromInclusive, int toInclusive, int offset, PdfProgress progress) throws Exception {
        int copied = 0;
        for (int page = fromInclusive; page <= toInclusive; page++) {
            progress.checkCancelled();
            target.importPage(source.getPage(page));
            copied++;
            progress.emit("copy-pages", offset + copied, 0);
        }
        return copied;
    }
}
