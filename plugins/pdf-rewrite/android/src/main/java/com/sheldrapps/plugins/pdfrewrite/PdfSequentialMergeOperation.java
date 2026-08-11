package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.io.MemoryUsageSetting;
import com.tom_roush.pdfbox.multipdf.PDFMergerUtility;
import com.tom_roush.pdfbox.pdmodel.PDDocument;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public final class PdfSequentialMergeOperation {
    private static final long LARGE_INPUT_THRESHOLD_BYTES = 256L * 1024L * 1024L;
    private final PdfCoverWriter coverWriter = new PdfCoverWriter();
    private final PdfValidator validator = new PdfValidator();

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
        File coverImage,
        float coverQuality,
        File output,
        PdfProgress progress
    ) throws Exception {
        List<File> temporarySources = new ArrayList<>();
        try {
            for (File source : sources) PdfResourceBudget.requireInput(source, "merge");
            if (coverImage != null) {
                File coverPdf = new File(output.getParentFile(), output.getName() + ".cover.partial.pdf");
                temporarySources.add(coverPdf);
                try (PDDocument document = new PDDocument()) {
                    coverWriter.prependImageCover(document, coverImage, coverQuality);
                    document.save(coverPdf);
                }
            }

            PDFMergerUtility merger = new PDFMergerUtility();
            for (File source : temporarySources) merger.addSource(source);
            for (File source : sources) merger.addSource(source);
            merger.setDestinationFileName(output.getAbsolutePath());
            progress.emit("copy", 0, 1);
            merger.mergeDocuments(MemoryUsageSetting.setupTempFileOnly());
            progress.emit("copy", 1, 1);
            validator.validate(output);
            progress.emit("complete", 1, 1);
            return new Result(output, List.of("LARGE_MERGE_DOCUMENT_METADATA_LIMITED"));
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
