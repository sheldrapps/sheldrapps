package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.io.MemoryUsageSetting;
import com.tom_roush.pdfbox.multipdf.PDFMergerUtility;
import com.tom_roush.pdfbox.pdmodel.PDDocument;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;

public final class PdfSequentialMergeOperation {
    private static final long LARGE_INPUT_THRESHOLD_BYTES = 256L * 1024L * 1024L;
    private final PdfCoverWriter coverWriter = new PdfCoverWriter();
    private final PdfValidator validator = new PdfValidator();
    private final PdfBookmarkManager bookmarks = new PdfBookmarkManager();

    public boolean shouldUse(List<File> sources) {
        long total = 0L;
        for (File source : sources) {
            if (source == null) return false;
            if (Long.MAX_VALUE - total < source.length()) return true;
            total += source.length();
        }
        return total > LARGE_INPUT_THRESHOLD_BYTES;
    }

    public Result execute(
        List<File> sources,
        List<String> names,
        String bookmarkMode,
        File coverImage,
        float coverQuality,
        File output,
        PdfProgress progress
    ) throws Exception {
        List<File> temporarySources = new ArrayList<>();
        List<PdfBookmarkManager.BookmarkEntry> manifest = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        try {
            for (File source : sources) PdfResourceBudget.requireInput(source, "merge");
            int pageOffset = 0;
            if (coverImage != null) {
                File coverPdf = new File(output.getParentFile(), output.getName() + ".cover.partial.pdf");
                temporarySources.add(coverPdf);
                try (PDDocument document = new PDDocument()) {
                    coverWriter.prependImageCover(document, coverImage, coverQuality);
                    document.save(coverPdf);
                }
                pageOffset = 1;
            }

            for (int index = 0; index < sources.size(); index++) {
                File source = sources.get(index);
                try (PDDocument document = PDDocument.load(source, PdfMemoryPolicy.forFile(source))) {
                    if (document.isEncrypted()) throw new PdfOperationException("PDF_ENCRYPTED", "merge");
                    if (document.getDocumentCatalog().getAcroForm() != null) warnings.add("ACROFORM_NOT_RECONSTRUCTED");
                    if (document.getSignatureDictionaries().size() > 0) warnings.add("SIGNATURES_INVALIDATED_BY_REWRITE");
                    if (new PdfPageLabelManager().hasLabels(document)) warnings.add("PAGE_LABELS_REQUIRE_MANUAL_REBUILD");
                    if ("documents-and-bookmarks".equals(bookmarkMode) || "documents-only".equals(bookmarkMode)) {
                        manifest.add(new PdfBookmarkManager.BookmarkEntry(names.get(index), pageOffset));
                    }
                    if ("documents-and-bookmarks".equals(bookmarkMode) || "original-bookmarks".equals(bookmarkMode)) {
                        manifest.addAll(bookmarks.collectOriginalTopLevel(document, pageOffset));
                    }
                    pageOffset += document.getNumberOfPages();
                }
            }

            PDFMergerUtility merger = new PDFMergerUtility();
            for (File source : temporarySources) merger.addSource(source);
            for (File source : sources) merger.addSource(source);
            merger.setDestinationFileName(output.getAbsolutePath());
            progress.emit("copy", 0, 1);
            merger.mergeDocuments(MemoryUsageSetting.setupTempFileOnly());
            progress.emit("copy", 1, 1);
            if (!manifest.isEmpty()) {
                File bookmarked = new File(output.getParentFile(), output.getName() + ".bookmarks.partial.pdf");
                try (PDDocument document = PDDocument.load(output, PdfMemoryPolicy.forFile(output))) {
                    bookmarks.addEntries(document, manifest);
                    document.save(bookmarked);
                }
                Files.move(bookmarked.toPath(), output.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
            validator.validate(output);
            progress.emit("complete", 1, 1);
            warnings.add("LARGE_MERGE_DOCUMENT_METADATA_LIMITED");
            return new Result(output, warnings);
        } finally {
            for (File temporary : temporarySources) {
                if (temporary.exists() && !temporary.delete()) temporary.deleteOnExit();
            }
        }
    }

    public static final class Result {
        public final File file;
        public final List<String> warnings;

        Result(File file, List<String> warnings) {
            this.file = file;
            this.warnings = warnings;
        }
    }
}
