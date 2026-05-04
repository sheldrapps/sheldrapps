package com.sheldrapps.plugins.epubrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.lang.reflect.Method;

import org.junit.Test;

public class EpubRewritePluginRewriteTest {
    @Test
    public void relativizeZipPathBuildsExpectedRelativePath() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();

        String relative = invokeString(
            plugin,
            "relativizeZipPath",
            new Class<?>[] { String.class, String.class },
            "OEBPS/text",
            "OEBPS/images/cover.png"
        );

        assertEquals("../images/cover.png", relative);
    }

    @Test
    public void resolveRelativeZipPathNormalizesDotSegments() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();

        String resolved = invokeString(
            plugin,
            "resolveRelativeZipPath",
            new Class<?>[] { String.class, String.class },
            "OEBPS/text",
            "../images/./cover.png"
        );

        assertEquals("OEBPS/images/cover.png", resolved);
    }

    @Test
    public void rewriteRelativeCoverRefsUpdatesMatchingReference() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        String content = "<img src=\"images/cover.jpg\"/><a href=\"images/cover.jpg\">Cover</a>";

        String rewritten = invokeString(
            plugin,
            "rewriteRelativeCoverRefs",
            new Class<?>[] { String.class, String.class, String.class, String.class },
            content,
            "OEBPS/chapter.xhtml",
            "OEBPS/images/cover.jpg",
            "OEBPS/images/cover.png"
        );

        assertTrue(rewritten.contains("images/cover.png"));
    }

    @Test
    public void rewriteOpfCoverEntryUpdatesHrefAndMimeType() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        String opf = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">\n"
            + "  <manifest>\n"
            + "    <item id=\"cover\" href=\"images/cover.jpg\" media-type=\"image/jpeg\"/>\n"
            + "  </manifest>\n"
            + "</package>";

        String rewritten = invokeString(
            plugin,
            "rewriteOpfCoverEntry",
            new Class<?>[] { String.class, String.class, String.class, String.class },
            opf,
            "OEBPS/content.opf",
            "OEBPS/images/cover.jpg",
            "OEBPS/images/cover.png"
        );

        assertTrue(rewritten.contains("href=\"images/cover.png\""));
        assertTrue(rewritten.contains("media-type=\"image/png\""));
    }

    @Test
    public void rewriteOpfForInsertedCoverAddsManifestAndMeta() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        String opf = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">\n"
            + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
            + "    <dc:title>Sample</dc:title>\n"
            + "  </metadata>\n"
            + "  <manifest>\n"
            + "    <item id=\"chapter\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
            + "  </manifest>\n"
            + "</package>";

        String rewritten = invokeString(
            plugin,
            "rewriteOpfForInsertedCover",
            new Class<?>[] { String.class, String.class, String.class },
            opf,
            "OEBPS/content.opf",
            "OEBPS/images/cover.jpg"
        );

        assertTrue(rewritten.contains("href=\"images/cover.jpg\""));
        assertTrue(rewritten.contains("media-type=\"image/jpeg\""));
        assertTrue(rewritten.contains("properties=\"cover-image\""));
        assertTrue(rewritten.contains("name=\"cover\""));
    }

    private String invokeString(
        Object target,
        String methodName,
        Class<?>[] paramTypes,
        Object... args
    ) throws Exception {
        Method method = target.getClass().getDeclaredMethod(methodName, paramTypes);
        method.setAccessible(true);
        return (String) method.invoke(target, args);
    }
}
