package com.sheldrapps.plugins.pdfrewrite;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDDocumentInformation;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream;
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle;
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException;
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory;
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject;
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDAction;
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDActionGoTo;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import com.tom_roush.pdfbox.rendering.ImageType;
import com.tom_roush.pdfbox.rendering.PDFRenderer;
import com.tom_roush.pdfbox.cos.COSArray;
import com.tom_roush.pdfbox.cos.COSBase;
import com.tom_roush.pdfbox.cos.COSDictionary;
import com.tom_roush.pdfbox.cos.COSInteger;
import com.tom_roush.pdfbox.cos.COSName;
import com.tom_roush.pdfbox.io.MemoryUsageSetting;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "PdfRewritePlugin")
public class PdfRewritePlugin extends Plugin {
    private static final String WORK_FOLDER = "pdfcovermakerWork";
    private static final float PREVIEW_MIN_SCALE = 0.35f;
    private static final float PREVIEW_MAX_SCALE = 2.0f;
    private static final long PDFBOX_MAIN_MEMORY_BUDGET_BYTES = 24L * 1024L * 1024L;
    private final AtomicBoolean cancelRequested = new AtomicBoolean(false);
    private final AtomicBoolean pdfBoxInitialized = new AtomicBoolean(false);

    @PluginMethod
    public void pickAndPreparePdf(PluginCall call) {
        cancelRequested.set(false);
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf"});
        startActivityForResult(call, intent, "handlePickPdfResult");
    }

