package com.sheldrapps.plugins.epubrewrite;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.StatFs;
import android.provider.OpenableColumns;
import android.util.Log;
import androidx.core.content.FileProvider;

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
import net.lingala.zip4j.model.enums.CompressionMethod;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.Normalizer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import java.util.stream.Stream;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

@CapacitorPlugin(name = "EpubRewritePlugin")
public class EpubRewritePlugin extends Plugin {
    private static final String TAG = "EpubRewritePlugin";
    private static final boolean DEBUG_IO = false;
    private static final int BUFFER_SIZE = 32 * 1024;
    private static final long STORAGE_MARGIN_BYTES = 64L * 1024L * 1024L;
    private static final String WORK_FOLDER = "EPUBCoverChangerWork";
    private static final String FIXER_SESSION_FOLDER = "EpubFixerSessions";
    private static final Pattern ROOTFILE_FULL_PATH_PATTERN =
        Pattern.compile(
            "<rootfile\\b[^>]*\\bfull-path\\s*=\\s*(['\"])(.*?)\\1",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
        );
    private static final Pattern XML_DECLARATION_ENCODING_PATTERN =
        Pattern.compile(
            "<\\?xml\\b[^>]*\\bencoding\\s*=\\s*(['\"])([^'\"]+)\\1",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
        );
    private static final DateTimeFormatter WORK_TIMESTAMP_FORMAT =
        DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss", Locale.US);

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);
    private final EpubCoverLocator coverLocator = new EpubCoverLocator();

    @PluginMethod
    public void prepare(PluginCall call) {
        runExclusive(call, "prepare", this::prepareInternal);
    }

    @PluginMethod
    public void inspectEpub(PluginCall call) {
        runExclusive(call, "inspect", this::inspectEpubInternal);
    }

    @PluginMethod
    public void diagnoseEpub(PluginCall call) {
        runExclusive(call, "diagnose", this::diagnoseEpubInternal);
    }

    @PluginMethod
    public void repairEpub(PluginCall call) {
        runExclusive(call, "repair", this::repairEpubInternal);
    }

    @PluginMethod
    public void exportFixed(PluginCall call) {
        runExclusive(call, "export_fixed", this::exportFixedInternal);
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
    public void openExternalFile(PluginCall call) {
        String inputPath = call.getString("inputPath");
        String mimeType = call.getString("mimeType", "application/epub+zip");
        String chooserTitle = call.getString("chooserTitle", "Open with");

        if (CompatStrings.isBlank(inputPath)) {
            call.resolve(errorResult("OPEN_FAILED", null, "open"));
            return;
        }

        try {
            Uri uri = resolvePathToOpenUri(inputPath);
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(uri, mimeType);
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooserIntent = Intent.createChooser(viewIntent, chooserTitle);
            chooserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooserIntent);

            JSObject out = new JSObject();
            out.put("success", true);
            call.resolve(out);
        } catch (ActivityNotFoundException notFound) {
            call.resolve(errorResult("NO_HANDLER", null, "open"));
        } catch (Exception ex) {
            call.resolve(errorResult("OPEN_FAILED", ex.getMessage(), "open"));
        }
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
            reportNonFatalFailure("PICK_FAILED", ex.getMessage(), "pick_prepare", ex);
            call.resolve(errorResult("PICK_FAILED", ex.getMessage(), "pick_prepare", null, null, false));
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
                String errorCode = normalizeError(ex);
                reportNonFatalFailure(errorCode, ex.getMessage(), "pick_prepare", ex);
                call.resolve(errorResult(errorCode, ex.getMessage(), "pick_prepare", null, null, false));
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

    @PluginMethod
    public void cleanup(PluginCall call) {
        runExclusive(call, "cleanup", this::cleanupInternal);
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
                String errorCode = normalizeError(ex);
                reportNonFatalFailure(errorCode, ex.getMessage(), stage, ex);
                call.resolve(errorResult(errorCode, ex.getMessage(), stage, null, null, false));
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
        String coverEntryPath = normalizeZipPath(call.getString("coverEntryPath"));
        if (CompatStrings.isBlank(coverEntryPath)) {
            coverEntryPath = null;
        }
        String replacementCoverEntryPath =
            normalizeZipPath(call.getString("replacementCoverEntryPath"));
        if (CompatStrings.isBlank(replacementCoverEntryPath)) {
            replacementCoverEntryPath = null;
        }
        boolean coverInserted = false;
        String primaryOpfPath = null;
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
            primaryOpfPath = findPrimaryOpfPath(sourceZip, headers, null);

            if (coverEntryPath != null && findHeader(headers, coverEntryPath) == null) {
                coverEntryPath = findCoverEntryPath(sourceZip, headers);
            }

            if (coverEntryPath == null) {
                coverInserted = true;
                if (replacementCoverEntryPath == null) {
                    replacementCoverEntryPath = buildDefaultCoverEntryPath(newCoverPath);
                }
                if (findHeader(headers, replacementCoverEntryPath) != null) {
                    replacementCoverEntryPath = buildUniqueCoverEntryPath(headers, newCoverPath);
                }
            } else if (replacementCoverEntryPath == null) {
                replacementCoverEntryPath = coverEntryPath;
            }
        }

        emitProgress(0);
        if (inPlaceMode) {
            rewriteCoverInPlace(
                inputPath,
                newCoverPath,
                coverEntryPath,
                replacementCoverEntryPath,
                primaryOpfPath,
                startedAt
            );
        } else {
            rewriteCoverToOutput(
                inputPath,
                effectiveOutputPath,
                newCoverPath,
                coverEntryPath,
                replacementCoverEntryPath,
                primaryOpfPath,
                startedAt
            );
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
        result.put("coverEntryPath", replacementCoverEntryPath);
        result.put("coverInserted", coverInserted);
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

            if (CompatStrings.isNotBlank(preferCoverEntryPath)) {
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

    private void diagnoseEpubInternal(PluginCall call) throws Exception {
        String sessionId = requireString(call, "sessionId").trim();
        validateSessionId(sessionId);

        Path workingPath = resolveSessionWorkingPath(sessionId);
        EpubAnalysis analysis = analyzeEpub(workingPath, null);

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("sessionId", sessionId);
        result.put("status", analysis.status);
        result.put("issues", toIssueArray(analysis.issues));
        call.resolve(result);
    }

    private void repairEpubInternal(PluginCall call) throws Exception {
        String sessionId = requireString(call, "sessionId").trim();
        validateSessionId(sessionId);
        String preferredOpfPath = normalizeZipPath(call.getString("preferredOpfPath"));
        if (CompatStrings.isBlank(preferredOpfPath)) {
            preferredOpfPath = null;
        }
        JSObject guidedSelections = call.getObject("guidedSelections");

        Path workingPath = resolveSessionWorkingPath(sessionId);
        java.util.LinkedHashSet<String> repairedIssues = new java.util.LinkedHashSet<>();
        java.util.HashSet<String> visitedAnalyses = new java.util.HashSet<>();

        EpubAnalysis analysis = analyzeWorkingCopyForRepair(
            workingPath,
            preferredOpfPath,
            guidedSelections,
            repairedIssues
        );

        if ("failed".equals(analysis.status) || "unsupported".equals(analysis.status)) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", "REPAIR_UNAVAILABLE");
            result.put("status", analysis.status);
            result.put("issues", toIssueArray(analysis.issues));
            call.resolve(result);
            return;
        }

        Path backupPath = workingPath.resolveSibling(workingPath.getFileName() + ".bak");
        Path tempOutputPath = workingPath.resolveSibling(workingPath.getFileName() + ".tmp");

        try {
            while (true) {
                String analysisSignature = buildAnalysisSignature(analysis);
                if (!visitedAnalyses.add(analysisSignature)) {
                    break;
                }

                if (!hasRepairableIssues(analysis)) {
                    break;
                }

                boolean shouldRewritePackageDocument = shouldRewritePackageDocument(analysis);
                boolean shouldRewriteContainerDocument = shouldRewriteContainerDocument(analysis);

                deleteIfExists(backupPath);
                deleteIfExists(tempOutputPath);

                moveFileAtomicWithFallback(workingPath, backupPath);
                repairArchiveToOutput(
                    backupPath,
                    tempOutputPath,
                    analysis,
                    shouldRewritePackageDocument,
                    shouldRewriteContainerDocument,
                    guidedSelections,
                    repairedIssues
                );
                ensureNotCancelled();
                moveFileAtomicWithFallback(tempOutputPath, workingPath);
                deleteIfExists(backupPath);
                scanPathForMediaStore(workingPath);

                analysis = analyzeWorkingCopyForRepair(
                    workingPath,
                    preferredOpfPath,
                    guidedSelections,
                    repairedIssues
                );
            }

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("repairedIssues", new java.util.ArrayList<>(repairedIssues));
            call.resolve(result);
        } catch (Exception ex) {
            debugIo(
                "repairEpub failed reason=" + ex.getClass().getSimpleName()
                    + " message=" + (ex.getMessage() == null ? "" : ex.getMessage())
            );
            rollbackInPlace(workingPath, backupPath, tempOutputPath);
            throw ex;
        } finally {
            deleteIfExists(tempOutputPath);
            deleteIfExists(backupPath);
        }
    }

    private void exportFixedInternal(PluginCall call) throws Exception {
        String sessionId = requireString(call, "sessionId").trim();
        validateSessionId(sessionId);

        Path workingPath = resolveSessionWorkingPath(sessionId);
        Path sessionDir = resolveSessionDir(sessionId);
        String requestedName = call.getString("outputName");
        String outputFileName = buildExportFileName(workingPath.getFileName().toString(), requestedName);
        Path outputPath = sessionDir.resolve(outputFileName);

        if (workingPath.equals(outputPath)) {
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("outputUri", workingPath.toUri().toString());
            result.put("size", Files.size(workingPath));
            call.resolve(result);
            return;
        }

        Files.createDirectories(outputPath.getParent());
        Files.copy(workingPath, outputPath, StandardCopyOption.REPLACE_EXISTING);
        scanPathForMediaStore(outputPath);

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("outputUri", outputPath.toUri().toString());
        result.put("size", Files.size(outputPath));
        call.resolve(result);
    }

    private EpubAnalysis analyzeEpub(Path epubPath, String preferredOpfPath) throws Exception {
        return analyzeEpub(epubPath, preferredOpfPath, null);
    }

    private EpubAnalysis analyzeEpub(
        Path epubPath,
        String preferredOpfPath,
        JSObject guidedSelections
    ) throws Exception {
        try (ZipFile zipFile = new ZipFile(epubPath.toFile())) {
            List<FileHeader> headers = zipFile.getFileHeaders();
            if (headers == null || headers.isEmpty()) {
                throw new IOException("Invalid EPUB: empty headers");
            }

            java.util.ArrayList<EpubIssue> issues = new java.util.ArrayList<>();
            FileHeader mimetypeHeader = findHeader(headers, "mimetype");
            boolean mimetypeMissing = mimetypeHeader == null;
            boolean mimetypeInvalid = false;
            if (mimetypeHeader == null) {
                issues.add(issue("MIMETYPE_MISSING", "error", true));
            } else {
                String mimetypeValue = new String(readEntryBytes(zipFile, mimetypeHeader), StandardCharsets.UTF_8).trim();
                if (!"application/epub+zip".equals(mimetypeValue)) {
                    mimetypeInvalid = true;
                    issues.add(issue("MIMETYPE_INVALID", "error", true, mimetypeValue));
                }
            }

            String containerText = readZipText(zipFile, "META-INF/container.xml");
            String declaredOpfPath = null;
            boolean containerNeedsRepair = false;
            String containerIssueDetails = null;

                if (containerText == null) {
                    containerNeedsRepair = true;
                    containerIssueDetails = "container.xml is missing";
                } else {
                    try {
                        Document containerDocument = parseXmlUtf8(containerText);
                        Element rootfileElement = firstElementByName(containerDocument, "rootfile");
                        String rootfilePath = rootfileElement == null
                            ? null
                            : normalizeZipPath(rootfileElement.getAttribute("full-path"));
                        if (CompatStrings.isBlank(rootfilePath)) {
                            containerNeedsRepair = true;
                            containerIssueDetails = "container.xml does not declare a rootfile";
                            declaredOpfPath = extractDeclaredOpfPathFromContainerText(containerText);
                        } else {
                            declaredOpfPath = rootfilePath;
                        }
                    } catch (Exception ex) {
                        containerNeedsRepair = true;
                        containerIssueDetails = "container.xml is not parseable";
                        declaredOpfPath = extractDeclaredOpfPathFromContainerText(containerText);
                    }
                }

            String opfPath = findPrimaryOpfPath(zipFile, headers, preferredOpfPath);
            if (opfPath == null) {
                if (declaredOpfPath != null) {
                    issues.add(issue("OPF_MISSING", "error", false, declaredOpfPath));
                    return finishAnalysis(
                        issues,
                        new EpubAnalysis(
                            resolveStatus(issues),
                            issues,
                            declaredOpfPath,
                            parentZipPath(declaredOpfPath),
                            null,
                            new java.util.ArrayList<>(),
                            new java.util.ArrayList<>(),
                            new java.util.ArrayList<>(),
                            new java.util.ArrayList<>(),
                            new java.util.ArrayList<>(),
                            mimetypeMissing,
                            mimetypeInvalid
                        )
                    );
                }

                issues.add(issue("CONTAINER_MISSING", "error", false, containerIssueDetails));
                return finishAnalysis(
                    issues,
                    new EpubAnalysis(
                        resolveStatus(issues),
                        issues,
                        null,
                        null,
                        null,
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        mimetypeMissing,
                        mimetypeInvalid
                    )
                );
            }

            if (containerNeedsRepair) {
                issues.add(issue("CONTAINER_MISSING", "error", true, containerIssueDetails));
            } else if (declaredOpfPath != null && !declaredOpfPath.equals(opfPath)) {
                issues.add(issue("OPF_MISSING", "error", true, declaredOpfPath));
            }

            List<String> validOpfCandidates = collectValidOpfCandidates(
                zipFile,
                headers,
                declaredOpfPath != null ? declaredOpfPath : preferredOpfPath
            );
            if (validOpfCandidates.size() > 1) {
                String preferredCandidate = preferredOpfPath != null
                    ? normalizeZipPath(preferredOpfPath)
                    : null;
                if (!hasClearOpfWinner(zipFile, headers, validOpfCandidates, preferredCandidate)) {
                    issues.add(
                        issue(
                            "OPF_AMBIGUOUS",
                            "warning",
                            true,
                            "Multiple package documents were found",
                            validOpfCandidates
                        )
                    );
                }
            }

            String opfText = readZipText(zipFile, opfPath);
            if (opfText == null) {
                issues.add(issue("OPF_MISSING", "error", false, opfPath));
                return finishAnalysis(
                    issues,
                    new EpubAnalysis(
                        resolveStatus(issues),
                        issues,
                        opfPath,
                        parentZipPath(opfPath),
                        null,
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        mimetypeMissing,
                        mimetypeInvalid
                    )
                );
            }

            Document opfDocument = parseXmlUtf8(opfText);
            if (opfDocument == null) {
                issues.add(issue("OPF_MISSING", "error", false, opfPath + " is not parseable"));
                return finishAnalysis(
                    issues,
                    new EpubAnalysis(
                        resolveStatus(issues),
                        issues,
                        opfPath,
                        parentZipPath(opfPath),
                        null,
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        new java.util.ArrayList<>(),
                        mimetypeMissing,
                        mimetypeInvalid
                    )
                );
            }

            Element packageElement = opfDocument.getDocumentElement();
            String opfVersion = packageElement == null ? "" : packageElement.getAttribute("version").trim();
            if (!isSupportedOpfVersion(opfVersion)) {
                issues.add(
                    issue(
                        "OPF_VERSION_INVALID",
                        "warning",
                        true,
                        CompatStrings.isBlank(opfVersion) ? "missing version" : opfVersion
                    )
                );
            }

            String uniqueIdentifier = packageElement == null
                ? ""
                : packageElement.getAttribute("unique-identifier").trim();
            if (CompatStrings.isBlank(uniqueIdentifier)) {
                issues.add(issue("OPF_UNIQUE_IDENTIFIER_MISSING", "warning", true));
            } else if (!hasPackageUniqueIdentifier(opfDocument, uniqueIdentifier)) {
                issues.add(issue("OPF_UNIQUE_IDENTIFIER_INVALID", "warning", true, uniqueIdentifier));
            }

            String opfDir = parentZipPath(opfPath);
            Element manifestElement = firstElementByName(opfDocument, "manifest");
            Element spineElement = firstElementByName(opfDocument, "spine");
            java.util.ArrayList<ParsedManifestItem> manifestItems =
                manifestElement == null
                    ? new java.util.ArrayList<>()
                    : parseManifestItems(headers, manifestElement, opfDir);
            java.util.ArrayList<String> reconstructibleSpineItemIds =
                collectReconstructibleSpineItemIds(manifestItems);
            java.util.ArrayList<ParsedSpineItem> spineItems =
                spineElement == null
                    ? new java.util.ArrayList<>()
                    : parseSpineItems(spineElement, manifestItems);
            java.util.ArrayList<String> promotableOrphanResources =
                collectPromotableOrphanResources(headers, manifestItems, opfPath);
            java.util.ArrayList<FallbackRepairPlan> fallbackPlans =
                collectFallbackRepairPlans(manifestItems, opfDir, headers);
            java.util.HashSet<String> spineManifestIds = new java.util.HashSet<>();
            for (ParsedSpineItem spineItem : spineItems) {
                if (spineItem != null && CompatStrings.isNotBlank(spineItem.idref)) {
                    spineManifestIds.add(spineItem.idref);
                }
            }

            for (ParsedManifestItem manifestItem : manifestItems) {
                if (!manifestItem.exists) {
                    issues.add(
                        issue(
                            "MANIFEST_ITEM_MISSING",
                            "warning",
                            true,
                            manifestItem.id + ": " + manifestItem.resolvedPath
                        )
                    );
                }

                if (manifestItem.exists && hasMissingFallback(manifestItem)) {
                    issues.add(
                        issue(
                            "HIGH-FALLBACK-001",
                            "warning",
                            true,
                            manifestItem.id + ": " + manifestItem.resolvedPath
                        )
                    );
                }

                if (
                    manifestItem.exists
                        && CompatStrings.isNotBlank(manifestItem.mediaOverlay)
                        && !manifestItem.mediaOverlayExists
                ) {
                    issues.add(
                        issue(
                            "SMIL_MISSING",
                            "warning",
                            true,
                            manifestItem.id + ": " + manifestItem.mediaOverlayResolvedPath
                        )
                    );
                }
            }

            if (containsDrmProtectedContent(headers)) {
                issues.add(issue("CRIT-SEC-001", "error", false, "META-INF/encryption.xml"));
            }

            for (String orphanResource : promotableOrphanResources) {
                issues.add(issue("HIGH-MAN-001", "warning", true, orphanResource));
            }

            for (ParsedManifestItem manifestItem : manifestItems) {
                if (!manifestItem.exists || !shouldInspectContentDocument(manifestItem)) {
                    continue;
                }

                issues.addAll(
                    collectContentDocumentIssues(
                        zipFile,
                        manifestItem,
                        spineManifestIds.contains(manifestItem.id)
                    )
                );
            }

            if (spineItems.isEmpty()) {
                if (reconstructibleSpineItemIds.isEmpty()) {
                    issues.add(issue("SPINE_EMPTY", "error", false));
                } else {
                    issues.add(
                        issue(
                            "SPINE_EMPTY",
                            "error",
                            true,
                            "Reconstructible spine from readable documents"
                        )
                    );
                }
            }

            for (ParsedSpineItem spineItem : spineItems) {
                if (!spineItem.valid) {
                    issues.add(
                        issue(
                            "SPINE_ITEM_INVALID",
                            "warning",
                            true,
                            CompatStrings.isNotBlank(spineItem.idref) ? spineItem.idref : "missing idref"
                        )
                    );
                }
            }

            if (
                !spineItems.isEmpty()
                    && spineItems.stream().noneMatch(item -> item.valid)
            ) {
                if (reconstructibleSpineItemIds.isEmpty()) {
                    issues.add(issue("SPINE_EMPTY", "error", false, "No valid spine entries remain"));
                } else {
                    issues.add(
                        issue(
                            "SPINE_EMPTY",
                            "error",
                            true,
                            "Reconstructible spine from readable documents"
                        )
                    );
                }
            }

            java.util.ArrayList<String> orphanResources = collectOrphanResources(
                headers,
                manifestItems,
                opfPath
            );
            for (String orphanResource : orphanResources) {
                if (!promotableOrphanResources.contains(orphanResource)) {
                    issues.add(issue("ORPHAN_RESOURCE_UNUSED", "warning", true, orphanResource));
                }
            }

            java.util.ArrayList<EpubIssue> linkIssues = collectInternalLinkIssues(
                zipFile,
                manifestItems,
                opfDir
            );
            issues.addAll(linkIssues);

            return finishAnalysis(
                issues,
                new EpubAnalysis(
                    resolveStatus(issues),
                    issues,
                    opfPath,
                    opfDir,
                    opfDocument,
                    manifestItems,
                    spineItems,
                    reconstructibleSpineItemIds,
                    promotableOrphanResources,
                    fallbackPlans,
                    mimetypeMissing,
                    mimetypeInvalid
                )
            );
        } catch (Exception ex) {
            if (!isRecoveredArchivePath(epubPath)) {
                Path recoveredPath = recoverReadableZip(epubPath);
                if (recoveredPath != null) {
                    try {
                        EpubAnalysis recoveredAnalysis = analyzeEpub(
                            recoveredPath,
                            preferredOpfPath,
                            guidedSelections
                        );

                        java.util.ArrayList<EpubIssue> recoveredIssues =
                            new java.util.ArrayList<>();
                        recoveredIssues.add(issue("ZIP_UNREADABLE", "error", true, ex.getMessage()));
                        recoveredIssues.addAll(recoveredAnalysis.issues);

                        return new EpubAnalysis(
                            resolveStatus(recoveredIssues),
                            recoveredIssues,
                            recoveredAnalysis.opfPath,
                            recoveredAnalysis.opfDir,
                            recoveredAnalysis.opfDocument,
                            recoveredAnalysis.manifestItems,
                            recoveredAnalysis.spineItems,
                            recoveredAnalysis.reconstructibleSpineItemIds,
                            recoveredAnalysis.promotableOrphanResources,
                            recoveredAnalysis.fallbackPlans,
                            recoveredAnalysis.mimetypeMissing,
                            recoveredAnalysis.mimetypeInvalid
                        );
                    } catch (Exception recoveredEx) {
                        ex = recoveredEx;
                    }
                }
            }

            java.util.ArrayList<EpubIssue> issues = new java.util.ArrayList<>();
            issues.add(issue("ZIP_UNREADABLE", "error", false, ex.getMessage()));
            return new EpubAnalysis(
                resolveStatus(issues),
                issues,
                null,
                null,
                null,
                new java.util.ArrayList<>(),
                new java.util.ArrayList<>(),
                new java.util.ArrayList<>(),
                new java.util.ArrayList<>(),
                new java.util.ArrayList<>(),
                false,
                false
            );
        }
    }

    private EpubAnalysis analyzeWorkingCopyForRepair(
        Path workingPath,
        String preferredOpfPath,
        JSObject guidedSelections,
        java.util.Set<String> repairedIssues
    ) throws Exception {
        EpubAnalysis analysis = analyzeEpub(workingPath, preferredOpfPath, guidedSelections);
        if (containsIssue(analysis.issues, "ZIP_UNREADABLE")) {
            Path recoveredPath = recoverReadableZip(workingPath);
            if (recoveredPath != null) {
                moveFileAtomicWithFallback(recoveredPath, workingPath);
                if (repairedIssues != null) {
                    repairedIssues.add("ZIP_UNREADABLE");
                }
                analysis = analyzeEpub(workingPath, preferredOpfPath, guidedSelections);
            }
        }
        if (containsIssue(analysis.issues, "OPF_AMBIGUOUS") && repairedIssues != null) {
            repairedIssues.add("OPF_AMBIGUOUS");
        }
        return analysis;
    }

    private boolean isRecoveredArchivePath(Path epubPath) {
        if (epubPath == null) {
            return false;
        }

        Path fileName = epubPath.getFileName();
        if (fileName == null) {
            return false;
        }

        return fileName.toString().contains(".recovered.");
    }
 
    private EpubAnalysis finishAnalysis(
        java.util.ArrayList<EpubIssue> issues,
        EpubAnalysis analysis
    ) {
        return new EpubAnalysis(
            resolveStatus(issues),
            issues,
            analysis.opfPath,
            analysis.opfDir,
            analysis.opfDocument,
            analysis.manifestItems,
            analysis.spineItems,
            analysis.reconstructibleSpineItemIds,
            analysis.promotableOrphanResources,
            analysis.fallbackPlans,
            analysis.mimetypeMissing,
            analysis.mimetypeInvalid
        );
    }

    private boolean hasRepairableIssues(EpubAnalysis analysis) {
        if (analysis == null || analysis.issues == null) {
            return false;
        }

        for (EpubIssue issue : analysis.issues) {
            if (issue != null && issue.fixable) {
                return true;
            }
        }

        return false;
    }

    private String buildAnalysisSignature(EpubAnalysis analysis) {
        if (analysis == null) {
            return "";
        }

        java.util.ArrayList<String> signatures = new java.util.ArrayList<>();
        for (EpubIssue issue : analysis.issues) {
            if (issue == null) {
                continue;
            }

            StringBuilder builder = new StringBuilder();
            builder.append(issue.code == null ? "" : issue.code);
            builder.append('|');
            builder.append(issue.severity == null ? "" : issue.severity);
            builder.append('|');
            builder.append(issue.fixable);
            builder.append('|');
            builder.append(issue.messageKey == null ? "" : issue.messageKey);
            builder.append('|');
            builder.append(issue.details == null ? "" : issue.details);
            if (issue.options != null) {
                for (String option : issue.options) {
                    builder.append('|');
                    builder.append(option == null ? "" : option.trim());
                }
            }
            signatures.add(builder.toString());
        }

        java.util.Collections.sort(signatures);
        return (analysis.status == null ? "" : analysis.status) + "::" + String.join(";;", signatures);
    }

    private java.util.ArrayList<ParsedManifestItem> parseManifestItems(
        List<FileHeader> headers,
        Element manifestElement,
        String opfDir
    ) {
        java.util.ArrayList<ParsedManifestItem> items = new java.util.ArrayList<>();
        NodeList children = manifestElement.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            if (!(children.item(i) instanceof Element)) {
                continue;
            }
            Element element = (Element) children.item(i);
            if (!"item".equals(element.getLocalName())) {
                continue;
            }

            String id = element.getAttribute("id").trim();
            String href = element.getAttribute("href").trim();
            String mediaType = element.getAttribute("media-type").trim();
            String properties = element.getAttribute("properties").trim();
            String fallback = element.getAttribute("fallback").trim();
            String mediaOverlay = element.getAttribute("media-overlay").trim();
            String normalizedHref = normalizeRelativePath(href);
            String resolvedPath = resolveRelativeZipPath(opfDir, href);
            String mediaOverlayResolvedPath = CompatStrings.isBlank(mediaOverlay)
                ? ""
                : resolveRelativeZipPath(opfDir, mediaOverlay);
            items.add(
                new ParsedManifestItem(
                    id,
                    href,
                    normalizedHref,
                    resolvedPath,
                    findHeader(headers, resolvedPath) != null,
                    mediaType,
                    properties,
                    fallback,
                    mediaOverlay,
                    mediaOverlayResolvedPath,
                    CompatStrings.isBlank(mediaOverlay)
                        || findHeader(headers, mediaOverlayResolvedPath) != null,
                    element
                )
            );
        }
        return items;
    }

    private java.util.ArrayList<ParsedSpineItem> parseSpineItems(
        Element spineElement,
        java.util.ArrayList<ParsedManifestItem> manifestItems
    ) {
        java.util.HashMap<String, ParsedManifestItem> manifestById = new java.util.HashMap<>();
        for (ParsedManifestItem manifestItem : manifestItems) {
            if (CompatStrings.isNotBlank(manifestItem.id)) {
                manifestById.put(manifestItem.id, manifestItem);
            }
        }

        java.util.ArrayList<ParsedSpineItem> items = new java.util.ArrayList<>();
        NodeList children = spineElement.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            if (!(children.item(i) instanceof Element)) {
                continue;
            }
            Element element = (Element) children.item(i);
            if (!"itemref".equals(element.getLocalName())) {
                continue;
            }

            String idref = element.getAttribute("idref").trim();
            ParsedManifestItem manifestItem = CompatStrings.isNotBlank(idref)
                ? manifestById.get(idref)
                : null;
            boolean valid = manifestItem != null && manifestItem.exists;
            items.add(new ParsedSpineItem(idref, valid, element));
        }
        return items;
    }

    private java.util.ArrayList<String> collectReconstructibleSpineItemIds(
        java.util.ArrayList<ParsedManifestItem> manifestItems
    ) {
        java.util.LinkedHashSet<String> ids = new java.util.LinkedHashSet<>();
        for (ParsedManifestItem manifestItem : manifestItems) {
            if (isReconstructibleSpineManifestItem(manifestItem)) {
                ids.add(manifestItem.id);
            }
        }
        return new java.util.ArrayList<>(ids);
    }

    private boolean isReconstructibleSpineManifestItem(ParsedManifestItem manifestItem) {
        if (manifestItem == null || !manifestItem.exists || CompatStrings.isBlank(manifestItem.id)) {
            return false;
        }

        if (CompatStrings.isNotBlank(manifestItem.properties)) {
            String normalizedProperties = manifestItem.properties.toLowerCase(Locale.US);
            if (normalizedProperties.contains("nav")) {
                return false;
            }
        }

        return isReadableSpineMediaType(manifestItem.mediaType, manifestItem.normalizedHref);
    }

    private boolean isReadableSpineMediaType(String mediaType, String normalizedHref) {
        String normalizedMediaType = mediaType == null ? "" : mediaType.trim().toLowerCase(Locale.US);
        if ("application/xhtml+xml".equals(normalizedMediaType) || "image/svg+xml".equals(normalizedMediaType)) {
            return true;
        }

        String normalizedPath = normalizedHref == null ? "" : normalizedHref.toLowerCase(Locale.US);
        return normalizedPath.endsWith(".xhtml")
            || normalizedPath.endsWith(".html")
            || normalizedPath.endsWith(".htm")
            || normalizedPath.endsWith(".svg");
    }

    private java.util.ArrayList<String> collectOrphanResources(
        List<FileHeader> headers,
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        String opfPath
    ) {
        java.util.HashSet<String> referenced = new java.util.HashSet<>();
        for (ParsedManifestItem manifestItem : manifestItems) {
            referenced.add(normalizeZipPath(manifestItem.resolvedPath));
        }
        referenced.add(normalizeZipPath(opfPath));
        referenced.add("mimetype");
        referenced.add("META-INF/container.xml");

        java.util.ArrayList<String> orphanResources = new java.util.ArrayList<>();
        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }

            String entryPath = normalizeZipPath(header.getFileName());
            if (CompatStrings.isBlank(entryPath) || referenced.contains(entryPath)) {
                continue;
            }
            if (entryPath.startsWith("META-INF/")) {
                continue;
            }

            orphanResources.add(entryPath);
        }

        orphanResources.sort(String::compareTo);
        return orphanResources;
    }

    private java.util.ArrayList<String> collectPromotableOrphanResources(
        List<FileHeader> headers,
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        String opfPath
    ) {
        java.util.ArrayList<String> orphanResources = collectOrphanResources(headers, manifestItems, opfPath);
        java.util.ArrayList<String> promotable = new java.util.ArrayList<>();
        for (String orphanResource : orphanResources) {
            if (isPromotableOrphanResource(orphanResource)) {
                promotable.add(orphanResource);
            }
        }
        return promotable;
    }

    private boolean isPromotableOrphanResource(String entryPath) {
        String mediaType = detectMediaTypeFromPath(entryPath);
        if (CompatStrings.isBlank(mediaType)) {
            return false;
        }

        return mediaType.startsWith("image/")
            || mediaType.startsWith("audio/")
            || mediaType.startsWith("video/")
            || mediaType.startsWith("font/")
            || "text/css".equals(mediaType)
            || "application/xhtml+xml".equals(mediaType)
            || "application/svg+xml".equals(mediaType)
            || "image/svg+xml".equals(mediaType);
    }

    private boolean hasMissingFallback(ParsedManifestItem manifestItem) {
        if (manifestItem == null || !manifestItem.exists) {
            return false;
        }

        String normalizedProperties = manifestItem.properties == null
            ? ""
            : manifestItem.properties.toLowerCase(Locale.US);
        if (!normalizedProperties.contains("scripted")) {
            return false;
        }

        return CompatStrings.isBlank(manifestItem.fallback);
    }

    private boolean containsDrmProtectedContent(List<FileHeader> headers) {
        if (headers == null || headers.isEmpty()) {
            return false;
        }

        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }

            String entryPath = normalizeZipPath(header.getFileName()).toLowerCase(Locale.US);
            if (
                "meta-inf/encryption.xml".equals(entryPath)
                    || "meta-inf/rights.xml".equals(entryPath)
            ) {
                return true;
            }
        }

        return false;
    }

    private java.util.ArrayList<FallbackRepairPlan> collectFallbackRepairPlans(
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        String opfDir,
        List<FileHeader> headers
    ) {
        java.util.HashSet<String> usedPaths = new java.util.HashSet<>();
        if (headers != null) {
            for (FileHeader header : headers) {
                if (header != null && !header.isDirectory()) {
                    usedPaths.add(normalizeZipPath(header.getFileName()));
                }
            }
        }

        for (ParsedManifestItem manifestItem : manifestItems) {
            if (manifestItem != null && CompatStrings.isNotBlank(manifestItem.resolvedPath)) {
                usedPaths.add(normalizeZipPath(manifestItem.resolvedPath));
            }
        }

        java.util.ArrayList<FallbackRepairPlan> plans = new java.util.ArrayList<>();
        for (ParsedManifestItem manifestItem : manifestItems) {
            if (!hasMissingFallback(manifestItem)) {
                continue;
            }

            String sourceDir = parentZipPath(manifestItem.resolvedPath);
            String sourceBase = stripExtension(Paths.get(manifestItem.resolvedPath).getFileName().toString());
            if (CompatStrings.isBlank(sourceBase)) {
                sourceBase = "fallback";
            }

            String candidateResolvedPath = resolveRelativeZipPath(sourceDir, sourceBase + "-fallback.xhtml");
            candidateResolvedPath = buildUniqueSiblingPath(candidateResolvedPath, usedPaths);
            usedPaths.add(normalizeZipPath(candidateResolvedPath));

            String fallbackHref = relativizeZipPath(opfDir, candidateResolvedPath);
            String fallbackBaseId = CompatStrings.isNotBlank(manifestItem.id)
                ? stripExtension(manifestItem.id)
                : "fallback";
            String fallbackId = buildUniqueManifestId(
                manifestItems,
                fallbackBaseId + "-fallback"
            );
            plans.add(
                new FallbackRepairPlan(
                    manifestItem,
                    fallbackId,
                    fallbackHref,
                    candidateResolvedPath
                )
            );
        }

        return plans;
    }

    private java.util.ArrayList<EpubIssue> collectContentDocumentIssues(
        ZipFile zipFile,
        ParsedManifestItem manifestItem,
        boolean isSpineItem
    ) throws Exception {
        java.util.ArrayList<EpubIssue> issues = new java.util.ArrayList<>();
        FileHeader header = findHeader(zipFile.getFileHeaders(), manifestItem.resolvedPath);
        byte[] bytes = header == null ? null : readEntryBytes(zipFile, header);
        if (bytes == null) {
            return issues;
        }

        DecodedXmlBytes decoded = decodeXmlBytesDetailed(bytes);
        String text = decoded.text;
        String normalized = text == null ? "" : text;
        String sanitized = sanitizeXmlText(normalized);
        boolean reparable = canParseAsXml(sanitized);

        if (decoded.usedFallbackEncoding) {
            issues.add(issue("HIGH-ENC-001", "warning", true, manifestItem.resolvedPath));
        }

        if (containsInvalidXmlCharacters(normalized)) {
            issues.add(issue("HIGH-ENC-002", "warning", true, manifestItem.resolvedPath));
        }

        if (containsDoctypeDeclaration(normalized)) {
            issues.add(issue("HIGH-XHTML-003", "warning", true, manifestItem.resolvedPath));
        }

        if (containsBareXmlAttributes(normalized)) {
            issues.add(issue("HIGH-XHTML-002", "warning", true, manifestItem.resolvedPath));
        }

        if (!reparable) {
            issues.add(issue("CRIT-XHTML-001", "error", true, manifestItem.resolvedPath));
        } else if (isSpineItem && isLikelyHeadBodyBreak(normalized)) {
            issues.add(issue("CRIT-XHTML-001", "error", true, manifestItem.resolvedPath));
        } else if (
            containsStructuralXmlDamage(normalized)
                || !normalized.equals(sanitized)
        ) {
            issues.add(issue("HIGH-XHTML-001", "warning", true, manifestItem.resolvedPath));
        }

        return issues;
    }

    private void repairArchiveToOutput(
        Path sourceZipPath,
        Path outputZipPath,
        EpubAnalysis analysis,
        boolean rewriteOpfDocument,
        boolean rewriteContainerDocument,
        JSObject guidedSelections,
        java.util.Set<String> repairedIssues
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

            addTextEntry(outputZip, "mimetype", "application/epub+zip", true);
            if (repairedIssues != null) {
                if (analysis.mimetypeMissing) {
                    repairedIssues.add("MIMETYPE_MISSING");
                }
                if (analysis.mimetypeInvalid) {
                    repairedIssues.add("MIMETYPE_INVALID");
                }
            }
            if (rewriteContainerDocument && analysis.opfPath != null) {
                addTextEntry(
                    outputZip,
                    "META-INF/container.xml",
                    buildContainerXml(analysis.opfPath),
                    false
                );
                if (repairedIssues != null) {
                    for (EpubIssue issue : analysis.issues) {
                        if ("CONTAINER_MISSING".equals(issue.code) || "OPF_MISSING".equals(issue.code)) {
                            repairedIssues.add(issue.code);
                        }
                    }
                }
            }

            long totalBytes = totalProcessableBytes(headers);
            long processedBytes = 0L;
            java.util.Set<String> orphanEntries = new java.util.HashSet<>(
                collectOrphanResources(headers, analysis.manifestItems, analysis.opfPath)
            );
            java.util.Set<String> promotableOrphanEntries = new java.util.HashSet<>(
                analysis.promotableOrphanResources
            );
            for (FileHeader header : headers) {
                if (header == null || header.isDirectory()) {
                    continue;
                }

                ensureNotCancelled();

                String entryPath = normalizeZipPath(header.getFileName());
                if ("mimetype".equals(entryPath)) {
                    processedBytes += Math.max(1L, header.getUncompressedSize());
                    emitProgress(interpolate(5, 95, processedBytes, totalBytes));
                    continue;
                }
                if (rewriteContainerDocument && "META-INF/container.xml".equals(entryPath)) {
                    processedBytes += Math.max(1L, header.getUncompressedSize());
                    emitProgress(interpolate(5, 95, processedBytes, totalBytes));
                    continue;
                }
                if (orphanEntries.contains(entryPath) && !promotableOrphanEntries.contains(entryPath)) {
                    processedBytes += Math.max(1L, header.getUncompressedSize());
                    emitProgress(interpolate(5, 95, processedBytes, totalBytes));
                    if (repairedIssues != null) {
                        repairedIssues.add("ORPHAN_RESOURCE_UNUSED");
                    }
                    continue;
                }

                ZipParameters parameters = buildParametersFromHeader(header, entryPath, null);
                if (
                    rewriteOpfDocument
                        && analysis.opfPath != null
                        && analysis.opfPath.equals(entryPath)
                        && analysis.opfDocument != null
                ) {
                    String repairedOpf = rewritePackageDocument(analysis, repairedIssues);
                    byte[] repairedBytes = repairedOpf.getBytes(StandardCharsets.UTF_8);
                    parameters = buildParametersFromBytes(header, entryPath, repairedBytes);
                    try (InputStream entryInput = new ByteArrayInputStream(repairedBytes)) {
                        outputZip.addStream(entryInput, parameters);
                    }
                } else {
                    ParsedManifestItem manifestItem = findManifestItemByResolvedPath(
                        analysis.manifestItems,
                        entryPath
                    );
                    ContentDocumentRepairResult repairedDocument = repairInspectableContentDocument(
                        sourceZip,
                        manifestItem,
                        false
                    );
                    if (repairedDocument != null) {
                        parameters = buildParametersFromBytes(header, entryPath, repairedDocument.content);
                        try (InputStream entryInput = new ByteArrayInputStream(repairedDocument.content)) {
                            outputZip.addStream(entryInput, parameters);
                        }
                        if (repairedIssues != null) {
                            repairedIssues.addAll(repairedDocument.repairedIssueCodes);
                        }
                    } else {
                        InternalLinkRepairResult repairedContent = tryRewriteInternalLinkContent(
                            sourceZip,
                            entryPath,
                            analysis,
                            guidedSelections
                        );
                        if (repairedContent != null) {
                            parameters = buildParametersFromBytes(header, entryPath, repairedContent.content);
                            try (InputStream entryInput = new ByteArrayInputStream(repairedContent.content)) {
                                outputZip.addStream(entryInput, parameters);
                            }
                            if (repairedIssues != null) {
                                repairedIssues.addAll(repairedContent.repairedIssueCodes);
                            }
                        } else {
                            try (InputStream entryInput = new BufferedInputStream(
                                sourceZip.getInputStream(header)
                            )) {
                                outputZip.addStream(entryInput, parameters);
                            }
                        }
                    }
                }

                processedBytes += Math.max(1L, header.getUncompressedSize());
                emitProgress(interpolate(5, 95, processedBytes, totalBytes));
            }

            for (FallbackRepairPlan fallbackPlan : analysis.fallbackPlans) {
                ensureNotCancelled();

                ParsedManifestItem sourceItem = fallbackPlan.sourceItem;
                if (sourceItem == null) {
                    continue;
                }

                ContentDocumentRepairResult fallbackRepair = repairInspectableContentDocument(
                    sourceZip,
                    sourceItem,
                    true
                );
                if (fallbackRepair == null) {
                    continue;
                }

                ZipParameters parameters = new ZipParameters();
                parameters.setFileNameInZip(fallbackPlan.fallbackResolvedPath);
                parameters.setCompressionMethod(CompressionMethod.DEFLATE);
                try (InputStream entryInput = new ByteArrayInputStream(fallbackRepair.content)) {
                    outputZip.addStream(entryInput, parameters);
                }

                if (repairedIssues != null) {
                    repairedIssues.addAll(fallbackRepair.repairedIssueCodes);
                    repairedIssues.add("HIGH-FALLBACK-001");
                }
            }

            if (repairedIssues != null) {
                for (ParsedManifestItem manifestItem : analysis.manifestItems) {
                    if (manifestItem == null) {
                        continue;
                    }
                    if (!manifestItem.exists) {
                        repairedIssues.add("MANIFEST_ITEM_MISSING");
                    }
                    if (manifestItem.exists && CompatStrings.isNotBlank(manifestItem.mediaOverlay)) {
                        FileHeader mediaOverlayHeader = findHeader(headers, manifestItem.mediaOverlayResolvedPath);
                        if (mediaOverlayHeader == null) {
                            repairedIssues.add("SMIL_MISSING");
                        }
                    }
                }

                for (ParsedSpineItem spineItem : analysis.spineItems) {
                    if (spineItem != null && (!spineItem.valid)) {
                        repairedIssues.add("SPINE_ITEM_INVALID");
                    }
                }

                if (!analysis.promotableOrphanResources.isEmpty()) {
                    repairedIssues.add("HIGH-MAN-001");
                }
            }
        }
    }

    private String rewritePackageDocument(EpubAnalysis analysis) throws Exception {
        return rewritePackageDocument(analysis, null);
    }

    private String rewritePackageDocument(
        EpubAnalysis analysis,
        java.util.Set<String> repairedIssues
    ) throws Exception {
        Document document = analysis.opfDocument;
        Element packageElement = document.getDocumentElement();
        Element metadataElement = firstElementByName(document, "metadata");
        Element manifestElement = firstElementByName(document, "manifest");
        Element spineElement = firstElementByName(document, "spine");

        if (packageElement != null) {
            String version = packageElement.getAttribute("version").trim();
            if (!isSupportedOpfVersion(version)) {
                packageElement.setAttribute("version", inferOpfVersion(analysis));
                if (repairedIssues != null) {
                    repairedIssues.add("OPF_VERSION_INVALID");
                }
            }
        }

        String uniqueIdentifier = packageElement == null
            ? ""
            : packageElement.getAttribute("unique-identifier").trim();
        String normalizedUniqueIdentifier = normalizePackageUniqueIdentifier(
            document,
            packageElement,
            metadataElement,
            uniqueIdentifier
        );
        if (packageElement != null && !normalizedUniqueIdentifier.equals(uniqueIdentifier)) {
            packageElement.setAttribute("unique-identifier", normalizedUniqueIdentifier);
            if (repairedIssues != null) {
                if (CompatStrings.isBlank(uniqueIdentifier)) {
                    repairedIssues.add("OPF_UNIQUE_IDENTIFIER_MISSING");
                } else {
                    repairedIssues.add("OPF_UNIQUE_IDENTIFIER_INVALID");
                }
            }
        }

        if (manifestElement != null) {
            for (ParsedManifestItem manifestItem : analysis.manifestItems) {
                if (!manifestItem.exists) {
                    if (manifestItem.element.getParentNode() != null) {
                        manifestItem.element.getParentNode().removeChild(manifestItem.element);
                    }
                    continue;
                }

                if (!manifestItem.normalizedHref.equals(manifestItem.href)) {
                    manifestItem.element.setAttribute("href", manifestItem.normalizedHref);
                }

                if (
                    manifestItem.exists
                        && CompatStrings.isNotBlank(manifestItem.mediaOverlay)
                        && !manifestItem.mediaOverlayExists
                ) {
                    manifestItem.element.removeAttribute("media-overlay");
                }
            }

            for (String orphanPath : analysis.promotableOrphanResources) {
                if (CompatStrings.isBlank(orphanPath)) {
                    continue;
                }
                if (findManifestItemByResolvedPath(analysis.manifestItems, orphanPath) != null) {
                    continue;
                }

                Element itemElement = document.createElementNS(
                    packageElement.getNamespaceURI(),
                    "item"
                );
                String itemId = buildUniqueManifestId(analysis.manifestItems, stripExtension(Paths.get(orphanPath).getFileName().toString()));
                itemElement.setAttribute("id", itemId);
                itemElement.setAttribute("href", relativizeZipPath(analysis.opfDir, orphanPath));
                String mediaType = detectMediaTypeFromPath(orphanPath);
                if (CompatStrings.isBlank(mediaType)) {
                    mediaType = "application/octet-stream";
                }
                itemElement.setAttribute("media-type", mediaType);
                manifestElement.appendChild(itemElement);
            }

            for (FallbackRepairPlan fallbackPlan : analysis.fallbackPlans) {
                if (fallbackPlan == null || fallbackPlan.sourceItem == null) {
                    continue;
                }
                Element sourceElement = fallbackPlan.sourceItem.element;
                if (sourceElement == null) {
                    continue;
                }

                sourceElement.setAttribute("fallback", fallbackPlan.fallbackId);
                if (findManifestItemById(manifestElement, fallbackPlan.fallbackId) != null) {
                    continue;
                }

                Element fallbackItem = document.createElementNS(
                    packageElement.getNamespaceURI(),
                    "item"
                );
                fallbackItem.setAttribute("id", fallbackPlan.fallbackId);
                fallbackItem.setAttribute("href", fallbackPlan.fallbackHref);
                fallbackItem.setAttribute("media-type", "application/xhtml+xml");
                manifestElement.appendChild(fallbackItem);
            }
        }

        if (spineElement != null) {
            java.util.HashSet<String> validIds = new java.util.HashSet<>();
            for (ParsedManifestItem manifestItem : analysis.manifestItems) {
                if (manifestItem.exists && CompatStrings.isNotBlank(manifestItem.id)) {
                    validIds.add(manifestItem.id);
                }
            }

            for (ParsedSpineItem spineItem : analysis.spineItems) {
                if (!spineItem.valid || !validIds.contains(spineItem.idref)) {
                    if (spineItem.element.getParentNode() != null) {
                        spineItem.element.getParentNode().removeChild(spineItem.element);
                    }
                }
            }
        }

        if (shouldRebuildSpine(analysis)) {
            Element rebuiltSpine = spineElement != null
                ? spineElement
                : ensureSpineElement(document, manifestElement);
            clearChildren(rebuiltSpine);
            appendReconstructedSpineItems(document, rebuiltSpine, analysis);
        }

        return serializeXml(document);
    }

    private boolean shouldRebuildSpine(EpubAnalysis analysis) {
        if (analysis.reconstructibleSpineItemIds.isEmpty()) {
            return false;
        }

        if (analysis.spineItems.isEmpty()) {
            return true;
        }

        return analysis.spineItems.stream().noneMatch(item -> item.valid);
    }

    private boolean isSupportedOpfVersion(String version) {
        String normalizedVersion = version == null ? "" : version.trim();
        return "2.0".equals(normalizedVersion) || "3.0".equals(normalizedVersion);
    }

    private String inferOpfVersion(EpubAnalysis analysis) {
        boolean hasNav = false;
        boolean hasNcx = false;

        for (ParsedManifestItem manifestItem : analysis.manifestItems) {
            if (manifestItem == null || !manifestItem.exists) {
                continue;
            }

            String normalizedProperties = manifestItem.properties == null
                ? ""
                : manifestItem.properties.toLowerCase(Locale.US);
            if (normalizedProperties.contains("nav")) {
                hasNav = true;
            }

            String normalizedMediaType = manifestItem.mediaType == null
                ? ""
                : manifestItem.mediaType.trim().toLowerCase(Locale.US);
            String normalizedHref = manifestItem.normalizedHref == null
                ? ""
                : manifestItem.normalizedHref.toLowerCase(Locale.US);
            if ("application/x-dtbncx+xml".equals(normalizedMediaType) || normalizedHref.endsWith(".ncx")) {
                hasNcx = true;
            }
        }

        if (hasNav) {
            return "3.0";
        }

        if (hasNcx) {
            return "2.0";
        }

        return "3.0";
    }

    private boolean hasPackageUniqueIdentifier(Document document, String uniqueIdentifier) {
        if (document == null || CompatStrings.isBlank(uniqueIdentifier)) {
            return false;
        }

        Element metadataElement = firstElementByName(document, "metadata");
        if (metadataElement == null) {
            return false;
        }

        NodeList identifiers = metadataElement.getElementsByTagNameNS("*", "identifier");
        for (int i = 0; i < identifiers.getLength(); i++) {
            if (!(identifiers.item(i) instanceof Element)) {
                continue;
            }
            Element identifier = (Element) identifiers.item(i);
            if (uniqueIdentifier.equals(identifier.getAttribute("id").trim())) {
                return true;
            }
        }

        return false;
    }

    private String normalizePackageUniqueIdentifier(
        Document document,
        Element packageElement,
        Element metadataElement,
        String currentUniqueIdentifier
    ) {
        Element effectiveMetadata = metadataElement != null
            ? metadataElement
            : ensureMetadataElement(document, packageElement);
        if (effectiveMetadata == null) {
            return CompatStrings.isBlank(currentUniqueIdentifier)
                ? "bookid"
                : currentUniqueIdentifier;
        }

        Element identifierElement = null;
        if (CompatStrings.isNotBlank(currentUniqueIdentifier)) {
            identifierElement = findIdentifierElementById(effectiveMetadata, currentUniqueIdentifier);
        }

        if (identifierElement == null) {
            identifierElement = firstIdentifierElement(effectiveMetadata);
        }

        if (identifierElement == null) {
            identifierElement = document.createElementNS(
                "http://purl.org/dc/elements/1.1/",
                "dc:identifier"
            );
            String identifierId = buildUniqueIdentifierId(effectiveMetadata, "bookid");
            identifierElement.setAttribute("id", identifierId);
            identifierElement.setTextContent("urn:uuid:" + UUID.randomUUID());
            effectiveMetadata.appendChild(identifierElement);
            return identifierId;
        }

        String identifierId = identifierElement.getAttribute("id").trim();
        if (CompatStrings.isBlank(identifierId)) {
            identifierId = buildUniqueIdentifierId(effectiveMetadata, "bookid");
            identifierElement.setAttribute("id", identifierId);
        }

        if (CompatStrings.isBlank(identifierElement.getTextContent())) {
            identifierElement.setTextContent("urn:uuid:" + UUID.randomUUID());
        }

        return identifierId;
    }

    private Element ensureMetadataElement(Document document, Element packageElement) {
        if (document == null || packageElement == null) {
            return null;
        }

        Element metadataElement = createPackageElement(document, "metadata");
        Node firstChild = packageElement.getFirstChild();
        if (firstChild == null) {
            packageElement.appendChild(metadataElement);
        } else {
            packageElement.insertBefore(metadataElement, firstChild);
        }
        return metadataElement;
    }

    private Element firstIdentifierElement(Element metadataElement) {
        if (metadataElement == null) {
            return null;
        }

        NodeList identifiers = metadataElement.getElementsByTagNameNS("*", "identifier");
        for (int i = 0; i < identifiers.getLength(); i++) {
            if (identifiers.item(i) instanceof Element) {
                return (Element) identifiers.item(i);
            }
        }

        return null;
    }

    private Element findIdentifierElementById(Element metadataElement, String identifierId) {
        if (metadataElement == null || CompatStrings.isBlank(identifierId)) {
            return null;
        }

        NodeList identifiers = metadataElement.getElementsByTagNameNS("*", "identifier");
        for (int i = 0; i < identifiers.getLength(); i++) {
            if (!(identifiers.item(i) instanceof Element)) {
                continue;
            }
            Element identifier = (Element) identifiers.item(i);
            if (identifierId.equals(identifier.getAttribute("id").trim())) {
                return identifier;
            }
        }

        return null;
    }

    private String buildUniqueIdentifierId(Element metadataElement, String baseId) {
        java.util.HashSet<String> ids = new java.util.HashSet<>();
        NodeList identifiers = metadataElement.getElementsByTagNameNS("*", "identifier");
        for (int i = 0; i < identifiers.getLength(); i++) {
            if (!(identifiers.item(i) instanceof Element)) {
                continue;
            }
            String existingId = ((Element) identifiers.item(i)).getAttribute("id").trim();
            if (CompatStrings.isNotBlank(existingId)) {
                ids.add(existingId);
            }
        }

        if (!ids.contains(baseId)) {
            return baseId;
        }

        int suffix = 2;
        while (ids.contains(baseId + "-" + suffix)) {
            suffix += 1;
        }
        return baseId + "-" + suffix;
    }

    private void appendReconstructedSpineItems(
        Document document,
        Element spineElement,
        EpubAnalysis analysis
    ) {
        for (String idref : analysis.reconstructibleSpineItemIds) {
            Element itemref = createPackageElement(document, "itemref");
            itemref.setAttribute("idref", idref);
            spineElement.appendChild(itemref);
        }
    }

    private Element ensureSpineElement(Document document, Element manifestElement) {
        Element packageElement = document.getDocumentElement();
        Element spineElement = createPackageElement(document, "spine");
        if (packageElement == null) {
            return spineElement;
        }

        if (manifestElement != null) {
            Node sibling = manifestElement.getNextSibling();
            while (sibling != null && sibling.getNodeType() != Node.ELEMENT_NODE) {
                sibling = sibling.getNextSibling();
            }
            if (sibling != null) {
                packageElement.insertBefore(spineElement, sibling);
            } else {
                packageElement.appendChild(spineElement);
            }
        } else {
            packageElement.appendChild(spineElement);
        }

        return spineElement;
    }

    private Element createPackageElement(Document document, String localName) {
        Element packageElement = document.getDocumentElement();
        String namespace = packageElement == null ? null : packageElement.getNamespaceURI();
        if (CompatStrings.isBlank(namespace)) {
            return document.createElement(localName);
        }
        return document.createElementNS(namespace, localName);
    }

    private void clearChildren(Element element) {
        if (element == null) {
            return;
        }

        while (element.hasChildNodes()) {
            element.removeChild(element.getFirstChild());
        }
    }

    private java.util.ArrayList<EpubIssue> collectInternalLinkIssues(
        ZipFile zipFile,
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        String opfDir
    ) throws Exception {
        java.util.ArrayList<EpubIssue> issues = new java.util.ArrayList<>();
        java.util.HashMap<String, java.util.HashSet<String>> documentIdCache =
            new java.util.HashMap<>();

        for (ParsedManifestItem manifestItem : manifestItems) {
            if (!shouldInspectContentDocument(manifestItem)) {
                continue;
            }

            String sourceText = readZipText(zipFile, manifestItem.resolvedPath);
            if (sourceText == null) {
                continue;
            }

            Document document = parseXmlUtf8(sourceText);
            if (document == null) {
                continue;
            }

            java.util.HashSet<String> sourceDocumentIds = collectDocumentIds(
                zipFile,
                manifestItem.resolvedPath,
                document,
                documentIdCache
            );
            issues.addAll(
                inspectInternalLinksInDocument(
                    zipFile,
                    document,
                    manifestItem.resolvedPath,
                    opfDir,
                    manifestItems,
                    sourceDocumentIds,
                    false,
                    documentIdCache,
                    null
                ).issues
            );
        }

        return issues;
    }

    private InternalLinkRepairResult tryRewriteInternalLinkContent(
        ZipFile zipFile,
        String entryPath,
        EpubAnalysis analysis,
        JSObject guidedSelections
    ) throws Exception {
        ParsedManifestItem manifestItem = findManifestItemByResolvedPath(
            analysis.manifestItems,
            entryPath
        );
        if (manifestItem == null || !shouldInspectContentDocument(manifestItem)) {
            return null;
        }

        String sourceText = readZipText(zipFile, entryPath);
        if (sourceText == null) {
            return null;
        }

        String repairedSourceText = sanitizeXmlText(sourceText);
        Document document = parseXmlUtf8(repairedSourceText);
        if (document == null) {
            return null;
        }

        java.util.HashMap<String, java.util.HashSet<String>> documentIdCache =
            new java.util.HashMap<>();
        java.util.HashSet<String> sourceDocumentIds = collectDocumentIds(
            zipFile,
            entryPath,
            document,
            documentIdCache
        );
        InternalLinkInspectionResult inspection = inspectInternalLinksInDocument(
            zipFile,
            document,
            entryPath,
            analysis.opfDir,
            analysis.manifestItems,
            sourceDocumentIds,
            true,
            documentIdCache,
            guidedSelections
        );

        if (!inspection.changed) {
            return null;
        }

        return new InternalLinkRepairResult(
            serializeXml(document).getBytes(StandardCharsets.UTF_8),
            inspection.repairedIssueCodes
        );
    }

    private ContentDocumentRepairResult repairInspectableContentDocument(
        ZipFile zipFile,
        ParsedManifestItem manifestItem,
        boolean stripScripts
    ) throws Exception {
        if (manifestItem == null || !shouldInspectContentDocument(manifestItem)) {
            return null;
        }

        FileHeader header = findHeader(zipFile.getFileHeaders(), manifestItem.resolvedPath);
        byte[] entryBytes = header == null ? null : readEntryBytes(zipFile, header);
        if (entryBytes == null) {
            return null;
        }

        DecodedXmlBytes decoded = decodeXmlBytesDetailed(entryBytes);
        String originalText = decoded.text == null ? "" : decoded.text;
        String sanitizedText = sanitizeXmlText(originalText);
        Document document = parseXmlUtf8(sanitizedText);
        if (document == null) {
            return null;
        }

        if (stripScripts) {
            removeElementsByTagName(document, "script");
            removeElementsByTagName(document, "object");
            removeElementsByTagName(document, "embed");
        }

        String rewrittenText = serializeXml(document);
        boolean textChanged = !normalizeXmlComparison(originalText).equals(normalizeXmlComparison(rewrittenText));
        if (!stripScripts && !decoded.usedFallbackEncoding && !textChanged) {
            return null;
        }

        java.util.ArrayList<String> repairedIssueCodes = new java.util.ArrayList<>();
        if (decoded.usedFallbackEncoding) {
            repairedIssueCodes.add("HIGH-ENC-001");
        }
        if (containsInvalidXmlCharacters(originalText)) {
            repairedIssueCodes.add("HIGH-ENC-002");
        }
        if (containsDoctypeDeclaration(originalText)) {
            repairedIssueCodes.add("HIGH-XHTML-003");
        }
        if (containsBareXmlAttributes(originalText)) {
            repairedIssueCodes.add("HIGH-XHTML-002");
        }
        if (isLikelyHeadBodyBreak(originalText)) {
            repairedIssueCodes.add("CRIT-XHTML-001");
        } else if (
            containsStructuralXmlDamage(originalText)
                || !normalizeXmlComparison(originalText).equals(normalizeXmlComparison(rewrittenText))
        ) {
            repairedIssueCodes.add("HIGH-XHTML-001");
        }

        return new ContentDocumentRepairResult(
            rewrittenText.getBytes(StandardCharsets.UTF_8),
            repairedIssueCodes
        );
    }

    private InternalLinkInspectionResult inspectInternalLinksInDocument(
        ZipFile zipFile,
        Document document,
        String sourcePath,
        String opfDir,
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        java.util.HashSet<String> sourceDocumentIds,
        boolean applyFix,
        java.util.HashMap<String, java.util.HashSet<String>> documentIdCache,
        JSObject guidedSelections
    ) throws Exception {
        InternalLinkInspectionResult result = new InternalLinkInspectionResult();
        if (document == null || document.getDocumentElement() == null) {
            return result;
        }

        java.util.ArrayList<Element> elements = collectElements(document);
        for (Element element : elements) {
            org.w3c.dom.NamedNodeMap attributes = element.getAttributes();
            for (int i = 0; i < attributes.getLength(); i++) {
                Node attributeNode = attributes.item(i);
                if (attributeNode == null) {
                    continue;
                }

                String attributeName = attributeNode.getNodeName();
                String rawValue = attributeNode.getNodeValue();
                if (!isInternalLinkAttribute(attributeName) || CompatStrings.isBlank(rawValue)) {
                    continue;
                }

                InternalLinkEvaluation evaluation = evaluateInternalLinkReference(
                    zipFile,
                    sourcePath,
                    opfDir,
                    manifestItems,
                    sourceDocumentIds,
                    rawValue,
                    documentIdCache,
                    applyFix,
                    guidedSelections
                );
                if (!evaluation.issues.isEmpty()) {
                    result.issues.addAll(evaluation.issues);
                }

                if (applyFix && evaluation.changed && CompatStrings.isNotBlank(evaluation.repairedValue)) {
                    attributeNode.setNodeValue(evaluation.repairedValue);
                    result.changed = true;
                    result.repairedIssueCodes.addAll(evaluation.repairedIssueCodes);
                }
            }
        }

        return result;
    }

    private InternalLinkEvaluation evaluateInternalLinkReference(
        ZipFile zipFile,
        String sourcePath,
        String opfDir,
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        java.util.HashSet<String> sourceDocumentIds,
        String rawValue,
        java.util.HashMap<String, java.util.HashSet<String>> documentIdCache,
        boolean applyFix,
        JSObject guidedSelections
    ) throws Exception {
        InternalLinkEvaluation evaluation = new InternalLinkEvaluation(rawValue);
        InternalLinkParts parts = splitInternalLink(rawValue);
        if (parts == null || looksExternalLink(parts.pathPart)) {
            return evaluation;
        }

        String sourceDir = parentZipPath(sourcePath);
        String targetPath = CompatStrings.isBlank(parts.pathPart)
            ? sourcePath
            : resolveRelativeZipPath(sourceDir, parts.pathPart);
        PathResolution pathResolution = resolveCanonicalInternalPath(
            targetPath,
            manifestItems
        );
        if (pathResolution.canonicalPath != null) {
            targetPath = pathResolution.canonicalPath;
            if (pathResolution.issueCode != null) {
                evaluation.repairedIssueCodes.add(pathResolution.issueCode);
                evaluation.issues.add(
                    issue(
                        pathResolution.issueCode,
                        "warning",
                        pathResolution.fixable,
                        buildLinkIssueDetails(sourcePath, rawValue, targetPath)
                    )
                );
            }
        } else if (pathResolution.issueCode != null) {
            String details = pathResolution.options != null && pathResolution.options.size() > 1
                ? buildAmbiguousLinkIssueDetails(sourcePath, rawValue)
                : buildLinkIssueDetails(sourcePath, rawValue, targetPath);
            String selectedPath = resolveGuidedSelection(
                guidedSelections,
                pathResolution.issueCode,
                details,
                pathResolution.options
            );
            evaluation.issues.add(
                issue(
                    pathResolution.issueCode,
                    "warning",
                    pathResolution.fixable,
                    details,
                    pathResolution.options
                )
            );
            if (applyFix && CompatStrings.isNotBlank(selectedPath)) {
                targetPath = selectedPath;
                evaluation.repairedIssueCodes.add(pathResolution.issueCode);
            }
        }

        String canonicalFragment = parts.fragmentPart;
        if (CompatStrings.isNotBlank(parts.fragmentPart)) {
            java.util.HashSet<String> targetIds = collectDocumentIds(
                zipFile,
                targetPath,
                null,
                documentIdCache
            );
            if (targetIds.isEmpty()) {
                targetIds = sourceDocumentIds;
            }

            FragmentResolution fragmentResolution = resolveCanonicalFragment(
                parts.fragmentPart,
                targetIds
            );
            if (fragmentResolution.canonicalFragment != null) {
                canonicalFragment = fragmentResolution.canonicalFragment;
                if (fragmentResolution.issueCode != null) {
                    evaluation.repairedIssueCodes.add(fragmentResolution.issueCode);
                    evaluation.issues.add(
                        issue(
                            fragmentResolution.issueCode,
                            "warning",
                            fragmentResolution.fixable,
                            buildLinkIssueDetails(sourcePath, rawValue, targetPath + "#" + canonicalFragment)
                        )
                    );
                }
            } else if (fragmentResolution.issueCode != null) {
                String details = fragmentResolution.options != null && fragmentResolution.options.size() > 1
                    ? buildAmbiguousLinkIssueDetails(sourcePath, rawValue)
                    : buildLinkIssueDetails(sourcePath, rawValue, targetPath);
                String selectedFragment = resolveGuidedSelection(
                    guidedSelections,
                    fragmentResolution.issueCode,
                    details,
                    fragmentResolution.options
                );
                evaluation.issues.add(
                    issue(
                        fragmentResolution.issueCode,
                        "warning",
                        fragmentResolution.fixable,
                        details,
                        fragmentResolution.options
                    )
                );
                if (applyFix && CompatStrings.isNotBlank(selectedFragment)) {
                    canonicalFragment = selectedFragment;
                    evaluation.repairedIssueCodes.add(fragmentResolution.issueCode);
                }
            }
        }

        String repairedValue = buildInternalLinkValue(
            targetPath,
            parts.queryPart,
            canonicalFragment
        );
        evaluation.repairedValue = repairedValue;
        evaluation.changed = applyFix
            && !normalizeInternalLinkValue(rawValue).equals(normalizeInternalLinkValue(repairedValue));
        return evaluation;
    }

    private java.util.ArrayList<Element> collectElements(Document document) {
        java.util.ArrayList<Element> elements = new java.util.ArrayList<>();
        NodeList allElements = document.getElementsByTagNameNS("*", "*");
        for (int i = 0; i < allElements.getLength(); i++) {
            Node node = allElements.item(i);
            if (node instanceof Element) {
                elements.add((Element) node);
            }
        }
        return elements;
    }

    private void removeElementsByTagName(Document document, String localName) {
        if (document == null || CompatStrings.isBlank(localName)) {
            return;
        }

        NodeList nodes = document.getElementsByTagNameNS("*", localName);
        java.util.ArrayList<Node> removable = new java.util.ArrayList<>();
        for (int index = 0; index < nodes.getLength(); index++) {
            Node node = nodes.item(index);
            if (node != null) {
                removable.add(node);
            }
        }

        for (Node node : removable) {
            Node parent = node.getParentNode();
            if (parent != null) {
                parent.removeChild(node);
            }
        }
    }

    private String normalizeXmlComparison(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\r\n", "\n").replace('\r', '\n').trim();
    }

    private java.util.HashSet<String> collectDocumentIds(
        ZipFile zipFile,
        String documentPath,
        Document parsedDocument,
        java.util.HashMap<String, java.util.HashSet<String>> documentIdCache
    ) throws Exception {
        String normalizedPath = normalizeZipPath(documentPath);
        if (CompatStrings.isBlank(normalizedPath)) {
            return new java.util.HashSet<>();
        }

        java.util.HashSet<String> cached = documentIdCache.get(normalizedPath);
        if (cached != null) {
            return cached;
        }

        Document document = parsedDocument;
        if (document == null) {
            String documentText = readZipText(zipFile, normalizedPath);
            if (documentText == null) {
                java.util.HashSet<String> empty = new java.util.HashSet<>();
                documentIdCache.put(normalizedPath, empty);
                return empty;
            }
            document = parseXmlUtf8(documentText);
            if (document == null) {
                java.util.HashSet<String> empty = new java.util.HashSet<>();
                documentIdCache.put(normalizedPath, empty);
                return empty;
            }
        }

        java.util.HashSet<String> ids = new java.util.HashSet<>();
        NodeList allElements = document.getElementsByTagNameNS("*", "*");
        for (int i = 0; i < allElements.getLength(); i++) {
            Node node = allElements.item(i);
            if (!(node instanceof Element)) {
                continue;
            }
            Element element = (Element) node;
            String id = element.getAttribute("id").trim();
            if (CompatStrings.isNotBlank(id)) {
                ids.add(id);
            }
            String xmlId = element.getAttributeNS(XMLConstants.XML_NS_URI, "id");
            if (CompatStrings.isNotBlank(xmlId)) {
                ids.add(xmlId.trim());
            }
        }

        documentIdCache.put(normalizedPath, ids);
        return ids;
    }

    private ParsedManifestItem findManifestItemByResolvedPath(
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        String resolvedPath
    ) {
        String normalized = normalizeZipPath(resolvedPath);
        for (ParsedManifestItem manifestItem : manifestItems) {
            if (manifestItem != null && normalized.equals(normalizeZipPath(manifestItem.resolvedPath))) {
                return manifestItem;
            }
        }
        return null;
    }

    private Element findManifestItemById(Element manifestElement, String id) {
        if (manifestElement == null || CompatStrings.isBlank(id)) {
            return null;
        }

        NodeList children = manifestElement.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            if (!(children.item(index) instanceof Element)) {
                continue;
            }
            Element element = (Element) children.item(index);
            if (!"item".equals(element.getLocalName()) && !"item".equals(element.getTagName())) {
                continue;
            }
            if (id.equals(element.getAttribute("id").trim())) {
                return element;
            }
        }

        return null;
    }

    private boolean shouldInspectContentDocument(ParsedManifestItem manifestItem) {
        if (manifestItem == null || !manifestItem.exists) {
            return false;
        }

        if (isInspectableDocumentMediaType(manifestItem.mediaType)) {
            return true;
        }

        String normalizedHref = manifestItem.normalizedHref == null
            ? ""
            : manifestItem.normalizedHref.toLowerCase(Locale.US);
        return normalizedHref.endsWith(".xhtml")
            || normalizedHref.endsWith(".html")
            || normalizedHref.endsWith(".htm")
            || normalizedHref.endsWith(".svg");
    }

    private boolean isInspectableDocumentMediaType(String mediaType) {
        if (CompatStrings.isBlank(mediaType)) {
            return false;
        }

        String normalized = mediaType.trim().toLowerCase(Locale.US);
        return "application/xhtml+xml".equals(normalized)
            || "image/svg+xml".equals(normalized)
            || "text/html".equals(normalized);
    }

    private boolean isInternalLinkAttribute(String attributeName) {
        if (CompatStrings.isBlank(attributeName)) {
            return false;
        }

        String normalized = attributeName.trim().toLowerCase(Locale.US);
        return "href".equals(normalized)
            || "src".equals(normalized)
            || normalized.endsWith(":href");
    }

    private boolean looksExternalLink(String pathPart) {
        if (CompatStrings.isBlank(pathPart)) {
            return false;
        }

        String normalized = pathPart.trim();
        return normalized.matches("^[a-zA-Z][a-zA-Z0-9+.-]*:.*");
    }

    private InternalLinkParts splitInternalLink(String rawValue) {
        String normalized = rawValue == null ? "" : rawValue.trim();
        int fragmentIndex = normalized.indexOf('#');
        String beforeFragment = fragmentIndex >= 0 ? normalized.substring(0, fragmentIndex) : normalized;
        String fragmentPart = fragmentIndex >= 0 ? normalized.substring(fragmentIndex + 1) : "";
        int queryIndex = beforeFragment.indexOf('?');
        String pathPart = queryIndex >= 0 ? beforeFragment.substring(0, queryIndex) : beforeFragment;
        String queryPart = queryIndex >= 0 ? beforeFragment.substring(queryIndex) : "";
        return new InternalLinkParts(pathPart, queryPart, fragmentPart);
    }

    private PathResolution resolveCanonicalInternalPath(
        String resolvedPath,
        java.util.ArrayList<ParsedManifestItem> manifestItems
    ) {
        String normalizedResolvedPath = normalizeZipPath(resolvedPath);
        if (CompatStrings.isBlank(normalizedResolvedPath)) {
            return new PathResolution(null, null, false);
        }

        String exactMatch = null;
        java.util.ArrayList<String> caseMatches = new java.util.ArrayList<>();
        java.util.ArrayList<String> unicodeMatches = new java.util.ArrayList<>();
        java.util.ArrayList<String> basenameMatches = new java.util.ArrayList<>();
        String normalizedResolvedCaseKey = normalizedResolvedPath.toLowerCase(Locale.US);
        String normalizedResolvedUnicodeKey = normalizeUnicodeKey(normalizedResolvedPath);
        String normalizedResolvedBaseKey = basenameKey(normalizedResolvedPath);

        for (ParsedManifestItem manifestItem : manifestItems) {
            if (manifestItem == null || !manifestItem.exists) {
                continue;
            }

            String candidatePath = normalizeZipPath(manifestItem.resolvedPath);
            if (candidatePath.equals(normalizedResolvedPath)) {
                exactMatch = candidatePath;
                break;
            }

            if (candidatePath.toLowerCase(Locale.US).equals(normalizedResolvedCaseKey)) {
                caseMatches.add(candidatePath);
            }

            if (normalizeUnicodeKey(candidatePath).equals(normalizedResolvedUnicodeKey)) {
                unicodeMatches.add(candidatePath);
            }

            if (basenameKey(candidatePath).equals(normalizedResolvedBaseKey)) {
                basenameMatches.add(candidatePath);
            }
        }

        if (exactMatch != null) {
            return new PathResolution(exactMatch, null, true);
        }

        if (caseMatches.size() == 1) {
            return new PathResolution(
                caseMatches.get(0),
                "LINK_PATH_CASE_MISMATCH",
                true
            );
        }

        if (caseMatches.size() > 1) {
            return new PathResolution(
                null,
                "LINK_PATH_CASE_MISMATCH",
                true,
                uniqueSortedCandidates(caseMatches)
            );
        }

        if (unicodeMatches.size() == 1) {
            return new PathResolution(
                unicodeMatches.get(0),
                "LINK_PATH_UNICODE_MISMATCH",
                true
            );
        }

        if (unicodeMatches.size() > 1) {
            return new PathResolution(
                null,
                "LINK_PATH_UNICODE_MISMATCH",
                true,
                uniqueSortedCandidates(unicodeMatches)
            );
        }

        if (basenameMatches.size() == 1) {
            return new PathResolution(
                basenameMatches.get(0),
                "LINK_TARGET_MISSING",
                true
            );
        }

        if (basenameMatches.size() > 1) {
            return new PathResolution(
                null,
                "LINK_TARGET_MISSING",
                true,
                uniqueSortedCandidates(basenameMatches)
            );
        }

        return new PathResolution(null, "LINK_TARGET_MISSING", false);
    }

    private FragmentResolution resolveCanonicalFragment(
        String fragment,
        java.util.HashSet<String> ids
    ) {
        if (CompatStrings.isBlank(fragment) || ids == null || ids.isEmpty()) {
            return new FragmentResolution(null, null, false);
        }

        String trimmedFragment = fragment.trim();
        if (ids.contains(trimmedFragment)) {
            return new FragmentResolution(trimmedFragment, null, true);
        }

        String caseKey = trimmedFragment.toLowerCase(Locale.US);
        String unicodeKey = normalizeUnicodeKey(trimmedFragment);
        java.util.ArrayList<String> caseMatches = new java.util.ArrayList<>();
        java.util.ArrayList<String> unicodeMatches = new java.util.ArrayList<>();

        for (String candidate : ids) {
            if (candidate == null) {
                continue;
            }
            if (candidate.toLowerCase(Locale.US).equals(caseKey)) {
                caseMatches.add(candidate);
            }
            if (normalizeUnicodeKey(candidate).equals(unicodeKey)) {
                unicodeMatches.add(candidate);
            }
        }

        if (caseMatches.size() == 1) {
            return new FragmentResolution(
                caseMatches.get(0),
                "LINK_FRAGMENT_MISSING",
                true
            );
        }

        if (caseMatches.size() > 1) {
            return new FragmentResolution(
                null,
                "LINK_FRAGMENT_MISSING",
                true,
                uniqueSortedCandidates(caseMatches)
            );
        }

        if (unicodeMatches.size() == 1) {
            return new FragmentResolution(
                unicodeMatches.get(0),
                "LINK_FRAGMENT_MISSING",
                true
            );
        }

        if (unicodeMatches.size() > 1) {
            return new FragmentResolution(
                null,
                "LINK_FRAGMENT_MISSING",
                true,
                uniqueSortedCandidates(unicodeMatches)
            );
        }

        return new FragmentResolution(null, "LINK_FRAGMENT_MISSING", false);
    }

    private String buildInternalLinkValue(
        String targetPath,
        String queryPart,
        String fragmentPart
    ) {
        StringBuilder builder = new StringBuilder();
        if (CompatStrings.isNotBlank(targetPath)) {
            builder.append(normalizeZipPath(targetPath));
        }
        if (CompatStrings.isNotBlank(queryPart)) {
            builder.append(queryPart);
        }
        if (CompatStrings.isNotBlank(fragmentPart)) {
            builder.append('#').append(fragmentPart);
        }
        return builder.toString();
    }

    private String buildLinkIssueDetails(
        String sourcePath,
        String rawValue,
        String repairedValue
    ) {
        return normalizeZipPath(sourcePath) + ": " + rawValue + " -> " + repairedValue;
    }

    private String buildAmbiguousLinkIssueDetails(
        String sourcePath,
        String rawValue
    ) {
        return normalizeZipPath(sourcePath) + ": " + rawValue;
    }

    private String resolveGuidedSelection(
        JSObject guidedSelections,
        String issueCode,
        String details,
        List<String> options
    ) {
        if (guidedSelections == null || options == null || options.isEmpty()) {
            return null;
        }

        java.util.ArrayList<String> normalizedOptions = new java.util.ArrayList<>();
        for (String option : options) {
            if (CompatStrings.isNotBlank(option)) {
                normalizedOptions.add(option.trim());
            }
        }
        if (normalizedOptions.isEmpty()) {
            return null;
        }

        String key = buildIssueSelectionKey(issueCode, details, normalizedOptions);
        String selected = normalizeZipPath(guidedSelections.getString(key));
        if (CompatStrings.isBlank(selected)) {
            return null;
        }
        for (String option : normalizedOptions) {
            if (selected.equals(option)) {
                return selected;
            }
        }
        return null;
    }

    private String buildIssueSelectionKey(
        String code,
        String details,
        List<String> options
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append(code == null ? "" : code);
        builder.append("::");
        builder.append(details == null ? "" : details);
        if (options != null) {
            for (String option : options) {
                builder.append("::");
                builder.append(option == null ? "" : option.trim());
            }
        }
        return builder.toString();
    }

    private String normalizeInternalLinkValue(String rawValue) {
        InternalLinkParts parts = splitInternalLink(rawValue);
        if (parts == null) {
            return normalizeZipPath(rawValue);
        }
        return buildInternalLinkValue(parts.pathPart, parts.queryPart, parts.fragmentPart);
    }

    private static final class InternalLinkInspectionResult {
        final java.util.ArrayList<EpubIssue> issues;
        boolean changed;
        final java.util.ArrayList<String> repairedIssueCodes;

        InternalLinkInspectionResult() {
            this.issues = new java.util.ArrayList<>();
            this.repairedIssueCodes = new java.util.ArrayList<>();
        }
    }

    private static final class InternalLinkRepairResult {
        final byte[] content;
        final java.util.ArrayList<String> repairedIssueCodes;

        InternalLinkRepairResult(byte[] content, java.util.ArrayList<String> repairedIssueCodes) {
            this.content = content;
            this.repairedIssueCodes = repairedIssueCodes == null
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(repairedIssueCodes);
        }
    }

    private static final class ContentDocumentRepairResult {
        final byte[] content;
        final java.util.ArrayList<String> repairedIssueCodes;

        ContentDocumentRepairResult(byte[] content, java.util.ArrayList<String> repairedIssueCodes) {
            this.content = content;
            this.repairedIssueCodes = repairedIssueCodes == null
                ? new java.util.ArrayList<>()
                : new java.util.ArrayList<>(repairedIssueCodes);
        }
    }

    private static final class InternalLinkEvaluation {
        final String rawValue;
        final java.util.ArrayList<EpubIssue> issues;
        final java.util.ArrayList<String> repairedIssueCodes;
        String repairedValue;
        boolean changed;

        InternalLinkEvaluation(String rawValue) {
            this.rawValue = rawValue;
            this.issues = new java.util.ArrayList<>();
            this.repairedIssueCodes = new java.util.ArrayList<>();
            this.repairedValue = rawValue;
        }
    }

    private static final class InternalLinkParts {
        final String pathPart;
        final String queryPart;
        final String fragmentPart;

        InternalLinkParts(String pathPart, String queryPart, String fragmentPart) {
            this.pathPart = pathPart;
            this.queryPart = queryPart;
            this.fragmentPart = fragmentPart;
        }
    }

    private static final class PathResolution {
        final String canonicalPath;
        final String issueCode;
        final boolean fixable;
        final java.util.ArrayList<String> options;

        PathResolution(String canonicalPath, String issueCode, boolean fixable) {
            this(canonicalPath, issueCode, fixable, null);
        }

        PathResolution(
            String canonicalPath,
            String issueCode,
            boolean fixable,
            java.util.ArrayList<String> options
        ) {
            this.canonicalPath = canonicalPath;
            this.issueCode = issueCode;
            this.fixable = fixable;
            this.options = options;
        }
    }

    private static final class FragmentResolution {
        final String canonicalFragment;
        final String issueCode;
        final boolean fixable;
        final java.util.ArrayList<String> options;

        FragmentResolution(String canonicalFragment, String issueCode, boolean fixable) {
            this(canonicalFragment, issueCode, fixable, null);
        }

        FragmentResolution(
            String canonicalFragment,
            String issueCode,
            boolean fixable,
            java.util.ArrayList<String> options
        ) {
            this.canonicalFragment = canonicalFragment;
            this.issueCode = issueCode;
            this.fixable = fixable;
            this.options = options;
        }
    }

    private java.util.ArrayList<String> uniqueSortedCandidates(List<String> candidates) {
        java.util.TreeSet<String> sorted = new java.util.TreeSet<>();
        if (candidates != null) {
            for (String candidate : candidates) {
                if (CompatStrings.isNotBlank(candidate)) {
                    sorted.add(candidate.trim());
                }
            }
        }
        return new java.util.ArrayList<>(sorted);
    }

    private String normalizeUnicodeKey(String value) {
        String normalized = normalizeZipPath(value);
        return Normalizer.normalize(normalized, Normalizer.Form.NFC).toLowerCase(Locale.US);
    }

    private String basenameKey(String value) {
        String normalized = normalizeZipPath(value).toLowerCase(Locale.US);
        int lastSlash = normalized.lastIndexOf('/');
        return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
    }

    private JSArray toIssueArray(java.util.ArrayList<EpubIssue> issues) {
        JSArray array = new JSArray();
        for (EpubIssue issue : issues) {
            JSObject item = new JSObject();
            item.put("code", issue.code);
            item.put("severity", issue.severity);
            item.put("fixable", issue.fixable);
            item.put("messageKey", issue.messageKey);
            if (CompatStrings.isNotBlank(issue.details)) {
                item.put("details", issue.details);
            }
            if (issue.options != null && !issue.options.isEmpty()) {
                JSArray optionsArray = new JSArray();
                for (String option : issue.options) {
                    optionsArray.put(option);
                }
                item.put("options", optionsArray);
            }
            array.put(item);
        }
        return array;
    }

    private String readZipText(ZipFile zipFile, String path) throws IOException {
        try {
            List<FileHeader> headers = zipFile.getFileHeaders();
            FileHeader header = findHeader(headers, path);
            if (header == null) {
                return null;
            }

            return decodeXmlBytes(readEntryBytes(zipFile, header));
        } catch (Exception ex) {
            return null;
        }
    }

    private String decodeXmlBytes(byte[] bytes) {
        return decodeXmlBytesDetailed(bytes).text;
    }

    private DecodedXmlBytes decodeXmlBytesDetailed(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return new DecodedXmlBytes("", StandardCharsets.UTF_8.name(), null, false);
        }

        java.util.ArrayList<Charset> candidates = new java.util.ArrayList<>();
        int offset = 0;
        String declaredEncoding = null;
        if (startsWith(bytes, new byte[] {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF})) {
            offset = 3;
            candidates.add(StandardCharsets.UTF_8);
            declaredEncoding = StandardCharsets.UTF_8.name();
        } else if (startsWith(bytes, new byte[] {(byte) 0xFE, (byte) 0xFF})) {
            offset = 2;
            candidates.add(StandardCharsets.UTF_16BE);
            declaredEncoding = StandardCharsets.UTF_16BE.name();
        } else if (startsWith(bytes, new byte[] {(byte) 0xFF, (byte) 0xFE})) {
            offset = 2;
            candidates.add(StandardCharsets.UTF_16LE);
            declaredEncoding = StandardCharsets.UTF_16LE.name();
        } else {
            int probeLength = Math.min(bytes.length, 256);
            String probe = new String(bytes, 0, probeLength, StandardCharsets.ISO_8859_1);
            Matcher matcher = XML_DECLARATION_ENCODING_PATTERN.matcher(probe);
            if (matcher.find()) {
                declaredEncoding = matcher.group(2).trim();
                try {
                    candidates.add(Charset.forName(declaredEncoding));
                } catch (Exception ignored) {
                    // Fall through to default candidates.
                }
            }
        }

        candidates.add(StandardCharsets.UTF_8);
        candidates.add(StandardCharsets.ISO_8859_1);
        candidates.add(Charset.forName("windows-1252"));

        String fallbackReason = "UTF-8";
        String text = null;
        for (Charset candidate : candidates) {
            if (candidate == null) {
                continue;
            }
            try {
                CharsetDecoder decoder = candidate
                    .newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT);
                text = decoder.decode(ByteBuffer.wrap(bytes, offset, bytes.length - offset)).toString();
                fallbackReason = candidate.name();
                break;
            } catch (CharacterCodingException ignored) {
                // Try the next candidate.
            } catch (Exception ignored) {
                // Try the next candidate.
            }
        }

        if (text == null) {
            text = new String(bytes, offset, bytes.length - offset, StandardCharsets.UTF_8);
            fallbackReason = StandardCharsets.UTF_8.name();
        }

        boolean usedFallbackEncoding = CompatStrings.isNotBlank(declaredEncoding)
            && !declaredEncoding.equalsIgnoreCase(fallbackReason);

        return new DecodedXmlBytes(text, fallbackReason, declaredEncoding, usedFallbackEncoding);
    }

    private boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes == null || prefix == null || bytes.length < prefix.length) {
            return false;
        }

        for (int index = 0; index < prefix.length; index++) {
            if (bytes[index] != prefix[index]) {
                return false;
            }
        }

        return true;
    }

    private static final class DecodedXmlBytes {
        final String text;
        final String charsetName;
        final String declaredEncoding;
        final boolean usedFallbackEncoding;

        DecodedXmlBytes(
            String text,
            String charsetName,
            String declaredEncoding,
            boolean usedFallbackEncoding
        ) {
            this.text = text;
            this.charsetName = charsetName;
            this.declaredEncoding = declaredEncoding;
            this.usedFallbackEncoding = usedFallbackEncoding;
        }
    }

    private boolean containsDoctypeDeclaration(String text) {
        if (CompatStrings.isBlank(text)) {
            return false;
        }

        String lower = text.toLowerCase(Locale.US);
        return lower.contains("<!doctype");
    }

    private boolean containsInvalidXmlCharacters(String text) {
        if (CompatStrings.isBlank(text)) {
            return false;
        }

        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            if (
                current == '\u0009'
                    || current == '\n'
                    || current == '\r'
                    || current >= '\u0020'
                    || (current >= '\uD800' && current <= '\uDFFF')
            ) {
                continue;
            }
            return true;
        }

        return false;
    }

    private boolean containsBareXmlAttributes(String text) {
        if (CompatStrings.isBlank(text)) {
            return false;
        }

        Pattern bareAttributePattern = Pattern.compile(
            "<[A-Za-z_:][^>]*\\s+[A-Za-z_:][-A-Za-z0-9_:.]*\\s*=\\s*[^\"'\\s>][^\\s>]*",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL
        );
        return bareAttributePattern.matcher(text).find();
    }

    private boolean containsStructuralXmlDamage(String text) {
        if (CompatStrings.isBlank(text)) {
            return false;
        }

        String lower = text.toLowerCase(Locale.US);
        return (
            lower.contains("<body")
                && !lower.contains("</body>")
                || lower.contains("<head")
                    && !lower.contains("</head>")
                || lower.contains("<p")
                    && !lower.contains("</p>")
                || lower.contains("<div")
                    && !lower.contains("</div>")
        );
    }

    private boolean isLikelyHeadBodyBreak(String text) {
        if (CompatStrings.isBlank(text)) {
            return false;
        }

        String lower = text.toLowerCase(Locale.US);
        int headOpen = lower.indexOf("<head");
        int headClose = lower.indexOf("</head>");
        int bodyOpen = lower.indexOf("<body");
        return headOpen >= 0 && bodyOpen > headOpen && headClose < 0;
    }

    private boolean canParseAsXml(String text) {
        if (CompatStrings.isBlank(text)) {
            return false;
        }

        try {
            return parseXmlUtf8(text) != null;
        } catch (Exception ex) {
            return false;
        }
    }

    private String sanitizeXmlText(String text) {
        if (CompatStrings.isBlank(text)) {
            return "";
        }

        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        normalized = removeDoctypeDeclarations(normalized);
        normalized = replaceUnknownEntityReferences(normalized);
        normalized = removeInvalidXmlCharacters(normalized);
        StringBuilder output = new StringBuilder(normalized.length() + 64);
        Deque<String> openTags = new ArrayDeque<>();

        int index = 0;
        while (index < normalized.length()) {
            char current = normalized.charAt(index);
            if (current != '<') {
                output.append(current);
                index += 1;
                continue;
            }

            if (normalized.regionMatches(true, index, "<!--", 0, 4)) {
                int end = normalized.indexOf("-->", index + 4);
                if (end < 0) {
                    output.append(normalized.substring(index));
                    break;
                }
                output.append(normalized, index, end + 3);
                index = end + 3;
                continue;
            }

            if (normalized.regionMatches(true, index, "<?", 0, 2)) {
                int end = normalized.indexOf("?>", index + 2);
                if (end < 0) {
                    output.append(normalized.substring(index));
                    break;
                }
                output.append(normalized, index, end + 2);
                index = end + 2;
                continue;
            }

            if (startsWithIgnoreCase(normalized, index, "<![cdata[")) {
                int end = normalized.toLowerCase(Locale.US).indexOf("]]>", index + 9);
                if (end < 0) {
                    output.append(normalized.substring(index));
                    break;
                }
                output.append(normalized, index, end + 3);
                index = end + 3;
                continue;
            }

            if (startsWithIgnoreCase(normalized, index, "<!doctype")) {
                index = skipMarkupDeclaration(normalized, index);
                continue;
            }

            int end = findTagEnd(normalized, index + 1);
            if (end < 0) {
                output.append(normalized.substring(index));
                break;
            }

            String tagContent = normalized.substring(index + 1, end).trim();
            index = end + 1;

            if (tagContent.isEmpty() || tagContent.startsWith("!")) {
                continue;
            }

            if (tagContent.startsWith("/")) {
                String closeName = extractTagName(tagContent.substring(1));
                closeOpenTags(output, openTags, closeName);
                continue;
            }

            boolean selfClosing = tagContent.endsWith("/");
            if (selfClosing) {
                tagContent = tagContent.substring(0, tagContent.length() - 1).trim();
            }

            String tagName = extractTagName(tagContent);
            if (CompatStrings.isBlank(tagName)) {
                continue;
            }

            String remainder = tagContent.substring(tagName.length()).trim();
            if ("body".equalsIgnoreCase(tagName)) {
                closeOpenTagIfPresent(output, openTags, "head");
            }

            if (isVoidElement(tagName)) {
                selfClosing = true;
            }

            output.append('<').append(tagName);
            String sanitizedAttributes = sanitizeAttributeList(remainder);
            if (CompatStrings.isNotBlank(sanitizedAttributes)) {
                output.append(' ').append(sanitizedAttributes);
            }
            if (selfClosing) {
                output.append("/>");
            } else {
                output.append('>');
                openTags.push(tagName);
            }
        }

        while (!openTags.isEmpty()) {
            output.append("</").append(openTags.pop()).append('>');
        }

        return output.toString();
    }

    private int skipMarkupDeclaration(String text, int startIndex) {
        int end = text.indexOf("]>", startIndex);
        if (end >= 0) {
            return end + 2;
        }

        end = findTagEnd(text, startIndex + 1);
        if (end >= 0) {
            return end + 1;
        }

        return text.length();
    }

    private int findTagEnd(String text, int startIndex) {
        boolean inSingleQuote = false;
        boolean inDoubleQuote = false;
        for (int index = startIndex; index < text.length(); index++) {
            char current = text.charAt(index);
            if (current == '\'' && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            } else if (current == '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            } else if (current == '>' && !inSingleQuote && !inDoubleQuote) {
                return index;
            }
        }

        return -1;
    }

    private String extractTagName(String rawTag) {
        if (CompatStrings.isBlank(rawTag)) {
            return "";
        }

        String[] parts = rawTag.trim().split("\\s+", 2);
        return parts.length == 0 ? "" : parts[0].trim();
    }

    private String sanitizeAttributeList(String rawAttributes) {
        if (CompatStrings.isBlank(rawAttributes)) {
            return "";
        }

        StringBuilder output = new StringBuilder(rawAttributes.length());
        int index = 0;
        while (index < rawAttributes.length()) {
            while (index < rawAttributes.length() && Character.isWhitespace(rawAttributes.charAt(index))) {
                index += 1;
            }
            if (index >= rawAttributes.length()) {
                break;
            }

            int nameStart = index;
            while (
                index < rawAttributes.length()
                    && isXmlNameChar(rawAttributes.charAt(index))
            ) {
                index += 1;
            }
            if (index == nameStart) {
                index += 1;
                continue;
            }

            String name = rawAttributes.substring(nameStart, index);
            while (index < rawAttributes.length() && Character.isWhitespace(rawAttributes.charAt(index))) {
                index += 1;
            }

            String value = null;
            if (index < rawAttributes.length() && rawAttributes.charAt(index) == '=') {
                index += 1;
                while (index < rawAttributes.length() && Character.isWhitespace(rawAttributes.charAt(index))) {
                    index += 1;
                }

                if (index < rawAttributes.length()) {
                    char quote = rawAttributes.charAt(index);
                    if (quote == '"' || quote == '\'') {
                        index += 1;
                        int valueStart = index;
                        while (index < rawAttributes.length() && rawAttributes.charAt(index) != quote) {
                            index += 1;
                        }
                        value = rawAttributes.substring(valueStart, Math.min(index, rawAttributes.length()));
                        if (index < rawAttributes.length()) {
                            index += 1;
                        }
                    } else {
                        int valueStart = index;
                        while (
                            index < rawAttributes.length()
                                && !Character.isWhitespace(rawAttributes.charAt(index))
                        ) {
                            index += 1;
                        }
                        value = rawAttributes.substring(valueStart, index);
                    }
                }
            }

            if (output.length() > 0) {
                output.append(' ');
            }
            output.append(name);
            if (value != null) {
                output.append("=\"").append(escapeXml(value)).append('"');
            }
        }

        return output.toString().trim();
    }

    private boolean isXmlNameChar(char value) {
        return Character.isLetterOrDigit(value) || value == '_' || value == '-' || value == ':' || value == '.';
    }

    private boolean isVoidElement(String tagName) {
        if (CompatStrings.isBlank(tagName)) {
            return false;
        }

        switch (tagName.toLowerCase(Locale.US)) {
            case "area":
            case "base":
            case "br":
            case "col":
            case "embed":
            case "hr":
            case "img":
            case "input":
            case "link":
            case "meta":
            case "param":
            case "source":
            case "track":
            case "wbr":
                return true;
            default:
                return false;
        }
    }

    private void closeOpenTagIfPresent(
        StringBuilder output,
        Deque<String> openTags,
        String tagName
    ) {
        if (CompatStrings.isBlank(tagName) || openTags.isEmpty()) {
            return;
        }

        java.util.ArrayList<String> closedTags = new java.util.ArrayList<>();
        boolean matched = false;
        while (!openTags.isEmpty()) {
            String openTag = openTags.pop();
            closedTags.add(openTag);
            if (openTag.equalsIgnoreCase(tagName)) {
                matched = true;
                break;
            }
        }

        if (!matched) {
            restoreOpenTags(openTags, closedTags);
            return;
        }

        for (String closeTag : closedTags) {
            output.append("</").append(closeTag).append('>');
        }
    }

    private void closeOpenTags(
        StringBuilder output,
        Deque<String> openTags,
        String tagName
    ) {
        if (CompatStrings.isBlank(tagName)) {
            return;
        }

        java.util.ArrayList<String> closedTags = new java.util.ArrayList<>();
        boolean matched = false;
        while (!openTags.isEmpty()) {
            String openTag = openTags.pop();
            closedTags.add(openTag);
            if (openTag.equalsIgnoreCase(tagName)) {
                matched = true;
                break;
            }
        }

        if (!matched) {
            restoreOpenTags(openTags, closedTags);
            return;
        }

        for (String closeTag : closedTags) {
            output.append("</").append(closeTag).append('>');
        }
    }

    private void restoreOpenTags(
        Deque<String> openTags,
        List<String> closedTags
    ) {
        for (int index = closedTags.size() - 1; index >= 0; index -= 1) {
            openTags.push(closedTags.get(index));
        }
    }

    private String removeDoctypeDeclarations(String text) {
        if (CompatStrings.isBlank(text)) {
            return "";
        }

        StringBuilder output = new StringBuilder(text.length());
        int index = 0;
        String lower = text.toLowerCase(Locale.US);
        while (index < text.length()) {
            int start = lower.indexOf("<!doctype", index);
            if (start < 0) {
                output.append(text.substring(index));
                break;
            }

            output.append(text, index, start);
            int end = lower.indexOf("]>", start);
            if (end >= 0) {
                index = end + 2;
                continue;
            }

            end = lower.indexOf('>', start);
            if (end >= 0) {
                index = end + 1;
                continue;
            }

            break;
        }

        return output.toString();
    }

    private String removeInvalidXmlCharacters(String text) {
        if (CompatStrings.isBlank(text)) {
            return "";
        }

        StringBuilder output = new StringBuilder(text.length());
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            if (
                current == '\u0009'
                    || current == '\n'
                    || current == '\r'
                    || current >= '\u0020'
                    || (current >= '\uD800' && current <= '\uDFFF')
            ) {
                output.append(current);
            }
        }
        return output.toString();
    }

    private String replaceUnknownEntityReferences(String text) {
        if (CompatStrings.isBlank(text)) {
            return "";
        }

        StringBuilder output = new StringBuilder(text.length());
        int index = 0;
        while (index < text.length()) {
            char current = text.charAt(index);
            if (current == '&') {
                int semicolonIndex = text.indexOf(';', index + 1);
                if (semicolonIndex > index + 1) {
                    String entityName = text.substring(index + 1, semicolonIndex);
                    if (
                        "amp".equals(entityName)
                            || "lt".equals(entityName)
                            || "gt".equals(entityName)
                            || "apos".equals(entityName)
                            || "quot".equals(entityName)
                            || entityName.startsWith("#")
                    ) {
                        output.append('&').append(entityName).append(';');
                    } else {
                        output.append(entityName);
                    }
                    index = semicolonIndex + 1;
                    continue;
                }
            }

            output.append(current);
            index += 1;
        }

        return output.toString();
    }

    private boolean startsWithIgnoreCase(String text, int startIndex, String prefix) {
        if (text == null || prefix == null || startIndex < 0) {
            return false;
        }

        if (text.length() - startIndex < prefix.length()) {
            return false;
        }

        return text.regionMatches(true, startIndex, prefix, 0, prefix.length());
    }

    private String buildUniqueSiblingPath(String candidatePath, java.util.Set<String> usedPaths) {
        if (CompatStrings.isBlank(candidatePath)) {
            return candidatePath;
        }

        String normalizedCandidate = normalizeZipPath(candidatePath);
        if (usedPaths == null || !usedPaths.contains(normalizedCandidate)) {
            return normalizedCandidate;
        }

        String ext = extensionFromPath(normalizedCandidate);
        String baseName = stripExtension(Paths.get(normalizedCandidate).getFileName().toString());
        String parentDir = parentZipPath(normalizedCandidate);
        int suffix = 1;
        while (true) {
            String fileName = baseName + "-" + suffix + (CompatStrings.isBlank(ext) ? "" : "." + ext);
            String next = CompatStrings.isBlank(parentDir) ? fileName : parentDir + "/" + fileName;
            if (usedPaths == null || !usedPaths.contains(normalizeZipPath(next))) {
                return next;
            }
            suffix += 1;
        }
    }

    private String buildUniqueManifestId(
        java.util.ArrayList<ParsedManifestItem> manifestItems,
        String baseId
    ) {
        String candidate = CompatStrings.isBlank(baseId) ? "fallback" : baseId;
        java.util.HashSet<String> usedIds = new java.util.HashSet<>();
        for (ParsedManifestItem manifestItem : manifestItems) {
            if (manifestItem != null && CompatStrings.isNotBlank(manifestItem.id)) {
                usedIds.add(manifestItem.id);
            }
        }

        if (!usedIds.contains(candidate)) {
            return candidate;
        }

        int suffix = 1;
        while (true) {
            String next = candidate + "-" + suffix;
            if (!usedIds.contains(next)) {
                return next;
            }
            suffix += 1;
        }
    }

    private String detectMediaTypeFromPath(String path) {
        String ext = extensionFromPath(path);
        switch (ext) {
            case "xhtml":
            case "html":
            case "htm":
                return "application/xhtml+xml";
            case "svg":
                return "image/svg+xml";
            case "css":
                return "text/css";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "gif":
                return "image/gif";
            case "webp":
                return "image/webp";
            case "avif":
                return "image/avif";
            case "mp3":
                return "audio/mpeg";
            case "m4a":
                return "audio/mp4";
            case "mp4":
                return "video/mp4";
            case "webm":
                return "video/webm";
            case "wav":
                return "audio/wav";
            case "otf":
                return "font/otf";
            case "ttf":
                return "font/ttf";
            case "woff":
                return "font/woff";
            case "woff2":
                return "font/woff2";
            default:
                return "";
        }
    }

    private String normalizeRelativePath(String path) {
        if (path == null) {
            return "";
        }

        String[] pathParts = path.split("[?#]", 2);
        return normalizeZipPath(pathParts.length > 0 ? pathParts[0] : path);
    }

    private java.util.ArrayList<String> buildRepairedIssues(EpubAnalysis analysis) {
        java.util.LinkedHashSet<String> repairedIssues = new java.util.LinkedHashSet<>();
        for (EpubIssue issue : analysis.issues) {
            if (issue.fixable) {
                repairedIssues.add(issue.code);
            }
        }
        return new java.util.ArrayList<>(repairedIssues);
    }

    private boolean containsIssue(
        java.util.ArrayList<EpubIssue> issues,
        String code
    ) {
        if (issues == null || CompatStrings.isBlank(code)) {
            return false;
        }

        for (EpubIssue issue : issues) {
            if (issue != null && code.equals(issue.code)) {
                return true;
            }
        }

        return false;
    }

    private boolean shouldRewritePackageDocument(EpubAnalysis analysis) {
        for (EpubIssue issue : analysis.issues) {
            if ("MIMETYPE_MISSING".equals(issue.code) || "MIMETYPE_INVALID".equals(issue.code)) {
                continue;
            }

            if (issue.fixable || isBlockingIssue(issue.code)) {
                return true;
            }
        }

        return false;
    }

    private boolean shouldRewriteContainerDocument(EpubAnalysis analysis) {
        if (analysis.opfPath == null) {
            return false;
        }

        for (EpubIssue issue : analysis.issues) {
            if ("CONTAINER_MISSING".equals(issue.code) || "OPF_MISSING".equals(issue.code)) {
                return true;
            }
        }

        return false;
    }

    private String buildExportFileName(String workingFileName, String requestedName) {
        String candidate = CompatStrings.isNotBlank(requestedName)
            ? requestedName.trim()
            : stripExtension(workingFileName) + "_fixed.epub";
        if (!candidate.toLowerCase(Locale.US).endsWith(".epub")) {
            candidate = candidate + ".epub";
        }

        String safe = candidate.replaceAll("[/\\\\:*?\"<>|]", "_").replaceAll("[\\x00-\\x1f\\x7f]", "_").trim();
        if (safe.isEmpty()) {
            safe = stripExtension(workingFileName) + "_fixed.epub";
        }
        return safe;
    }

    private Path resolveSessionWorkingPath(String sessionId) throws IOException {
        Path sessionDir = resolveSessionDir(sessionId);
        if (!Files.isDirectory(sessionDir)) {
            throw new IOException("Session not found");
        }

        try (Stream<Path> stream = Files.list(sessionDir)) {
            Path candidate = stream
                .filter(Files::isRegularFile)
                .filter(path -> {
                    String name = path.getFileName().toString().toLowerCase(Locale.US);
                    return name.endsWith(".epub")
                        && !name.endsWith(".tmp")
                        && !name.endsWith(".bak")
                        && !name.endsWith("_fixed.epub")
                        && !name.endsWith("_output.epub");
                })
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .findFirst()
                .orElse(null);

            if (candidate != null) {
                return candidate;
            }
        }

        try (Stream<Path> stream = Files.list(sessionDir)) {
            return stream
                .filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().toLowerCase(Locale.US).endsWith(".epub"))
                .sorted(Comparator.comparing(path -> path.getFileName().toString()))
                .findFirst()
                .orElseThrow(() -> new IOException("Session not found"));
        }
    }

    private EpubIssue issue(
        String code,
        String severity,
        boolean fixable,
        String details,
        List<String> options
    ) {
        return new EpubIssue(code, severity, fixable, "FIX.ISSUE_" + code, details, options);
    }

    private EpubIssue issue(
        String code,
        String severity,
        boolean fixable
    ) {
        return issue(code, severity, fixable, null, null);
    }

    private EpubIssue issue(
        String code,
        String severity,
        boolean fixable,
        String details
    ) {
        return issue(code, severity, fixable, details, null);
    }

    private boolean isBlockingIssue(String code) {
        return "CONTAINER_MISSING".equals(code)
            || "OPF_MISSING".equals(code)
            || "SPINE_EMPTY".equals(code)
            || "CRIT-XHTML-001".equals(code)
            || "CRIT-SEC-001".equals(code)
            || "HIGH-MAN-001".equals(code)
            || "HIGH-XHTML-001".equals(code)
            || "HIGH-XHTML-002".equals(code)
            || "HIGH-XHTML-003".equals(code)
            || "HIGH-ENC-001".equals(code)
            || "HIGH-ENC-002".equals(code)
            || "HIGH-FALLBACK-001".equals(code);
    }

    private EpubAnalysis finishAnalysis(
        java.util.ArrayList<EpubIssue> issues,
        EpubAnalysis analysis,
        EpubIssue extraIssue
    ) {
        if (extraIssue != null) {
            issues.add(extraIssue);
        }
        return finishAnalysis(issues, analysis);
    }

    private String resolveStatus(java.util.ArrayList<EpubIssue> issues) {
        boolean hasFixableIssue = false;
        for (EpubIssue issue : issues) {
            if (issue != null && issue.fixable) {
                hasFixableIssue = true;
                break;
            }
        }

        if (issues.isEmpty()) {
            return "valid";
        }

        return hasFixableIssue ? "repairable" : "unsupported";
    }

    private void prepareInternal(PluginCall call) throws Exception {
        String rawUri = requireString(call, "uri");
        Uri sourceUri = resolveSourceUri(rawUri);
        String displayName = call.getString("displayName");
        Long maxBytesOpt = call.getLong("maxBytes");
        long maxBytes = maxBytesOpt == null ? 0L : Math.max(0L, maxBytesOpt);

        PreparedSession prepared = prepareSession(
            sourceUri,
            readSourceMeta(sourceUri, displayName),
            maxBytes,
            false,
            false,
            "prepare"
        );
        call.resolve(toPrepareResult(prepared));
    }

    private JSObject pickAndPrepareEpubInternal(PluginCall call, Uri sourceUri) throws Exception {
        Long maxBytesOpt = call.getLong("maxBytes");
        long maxBytes = maxBytesOpt == null ? 0L : Math.max(0L, maxBytesOpt);
        boolean requireCover = readBoolean(call, "requireCover", true);
        boolean includeCoverPreview = readBoolean(call, "includeCoverPreview", requireCover);

        SourceMeta sourceMeta = readSourceMeta(sourceUri, null);
        PreparedSession prepared = prepareSession(
            sourceUri,
            sourceMeta,
            maxBytes,
            requireCover,
            includeCoverPreview,
            "pick_prepare"
        );

        JSObject result = toPrepareResult(prepared);
        result.put("selectedName", sourceMeta.displayName);
        result.put("sourceSize", sourceMeta.size > 0 ? sourceMeta.size : prepared.originalSize);
        result.put("sourceLastModified", sourceMeta.lastModified);
        result.put("sourceMimeType", sourceMeta.mimeType);
        if (prepared.coverEntryPath != null) {
            result.put("coverEntryPath", prepared.coverEntryPath);
        }
        if (prepared.extractedCoverPath != null) {
            result.put("extractedCoverPath", prepared.extractedCoverPath.toString());
        }
        return result;
    }

    private void cleanupInternal(PluginCall call) throws Exception {
        String sessionId = requireString(call, "sessionId").trim();
        validateSessionId(sessionId);
        deleteRecursively(resolveSessionDir(sessionId));
        call.resolve(new JSObject());
    }

    private PreparedSession prepareSession(
        Uri sourceUri,
        SourceMeta sourceMeta,
        long maxBytes,
        boolean requireCover,
        boolean includeCoverPreview,
        String stage
    ) throws Exception {
        ensureNotCancelled();
        String originalName = sourceMeta.displayName;
        String outputBaseName = sanitizeBaseName(stripExtension(originalName)) + "_" + formatWorkTimestamp();
        if (maxBytes > 0 && sourceMeta.size > maxBytes) {
            throw new PluginErrorException(
                "EPUB_TOO_LARGE",
                "Selected EPUB exceeds allowed max bytes",
                stage
            );
        }

        String sessionId = UUID.randomUUID().toString();
        Path sessionDir = resolveSessionDir(sessionId);
        Files.createDirectories(sessionDir);
        Path workingPath = resolveUniqueWorkPath(sessionDir, outputBaseName);
        long startedAt = System.currentTimeMillis();
        long sourceSize = Math.max(0L, sourceMeta.size);
        long requiredBytes = safeAdd(sourceSize, STORAGE_MARGIN_BYTES);
        ensureSufficientSpace(workingPath, requiredBytes, stage);

        debugIo(
            stage + " start originalName=" + originalName
                + " maxBytes=" + maxBytes
                + " requiredBytes=" + requiredBytes
                + " workingPath=" + workingPath
                + " sessionId=" + sessionId
        );

        long copiedBytes;
        try {
            copiedBytes = copyUriToPath(sourceUri, workingPath, maxBytes);
            ensureNotCancelled();
        } catch (Exception ex) {
            deleteRecursively(sessionDir);
            throw ex;
        }

        Path recoveredPath = recoverReadableZip(workingPath);
        if (recoveredPath != null) {
            moveFileAtomicWithFallback(recoveredPath, workingPath);
        }

        boolean zipReadable = isReadableZip(workingPath);

        if ((requireCover || includeCoverPreview) && !zipReadable) {
            deleteRecursively(sessionDir);
            throw new PluginErrorException("INVALID_EPUB", null, stage);
        }

        String coverEntryPath = null;
        Path extractedCoverPath = null;
        if (requireCover || includeCoverPreview) {
            try (ZipFile zipFile = new ZipFile(workingPath.toFile())) {
                List<FileHeader> headers = zipFile.getFileHeaders();
                if (headers == null || headers.isEmpty()) {
                    throw new PluginErrorException("INVALID_EPUB", null, stage);
                }

                coverEntryPath = findCoverEntryPath(zipFile, headers);
                if (coverEntryPath == null && requireCover) {
                    throw new PluginErrorException("NO_COVER", "cover entry not found", stage);
                }

                if (coverEntryPath != null && includeCoverPreview) {
                    FileHeader coverHeader = findHeader(headers, coverEntryPath);
                    if (coverHeader == null) {
                        if (requireCover) {
                            throw new PluginErrorException("NO_COVER", "cover header missing", stage);
                        }
                    } else {
                        extractedCoverPath = buildExtractedCoverPath(coverEntryPath);
                        extractEntry(zipFile, coverHeader, extractedCoverPath);
                    }
                }
            } catch (Exception ex) {
                deleteRecursively(sessionDir);
                throw ex;
            }
        }

        debugIo(
            stage + " success elapsedMs=" + (System.currentTimeMillis() - startedAt)
                + " sourceBytes=" + (sourceMeta.size > 0 ? sourceMeta.size : copiedBytes)
                + " workingPath=" + workingPath
                + " sessionId=" + sessionId
                + " zipReadable=" + zipReadable
        );

        return new PreparedSession(
            sessionId,
            originalName,
            sourceMeta.size > 0 ? sourceMeta.size : copiedBytes,
            zipReadable,
            sessionRelativePath(sessionId, workingPath.getFileName().toString()),
            workingPath.getFileName().toString(),
            workingPath.toString(),
            stripExtension(workingPath.getFileName().toString()),
            coverEntryPath,
            extractedCoverPath
        );
    }

    private JSObject toPrepareResult(PreparedSession prepared) {
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("sessionId", prepared.sessionId);
        result.put("originalName", prepared.originalName);
        result.put("originalSize", prepared.originalSize);
        result.put("isZipReadable", prepared.isZipReadable);
        result.put("workingPath", prepared.workingPath);
        result.put("workingName", prepared.workingName);
        result.put("workingNativePath", prepared.workingNativePath);
        result.put("outputBaseName", prepared.outputBaseName);
        return result;
    }

    private SourceMeta readSourceMeta(Uri sourceUri, String displayNameOverride) {
        ContentResolver resolver = getContext().getContentResolver();
        String displayName = displayNameOverride == null || displayNameOverride.trim().isEmpty()
            ? "selected.epub"
            : displayNameOverride.trim();
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
            debugIo("source metadata lookup failed: " + ex.getMessage());
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }

        Path filePath = tryResolveFilePath(sourceUri);
        if (filePath != null) {
            try {
                if ("selected.epub".equals(displayName) || CompatStrings.isBlank(displayName)) {
                    Path fileName = filePath.getFileName();
                    if (fileName != null) {
                        displayName = fileName.toString();
                    }
                }
                if (size < 0L && Files.exists(filePath)) {
                    size = Files.size(filePath);
                }
            } catch (Exception ex) {
                debugIo("source file metadata fallback failed: " + ex.getMessage());
            }
        }

        if (CompatStrings.isBlank(mimeType)) {
            mimeType = "application/epub+zip";
        }

        return new SourceMeta(displayName, size, lastModified, mimeType);
    }

    private long copyUriToPath(Uri sourceUri, Path targetPath, long maxBytes) throws Exception {
        Files.createDirectories(targetPath.getParent());
        byte[] buffer = new byte[BUFFER_SIZE];
        long totalBytes = 0L;

        try (
            InputStream source = openInputStream(sourceUri);
            OutputStream output = new BufferedOutputStream(Files.newOutputStream(targetPath))
        ) {
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

    private Uri resolveSourceUri(String rawUri) {
        Uri parsed = Uri.parse(rawUri);
        if (CompatStrings.isBlank(parsed.getScheme())) {
            return Uri.fromFile(new java.io.File(rawUri));
        }
        return parsed;
    }

    private InputStream openInputStream(Uri sourceUri) throws Exception {
        Path filePath = tryResolveFilePath(sourceUri);
        if (filePath != null) {
            return new BufferedInputStream(Files.newInputStream(filePath));
        }

        InputStream source = getContext().getContentResolver().openInputStream(sourceUri);
        if (source == null) {
            throw new PluginErrorException("PICK_FAILED", "Unable to open selected file");
        }
        return source;
    }

    private Path tryResolveFilePath(Uri sourceUri) {
        if (sourceUri == null) {
            return null;
        }
        String scheme = sourceUri.getScheme();
        if (CompatStrings.isBlank(scheme)) {
            try {
                return Paths.get(sourceUri.toString());
            } catch (InvalidPathException ignored) {
                return null;
            }
        }
        if (!"file".equalsIgnoreCase(scheme) || sourceUri.getPath() == null) {
            return null;
        }
        try {
            return Paths.get(sourceUri.getPath());
        } catch (InvalidPathException ignored) {
            return null;
        }
    }

    private boolean readBoolean(PluginCall call, String key, boolean fallback) {
        Boolean value = call.getBoolean(key);
        return value == null ? fallback : value;
    }

    private Path resolveSessionDir(String sessionId) {
        return getContext()
            .getFilesDir()
            .toPath()
            .resolve(WORK_FOLDER)
            .resolve(FIXER_SESSION_FOLDER)
            .resolve(sessionId);
    }

    private String sessionRelativePath(String sessionId, String filename) {
        return WORK_FOLDER + "/" + FIXER_SESSION_FOLDER + "/" + sessionId + "/" + filename;
    }

    private void validateSessionId(String sessionId) throws IOException {
        if (sessionId == null || !sessionId.matches("[A-Za-z0-9-]{8,80}")) {
            throw new IOException("Invalid sessionId");
        }
    }

    private void deleteRecursively(Path path) throws IOException {
        if (path == null || !Files.exists(path)) {
            return;
        }

        try (Stream<Path> stream = Files.walk(path)) {
            stream
                .sorted(Comparator.reverseOrder())
                .forEach(candidate -> {
                    try {
                        Files.deleteIfExists(candidate);
                    } catch (IOException ex) {
                        throw new RuntimeException(ex);
                    }
                });
        } catch (RuntimeException ex) {
            if (ex.getCause() instanceof IOException) {
                throw (IOException) ex.getCause();
            }
            throw ex;
        }
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

    private boolean isReadableZip(Path path) {
        try (ZipFile zipFile = new ZipFile(path.toFile())) {
            List<FileHeader> headers = zipFile.getFileHeaders();
            return headers != null && !headers.isEmpty();
        } catch (Exception ex) {
            return false;
        }
    }

    private Path recoverReadableZip(Path sourcePath) throws IOException {
        Path recoveredPath = sourcePath.resolveSibling(
            sourcePath.getFileName().toString() + ".recovered.epub"
        );
        deleteIfExists(recoveredPath);

        int recoveredEntries = 0;
        try (
            InputStream inputStream = new BufferedInputStream(Files.newInputStream(sourcePath));
            ZipInputStream zipInputStream = new ZipInputStream(inputStream);
            OutputStream outputStream = new BufferedOutputStream(Files.newOutputStream(recoveredPath));
            ZipOutputStream zipOutputStream = new ZipOutputStream(outputStream)
        ) {
            while (true) {
                ZipEntry entry;
                try {
                    entry = zipInputStream.getNextEntry();
                } catch (Exception ex) {
                    break;
                }

                if (entry == null) {
                    break;
                }

                try {
                    if (entry.isDirectory()) {
                        continue;
                    }

                    String entryName = normalizeZipPath(entry.getName());
                    if (CompatStrings.isBlank(entryName)) {
                        continue;
                    }

                    if ("mimetype".equals(entryName)) {
                        byte[] mimetypeBytes = readStreamBytes(zipInputStream);
                        ZipEntry recoveredEntry = new ZipEntry(entryName);
                        recoveredEntry.setMethod(ZipEntry.STORED);
                        recoveredEntry.setTime(entry.getTime());
                        recoveredEntry.setSize(mimetypeBytes.length);
                        recoveredEntry.setCompressedSize(mimetypeBytes.length);
                        CRC32 crc32 = new CRC32();
                        crc32.update(mimetypeBytes);
                        recoveredEntry.setCrc(crc32.getValue());
                        zipOutputStream.putNextEntry(recoveredEntry);
                        zipOutputStream.write(mimetypeBytes);
                        zipOutputStream.closeEntry();
                    } else {
                        ZipEntry recoveredEntry = new ZipEntry(entryName);
                        recoveredEntry.setTime(entry.getTime());
                        zipOutputStream.putNextEntry(recoveredEntry);
                        copyStream(zipInputStream, zipOutputStream);
                        zipOutputStream.closeEntry();
                    }
                    recoveredEntries += 1;
                } catch (Exception ex) {
                    break;
                } finally {
                    try {
                        zipInputStream.closeEntry();
                    } catch (Exception ignored) {
                        // Best effort.
                    }
                }
            }
        } catch (Exception ex) {
            deleteIfExists(recoveredPath);
            return null;
        }

        if (recoveredEntries == 0) {
            deleteIfExists(recoveredPath);
            return null;
        }

        return recoveredPath;
    }

    private byte[] readStreamBytes(InputStream inputStream) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        copyStream(inputStream, outputStream);
        return outputStream.toByteArray();
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

    private void rewriteCoverInPlace(
        Path inputPath,
        Path newCoverPath,
        String coverEntryPath,
        String replacementCoverEntryPath,
        String primaryOpfPath,
        long startedAt
    )
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
            rewriteArchiveReplacingCover(
                backupPath,
                tempOutputPath,
                coverEntryPath,
                replacementCoverEntryPath,
                primaryOpfPath,
                newCoverPath,
                5,
                90
            );
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
        String replacementCoverEntryPath,
        String primaryOpfPath,
        long startedAt
    ) throws Exception {
        Path tempOutputPath = outputPath.resolveSibling(outputPath.getFileName() + ".tmp");
        deleteIfExists(tempOutputPath);

        try {
            long rewriteStart = System.currentTimeMillis();
            rewriteArchiveReplacingCover(
                inputPath,
                tempOutputPath,
                coverEntryPath,
                replacementCoverEntryPath,
                primaryOpfPath,
                newCoverPath,
                5,
                95
            );
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
        String replacementCoverEntryPath,
        String primaryOpfPath,
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

                if (coverEntryPath != null && entryPath.equals(coverEntryPath)) {
                    parameters = buildParametersFromHeader(
                        header,
                        replacementCoverEntryPath,
                        newCoverPath
                    );
                    outputZip.addFile(newCoverPath.toFile(), parameters);
                    coverReplaced = true;
                } else {
                    byte[] rewrittenText = rewriteCoverReferenceEntry(
                        sourceZip,
                        header,
                        entryPath,
                        coverEntryPath,
                        replacementCoverEntryPath,
                        primaryOpfPath
                    );
                    if (rewrittenText != null) {
                        parameters = buildParametersFromBytes(header, entryPath, rewrittenText);
                        try (InputStream entryInput = new ByteArrayInputStream(rewrittenText)) {
                            outputZip.addStream(entryInput, parameters);
                        }
                    } else {
                        try (InputStream entryInput = new BufferedInputStream(sourceZip.getInputStream(header))) {
                            outputZip.addStream(entryInput, parameters);
                        }
                    }
                }

                processedBytes += Math.max(1L, header.getUncompressedSize());
                emitProgress(interpolate(progressStart, progressEnd, processedBytes, totalBytes));
            }

            if (!coverReplaced) {
                if (coverEntryPath != null) {
                    throw new IOException("Cover entry not found in source archive");
                }

                ZipParameters addCoverParams = new ZipParameters();
                addCoverParams.setFileNameInZip(replacementCoverEntryPath);
                outputZip.addFile(newCoverPath.toFile(), addCoverParams);
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

    private ZipParameters buildParametersFromBytes(
        FileHeader header,
        String fileNameInZip,
        byte[] contentBytes
    ) {
        ZipParameters parameters = new ZipParameters();
        parameters.setFileNameInZip(fileNameInZip);
        parameters.setCompressionMethod(header.getCompressionMethod());
        parameters.setLastModifiedFileTime(header.getLastModifiedTime());
        parameters.setFileComment(header.getFileComment());

        if (header.getCompressionMethod() == CompressionMethod.STORE) {
            parameters.setEntrySize(Math.max(0, contentBytes.length));
            parameters.setEntryCRC(computeCrc(contentBytes));
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

    private long computeCrc(byte[] contentBytes) {
        CRC32 crc = new CRC32();
        crc.update(contentBytes, 0, contentBytes.length);
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
        return buildContainerXml("OEBPS/content.opf");
    }

      private String buildContainerXml(String opfPath) {
          String safeOpfPath = normalizeZipPath(opfPath);
          return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
              + "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\">\n"
              + "  <rootfiles>\n"
              + "    <rootfile full-path=\"" + escapeXml(safeOpfPath) + "\" media-type=\"application/oebps-package+xml\"/>\n"
              + "  </rootfiles>\n"
              + "</container>";
      }

      private String extractDeclaredOpfPathFromContainerText(String containerText) {
          if (CompatStrings.isBlank(containerText)) {
              return null;
          }

          Matcher matcher = ROOTFILE_FULL_PATH_PATTERN.matcher(containerText);
          if (!matcher.find()) {
              return null;
          }

          String opfPath = normalizeZipPath(matcher.group(2));
          return CompatStrings.isBlank(opfPath) ? null : opfPath;
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

    private byte[] rewriteCoverReferenceEntry(
        ZipFile sourceZip,
        FileHeader header,
        String entryPath,
        String originalCoverEntryPath,
        String replacementCoverEntryPath,
        String primaryOpfPath
    ) throws IOException {
        if (entryPath.equals(replacementCoverEntryPath) || !isTextEntryPath(entryPath)) {
            return null;
        }

        byte[] originalBytes = readEntryBytes(sourceZip, header);
        String originalText = decodeXmlBytes(originalBytes);
        String nextText = originalText;

        if (entryPath.toLowerCase(Locale.US).endsWith(".opf")) {
            if (CompatStrings.isNotBlank(originalCoverEntryPath)) {
                nextText = rewriteOpfCoverEntry(
                    nextText,
                    entryPath,
                    originalCoverEntryPath,
                    replacementCoverEntryPath
                );
            } else if (entryPath.equals(primaryOpfPath)) {
                nextText = rewriteOpfForInsertedCover(nextText, entryPath, replacementCoverEntryPath);
            }
        }

        if (CompatStrings.isNotBlank(originalCoverEntryPath)) {
            nextText = rewriteRelativeCoverRefs(
                nextText,
                entryPath,
                originalCoverEntryPath,
                replacementCoverEntryPath
            );
        }
        if (nextText.equals(originalText)) {
            return null;
        }

        return nextText.getBytes(StandardCharsets.UTF_8);
    }

    private byte[] readEntryBytes(ZipFile zipFile, FileHeader header) throws IOException {
        try (
            InputStream inputStream = new BufferedInputStream(zipFile.getInputStream(header));
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream()
        ) {
            copyStream(inputStream, outputStream);
            return outputStream.toByteArray();
        }
    }

    private String rewriteOpfCoverEntry(
        String xml,
        String entryPath,
        String originalCoverEntryPath,
        String replacementCoverEntryPath
    ) throws IOException {
        try {
            Document document = parseXmlUtf8(xml);
            String entryDir = parentZipPath(entryPath);
            String replacementHref = relativizeZipPath(entryDir, replacementCoverEntryPath);
            String replacementMime = mimeFromPath(replacementCoverEntryPath);
            boolean changed = false;

            NodeList items = document.getElementsByTagNameNS("*", "item");
            for (int i = 0; i < items.getLength(); i++) {
                if (!(items.item(i) instanceof Element)) {
                    continue;
                }
                Element item = (Element) items.item(i);
                String href = item.getAttribute("href");
                if (CompatStrings.isBlank(href)) {
                    continue;
                }
                String resolvedHref = resolveRelativeZipPath(entryDir, href);
                if (!originalCoverEntryPath.equals(resolvedHref)) {
                    continue;
                }
                item.setAttribute("href", replacementHref);
                item.setAttribute("media-type", replacementMime);
                changed = true;
            }

            return changed ? serializeXml(document) : xml;
        } catch (ParserConfigurationException | SAXException | TransformerException ex) {
            throw new IOException("Unable to rewrite OPF cover references", ex);
        }
    }

    private String rewriteOpfForInsertedCover(
        String xml,
        String entryPath,
        String replacementCoverEntryPath
    ) throws IOException {
        try {
            Document document = parseXmlUtf8(xml);
            String entryDir = parentZipPath(entryPath);
            String replacementHref = relativizeZipPath(entryDir, replacementCoverEntryPath);
            String replacementMime = mimeFromPath(replacementCoverEntryPath);

            Element packageElement = document.getDocumentElement();
            String opfNs = packageElement == null ? null : packageElement.getNamespaceURI();

            Element manifest = firstElementByName(document, "manifest");
            if (manifest == null && packageElement != null) {
                manifest = opfNs == null
                    ? document.createElement("manifest")
                    : document.createElementNS(opfNs, "manifest");
                packageElement.appendChild(manifest);
            }

            Element metadata = firstElementByName(document, "metadata");
            if (metadata == null && packageElement != null) {
                metadata = opfNs == null
                    ? document.createElement("metadata")
                    : document.createElementNS(opfNs, "metadata");
                packageElement.insertBefore(metadata, packageElement.getFirstChild());
            }

            if (manifest == null || metadata == null) {
                return xml;
            }

            String coverId = ensureManifestCoverItem(
                document,
                manifest,
                replacementHref,
                replacementMime,
                opfNs
            );
            ensureCoverMetaTag(document, metadata, coverId, opfNs);

            return serializeXml(document);
        } catch (ParserConfigurationException | SAXException | TransformerException ex) {
            throw new IOException("Unable to add OPF cover metadata", ex);
        }
    }

    private String ensureManifestCoverItem(
        Document document,
        Element manifest,
        String replacementHref,
        String replacementMime,
        String opfNs
    ) {
        NodeList items = manifest.getElementsByTagNameNS("*", "item");
        Element coverCandidate = null;
        for (int i = 0; i < items.getLength(); i++) {
            if (!(items.item(i) instanceof Element)) {
                continue;
            }
            Element item = (Element) items.item(i);
            String href = item.getAttribute("href");
            String properties = item.getAttribute("properties");
            if (replacementHref.equals(href) || containsCoverImageProperty(properties)) {
                coverCandidate = item;
                break;
            }
        }

        if (coverCandidate == null) {
            coverCandidate = opfNs == null
                ? document.createElement("item")
                : document.createElementNS(opfNs, "item");
            manifest.appendChild(coverCandidate);
        }

        String coverId = coverCandidate.getAttribute("id");
        if (CompatStrings.isBlank(coverId)) {
            coverId = buildUniqueCoverId(manifest, "cover-image-generated");
            coverCandidate.setAttribute("id", coverId);
        }

        coverCandidate.setAttribute("href", replacementHref);
        coverCandidate.setAttribute("media-type", replacementMime);
        coverCandidate.setAttribute("properties", "cover-image");
        return coverId;
    }

    private boolean containsCoverImageProperty(String properties) {
        if (CompatStrings.isBlank(properties)) {
            return false;
        }
        for (String part : properties.toLowerCase(Locale.US).split("\\s+")) {
            if ("cover-image".equals(part.trim())) {
                return true;
            }
        }
        return false;
    }

    private String buildUniqueCoverId(Element manifest, String baseId) {
        java.util.HashSet<String> ids = new java.util.HashSet<>();
        NodeList items = manifest.getElementsByTagNameNS("*", "item");
        for (int i = 0; i < items.getLength(); i++) {
            if (!(items.item(i) instanceof Element)) {
                continue;
            }
            String existingId = ((Element) items.item(i)).getAttribute("id");
            if (CompatStrings.isNotBlank(existingId)) {
                ids.add(existingId);
            }
        }

        if (!ids.contains(baseId)) {
            return baseId;
        }

        int suffix = 2;
        while (ids.contains(baseId + "-" + suffix)) {
            suffix += 1;
        }
        return baseId + "-" + suffix;
    }

    private void ensureCoverMetaTag(Document document, Element metadata, String coverId, String opfNs) {
        NodeList metas = metadata.getElementsByTagNameNS("*", "meta");
        for (int i = 0; i < metas.getLength(); i++) {
            if (!(metas.item(i) instanceof Element)) {
                continue;
            }
            Element meta = (Element) metas.item(i);
            if ("cover".equalsIgnoreCase(meta.getAttribute("name"))) {
                meta.setAttribute("content", coverId);
                return;
            }
        }

        Element meta = opfNs == null
            ? document.createElement("meta")
            : document.createElementNS(opfNs, "meta");
        meta.setAttribute("name", "cover");
        meta.setAttribute("content", coverId);
        metadata.appendChild(meta);
    }

    private String rewriteRelativeCoverRefs(
        String content,
        String entryPath,
        String originalCoverEntryPath,
        String replacementCoverEntryPath
    ) {
        String entryDir = parentZipPath(entryPath);
        String oldRef = relativizeZipPath(entryDir, originalCoverEntryPath);
        String newRef = relativizeZipPath(entryDir, replacementCoverEntryPath);
        if (oldRef.equals(newRef) || !content.contains(oldRef)) {
            return content;
        }
        return content.replace(oldRef, newRef);
    }

    private Document parseXmlUtf8(String xml)
        throws ParserConfigurationException, IOException, SAXException {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        configureSecureXmlFactory(factory);
        try (InputStream inputStream = new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8))) {
            Document document = factory.newDocumentBuilder().parse(inputStream);
            document.getDocumentElement().normalize();
            return document;
        }
    }

    private void configureSecureXmlFactory(DocumentBuilderFactory factory)
        throws ParserConfigurationException {
        safeSetFeature(factory, XMLConstants.FEATURE_SECURE_PROCESSING, true);
        safeSetFeature(factory, "http://apache.org/xml/features/disallow-doctype-decl", true);
        safeSetFeature(factory, "http://xml.org/sax/features/external-general-entities", false);
        safeSetFeature(factory, "http://xml.org/sax/features/external-parameter-entities", false);
        safeSetAttribute(factory, "http://javax.xml.XMLConstants/property/accessExternalDTD", "");
        safeSetAttribute(factory, "http://javax.xml.XMLConstants/property/accessExternalSchema", "");
        safeSetExpandEntityReferences(factory, false);
        safeSetXIncludeAware(factory, false);
    }

    private void safeSetFeature(DocumentBuilderFactory factory, String name, boolean value)
        throws ParserConfigurationException {
        try {
            factory.setFeature(name, value);
        } catch (Exception ignored) {
            // Best effort: Android XML implementations differ by API level.
        }
    }

    private void safeSetAttribute(DocumentBuilderFactory factory, String name, String value) {
        try {
            factory.setAttribute(name, value);
        } catch (Exception ignored) {
            // Best effort: Android XML implementations differ by API level.
        }
    }

    private void safeSetExpandEntityReferences(DocumentBuilderFactory factory, boolean value) {
        try {
            factory.setExpandEntityReferences(value);
        } catch (Exception ignored) {
            // Best effort.
        }
    }

    private void safeSetXIncludeAware(DocumentBuilderFactory factory, boolean value) {
        try {
            factory.setXIncludeAware(value);
        } catch (Exception ignored) {
            // Best effort.
        }
    }

    private String serializeXml(Document document) throws TransformerException {
        TransformerFactory factory = TransformerFactory.newInstance();
        Transformer transformer = factory.newTransformer();
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        transformer.transform(new DOMSource(document), new StreamResult(output));
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }

    private String findCoverEntryPath(ZipFile zipFile, List<FileHeader> headers) throws IOException {
        return coverLocator.findCoverEntryPath(zipFile, headers);
    }

    private Path buildExtractedCoverPath(String coverEntryPath) throws IOException {
        Path cacheDir = getContext().getCacheDir().toPath().resolve("epub-rewrite");
        Files.createDirectories(cacheDir);

        String ext = extensionFromPath(coverEntryPath);
        if (ext.isEmpty()) {
            ext = "jpg";
        }

        String baseName = stripExtension(Paths.get(coverEntryPath).getFileName().toString());
        if (CompatStrings.isBlank(baseName)) {
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

    private Element firstElementByName(Document document, String localName) {
        NodeList wildcardMatches = document.getElementsByTagNameNS("*", localName);
        for (int i = 0; i < wildcardMatches.getLength(); i++) {
            if (wildcardMatches.item(i) instanceof Element) {
                return (Element) wildcardMatches.item(i);
            }
        }
        NodeList directMatches = document.getElementsByTagName(localName);
        for (int i = 0; i < directMatches.getLength(); i++) {
            if (directMatches.item(i) instanceof Element) {
                return (Element) directMatches.item(i);
            }
        }
        return null;
    }

    private String findPrimaryOpfPath(
        ZipFile zipFile,
        List<FileHeader> headers,
        String preferredPath
    ) {
        FileHeader containerHeader = findHeader(headers, "META-INF/container.xml");
        String containerPreferredPath = preferredPath;
              if (containerHeader != null && containerPreferredPath == null) {
                try {
                  byte[] containerBytes = readEntryBytes(zipFile, containerHeader);
                  String containerText = decodeXmlBytes(containerBytes);
                  try {
                      Document containerDoc = parseXmlUtf8(containerText);
                      Element rootfile = firstElementByName(containerDoc, "rootfile");
                      if (rootfile != null) {
                          String opfPath = normalizeZipPath(rootfile.getAttribute("full-path"));
                          if (CompatStrings.isNotBlank(opfPath)) {
                              containerPreferredPath = opfPath;
                          }
                      }
                  } catch (Exception ignored) {
                      // Fall back to raw-text extraction below.
                  }
                  if (CompatStrings.isBlank(containerPreferredPath)) {
                      containerPreferredPath = extractDeclaredOpfPathFromContainerText(containerText);
                  }
                } catch (Exception ignored) {
                      // Fall back to heuristic OPF discovery below.
                  }
              }

        List<String> candidates = collectValidOpfCandidates(zipFile, headers, containerPreferredPath);
        for (String candidate : candidates) {
            return candidate;
        }

        return null;
    }

    private List<String> collectValidOpfCandidates(
        ZipFile zipFile,
        List<FileHeader> headers,
        String preferredPath
    ) {
        List<String> candidates = collectOpfCandidates(headers, preferredPath);
        java.util.ArrayList<ScoredOpfCandidate> validCandidates = new java.util.ArrayList<>();
        for (String candidate : candidates) {
            try {
                FileHeader opfHeader = findHeader(headers, candidate);
                if (opfHeader == null) {
                    continue;
                }

                byte[] opfBytes = readEntryBytes(zipFile, opfHeader);
                Document opfDoc = parseXmlUtf8(decodeXmlBytes(opfBytes));
                if (opfDoc != null) {
                    validCandidates.add(
                        new ScoredOpfCandidate(
                            candidate,
                            scoreValidOpfCandidate(candidate, opfDoc, preferredPath)
                        )
                    );
                }
            } catch (Exception ignored) {
                // Keep trying later candidates.
            }
        }

        validCandidates.sort((left, right) ->
            right.score != left.score
                ? Integer.compare(right.score, left.score)
                : left.path.compareTo(right.path)
        );

        java.util.ArrayList<String> orderedCandidates = new java.util.ArrayList<>();
        for (ScoredOpfCandidate candidate : validCandidates) {
            orderedCandidates.add(candidate.path);
        }
        return orderedCandidates;
    }

    private boolean hasClearOpfWinner(
        ZipFile zipFile,
        List<FileHeader> headers,
        List<String> validCandidates,
        String preferredPath
    ) {
        if (validCandidates.size() < 2) {
            return true;
        }

        java.util.ArrayList<ScoredOpfCandidate> scoredCandidates = new java.util.ArrayList<>();
        for (String candidate : validCandidates) {
            try {
                FileHeader opfHeader = findHeader(headers, candidate);
                if (opfHeader == null) {
                    continue;
                }

                byte[] opfBytes = readEntryBytes(zipFile, opfHeader);
                Document opfDoc = parseXmlUtf8(decodeXmlBytes(opfBytes));
                if (opfDoc == null) {
                    continue;
                }

                scoredCandidates.add(
                    new ScoredOpfCandidate(
                        candidate,
                        scoreValidOpfCandidate(candidate, opfDoc, preferredPath)
                    )
                );
            } catch (Exception ignored) {
                // Ignore candidates we cannot inspect in detail.
            }
        }

        if (scoredCandidates.size() < 2) {
            return true;
        }

        scoredCandidates.sort((left, right) ->
            right.score != left.score
                ? Integer.compare(right.score, left.score)
                : left.path.compareTo(right.path)
        );

        int bestScore = scoredCandidates.get(0).score;
        int secondBestScore = scoredCandidates.get(1).score;
        return bestScore - secondBestScore >= 3;
    }

    private int scoreValidOpfCandidate(
        String candidatePath,
        Document opfDoc,
        String preferredPath
    ) {
        int score = (10 - scoreOpfCandidate(candidatePath)) * 10;
        score += scoreOpfDocument(opfDoc);
        if (CompatStrings.isNotBlank(preferredPath) && preferredPath.equals(candidatePath)) {
            score += 25;
        }
        return score;
    }

    private int scoreOpfDocument(Document opfDoc) {
        int score = 0;
        Element manifestElement = firstElementByName(opfDoc, "manifest");
        Element spineElement = firstElementByName(opfDoc, "spine");
        Element metadataElement = firstElementByName(opfDoc, "metadata");

        if (manifestElement != null) {
            score += 2;
            if (manifestElement.getElementsByTagNameNS("*", "item").getLength() > 0) {
                score += 2;
            }
        }

        if (spineElement != null) {
            score += 2;
            if (spineElement.getElementsByTagNameNS("*", "itemref").getLength() > 0) {
                score += 2;
            }
        }

        if (metadataElement != null) {
            if (metadataElement.getElementsByTagNameNS("*", "title").getLength() > 0) {
                score += 1;
            }
            if (metadataElement.getElementsByTagNameNS("*", "language").getLength() > 0) {
                score += 1;
            }
            if (metadataElement.getElementsByTagNameNS("*", "identifier").getLength() > 0) {
                score += 1;
            }
        }

        if (opfDoc.getDocumentElement() != null) {
            score += 1;
        }

        return score;
    }

    private List<String> collectOpfCandidates(List<FileHeader> headers, String preferredPath) {
        java.util.LinkedHashMap<String, Integer> scores = new java.util.LinkedHashMap<>();
        addCandidate(scores, preferredPath, -1);

        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }

            String fileName = normalizeZipPath(header.getFileName());
            if (!fileName.toLowerCase(Locale.US).endsWith(".opf")) {
                continue;
            }

            addCandidate(scores, fileName, scoreOpfCandidate(fileName));
        }

        return scores.entrySet().stream()
            .sorted((left, right) ->
                left.getValue().compareTo(right.getValue())
                    != 0
                    ? left.getValue().compareTo(right.getValue())
                    : left.getKey().compareTo(right.getKey())
            )
            .map(java.util.Map.Entry::getKey)
            .collect(java.util.stream.Collectors.toList());
    }

    private void addCandidate(
        java.util.LinkedHashMap<String, Integer> scores,
        String candidate,
        int score
    ) {
        String normalized = normalizeZipPath(candidate);
        if (CompatStrings.isBlank(normalized) || scores.containsKey(normalized)) {
            return;
        }
        scores.put(normalized, score);
    }

    private int scoreOpfCandidate(String path) {
        String normalized = normalizeZipPath(path).toLowerCase(Locale.US);
        if ("oebps/content.opf".equals(normalized) || "ops/content.opf".equals(normalized)) {
            return 0;
        }
        if ("content.opf".equals(normalized)) {
            return 1;
        }
        if (normalized.endsWith("/content.opf")) {
            return 2;
        }
        if (normalized.endsWith(".opf")) {
            return 3;
        }
        return 4;
    }

    private String buildDefaultCoverEntryPath(Path newCoverPath) {
        String ext = normalizeCoverExt(extensionFromPath(newCoverPath.getFileName().toString()));
        return "OEBPS/images/cover." + ext;
    }

    private String buildUniqueCoverEntryPath(List<FileHeader> headers, Path newCoverPath) {
        String ext = normalizeCoverExt(extensionFromPath(newCoverPath.getFileName().toString()));
        int suffix = 1;
        while (true) {
            String candidate = "OEBPS/images/cover-added-" + suffix + "." + ext;
            if (findHeader(headers, candidate) == null) {
                return candidate;
            }
            suffix += 1;
        }
    }

    private String parentZipPath(String path) {
        String normalized = normalizeZipPath(path);
        int slashIndex = normalized.lastIndexOf('/');
        return slashIndex < 0 ? "" : normalized.substring(0, slashIndex);
    }

    private String resolveRelativeZipPath(String baseDir, String href) {
        String normalizedHref = normalizeZipPath(href);
        if (normalizedHref.matches("^[a-zA-Z]+://.*$")) {
            return normalizedHref;
        }

        String merged = CompatStrings.isBlank(baseDir)
            ? normalizedHref
            : baseDir + "/" + normalizedHref;

        String[] parts = merged.split("/");
        java.util.ArrayList<String> resolved = new java.util.ArrayList<>();
        for (String part : parts) {
            if (CompatStrings.isBlank(part) || ".".equals(part)) {
                continue;
            }
            if ("..".equals(part)) {
                if (!resolved.isEmpty()) {
                    resolved.remove(resolved.size() - 1);
                }
                continue;
            }
            resolved.add(part);
        }
        return String.join("/", resolved);
    }

    private String relativizeZipPath(String fromDir, String toPath) {
        String normalizedFrom = normalizeZipPath(fromDir);
        String normalizedTo = normalizeZipPath(toPath);
        if (CompatStrings.isBlank(normalizedFrom)) {
            return normalizedTo;
        }

        String[] fromParts = normalizedFrom.split("/");
        String[] toParts = normalizedTo.split("/");
        int common = 0;
        while (
            common < fromParts.length
                && common < toParts.length
                && fromParts[common].equals(toParts[common])
        ) {
            common += 1;
        }

        StringBuilder relative = new StringBuilder();
        for (int i = common; i < fromParts.length; i++) {
            if (CompatStrings.isBlank(fromParts[i])) {
                continue;
            }
            if (relative.length() > 0) {
                relative.append('/');
            }
            relative.append("..");
        }

        for (int i = common; i < toParts.length; i++) {
            if (CompatStrings.isBlank(toParts[i])) {
                continue;
            }
            if (relative.length() > 0) {
                relative.append('/');
            }
            relative.append(toParts[i]);
        }

        if (relative.length() > 0) {
            return relative.toString();
        }
        int slashIndex = normalizedTo.lastIndexOf('/');
        return slashIndex < 0 ? normalizedTo : normalizedTo.substring(slashIndex + 1);
    }

    private boolean isTextEntryPath(String path) {
        String lower = normalizeZipPath(path).toLowerCase(Locale.US);
        return lower.endsWith(".opf")
            || lower.endsWith(".xml")
            || lower.endsWith(".xhtml")
            || lower.endsWith(".html")
            || lower.endsWith(".htm")
            || lower.endsWith(".ncx")
            || lower.endsWith(".svg")
            || lower.endsWith(".css");
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
        try {
            JSObject payload = new JSObject();
            payload.put("percent", Math.max(0, Math.min(100, percent)));
            notifyListeners("rewriteProgress", payload);
        } catch (RuntimeException ex) {
            String message = ex.getMessage();
            if (message != null && message.contains("not mocked")) {
                return;
            }
            throw ex;
        }
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
            if (CompatStrings.isBlank(scheme)) {
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

    private Uri resolvePathToOpenUri(String inputPath) throws Exception {
        String value = inputPath == null ? "" : inputPath.trim();
        if (CompatStrings.isBlank(value)) {
            throw new IOException("Path is required");
        }

        Uri uri = Uri.parse(value);
        String scheme = uri.getScheme();
        if ("content".equalsIgnoreCase(scheme)) {
            return uri;
        }

        Path path = resolvePath(value);
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            throw new IOException("Missing file: " + value);
        }

        String authority = getContext().getPackageName() + ".fileprovider";
        return FileProvider.getUriForFile(getContext(), authority, path.toFile());
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
        return errorResult(error, message, stage, null, null, true);
    }

    private JSObject errorResult(
        String error,
        String message,
        String stage,
        Long requiredBytes,
        Long availableBytes
    ) {
        return errorResult(error, message, stage, requiredBytes, availableBytes, true);
    }

    private JSObject errorResult(
        String error,
        String message,
        String stage,
        Long requiredBytes,
        Long availableBytes,
        boolean shouldReport
    ) {
        if (shouldReport) {
            reportNonFatalFailure(error, message, stage, null);
        }

        JSObject result = new JSObject();
        result.put("success", false);
        result.put("error", error);
        if (CompatStrings.isNotBlank(message)) {
            result.put("message", message);
        }
        if (CompatStrings.isNotBlank(stage)) {
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

    private boolean shouldReportNonFatal(String error) {
        if (error == null) {
            return false;
        }
        switch (error) {
            case "BUSY":
            case "CANCELLED":
            case "PICK_CANCELLED":
                return false;
            default:
                return true;
        }
    }

    private void reportNonFatalFailure(
        String error,
        String message,
        String stage,
        Throwable throwable
    ) {
        if (!shouldReportNonFatal(error)) {
            return;
        }

        try {
            Class<?> crashlyticsClass = Class.forName(
                "com.google.firebase.crashlytics.FirebaseCrashlytics"
            );
            Object crashlytics = crashlyticsClass.getMethod("getInstance").invoke(null);

            String safeError = error == null ? "UNKNOWN" : error;
            String safeStage = stage == null ? "unknown_stage" : stage;
            String safeMessage = message == null ? "" : message;

            crashlyticsClass
                .getMethod("setCustomKey", String.class, String.class)
                .invoke(crashlytics, "epub_error_code", safeError);
            crashlyticsClass
                .getMethod("setCustomKey", String.class, String.class)
                .invoke(crashlytics, "epub_error_stage", safeStage);
            crashlyticsClass
                .getMethod("log", String.class)
                .invoke(
                    crashlytics,
                    "epub-rewrite failure code="
                        + safeError
                        + " stage="
                        + safeStage
                        + " message="
                        + safeMessage
                );

            Throwable reportThrowable = throwable;
            if (reportThrowable == null) {
                reportThrowable = new RuntimeException(
                    "epub-rewrite non-fatal code=" + safeError + " stage=" + safeStage + " message=" + safeMessage
                );
            }

            crashlyticsClass
                .getMethod("recordException", Throwable.class)
                .invoke(crashlytics, reportThrowable);
        } catch (Exception ignored) {
            // Best effort: keep plugin behavior unchanged if Crashlytics is unavailable.
        }
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
        if (CompatStrings.isBlank(absolutePath)) return;

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

    private static final class EpubIssue {
        final String code;
        final String severity;
        final boolean fixable;
        final String messageKey;
        final String details;
        final List<String> options;

        EpubIssue(
            String code,
            String severity,
            boolean fixable,
            String messageKey,
            String details,
            List<String> options
        ) {
            this.code = code;
            this.severity = severity;
            this.fixable = fixable;
            this.messageKey = messageKey;
            this.details = details;
            this.options = options;
        }
    }

    private static final class ParsedManifestItem {
        final String id;
        final String href;
        final String normalizedHref;
        final String resolvedPath;
        final boolean exists;
        final String mediaType;
        final String properties;
        final String fallback;
        final String mediaOverlay;
        final String mediaOverlayResolvedPath;
        final boolean mediaOverlayExists;
        final Element element;

        ParsedManifestItem(
            String id,
            String href,
            String normalizedHref,
            String resolvedPath,
            boolean exists,
            String mediaType,
            String properties,
            String fallback,
            String mediaOverlay,
            String mediaOverlayResolvedPath,
            boolean mediaOverlayExists,
            Element element
        ) {
            this.id = id;
            this.href = href;
            this.normalizedHref = normalizedHref;
            this.resolvedPath = resolvedPath;
            this.exists = exists;
            this.mediaType = mediaType;
            this.properties = properties;
            this.fallback = fallback;
            this.mediaOverlay = mediaOverlay;
            this.mediaOverlayResolvedPath = mediaOverlayResolvedPath;
            this.mediaOverlayExists = mediaOverlayExists;
            this.element = element;
        }
    }

    private static final class FallbackRepairPlan {
        final ParsedManifestItem sourceItem;
        final String fallbackId;
        final String fallbackHref;
        final String fallbackResolvedPath;

        FallbackRepairPlan(
            ParsedManifestItem sourceItem,
            String fallbackId,
            String fallbackHref,
            String fallbackResolvedPath
        ) {
            this.sourceItem = sourceItem;
            this.fallbackId = fallbackId;
            this.fallbackHref = fallbackHref;
            this.fallbackResolvedPath = fallbackResolvedPath;
        }
    }

    private static final class ParsedSpineItem {
        final String idref;
        final boolean valid;
        final Element element;

        ParsedSpineItem(String idref, boolean valid, Element element) {
            this.idref = idref;
            this.valid = valid;
            this.element = element;
        }
    }

    private static final class ScoredOpfCandidate {
        final String path;
        final int score;

        ScoredOpfCandidate(String path, int score) {
            this.path = path;
            this.score = score;
        }
    }

    private static final class EpubAnalysis {
        final String status;
        final java.util.ArrayList<EpubIssue> issues;
        final String opfPath;
        final String opfDir;
        final Document opfDocument;
        final java.util.ArrayList<ParsedManifestItem> manifestItems;
        final java.util.ArrayList<ParsedSpineItem> spineItems;
        final java.util.ArrayList<String> reconstructibleSpineItemIds;
        final java.util.ArrayList<String> promotableOrphanResources;
        final java.util.ArrayList<FallbackRepairPlan> fallbackPlans;
        final boolean mimetypeMissing;
        final boolean mimetypeInvalid;

        EpubAnalysis(
            String status,
            java.util.ArrayList<EpubIssue> issues,
            String opfPath,
            String opfDir,
            Document opfDocument,
            java.util.ArrayList<ParsedManifestItem> manifestItems,
            java.util.ArrayList<ParsedSpineItem> spineItems,
            java.util.ArrayList<String> reconstructibleSpineItemIds,
            java.util.ArrayList<String> promotableOrphanResources,
            java.util.ArrayList<FallbackRepairPlan> fallbackPlans,
            boolean mimetypeMissing,
            boolean mimetypeInvalid
        ) {
            this.status = status;
            this.issues = issues;
            this.opfPath = opfPath;
            this.opfDir = opfDir;
            this.opfDocument = opfDocument;
            this.manifestItems = manifestItems;
            this.spineItems = spineItems;
            this.reconstructibleSpineItemIds = reconstructibleSpineItemIds;
            this.promotableOrphanResources = promotableOrphanResources;
            this.fallbackPlans = fallbackPlans;
            this.mimetypeMissing = mimetypeMissing;
            this.mimetypeInvalid = mimetypeInvalid;
        }
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

    private static final class PreparedSession {
        final String sessionId;
        final String originalName;
        final long originalSize;
        final boolean isZipReadable;
        final String workingPath;
        final String workingName;
        final String workingNativePath;
        final String outputBaseName;
        final String coverEntryPath;
        final Path extractedCoverPath;

        PreparedSession(
            String sessionId,
            String originalName,
            long originalSize,
            boolean isZipReadable,
            String workingPath,
            String workingName,
            String workingNativePath,
            String outputBaseName,
            String coverEntryPath,
            Path extractedCoverPath
        ) {
            this.sessionId = sessionId;
            this.originalName = originalName;
            this.originalSize = originalSize;
            this.isZipReadable = isZipReadable;
            this.workingPath = workingPath;
            this.workingName = workingName;
            this.workingNativePath = workingNativePath;
            this.outputBaseName = outputBaseName;
            this.coverEntryPath = coverEntryPath;
            this.extractedCoverPath = extractedCoverPath;
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
