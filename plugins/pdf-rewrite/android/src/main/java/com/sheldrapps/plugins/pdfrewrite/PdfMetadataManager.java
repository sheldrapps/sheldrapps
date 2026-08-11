package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDDocumentInformation;

public final class PdfMetadataManager {
    public void copyCompatible(PDDocument source, PDDocument target) {
        PDDocumentInformation input = source.getDocumentInformation();
        PDDocumentInformation output = target.getDocumentInformation();
        if (input == null || output == null) return;
        output.setTitle(input.getTitle());
        output.setAuthor(input.getAuthor());
        output.setSubject(input.getSubject());
        output.setKeywords(input.getKeywords());
        output.setCreator(input.getCreator());
        output.setProducer(input.getProducer());
    }
}