    @ActivityCallback
    private void handlePickPdfResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK) {
            call.resolve(errorResult("PICK_CANCELLED", "pick"));
            return;
        }

        Intent data = result.getData();
        Uri sourceUri = data != null ? data.getData() : null;
        if (sourceUri == null) {
            call.resolve(errorResult("PICK_CANCELLED", "pick"));
            return;
        }

        new Thread(() -> {
            try {
                ensurePdfBoxInitialized();
                Long maxBytes = call.getLong("maxBytes");
                PreparedFile prepared = copyUriToWorkingFile(sourceUri, maxBytes);
                JSObject inspection = inspectFile(prepared.file);
                boolean valid = Boolean.TRUE.equals(inspection.getBool("valid"));
                if (!valid) {
                    call.resolve(inspection);
                    return;
                }

                JSObject out = new JSObject();
                out.put("success", true);
                out.put("selectedName", prepared.originalName);
                out.put("sourceSize", prepared.originalSize);
                out.put("sourceLastModified", prepared.lastModified);
                out.put("sourceMimeType", "application/pdf");
                out.put("workingPath", prepared.workingPath);
                out.put("workingName", prepared.file.getName());
                out.put("workingNativePath", prepared.file.getAbsolutePath());
                out.put("outputBaseName", prepared.file.getName().replaceFirst("(?i)\\\\.pdf$", ""));
                call.resolve(out);
            } catch (CancelledException cancelled) {
                call.resolve(errorResult("CANCELLED", "pick"));
            } catch (PluginError error) {
                call.resolve(error.toResult());
            } catch (OutOfMemoryError oom) {
                call.resolve(errorResult("PDF_TOO_LARGE", "pick"));
            } catch (Exception error) {
                call.resolve(errorResult("PDF_CORRUPT", "pick"));
            } catch (Throwable fatal) {
                call.resolve(errorResult("REWRITE_FAILED", "pick"));
            }
        }).start();
    }

    @PluginMethod
    public void inspectPdf(PluginCall call) {
        cancelRequested.set(false);
        String inputPath = call.getString("inputPath");
        if (inputPath == null || inputPath.trim().isEmpty()) {
            call.resolve(errorResult("PDF_CORRUPT", "inspect"));
            return;
        }

        new Thread(() -> {
            try {
                ensurePdfBoxInitialized();
                File inputFile = resolvePathToFile(inputPath);
                JSObject result = inspectFile(inputFile);
                call.resolve(result);
            } catch (OutOfMemoryError oom) {
                call.resolve(errorResult("PDF_TOO_LARGE", "inspect"));
            } catch (Exception error) {
                call.resolve(errorResult("PDF_CORRUPT", "inspect"));
            } catch (Throwable fatal) {
                call.resolve(errorResult("PDF_CORRUPT", "inspect"));
            }
        }).start();
    }

    @PluginMethod
    public void rewriteCover(PluginCall call) {
        cancelRequested.set(false);
        String inputPath = call.getString("inputPath");
        String outputPath = call.getString("outputPath");
        String newCoverPath = call.getString("newCoverPath");
        String mode = call.getString("mode", "replace");

        if (inputPath == null || newCoverPath == null) {
            call.resolve(errorResult("REWRITE_FAILED", "rewrite"));
            return;
        }

        new Thread(() -> {
            try {
                ensurePdfBoxInitialized();
                File inputFile = resolvePathToFile(inputPath);
                File coverFile = resolvePathToFile(newCoverPath);
                File outFile = outputPath == null || outputPath.trim().isEmpty()
                    ? inputFile
                    : resolvePathToFile(outputPath);
                ensureParentExists(outFile);

                if ("insert".equalsIgnoreCase(mode)) {
                    rewriteInsertedCoverSafely(inputFile, coverFile, outFile);
                } else {
                    rewriteWithReplacedCover(inputFile, coverFile, outFile);
                }

                JSObject out = new JSObject();
                out.put("success", true);
                out.put("outputPath", outFile.getAbsolutePath());
                call.resolve(out);
            } catch (CancelledException cancelled) {
                call.resolve(errorResult("CANCELLED", "rewrite"));
            } catch (PluginError error) {
                call.resolve(error.toResult());
            } catch (OutOfMemoryError oom) {
                call.resolve(errorResult("PDF_TOO_LARGE", "rewrite"));
            } catch (Exception error) {
                call.resolve(errorResult("REWRITE_FAILED", "rewrite"));
            } catch (Throwable fatal) {
                call.resolve(errorResult("REWRITE_FAILED", "rewrite"));
            }
        }).start();
    }

    @PluginMethod
    public void createPdfFromCover(PluginCall call) {
        cancelRequested.set(false);
        String outputPath = call.getString("outputPath");
        String coverPath = call.getString("coverPath");

        if (outputPath == null || coverPath == null) {
            call.resolve(errorResult("REWRITE_FAILED", "create"));
            return;
        }

        new Thread(() -> {
            try {
                ensurePdfBoxInitialized();
                File outFile = resolvePathToFile(outputPath);
                File coverFile = resolvePathToFile(coverPath);
                ensureParentExists(outFile);
                createPdfFromCoverInternal(coverFile, outFile);

                JSObject out = new JSObject();
                out.put("success", true);
                out.put("outputPath", outFile.getAbsolutePath());
                call.resolve(out);
            } catch (CancelledException cancelled) {
                call.resolve(errorResult("CANCELLED", "create"));
            } catch (PluginError error) {
                call.resolve(error.toResult());
            } catch (OutOfMemoryError oom) {
                call.resolve(errorResult("PDF_TOO_LARGE", "create"));
            } catch (Exception error) {
                call.resolve(errorResult("REWRITE_FAILED", "create"));
            } catch (Throwable fatal) {
                call.resolve(errorResult("REWRITE_FAILED", "create"));
            }
        }).start();
    }

    @PluginMethod
    public void extractFirstPagePreview(PluginCall call) {
        cancelRequested.set(false);
        String inputPath = call.getString("inputPath");
        int maxDimension = call.getInt("maxDimension", 1600);

        if (inputPath == null || inputPath.trim().isEmpty()) {
            call.resolve(errorResult("PDF_CORRUPT", "preview"));
            return;
        }

        new Thread(() -> {
            try {
                ensurePdfBoxInitialized();
                File inputFile = resolvePathToFile(inputPath);
                File previewFile = renderFirstPagePreview(inputFile, maxDimension);
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(previewFile.getAbsolutePath(), options);

                JSObject out = new JSObject();
                out.put("success", true);
                out.put("tempImagePath", previewFile.getAbsolutePath());
                out.put("mimeType", "image/png");
                out.put("width", options.outWidth);
                out.put("height", options.outHeight);
                call.resolve(out);
            } catch (CancelledException cancelled) {
                call.resolve(errorResult("CANCELLED", "preview"));
            } catch (PluginError error) {
                call.resolve(error.toResult());
            } catch (OutOfMemoryError oom) {
                call.resolve(errorResult("PDF_TOO_LARGE", "preview"));
            } catch (Exception error) {
                call.resolve(errorResult("PDF_CORRUPT", "preview"));
            } catch (Throwable fatal) {
                call.resolve(errorResult("PDF_CORRUPT", "preview"));
            }
        }).start();
    }

    @PluginMethod
    public void cancelRewrite(PluginCall call) {
        cancelRequested.set(true);
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void openExternalFile(PluginCall call) {
        String inputPath = call.getString("inputPath");
        String mimeType = call.getString("mimeType", "application/pdf");
        String chooserTitle = call.getString("chooserTitle", "Open with");

        if (inputPath == null || inputPath.trim().isEmpty()) {
            call.resolve(errorResult("OPEN_FAILED", "open"));
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
            call.resolve(errorResult("NO_HANDLER", "open"));
        } catch (Exception error) {
            call.resolve(errorResult("OPEN_FAILED", "open"));
        }
    }

    private PreparedFile copyUriToWorkingFile(Uri uri, Long maxBytes) throws Exception {
        String originalName = queryDisplayName(uri);
        if (originalName == null || originalName.trim().isEmpty()) {
            originalName = "document.pdf";
        }
        long originalSize = querySize(uri);
        if (maxBytes != null && maxBytes > 0 && originalSize > maxBytes) {
            throw new PluginError("PDF_TOO_LARGE", "pick");
        }

        File workDir = new File(getContext().getFilesDir(), WORK_FOLDER);
        if (!workDir.exists() && !workDir.mkdirs()) {
            throw new PluginError("NO_SPACE", "pick");
        }

        String base = sanitizeBaseName(originalName);
        String timestamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(new Date());
        File outFile = uniquePdfFile(workDir, base + "-" + timestamp);

        long copied = 0;
        byte[] buffer = new byte[1024 * 64];
        try (InputStream in = getContext().getContentResolver().openInputStream(uri);
             FileOutputStream out = new FileOutputStream(outFile)) {
            if (in == null) {
                throw new PluginError("PDF_CORRUPT", "pick");
            }
            int read;
            while ((read = in.read(buffer)) != -1) {
                ensureNotCancelled();
                out.write(buffer, 0, read);
                copied += read;
                if (maxBytes != null && maxBytes > 0 && copied > maxBytes) {
                    throw new PluginError("PDF_TOO_LARGE", "pick");
                }
                if (originalSize > 0) {
                    int progress = (int) Math.min(95, Math.max(1, (copied * 100) / originalSize));
                    notifyProgress(progress);
                }
            }
            out.flush();
        } catch (IOException io) {
            if (looksNoSpace(io)) {
                throw new PluginError("NO_SPACE", "pick");
            }
            throw io;
        }

        return new PreparedFile(
            outFile,
            originalName,
            originalSize > 0 ? originalSize : copied,
            System.currentTimeMillis(),
            WORK_FOLDER + "/" + outFile.getName()
        );
    }

    private JSObject inspectFile(File file) {
        JSObject out = new JSObject();
        if (!file.exists() || file.length() <= 0) {
            out.put("success", false);
            out.put("valid", false);
            out.put("error", "PDF_CORRUPT");
            return out;
        }

        try (PDDocument doc = openDocumentForRead(file)) {
            ensureNotCancelled();
            if (doc.isEncrypted()) {
                out.put("success", false);
                out.put("valid", false);
                out.put("encrypted", true);
                out.put("error", "PDF_ENCRYPTED");
                return out;
            }

            int pageCount = doc.getNumberOfPages();
            if (pageCount <= 0) {
                out.put("success", false);
                out.put("valid", false);
                out.put("error", "PDF_CORRUPT");
                return out;
            }

            PDDocumentInformation info = doc.getDocumentInformation();
            out.put("success", true);
            out.put("valid", true);
            out.put("pageCount", pageCount);
            out.put("fileSizeBytes", file.length());
            if (info != null) {
                if (info.getTitle() != null) out.put("title", info.getTitle());
                if (info.getAuthor() != null) out.put("author", info.getAuthor());
            }
            return out;
        } catch (InvalidPasswordException e) {
            out.put("success", false);
            out.put("valid", false);
            out.put("passwordProtected", true);
            out.put("error", "PDF_PASSWORD_REQUIRED");
            return out;
        } catch (Exception e) {
            out.put("success", false);
            out.put("valid", false);
            out.put("error", "PDF_CORRUPT");
            return out;
        }
    }

    private void rewriteInsertedCoverSafely(File inputPdf, File coverImage, File outputPdf) throws Exception {
        File outputParent = outputPdf.getParentFile();
        if (outputParent == null) {
            throw new PluginError("REWRITE_FAILED", "io");
        }
        File tempOutput = new File(outputParent, outputPdf.getName() + ".insert.tmp");
        if (tempOutput.exists() && !tempOutput.delete()) {
            throw new PluginError("REWRITE_FAILED", "rewrite");
        }

        boolean completed = false;
        try {
            rewriteWithInsertedCover(inputPdf, coverImage, tempOutput, true);
            if (!isReadablePdf(tempOutput)) {
                rewriteWithInsertedCover(inputPdf, coverImage, tempOutput, false);
            }
            if (!isReadablePdf(tempOutput)) {
                throw new PluginError("REWRITE_FAILED", "rewrite");
            }

            replaceFileFromTemp(tempOutput, outputPdf);
            completed = true;
        } finally {
            if (!completed && tempOutput.exists()) {
                tempOutput.delete();
            }
        }
    }

    private void rewriteWithInsertedCover(
        File inputPdf,
        File coverImage,
        File outputPdf,
        boolean adjustNavigationMetadata
    ) throws Exception {
        notifyProgress(5);
        Bitmap bitmap = null;
        try (PDDocument source = openDocumentForRewrite(inputPdf)) {
            ensureNotCancelled();

            if (source.isEncrypted()) {
                throw new PluginError("PDF_ENCRYPTED", "rewrite");
            }

            bitmap = BitmapFactory.decodeFile(coverImage.getAbsolutePath());
            if (bitmap == null) {
                throw new PluginError("REWRITE_FAILED", "rewrite");
            }

            PDRectangle targetBox = new PDRectangle(bitmap.getWidth(), bitmap.getHeight());

            PDPage coverPage = new PDPage(targetBox);
            if (source.getNumberOfPages() > 0) {
                source.getPages().insertBefore(coverPage, source.getPage(0));
            } else {
                source.addPage(coverPage);
            }

            PDImageXObject image = JPEGFactory.createFromImage(source, bitmap, 0.92f);
            try (PDPageContentStream stream = new PDPageContentStream(source, coverPage)) {
                stream.drawImage(image, 0, 0, targetBox.getWidth(), targetBox.getHeight());
            }

            if (adjustNavigationMetadata) {
                shiftOutlineDestinationsIfPossible(source, 1);
                shiftPageLabelStartIndicesIfPresent(source, 1);
            }
            notifyProgress(90);

            ensureNotCancelled();
            source.save(outputPdf);
            notifyProgress(100);
        } catch (InvalidPasswordException e) {
            throw new PluginError("PDF_PASSWORD_REQUIRED", "rewrite");
        } catch (IOException io) {
            if (looksNoSpace(io)) {
                throw new PluginError("NO_SPACE", "rewrite");
            }
            throw io;
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
        }
    }

    private boolean isReadablePdf(File file) {
        if (file == null || !file.exists() || file.length() <= 0) {
            return false;
        }
        try (PDDocument doc = openDocumentForRead(file)) {
            return !doc.isEncrypted() && doc.getNumberOfPages() > 0;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void replaceFileFromTemp(File tempFile, File targetFile) throws IOException, PluginError {
        ensureParentExists(targetFile);
        if (targetFile.exists() && !targetFile.delete()) {
            throw new PluginError("REWRITE_FAILED", "io");
        }
        if (tempFile.renameTo(targetFile)) {
            return;
        }

        try (FileInputStream in = new FileInputStream(tempFile);
             FileOutputStream out = new FileOutputStream(targetFile)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
        }
        if (!tempFile.delete()) {
            tempFile.deleteOnExit();
        }
    }

    private void rewriteWithReplacedCover(File inputPdf, File coverImage, File outputPdf) throws Exception {
        notifyProgress(5);
        Bitmap bitmap = null;
        try (PDDocument source = openDocumentForRewrite(inputPdf)) {
            ensureNotCancelled();

            if (source.isEncrypted()) {
                throw new PluginError("PDF_ENCRYPTED", "rewrite");
            }

            int totalPages = source.getNumberOfPages();
            if (totalPages <= 0) {
                throw new PluginError("PDF_CORRUPT", "rewrite");
            }

            bitmap = BitmapFactory.decodeFile(coverImage.getAbsolutePath());
            if (bitmap == null) {
                throw new PluginError("REWRITE_FAILED", "rewrite");
            }

            PDRectangle targetBox = source.getPage(0).getMediaBox();
            PDPage coverPage = source.getPage(0);
            coverPage.setMediaBox(targetBox);
            PDImageXObject image = JPEGFactory.createFromImage(source, bitmap, 0.92f);
            try (PDPageContentStream stream = new PDPageContentStream(source, coverPage)) {
                stream.drawImage(image, 0, 0, targetBox.getWidth(), targetBox.getHeight());
            }

            notifyProgress(90);

            ensureNotCancelled();
            source.save(outputPdf);
            notifyProgress(100);
        } catch (InvalidPasswordException e) {
            throw new PluginError("PDF_PASSWORD_REQUIRED", "rewrite");
        } catch (IOException io) {
            if (looksNoSpace(io)) {
                throw new PluginError("NO_SPACE", "rewrite");
            }
            throw io;
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
        }
    }

    private void shiftOutlineDestinationsIfPossible(PDDocument document, int pageOffset) {
        if (document == null || pageOffset == 0) return;
        try {
            PDDocumentOutline outline = document.getDocumentCatalog() != null
                ? document.getDocumentCatalog().getDocumentOutline()
                : null;
            if (outline == null) return;

            PDOutlineItem item = outline.getFirstChild();
            while (item != null) {
                shiftOutlineItemDestinations(item, pageOffset);
                item = item.getNextSibling();
            }
        } catch (Exception ignored) {
            // Best effort only: if outline parsing fails, keep rewrite result.
        }
    }

    private void shiftOutlineItemDestinations(PDOutlineItem item, int pageOffset) throws IOException {
        if (item == null) return;

        PDDestination destination = item.getDestination();
        if (destination instanceof PDPageDestination) {
            PDPageDestination pageDestination = (PDPageDestination) destination;
            int pageNumber = pageDestination.retrievePageNumber();
            if (pageNumber >= 0) {
                pageDestination.setPageNumber(Math.max(0, pageNumber + pageOffset));
            }
        }

        PDAction action = item.getAction();
        if (action instanceof PDActionGoTo) {
            PDDestination actionDestination = ((PDActionGoTo) action).getDestination();
            if (actionDestination instanceof PDPageDestination) {
                PDPageDestination pageDestination = (PDPageDestination) actionDestination;
                int pageNumber = pageDestination.retrievePageNumber();
                if (pageNumber >= 0) {
                    pageDestination.setPageNumber(Math.max(0, pageNumber + pageOffset));
                }
            }
        }

        PDOutlineItem child = item.getFirstChild();
        while (child != null) {
            shiftOutlineItemDestinations(child, pageOffset);
            child = child.getNextSibling();
        }
    }

    private void shiftPageLabelStartIndicesIfPresent(PDDocument document, int pageOffset) {
        if (document == null || pageOffset == 0) return;
        try {
            if (document.getDocumentCatalog() == null) return;

            COSDictionary catalog = document.getDocumentCatalog().getCOSObject();
            if (catalog == null) return;

            COSBase pageLabelsBase = catalog.getDictionaryObject(COSName.PAGE_LABELS);
            if (!(pageLabelsBase instanceof COSDictionary)) return;

            COSArray nums = (COSArray) ((COSDictionary) pageLabelsBase)
                .getDictionaryObject(COSName.NUMS);
            if (nums == null || nums.size() < 2) return;

            for (int i = 0; i < nums.size(); i += 2) {
                COSBase key = nums.getObject(i);
                if (!(key instanceof COSInteger)) continue;

                int start = ((COSInteger) key).intValue();
                int shifted = Math.max(0, start + pageOffset);
                nums.set(i, COSInteger.get(shifted));
            }
        } catch (Exception ignored) {
            // Best effort only: if page labels cannot be parsed, keep rewrite result.
        }
    }

    private void createPdfFromCoverInternal(File coverImage, File outputPdf) throws Exception {
        try (PDDocument out = new PDDocument()) {
            ensureNotCancelled();
            Bitmap bitmap = BitmapFactory.decodeFile(coverImage.getAbsolutePath());
            if (bitmap == null) {
                throw new PluginError("REWRITE_FAILED", "create");
            }

            PDRectangle box = new PDRectangle(bitmap.getWidth(), bitmap.getHeight());
            PDPage page = new PDPage(box);
            out.addPage(page);
            PDImageXObject image = JPEGFactory.createFromImage(out, bitmap, 0.92f);
            try (PDPageContentStream stream = new PDPageContentStream(out, page)) {
                stream.drawImage(image, 0, 0, box.getWidth(), box.getHeight());
            }

            out.save(outputPdf);
            notifyProgress(100);
        } catch (IOException io) {
            if (looksNoSpace(io)) {
                throw new PluginError("NO_SPACE", "create");
            }
            throw io;
        }
    }

    private File renderFirstPagePreview(File inputPdf, int maxDimension) throws Exception {
        Bitmap bitmap = null;
        Bitmap bitmapToWrite = null;
        try (PDDocument doc = openDocumentForRead(inputPdf)) {
            ensureNotCancelled();
            if (doc.isEncrypted()) {
                throw new PluginError("PDF_ENCRYPTED", "preview");
            }
            if (doc.getNumberOfPages() <= 0) {
                throw new PluginError("PDF_CORRUPT", "preview");
            }

            PDFRenderer renderer = new PDFRenderer(doc);
            renderer.setSubsamplingAllowed(true);
            PDPage firstPage = doc.getPage(0);
            PDRectangle mediaBox = firstPage.getMediaBox();
            float pageWidth = mediaBox == null ? 600f : Math.max(1f, mediaBox.getWidth());
            float pageHeight = mediaBox == null ? 800f : Math.max(1f, mediaBox.getHeight());
            int safeMax = maxDimension <= 0 ? 1600 : maxDimension;
            float naturalMax = Math.max(pageWidth, pageHeight);
            float requestedScale = safeMax / naturalMax;
            float renderScale = Math.max(
                PREVIEW_MIN_SCALE,
                Math.min(PREVIEW_MAX_SCALE, requestedScale)
            );

            bitmap = renderer.renderImage(0, renderScale, ImageType.RGB);
            if (bitmap == null) {
                throw new PluginError("PDF_CORRUPT", "preview");
            }

            int w = bitmap.getWidth();
            int h = bitmap.getHeight();
            int max = Math.max(w, h);
            if (max > safeMax) {
                float scale = (float) safeMax / (float) max;
                int nw = Math.max(1, Math.round(w * scale));
                int nh = Math.max(1, Math.round(h * scale));
                bitmapToWrite = Bitmap.createScaledBitmap(bitmap, nw, nh, true);
                if (bitmapToWrite != bitmap && bitmap != null && !bitmap.isRecycled()) {
                    bitmap.recycle();
                }
            } else {
                bitmapToWrite = bitmap;
            }

            File previewFile = new File(getContext().getCacheDir(), "pdf_preview_" + System.currentTimeMillis() + ".png");
            try (FileOutputStream out = new FileOutputStream(previewFile)) {
                if (bitmapToWrite == null) {
                    throw new PluginError("PDF_CORRUPT", "preview");
                }
                bitmapToWrite.compress(Bitmap.CompressFormat.PNG, 100, out);
                out.flush();
            }
            return previewFile;
        } catch (InvalidPasswordException e) {
            throw new PluginError("PDF_PASSWORD_REQUIRED", "preview");
        } finally {
            if (bitmapToWrite != null && !bitmapToWrite.isRecycled()) {
                bitmapToWrite.recycle();
            }
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
        }
    }

    private PDDocument openDocumentForRead(File file) throws IOException {
        return PDDocument.load(
            file,
            MemoryUsageSetting.setupMixed(PDFBOX_MAIN_MEMORY_BUDGET_BYTES)
        );
    }

    private PDDocument openDocumentForRewrite(File file) throws IOException {
        return PDDocument.load(
            file,
            MemoryUsageSetting.setupMixed(PDFBOX_MAIN_MEMORY_BUDGET_BYTES)
        );
    }

    private File resolvePathToFile(String inputPath) {
        String value = inputPath.trim();
        if (value.startsWith("file://")) {
            return new File(Uri.parse(value).getPath());
        }
        if (value.startsWith("content://")) {
            throw new IllegalArgumentException("content uri not supported directly in this method");
        }
        return new File(value);
    }

    private Uri resolvePathToOpenUri(String inputPath) {
        String value = inputPath.trim();
        if (value.startsWith("content://")) {
            return Uri.parse(value);
        }

        File file = resolvePathToFile(value);
        if (!file.exists()) {
            throw new IllegalArgumentException("file_not_found");
        }
        String authority = getContext().getPackageName() + ".fileprovider";
        return FileProvider.getUriForFile(getContext(), authority, file);
    }

    private void ensureParentExists(File file) throws PluginError {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new PluginError("NO_SPACE", "io");
        }
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    return cursor.getString(nameIndex);
                }
            }
        } catch (Exception ignored) {
        }
        return "document.pdf";
    }

    private long querySize(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeIndex >= 0) {
                    return cursor.getLong(sizeIndex);
                }
            }
        } catch (Exception ignored) {
        }
        return -1;
    }

    private File uniquePdfFile(File dir, String baseName) {
        String cleanBase = baseName.replaceAll("(?i)\\\\.pdf$", "");
        File candidate = new File(dir, cleanBase + ".pdf");
        int index = 1;
        while (candidate.exists()) {
            candidate = new File(dir, cleanBase + " (" + index + ").pdf");
            index++;
        }
        return candidate;
    }

    private String sanitizeBaseName(String name) {
        String base = (name == null ? "pdf" : name).replaceAll("(?i)\\\\.pdf$", "").trim();
        base = base.replaceAll("[\\\\/:*?\"<>|]", " ");
        base = base.replaceAll("\\\\s+", " ").trim();
        if (base.isEmpty()) {
            return "pdf";
        }
        if (base.length() > 80) {
            return base.substring(0, 80).trim();
        }
        return base;
    }

    private void notifyProgress(int percent) {
        JSObject event = new JSObject();
        event.put("percent", Math.max(0, Math.min(100, percent)));
        notifyListeners("rewriteProgress", event);
    }

    private void ensurePdfBoxInitialized() throws PluginError {
        if (pdfBoxInitialized.get()) {
            return;
        }

        synchronized (pdfBoxInitialized) {
            if (pdfBoxInitialized.get()) {
                return;
            }
            try {
                PDFBoxResourceLoader.init(getContext().getApplicationContext());
                pdfBoxInitialized.set(true);
            } catch (Throwable fatal) {
                throw new PluginError("REWRITE_FAILED", "init");
            }
        }
    }

    private void ensureNotCancelled() throws CancelledException {
        if (cancelRequested.get()) {
            throw new CancelledException();
        }
    }

    private boolean looksNoSpace(Exception error) {
        String message = String.valueOf(error.getMessage()).toLowerCase(Locale.US);
        return message.contains("enospc") || message.contains("no space") || message.contains("insufficient");
    }

    private JSObject errorResult(String code, String stage) {
        JSObject out = new JSObject();
        out.put("success", false);
        out.put("valid", false);
        out.put("error", code);
        out.put("stage", stage);
        return out;
    }

    private static class PreparedFile {
        final File file;
        final String originalName;
        final long originalSize;
        final long lastModified;
        final String workingPath;

        PreparedFile(File file, String originalName, long originalSize, long lastModified, String workingPath) {
            this.file = file;
            this.originalName = originalName;
            this.originalSize = originalSize;
            this.lastModified = lastModified;
            this.workingPath = workingPath;
        }
    }

    private static class CancelledException extends Exception {
    }

    private static class PluginError extends Exception {
        final String code;
        final String stage;

        PluginError(String code, String stage) {
            this.code = code;
            this.stage = stage;
        }

        JSObject toResult() {
            JSObject out = new JSObject();
            out.put("success", false);
            out.put("valid", false);
            out.put("error", code);
            out.put("stage", stage);
            return out;
        }
    }
}
