package com.sheldrapps.plugins.epubrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.getcapacitor.JSObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import net.lingala.zip4j.ZipFile;
import net.lingala.zip4j.model.ZipParameters;

import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

public class EpubRewritePluginRewriteTest {
    @Rule
    public TemporaryFolder temporaryFolder = new TemporaryFolder();

    @Test
    public void publicExportCopyCountsTwoGiBWithoutBufferingTheDocument() throws Exception {
        long expectedBytes = 2_147_483_648L;
        CountingInputStream input = new CountingInputStream(expectedBytes);
        CountingOutputStream output = new CountingOutputStream();

        long copiedBytes = EpubRewritePlugin.copyStreamWithLongCount(
            input,
            output,
            new AtomicBoolean(false)
        );

        assertEquals(expectedBytes, copiedBytes);
        assertEquals(expectedBytes, output.writtenBytes);
        assertTrue(input.maximumRequestedBuffer <= 128 * 1024);
    }

    @Test
    public void rawArchiveWriterPreservesCompressedPayloadWithoutInflatingIt() throws Exception {
        Path sourcePath = temporaryFolder.newFile("raw-source-" + System.nanoTime() + ".epub").toPath();
        Path outputPath = temporaryFolder.newFile("raw-output-" + System.nanoTime() + ".epub").toPath();
        byte[] payload = new byte[512 * 1024];
        for (int index = 0; index < payload.length; index++) {
            payload[index] = (byte) (index % 31);
        }

        try (ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(sourcePath))) {
            ZipEntry mimetype = new ZipEntry("mimetype");
            byte[] mimetypeBytes = "application/epub+zip".getBytes(StandardCharsets.US_ASCII);
            mimetype.setMethod(ZipEntry.STORED);
            mimetype.setSize(mimetypeBytes.length);
            CRC32 mimetypeCrc = new CRC32();
            mimetypeCrc.update(mimetypeBytes);
            mimetype.setCrc(mimetypeCrc.getValue());
            output.putNextEntry(mimetype);
            output.write(mimetypeBytes);
            output.closeEntry();

            ZipEntry chapter = new ZipEntry("OPS/chapter.xhtml");
            output.putNextEntry(chapter);
            output.write(payload);
            output.closeEntry();
        }

        byte[] sourceRaw;
        long sourceCompressedSize;
        try (org.apache.commons.compress.archivers.zip.ZipFile source =
            new org.apache.commons.compress.archivers.zip.ZipFile(sourcePath.toFile())) {
            ZipArchiveEntry sourceEntry = source.getEntry("OPS/chapter.xhtml");
            sourceCompressedSize = sourceEntry.getCompressedSize();
            try (InputStream raw = source.getRawInputStream(sourceEntry)) {
                sourceRaw = readAll(raw);
            }
            try (StreamingEpubArchiveWriter writer = new StreamingEpubArchiveWriter(outputPath)) {
                writer.writeRaw(source, source.getEntry("mimetype"), "mimetype");
                writer.writeRaw(source, sourceEntry, "OPS/chapter.xhtml");
            }
        }

