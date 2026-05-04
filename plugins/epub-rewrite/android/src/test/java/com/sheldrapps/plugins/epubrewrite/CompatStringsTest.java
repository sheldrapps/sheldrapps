package com.sheldrapps.plugins.epubrewrite;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class CompatStringsTest {
    @Test
    public void isBlankReturnsTrueForNullEmptyAndWhitespace() {
        assertTrue(CompatStrings.isBlank(null));
        assertTrue(CompatStrings.isBlank(""));
        assertTrue(CompatStrings.isBlank("   \t\n  "));
        assertTrue(CompatStrings.isBlank("\u2003\u2002"));
    }

    @Test
    public void isBlankReturnsFalseWhenTextExists() {
        assertFalse(CompatStrings.isBlank("a"));
        assertFalse(CompatStrings.isBlank("  a  "));
    }

    @Test
    public void isNotBlankIsOppositeOfIsBlank() {
        assertTrue(CompatStrings.isNotBlank("abc"));
        assertFalse(CompatStrings.isNotBlank("  \n\t  "));
    }
}
