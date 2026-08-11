package com.sheldrapps.plugins.pdfrewrite;

public interface PdfProgress {
    void emit(String phase, int completed, int total);
    void checkCancelled() throws PdfOperationException;
}
