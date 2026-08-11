package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException;
import java.io.File;

public final class PdfValidator {
    public static final long MEMORY_BUDGET = 24L * 1024L * 1024L;
    public void validate(File file) throws Exception {
        try (PDDocument document = PDDocument.load(file, PdfMemoryPolicy.forFile(file))) {
            if (document.isEncrypted()) throw new PdfOperationException("PDF_ENCRYPTED", "validate");
            if (document.getNumberOfPages() <= 0) throw new PdfOperationException("EMPTY_PDF", "validate");
        } catch (InvalidPasswordException error) { throw new PdfOperationException("PDF_PASSWORD_REQUIRED", "validate", error); }
    }
}
