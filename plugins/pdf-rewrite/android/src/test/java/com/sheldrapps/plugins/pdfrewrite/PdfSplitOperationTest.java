package com.sheldrapps.plugins.pdfrewrite;

import static org.junit.Assert.assertEquals;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDActionGoTo;
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitDestination;

import java.io.File;
import java.util.Arrays;
import java.util.Collections;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class PdfSplitOperationTest {
    @Rule
    public TemporaryFolder temporaryFolder = new TemporaryFolder();

    @Test
    public void createsEveryPlannedPartWithTheExpectedPages() throws Exception {
        File source = temporaryFolder.newFile("source.pdf");
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage());
            document.addPage(new PDPage());
            document.addPage(new PDPage());
            document.addPage(new PDPage());
            document.save(source);
        }

        File outputDirectory = temporaryFolder.newFolder("outputs");
        PdfSplitOperation.Result result = new PdfSplitOperation().execute(
            source,
            Arrays.asList(
                new PdfSplitOperation.Plan("part-1.pdf", Collections.singletonList(new PdfSplitOperation.Range(0, 1))),
                new PdfSplitOperation.Plan("part-2.pdf", Collections.singletonList(new PdfSplitOperation.Range(2, 3)))
            ),
            null,
            .92f,
            outputDirectory,
            new NoopProgress()
        );

        assertEquals(2, result.files.size());
        try (PDDocument first = PDDocument.load(result.files.get(0)); PDDocument second = PDDocument.load(result.files.get(1))) {
            assertEquals(2, first.getNumberOfPages());
            assertEquals(2, second.getNumberOfPages());
        }
    }

    @Test
    public void stillCreatesPartsWhenAnInternalLinkCannotBeRemapped() throws Exception {
        File source = temporaryFolder.newFile("linked-source.pdf");
        try (PDDocument document = new PDDocument()) {
            PDPage first = new PDPage();
            PDPage second = new PDPage();
            document.addPage(first);
            document.addPage(second);

            PDAnnotationLink link = new PDAnnotationLink();
            PDActionGoTo action = new PDActionGoTo();
            PDPageFitDestination destination = new PDPageFitDestination();
            destination.setPage(second);
            action.setDestination(destination);
            link.setAction(action);
            first.setAnnotations(Collections.singletonList(link));
            document.save(source);
        }

        File outputDirectory = temporaryFolder.newFolder("linked-outputs");
        PdfSplitOperation.Result result = new PdfSplitOperation().execute(
            source,
            Arrays.asList(
                new PdfSplitOperation.Plan("linked-part-1.pdf", Collections.singletonList(new PdfSplitOperation.Range(0, 0))),
                new PdfSplitOperation.Plan("linked-part-2.pdf", Collections.singletonList(new PdfSplitOperation.Range(1, 1)))
            ),
            null,
            .92f,
            outputDirectory,
            new NoopProgress()
        );

        assertEquals(2, result.files.size());
        assertEquals(1, result.files.get(0).exists() ? 1 : 0);
        assertEquals(1, result.files.get(1).exists() ? 1 : 0);
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
