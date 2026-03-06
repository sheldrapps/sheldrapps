package com.sheldrapps.plugins.epubrewrite;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.StatFs;
import android.provider.OpenableColumns;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import net.lingala.zip4j.ZipFile;
import net.lingala.zip4j.exception.ZipException;
import net.lingala.zip4j.model.FileHeader;
import net.lingala.zip4j.model.ZipParameters;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.CRC32;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.lingala.zip4j.model.enums.CompressionMethod;
import androidx.activity.result.ActivityResult;

@CapacitorPlugin(name = "EpubRewritePlugin")
public class EpubRewritePlugin extends Plugin {
    private static final String TAG = "EpubRewritePlugin";
    private static final boolean DEBUG_IO = false;
    private static final int BUFFER_SIZE = 32 * 1024;
    private static final long STORAGE_MARGIN_BYTES = 64L * 1024L * 1024L;
    private static final String WORK_FOLDER = "EPUBCoverChangerWork";
    private static final DateTimeFormatter WORK_TIMESTAMP_FORMAT =
        DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss", Locale.US);
    private static final Pattern CONTAINER_OPF_PATTERN =
        Pattern.compile("full-path\\s*=\\s*[\"']([^\"']+)[\"']", Pattern.CASE_INSENSITIVE);
    private static final Pattern XML_TAG_PATTERN =
        Pattern.compile("<(item|meta)\\b[^>]*>", Pattern.CASE_INSENSITIVE);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);

    @PluginMethod
    public void inspectEpub(PluginCall call) {
        runExclusive(call, "inspect", this::inspectEpubInternal);
    }

    @PluginMethod
    public void rewriteCover(PluginCall call) {
        runExclusive(call, "rewrite", this::rewriteCoverInternal);
    }

    @PluginMethod
    public void extractCoverAsset(PluginCall call) {
        runExclusive(call, "extract_cover", this::extractCoverAssetInternal);
    }

    @PluginMethod
    public void createEpubFromCover(PluginCall call) {
        runExclusive(call, "create_epub", this::createEpubFromCoverInternal);
    }

    @PluginMethod
    public void pickAndPrepareEpub(PluginCall call) {
        if (!busy.compareAndSet(false, true)) {
            call.resolve(errorResult("BUSY", null, "pick_prepare"));
            return;
        }

        cancelRequested.set(false);

        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/epub+zip");
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
        );
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/epub+zip",
            "application/octet-stream"
        });

        try {
            startActivityForResult(call, intent, "onPickAndPrepareEpubResult");
        } catch (Exception ex) {
            cancelRequested.set(false);
            busy.set(false);
            call.resolve(errorResult("PICK_FAILED", ex.getMessage(), "pick_prepare"));
        }
    }

    @ActivityCallback
    private void onPickAndPrepareEpubResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) {
            cancelRequested.set(false);
            busy.set(false);
            return;
        }

        if (activityResult == null || activityResult.getResultCode() != Activity.RESULT_OK) {
            cancelRequested.set(false);
            busy.set(false);
            call.resolve(errorResult("PICK_CANCELLED", null, "pick_prepare"));
            return;
        }

        Intent data = activityResult.getData();
        Uri selectedUri = data == null ? null : data.getData();
        if (selectedUri == null) {
            cancelRequested.set(false);
            busy.set(false);
            call.resolve(errorResult("PICK_CANCELLED", null, "pick_prepare"));
            return;
        }
        try {
            int grantFlags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if ((grantFlags & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0) {
                getContext().getContentResolver().takePersistableUriPermission(
                    selectedUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            }
        } catch (SecurityException ignored) {
            // Some providers do not support persistable grants; temporary read grant is still valid.
        } catch (Exception ignored) {
            // Best effort only.
        }

        executor.execute(() -> {
            try {
                call.resolve(pickAndPrepareEpubInternal(call, selectedUri));
            } catch (PluginErrorException pluginError) {
                call.resolve(
                    errorResult(
                        pluginError.code,
                        pluginError.getMessage(),
                        pluginError.stage != null ? pluginError.stage : "pick_prepare",
                        pluginError.requiredBytes,
                        pluginError.availableBytes
                    )
                );
            } catch (CancelledRewriteException cancelled) {
                call.resolve(errorResult("CANCELLED", cancelled.getMessage(), "pick_prepare"));
            } catch (Exception ex) {
                Log.e(TAG, "pickAndPrepareEpub failed", ex);
                call.resolve(errorResult(normalizeError(ex), ex.getMessage(), "pick_prepare"));
            } finally {
                cancelRequested.set(false);
                busy.set(false);
            }
        });
    }

    @PluginMethod
    public void cancelRewrite(PluginCall call) {
        cancelRequested.set(true);
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        cancelRequested.set(true);
        executor.shutdownNow();
    }

    private void runExclusive(PluginCall call, String stage, PluginWork work) {
        if (!busy.compareAndSet(false, true)) {
            call.resolve(errorResult("BUSY", null, stage));
            return;
        }

        cancelRequested.set(false);

        executor.execute(() -> {
            try {
                work.run(call);
            } catch (PluginErrorException pluginError) {
                call.resolve(
                    errorResult(
                        pluginError.code,
                        pluginError.getMessage(),
                        pluginError.stage != null ? pluginError.stage : stage,
                        pluginError.requiredBytes,
                        pluginError.availableBytes
                    )
                );
            } catch (CancelledRewriteException cancelled) {
                call.resolve(errorResult("CANCELLED", cancelled.getMessage(), stage));
            } catch (Exception ex) {
                Log.e(TAG, "Plugin work failed at stage=" + stage, ex);
                call.resolve(errorResult(normalizeError(ex), ex.getMessage(), stage));
            } finally {
                cancelRequested.set(false);
                busy.set(false);
            }
        });
    }

    private void inspectEpubInternal(PluginCall call) throws Exception {
        Path inputPath = requireReadablePath(call.getString("inputPath"));

        try (ZipFile zipFile = new ZipFile(inputPath.toFile())) {
            List<FileHeader> headers = zipFile.getFileHeaders();
            if (headers == null || headers.isEmpty()) {
                Log.w(TAG, "inspectEpub INVALID_EPUB: empty headers");
                call.resolve(errorResult("INVALID_EPUB", null, "inspect"));
                return;
            }

            String coverEntryPath = findCoverEntryPath(zipFile, headers);
            if (coverEntryPath == null) {
                Log.w(TAG, "inspectEpub NO_COVER: unable to resolve cover entry");
                call.resolve(errorResult("NO_COVER", "cover entry not found", "inspect"));
                return;
            }

            FileHeader coverHeader = findHeader(headers, coverEntryPath);
            if (coverHeader == null) {
                Log.w(TAG, "inspectEpub NO_COVER: cover header missing for " + coverEntryPath);
                call.resolve(errorResult("NO_COVER", "cover header missing", "inspect"));
                return;
            }

            Path extractedCoverPath = buildExtractedCoverPath(coverEntryPath);
            extractEntry(zipFile, coverHeader, extractedCoverPath);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("coverEntryPath", coverEntryPath);
            result.put("extractedCoverPath", extractedCoverPath.toString());
            call.resolve(result);
        }
    }

    private void rewriteCoverInternal(PluginCall call) throws Exception {
        Path inputPath = requireReadablePath(call.getString("inputPath"));
        Path outputPath = resolveOptionalWritablePath(call.getString("outputPath"));
        Path newCoverPath = requireReadablePath(call.getString("newCoverPath"));
        String coverEntryPath = normalizeZipPath(requireString(call, "coverEntryPath"));
        boolean inPlaceMode = outputPath == null || Objects.equals(inputPath, outputPath);
        Path effectiveOutputPath = inPlaceMode ? inputPath : outputPath;
        if (!inPlaceMode && effectiveOutputPath.getParent() != null) {
            Files.createDirectories(effectiveOutputPath.getParent());
        }

        long inputBytes = Files.size(inputPath);
        long startedAt = System.currentTimeMillis();
        long requiredBytes = safeAdd(inputBytes, STORAGE_MARGIN_BYTES);
        ensureSufficientSpace(effectiveOutputPath, requiredBytes, "rewrite");
        debugIo(
            "rewriteCover start mode=" + (inPlaceMode ? "in_place" : "output")
                + " inputBytes=" + inputBytes
                + " inputPath=" + inputPath
                + " outputPath=" + effectiveOutputPath
        );

        try (ZipFile sourceZip = new ZipFile(inputPath.toFile())) {
            List<FileHeader> headers = sourceZip.getFileHeaders();
            if (findHeader(headers, coverEntryPath) == null) {
                Log.w(TAG, "rewriteCover COVER_NOT_FOUND for " + coverEntryPath);
                call.resolve(errorResult("COVER_NOT_FOUND", null, "rewrite"));
                return;
            }
        }

        emitProgress(0);
        if (inPlaceMode) {
            rewriteCoverInPlace(inputPath, newCoverPath, coverEntryPath, startedAt);
        } else {
            rewriteCoverToOutput(inputPath, effectiveOutputPath, newCoverPath, coverEntryPath, startedAt);
        }

        emitProgress(100);
        long totalMs = System.currentTimeMillis() - startedAt;
        debugIo(
            "rewriteCover success mode=" + (inPlaceMode ? "in_place" : "output")
                + " outputPath=" + effectiveOutputPath
                + " totalMs=" + totalMs
        );
        scanPathForMediaStore(effectiveOutputPath);
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("outputPath", effectiveOutputPath.toString());
        call.resolve(result);
    }

    private void createEpubFromCoverInternal(PluginCall call) throws Exception {
        Path outputPath = requireWritablePath(call.getString("outputPath"));
        Path coverPath = requireReadablePath(call.getString("coverPath"));
        String title = call.getString("title");
        if (title == null || title.trim().isEmpty()) {
            title = "Kindle Cover";
        }
        String lang = normalizeLangToken(call.getString("lang"));
        String appName = call.getString("appName");
        if (appName == null || appName.trim().isEmpty()) {
            appName = "Cover creator for kindle";
        }

        String coverExt = normalizeCoverExt(extensionFromPath(coverPath.getFileName().toString()));
        String coverMediaType = mimeFromExtension(coverExt);
        String coverFileName = "cover." + coverExt;
        String coverId = "cover-image";

        Path tempOutputPath = outputPath.resolveSibling(outputPath.getFileName() + ".tmp");
        Files.createDirectories(outputPath.getParent());
        deleteIfExists(tempOutputPath);

        try {
            try (ZipFile zipFile = new ZipFile(tempOutputPath.toFile())) {
                addTextEntry(zipFile, "mimetype", "application/epub+zip", true);
                addTextEntry(zipFile, "META-INF/container.xml", buildContainerXml(), false);
                addTextEntry(
                    zipFile,
                    "OEBPS/content.opf",
                    buildContentOpf(title, lang, coverId, coverFileName, coverMediaType),
                    false
                );
                addTextEntry(zipFile, "OEBPS/nav.xhtml", buildNavXhtml(), false);
                addTextEntry(zipFile, "OEBPS/cover.xhtml", buildCoverXhtml(coverFileName), false);
                addTextEntry(zipFile, "OEBPS/thanks.xhtml", buildThanksXhtml(appName, lang), false);

                ZipParameters coverParams = new ZipParameters();
                coverParams.setFileNameInZip("OEBPS/" + coverFileName);
                zipFile.addFile(coverPath.toFile(), coverParams);
            }

            Files.move(
                tempOutputPath,
                outputPath,
                StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.ATOMIC_MOVE
            );
        } catch (IOException moveError) {
            if (Files.exists(tempOutputPath)) {
                Files.move(tempOutputPath, outputPath, StandardCopyOption.REPLACE_EXISTING);
            } else {
                throw moveError;
            }
        } catch (Exception ex) {
            deleteIfExists(tempOutputPath);
            throw ex;
        }

        scanPathForMediaStore(outputPath);
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("outputPath", outputPath.toString());
        call.resolve(result);
    }

    private void extractCoverAssetInternal(PluginCall call) throws Exception {
        Path inputPath = requireReadablePath(call.getString("epubPath"));
        String preferCoverEntryPath = normalizeZipPath(call.getString("preferCoverEntryPath"));
        Long maxBytesOpt = call.getLong("maxBytes");
        long maxBytes = maxBytesOpt == null ? 0L : Math.max(0L, maxBytesOpt);

        try (ZipFile zipFile = new ZipFile(inputPath.toFile())) {
            List<FileHeader> headers = zipFile.getFileHeaders();
            if (headers == null || headers.isEmpty()) {
                call.resolve(errorResult("INVALID_EPUB", null, "extract_cover"));
                return;
            }

            FileHeader coverHeader = null;
            String coverEntryPath = null;

            if (preferCoverEntryPath != null && !preferCoverEntryPath.isBlank()) {
                coverHeader = findHeader(headers, preferCoverEntryPath);
                if (coverHeader != null) {
                    coverEntryPath = normalizeZipPath(coverHeader.getFileName());
                }
            }

            if (coverHeader == null) {
                coverEntryPath = findCoverEntryPath(zipFile, headers);
                if (coverEntryPath != null) {
                    coverHeader = findHeader(headers, coverEntryPath);
                }
            }

            if (coverHeader == null || coverEntryPath == null) {
                call.resolve(errorResult("NO_COVER", "cover entry not found", "extract_cover"));
                return;
            }

            if (maxBytes > 0L) {
                long uncompressed = coverHeader.getUncompressedSize();
                if (uncompressed > maxBytes) {
                    call.resolve(errorResult("COVER_TOO_LARGE", null, "extract_cover"));
                    return;
                }
            }

            Path extractedCoverPath = buildExtractedCoverPath(coverEntryPath);
            extractEntry(zipFile, coverHeader, extractedCoverPath);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("tempImagePath", extractedCoverPath.toString());
            result.put("mimeType", mimeFromPath(coverEntryPath));
            result.put("coverEntryPath", coverEntryPath);
            call.resolve(result);
        }
    }

    private JSObject pickAndPrepareEpubInternal(PluginCall call, Uri sourceUri) throws Exception {
        ensureNotCancelled();
        Long maxBytesOpt = call.getLong("maxBytes");
        long maxBytes = maxBytesOpt == null ? 0L : Math.max(0L, maxBytesOpt);
        SourceMeta sourceMeta = readSourceMeta(sourceUri);
        String selectedName = sourceMeta.displayName;
        String outputBaseName = sanitizeBaseName(stripExtension(selectedName)) + "_" + formatWorkTimestamp();
        if (maxBytes > 0 && sourceMeta.size > maxBytes) {
            throw new PluginErrorException(
                "EPUB_TOO_LARGE",
                "Selected EPUB exceeds allowed max bytes",
                "pick_prepare"
            );
        }

        Path workDir = getContext().getFilesDir().toPath().resolve(WORK_FOLDER);
        Files.createDirectories(workDir);
        Path workingPath = resolveUniqueWorkPath(workDir, outputBaseName);
        long startedAt = System.currentTimeMillis();
        long sourceSize = Math.max(0L, sourceMeta.size);
        long requiredBytes = safeAdd(sourceSize, STORAGE_MARGIN_BYTES);
        ensureSufficientSpace(workingPath, requiredBytes, "pick_prepare");

        debugIo(
            "pick_prepare start selectedName=" + selectedName
                + " maxBytes=" + maxBytes
                + " requiredBytes=" + requiredBytes
                + " workingPath=" + workingPath
        );

        long copiedBytes;
        try {
            copiedBytes = copyUriToPath(sourceUri, workingPath, maxBytes);
            ensureNotCancelled();
        } catch (Exception ex) {
            try {
                deleteIfExists(workingPath);
            } catch (IOException ignored) {
                // best effort cleanup
            }
            throw ex;
        }

        try (ZipFile zipFile = new ZipFile(workingPath.toFile())) {
            List<FileHeader> headers = zipFile.getFileHeaders();
            if (headers == null || headers.isEmpty()) {
                deleteIfExists(workingPath);
                return errorResult("INVALID_EPUB", null, "pick_prepare");
            }

            String coverEntryPath = findCoverEntryPath(zipFile, headers);
            if (coverEntryPath == null) {
                deleteIfExists(workingPath);
                return errorResult("NO_COVER", "cover entry not found", "pick_prepare");
            }

            FileHeader coverHeader = findHeader(headers, coverEntryPath);
            if (coverHeader == null) {
                deleteIfExists(workingPath);
                return errorResult("NO_COVER", "cover header missing", "pick_prepare");
            }

            Path extractedCoverPath = buildExtractedCoverPath(coverEntryPath);
            extractEntry(zipFile, coverHeader, extractedCoverPath);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("selectedName", selectedName);
            result.put("sourceSize", sourceMeta.size > 0 ? sourceMeta.size : copiedBytes);
            result.put("sourceLastModified", sourceMeta.lastModified);
            result.put("sourceMimeType", sourceMeta.mimeType);
            result.put("workingPath", WORK_FOLDER + "/" + workingPath.getFileName().toString());
            result.put("workingName", workingPath.getFileName().toString());
            result.put("workingNativePath", workingPath.toString());
            result.put("outputBaseName", stripExtension(workingPath.getFileName().toString()));
            result.put("coverEntryPath", coverEntryPath);
            result.put("extractedCoverPath", extractedCoverPath.toString());

            debugIo(
                "pick_prepare success elapsedMs=" + (System.currentTimeMillis() - startedAt)
                    + " sourceBytes=" + (sourceMeta.size > 0 ? sourceMeta.size : copiedBytes)
                    + " workingPath=" + workingPath
                    + " coverEntryPath=" + coverEntryPath
            );
            return result;
        } catch (Exception ex) {
            try {
                deleteIfExists(workingPath);
            } catch (IOException ignored) {
                // best effort cleanup
            }
            throw ex;
        }
    }

    private SourceMeta readSourceMeta(Uri sourceUri) {
        ContentResolver resolver = getContext().getContentResolver();
        String displayName = "selected.epub";
        long size = -1L;
        long lastModified = System.currentTimeMillis();
        String mimeType = resolver.getType(sourceUri);

        Cursor cursor = null;
        try {
            cursor = resolver.query(
                sourceUri,
                new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE },
                null,
                null,
                null
            );
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String candidate = cursor.getString(nameIndex);
                    if (candidate != null && !candidate.trim().isEmpty()) {
                        displayName = candidate.trim();
                    }
                }
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                    size = cursor.getLong(sizeIndex);
                }
            }
        } catch (Exception ex) {
            debugIo("pick_prepare metadata lookup failed: " + ex.getMessage());
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        if (mimeType == null || mimeType.isBlank()) {
            mimeType = "application/epub+zip";
        }

        return new SourceMeta(displayName, size, lastModified, mimeType);
    }

    private long copyUriToPath(Uri sourceUri, Path targetPath, long maxBytes) throws Exception {
        Files.createDirectories(targetPath.getParent());
        ContentResolver resolver = getContext().getContentResolver();
        byte[] buffer = new byte[BUFFER_SIZE];
        long totalBytes = 0L;

        try (
            InputStream source = resolver.openInputStream(sourceUri);
            OutputStream output = new BufferedOutputStream(Files.newOutputStream(targetPath))
        ) {
            if (source == null) {
                throw new PluginErrorException("PICK_FAILED", "Unable to open selected file");
            }

            int read;
            while ((read = source.read(buffer)) != -1) {
                ensureNotCancelled();
                output.write(buffer, 0, read);
                totalBytes += read;
                if (maxBytes > 0 && totalBytes > maxBytes) {
                    throw new PluginErrorException(
                        "EPUB_TOO_LARGE",
                        "Selected EPUB exceeds allowed max bytes"
                    );
                }
            }
            output.flush();
        }

        return totalBytes;
    }

    private Path resolveUniqueWorkPath(Path workDir, String outputBaseName) throws IOException {
        String base = outputBaseName;
        String ext = ".epub";
        int idx = 0;

        while (true) {
            String suffix = idx == 0 ? "" : " (" + idx + ")";
            String candidate = base + suffix + ext;
            Path path = workDir.resolve(candidate);
            if (!Files.exists(path)) {
                return path;
            }
            idx += 1;
        }
    }

    private String sanitizeBaseName(String name) {
        String trimmed = (name == null ? "epub" : name).trim();
        if (trimmed.isEmpty()) {
            trimmed = "epub";
        }

        String safe = trimmed
            .replaceAll("[/\\\\:*?\"<>|]", " ")
            .replaceAll("[\\x00-\\x1f\\x7f]", " ")
            .replaceAll("\\s+", " ")
            .trim();

        if (safe.isEmpty()) {
            safe = "epub";
        }
        if (safe.length() > 80) {
            safe = safe.substring(0, 80).trim();
        }
        return safe.isEmpty() ? "epub" : safe;
    }

    private String formatWorkTimestamp() {
        return LocalDateTime.now().format(WORK_TIMESTAMP_FORMAT);
    }

    private void rewriteCoverInPlace(Path inputPath, Path newCoverPath, String coverEntryPath, long startedAt)
        throws Exception {
        Path backupPath = inputPath.resolveSibling(inputPath.getFileName() + ".bak");
        Path tempOutputPath = inputPath.resolveSibling(inputPath.getFileName() + ".tmp");

        deleteIfExists(tempOutputPath);
        deleteIfExists(backupPath);

        long backupStart = System.currentTimeMillis();
        moveFileAtomicWithFallback(inputPath, backupPath);
        debugIo("rewriteCover in_place backupMs=" + (System.currentTimeMillis() - backupStart));

        try {
            long rewriteStart = System.currentTimeMillis();
            rewriteArchiveReplacingCover(backupPath, tempOutputPath, coverEntryPath, newCoverPath, 5, 90);
            debugIo("rewriteCover in_place rewriteMs=" + (System.currentTimeMillis() - rewriteStart));
            ensureNotCancelled();

            long commitStart = System.currentTimeMillis();
            moveFileAtomicWithFallback(tempOutputPath, inputPath);
            deleteIfExists(backupPath);
            debugIo(
                "rewriteCover in_place commitMs=" + (System.currentTimeMillis() - commitStart)
                    + " totalMs=" + (System.currentTimeMillis() - startedAt)
            );
        } catch (Exception ex) {
            debugIo(
                "rewriteCover in_place rollback reason=" + ex.getClass().getSimpleName()
                    + " message=" + (ex.getMessage() == null ? "" : ex.getMessage())
            );
            rollbackInPlace(inputPath, backupPath, tempOutputPath);
            throw ex;
        } finally {
            deleteIfExists(tempOutputPath);
        }
    }

    private void rewriteCoverToOutput(
        Path inputPath,
        Path outputPath,
        Path newCoverPath,
        String coverEntryPath,
        long startedAt
    ) throws Exception {
        Path tempOutputPath = outputPath.resolveSibling(outputPath.getFileName() + ".tmp");
        deleteIfExists(tempOutputPath);

        try {
            long rewriteStart = System.currentTimeMillis();
            rewriteArchiveReplacingCover(inputPath, tempOutputPath, coverEntryPath, newCoverPath, 5, 95);
            debugIo("rewriteCover output rewriteMs=" + (System.currentTimeMillis() - rewriteStart));
            ensureNotCancelled();
            moveFileAtomicWithFallback(tempOutputPath, outputPath);
            debugIo("rewriteCover output commit totalMs=" + (System.currentTimeMillis() - startedAt));
        } catch (Exception ex) {
            deleteIfExists(tempOutputPath);
            throw ex;
        } finally {
            deleteIfExists(tempOutputPath);
        }
    }

    private void rewriteArchiveReplacingCover(
        Path sourceZipPath,
        Path outputZipPath,
        String coverEntryPath,
        Path newCoverPath,
        int progressStart,
        int progressEnd
    ) throws Exception {
        deleteIfExists(outputZipPath);

        try (
            ZipFile sourceZip = new ZipFile(sourceZipPath.toFile());
            ZipFile outputZip = new ZipFile(outputZipPath.toFile())
        ) {
            List<FileHeader> headers = sourceZip.getFileHeaders();
            if (headers == null || headers.isEmpty()) {
                throw new IOException("Invalid EPUB: empty headers");
            }

            long totalBytes = totalProcessableBytes(headers);
            long processedBytes = 0L;
            boolean coverReplaced = false;

            for (FileHeader header : headers) {
                if (header == null || header.isDirectory()) {
                    continue;
                }

                ensureNotCancelled();

                if (header.isEncrypted()) {
                    throw new IOException("Encrypted EPUB entries are not supported");
                }

                String entryPath = normalizeZipPath(header.getFileName());
                ZipParameters parameters = buildParametersFromHeader(header, entryPath, null);

                if (entryPath.equals(coverEntryPath)) {
                    parameters = buildParametersFromHeader(header, coverEntryPath, newCoverPath);
                    outputZip.addFile(newCoverPath.toFile(), parameters);
                    coverReplaced = true;
                } else {
                    try (InputStream entryInput = new BufferedInputStream(sourceZip.getInputStream(header))) {
                        outputZip.addStream(entryInput, parameters);
                    }
                }

                processedBytes += Math.max(1L, header.getUncompressedSize());
                emitProgress(interpolate(progressStart, progressEnd, processedBytes, totalBytes));
            }

            if (!coverReplaced) {
                throw new IOException("Cover entry not found in source archive");
            }
        }
    }

    private ZipParameters buildParametersFromHeader(
        FileHeader header,
        String fileNameInZip,
        Path sourceFilePathForStored
    ) throws IOException {
        ZipParameters parameters = new ZipParameters();
        parameters.setFileNameInZip(fileNameInZip);
        parameters.setCompressionMethod(header.getCompressionMethod());
        parameters.setLastModifiedFileTime(header.getLastModifiedTime());
        parameters.setFileComment(header.getFileComment());

        if (header.getCompressionMethod() == CompressionMethod.STORE) {
            long entrySize = sourceFilePathForStored == null
                ? Math.max(0L, header.getUncompressedSize())
                : Math.max(0L, Files.size(sourceFilePathForStored));
            long entryCrc = sourceFilePathForStored == null
                ? header.getCrc()
                : computeCrc(sourceFilePathForStored);

            parameters.setEntrySize(entrySize);
            parameters.setEntryCRC(entryCrc);
            parameters.setWriteExtendedLocalFileHeader(false);
        }

        return parameters;
    }

    private long computeCrc(Path filePath) throws IOException {
        CRC32 crc = new CRC32();
        byte[] buffer = new byte[BUFFER_SIZE];

        try (InputStream inputStream = new BufferedInputStream(Files.newInputStream(filePath))) {
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                crc.update(buffer, 0, read);
            }
        }

        return crc.getValue();
    }

    private long totalProcessableBytes(List<FileHeader> headers) {
        long total = 0L;
        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }
            total += Math.max(1L, header.getUncompressedSize());
        }
        return Math.max(1L, total);
    }

    private void rollbackInPlace(Path inputPath, Path backupPath, Path tempOutputPath) throws IOException {
        deleteIfExists(tempOutputPath);
        if (Files.exists(inputPath)) {
            deleteIfExists(inputPath);
        }
        if (Files.exists(backupPath)) {
            moveFileAtomicWithFallback(backupPath, inputPath);
        }
    }

    private void moveFileAtomicWithFallback(Path from, Path to) throws IOException {
        try {
            Files.move(
                from,
                to,
                StandardCopyOption.REPLACE_EXISTING,
                StandardCopyOption.ATOMIC_MOVE
            );
        } catch (IOException ignored) {
            Files.move(from, to, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private void extractEntry(ZipFile zipFile, FileHeader fileHeader, Path outputPath) throws IOException {
        Files.createDirectories(outputPath.getParent());

        try (
            InputStream inputStream = new BufferedInputStream(zipFile.getInputStream(fileHeader));
            OutputStream outputStream = new BufferedOutputStream(Files.newOutputStream(outputPath))
        ) {
            copyStream(inputStream, outputStream);
        }
    }

    private void addTextEntry(ZipFile zipFile, String pathInZip, String content, boolean stored)
        throws IOException {
        ZipParameters parameters = new ZipParameters();
        parameters.setFileNameInZip(pathInZip);
        parameters.setCompressionMethod(stored ? CompressionMethod.STORE : CompressionMethod.DEFLATE);

        try (InputStream inputStream = new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8))) {
            zipFile.addStream(inputStream, parameters);
        }
    }

    private String buildContainerXml() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
            + "  <rootfiles>\n"
            + "    <rootfile full-path=\"OEBPS/content.opf\" media-type=\"application/oebps-package+xml\"/>\n"
            + "  </rootfiles>\n"
            + "</container>";
    }

    private String buildCoverXhtml(String coverFileName) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<!DOCTYPE html>\n"
            + "<html xmlns=\"http://www.w3.org/1999/xhtml\">\n"
            + "  <head>\n"
            + "    <meta charset=\"utf-8\"/>\n"
            + "    <title>Cover</title>\n"
            + "    <style>\n"
            + "      html, body { margin:0; padding:0; height:100%; }\n"
            + "      body { display:flex; align-items:center; justify-content:center; }\n"
            + "      img { max-width:100%; max-height:100%; }\n"
            + "    </style>\n"
            + "  </head>\n"
            + "  <body>\n"
            + "    <img src=\"" + escapeXml(coverFileName) + "\" alt=\"Cover\"/>\n"
            + "  </body>\n"
            + "</html>";
    }

    private String buildNavXhtml() {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<!DOCTYPE html>\n"
            + "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\">\n"
            + "  <head>\n"
            + "    <meta charset=\"utf-8\"/>\n"
            + "    <title>Navigation</title>\n"
            + "  </head>\n"
            + "  <body>\n"
            + "    <nav epub:type=\"toc\" id=\"toc\">\n"
            + "      <ol>\n"
            + "        <li><a href=\"cover.xhtml\">Cover</a></li>\n"
            + "        <li><a href=\"thanks.xhtml\">Thanks</a></li>\n"
            + "      </ol>\n"
            + "    </nav>\n"
            + "  </body>\n"
            + "</html>";
    }

    private String buildThanksXhtml(String appName, String lang) {
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<!DOCTYPE html>\n"
            + "<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"" + escapeXml(lang) + "\">\n"
            + "  <head>\n"
            + "    <meta charset=\"utf-8\"/>\n"
            + "    <title>Thanks</title>\n"
            + "    <style>\n"
            + "      body { font-family: serif; line-height: 1.4; padding: 8%; }\n"
            + "      h1 { margin-top: 0; }\n"
            + "      .small { opacity: 0.85; }\n"
            + "    </style>\n"
            + "  </head>\n"
            + "  <body>\n"
            + "    <h1>Thanks for using " + escapeXml(appName) + "!</h1>\n"
            + "    <p class=\"small\">If this helped you, please recommend the app and leave a rating.</p>\n"
            + "  </body>\n"
            + "</html>";
    }

    private String buildContentOpf(
        String title,
        String lang,
        String coverId,
        String coverFileName,
        String coverMediaType
    ) {
        String modified = Instant.now().toString().replaceFirst("\\.\\d+Z$", "Z");
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            + "<package xmlns=\"http://www.idpf.org/2007/opf\" unique-identifier=\"bookid\" version=\"3.0\">\n"
            + "  <metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n"
            + "    <dc:identifier id=\"bookid\">urn:uuid:" + UUID.randomUUID() + "</dc:identifier>\n"
            + "    <dc:title>" + escapeXml(title) + "</dc:title>\n"
            + "    <dc:language>" + escapeXml(lang) + "</dc:language>\n"
            + "    <meta property=\"dcterms:modified\">" + modified + "</meta>\n"
            + "    <meta name=\"cover\" content=\"" + escapeXml(coverId) + "\"/>\n"
            + "  </metadata>\n"
            + "  <manifest>\n"
            + "    <item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/>\n"
            + "    <item id=\"cover\" href=\"cover.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
            + "    <item id=\"thanks\" href=\"thanks.xhtml\" media-type=\"application/xhtml+xml\"/>\n"
            + "    <item id=\"" + escapeXml(coverId) + "\" href=\"" + escapeXml(coverFileName)
            + "\" media-type=\"" + escapeXml(coverMediaType) + "\" properties=\"cover-image\"/>\n"
            + "  </manifest>\n"
            + "  <spine>\n"
            + "    <itemref idref=\"cover\"/>\n"
            + "    <itemref idref=\"thanks\"/>\n"
            + "  </spine>\n"
            + "</package>";
    }

    private void copyStream(InputStream inputStream, OutputStream outputStream) throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        int read;
        while ((read = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, read);
        }
        outputStream.flush();
    }

    private String findCoverEntryPath(ZipFile zipFile, List<FileHeader> headers) throws IOException {
        String opfPath = resolveOpfPath(zipFile, headers);
        if (opfPath != null) {
            String opfCoverPath = findCoverPathFromOpf(zipFile, headers, opfPath);
            if (opfCoverPath != null) {
                return opfCoverPath;
            }
        }

        for (String commonPath : new String[] {
            "OEBPS/cover.jpg",
            "OEBPS/cover.jpeg",
            "OEBPS/cover.png",
            "OEBPS/cover.webp",
            "cover.jpg",
            "cover.jpeg",
            "cover.png",
            "cover.webp"
        }) {
            if (findHeader(headers, commonPath) != null) {
                return commonPath;
            }
        }

        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }

            String lower = normalizeZipPath(header.getFileName()).toLowerCase(Locale.US);
            if (isImagePath(lower) && lower.contains("cover")) {
                return normalizeZipPath(header.getFileName());
            }
        }

        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }

            String lower = normalizeZipPath(header.getFileName()).toLowerCase(Locale.US);
            if (isImagePath(lower)) {
                return normalizeZipPath(header.getFileName());
            }
        }

        return null;
    }

    private String resolveOpfPath(ZipFile zipFile, List<FileHeader> headers) throws IOException {
        FileHeader containerHeader = findHeader(headers, "META-INF/container.xml");
        if (containerHeader == null) {
            return null;
        }

        String containerXml = readEntryAsUtf8(zipFile, containerHeader);
        Matcher matcher = CONTAINER_OPF_PATTERN.matcher(containerXml);
        if (!matcher.find()) {
            return null;
        }

        String opfPath = normalizeZipPath(matcher.group(1));
        return findHeader(headers, opfPath) == null ? null : opfPath;
    }

    private String findCoverPathFromOpf(ZipFile zipFile, List<FileHeader> headers, String opfPath)
        throws IOException {
        FileHeader opfHeader = findHeader(headers, opfPath);
        if (opfHeader == null) {
            return null;
        }

        String opfXml = readEntryAsUtf8(zipFile, opfHeader);
        String coverHref = null;
        String coverId = null;

        Matcher matcher = XML_TAG_PATTERN.matcher(opfXml);
        while (matcher.find()) {
            String tagName = matcher.group(1).toLowerCase(Locale.US);
            String tag = matcher.group();

            if ("item".equals(tagName)) {
                String properties = attr(tag, "properties");
                if (properties != null) {
                    for (String property : properties.toLowerCase(Locale.US).split("\\s+")) {
                        if ("cover-image".equals(property.trim())) {
                            coverHref = attr(tag, "href");
                            break;
                        }
                    }
                }
            }

            if (coverHref == null && "meta".equals(tagName)) {
                String metaName = attr(tag, "name");
                if ("cover".equalsIgnoreCase(metaName)) {
                    coverId = attr(tag, "content");
                }
            }
        }

        if (coverHref == null && coverId != null) {
            Matcher itemMatcher = XML_TAG_PATTERN.matcher(opfXml);
            while (itemMatcher.find()) {
                if (!"item".equalsIgnoreCase(itemMatcher.group(1))) {
                    continue;
                }
                String itemTag = itemMatcher.group();
                if (coverId.equals(attr(itemTag, "id"))) {
                    coverHref = attr(itemTag, "href");
                    break;
                }
            }
        }

        if (coverHref == null) {
            Matcher itemMatcher = XML_TAG_PATTERN.matcher(opfXml);
            while (itemMatcher.find()) {
                if (!"item".equalsIgnoreCase(itemMatcher.group(1))) {
                    continue;
                }
                String itemTag = itemMatcher.group();
                String href = attr(itemTag, "href");
                String mediaType = attr(itemTag, "media-type");
                if (href == null || mediaType == null) {
                    continue;
                }
                if (mediaType.toLowerCase(Locale.US).startsWith("image/")
                    && href.toLowerCase(Locale.US).contains("cover")) {
                    coverHref = href;
                    break;
                }
            }
        }

        if (coverHref == null) {
            return null;
        }

        String opfDir = "";
        int slashIndex = opfPath.lastIndexOf('/');
        if (slashIndex >= 0) {
            opfDir = opfPath.substring(0, slashIndex);
        }

        String resolved = resolveRelativePath(opfDir, coverHref);
        return findHeader(headers, resolved) == null ? null : resolved;
    }

    private String readEntryAsUtf8(ZipFile zipFile, FileHeader header) throws IOException {
        try (InputStream inputStream = new BufferedInputStream(zipFile.getInputStream(header))) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            copyStream(inputStream, output);
            return output.toString(StandardCharsets.UTF_8);
        }
    }

    private Path buildExtractedCoverPath(String coverEntryPath) throws IOException {
        Path cacheDir = getContext().getCacheDir().toPath().resolve("epub-rewrite");
        Files.createDirectories(cacheDir);

        String ext = extensionFromPath(coverEntryPath);
        if (ext.isEmpty()) {
            ext = "jpg";
        }

        String baseName = stripExtension(Paths.get(coverEntryPath).getFileName().toString());
        if (baseName.isBlank()) {
            baseName = "cover";
        }

        return cacheDir.resolve(baseName + "_" + System.currentTimeMillis() + "." + ext);
    }

    private FileHeader findHeader(List<FileHeader> headers, String fileName) {
        if (headers == null || fileName == null) {
            return null;
        }

        String normalized = normalizeZipPath(fileName);
        for (FileHeader header : headers) {
            if (header == null) {
                continue;
            }
            if (normalized.equals(normalizeZipPath(header.getFileName()))) {
                return header;
            }
        }
        return null;
    }

    private String resolveRelativePath(String baseDir, String href) {
        String normalizedHref = normalizeZipPath(href);
        if (normalizedHref.matches("^[a-zA-Z]+://.*$")) {
            return normalizedHref;
        }

        String merged = baseDir == null || baseDir.isBlank()
            ? normalizedHref
            : baseDir + "/" + normalizedHref;

        String[] parts = merged.split("/");
        StringBuilder out = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.isBlank() || ".".equals(part)) {
                continue;
            }
            if ("..".equals(part)) {
                int lastSlash = out.lastIndexOf("/");
                if (lastSlash >= 0) {
                    out.delete(lastSlash, out.length());
                } else {
                    out.setLength(0);
                }
                continue;
            }
            if (!out.isEmpty()) {
                out.append('/');
            }
            out.append(part);
        }
        return out.toString();
    }

    private String attr(String tag, String attributeName) {
        Pattern pattern = Pattern.compile(
            attributeName + "\\s*=\\s*[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE
        );
        Matcher matcher = pattern.matcher(tag);
        return matcher.find() ? matcher.group(1) : null;
    }

    private boolean isImagePath(String path) {
        return path.endsWith(".jpg")
            || path.endsWith(".jpeg")
            || path.endsWith(".png")
            || path.endsWith(".webp");
    }

    private String extensionFromPath(String path) {
        if (path == null) {
            return "";
        }
        String fileName = normalizeZipPath(path);
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            return "";
        }
        return fileName.substring(dotIndex + 1).toLowerCase(Locale.US);
    }

    private String mimeFromPath(String path) {
        String ext = extensionFromPath(path);
        if ("png".equals(ext)) {
            return "image/png";
        }
        if ("webp".equals(ext)) {
            return "image/webp";
        }
        return "image/jpeg";
    }

    private String normalizeCoverExt(String ext) {
        if ("png".equals(ext)) return "png";
        if ("webp".equals(ext)) return "webp";
        return "jpg";
    }

    private String mimeFromExtension(String ext) {
        if ("png".equals(ext)) return "image/png";
        if ("webp".equals(ext)) return "image/webp";
        return "image/jpeg";
    }

    private String normalizeLangToken(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "en";
        String normalized = raw.trim().toLowerCase(Locale.US);
        int splitIdx = normalized.indexOf('-');
        if (splitIdx < 0) {
            splitIdx = normalized.indexOf('_');
        }
        if (splitIdx > 0) {
            normalized = normalized.substring(0, splitIdx);
        }
        switch (normalized) {
            case "es":
            case "de":
            case "fr":
            case "it":
            case "pt":
                return normalized;
            default:
                return "en";
        }
    }

    private String escapeXml(String input) {
        if (input == null || input.isEmpty()) return "";
        return input
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;");
    }

    private String stripExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    }

    private void emitProgress(int percent) {
        JSObject payload = new JSObject();
        payload.put("percent", Math.max(0, Math.min(100, percent)));
        notifyListeners("rewriteProgress", payload);
    }

    private void ensureNotCancelled() throws CancelledRewriteException {
        if (cancelRequested.get()) {
            throw new CancelledRewriteException();
        }
    }

    private int interpolate(int start, int end, long current, long total) {
        if (end <= start) {
            return end;
        }
        long safeTotal = Math.max(1L, total);
        double ratio = Math.max(0d, Math.min(1d, current / (double) safeTotal));
        return start + (int) Math.round((end - start) * ratio);
    }

    private long safeAdd(long a, long b) {
        if (Long.MAX_VALUE - a < b) {
            return Long.MAX_VALUE;
        }
        return a + b;
    }

    private void ensureSufficientSpace(Path targetPath, long requiredBytes, String stage)
        throws Exception {
        long required = Math.max(0L, requiredBytes);
        if (required <= 0L) {
            return;
        }

        long available = getUsableBytes(targetPath);
        if (available >= required) {
            return;
        }

        debugIo(
            "no_space stage=" + stage
                + " requiredBytes=" + required
                + " availableBytes=" + available
                + " targetPath=" + targetPath
        );
        throw new PluginErrorException(
            "NO_SPACE",
            "Insufficient storage space",
            stage,
            required,
            available
        );
    }

    private long getUsableBytes(Path targetPath) throws IOException {
        Path probe = targetPath;
        if (probe == null) {
            throw new IOException("Missing path for storage check");
        }
        if (!Files.exists(probe)) {
            Path parent = probe.getParent();
            if (parent != null) {
                probe = parent;
            }
        }
        if (Files.exists(probe) && !Files.isDirectory(probe)) {
            probe = probe.getParent();
        }
        if (probe == null) {
            probe = targetPath.toAbsolutePath().getParent();
        }
        if (probe == null) {
            throw new IOException("Unable to resolve storage directory");
        }
        Path existingProbe = probe;
        while (existingProbe != null && !Files.exists(existingProbe)) {
            existingProbe = existingProbe.getParent();
        }
        if (existingProbe == null) {
            existingProbe = probe;
        }

        try {
            return Files.getFileStore(existingProbe).getUsableSpace();
        } catch (SecurityException | IOException primaryError) {
            debugIo(
                "storage_getfilestore_failed path=" + existingProbe
                    + " errorType=" + primaryError.getClass().getSimpleName()
                    + " error=" + (primaryError.getMessage() == null ? "" : primaryError.getMessage())
            );
            try {
                StatFs statFs = new StatFs(existingProbe.toString());
                long availableBytes = statFs.getAvailableBytes();
                if (availableBytes >= 0L) {
                    debugIo(
                        "storage_statfs_fallback_success path=" + existingProbe
                            + " availableBytes=" + availableBytes
                    );
                    return availableBytes;
                }
            } catch (Exception ignored) {
                debugIo(
                    "storage_statfs_fallback_failed path=" + existingProbe
                        + " errorType=" + ignored.getClass().getSimpleName()
                        + " error=" + (ignored.getMessage() == null ? "" : ignored.getMessage())
                );
            }
            if (primaryError instanceof IOException) {
                throw (IOException) primaryError;
            }
            throw new IOException("Unable to determine usable storage bytes", primaryError);
        }
    }

    private Path requireReadablePath(String rawPath) throws IOException {
        Path path = resolvePath(rawPath);
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            throw new IOException("Missing file: " + rawPath);
        }
        return path;
    }

    private Path requireWritablePath(String rawPath) throws IOException {
        Path path = resolvePath(rawPath);
        Path parent = path.getParent();
        if (parent == null) {
            throw new IOException("Invalid output path");
        }
        Files.createDirectories(parent);
        return path;
    }

    private Path resolveOptionalWritablePath(String rawPath) throws IOException {
        if (rawPath == null || rawPath.trim().isEmpty()) {
            return null;
        }
        return requireWritablePath(rawPath);
    }

    private Path resolvePath(String rawPath) throws IOException {
        if (rawPath == null || rawPath.trim().isEmpty()) {
            throw new IOException("Path is required");
        }

        String trimmed = rawPath.trim();
        try {
            Uri uri = Uri.parse(trimmed);
            String scheme = uri.getScheme();
            if (scheme == null || scheme.isBlank()) {
                return Paths.get(trimmed);
            }
            if ("file".equalsIgnoreCase(scheme) && uri.getPath() != null) {
                return Paths.get(uri.getPath());
            }
        } catch (InvalidPathException ignore) {
            // Fall through to the final invalid path error below.
        }

        try {
            return Paths.get(trimmed);
        } catch (InvalidPathException ex) {
            throw new IOException("Unsupported path: " + rawPath, ex);
        }
    }

    private String requireString(PluginCall call, String key) throws IOException {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) {
            throw new IOException("Missing required value: " + key);
        }
        return value;
    }

    private void deleteIfExists(Path path) throws IOException {
        if (path != null) {
            Files.deleteIfExists(path);
        }
    }

    private void debugIo(String message) {
        if (DEBUG_IO) {
            Log.i(TAG, "[debug] " + message);
        }
    }

    private JSObject errorResult(String error, String message, String stage) {
        return errorResult(error, message, stage, null, null);
    }

    private JSObject errorResult(
        String error,
        String message,
        String stage,
        Long requiredBytes,
        Long availableBytes
    ) {
        JSObject result = new JSObject();
        result.put("success", false);
        result.put("error", error);
        if (message != null && !message.isBlank()) {
            result.put("message", message);
        }
        if (stage != null && !stage.isBlank()) {
            result.put("stage", stage);
        }
        if (requiredBytes != null && requiredBytes >= 0) {
            result.put("requiredBytes", requiredBytes);
        }
        if (availableBytes != null && availableBytes >= 0) {
            result.put("availableBytes", availableBytes);
        }
        return result;
    }

    private String normalizeError(Exception ex) {
        if (ex instanceof CancelledRewriteException) {
            return "CANCELLED";
        }
        if (ex instanceof ZipException) {
            return "ZIP_ERROR";
        }
        return "IO_ERROR";
    }

    private String normalizeZipPath(String path) {
        return path == null ? "" : path.replace('\\', '/');
    }

    private void scanPathForMediaStore(Path path) {
        if (path == null) return;
        String absolutePath = path.toAbsolutePath().toString();
        if (absolutePath.isBlank()) return;

        try {
            MediaScannerConnection.scanFile(
                getContext(),
                new String[] { absolutePath },
                null,
                (scannedPath, uri) -> debugIo(
                    "media_scan scannedPath=" + scannedPath + " uri=" + (uri == null ? "null" : uri.toString())
                )
            );
        } catch (Exception ex) {
            Log.w(TAG, "media scan failed for path=" + absolutePath, ex);
        }
    }

    @FunctionalInterface
    private interface PluginWork {
        void run(PluginCall call) throws Exception;
    }

    private static final class SourceMeta {
        final String displayName;
        final long size;
        final long lastModified;
        final String mimeType;

        SourceMeta(String displayName, long size, long lastModified, String mimeType) {
            this.displayName = displayName;
            this.size = size;
            this.lastModified = lastModified;
            this.mimeType = mimeType;
        }
    }

    private static final class PluginErrorException extends Exception {
        private static final long serialVersionUID = 1L;
        final String code;
        final String stage;
        final Long requiredBytes;
        final Long availableBytes;

        PluginErrorException(String code, String message) {
            this(code, message, null, null, null);
        }

        PluginErrorException(String code, String message, String stage) {
            this(code, message, stage, null, null);
        }

        PluginErrorException(
            String code,
            String message,
            String stage,
            Long requiredBytes,
            Long availableBytes
        ) {
            super(message);
            this.code = code;
            this.stage = stage;
            this.requiredBytes = requiredBytes;
            this.availableBytes = availableBytes;
        }
    }

    private static final class CancelledRewriteException extends Exception {
        private static final long serialVersionUID = 1L;
    }
}
