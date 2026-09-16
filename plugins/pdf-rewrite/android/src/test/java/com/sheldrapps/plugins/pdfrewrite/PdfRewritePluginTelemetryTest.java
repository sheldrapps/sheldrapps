package com.sheldrapps.plugins.pdfrewrite;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Method;

import org.junit.Test;

public class PdfRewritePluginTelemetryTest {
    @Test
    public void expectedPublicDocumentMissIsNotReportedAsNonFatal() throws Exception {
        PdfRewritePlugin plugin = new PdfRewritePlugin();
        Method method = PdfRewritePlugin.class.getDeclaredMethod(
            "shouldReportNonFatal",
            String.class
        );
        method.setAccessible(true);

        assertFalse((Boolean) method.invoke(plugin, "PUBLIC_DOCUMENT_NOT_FOUND"));
        assertTrue((Boolean) method.invoke(plugin, "PUBLIC_EXPORT_FAILED"));
    }
}
