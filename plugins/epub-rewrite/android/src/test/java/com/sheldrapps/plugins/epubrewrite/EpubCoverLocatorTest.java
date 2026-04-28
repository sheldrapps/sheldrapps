package com.sheldrapps.plugins.epubrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import net.lingala.zip4j.ZipFile;
import net.lingala.zip4j.model.FileHeader;
import net.lingala.zip4j.model.ZipParameters;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class EpubCoverLocatorTest {
    @Rule
    public TemporaryFolder temporaryFolder = new TemporaryFolder();

    private final EpubCoverLocator locator = new EpubCoverLocator();

    @Test
    public void findsEpub3CoverFromUtf8Opf() throws Exception {
        ZipFile zipFile = buildZip(
            Map.of(
                "META-INF/container.xml", utf8(containerXml("OPS/package.opf")),
                "OPS/package.opf", utf8(epub3Opf("images/cover.png")),
                "OPS/images/cover.png", imageBytes()
            )
        );

        String coverPath = locator.findCoverEntryPath(zipFile, zipFile.getFileHeaders());

        assertEquals("OPS/images/cover.png", coverPath);
    }

    @Test
    public void findsEpub2CoverFromDeclaredIso88591Opf() throws Exception {
        ZipFile zipFile = buildZip(
            orderedEntries(
                "META-INF/container.xml", utf8(containerXml("OEBPS/content.opf")),
                "OEBPS/content.opf", encoded(
                    "<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?>\n"
                        + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"2.0\">\n"
                        + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
                        + "    <dc:title>Edición española</dc:title>\n"
                        + "    <meta name=\"cover\" content=\"main-cover\"/>\n"
                        + "  </metadata>\n"
                        + "  <manifest>\n"
                        + "    <item id=\"main-cover\" href=\"../images/portada.jpg\" media-type=\"image/jpeg\"/>\n"
                        + "  </manifest>\n"
                        + "</package>",
                    Charset.forName("ISO-8859-1")
                ),
                "images/portada.jpg", imageBytes()
            )
        );

        String coverPath = locator.findCoverEntryPath(zipFile, zipFile.getFileHeaders());

        assertEquals("images/portada.jpg", coverPath);
    }

    @Test
    public void fallsBackToFirstImageWhenMetadataHasNoCoverHints() throws Exception {
        ZipFile zipFile = buildZip(
            orderedEntries(
                "META-INF/container.xml", utf8(containerXml("OEBPS/content.opf")),
                "OEBPS/content.opf", utf8(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                        + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">\n"
                        + "  <manifest>\n"
                        + "    <item id=\"illustration\" href=\"images/frontispiece.png\" media-type=\"image/png\"/>\n"
                        + "    <item id=\"other\" href=\"images/back.jpg\" media-type=\"image/jpeg\"/>\n"
                        + "  </manifest>\n"
                        + "</package>"
                ),
                "OEBPS/images/frontispiece.png", imageBytes(),
                "OEBPS/images/back.jpg", imageBytes()
            )
        );

        String coverPath = locator.findCoverEntryPath(zipFile, zipFile.getFileHeaders());

        assertEquals("OEBPS/images/frontispiece.png", coverPath);
    }

    @Test
    public void rejectsContainerXmlWithDoctype() throws Exception {
        ZipFile zipFile = buildZip(
            orderedEntries(
                "META-INF/container.xml", utf8(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                        + "<!DOCTYPE container [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]>\n"
                        + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
                        + "  <rootfiles>\n"
                        + "    <rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>\n"
                        + "  </rootfiles>\n"
                        + "</container>"
                ),
                "OEBPS/content.opf", utf8(epub3Opf("images/cover.png")),
                "OEBPS/images/cover.png", imageBytes()
            )
        );

        assertThrows(
            IOException.class,
            () -> locator.findCoverEntryPath(zipFile, zipFile.getFileHeaders())
        );
    }

    private ZipFile buildZip(Map<String, byte[]> entries) throws IOException {
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

    private byte[] encoded(String value, Charset charset) {
        return value.getBytes(charset);
    }

    private byte[] imageBytes() {
        return new byte[] { 1, 2, 3, 4 };
    }

    private String containerXml(String opfPath) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
            + "  <rootfiles>\n"
            + "    <rootfile full-path=\"" + opfPath + "\" media-type=\"application/oebps-package+xml\"/>\n"
            + "  </rootfiles>\n"
            + "</container>";
    }

    private String epub3Opf(String coverHref) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\">\n"
            + "  <manifest>\n"
            + "    <item id=\"cover\" href=\"" + coverHref + "\" media-type=\"image/png\" properties=\"cover-image\"/>\n"
            + "  </manifest>\n"
            + "</package>";
    }
}
