package com.sheldrapps.plugins.pdfrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;

import java.io.File;
import java.util.Arrays;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class PdfMergeOperationTest {
    @Rule
    public TemporaryFolder temporaryFolder = new TemporaryFolder();

    @Test
    public void addsDocumentBookmarksAfterPagesAreCopied() throws Exception {
        File first = createPdf("first.pdf");
        File second = createPdf("second.pdf");
        File output = temporaryFolder.newFile("merged.pdf");

        new PdfMergeOperation().execute(
            Arrays.asList(first, second),
            Arrays.asList("First", "Second"),
            "documents-and-bookmarks",
            null,
            .92f,
            output,
            new NoopProgress()
        );

        try (PDDocument merged = PDDocument.load(output)) {
            assertEquals(2, merged.getNumberOfPages());
            PDDocumentOutline outline = merged.getDocumentCatalog().getDocumentOutline();
            assertNotNull(outline);
            PDOutlineItem firstBookmark = outline.getFirstChild();
            assertNotNull(firstBookmark);
            assertEquals("First", firstBookmark.getTitle());
            assertNotNull(firstBookmark.getNextSibling());
            assertEquals("Second", firstBookmark.getNextSibling().getTitle());
        }
    }

    private File createPdf(String name) throws Exception {
        File file = temporaryFolder.newFile(name);
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage());
            document.save(file);
        }
        return file;
    }

    private static final class NoopProgress implements PdfProgress {
        @Override
        public void emit(String phase, int completed, int total) {
        }

        @Override
        public void checkCancelled() throws PdfOperationException {
        }
    }
}
