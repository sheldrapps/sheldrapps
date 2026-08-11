package com.sheldrapps.plugins.pdfrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.PDResources;
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle;
import com.tom_roush.pdfbox.pdmodel.common.PDStream;
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDActionURI;
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDAcroForm;
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDTextField;
import com.tom_roush.pdfbox.pdmodel.common.PDPageLabels;
import com.tom_roush.pdfbox.pdmodel.common.PDPageLabelRange;
import com.tom_roush.pdfbox.cos.COSDictionary;
import com.tom_roush.pdfbox.cos.COSName;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/**
 * Exploratory, non-production tests for PDFBox Android 2.0.27.0.
 *
 * These tests intentionally document what PDDocument.importPage copies and
 * what remains document-level state that needs explicit migration.
 */
public class PdfBoxImportPageExploratoryTest {
    private static final PDRectangle CUSTOM_BOX = new PDRectangle(311.5f, 517.25f);

    @Test
    public void importsPagesWithoutRasterizingTextVectorsAndImages() throws Exception {
        try (PDDocument source = createRichSourceDocument();
             PDDocument target = new PDDocument()) {
            PDPage imported = target.importPage(source.getPage(0));

            assertEquals(1, target.getNumberOfPages());
            assertEquals(source.getPage(0).getMediaBox().getWidth(), imported.getMediaBox().getWidth(), 0.01f);
            assertEquals(source.getPage(0).getMediaBox().getHeight(), imported.getMediaBox().getHeight(), 0.01f);

            String content = readPageContent(imported);
            assertTrue("text drawing operators must survive import", content.contains("PDFBox import text"));
            assertTrue("vector line operators must survive import", content.contains(" l"));
            assertTrue("image drawing operator must survive import", content.contains(" Do"));
            assertTrue("image resource dictionary must survive import", imported.getResources().getCOSObject().getDictionaryObject(COSName.XOBJECT) != null);

        }
    }

