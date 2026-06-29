package com.sheldrapps.plugins.epubrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import net.lingala.zip4j.ZipFile;
import net.lingala.zip4j.model.ZipParameters;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class EpubRewritePluginRewriteTest {
    @Rule
    public TemporaryFolder temporaryFolder = new TemporaryFolder();

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

    @Test
    public void mimetypeOnlyRepairDoesNotRewritePackageDocument() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Object issue = invokeObject(
            plugin,
            "issue",
            new Class<?>[] { String.class, String.class, boolean.class },
            "MIMETYPE_MISSING",
            "error",
            true
        );
        Object analysis = buildAnalysis(issue);

        boolean shouldRewrite = invokeBoolean(
            plugin,
            "shouldRewritePackageDocument",
            new Class<?>[] { analysis.getClass() },
            analysis
        );

        assertFalse(shouldRewrite);
    }

    @Test
    public void structuralIssuesStillRewritePackageDocument() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Object issue = invokeObject(
            plugin,
            "issue",
            new Class<?>[] { String.class, String.class, boolean.class },
            "SPINE_ITEM_INVALID",
            "warning",
            true
        );
        Object analysis = buildAnalysis(issue);

        boolean shouldRewrite = invokeBoolean(
            plugin,
            "shouldRewritePackageDocument",
            new Class<?>[] { analysis.getClass() },
            analysis
        );

        assertTrue(shouldRewrite);
    }

    @Test
    public void recoverableContainerIssueKeepsStatusRepairable() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Object issue = invokeObject(
            plugin,
            "issue",
            new Class<?>[] { String.class, String.class, boolean.class },
            "CONTAINER_MISSING",
            "error",
            true
        );
        Object analysis = buildAnalysis("repairable", "OPS/package.opf", issue);

        assertEquals("repairable", invokeString(
            plugin,
            "resolveStatus",
            new Class<?>[] { ArrayList.class },
            buildIssues(issue)
        ));

        boolean shouldRewriteContainer = invokeBoolean(
            plugin,
            "shouldRewriteContainerDocument",
            new Class<?>[] { analysis.getClass() },
            analysis
        );

        assertTrue(shouldRewriteContainer);
    }

    @Test
    public void malformedContainerFallsBackToDeclaredOpfPath() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zipFile = buildZip(
            orderedEntries(
                "mimetype", utf8("application/epub+zip"),
                "META-INF/container.xml", utf8(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                        + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                        + "  <rootfiles>\n"
                        + "    <rootfile full-path=\"OPS/package.xml\" media-type=\"application/oebps-package+xml\"/>\n"
                        + "  </rootfilesX>\n"
                        + "</container>"
                ),
                "OPS/package.xml", utf8(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                        + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">\n"
                        + "  <manifest>\n"
                        + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                        + "  </manifest>\n"
                        + "  <spine>\n"
                        + "    <itemref idref=\"chapter-1\"/>\n"
                        + "  </spine>\n"
                        + "</package>"
                ),
                "OPS/text/ch1.xhtml", utf8(
                    "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body>Hi</body></html>"
                )
            )
        );

        String opfPath = invokeString(
            plugin,
            "findPrimaryOpfPath",
            new Class<?>[] { ZipFile.class, List.class, String.class },
            zipFile,
            zipFile.getFileHeaders(),
            null
        );

        assertEquals("OPS/package.xml", opfPath);
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

    private boolean invokeBoolean(
        Object target,
        String methodName,
        Class<?>[] paramTypes,
        Object... args
    ) throws Exception {
        Method method = target.getClass().getDeclaredMethod(methodName, paramTypes);
        method.setAccessible(true);
        return (Boolean) method.invoke(target, args);
    }

    private Object invokeObject(
        Object target,
        String methodName,
        Class<?>[] paramTypes,
        Object... args
    ) throws Exception {
        Method method = target.getClass().getDeclaredMethod(methodName, paramTypes);
        method.setAccessible(true);
        return method.invoke(target, args);
    }

    private Object buildAnalysis(Object issue) throws Exception {
        return buildAnalysis("repairable", issue);
    }

    private Object buildAnalysis(String status, Object issue) throws Exception {
        return buildAnalysis(status, null, issue);
    }

    private Object buildAnalysis(String status, String opfPath, Object issue) throws Exception {
        Class<?> analysisClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$EpubAnalysis"
        );
        Constructor<?> constructor = analysisClass.getDeclaredConstructor(
            String.class,
            ArrayList.class,
            String.class,
            String.class,
            org.w3c.dom.Document.class,
            ArrayList.class,
            ArrayList.class,
            boolean.class,
            boolean.class
        );
        constructor.setAccessible(true);

        ArrayList<Object> issues = new ArrayList<>();
        issues.add(issue);

        return constructor.newInstance(
            status,
            issues,
            opfPath,
            parentPath(opfPath),
            null,
            new ArrayList<>(),
            new ArrayList<>(),
            true,
            false
        );
    }

    private ArrayList<Object> buildIssues(Object issue) {
        ArrayList<Object> issues = new ArrayList<>();
        issues.add(issue);
        return issues;
    }

    private String parentPath(String path) {
        if (path == null) {
            return null;
        }

        int lastSlash = path.lastIndexOf('/');
        return lastSlash < 0 ? "" : path.substring(0, lastSlash);
    }

    private ZipFile buildZip(Map<String, byte[]> entries) throws Exception {
        File zipPath = temporaryFolder.newFile("sample-" + System.nanoTime() + ".epub");
        ZipFile zipFile = new ZipFile(zipPath);
        for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
            ZipParameters parameters = new ZipParameters();
            parameters.setFileNameInZip(entry.getKey());
            zipFile.addStream(new ByteArrayInputStream(entry.getValue()), parameters);
        }
        return zipFile;
    }

    private Map<String, byte[]> orderedEntries(Object... values) {
        Map<String, byte[]> entries = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) {
            entries.put((String) values[index], (byte[]) values[index + 1]);
        }
        return entries;
    }

    private byte[] utf8(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }
}
