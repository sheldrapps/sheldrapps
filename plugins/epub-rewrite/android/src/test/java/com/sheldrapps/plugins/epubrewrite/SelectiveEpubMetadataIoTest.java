package com.sheldrapps.plugins.epubrewrite;

import com.getcapacitor.JSObject;

import org.apache.commons.compress.archivers.zip.Zip64Mode;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream;
import org.apache.commons.compress.archivers.zip.ZipFile;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

public class SelectiveEpubMetadataIoTest {
    @Rule
    public TemporaryFolder temporaryFolder = new TemporaryFolder();

    @Test
    public void readsOnlyThePackageMetadataModel() throws Exception {
        Path source = createEpub();

        assertNotNull(SelectiveEpubMetadataIo.read(source, () -> false));
    }

    @Test
    public void rewritesOnlyOpfAndPreservesRawContentEntries() throws Exception {
        Path source = createEpub();
        byte[] originalXhtml = rawEntry(source, "OPS/text/chapter.xhtml");
        byte[] originalImage = rawEntry(source, "OPS/images/cover.jpg");
        Path output = temporaryFolder.newFile("rewritten.epub").toPath();

        SelectiveEpubMetadataIo.rewrite(source, output, updatedMetadata(), () -> false);

        assertArrayEquals(originalXhtml, rawEntry(output, "OPS/text/chapter.xhtml"));
        assertArrayEquals(originalImage, rawEntry(output, "OPS/images/cover.jpg"));
        String updatedOpf = entryText(output, "OPS/package.opf");
        assertTrue(updatedOpf.contains("Updated title"));
        assertTrue(rawEntry(source, "OPS/package.opf").length != rawEntry(output, "OPS/package.opf").length);
        assertNotNull(SelectiveEpubMetadataIo.read(output, () -> false));
    }

    private Path createEpub() throws Exception {
        Path source = temporaryFolder.newFile("source.epub").toPath();
        try (ZipArchiveOutputStream output = new ZipArchiveOutputStream(source.toFile())) {
            output.setEncoding("UTF-8");
            output.setUseZip64(Zip64Mode.AsNeeded);
            writeStored(output, "mimetype", "application/epub+zip");
            writeDeflated(output, "META-INF/container.xml", containerXml());
            writeDeflated(output, "OPS/package.opf", originalOpf());
            writeDeflated(output, "OPS/text/chapter.xhtml", "<html><body>Chapter</body></html>");
            writeDeflated(output, "OPS/images/cover.jpg", "not-really-an-image");
        }
        return source;
    }

    private JSObject updatedMetadata() {
        return new JsonMetadata("{\"title\":\"Updated title\",\"creators\":[{\"name\":\"Updated Author\",\"role\":\"aut\"}],\"language\":\"en\",\"identifier\":{\"value\":\"urn:uuid:updated\",\"scheme\":\"uuid\"},\"subjects\":[],\"contributors\":[]}");
    }

    private String containerXml() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            + "<container xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">"
            + "<rootfiles><rootfile full-path=\"OPS/package.opf\" "
            + "media-type=\"application/oebps-package+xml\"/></rootfiles></container>";
    }

    private String originalOpf() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            + "<package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"book-id\">"
            + "<metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">"
            + "<dc:title>Original title</dc:title>"
            + "<dc:creator id=\"creator-1\">Author</dc:creator>"
            + "<meta refines=\"#creator-1\" property=\"role\">aut</meta>"
            + "<dc:language>en</dc:language>"
            + "<dc:identifier id=\"book-id\">urn:uuid:original</dc:identifier>"
            + "</metadata><manifest/><spine/></package>";
    }

    private void writeStored(ZipArchiveOutputStream output, String name, String value) throws IOException {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        ZipArchiveEntry entry = new ZipArchiveEntry(name);
        entry.setMethod(ZipEntry.STORED);
        entry.setSize(bytes.length);
        entry.setCompressedSize(bytes.length);
        CRC32 crc = new CRC32();
        crc.update(bytes);
        entry.setCrc(crc.getValue());
        output.putArchiveEntry(entry);
        output.write(bytes);
        output.closeArchiveEntry();
    }

    private void writeDeflated(ZipArchiveOutputStream output, String name, String value) throws IOException {
        ZipArchiveEntry entry = new ZipArchiveEntry(name);
        entry.setMethod(ZipEntry.DEFLATED);
        output.putArchiveEntry(entry);
        output.write(value.getBytes(StandardCharsets.UTF_8));
        output.closeArchiveEntry();
    }

    private String entryText(Path archivePath, String name) throws Exception {
        try (ZipFile zip = new ZipFile(archivePath.toFile());
             InputStream input = zip.getInputStream(zip.getEntry(name));
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private byte[] rawEntry(Path archivePath, String name) throws Exception {
        try (ZipFile zip = new ZipFile(archivePath.toFile())) {
            ZipArchiveEntry entry = zip.getEntry(name);
            assertNotNull(entry);
            try (InputStream input = zip.getRawInputStream(entry);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                return output.toByteArray();
            }
        }
    }

    private static final class JsonMetadata extends JSObject {
        private final String json;

        private JsonMetadata(String json) {
            this.json = json;
        }

        @Override
        public String getString(String key, String defaultValue) {
            return "title".equals(key) ? "Updated title" : defaultValue;
        }

        @Override
        public String toString() {
            return json;
        }
    }
}
