package com.sheldrapps.plugins.pdfrewrite;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.graphics.Bitmap;
import android.util.Log;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.tom_roush.pdfbox.android.PDFBoxResourceLoader;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream;
import com.tom_roush.pdfbox.pdmodel.PDResources;
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle;
import com.tom_roush.pdfbox.pdmodel.common.PDPageLabels;
import com.tom_roush.pdfbox.pdmodel.common.PDPageLabelRange;
import com.tom_roush.pdfbox.pdmodel.encryption.AccessPermission;
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException;
import com.tom_roush.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font;
import com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject;
import com.tom_roush.pdfbox.pdmodel.graphics.image.JPEGFactory;
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDActionURI;
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationWidget;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDAcroForm;
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDSignatureField;
import com.tom_roush.pdfbox.pdmodel.interactive.form.PDTextField;
import com.tom_roush.pdfbox.pdmodel.interactive.digitalsignature.PDSignature;
import com.tom_roush.pdfbox.cos.COSName;
import com.tom_roush.pdfbox.rendering.ImageType;
import com.tom_roush.pdfbox.rendering.PDFRenderer;
import com.tom_roush.pdfbox.text.PDFTextStripper;

import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@RunWith(AndroidJUnit4.class)
public class PdfBoxImportPageDeviceTest {
    private static final String TAG = "PdfBoxImportPageDeviceTest";
    private static final String PASSWORD = "pdfbox-test-password";
    private static final PDRectangle CUSTOM_BOX = new PDRectangle(311.5f, 517.25f);

