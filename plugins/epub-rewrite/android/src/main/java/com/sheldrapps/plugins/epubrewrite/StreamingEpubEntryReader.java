package com.sheldrapps.plugins.epubrewrite;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.SequenceInputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import net.lingala.zip4j.ZipFile;
import net.lingala.zip4j.model.FileHeader;

final class StreamingEpubEntryReader {
    static final int BUFFER_SIZE = 128 * 1024;
    static final int TEXT_TAIL_CHARS = 64 * 1024;
    static final int ENCODING_PROBE_BYTES = 8 * 1024;

    private static final Pattern XML_ENCODING_PATTERN = Pattern.compile(
        "<\\?xml\\b[^>]*\\bencoding\\s*=\\s*(['\"])([^'\"]+)\\1",
        Pattern.CASE_INSENSITIVE
    );

    interface TextTransform {
        String transform(String chunk, boolean finalChunk) throws IOException;
    }

    private final ZipFile zipFile;

    StreamingEpubEntryReader(ZipFile zipFile) {
        this.zipFile = zipFile;
    }

    void transformText(FileHeader header, TextTransform transform) throws IOException {
        try (InputStream input = new BufferedInputStream(zipFile.getInputStream(header))) {
            TextInput textInput = openTextInput(input);
            try (BufferedReader reader = new BufferedReader(textInput.reader, BUFFER_SIZE)) {
                transformReader(reader, transform);
            }
        }
    }

    private TextInput openTextInput(InputStream input) throws IOException {
        byte[] probe = new byte[ENCODING_PROBE_BYTES];
        int probeLength = 0;
        while (probeLength < probe.length) {
            int read = input.read(probe, probeLength, probe.length - probeLength);
            if (read == -1) {
                break;
            }
            if (read == 0) {
                continue;
            }
            probeLength += read;
            if (probeLength >= 4 && probe[probeLength - 1] == '>') {
                break;
            }
        }

        int offset = 0;
        Charset charset = StandardCharsets.UTF_8;
        if (hasPrefix(probe, probeLength, 0xEF, 0xBB, 0xBF)) {
            offset = 3;
            charset = StandardCharsets.UTF_8;
        } else if (hasPrefix(probe, probeLength, 0xFE, 0xFF)) {
            offset = 2;
            charset = StandardCharsets.UTF_16BE;
        } else if (hasPrefix(probe, probeLength, 0xFF, 0xFE)) {
            offset = 2;
            charset = StandardCharsets.UTF_16LE;
        } else {
            String declaration = new String(
                probe,
                0,
                probeLength,
                StandardCharsets.ISO_8859_1
            );
            Matcher matcher = XML_ENCODING_PATTERN.matcher(declaration);
            if (matcher.find()) {
                try {
                    charset = Charset.forName(matcher.group(2).trim());
                } catch (Exception ignored) {
                    charset = StandardCharsets.UTF_8;
                }
            }
        }

        InputStream prefix = new ByteArrayInputStream(probe, offset, probeLength - offset);
        return new TextInput(
            new InputStreamReader(
                new SequenceInputStream(prefix, input),
                charset
            )
        );
    }

    private void transformReader(BufferedReader reader, TextTransform transform) throws IOException {
        char[] buffer = new char[BUFFER_SIZE];
        StringBuilder pending = new StringBuilder();
        int read;
        while ((read = reader.read(buffer)) != -1) {
            pending.append(buffer, 0, read);
            int stableLength = pending.length() - TEXT_TAIL_CHARS;
            if (stableLength <= 0) {
                continue;
            }
            int lastOpenTag = pending.lastIndexOf("<", stableLength - 1);
            int lastClosedTag = pending.lastIndexOf(">", stableLength - 1);
            if (lastOpenTag > lastClosedTag) {
                stableLength = lastOpenTag;
            }
            if (stableLength <= 0) {
                continue;
            }
            String stableChunk = pending.substring(0, stableLength);
            pending.delete(0, stableLength);
            transform.transform(stableChunk, false);
        }
        transform.transform(pending.toString(), true);
    }

    private boolean hasPrefix(byte[] bytes, int length, int... expected) {
        if (length < expected.length) {
            return false;
        }
        for (int index = 0; index < expected.length; index++) {
            if ((bytes[index] & 0xFF) != expected[index]) {
                return false;
            }
        }
        return true;
    }

    private static final class TextInput {
        final InputStreamReader reader;

        TextInput(InputStreamReader reader) {
            this.reader = reader;
        }
    }
}
