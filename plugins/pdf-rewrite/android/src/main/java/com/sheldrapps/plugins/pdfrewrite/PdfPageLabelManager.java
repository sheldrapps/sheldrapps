package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.cos.COSBase;
import com.tom_roush.pdfbox.cos.COSDictionary;
import com.tom_roush.pdfbox.cos.COSName;
import com.tom_roush.pdfbox.pdmodel.PDDocument;

/** Page-label dictionaries cannot be safely shared across COS documents; reports whether a manual rebuild is needed. */
public final class PdfPageLabelManager {
    public boolean hasLabels(PDDocument document) {
        COSBase labels = document.getDocumentCatalog().getCOSObject().getDictionaryObject(COSName.PAGE_LABELS);
        return labels instanceof COSDictionary;
    }
}
