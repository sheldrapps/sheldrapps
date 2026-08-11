package com.sheldrapps.plugins.pdfrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;
import static org.junit.Assert.assertTrue;

import java.io.File;

import org.junit.Test;

public class PdfResourceBudgetTest {
    @Test
    public void storageRequirementIncludesOperationMarginWithoutOverflow() {
        assertEquals(
            32L * 1024L * 1024L,
            PdfResourceBudget.requiredStorage(0, 0)
        );
        assertEquals(
            52L * 1024L * 1024L,
            PdfResourceBudget.requiredStorage(10L * 1024L * 1024L, 10L * 1024L * 1024L)
        );
        assertEquals(Long.MAX_VALUE, PdfResourceBudget.requiredStorage(Long.MAX_VALUE, 1));
    }

    @Test
    public void inputBudgetRejectsMissingOrOversizedFiles() throws Exception {
        File missing = new File("missing-pdf-budget-test.pdf");
        try {
            PdfResourceBudget.requireInput(missing, "test");
            fail("missing input must be rejected");
        } catch (PdfOperationException error) {
            assertTrue(error.getMessage().contains("SOURCE_FILE_NOT_FOUND"));
        }
    }
}
