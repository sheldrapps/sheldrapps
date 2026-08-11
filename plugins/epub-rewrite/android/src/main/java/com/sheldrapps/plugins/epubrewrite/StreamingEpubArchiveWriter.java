package com.sheldrapps.plugins.epubrewrite;

import java.io.BufferedInputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;

import org.apache.commons.compress.archivers.zip.Zip64Mode;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream;
import org.apache.commons.compress.archivers.zip.ZipFile;

final class StreamingEpubArchiveWriter implements Closeable {
    static final int BUFFER_SIZE = 256 * 1024;
    static final long MAX_IN_MEMORY_ENTRY_BYTES = 4L * 1024L * 1024L;
    static final int MAX_OUTPUT_ENTRIES = 100_000;

    private final ZipArchiveOutputStream output;
    private final Set<String> writtenNames = new HashSet<>();
    private final byte[] buffer = new byte[BUFFER_SIZE];
    private boolean closed;

    StreamingEpubArchiveWriter(Path outputPath) throws IOException {
        output = new ZipArchiveOutputStream(outputPath.toFile());
        output.setEncoding("UTF-8");
        output.setUseLanguageEncodingFlag(true);
        output.setFallbackToUTF8(true);
        output.setUseZip64(Zip64Mode.AsNeeded);
        output.setLevel(java.util.zip.Deflater.BEST_SPEED);
    }

    void writeStoredBytes(String name, byte[] bytes) throws IOException {
        requireMemorySize(bytes == null ? 0 : bytes.length);
        ZipArchiveEntry entry = new ZipArchiveEntry(requireNewName(name));
        entry.setMethod(ZipEntry.STORED);
        entry.setSize(bytes.length);
        entry.setCompressedSize(bytes.length);
        entry.setCrc(crc32(bytes));
        output.putArchiveEntry(entry);
        output.write(bytes);
        output.closeArchiveEntry();
    }

    void writeDeflatedBytes(String name, byte[] bytes) throws IOException {
        requireMemorySize(bytes == null ? 0 : bytes.length);
        ZipArchiveEntry entry = new ZipArchiveEntry(requireNewName(name));
        entry.setMethod(ZipEntry.DEFLATED);
        entry.setSize(bytes.length);
        output.putArchiveEntry(entry);
        output.write(bytes);
        output.closeArchiveEntry();
    }

    void writeDeflatedStream(String name, InputStream input) throws IOException {
        ZipArchiveEntry entry = new ZipArchiveEntry(requireNewName(name));
        entry.setMethod(ZipEntry.DEFLATED);
        output.putArchiveEntry(entry);
        copy(input, output);
        output.closeArchiveEntry();
    }

    void writeStoredFile(String name, Path sourcePath) throws IOException {
        ZipArchiveEntry entry = new ZipArchiveEntry(requireNewName(name));
        long size = Files.size(sourcePath);
        entry.setMethod(ZipEntry.STORED);
        entry.setSize(size);
        entry.setCompressedSize(size);
        entry.setCrc(crc32(sourcePath));
        output.putArchiveEntry(entry);
        try (InputStream input = new BufferedInputStream(Files.newInputStream(sourcePath))) {
            copy(input, output);
        }
        output.closeArchiveEntry();
    }

    void writeRaw(
        ZipFile source,
        ZipArchiveEntry sourceEntry,
        String outputName
    ) throws IOException {
        if (sourceEntry == null) {
            throw new IOException("EPUB source entry is missing");
        }
        if (sourceEntry.isDirectory()) {
            return;
        }
        if (!source.canReadEntryData(sourceEntry)) {
            throw new IOException("Unsupported EPUB entry: " + sourceEntry.getName());
        }
        if (sourceEntry.getGeneralPurposeBit().usesEncryption()) {
            throw new IOException("Encrypted EPUB entries are not supported");
        }
        int method = sourceEntry.getMethod();
        if (method != ZipEntry.STORED && method != ZipEntry.DEFLATED) {
            throw new IOException("Unsupported EPUB compression method: " + method);
        }

        try (InputStream rawInput = source.getRawInputStream(sourceEntry)) {
            writeRaw(
                outputName,
                method,
                sourceEntry.getSize(),
                sourceEntry.getCompressedSize(),
                sourceEntry.getCrc(),
                sourceEntry.getLastModifiedDate(),
                rawInput
            );
        }
    }

    void writeRaw(
        String outputName,
        int method,
        long size,
        long compressedSize,
        long crc,
        Date modified,
        InputStream rawInput
    ) throws IOException {
        if (method != ZipEntry.STORED && method != ZipEntry.DEFLATED) {
            throw new IOException("Unsupported EPUB compression method: " + method);
        }
        ZipArchiveEntry target = new ZipArchiveEntry(requireNewName(outputName));
        target.setMethod(method);
        target.setSize(size);
        target.setCompressedSize(compressedSize);
        target.setCrc(crc);
        if (modified != null) {
            target.setTime(modified.getTime());
        }
        output.addRawArchiveEntry(target, rawInput);
    }

    private String requireNewName(String name) throws IOException {
        if (name == null || name.trim().isEmpty()) {
            throw new IOException("EPUB entry name is empty");
        }
        String normalized = name.replace('\\', '/');
        if (normalized.startsWith("/") || normalized.contains("../") || normalized.equals("..")) {
            throw new IOException("Unsafe EPUB entry name: " + name);
        }
        if (writtenNames.size() >= MAX_OUTPUT_ENTRIES) {
            throw new IOException("EPUB archive exceeds the safe entry-count limit");
        }
        if (!writtenNames.add(normalized)) {
            throw new IOException("Duplicate EPUB output entry: " + normalized);
        }
        return normalized;
    }

    private void requireMemorySize(long size) throws IOException {
        if (size > MAX_IN_MEMORY_ENTRY_BYTES) {
            throw new IOException("EPUB transformed entry exceeds the in-memory safety limit");
        }
    }

    private long crc32(byte[] bytes) {
        CRC32 crc = new CRC32();
        crc.update(bytes);
        return crc.getValue();
    }

    private long crc32(Path sourcePath) throws IOException {
        CRC32 crc = new CRC32();
        try (InputStream input = new BufferedInputStream(Files.newInputStream(sourcePath))) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                crc.update(buffer, 0, read);
            }
        }
        return crc.getValue();
    }

    private void copy(InputStream input, OutputStream destination) throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        int read;
        while ((read = input.read(buffer)) != -1) {
            destination.write(buffer, 0, read);
        }
    }

    @Override
    public void close() throws IOException {
        if (closed) {
            return;
        }
        closed = true;
        output.finish();
        output.close();
    }
}
