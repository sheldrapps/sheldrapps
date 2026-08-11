package com.sheldrapps.plugins.pdfrewrite;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.tom_roush.pdfbox.cos.COSDictionary;
import com.tom_roush.pdfbox.cos.COSName;
import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDDocumentInformation;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.common.PDRectangle;
import com.tom_roush.pdfbox.pdmodel.encryption.AccessPermission;
import com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;
import java.io.File;

public final class PdfDocumentInspector {
    public JSObject analyze(File file) throws Exception {
        JSObject result = new JSObject(); JSArray warnings = new JSArray();
        try (PDDocument document = PDDocument.load(file, PdfMemoryPolicy.forFile(file))) {
            result.put("valid", true); result.put("pageCount", document.getNumberOfPages()); result.put("encrypted", document.isEncrypted());
            result.put("fileSizeBytes", file.length());
            PDDocumentInformation info = document.getDocumentInformation();
            JSObject metadata = new JSObject(); metadata.put("title", info.getTitle()); metadata.put("author", info.getAuthor()); metadata.put("subject", info.getSubject()); metadata.put("keywords", info.getKeywords()); result.put("metadata", metadata);
            JSArray pages = new JSArray();
            for (int index=0; index<document.getNumberOfPages(); index++) { PDPage page=document.getPage(index); PDRectangle box=page.getCropBox()==null?page.getMediaBox():page.getCropBox(); JSObject p=new JSObject(); p.put("pageIndex", index); p.put("widthPoints", box.getWidth()); p.put("heightPoints", box.getHeight()); p.put("rotation", page.getRotation()); pages.put(p); }
            result.put("pages", pages);
            result.put("bookmarks", readBookmarks(document));
            result.put("pageLabels", document.getDocumentCatalog().getCOSObject().getDictionaryObject(COSName.PAGE_LABELS) != null);
            result.put("hasAcroForm", document.getDocumentCatalog().getAcroForm() != null);
            COSDictionary catalog = document.getDocumentCatalog().getCOSObject();
            result.put("hasSignatures", catalog.getDictionaryObject(COSName.ACRO_FORM) != null && document.getSignatureDictionaries().size() > 0);
            result.put("hasAttachments", catalog.getDictionaryObject(COSName.NAMES) != null);
            AccessPermission permissions = document.getCurrentAccessPermission(); JSObject rights = new JSObject(); rights.put("canPrint", permissions.canPrint()); rights.put("canModify", permissions.canModify()); rights.put("canExtract", permissions.canExtractContent()); result.put("permissions", rights);
            if (document.getDocumentCatalog().getAcroForm() != null) warnings.put("ACROFORM_NOT_RECONSTRUCTED");
            if (document.getSignatureDictionaries().size() > 0) warnings.put("SIGNATURES_INVALIDATED_BY_REWRITE");
            result.put("warnings", warnings);
            return result;
        } catch (InvalidPasswordException error) { throw new PdfOperationException("PDF_PASSWORD_REQUIRED", "analyze", error); }
    }

    private JSArray readBookmarks(PDDocument document) {
        JSArray bookmarks = new JSArray();
        PDDocumentOutline outline = document.getDocumentCatalog().getDocumentOutline();
        if (outline == null) return bookmarks;
        PDOutlineItem item = outline.getFirstChild();
        int index = 0;
        while (item != null) {
            bookmarks.put(readBookmark(document, item, "bookmark-" + index));
            item = item.getNextSibling();
            index++;
        }
        return bookmarks;
    }

    private JSObject readBookmark(PDDocument document, PDOutlineItem item, String id) {
        JSObject bookmark = new JSObject();
        bookmark.put("id", id);
        bookmark.put("title", item.getTitle() == null ? "" : item.getTitle());
        try {
            PDPage destination = item.findDestinationPage(document);
            int pageIndex = pageIndex(document, destination);
            if (pageIndex >= 0) bookmark.put("destinationPageIndex", pageIndex);
        } catch (Exception ignored) {
        }

        JSArray children = new JSArray();
        PDOutlineItem child = item.getFirstChild();
        int childIndex = 0;
        while (child != null) {
            children.put(readBookmark(document, child, id + "-" + childIndex));
            child = child.getNextSibling();
            childIndex++;
        }
        bookmark.put("children", children);
        return bookmark;
    }

    private int pageIndex(PDDocument document, PDPage wanted) {
        if (wanted == null) return -1;
        for (int index = 0; index < document.getNumberOfPages(); index++) {
            if (document.getPage(index) == wanted) return index;
        }
        return -1;
    }
}