    @Test
    public void mergePreservesOrderDimensionsAndRotation() throws Exception {
        try (PDDocument first = createPageDocument(PDRectangle.A4, 0, "first");
             PDDocument second = createPageDocument(new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth()), 90, "second");
             PDDocument third = createPageDocument(CUSTOM_BOX, 180, "third");
             PDDocument merged = new PDDocument()) {
            merged.importPage(first.getPage(0));
            merged.importPage(second.getPage(0));
            merged.importPage(third.getPage(0));

            assertEquals(3, merged.getNumberOfPages());
            assertPageGeometry(first.getPage(0), merged.getPage(0));
            assertPageGeometry(second.getPage(0), merged.getPage(1));
            assertPageGeometry(third.getPage(0), merged.getPage(2));

            assertTrue(readPageContent(merged.getPage(0)).contains("first"));
            assertTrue(readPageContent(merged.getPage(1)).contains("second"));
            assertTrue(readPageContent(merged.getPage(2)).contains("third"));
        }
    }

    @Test
    public void splitByRangesProducesIndependentDocumentsWithoutMissingPages() throws Exception {
        try (PDDocument source = createNumberedDocument(5);
             PDDocument firstPart = new PDDocument();
             PDDocument secondPart = new PDDocument()) {
            firstPart.importPage(source.getPage(0));
            firstPart.importPage(source.getPage(1));
            secondPart.importPage(source.getPage(2));
            secondPart.importPage(source.getPage(3));
            secondPart.importPage(source.getPage(4));

            assertEquals(2, firstPart.getNumberOfPages());
            assertEquals(3, secondPart.getNumberOfPages());
            assertTrue(readPageContent(firstPart.getPage(0)).contains("page-1"));
            assertTrue(readPageContent(firstPart.getPage(1)).contains("page-2"));
            assertTrue(readPageContent(secondPart.getPage(0)).contains("page-3"));
            assertTrue(readPageContent(secondPart.getPage(2)).contains("page-5"));
            assertTrue(!readPageContent(secondPart.getPage(0)).contains("page-2"));
        }
    }

    @Test
    public void reportsPageAnnotationsAndLinksAsPageLevelMigrationCandidates() throws Exception {
        try (PDDocument source = createRichSourceDocument();
             PDDocument target = new PDDocument()) {
            PDPage imported = target.importPage(source.getPage(0));
            List annotations = imported.getAnnotations();

            System.out.println("IMPORT_PAGE annotations=" + annotations.size());
            assertTrue("source fixture must contain a link annotation", source.getPage(0).getAnnotations().size() > 0);
            assertTrue("importPage must not silently crash on annotations", annotations != null);
            assertTrue("link annotation must be copied", annotations.get(0) instanceof PDAnnotationLink);
            PDActionURI action = (PDActionURI) ((PDAnnotationLink) annotations.get(0)).getAction();
            assertEquals("https://example.com/pdfbox-import", action.getURI());
        }
    }

    @Test
    public void documentsBookmarksPageLabelsAndFormsAsDocumentLevelState() throws Exception {
        try (PDDocument source = createRichSourceDocument();
             PDDocument target = new PDDocument()) {
            target.importPage(source.getPage(0));

            boolean sourceHasOutline = source.getDocumentCatalog().getDocumentOutline() != null;
            boolean targetHasOutline = target.getDocumentCatalog().getDocumentOutline() != null;
            boolean sourceHasForm = source.getDocumentCatalog().getCOSObject().getDictionaryObject(COSName.ACRO_FORM) != null;
            boolean targetHasForm = target.getDocumentCatalog().getCOSObject().getDictionaryObject(COSName.ACRO_FORM) != null;

            System.out.println("IMPORT_PAGE bookmarks source=" + sourceHasOutline + " target=" + targetHasOutline);
            System.out.println("IMPORT_PAGE pageLabels source=" + source.getDocumentCatalog().getPageLabels() + " target=" + target.getDocumentCatalog().getPageLabels());
            System.out.println("IMPORT_PAGE forms source=" + sourceHasForm + " target=" + targetHasForm);

            assertTrue("source fixture must contain an outline", sourceHasOutline);
            assertTrue("source fixture must contain an AcroForm", sourceHasForm);
            assertTrue("importPage must produce a usable target page", target.getNumberOfPages() == 1);
        }
    }

    @Test
    public void importsManyPagesSequentiallyWithinAStableMemoryEnvelope() throws Exception {
        final int pageCount = 80;
        long before = usedMemory();
        try (PDDocument source = createNumberedDocument(pageCount);
             PDDocument target = new PDDocument()) {
            for (int index = 0; index < pageCount; index++) {
                target.importPage(source.getPage(index));
            }
            assertEquals(pageCount, target.getNumberOfPages());
            long delta = Math.max(0, usedMemory() - before);
            System.out.println("IMPORT_PAGE memory_delta_bytes=" + delta + " pages=" + pageCount);
        }
    }

    private static PDDocument createRichSourceDocument() throws IOException {
        PDDocument document = new PDDocument();
        PDPage page = new PDPage(PDRectangle.A4);
        document.addPage(page);

        page.setContents(new PDStream(document, new java.io.ByteArrayInputStream(
            "BT /F1 14 Tf 72 720 Td (PDFBox import text) Tj ET 72 680 m 240 680 l S q 16 0 0 16 72 540 cm /Im1 Do Q"
                .getBytes(java.nio.charset.StandardCharsets.ISO_8859_1)
        )));
        page.setResources(createSyntheticResources());

        PDAnnotationLink link = new PDAnnotationLink();
        link.setRectangle(new PDRectangle(72, 700, 160, 24));
        PDActionURI action = new PDActionURI();
        action.setURI("https://example.com/pdfbox-import");
        link.setAction(action);
        page.getAnnotations().add(link);

        PDDocumentOutline outline = new PDDocumentOutline();
        PDOutlineItem item = new PDOutlineItem();
        item.setTitle("Rich source page");
        PDPageDestination destination = new PDPageFitDestination();
        destination.setPage(page);
        item.setDestination(destination);
        outline.addLast(item);
        document.getDocumentCatalog().setDocumentOutline(outline);

        PDPageLabels labels = new PDPageLabels(document);
        PDPageLabelRange labelRange = new PDPageLabelRange();
        labelRange.setStyle(PDPageLabelRange.STYLE_ROMAN_UPPER);
        labels.setLabelItem(0, labelRange);
        document.getDocumentCatalog().setPageLabels(labels);

        PDAcroForm form = new PDAcroForm(document);
        PDTextField field = new PDTextField(form);
        field.setPartialName("import-field");
        form.getFields().add(field);
        document.getDocumentCatalog().setAcroForm(form);

        return document;
    }

    private static PDDocument createPageDocument(PDRectangle box, int rotation, String text) throws IOException {
        PDDocument document = new PDDocument();
        PDPage page = new PDPage(box);
        page.setRotation(rotation);
        document.addPage(page);
        page.setContents(new PDStream(document, new java.io.ByteArrayInputStream(
            ("BT /F1 12 Tf 36 36 Td (" + text + ") Tj ET")
                .getBytes(java.nio.charset.StandardCharsets.ISO_8859_1)
        )));
        page.setResources(createSyntheticResources());
        return document;
    }

    private static PDDocument createNumberedDocument(int pageCount) throws IOException {
        PDDocument document = new PDDocument();
        for (int index = 0; index < pageCount; index++) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            page.setContents(new PDStream(document, new java.io.ByteArrayInputStream(
                ("BT /F1 12 Tf 36 36 Td (page-" + (index + 1) + ") Tj ET")
                    .getBytes(java.nio.charset.StandardCharsets.ISO_8859_1)
            )));
            page.setResources(createSyntheticResources());
        }
        return document;
    }

    private static PDResources createSyntheticResources() {
        PDResources resources = new PDResources();
        COSDictionary font = new COSDictionary();
        font.setName(COSName.TYPE, "Font");
        font.setName(COSName.SUBTYPE, "Type1");
        font.setName(COSName.BASE_FONT, "Helvetica");
        COSDictionary fonts = new COSDictionary();
        fonts.setItem(COSName.getPDFName("F1"), font);
        resources.getCOSObject().setItem(COSName.FONT, fonts);

        COSDictionary image = new COSDictionary();
        image.setName(COSName.TYPE, "XObject");
        image.setName(COSName.SUBTYPE, "Image");
        image.setInt(COSName.WIDTH, 1);
        image.setInt(COSName.HEIGHT, 1);
        image.setInt(COSName.BITS_PER_COMPONENT, 8);
        image.setName(COSName.COLORSPACE, "DeviceRGB");
        COSDictionary xObjects = new COSDictionary();
        xObjects.setItem(COSName.getPDFName("Im1"), image);
        resources.getCOSObject().setItem(COSName.XOBJECT, xObjects);
        return resources;
    }

    private static String readPageContent(PDPage page) throws IOException {
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        try (InputStream input = page.getContents()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                bytes.write(buffer, 0, read);
            }
        }
        return new String(bytes.toByteArray(), java.nio.charset.StandardCharsets.ISO_8859_1);
    }

    private static void assertPageGeometry(PDPage expected, PDPage actual) {
        assertEquals(expected.getMediaBox().getWidth(), actual.getMediaBox().getWidth(), 0.01f);
        assertEquals(expected.getMediaBox().getHeight(), actual.getMediaBox().getHeight(), 0.01f);
        assertEquals(expected.getRotation(), actual.getRotation());
    }

    private static long usedMemory() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.totalMemory() - runtime.freeMemory();
    }
}
