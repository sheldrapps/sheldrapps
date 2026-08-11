package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

public final class PdfMergeOperation {
    private final PdfPageCopier copier = new PdfPageCopier();
    private final PdfBookmarkManager bookmarks = new PdfBookmarkManager();
    private final PdfMetadataManager metadata = new PdfMetadataManager();
    private final PdfPageLabelManager labels = new PdfPageLabelManager();
    private final PdfCoverWriter cover = new PdfCoverWriter();
    private final PdfValidator validator = new PdfValidator();
    private final PdfSequentialMergeOperation sequential = new PdfSequentialMergeOperation();

    public Result execute(List<File> sources, List<String> names, String bookmarkMode, File coverImage, float coverQuality, File output, PdfProgress progress) throws Exception {
        if (sources.size() < 2) throw new PdfOperationException("MERGE_REQUIRES_TWO_PDFS", "merge");
        if (sequential.shouldUse(sources)) {
            PdfSequentialMergeOperation.Result result = sequential.execute(sources, coverImage, coverQuality, output, progress);
            return new Result(result.file, result.warnings);
        }
        List<String> warnings = new ArrayList<>();
        List<PDDocument> opened = new ArrayList<>();
        try (PDDocument target = new PDDocument()) {
            if (coverImage != null) cover.prependImageCover(target, coverImage, coverQuality);
            int offset = target.getNumberOfPages(); int completed = 0; int total = 0;
            for (File source : sources) {
                PdfResourceBudget.requireInput(source, "merge");
                try (PDDocument count = PDDocument.load(source, PdfMemoryPolicy.forFile(source))) {
                    if (count.isEncrypted()) throw new PdfOperationException("PDF_ENCRYPTED", "merge");
                    total += count.getNumberOfPages();
                }
            }
            for (int index=0; index<sources.size(); index++) {
                progress.checkCancelled();
                PDDocument source = PDDocument.load(sources.get(index), PdfMemoryPolicy.forFile(sources.get(index)));
                opened.add(source); // MUST stay open through target.save (COS streams are referenced by importPage).
                if (index == 0) metadata.copyCompatible(source, target);
                if (source.getDocumentCatalog().getAcroForm() != null) warnings.add("ACROFORM_NOT_RECONSTRUCTED");
                if (source.getSignatureDictionaries().size() > 0) warnings.add("SIGNATURES_INVALIDATED_BY_REWRITE");
                if (labels.hasLabels(source)) warnings.add("PAGE_LABELS_REQUIRE_MANUAL_REBUILD");
                if ("documents-and-bookmarks".equals(bookmarkMode) || "documents-only".equals(bookmarkMode)) bookmarks.addDocumentBookmark(target, names.get(index), offset);
                if ("documents-and-bookmarks".equals(bookmarkMode) || "original-bookmarks".equals(bookmarkMode)) bookmarks.copyOriginalTopLevel(source, target, offset, 0, source.getNumberOfPages()-1);
                int copied = copier.copy(source, target, 0, source.getNumberOfPages()-1, completed, new PhaseProgress(progress, total));
                completed += copied; offset += copied;
            }
            progress.checkCancelled(); target.save(output); progress.emit("validate", total, total);
        } finally { for (PDDocument source : opened) try { source.close(); } catch (Exception ignored) { } }
        validator.validate(output); progress.emit("complete", 1, 1); return new Result(output, warnings);
    }
    private static final class PhaseProgress implements PdfProgress { private final PdfProgress delegate; private final int total; PhaseProgress(PdfProgress delegate,int total){this.delegate=delegate;this.total=total;} public void emit(String phase,int completed,int ignored){delegate.emit(phase,completed,total);} public void checkCancelled() throws PdfOperationException {delegate.checkCancelled();} }
    public static final class Result { public final File file; public final List<String> warnings; Result(File file,List<String>warnings){this.file=file;this.warnings=warnings;} }
}
