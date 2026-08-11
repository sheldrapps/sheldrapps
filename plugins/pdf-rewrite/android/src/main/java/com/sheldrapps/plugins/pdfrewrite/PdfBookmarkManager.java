package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageFitDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDDocumentOutline;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.outline.PDOutlineItem;

/** Rebuilds navigable top-level bookmarks; unsupported actions are reported by caller as warnings. */
public final class PdfBookmarkManager {
    public void addDocumentBookmark(PDDocument target, String title, int pageIndex) {
        PDDocumentOutline outline = target.getDocumentCatalog().getDocumentOutline();
        if (outline == null) { outline = new PDDocumentOutline(); target.getDocumentCatalog().setDocumentOutline(outline); }
        PDOutlineItem item = item(target, title, pageIndex);
        outline.addLast(item);
        outline.openNode();
    }
    public void copyOriginalTopLevel(PDDocument source, PDDocument target, int offset, int allowedFrom, int allowedTo) {
        PDDocumentOutline sourceOutline = source.getDocumentCatalog().getDocumentOutline();
        if (sourceOutline == null) return;
        PDDocumentOutline targetOutline = target.getDocumentCatalog().getDocumentOutline();
        if (targetOutline == null) { targetOutline = new PDDocumentOutline(); target.getDocumentCatalog().setDocumentOutline(targetOutline); }
        PDOutlineItem sourceItem = sourceOutline.getFirstChild();
        while (sourceItem != null) {
            try {
                int sourcePage = pageIndex(source, sourceItem.findDestinationPage(source));
                if (sourcePage >= allowedFrom && sourcePage <= allowedTo) targetOutline.addLast(item(target, sourceItem.getTitle(), offset + sourcePage - allowedFrom));
            } catch (Exception ignored) { }
            sourceItem = sourceItem.getNextSibling();
        }
        targetOutline.openNode();
    }
    private int pageIndex(PDDocument document, com.tom_roush.pdfbox.pdmodel.PDPage wanted) {
        for (int index = 0; index < document.getNumberOfPages(); index++) if (document.getPage(index) == wanted) return index;
        return -1;
    }
    private PDOutlineItem item(PDDocument document, String title, int pageIndex) {
        PDOutlineItem item = new PDOutlineItem();
        item.setTitle(title == null || title.trim().isEmpty() ? "Document" : title);
        PDPageFitDestination destination = new PDPageFitDestination();
        destination.setPage(document.getPage(Math.max(0, Math.min(pageIndex, document.getNumberOfPages() - 1))));
        item.setDestination(destination);
        return item;
    }
}
