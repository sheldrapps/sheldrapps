package com.sheldrapps.plugins.pdfrewrite;

import static org.junit.Assert.assertEquals;

import java.lang.reflect.Method;
import java.util.HashSet;
import java.util.Set;

import org.junit.Test;

public class PdfRewritePluginOutputNameTest {
    @Test
    public void makesRepeatedSplitTitlesUniqueWithoutChangingUniqueTitles() throws Exception {
        PdfRewritePlugin plugin = new PdfRewritePlugin();
        Method method = PdfRewritePlugin.class.getDeclaredMethod(
            "uniqueSplitOutputName",
            String.class,
            int.class,
            Set.class
        );
        method.setAccessible(true);
        Set<String> usedNames = new HashSet<>();

        assertEquals("part.pdf", method.invoke(plugin, "part.pdf", 0, usedNames));
        assertEquals("part - 2.pdf", method.invoke(plugin, "part.pdf", 1, usedNames));
        assertEquals("part - 3.pdf", method.invoke(plugin, "part.pdf", 2, usedNames));
    }
}
