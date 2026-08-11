package com.sheldrapps.plugins.pdfrewrite;

public final class PdfOperationException extends Exception {
    public final String code;
    public final String stage;

    public PdfOperationException(String code, String stage) {
        super(code);
        this.code = code;
        this.stage = stage;
    }

    public PdfOperationException(String code, String stage, Throwable cause) {
        super(code, cause);
        this.code = code;
        this.stage = stage;
    }
}