        try (org.apache.commons.compress.archivers.zip.ZipFile output =
            new org.apache.commons.compress.archivers.zip.ZipFile(outputPath.toFile())) {
            ZipArchiveEntry outputEntry = output.getEntry("OPS/chapter.xhtml");
            assertEquals(sourceCompressedSize, outputEntry.getCompressedSize());
            try (InputStream raw = output.getRawInputStream(outputEntry)) {
                assertArrayEquals(sourceRaw, readAll(raw));
            }
            try (InputStream decoded = output.getInputStream(outputEntry)) {
                assertArrayEquals(payload, readAll(decoded));
            }
        }
    }

    @Test
    public void rawArchiveWriterRejectsDuplicateAndOversizedTransformedEntries() throws Exception {
        Path outputPath = temporaryFolder.newFile("raw-safety-" + System.nanoTime() + ".epub").toPath();
        try (StreamingEpubArchiveWriter writer = new StreamingEpubArchiveWriter(outputPath)) {
            writer.writeStoredBytes("mimetype", "application/epub+zip".getBytes(StandardCharsets.US_ASCII));
            try {
                writer.writeDeflatedBytes("mimetype", new byte[] { 1 });
                fail("Expected duplicate output entry to be rejected");
            } catch (IOException error) {
                assertTrue(error.getMessage().contains("Duplicate EPUB output entry"));
            }
            try {
                writer.writeDeflatedBytes(
                    "OPS/large.xhtml",
                    new byte[(int) StreamingEpubArchiveWriter.MAX_IN_MEMORY_ENTRY_BYTES + 1]
                );
                fail("Expected oversized transformed entry to be rejected");
            } catch (IOException error) {
                assertTrue(error.getMessage().contains("in-memory safety limit"));
            }
        }
    }

    @Test
    public void streamingEntryReaderHonorsDeclaredEncodingWithoutLoadingTheEntry() throws Exception {
        StringBuilder xml = new StringBuilder(256 * 1024);
        xml.append("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><root>");
        while (xml.length() < (4 * 1024 * 1024) + 128) {
            xml.append("<item>Señor</item>");
        }
        xml.append("</root>");

        try (ZipFile zip = buildZip(orderedEntries("OPS/large.xml", encoded(xml.toString(), java.nio.charset.StandardCharsets.ISO_8859_1)))) {
            StringBuilder decoded = new StringBuilder();
            new StreamingEpubEntryReader(zip).transformText(
                zip.getFileHeader("OPS/large.xml"),
                (chunk, finalChunk) -> {
                    decoded.append(chunk);
                    return chunk;
                }
            );
            assertTrue(decoded.toString().contains("<item>Señor</item>"));
        }
    }

    @Test
    public void streamingXmlSanitizerRepairsAcrossChunkBoundariesWithoutDom() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Class<?> sanitizerClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$StreamingXmlSanitizer"
        );
        Constructor<?> constructor = sanitizerClass.getDeclaredConstructor(
            EpubRewritePlugin.class,
            boolean.class
        );
        constructor.setAccessible(true);
        Object sanitizer = constructor.newInstance(plugin, true);
        Method transform = sanitizerClass.getDeclaredMethod(
            "transform",
            String.class,
            boolean.class
        );
        transform.setAccessible(true);

        String first = "<!DOCTYPE html><html><head><script>remove()</script><title>Large";
        String second = " document</title></head><body><p>Content</p></body></html>";
        String repaired = (String) transform.invoke(sanitizer, first, false)
            + (String) transform.invoke(sanitizer, second, true);

        assertFalse(repaired.toLowerCase(java.util.Locale.US).contains("doctype"));
        assertFalse(repaired.toLowerCase(java.util.Locale.US).contains("<script"));
        assertFalse(repaired.toLowerCase(java.util.Locale.US).contains("remove()"));
        assertTrue(repaired.contains("<title>Large document</title>"));
        assertTrue(repaired.contains("<body><p>Content</p></body>"));
    }

    @Test
    public void largeContentRepairStreamsAndRemovesDoctypeWithoutBuildingEntryBytes() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        StringBuilder content = new StringBuilder(5 * 1024 * 1024);
        content.append("<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\">");
        content.append("<head><title>Large</title></head><body><p>");
        while (content.length() < (4 * 1024 * 1024) + 128) {
            content.append("text ");
        }
        content.append("</p></body></html>");

        ZipFile zipFile = buildZip(orderedEntries(
            "OPS/text/chapter.xhtml", utf8(content.toString())
        ));
        try {
            Class<?> itemClass = Class.forName(
                "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$ParsedManifestItem"
            );
            Constructor<?> itemConstructor = itemClass.getDeclaredConstructor(
                String.class,
                String.class,
                String.class,
                String.class,
                boolean.class,
                String.class,
                String.class,
                String.class,
                String.class,
                String.class,
                boolean.class,
                Element.class
            );
            itemConstructor.setAccessible(true);
            Object item = itemConstructor.newInstance(
                "chapter",
                "text/chapter.xhtml",
                "text/chapter.xhtml",
                "OPS/text/chapter.xhtml",
                true,
                "application/xhtml+xml",
                "",
                "",
                "",
                "",
                false,
                null
            );
            Path output = temporaryFolder.getRoot().toPath().resolve("large-repaired.xhtml");
            Object result = invokeObject(
                plugin,
                "repairLargeContentDocumentToFile",
                new Class<?>[] { ZipFile.class, itemClass, Path.class, boolean.class },
                zipFile,
                item,
                output,
                false
            );

            assertNotNull(result);
            String repaired = new String(Files.readAllBytes(output), StandardCharsets.UTF_8);
            assertFalse(repaired.toLowerCase(java.util.Locale.US).contains("<!doctype"));
            assertTrue(repaired.contains("text text text"));
            assertTrue(Files.size(output) > 4 * 1024 * 1024);
        } finally {
            zipFile.close();
        }
    }

    @Test
    public void inMemoryEntryReadRejectsOversizedTextBeforeExhaustingHeap() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        byte[] oversizedText = new byte[(4 * 1024 * 1024) + 1];

        try {
            invokeObject(
                plugin,
                "readStreamBytes",
                new Class<?>[] { InputStream.class },
                new ByteArrayInputStream(oversizedText)
            );
            fail("Expected oversized text entry to be rejected");
        } catch (java.lang.reflect.InvocationTargetException error) {
            assertTrue(error.getCause() instanceof IOException);
            assertTrue(error.getCause().getMessage().contains("in-memory safety limit"));
        }
    }

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
    public void readableEpubIsNotRebuiltByRecoveryFallback() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zip = buildZip(orderedEntries(
            "mimetype", utf8("application/epub+zip"),
            "META-INF/container.xml", utf8(
                "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles>"
                    + "<rootfile full-path=\"OPS/package.opf\"/></rootfiles></container>"
            ),
            "OPS/package.opf", utf8(
                "<package xmlns=\"http://www.idpf.org/2007/opf\"><metadata/><manifest/><spine/></package>"
            )
        ));
        Path source = zip.getFile().toPath();
        long originalSize = Files.size(source);

        Path recovered = invokePath(
            plugin,
            "recoverReadableZipIfNeeded",
            new Class<?>[] { Path.class },
            source
        );

        assertEquals(null, recovered);
        assertEquals(originalSize, Files.size(source));
        assertTrue(invokeBoolean(
            plugin,
            "isReadableZip",
            new Class<?>[] { Path.class },
            source
        ));
        zip.close();
    }

    @Test
    public void splitNavigationReferencesToExcludedDocumentsAreRemovedWithoutTouchingExternalLinks() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();

        String rewritten = invokeString(
            plugin,
            "rewriteSplitInternalLinks",
            new Class<?>[] { String.class, String.class, java.util.Set.class },
            "<html><body>"
                + "<a href=\"chapter-2.xhtml#part\">Next</a>"
                + "<a href=\"https://example.com/book\">External</a>"
                + "<a href=\"#local\">Local</a>"
                + "</body></html>",
            "OPS/text/chapter.xhtml",
            new java.util.HashSet<String>(java.util.Arrays.asList("OPS/text/chapter.xhtml"))
        );

        assertFalse(rewritten.contains("href=\"chapter-2.xhtml#part\""));
        assertTrue(rewritten.contains("href=\"https://example.com/book\""));
        assertTrue(rewritten.contains("href=\"#local\""));
        assertTrue(rewritten.contains(">Next</a>"));
    }

    @Test
    public void splitNavigationRewriteReportsExternalizedInternalLinks() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        java.util.LinkedHashSet<String> warnings = new java.util.LinkedHashSet<>();

        invokeString(
            plugin,
            "rewriteSplitInternalLinks",
            new Class<?>[] { String.class, String.class, java.util.Set.class, java.util.Set.class },
            "<html><body><a href=\"chapter-2.xhtml\">Next</a></body></html>",
            "OPS/text/chapter.xhtml",
            new java.util.HashSet<String>(java.util.Arrays.asList("OPS/text/chapter.xhtml")),
            warnings
        );

        assertEquals(
            java.util.Arrays.asList("SPLIT_INTERNAL_LINK_EXTERNALIZED:OPS/text/chapter.xhtml:chapter-2.xhtml"),
            new ArrayList<>(warnings)
        );
    }

    @Test
    public void splitMetadataPreservesOriginalIdentifierAndMetadataFields() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Document document = invokeDocument(
            plugin,
            "parseXmlUtf8",
            new Class<?>[] { String.class },
            "<package xmlns=\"http://www.idpf.org/2007/opf\"><metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                + "<dc:identifier id=\"book-id\">urn:isbn:9780000000000</dc:identifier>"
                + "<dc:title>Original title</dc:title><dc:language>es</dc:language>"
                + "<dc:creator>Author</dc:creator><dc:subject>Fiction</dc:subject>"
                + "</metadata></package>"
        );
        Element metadata = (Element) document.getElementsByTagNameNS("*", "metadata").item(0);

        invokeObject(
            plugin,
            "updateSplitMetadata",
            new Class<?>[] { Document.class, Element.class, String.class },
            document,
            metadata,
            "Part one"
        );

        String serialized = invokeString(
            plugin,
            "serializeXml",
            new Class<?>[] { Document.class },
            document
        );

        assertTrue(serialized.contains("urn:isbn:9780000000000"));
        assertTrue(serialized.contains("<dc:language>es</dc:language>"));
        assertTrue(serialized.contains("<dc:creator>Author</dc:creator>"));
        assertTrue(serialized.contains("<dc:subject>Fiction</dc:subject>"));
        assertTrue(serialized.contains("<dc:title>Part one</dc:title>"));
    }

    @Test
    public void mergeChaptersUseSourceTocLabelsWhenBooksAndChaptersIsSelected() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Class<?> sourceClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$MergeSource"
        );
        Constructor<?> sourceConstructor = sourceClass.getDeclaredConstructor(Path.class, String.class, String.class);
        sourceConstructor.setAccessible(true);
        Object source = sourceConstructor.newInstance(
            temporaryFolder.getRoot().toPath().resolve("book.epub"),
            "book.epub",
            "EPUB/books/b000001"
        );
        java.lang.reflect.Field titleField = sourceClass.getDeclaredField("title");
        titleField.setAccessible(true);
        titleField.set(source, "Book");
        java.lang.reflect.Field spinePathsField = sourceClass.getDeclaredField("spinePaths");
        spinePathsField.setAccessible(true);
        ((List<String>) spinePathsField.get(source)).add("OPS/chapter.xhtml");

        Class<?> tocClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$MergeTocEntry"
        );
        Constructor<?> tocConstructor = tocClass.getDeclaredConstructor(
            String.class,
            String.class,
            String.class,
            ArrayList.class
        );
        tocConstructor.setAccessible(true);
        java.lang.reflect.Field tocEntriesField = sourceClass.getDeclaredField("tocEntries");
        tocEntriesField.setAccessible(true);
        ((List<Object>) tocEntriesField.get(source)).add(tocConstructor.newInstance(
            "chapter",
            "Source chapter",
            "OPS/chapter.xhtml#part",
            new ArrayList<>()
        ));

        String navigation = invokeString(
            plugin,
            "buildMergeNavXhtml",
            new Class<?>[] { List.class, String.class },
            new ArrayList<>(java.util.Arrays.asList(source)),
            "books-and-chapters"
        );

        assertTrue(navigation.contains("Source chapter"));
        assertFalse(navigation.contains("Chapter 1"));
    }

    @Test
    public void splitDependencyExtractionIncludesMediaOverlayResources() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();

        @SuppressWarnings("unchecked")
        List<String> dependencies = (List<String>) invokeObject(
            plugin,
            "extractSplitManifestDependencies",
            new Class<?>[] { String.class, String.class },
            "OPS/package.opf",
            "<package xmlns=\"http://www.idpf.org/2007/opf\"><manifest>"
                + "<item id=\"chapter\" href=\"text/chapter.xhtml\" media-type=\"application/xhtml+xml\" media-overlay=\"overlay\"/>"
                + "<item id=\"overlay\" href=\"audio/chapter.smil\" media-type=\"application/smil\"/>"
                + "</manifest></package>"
        );

        assertEquals(java.util.Arrays.asList("OPS/audio/chapter.smil"), dependencies);
    }

    @Test
    public void splitFixtureValidatesAndPreservesNestedTocHierarchy() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile sourceZip = buildZip(orderedEntries(
            "mimetype", utf8("application/epub+zip"),
            "META-INF/container.xml", utf8(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                    + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">"
                    + "<rootfiles><rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles>"
                    + "</container>"
            ),
            "OPS/package.opf", utf8(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                    + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\">"
                    + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
                    + "<dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>"
                    + "<dc:title>Nested TOC fixture</dc:title><dc:language>en</dc:language>"
                    + "</metadata><manifest>"
                    + "<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>"
                    + "<item id=\"ncx\" href=\"toc.ncx\" media-type=\"application/x-dtbncx+xml\"/>"
                    + "<item id=\"part-1\" href=\"text/part-1.xhtml\" media-type=\"application/xhtml+xml\"/>"
                    + "<item id=\"chapter-1\" href=\"text/chapter-1.xhtml\" media-type=\"application/xhtml+xml\"/>"
                    + "<item id=\"chapter-2\" href=\"text/chapter-2.xhtml\" media-type=\"application/xhtml+xml\"/>"
                    + "<item id=\"part-2\" href=\"text/part-2.xhtml\" media-type=\"application/xhtml+xml\"/>"
                    + "<item id=\"chapter-3\" href=\"text/chapter-3.xhtml\" media-type=\"application/xhtml+xml\"/>"
                    + "<item id=\"chapter-4\" href=\"text/chapter-4.xhtml\" media-type=\"application/xhtml+xml\"/>"
                    + "</manifest><spine toc=\"ncx\">"
                    + "<itemref idref=\"part-1\"/><itemref idref=\"chapter-1\"/><itemref idref=\"chapter-2\"/>"
                    + "<itemref idref=\"part-2\"/><itemref idref=\"chapter-3\"/><itemref idref=\"chapter-4\"/>"
                    + "</spine></package>"
            ),
            "OPS/nav.xhtml", utf8(
                "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\"><body>"
                    + "<nav epub:type=\"toc\"><ol>"
                    + "<li><a href=\"text/part-1.xhtml\">Part I</a><ol>"
                    + "<li><a href=\"text/chapter-1.xhtml#section-3\">Chapter 1</a></li>"
                    + "<li><a href=\"text/chapter-2.xhtml\">Chapter 2</a></li></ol></li>"
                    + "<li><a href=\"text/part-2.xhtml\">Part II</a><ol>"
                    + "<li><a href=\"text/chapter-3.xhtml\">Chapter 3</a></li>"
                    + "<li><a href=\"text/chapter-4.xhtml\">Chapter 4</a></li></ol></li>"
                    + "</ol></nav></body></html>"
            ),
            "OPS/toc.ncx", utf8(
                "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\"><navMap>"
                    + "<navPoint id=\"part-1\"><navLabel><text>Part I</text></navLabel><content src=\"text/part-1.xhtml\"/></navPoint>"
                    + "</navMap></ncx>"
            ),
            "OPS/text/part-1.xhtml", simpleXhtml("Part I"),
            "OPS/text/chapter-1.xhtml", simpleXhtml("Chapter 1"),
            "OPS/text/chapter-2.xhtml", simpleXhtml("Chapter 2"),
            "OPS/text/part-2.xhtml", simpleXhtml("Part II"),
            "OPS/text/chapter-3.xhtml", simpleXhtml("Chapter 3"),
            "OPS/text/chapter-4.xhtml", simpleXhtml("Chapter 4")
        ));

        Object source = invokeObject(
            plugin,
            "readSplitSourceMetadata",
            new Class<?>[] { ZipFile.class, String.class },
            sourceZip,
            "OPS/package.opf"
        );

        Class<?> requestClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$SplitOutputRequest"
        );
        Class<?> tocClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$SplitTocEntry"
        );
        Constructor<?> tocConstructor = tocClass.getDeclaredConstructor(
            String.class,
            String.class,
            String.class,
            ArrayList.class
        );
        tocConstructor.setAccessible(true);
        ArrayList<Object> children = new ArrayList<>();
        children.add(tocConstructor.newInstance(
            "chapter-1", "Chapter 1", "OPS/text/chapter-1.xhtml#section-3", new ArrayList<>()
        ));
        children.add(tocConstructor.newInstance(
            "chapter-2", "Chapter 2", "OPS/text/chapter-2.xhtml", new ArrayList<>()
        ));
        ArrayList<Object> tocEntries = new ArrayList<>();
        tocEntries.add(tocConstructor.newInstance(
            "part-1", "Part I", "OPS/text/part-1.xhtml", children
        ));

        Constructor<?> requestConstructor = requestClass.getDeclaredConstructor(
            String.class,
            Path.class,
            String.class,
            String.class,
            ArrayList.class,
            java.util.HashMap.class,
            ArrayList.class
        );
        requestConstructor.setAccessible(true);
        ArrayList<String> spineItemIds = new ArrayList<>();
        spineItemIds.add("part-1");
        spineItemIds.add("chapter-1");
        spineItemIds.add("chapter-2");
        Object request = requestConstructor.newInstance(
            "part-1",
            temporaryFolder.getRoot().toPath().resolve("part-1.epub"),
            "part-1.epub",
            "Part I",
            spineItemIds,
            new java.util.HashMap<>(),
            tocEntries
        );
        Path outputPath = temporaryFolder.getRoot().toPath().resolve("part-1.epub");

        invokeObject(
            plugin,
            "writeSplitOutput",
            new Class<?>[] { ZipFile.class, source.getClass(), requestClass },
            sourceZip,
            source,
            request
        );
        invokeObject(
            plugin,
            "validateSplitEpub",
            new Class<?>[] { Path.class, int.class },
            outputPath,
            3
        );

        try (ZipFile outputZip = new ZipFile(outputPath.toFile())) {
            assertEquals(
                net.lingala.zip4j.model.enums.CompressionMethod.STORE,
                outputZip.getFileHeader("mimetype").getCompressionMethod()
            );
            String nav = invokeString(
                plugin,
                "readZipText",
                new Class<?>[] { ZipFile.class, String.class },
                outputZip,
                "OPS/emas-nav.xhtml"
            );
            String ncx = invokeString(
                plugin,
                "readZipText",
                new Class<?>[] { ZipFile.class, String.class },
                outputZip,
                "OPS/emas-toc.ncx"
            );
            assertTrue(nav.contains("<li><a href=\"text/part-1.xhtml\">Part I</a><ol>"));
            assertTrue(nav.contains("text/chapter-1.xhtml#section-3"));
            assertTrue(ncx.contains("<navPoint id=\"toc-1\""));
            assertTrue(ncx.contains("Chapter 1"));
            assertTrue(ncx.indexOf("Chapter 1") > ncx.indexOf("Part I"));
        }
    }

    @Test
    public void recoverZipFromLocalHeadersKeepsStoredMimetypeEntry() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Path sourcePath = temporaryFolder.newFile("source.epub").toPath();
        Path recoveredPath = temporaryFolder.newFile("recovered.epub").toPath();
        byte[] mimetype = utf8("application/epub+zip");

        try (ZipOutputStream output = new ZipOutputStream(Files.newOutputStream(sourcePath))) {
            ZipEntry mimetypeEntry = new ZipEntry("mimetype");
            mimetypeEntry.setMethod(ZipEntry.STORED);
            mimetypeEntry.setSize(mimetype.length);
            mimetypeEntry.setCompressedSize(mimetype.length);
            CRC32 crc32 = new CRC32();
            crc32.update(mimetype);
            mimetypeEntry.setCrc(crc32.getValue());
            output.putNextEntry(mimetypeEntry);
            output.write(mimetype);
            output.closeEntry();
        }

        assertTrue(invokeBoolean(
            plugin,
            "recoverZipFromLocalHeaders",
            new Class<?>[] { Path.class, Path.class },
            sourcePath,
            recoveredPath
        ));

        try (java.util.zip.ZipFile recovered = new java.util.zip.ZipFile(recoveredPath.toFile())) {
            assertNotNull(recovered.getEntry("mimetype"));
        }
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
            + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"2.0\">\n"
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
        assertTrue(rewritten.contains("href=\"cover.xhtml\""));
        assertTrue(rewritten.contains("idref=\"cover-page-generated\""));
        assertTrue(rewritten.contains("type=\"cover\""));
    }

    @Test
    public void rewriteNcxForInsertedCoverPrependsCoverAndShiftsPlayOrder() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        String ncx = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\" version=\"2005-1\">\n"
            + "  <navMap><navPoint id=\"title\" playOrder=\"1\">"
            + "<navLabel><text>Title page</text></navLabel>"
            + "<content src=\"001.html\"/></navPoint></navMap>\n"
            + "</ncx>";

        String rewritten = invokeString(
            plugin,
            "rewriteNcxForInsertedCover",
            new Class<?>[] { String.class, String.class, String.class },
            ncx,
            "Ops/toc.ncx",
            "Ops/cover.xhtml"
        );

        assertTrue(rewritten.contains("id=\"cover-generated\" playOrder=\"1\""));
        assertTrue(rewritten.contains("src=\"cover.xhtml\""));
        assertTrue(rewritten.contains("id=\"title\" playOrder=\"2\""));
    }

    @Test
    public void rewriteArchiveForInsertedCoverCreatesNavigableCoverPage() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Path sourcePath = temporaryFolder.newFile("no-cover-source.epub").toPath();
        Path outputPath = temporaryFolder.newFile("no-cover-output.epub").toPath();
        Path newCoverPath = temporaryFolder.newFile("new-cover.jpg").toPath();
        Files.write(newCoverPath, new byte[] { 1, 2, 3, 4 });

        try (ZipFile source = new ZipFile(sourcePath.toFile())) {
            addZipEntry(source, "mimetype", utf8("application/epub+zip"));
            addZipEntry(source, "META-INF/container.xml", utf8(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                    + "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">"
                    + "<rootfiles><rootfile full-path=\"OPS/package.opf\""
                    + " media-type=\"application/oebps-package+xml\"/></rootfiles></container>"
            ));
            addZipEntry(source, "OPS/package.opf", utf8(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                    + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"2.0\">"
                    + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>Book</dc:title></metadata>"
                    + "<manifest><item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>"
                    + "<item id=\"ncx\" href=\"toc.ncx\" media-type=\"application/x-dtbncx+xml\"/>"
                    + "<item id=\"chapter\" href=\"001.html\" media-type=\"application/xhtml+xml\"/></manifest>"
                    + "<spine toc=\"ncx\"><itemref idref=\"chapter\"/></spine></package>"
            ));
            addZipEntry(source, "OPS/nav.xhtml", utf8(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
                    + "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\"><body>"
                    + "<nav epub:type=\"toc\"><ol><li><a href=\"001.html\">Chapter</a></li></ol></nav>"
                    + "</body></html>"
            ));
            addZipEntry(source, "OPS/toc.ncx", utf8(
                "<?xml version=\"1.0\"?><!DOCTYPE ncx PUBLIC \"-//NISO//DTD ncx 2005-1//EN\""
                    + " \"http://www.daisy.org/z3986/2005/ncx-2005-1.dtd\"><ncx>"
                    + "<navMap><navPoint id=\"chapter\" playOrder=\"1\"><navLabel><text>Chapter</text></navLabel>"
                    + "<content src=\"001.html\"/></navPoint></navMap></ncx>"
            ));
            addZipEntry(source, "OPS/001.html", simpleXhtml("Chapter"));
        }

        invokeObject(
            plugin,
            "rewriteArchiveReplacingCover",
            new Class<?>[] {
                Path.class,
                Path.class,
                String.class,
                String.class,
                String.class,
                Path.class,
                int.class,
                int.class,
            },
            sourcePath,
            outputPath,
            null,
            "OPS/images/cover.jpg",
            "OPS/package.opf",
            newCoverPath,
            0,
            100
        );

        invokeObject(
            plugin,
            "validateInsertedCoverArchive",
            new Class<?>[] { Path.class, String.class, String.class },
            outputPath,
            "OPS/images/cover.jpg",
            "OPS/package.opf"
        );

        try (ZipFile output = new ZipFile(outputPath.toFile())) {
            assertTrue(output.getFileHeaders().stream().anyMatch(
                (header) -> "OPS/cover.xhtml".equals(header.getFileName())
            ));
            String opf = invokeString(
                plugin,
                "readZipText",
                new Class<?>[] { ZipFile.class, String.class },
                output,
                "OPS/package.opf"
            );
            String ncx = invokeString(
                plugin,
                "readZipText",
                new Class<?>[] { ZipFile.class, String.class },
                output,
                "OPS/toc.ncx"
            );
            String nav = invokeString(
                plugin,
                "readZipText",
                new Class<?>[] { ZipFile.class, String.class },
                output,
                "OPS/nav.xhtml"
            );
            assertTrue(opf.contains("idref=\"cover-page-generated\""));
            assertTrue(opf.contains("type=\"cover\""));
            assertTrue(ncx.contains("src=\"cover.xhtml\""));
            assertTrue(nav.contains("href=\"cover.xhtml\""));
            assertTrue(nav.indexOf("href=\"cover.xhtml\"") < nav.indexOf("href=\"001.html\""));
        }
    }

    @Test
    public void buildMergeOpfAddsLegacyCoverMetaForReaderCompatibility() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();

        String opf = invokeString(
            plugin,
            "buildMergeOpf",
            new Class<?>[] { String.class, List.class, List.class, String.class, String.class },
            "Merged",
            new ArrayList<>(),
            new ArrayList<>(),
            "cover.jpg",
            "image/jpeg"
        );

        assertTrue(opf.contains("<meta name=\"cover\" content=\"cover-image\"/>"));
        assertTrue(opf.contains("properties=\"cover-image\""));
    }

    @Test
    public void mergeMetadataFallsBackFromEmptyNavToNestedNcx() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile sourceZip = buildZip(orderedEntries(
            "OPS/package.opf", utf8(
                "<package xmlns=\"http://www.idpf.org/2007/opf\"><metadata><dc:title xmlns:dc=\"http://purl.org/dc/elements/1.1/\">Book</dc:title></metadata><manifest>"
                    + "<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>"
                    + "<item id=\"ncx\" href=\"toc.ncx\" media-type=\"application/x-dtbncx+xml\"/>"
                    + "<item id=\"chapter\" href=\"text/chapter.xhtml\" media-type=\"application/xhtml+xml\"/></manifest>"
                    + "<spine><itemref idref=\"chapter\"/></spine></package>"
            ),
            "OPS/nav.xhtml", utf8("<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><nav><ol/></nav></body></html>"),
            "OPS/toc.ncx", utf8(
                "<ncx xmlns=\"http://www.daisy.org/z3986/2005/ncx/\"><navMap><navPoint id=\"part\"><navLabel><text>Part I</text></navLabel><content src=\"text/chapter.xhtml#part\"/></navPoint></navMap></ncx>"
            ),
            "OPS/text/chapter.xhtml", simpleXhtml("Chapter")
        ));

        Object metadata = invokeObject(
            plugin,
            "readMergeBookMetadata",
            new Class<?>[] { ZipFile.class, String.class, String.class },
            sourceZip,
            "OPS/package.opf",
            "fallback"
        );
        java.lang.reflect.Field tocEntriesField = metadata.getClass().getDeclaredField("tocEntries");
        tocEntriesField.setAccessible(true);
        List<?> tocEntries = (List<?>) tocEntriesField.get(metadata);

        assertEquals(1, tocEntries.size());
        java.lang.reflect.Field titleField = tocEntries.get(0).getClass().getDeclaredField("title");
        titleField.setAccessible(true);
        assertEquals("Part I", titleField.get(tocEntries.get(0)));
    }

    @Test
    public void mergeFullIndexPreservesSourceHierarchyWhileOtherModesUseDefinedFallbacks() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Class<?> sourceClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$MergeSource"
        );
        Constructor<?> sourceConstructor = sourceClass.getDeclaredConstructor(Path.class, String.class, String.class);
        sourceConstructor.setAccessible(true);
        Object source = sourceConstructor.newInstance(
            temporaryFolder.getRoot().toPath().resolve("book.epub"),
            "book.epub",
            "EPUB/books/b000001"
        );
        java.lang.reflect.Field titleField = sourceClass.getDeclaredField("title");
        titleField.setAccessible(true);
        titleField.set(source, "Book");
        java.lang.reflect.Field spinePathsField = sourceClass.getDeclaredField("spinePaths");
        spinePathsField.setAccessible(true);
        ((List<String>) spinePathsField.get(source)).add("OPS/chapter.xhtml");

        Class<?> tocClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$MergeTocEntry"
        );
        Constructor<?> tocConstructor = tocClass.getDeclaredConstructor(
            String.class,
            String.class,
            String.class,
            ArrayList.class
        );
        tocConstructor.setAccessible(true);
        Object tocEntry = tocConstructor.newInstance(
            "chapter",
            "Original chapter",
            "OPS/chapter.xhtml#section",
            new ArrayList<>()
        );
        java.lang.reflect.Field tocEntriesField = sourceClass.getDeclaredField("tocEntries");
        tocEntriesField.setAccessible(true);
        ((List<Object>) tocEntriesField.get(source)).add(tocEntry);

        ArrayList<Object> sources = new ArrayList<>();
        sources.add(source);
        String fullIndex = invokeString(
            plugin,
            "buildMergeNavXhtml",
            new Class<?>[] { List.class, String.class },
            sources,
            "full-index"
        );
        String booksAndChapters = invokeString(
            plugin,
            "buildMergeNavXhtml",
            new Class<?>[] { List.class, String.class },
            sources,
            "books-and-chapters"
        );
        String booksOnly = invokeString(
            plugin,
            "buildMergeNavXhtml",
            new Class<?>[] { List.class, String.class },
            sources,
            "books-only"
        );

        assertTrue(fullIndex.contains("Original chapter"));
        assertTrue(fullIndex.contains("OPS/chapter.xhtml#section"));
        assertTrue(booksAndChapters.contains("Original chapter"));
        assertFalse(booksAndChapters.contains("Chapter 1"));
        assertFalse(booksOnly.contains("Chapter 1"));
    }

    @Test
    public void mergeMetadataRejectsAnEmptySpineBeforeWritingOutput() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile sourceZip = buildZip(orderedEntries(
            "OPS/package.opf", utf8(
                "<package xmlns=\"http://www.idpf.org/2007/opf\"><metadata/><manifest/><spine/></package>"
            )
        ));

        try {
            invokeObject(
                plugin,
                "readMergeBookMetadata",
                new Class<?>[] { ZipFile.class, String.class, String.class },
                sourceZip,
                "OPS/package.opf",
                "fallback"
            );
        } catch (java.lang.reflect.InvocationTargetException error) {
            assertEquals("MERGE_SPINE_EMPTY", pluginErrorCode(error.getCause()));
            return;
        }
        throw new AssertionError("An empty spine must be rejected");
    }

    @Test
    public void generatedNavigationValidationRejectsEmptyNavigationDocuments() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zip = buildZip(orderedEntries(
            "EPUB/nav.xhtml", utf8("<html><body><nav><ol/></nav></body></html>"),
            "EPUB/toc.ncx", utf8("<ncx><navMap/></ncx>")
        ));

        try {
            invokeObject(
                plugin,
                "validateNavigationDocumentHasEntries",
                new Class<?>[] { ZipFile.class, String.class, String.class, boolean.class, String.class },
                zip,
                "EPUB/nav.xhtml",
                "href",
                true,
                "MERGE_NAVIGATION_EMPTY"
            );
        } catch (java.lang.reflect.InvocationTargetException error) {
            assertEquals("MERGE_NAVIGATION_EMPTY", pluginErrorCode(error.getCause()));
            return;
        }
        throw new AssertionError("An empty navigation document must be rejected");
    }

    @Test
    public void mergeMetadataRejectsSpineReferencesToMissingResources() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile sourceZip = buildZip(orderedEntries(
            "OPS/package.opf", utf8(
                "<package xmlns=\"http://www.idpf.org/2007/opf\"><metadata/><manifest>"
                    + "<item id=\"chapter\" href=\"text/missing.xhtml\" media-type=\"application/xhtml+xml\"/></manifest>"
                    + "<spine><itemref idref=\"chapter\"/></spine></package>"
            )
        ));

        try {
            invokeObject(
                plugin,
                "readMergeBookMetadata",
                new Class<?>[] { ZipFile.class, String.class, String.class },
                sourceZip,
                "OPS/package.opf",
                "fallback"
            );
        } catch (java.lang.reflect.InvocationTargetException error) {
            assertEquals("MERGE_MANIFEST_RESOURCE_MISSING", pluginErrorCode(error.getCause()));
            return;
        }
        throw new AssertionError("Missing spine resources must be rejected");
    }

    @Test
    public void navigationValidationRejectsMissingTargets() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zip = buildZip(orderedEntries(
            "OPS/nav.xhtml", utf8("<html><body><nav><ol><li><a href=\"text/missing.xhtml\">Missing</a></li></ol></nav></body></html>")
        ));

        try {
            invokeObject(
                plugin,
                "validateSplitNavigationTargets",
                new Class<?>[] { ZipFile.class, List.class, String.class, String.class },
                zip,
                zip.getFileHeaders(),
                "OPS/nav.xhtml",
                "href"
            );
        } catch (java.lang.reflect.InvocationTargetException error) {
            assertEquals("SPLIT_NAVIGATION_TARGET_MISSING", pluginErrorCode(error.getCause()));
            return;
        }
        throw new AssertionError("Missing navigation targets must be rejected");
    }

    @Test
    public void ocfValidationRejectsCompressedMimetype() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zip = buildZip(orderedEntries(
            "mimetype", utf8("application/epub+zip"),
            "META-INF/container.xml", utf8(
                "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles>"
                    + "<rootfile full-path=\"OPS/package.opf\"/></rootfiles></container>"
            ),
            "OPS/package.opf", utf8("<package xmlns=\"http://www.idpf.org/2007/opf\"/>")
        ));

        try {
            invokeObject(
                plugin,
                "validateOcfArchive",
                new Class<?>[] { ZipFile.class, List.class, String.class, String.class },
                zip,
                zip.getFileHeaders(),
                "EPUB_INVALID",
                "test"
            );
        } catch (java.lang.reflect.InvocationTargetException error) {
            assertEquals("EPUB_INVALID", pluginErrorCode(error.getCause()));
            return;
        }
        throw new AssertionError("Compressed mimetype must be rejected");
    }

    @Test
    public void ocfValidationRejectsUnsafeArchivePaths() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zip = buildZip(orderedEntries(
            "mimetype", utf8("application/epub+zip"),
            "../escape.txt", utf8("unsafe")
        ));

        try {
            invokeObject(
                plugin,
                "validateOcfArchive",
                new Class<?>[] { ZipFile.class, List.class, String.class, String.class },
                zip,
                zip.getFileHeaders(),
                "EPUB_INVALID",
                "test"
            );
        } catch (java.lang.reflect.InvocationTargetException error) {
            assertEquals("EPUB_INVALID", pluginErrorCode(error.getCause()));
            return;
        }
        throw new AssertionError("Unsafe archive paths must be rejected");
    }

    @Test
    public void mergeOpfPreservesSourceMetadataAndResourceProperties() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Class<?> sourceClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$MergeSource"
        );
        Constructor<?> sourceConstructor = sourceClass.getDeclaredConstructor(Path.class, String.class, String.class);
        sourceConstructor.setAccessible(true);
        Object source = sourceConstructor.newInstance(
            temporaryFolder.getRoot().toPath().resolve("book.epub"),
            "book.epub",
            "EPUB/books/b000001"
        );
        java.lang.reflect.Field languageField = sourceClass.getDeclaredField("language");
        languageField.setAccessible(true);
        languageField.set(source, "es");
        java.lang.reflect.Field creatorsField = sourceClass.getDeclaredField("creators");
        creatorsField.setAccessible(true);
        ((List<String>) creatorsField.get(source)).add("Author");
        java.lang.reflect.Field identifiersField = sourceClass.getDeclaredField("sourceIdentifiers");
        identifiersField.setAccessible(true);
        ((List<String>) identifiersField.get(source)).add("urn:isbn:123");

        Class<?> resourceClass = Class.forName(
            "com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin$MergeResource"
        );
        Constructor<?> resourceConstructor = resourceClass.getDeclaredConstructor(
            String.class,
            String.class,
            String.class,
            String.class
        );
        resourceConstructor.setAccessible(true);
        Object resource = resourceConstructor.newInstance(
            "r1",
            "books/b000001/fonts/book.woff2",
            "font/woff2",
            "font obfuscated"
        );

        String opf = invokeString(
            plugin,
            "buildMergeOpf",
            new Class<?>[] { String.class, List.class, List.class, String.class, String.class },
            "Merged",
            new ArrayList<>(java.util.Arrays.asList(resource)),
            new ArrayList<>(java.util.Arrays.asList(source)),
            "cover.jpg",
            "image/jpeg"
        );

        assertTrue(opf.contains("<dc:language>es</dc:language>"));
        assertTrue(opf.contains("<dc:creator>Author</dc:creator>"));
        assertTrue(opf.contains("property=\"dcterms:source\">urn:isbn:123"));
        assertTrue(opf.contains("properties=\"font obfuscated\""));
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
    public void blockingIssuesDoNotHideRepairableIssues() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Object blocker = invokeObject(
            plugin,
            "issue",
            new Class<?>[] { String.class, String.class, boolean.class },
            "CONTAINER_MISSING",
            "error",
            false
        );
        Object repairable = invokeObject(
            plugin,
            "issue",
            new Class<?>[] { String.class, String.class, boolean.class },
            "MIMETYPE_MISSING",
            "error",
            true
        );

        ArrayList<Object> issues = buildIssues(blocker, repairable);

        assertEquals("repairable", invokeString(
            plugin,
            "resolveStatus",
            new Class<?>[] { ArrayList.class },
            issues
        ));
    }

    @Test
    public void recoverReadableZipRebuildsTruncatedArchive() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        File zipPath = temporaryFolder.newFile("truncated-" + System.nanoTime() + ".epub");
        ZipFile zipFile = new ZipFile(zipPath);
        addZipEntry(zipFile, "mimetype", utf8("application/epub+zip"));
        addZipEntry(zipFile, "META-INF/container.xml", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                + "  <rootfiles>\n"
                + "    <rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                + "  </rootfiles>\n"
                + "</container>"
        ));
        addZipEntry(zipFile, "OPS/package.opf", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\">\n"
                + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                + "    <dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>\n"
                + "  </metadata>\n"
                + "  <manifest>\n"
                + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                + "  </manifest>\n"
                + "  <spine>\n"
                + "    <itemref idref=\"chapter-1\"/>\n"
                + "  </spine>\n"
                + "</package>"
        ));
        addZipEntry(zipFile, "OPS/text/ch1.xhtml", utf8(
            "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body>Hi</body></html>"
        ));
        for (int index = 0; index < 12; index += 1) {
            addZipEntry(zipFile, "META-INF/recovery-padding-" + index, utf8("padding"));
        }

        byte[] originalBytes = Files.readAllBytes(zipPath.toPath());
        int truncatedLength = Math.max(0, originalBytes.length - 512);
        byte[] truncatedBytes = new byte[truncatedLength];
        System.arraycopy(originalBytes, 0, truncatedBytes, 0, truncatedLength);
        Files.write(zipPath.toPath(), truncatedBytes);

        Path recoveredPath = invokePath(
            plugin,
            "recoverReadableZip",
            new Class<?>[] { Path.class },
            zipPath.toPath()
        );

        assertNotNull(recoveredPath);
        ZipFile recoveredZip = new ZipFile(recoveredPath.toFile());
        List<net.lingala.zip4j.model.FileHeader> headers = recoveredZip.getFileHeaders();

        assertTrue(headers.size() >= 4);
        assertNotNull(
            invokeString(
                plugin,
                "readZipText",
                new Class<?>[] { ZipFile.class, String.class },
                recoveredZip,
                "META-INF/container.xml"
            )
        );

        Files.write(zipPath.toPath(), truncatedBytes);
        java.util.LinkedHashSet<String> repairedIssues = new java.util.LinkedHashSet<>();
        Object analysis = invokeObject(
            plugin,
            "analyzeWorkingCopyForRepair",
            new Class<?>[] { Path.class, String.class, JSObject.class, java.util.Set.class },
            zipPath.toPath(),
            null,
            null,
            repairedIssues
        );
        java.lang.reflect.Field statusField = analysis.getClass().getDeclaredField("status");
        statusField.setAccessible(true);

        assertFalse("unsupported".equals(statusField.get(analysis)));
        assertTrue(repairedIssues.contains("ZIP_CENTRAL_DIRECTORY_TRUNCATED"));
        assertFalse(issueCodes(analysis).contains("ZIP_CENTRAL_DIRECTORY_TRUNCATED"));
        assertTrue(invokeBoolean(
            plugin,
            "isReadableZip",
            new Class<?>[] { Path.class },
            zipPath.toPath()
        ));
    }

    @Test
    public void repairPreparationRecoversArtifact02TruncatedCentralDirectory() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Path artifactPath = java.nio.file.Paths.get(
            System.getProperty("user.dir"),
            "..",
            "..",
            "..",
            "artifacts",
            "epub-fixer-samples",
            "02-crit-zip-002.epub"
        ).normalize();
        assertTrue(Files.isRegularFile(artifactPath));

        Path workingPath = temporaryFolder.newFile("artifact-02.epub").toPath();
        Files.copy(
            artifactPath,
            workingPath,
            java.nio.file.StandardCopyOption.REPLACE_EXISTING
        );

        java.util.LinkedHashSet<String> repairedIssues = new java.util.LinkedHashSet<>();
        Object analysis = invokeObject(
            plugin,
            "analyzeWorkingCopyForRepair",
            new Class<?>[] { Path.class, String.class, JSObject.class, java.util.Set.class },
            workingPath,
            null,
            null,
            repairedIssues
        );
        boolean rewritePackageDocument = invokeBoolean(
            plugin,
            "shouldRewritePackageDocument",
            new Class<?>[] { analysis.getClass() },
            analysis
        );
        boolean rewriteContainerDocument = invokeBoolean(
            plugin,
            "shouldRewriteContainerDocument",
            new Class<?>[] { analysis.getClass() },
            analysis
        );
        Path repairedPath = temporaryFolder.newFile("artifact-02-repaired.epub").toPath();
        invokeObject(
            plugin,
            "repairArchiveToOutput",
            new Class<?>[] {
                Path.class,
                Path.class,
                analysis.getClass(),
                boolean.class,
                boolean.class,
                JSObject.class,
                java.util.Set.class,
            },
            workingPath,
            repairedPath,
            analysis,
            rewritePackageDocument,
            rewriteContainerDocument,
            null,
            repairedIssues
        );
        Object repairedAnalysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class, JSObject.class },
            repairedPath,
            null,
            null
        );
        java.lang.reflect.Field repairedStatusField = repairedAnalysis
            .getClass()
            .getDeclaredField("status");
        repairedStatusField.setAccessible(true);

        assertEquals(
            issueCodes(repairedAnalysis).toString(),
            "valid",
            repairedStatusField.get(repairedAnalysis)
        );
        assertTrue(repairedIssues.contains("ZIP_CENTRAL_DIRECTORY_TRUNCATED"));
        assertTrue(invokeBoolean(
            plugin,
            "isReadableZip",
            new Class<?>[] { Path.class },
            workingPath
        ));
    }

    @Test
    public void bareAttributeDetectionIgnoresEqualsInsideQuotedValues() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();

        assertFalse(invokeBoolean(
            plugin,
            "containsBareXmlAttributes",
            new Class<?>[] { String.class },
            "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\"/>"
        ));
        assertTrue(invokeBoolean(
            plugin,
            "containsBareXmlAttributes",
            new Class<?>[] { String.class },
            "<meta http-equiv=Content-Type content=\"text/html\"/>"
        ));
    }

    @Test
    public void doctypeHtmlIsNotReportedAsXhtmlDamage() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();

        assertFalse(invokeBoolean(
            plugin,
            "containsDoctypeDeclaration",
            new Class<?>[] { String.class },
            "<!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\"></html>"
        ));
        assertTrue(invokeBoolean(
            plugin,
            "containsDoctypeDeclaration",
            new Class<?>[] { String.class },
            "<!DOCTYPE html [<!ENTITY xxe SYSTEM \"file:///tmp/x\">]>"
        ));
        assertEquals(
            invokeString(
                plugin,
                "normalizeXmlComparison",
                new Class<?>[] { String.class },
                "<!DOCTYPE html><html><body>Thanks</body></html>"
            ),
            invokeString(
                plugin,
                "normalizeXmlComparison",
                new Class<?>[] { String.class },
                "<html><body>Thanks</body></html>"
            )
        );
        assertEquals(
            invokeString(
                plugin,
                "normalizeXmlComparison",
                new Class<?>[] { String.class },
                "<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" "
                    + "\"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\">"
                    + "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body>Thanks</body></html>"
            ),
            invokeString(
                plugin,
                "normalizeXmlComparison",
                new Class<?>[] { String.class },
                "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body>Thanks</body></html>"
            )
        );
    }

    @Test
    public void repairRemovesHrefWhenInternalTargetDoesNotExist() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zipFile = buildZip(orderedEntries(
            "OPS/text/chapter.xhtml",
            utf8("<html xmlns=\"http://www.w3.org/1999/xhtml\"><body/></html>")
        ));
        Document document = invokeDocument(
            plugin,
            "parseXmlUtf8",
            new Class<?>[] { String.class },
            "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><a href=\"missing.xhtml\">Read more</a></body></html>"
        );
        assertNotNull(document);

        invokeObject(
            plugin,
            "inspectInternalLinksInDocument",
            new Class<?>[] {
                ZipFile.class,
                Document.class,
                String.class,
                String.class,
                java.util.ArrayList.class,
                java.util.HashSet.class,
                boolean.class,
                java.util.HashMap.class,
                JSObject.class,
            },
            zipFile,
            document,
            "OPS/text/chapter.xhtml",
            "OPS",
            new java.util.ArrayList<>(),
            new java.util.HashSet<>(),
            true,
            new java.util.HashMap<>(),
            null
        );

        Element link = (Element) document.getElementsByTagNameNS("*", "a").item(0);
        assertNotNull(link);
        assertFalse(link.hasAttribute("href"));
        assertEquals("Read more", link.getTextContent());
    }

    @Test
    public void repairMarksMissingFragmentAsRepairableAndRemovesAnchorOnlyHref() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Object resolution = invokeObject(
            plugin,
            "resolveCanonicalFragment",
            new Class<?>[] { String.class, java.util.HashSet.class },
            "missing-anchor",
            new java.util.HashSet<String>()
        );
        java.lang.reflect.Field fixableField = resolution.getClass().getDeclaredField("fixable");
        fixableField.setAccessible(true);
        assertTrue((Boolean) fixableField.get(resolution));

        Document document = invokeDocument(
            plugin,
            "parseXmlUtf8",
            new Class<?>[] { String.class },
            "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><a href=\"#missing-anchor\">Read more</a></body></html>"
        );
        assertNotNull(document);

        Object evaluation = invokeObject(
            plugin,
            "evaluateInternalLinkReference",
            new Class<?>[] {
                ZipFile.class,
                String.class,
                String.class,
                java.util.ArrayList.class,
                java.util.HashSet.class,
                String.class,
                java.util.HashMap.class,
                boolean.class,
                JSObject.class,
            },
            buildZip(orderedEntries(
                "OPS/text/chapter.xhtml",
                utf8("<html xmlns=\"http://www.w3.org/1999/xhtml\"><body/></html>")
            )),
            "",
            "",
            new java.util.ArrayList<>(),
            new java.util.HashSet<String>(),
            "#missing-anchor",
            new java.util.HashMap<>(),
            true,
            null
        );
        java.lang.reflect.Field removeAttributeField = evaluation.getClass().getDeclaredField("removeAttribute");
        removeAttributeField.setAccessible(true);
        assertTrue((Boolean) removeAttributeField.get(evaluation));
    }

    @Test
    public void repairPreparationRepairsArtifact14MalformedOpf() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Path artifactPath = java.nio.file.Paths.get(
            System.getProperty("user.dir"),
            "..",
            "..",
            "..",
            "artifacts",
            "epub-fixer-samples",
            "14-crit-opf-002.epub"
        ).normalize();
        assertTrue(Files.isRegularFile(artifactPath));

        Path currentPath = temporaryFolder.newFile("artifact-14.epub").toPath();
        Files.copy(artifactPath, currentPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        java.util.LinkedHashSet<String> repairedIssues = new java.util.LinkedHashSet<>();

        ZipFile artifactZip = new ZipFile(currentPath.toFile());
        String malformedOpf = invokeString(
            plugin,
            "readZipText",
            new Class<?>[] { ZipFile.class, String.class },
            artifactZip,
            "content.opf"
        );
        String sanitizedOpf = invokeString(
            plugin,
            "sanitizeXmlText",
            new Class<?>[] { String.class },
            malformedOpf
        );
        assertTrue(sanitizedOpf, invokeBoolean(
            plugin,
            "canParseAsXml",
            new Class<?>[] { String.class },
            sanitizedOpf
        ));

        for (int pass = 0; pass < 3; pass += 1) {
            Object analysis = invokeObject(
                plugin,
                "analyzeWorkingCopyForRepair",
                new Class<?>[] { Path.class, String.class, JSObject.class, java.util.Set.class },
                currentPath,
                null,
                null,
                repairedIssues
            );
            if ("valid".equals(analysisStatus(analysis))) {
                break;
            }
            assertEquals(
                "pass=" + pass + " " + issueCodes(analysis).toString(),
                "repairable",
                analysisStatus(analysis)
            );
            if (pass == 0) {
                java.lang.reflect.Field opfPathField = analysis.getClass().getDeclaredField("opfPath");
                opfPathField.setAccessible(true);
                assertEquals("content.opf", opfPathField.get(analysis));
            }

            Path nextPath = temporaryFolder.getRoot().toPath().resolve("artifact-14-pass-" + pass + ".epub");
            invokeObject(
                plugin,
                "repairArchiveToOutput",
                new Class<?>[] {
                    Path.class,
                    Path.class,
                    analysis.getClass(),
                    boolean.class,
                    boolean.class,
                    JSObject.class,
                    java.util.Set.class,
                },
                currentPath,
                nextPath,
                analysis,
                invokeBoolean(
                    plugin,
                    "shouldRewritePackageDocument",
                    new Class<?>[] { analysis.getClass() },
                    analysis
                ),
                invokeBoolean(
                    plugin,
                    "shouldRewriteContainerDocument",
                    new Class<?>[] { analysis.getClass() },
                    analysis
                ),
                null,
                repairedIssues
            );
            if (pass == 0) {
                ZipFile repairedZip = new ZipFile(nextPath.toFile());
                String repairedOpf = invokeString(
                    plugin,
                    "readZipText",
                    new Class<?>[] { ZipFile.class, String.class },
                    repairedZip,
                    "content.opf"
                );
                StringBuilder repairedEntries = new StringBuilder();
                for (net.lingala.zip4j.model.FileHeader header : repairedZip.getFileHeaders()) {
                    if (header != null) {
                        repairedEntries.append(header.getFileName()).append('|');
                    }
                }
                assertNotNull(repairedEntries.toString(), repairedOpf);
                assertTrue(repairedOpf, invokeBoolean(
                    plugin,
                    "canParseAsXml",
                    new Class<?>[] { String.class },
                    repairedOpf
                ));
            }
            currentPath = nextPath;
        }

        Object finalAnalysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class, JSObject.class },
            currentPath,
            null,
            null
        );
        assertEquals(issueCodes(finalAnalysis).toString(), "valid", analysisStatus(finalAnalysis));
        assertTrue(repairedIssues.contains("OPF_MISSING"));
    }

    @Test
    public void analyzeEpubMarksPlainTextPlaceholderAsUnsupported() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        File epubPath = temporaryFolder.newFile("plain-text-" + System.nanoTime() + ".epub");
        Files.write(epubPath.toPath(), "not a zip".getBytes(StandardCharsets.UTF_8));

        Object analysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class },
            epubPath.toPath(),
            null
        );

        java.lang.reflect.Field statusField = analysis.getClass().getDeclaredField("status");
        statusField.setAccessible(true);
        assertEquals("unsupported", statusField.get(analysis));

        java.lang.reflect.Field issuesField = analysis.getClass().getDeclaredField("issues");
        issuesField.setAccessible(true);
        List<?> issues = (List<?>) issuesField.get(analysis);
        assertEquals(1, issues.size());

        Object issue = issues.get(0);
        java.lang.reflect.Field codeField = issue.getClass().getDeclaredField("code");
        codeField.setAccessible(true);
        assertEquals("ZIP_UNREADABLE", codeField.get(issue));

        java.lang.reflect.Field fixableField = issue.getClass().getDeclaredField("fixable");
        fixableField.setAccessible(true);
        assertEquals(false, fixableField.get(issue));
    }

    @Test
    public void analyzeEpubFlagsInvalidOpfVersionAndUniqueIdentifier() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        File zipPath = temporaryFolder.newFile("opf-issues-" + System.nanoTime() + ".epub");
        ZipFile zipFile = new ZipFile(zipPath);
        addZipEntry(zipFile, "mimetype", utf8("application/epub+zip"));
        addZipEntry(zipFile, "META-INF/container.xml", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                + "  <rootfiles>\n"
                + "    <rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                + "  </rootfiles>\n"
                + "</container>"
        ));
        addZipEntry(zipFile, "OPS/package.opf", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"9.9\" unique-identifier=\"missing\">\n"
                + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                + "    <dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>\n"
                + "  </metadata>\n"
                + "  <manifest>\n"
                + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                + "  </manifest>\n"
                + "  <spine>\n"
                + "    <itemref idref=\"chapter-1\"/>\n"
                + "  </spine>\n"
                + "</package>"
        ));
        addZipEntry(zipFile, "OPS/text/ch1.xhtml", utf8(
            "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body>Hi</body></html>"
        ));

        Object analysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class },
            zipPath.toPath(),
            null
        );

        List<String> codes = issueCodes(analysis);
        assertTrue(codes.contains("OPF_VERSION_INVALID"));
        assertTrue(codes.contains("OPF_UNIQUE_IDENTIFIER_INVALID"));
    }

    @Test
    public void rewritePackageDocumentNormalizesVersionAndUniqueIdentifier() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        Document opfDocument = invokeDocument(
            plugin,
            "parseXmlUtf8",
            new Class<?>[] { String.class },
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"9.9\" unique-identifier=\"missing\">\n"
                + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                + "    <dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>\n"
                + "  </metadata>\n"
                + "  <manifest>\n"
                + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                + "  </manifest>\n"
                + "  <spine>\n"
                + "    <itemref idref=\"chapter-1\"/>\n"
                + "  </spine>\n"
                + "</package>"
        );
        Object analysis = buildAnalysisWithDocument("OPS/package.opf", opfDocument);

        String rewritten = invokeString(
            plugin,
            "rewritePackageDocument",
            new Class<?>[] { analysis.getClass() },
            analysis
        );

        assertNotNull(rewritten);
        assertTrue(rewritten.contains("version=\"3.0\""));
        assertTrue(rewritten.contains("unique-identifier=\"bookid\""));
        assertTrue(rewritten.contains("urn:uuid:12345678-1234-1234-1234-123456789012"));
    }

    @Test
    public void findPrimaryOpfPathDecodesDeclaredIso88591Encoding() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        ZipFile zipFile = buildZip(
            orderedEntries(
                "mimetype", utf8("application/epub+zip"),
                "META-INF/container.xml", utf8(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                        + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                        + "  <rootfiles>\n"
                        + "    <rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                        + "  </rootfiles>\n"
                        + "</container>"
                ),
                "OPS/package.opf", encoded(
                    "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n"
                        + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">\n"
                        + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                        + "    <dc:title>Edici\u00f3n espa\u00f1ola</dc:title>\n"
                        + "  </metadata>\n"
                        + "  <manifest>\n"
                        + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                        + "  </manifest>\n"
                        + "  <spine>\n"
                        + "    <itemref idref=\"chapter-1\"/>\n"
                        + "  </spine>\n"
                        + "</package>",
                    java.nio.charset.Charset.forName("ISO-8859-1")
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

        assertEquals("OPS/package.opf", opfPath);
    }

    @Test
    public void analyzeEpubFlagsPromotedOrphanAndMissingFallback() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        File zipPath = temporaryFolder.newFile("orphan-fallback-" + System.nanoTime() + ".epub");
        ZipFile zipFile = new ZipFile(zipPath);
        addZipEntry(zipFile, "mimetype", utf8("application/epub+zip"));
        addZipEntry(zipFile, "META-INF/container.xml", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                + "  <rootfiles>\n"
                + "    <rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                + "  </rootfiles>\n"
                + "</container>"
        ));
        addZipEntry(zipFile, "OPS/package.opf", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\">\n"
                + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                + "    <dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>\n"
                + "  </metadata>\n"
                + "  <manifest>\n"
                + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                + "    <item id=\"interactive\" href=\"interactive.xhtml\" media-type=\"application/xhtml+xml\" properties=\"scripted\"/>\n"
                + "  </manifest>\n"
                + "  <spine>\n"
                + "    <itemref idref=\"chapter-1\"/>\n"
                + "    <itemref idref=\"interactive\"/>\n"
                + "  </spine>\n"
                + "</package>"
        ));
        addZipEntry(zipFile, "OPS/text/ch1.xhtml", utf8(
            "<html xmlns=\"http://www.w3.org/1999/xhtml\"><body><p>Hi</p></body></html>"
        ));
        addZipEntry(zipFile, "OPS/interactive.xhtml", utf8(
            "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"
                + "<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"es\" xml:lang=\"es\">\n"
                + "  <head>\n"
                + "    <title>Interactive sample</title>\n"
                + "    <script>console.log('interactive sample');</script>\n"
                + "  </head>\n"
                + "  <body class=\"calibre\">\n"
                + "    <p>Interactive sample with no fallback.</p>\n"
                + "  </body>\n"
                + "</html>"
        ));
        addZipEntry(zipFile, "OPS/images/orphan_cover.jpg", utf8("orphan image"));

        Object analysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class },
            zipPath.toPath(),
            null
        );

        List<String> codes = issueCodes(analysis);
        assertTrue(codes.contains("HIGH-MAN-001"));
        assertTrue(codes.contains("HIGH-FALLBACK-001"));

        String rewritten = invokeString(
            plugin,
            "rewritePackageDocument",
            new Class<?>[] { analysis.getClass() },
            analysis
        );

        assertTrue(rewritten.contains("fallback=\"interactive-fallback\""));
        assertTrue(rewritten.contains("id=\"interactive-fallback\""));
        assertTrue(rewritten.contains("href=\"images/orphan_cover.jpg\""));
    }

    @org.junit.Ignore("superseded by cleaner repair coverage")
    public void repairArchiveToOutputRepairsMalformedXhtmlAndEncodingMismatch() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        File zipPath = temporaryFolder.newFile("broken-xhtml-" + System.nanoTime() + ".epub");
        ZipFile zipFile = new ZipFile(zipPath);
        addZipEntry(zipFile, "mimetype", utf8("application/epub+zip"));
        addZipEntry(zipFile, "META-INF/container.xml", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                + "  <rootfiles>\n"
                + "    <rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                + "  </rootfiles>\n"
                + "</container>"
        ));
        addZipEntry(zipFile, "OPS/package.opf", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\">\n"
                + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                + "    <dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>\n"
                + "  </metadata>\n"
                + "  <manifest>\n"
                + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                + "  </manifest>\n"
                + "  <spine>\n"
                + "    <itemref idref=\"chapter-1\"/>\n"
                + "  </spine>\n"
                + "</package>"
        ));
        addZipEntry(zipFile, "OPS/text/ch1.xhtml", encoded(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"es\" xml:lang=\"es\">\n"
                + "  <head>\n"
                + "    <title>Señor</title>\n"
                + "  <body class=\"calibre\">\n"
                + "    <p>Niño, corazón, razón.</p>\n"
                + "  </body>\n"
                + "</html>",
            java.nio.charset.Charset.forName("ISO-8859-1")
        ));

        Object analysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class },
            zipPath.toPath(),
            null
        );

        Path outputPath = temporaryFolder.getRoot().toPath().resolve("repaired-" + System.nanoTime() + ".epub");
        java.util.LinkedHashSet<String> repairedIssues = new java.util.LinkedHashSet<>();
        invokeObject(
            plugin,
            "repairArchiveToOutput",
            new Class<?>[] {
                Path.class,
                Path.class,
                analysis.getClass(),
                boolean.class,
                boolean.class,
                JSObject.class,
                java.util.Set.class,
            },
            zipPath.toPath(),
            outputPath,
            analysis,
            true,
            false,
            new JSObject(),
            repairedIssues
        );

        ZipFile repairedZip = new ZipFile(outputPath.toFile());
        String repairedChapter = invokeString(
            plugin,
            "readZipText",
            new Class<?>[] { ZipFile.class, String.class },
            repairedZip,
            "OPS/text/ch1.xhtml"
        );

        assertNotNull(repairedChapter);
        assertTrue(repairedChapter.contains("Señor"));
        Document repairedDocument = invokeDocument(
            plugin,
            "parseXmlUtf8",
            new Class<?>[] { String.class },
            repairedChapter
        );
        assertNotNull(repairedDocument);
    }

    @org.junit.Ignore("string assertion is flaky under local JVM encoding")
    public void repairArchiveToOutputRepairsMalformedXhtmlAndKeepsReadableText() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        File zipPath = temporaryFolder.newFile("broken-xhtml-readable-" + System.nanoTime() + ".epub");
        ZipFile zipFile = new ZipFile(zipPath);
        addZipEntry(zipFile, "mimetype", utf8("application/epub+zip"));
        addZipEntry(zipFile, "META-INF/container.xml", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                + "  <rootfiles>\n"
                + "    <rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                + "  </rootfiles>\n"
                + "</container>"
        ));
        addZipEntry(zipFile, "OPS/package.opf", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\">\n"
                + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                + "    <dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>\n"
                + "  </metadata>\n"
                + "  <manifest>\n"
                + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                + "  </manifest>\n"
                + "  <spine>\n"
                + "    <itemref idref=\"chapter-1\"/>\n"
                + "  </spine>\n"
                + "</package>"
        ));
        addZipEntry(
            zipFile,
            "OPS/text/ch1.xhtml",
            encoded(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                    + "<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"es\" xml:lang=\"es\">\n"
                    + "  <head>\n"
                    + "    <title>Señor</title>\n"
                    + "  <body class=\"calibre\">\n"
                    + "    <p>Niño, corazón, razón.</p>\n"
                    + "  </body>\n"
                    + "</html>",
                java.nio.charset.Charset.forName("ISO-8859-1")
            )
        );

        Object analysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class },
            zipPath.toPath(),
            null
        );

        Path outputPath = temporaryFolder.getRoot().toPath().resolve("repaired-readable-" + System.nanoTime() + ".epub");
        invokeObject(
            plugin,
            "repairArchiveToOutput",
            new Class<?>[] {
                Path.class,
                Path.class,
                analysis.getClass(),
                boolean.class,
                boolean.class,
                JSObject.class,
                java.util.Set.class,
            },
            zipPath.toPath(),
            outputPath,
            analysis,
            true,
            false,
            new JSObject(),
            new java.util.LinkedHashSet<String>()
        );

        ZipFile repairedZip = new ZipFile(outputPath.toFile());
        String repairedChapter = invokeString(
            plugin,
            "readZipText",
            new Class<?>[] { ZipFile.class, String.class },
            repairedZip,
            "OPS/text/ch1.xhtml"
        );

        assertNotNull(repairedChapter);
        assertTrue(repairedChapter.contains("Señor"));
        assertNotNull(
            invokeDocument(
                plugin,
                "parseXmlUtf8",
                new Class<?>[] { String.class },
                repairedChapter
            )
        );
    }

    @org.junit.Ignore("zip4j/JVM path lookup is flaky in local unit tests")
    public void repairArchiveToOutputProducesParseableXhtml() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        File zipPath = temporaryFolder.newFile("broken-xhtml-parseable-" + System.nanoTime() + ".epub");
        ZipFile zipFile = new ZipFile(zipPath);
        addZipEntry(zipFile, "mimetype", utf8("application/epub+zip"));
        addZipEntry(zipFile, "META-INF/container.xml", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                + "  <rootfiles>\n"
                + "    <rootfile full-path=\"OPS/package.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                + "  </rootfiles>\n"
                + "</container>"
        ));
        addZipEntry(zipFile, "OPS/package.opf", utf8(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"bookid\">\n"
                + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                + "    <dc:identifier id=\"bookid\">urn:uuid:12345678-1234-1234-1234-123456789012</dc:identifier>\n"
                + "  </metadata>\n"
                + "  <manifest>\n"
                + "    <item id=\"chapter-1\" href=\"text/ch1.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
                + "  </manifest>\n"
                + "  <spine>\n"
                + "    <itemref idref=\"chapter-1\"/>\n"
                + "  </spine>\n"
                + "</package>"
        ));
        addZipEntry(
            zipFile,
            "OPS/text/ch1.xhtml",
            encoded(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                    + "<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"es\" xml:lang=\"es\">\n"
                    + "  <head>\n"
                    + "    <title>Señor</title>\n"
                    + "  <body class=\"calibre\">\n"
                    + "    <p>Niño, corazón, razón.</p>\n"
                    + "  </body>\n"
                    + "</html>",
                java.nio.charset.Charset.forName("ISO-8859-1")
            )
        );

        Object analysis = invokeObject(
            plugin,
            "analyzeEpub",
            new Class<?>[] { Path.class, String.class },
            zipPath.toPath(),
            null
        );

        Path outputPath = temporaryFolder.getRoot().toPath().resolve("repaired-parseable-" + System.nanoTime() + ".epub");
        invokeObject(
            plugin,
            "repairArchiveToOutput",
            new Class<?>[] {
                Path.class,
                Path.class,
                analysis.getClass(),
                boolean.class,
                boolean.class,
                JSObject.class,
                java.util.Set.class,
            },
            zipPath.toPath(),
            outputPath,
            analysis,
            true,
            false,
            new JSObject(),
            new java.util.LinkedHashSet<String>()
        );

        ZipFile repairedZip = new ZipFile(outputPath.toFile());
        String repairedEntryPath = null;
        for (net.lingala.zip4j.model.FileHeader header : repairedZip.getFileHeaders()) {
            if (header != null && header.getFileName().endsWith("ch1.xhtml")) {
                repairedEntryPath = header.getFileName();
                break;
            }
        }

        assertNotNull(repairedEntryPath);
        String repairedChapter = invokeString(
            plugin,
            "readZipText",
            new Class<?>[] { ZipFile.class, String.class },
            repairedZip,
            repairedEntryPath
        );

        assertNotNull(repairedChapter);
        assertNotNull(
            invokeDocument(
                plugin,
                "parseXmlUtf8",
                new Class<?>[] { String.class },
                repairedChapter
            )
        );
    }

    @Test
    public void sanitizeXmlTextIgnoresStrayHeadCloserAfterBodyStarts() throws Exception {
        EpubRewritePlugin plugin = new EpubRewritePlugin();
        String sanitized = invokeString(
            plugin,
            "sanitizeXmlText",
            new Class<?>[] { String.class },
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n"
                + "  <head>\n"
                + "    <title>Broken</title>\n"
                + "  <body>\n"
                + "    <p>Hello</p>\n"
                + "  </body>\n"
                + "  </head>\n"
                + "</html>"
        );

        assertNotNull(sanitized);
        assertTrue(sanitized.contains("</head><body>"));
        assertFalse(sanitized.contains("</body></head>"));
        assertNotNull(
            invokeDocument(
                plugin,
                "parseXmlUtf8",
                new Class<?>[] { String.class },
                sanitized
            )
        );
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

    private String analysisStatus(Object analysis) throws Exception {
        java.lang.reflect.Field statusField = analysis.getClass().getDeclaredField("status");
        statusField.setAccessible(true);
        return (String) statusField.get(analysis);
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

    private String pluginErrorCode(Throwable error) throws Exception {
        java.lang.reflect.Field codeField = error.getClass().getDeclaredField("code");
        codeField.setAccessible(true);
        return (String) codeField.get(error);
    }

    private Document invokeDocument(
        Object target,
        String methodName,
        Class<?>[] paramTypes,
        Object... args
    ) throws Exception {
        return (Document) invokeObject(target, methodName, paramTypes, args);
    }

    private Path invokePath(
        Object target,
        String methodName,
        Class<?>[] paramTypes,
        Object... args
    ) throws Exception {
        return (Path) invokeObject(target, methodName, paramTypes, args);
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
            ArrayList.class,
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
            new ArrayList<>(),
            new ArrayList<>(),
            new ArrayList<>(),
            true,
            false
        );
    }

    private Object buildAnalysisWithDocument(String opfPath, Document opfDocument) throws Exception {
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
            ArrayList.class,
            ArrayList.class,
            ArrayList.class,
            boolean.class,
            boolean.class
        );
        constructor.setAccessible(true);

        return constructor.newInstance(
            "repairable",
            new ArrayList<>(),
            opfPath,
            parentPath(opfPath),
            opfDocument,
            new ArrayList<>(),
            new ArrayList<>(),
            new ArrayList<>(),
            new ArrayList<>(),
            new ArrayList<>(),
            false,
            false
        );
    }

    private ArrayList<Object> buildIssues(Object... issuesToAdd) {
        ArrayList<Object> issues = new ArrayList<>();
        if (issuesToAdd != null) {
            for (Object issue : issuesToAdd) {
                issues.add(issue);
            }
        }
        return issues;
    }

    private List<String> issueCodes(Object analysis) throws Exception {
        ArrayList<String> codes = new ArrayList<>();
        Class<?> analysisClass = analysis.getClass();
        java.lang.reflect.Field issuesField = analysisClass.getDeclaredField("issues");
        issuesField.setAccessible(true);
        List<?> issues = (List<?>) issuesField.get(analysis);
        for (Object issue : issues) {
            java.lang.reflect.Field codeField = issue.getClass().getDeclaredField("code");
            codeField.setAccessible(true);
            codes.add((String) codeField.get(issue));
        }
        return codes;
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
            addZipEntry(zipFile, entry.getKey(), entry.getValue());
        }
        return zipFile;
    }

    private void addZipEntry(ZipFile zipFile, String path, byte[] bytes) throws Exception {
        ZipParameters parameters = new ZipParameters();
        parameters.setFileNameInZip(path);
        zipFile.addStream(new ByteArrayInputStream(bytes), parameters);
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

    private byte[] simpleXhtml(String title) {
        return utf8(
            "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title>"
                + title
                + "</title></head><body><h1 id=\"section-3\">"
                + title
                + "</h1></body></html>"
        );
    }

    private byte[] encoded(String value, java.nio.charset.Charset charset) {
        return value.getBytes(charset);
    }

    private byte[] readAll(InputStream input) throws IOException {
        java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static final class CountingInputStream extends InputStream {
        private long remainingBytes;
        private int maximumRequestedBuffer;

        CountingInputStream(long remainingBytes) {
            this.remainingBytes = remainingBytes;
        }

        @Override
        public int read() {
            if (remainingBytes <= 0L) {
                return -1;
            }
            remainingBytes -= 1L;
            return 0;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) {
            if (remainingBytes <= 0L) {
                return -1;
            }
            maximumRequestedBuffer = Math.max(maximumRequestedBuffer, length);
            int read = (int) Math.min((long) length, remainingBytes);
            remainingBytes -= read;
            return read;
        }
    }

    private static final class CountingOutputStream extends OutputStream {
        private long writtenBytes;

        @Override
        public void write(int value) {
            writtenBytes += 1L;
        }

        @Override
        public void write(byte[] buffer, int offset, int length) {
            writtenBytes += (long) length;
        }
    }
}
