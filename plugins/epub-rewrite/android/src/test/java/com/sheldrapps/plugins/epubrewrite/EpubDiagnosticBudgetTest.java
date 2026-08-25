package com.sheldrapps.plugins.epubrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;

import org.junit.Test;

public class EpubDiagnosticBudgetTest {
    @Test
    public void deepDiagnosisDoesNotTruncateTextCoverage() throws Exception {
        Class<?> statsClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$DiagnosticStats"
        );
        Constructor<?> constructor = statsClass.getDeclaredConstructor(String.class);
        constructor.setAccessible(true);
        Object stats = constructor.newInstance("deep");

        Method consumeText = statsClass.getDeclaredMethod(
            "tryConsumeText",
            String.class,
            long.class
        );
        consumeText.setAccessible(true);
        Method inspectedBytes = statsClass.getDeclaredMethod("getInspectedTextBytes");
        inspectedBytes.setAccessible(true);
        Method limited = statsClass.getDeclaredMethod("isLimited");
        limited.setAccessible(true);
        Method limitCode = statsClass.getDeclaredMethod("getLimitCode");
        limitCode.setAccessible(true);

        assertTrue((Boolean) consumeText.invoke(stats, "OPS/chapter.xhtml", 1024L));
        assertTrue((Boolean) consumeText.invoke(stats, "OPS/chapter.xhtml", 1024L));
        assertEquals(2048L, inspectedBytes.invoke(stats));
        assertTrue(
            (Boolean) consumeText.invoke(stats, "OPS/large.xhtml", 256L * 1024L * 1024L)
        );
        assertEquals(256L * 1024L * 1024L + 2048L, inspectedBytes.invoke(stats));
        assertFalse((Boolean) limited.invoke(stats));
        assertEquals(null, limitCode.invoke(stats));
    }

    @Test
    public void deepDiagnosisDoesNotTruncateEntryOrLinkCoverage() throws Exception {
        Class<?> statsClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$DiagnosticStats"
        );
        Constructor<?> constructor = statsClass.getDeclaredConstructor(String.class);
        constructor.setAccessible(true);
        Object stats = constructor.newInstance("deep");

        Method canInspectNextEntry = statsClass.getDeclaredMethod("canInspectNextEntry");
        canInspectNextEntry.setAccessible(true);
        Method scanLink = statsClass.getDeclaredMethod("tryScanLink");
        scanLink.setAccessible(true);
        Method scannedLinks = statsClass.getDeclaredMethod("getScannedLinks");
        scannedLinks.setAccessible(true);
        Method limited = statsClass.getDeclaredMethod("isLimited");
        limited.setAccessible(true);

        assertTrue((Boolean) canInspectNextEntry.invoke(stats));
        for (int index = 0; index <= 500_000; index++) {
            assertTrue((Boolean) scanLink.invoke(stats));
        }
        assertEquals(500_001L, scannedLinks.invoke(stats));
        assertFalse((Boolean) limited.invoke(stats));
    }
}