    @BeforeClass
    public static void initializePdfBox() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        PDFBoxResourceLoader.init(context);
    }

    @Test
    public void mergeCopiesContentAndPagePropertiesAndRendersOutputs() throws Exception {
        long started = System.nanoTime();
        File root = testDirectory("merge");
        List<File> inputs = new ArrayList<>();
        inputs.add(createRichPdf(new File(root, "portrait.pdf"), PDRectangle.A4, 0, "portrait"));
        inputs.add(createRichPdf(new File(root, "landscape.pdf"), landscapeA4(), 90, "landscape"));
        inputs.add(createRichPdf(new File(root, "custom.pdf"), CUSTOM_BOX, 180, "custom"));
        for (File input : inputs) renderFilePage(input, 0, "source-" + input.getName());

        File mergedFile = new File(root, "merged.pdf");
        List<PDDocument> sources = new ArrayList<>();
        try (PDDocument merged = new PDDocument()) {
            for (File input : inputs) {
                PDDocument source = PDDocument.load(input);
                sources.add(source);
                merged.importPage(source.getPage(0));
            }
            merged.save(mergedFile);
        } finally {
            for (PDDocument source : sources) source.close();
        }

        try (PDDocument reopened = PDDocument.load(mergedFile)) {
            assertEquals(3, reopened.getNumberOfPages());
            assertPageProperties(inputs.get(0), reopened.getPage(0));
            assertPageProperties(inputs.get(1), reopened.getPage(1));
            assertPageProperties(inputs.get(2), reopened.getPage(2));
            String text = new PDFTextStripper().getText(reopened);
            assertTrue(text.contains("portrait"));
            assertTrue(text.contains("landscape"));
            assertTrue(text.contains("custom"));
            renderAndAssert(reopened, 0, "merged-page-1");
            renderAndAssert(reopened, 1, "merged-page-2");
            renderAndAssert(reopened, 2, "merged-page-3");
        }

        logMetric("merge", started, mergedFile.length(), 3);
    }

    @Test
    public void splitCopiesInclusiveRangesAndReopensEveryOutput() throws Exception {
        long started = System.nanoTime();
        File root = testDirectory("split");
        File input = createNumberedPdf(new File(root, "source.pdf"), 5);
        File firstOutput = new File(root, "part-1.pdf");
        File secondOutput = new File(root, "part-2.pdf");
        renderFilePage(input, 0, "split-source-first");
        renderFilePage(input, 4, "split-source-last");

        try (PDDocument source = PDDocument.load(input);
             PDDocument first = new PDDocument();
             PDDocument second = new PDDocument()) {
            first.importPage(source.getPage(0));
            first.importPage(source.getPage(1));
            second.importPage(source.getPage(2));
            second.importPage(source.getPage(3));
            second.importPage(source.getPage(4));
            first.save(firstOutput);
            second.save(secondOutput);
        }

        assertReopenedPart(firstOutput, 2, "page-1", "page-2");
        assertReopenedPart(secondOutput, 3, "page-3", "page-5");
        logMetric("split", started, firstOutput.length() + secondOutput.length(), 5);
    }

    @Test
    public void recordsPageLevelAndDocumentLevelStructures() throws Exception {
        File root = testDirectory("structures");
        File sourceFile = createRichPdf(new File(root, "rich.pdf"), PDRectangle.A4, 0, "rich");
        File outputFile = new File(root, "imported.pdf");
        renderFilePage(sourceFile, 0, "structures-source");

        try (PDDocument source = PDDocument.load(sourceFile);
             PDDocument output = new PDDocument()) {
            output.importPage(source.getPage(0));
            output.save(outputFile);
        }

        try (PDDocument source = PDDocument.load(sourceFile);
             PDDocument output = PDDocument.load(outputFile)) {
            int sourceAnnotations = source.getPage(0).getAnnotations().size();
            int outputAnnotations = output.getPage(0).getAnnotations().size();
            boolean sourceOutline = source.getDocumentCatalog().getDocumentOutline() != null;
            boolean outputOutline = output.getDocumentCatalog().getDocumentOutline() != null;
            boolean sourceLabels = source.getDocumentCatalog().getPageLabels() != null;
            boolean outputLabels = output.getDocumentCatalog().getPageLabels() != null;
            boolean sourceForm = source.getDocumentCatalog().getAcroForm() != null;
            boolean outputForm = output.getDocumentCatalog().getAcroForm() != null;

            Log.i(TAG, "structures annotations=" + sourceAnnotations + "->" + outputAnnotations
                + " bookmarks=" + sourceOutline + "->" + outputOutline
                + " pageLabels=" + sourceLabels + "->" + outputLabels
                + " forms=" + sourceForm + "->" + outputForm);

            assertTrue(sourceAnnotations > 0);
            assertTrue(outputAnnotations > 0);
            PDActionURI action = (PDActionURI) ((PDAnnotationLink) output.getPage(0).getAnnotations().get(0)).getAction();
            assertEquals("https://example.com/pdfbox-device", action.getURI());
            assertTrue(sourceOutline);
            assertTrue(sourceLabels);
            assertTrue(sourceForm);
            assertTrue("document-level bookmarks are not copied by importPage", !outputOutline);
            assertTrue("document-level page labels are not copied by importPage", !outputLabels);
            assertTrue("document-level forms are not copied by importPage", !outputForm);
        }
    }

    @Test
    public void recordsEncryptionAndUnsignedSignatureFieldLimitations() throws Exception {
        File root = testDirectory("security");
        File encryptedFile = createEncryptedPdf(new File(root, "encrypted.pdf"));
        File signatureFile = createSignatureFieldPdf(new File(root, "signature-field.pdf"));

        try (PDDocument encrypted = PDDocument.load(encryptedFile, PASSWORD)) {
            assertTrue(encrypted.isEncrypted());
            assertEquals(1, encrypted.getNumberOfPages());
            try (PDDocument imported = new PDDocument()) {
                imported.importPage(encrypted.getPage(0));
                assertEquals(1, imported.getNumberOfPages());
            }
        }
        try {
            PDDocument.load(encryptedFile, "wrong-password").close();
            throw new AssertionError("wrong password unexpectedly opened encrypted fixture");
        } catch (InvalidPasswordException expected) {
            Log.i(TAG, "security wrong-password=blocked");
        }
        try (PDDocument signature = PDDocument.load(signatureFile)) {
            assertNotNull(signature.getDocumentCatalog().getAcroForm());
            assertTrue(signature.getDocumentCatalog().getAcroForm().getFields().size() > 0);
        }
        Log.i(TAG, "security encrypted=readable-with-password signature=unsigned-field-only");
    }

    @Test
    public void recordsLargeSequentialImportMemoryAndRendering() throws Exception {
        long started = System.nanoTime();
        File root = testDirectory("large");
        File input = createLargePdf(new File(root, "large-source.pdf"), 120);
        File output = new File(root, "large-imported.pdf");
        Runtime runtime = Runtime.getRuntime();
        long before = runtime.totalMemory() - runtime.freeMemory();

        try (PDDocument source = PDDocument.load(input);
             PDDocument target = new PDDocument()) {
            for (int index = 0; index < source.getNumberOfPages(); index++) {
                target.importPage(source.getPage(index));
            }
            assertEquals(120, target.getNumberOfPages());
            target.save(output);
        }

        long after = runtime.totalMemory() - runtime.freeMemory();
        renderFilePage(input, 0, "large-source-first");
        renderFilePage(input, 119, "large-source-last");
        try (PDDocument reopened = PDDocument.load(output)) {
            assertEquals(120, reopened.getNumberOfPages());
            renderAndAssert(reopened, 0, "large-first-page");
            renderAndAssert(reopened, 119, "large-last-page");
        }
        Log.i(TAG, "large pages=120 bytes=" + output.length()
            + " memory_delta=" + Math.max(0, after - before)
            + " duration_ms=" + elapsedMillis(started));
    }

    @Test
    public void splitRebindsIncludedInternalLinksAndRemovesExcludedTargets() throws Exception {
        File root = testDirectory("internal-links");
        File sourceFile = new File(root, "source.pdf");
        try (PDDocument source = new PDDocument()) {
            PDPage first = new PDPage(PDRectangle.A4);
            PDPage second = new PDPage(PDRectangle.A4);
            PDPage third = new PDPage(PDRectangle.A4);
            source.addPage(first); source.addPage(second); source.addPage(third);
            addInternalLink(first, second);
            addInternalLink(second, third);
            source.save(sourceFile);
        }
        List<PdfSplitOperation.Plan> plans = new ArrayList<>();
        List<PdfSplitOperation.Range> firstPart = new ArrayList<>(); firstPart.add(new PdfSplitOperation.Range(0, 1));
        List<PdfSplitOperation.Range> secondPart = new ArrayList<>(); secondPart.add(new PdfSplitOperation.Range(2, 2));
        plans.add(new PdfSplitOperation.Plan("first.pdf", firstPart));
        plans.add(new PdfSplitOperation.Plan("second.pdf", secondPart));
        PdfSplitOperation.Result result = new PdfSplitOperation().execute(sourceFile, plans, null, root, new PdfProgress() {
            @Override public void emit(String phase, int completed, int total) { }
            @Override public void checkCancelled() { }
        });
        assertTrue(result.warnings.contains("INTERNAL_LINK_TARGET_REMOVED"));
        try (PDDocument first = PDDocument.load(result.files.get(0))) {
            PDAnnotationLink included = (PDAnnotationLink) first.getPage(0).getAnnotations().get(0);
            PDPageDestination destination = (PDPageDestination) included.getDestination();
            assertEquals(first.getPage(1).getCOSObject(), destination.getPage().getCOSObject());
            PDAnnotationLink excluded = (PDAnnotationLink) first.getPage(1).getAnnotations().get(0);
            assertTrue(excluded.getDestination() == null);
            assertTrue(excluded.getAction() == null);
        }
    }

    private static File createRichPdf(File file, PDRectangle box, int rotation, String label) throws Exception {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(box);
            page.setRotation(rotation);
            document.addPage(page);
            Bitmap bitmap = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(0xff336699);
            PDImageXObject image = JPEGFactory.createFromImage(document, bitmap, 0.92f);
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                stream.beginText();
                stream.setFont(PDType1Font.HELVETICA, 14);
                stream.newLineAtOffset(48, 720);
                stream.showText(label);
                stream.endText();
                stream.moveTo(48, 680);
                stream.lineTo(240, 680);
                stream.stroke();
                stream.drawImage(image, 48, 580, 32, 32);
            }
            addLink(page, "https://example.com/pdfbox-device");
            addFormWidget(document, page);
            addBookmark(document, page, label);
            addPageLabels(document);
            document.save(file);
            bitmap.recycle();
        }
        return file;
    }

    private static File createNumberedPdf(File file, int count) throws Exception {
        try (PDDocument document = new PDDocument()) {
            for (int index = 0; index < count; index++) {
                PDPage page = new PDPage(index % 2 == 0 ? PDRectangle.A4 : landscapeA4());
                page.setRotation(index % 4 == 0 ? 0 : 90);
                document.addPage(page);
                try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                    stream.beginText();
                    stream.setFont(PDType1Font.HELVETICA, 12);
                    stream.newLineAtOffset(36, 36);
                    stream.showText("page-" + (index + 1));
                    stream.endText();
                }
            }
            document.save(file);
        }
        return file;
    }

    private static File createLargePdf(File file, int count) throws Exception {
        try (PDDocument document = new PDDocument()) {
            for (int index = 0; index < count; index++) {
                PDPage page = new PDPage(PDRectangle.A4);
                document.addPage(page);
                Bitmap bitmap = Bitmap.createBitmap(256, 256, Bitmap.Config.ARGB_8888);
                bitmap.eraseColor(0xff000000 | ((index * 7919) & 0x00ffffff));
                PDImageXObject image = JPEGFactory.createFromImage(document, bitmap, 0.92f);
                try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                    stream.beginText();
                    stream.setFont(PDType1Font.HELVETICA, 12);
                    stream.newLineAtOffset(36, 36);
                    stream.showText("large-page-" + (index + 1));
                    stream.endText();
                    stream.drawImage(image, 72, 420, 256, 256);
                }
                bitmap.recycle();
            }
            document.save(file);
        }
        return file;
    }

    private static File createEncryptedPdf(File file) throws Exception {
        try (PDDocument document = new PDDocument()) {
            document.addPage(new PDPage(PDRectangle.A4));
            AccessPermission permissions = new AccessPermission();
            StandardProtectionPolicy policy = new StandardProtectionPolicy(PASSWORD, PASSWORD, permissions);
            policy.setEncryptionKeyLength(128);
            document.protect(policy);
            document.save(file);
        }
        return file;
    }

    private static File createSignatureFieldPdf(File file) throws Exception {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDAcroForm form = new PDAcroForm(document);
            configureForm(form);
            PDSignatureField field = new PDSignatureField(form);
            field.setPartialName("signature-field");
            PDSignature signature = new PDSignature();
            signature.setFilter(COSName.getPDFName("Adobe.PPKLite"));
            signature.setSubFilter(COSName.getPDFName("adbe.pkcs7.detached"));
            field.setValue(signature);
            form.getFields().add(field);
            PDAnnotationWidget widget = field.getWidgets().get(0);
            widget.setRectangle(new PDRectangle(48, 640, 240, 48));
            widget.setPage(page);
            page.getAnnotations().add(widget);
            document.getDocumentCatalog().setAcroForm(form);
            document.save(file);
        }
        return file;
    }

    private static void addLink(PDPage page, String uri) throws IOException {
        PDAnnotationLink link = new PDAnnotationLink();
        link.setRectangle(new PDRectangle(48, 700, 180, 24));
        PDActionURI action = new PDActionURI();
        action.setURI(uri);
        link.setAction(action);
        page.getAnnotations().add(link);
    }

    private static void addInternalLink(PDPage page, PDPage target) throws IOException {
        PDAnnotationLink link = new PDAnnotationLink();
        link.setRectangle(new PDRectangle(48, 700, 180, 24));
        PDPageFitDestination destination = new PDPageFitDestination();
        destination.setPage(target);
        link.setDestination(destination);
        page.getAnnotations().add(link);
    }

    private static void addFormWidget(PDDocument document, PDPage page) throws IOException {
        PDAcroForm form = document.getDocumentCatalog().getAcroForm();
        if (form == null) {
            form = new PDAcroForm(document);
            document.getDocumentCatalog().setAcroForm(form);
            configureForm(form);
        }
        PDTextField field = new PDTextField(form);
        field.setPartialName("text-field");
        field.setValue("device-test");
        form.getFields().add(field);
        PDAnnotationWidget widget = field.getWidgets().get(0);
        widget.setRectangle(new PDRectangle(48, 500, 240, 32));
        widget.setPage(page);
        page.getAnnotations().add(widget);
    }

    private static void configureForm(PDAcroForm form) {
        PDResources resources = new PDResources();
        resources.put(COSName.getPDFName("Helv"), PDType1Font.HELVETICA);
        form.setDefaultResources(resources);
        form.setDefaultAppearance("/Helv 10 Tf 0 g");
    }

    private static void addBookmark(PDDocument document, PDPage page, String title) {
        PDDocumentOutline outline = new PDDocumentOutline();
        PDOutlineItem item = new PDOutlineItem();
        item.setTitle(title);
        PDPageFitDestination destination = new PDPageFitDestination();
        destination.setPage(page);
        item.setDestination(destination);
        outline.addLast(item);
        document.getDocumentCatalog().setDocumentOutline(outline);
    }

    private static void addPageLabels(PDDocument document) {
        PDPageLabels labels = new PDPageLabels(document);
        PDPageLabelRange range = new PDPageLabelRange();
        range.setStyle(PDPageLabelRange.STYLE_ROMAN_UPPER);
        labels.setLabelItem(0, range);
        document.getDocumentCatalog().setPageLabels(labels);
    }

    private static void assertReopenedPart(File file, int pages, String firstText, String lastText) throws Exception {
        try (PDDocument document = PDDocument.load(file)) {
            assertEquals(pages, document.getNumberOfPages());
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.contains(firstText));
            assertTrue(text.contains(lastText));
            renderAndAssert(document, 0, file.getName() + "-first");
            renderAndAssert(document, pages - 1, file.getName() + "-last");
        }
    }

    private static void assertPageProperties(File sourceFile, PDPage resultPage) throws Exception {
        try (PDDocument source = PDDocument.load(sourceFile)) {
            PDPage sourcePage = source.getPage(0);
            assertEquals(sourcePage.getMediaBox().getWidth(), resultPage.getMediaBox().getWidth(), 0.01f);
            assertEquals(sourcePage.getMediaBox().getHeight(), resultPage.getMediaBox().getHeight(), 0.01f);
            assertEquals(sourcePage.getRotation(), resultPage.getRotation());
        }
    }

    private static void renderAndAssert(PDDocument document, int index, String label) throws IOException {
        Bitmap bitmap = new PDFRenderer(document).renderImage(index, 0.5f, ImageType.RGB);
        assertNotNull(bitmap);
        assertTrue(bitmap.getWidth() > 0);
        assertTrue(bitmap.getHeight() > 0);
        Log.i(TAG, "render label=" + label + " width=" + bitmap.getWidth() + " height=" + bitmap.getHeight());
        bitmap.recycle();
    }

    private static void renderFilePage(File file, int index, String label) throws Exception {
        try (PDDocument document = PDDocument.load(file)) {
            renderAndAssert(document, index, label);
        }
    }

    private static File testDirectory(String name) {
        File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getCacheDir(), "pdfbox-import-device/" + name);
        deleteRecursively(directory);
        assertTrue(directory.mkdirs() || directory.isDirectory());
        return directory;
    }

    private static void deleteRecursively(File file) {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursively(child);
        }
        assertTrue(file.delete() || !file.exists());
    }

    private static PDRectangle landscapeA4() {
        return new PDRectangle(PDRectangle.A4.getHeight(), PDRectangle.A4.getWidth());
    }

    private static void logMetric(String operation, long started, long bytes, int pages) {
        Log.i(TAG, operation + " pages=" + pages + " bytes=" + bytes + " duration_ms=" + elapsedMillis(started));
    }

    private static long elapsedMillis(long started) {
        return (System.nanoTime() - started) / 1_000_000L;
    }
}
