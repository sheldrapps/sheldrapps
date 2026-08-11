package com.sheldrapps.plugins.pdfrewrite;

import com.tom_roush.pdfbox.pdmodel.PDDocument;
import com.tom_roush.pdfbox.pdmodel.PDPage;
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDAction;
import com.tom_roush.pdfbox.pdmodel.interactive.action.PDActionGoTo;
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotation;
import com.tom_roush.pdfbox.pdmodel.interactive.annotation.PDAnnotationLink;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDDestination;
import com.tom_roush.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageDestination;
import com.tom_roush.pdfbox.cos.COSName;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class PdfSplitOperation {
    private final PdfPageCopier copier = new PdfPageCopier();
    private final PdfBookmarkManager bookmarks = new PdfBookmarkManager();
    private final PdfPageLabelManager labels = new PdfPageLabelManager();
    private final PdfCoverWriter cover = new PdfCoverWriter();
    private final PdfValidator validator = new PdfValidator();
    public Result execute(File sourceFile, List<Plan> plans, File coverImage, float coverQuality, File directory, PdfProgress progress) throws Exception {
        if (plans.size() < 2) throw new PdfOperationException("SPLIT_REQUIRES_TWO_OUTPUTS", "split");
        PdfResourceBudget.requireInput(sourceFile, "split");
        List<File> outputs = new ArrayList<>(); List<String> warnings = new ArrayList<>();
        try (PDDocument source = PDDocument.load(sourceFile, PdfMemoryPolicy.forFile(sourceFile))) {
            if (source.getDocumentCatalog().getAcroForm() != null) warnings.add("ACROFORM_NOT_RECONSTRUCTED");
            if (source.getSignatureDictionaries().size() > 0) warnings.add("SIGNATURES_INVALIDATED_BY_REWRITE");
            if (labels.hasLabels(source)) warnings.add("PAGE_LABELS_REQUIRE_MANUAL_REBUILD");
            int complete=0;
            for (Plan plan : plans) {
                progress.checkCancelled(); File output = new File(directory, plan.name);
                try (PDDocument target = new PDDocument()) {
                    if (coverImage != null) cover.prependImageCover(target, coverImage, coverQuality);
                    int offset=target.getNumberOfPages();
                    Map<Integer, Integer> sourceToOutput = new HashMap<>();
                    Map<Integer, Integer> outputToSource = new HashMap<>();
                    for (Range range : plan.ranges) {
                        if (range.from < 0 || range.to < range.from || range.to >= source.getNumberOfPages()) throw new PdfOperationException("INVALID_PAGE_RANGE", "split");
                        copier.copy(source,target,range.from,range.to,complete,new SplitProgress(progress,plans.size()));
                        for (int sourceIndex = range.from; sourceIndex <= range.to; sourceIndex++) {
                            sourceToOutput.put(sourceIndex, offset + sourceIndex - range.from);
                            outputToSource.put(offset + sourceIndex - range.from, sourceIndex);
                        }
                        bookmarks.copyOriginalTopLevel(source,target,offset,range.from,range.to);
                        offset += range.to-range.from+1;
                    }
                    rewriteInternalLinks(source, target, sourceToOutput, outputToSource, warnings);
                    if (target.getNumberOfPages() <= (coverImage == null ? 0 : 1)) throw new PdfOperationException("EMPTY_SPLIT_OUTPUT", "split");
                    target.save(output);
                }
                validator.validate(output); outputs.add(output); complete++; progress.emit("validate-output",complete,plans.size());
            }
        } catch (Exception failure) { for (File output:outputs) output.delete(); throw failure; }
        return new Result(outputs,warnings);
    }

    /**
     * importPage retains annotation appearance, but a GoTo destination can still reference
     * a source-page COS object. Rebind only destinations we can prove belong to this part.
     */
    private void rewriteInternalLinks(
        PDDocument source,
        PDDocument target,
        Map<Integer, Integer> sourceToOutput,
        Map<Integer, Integer> outputToSource,
        List<String> warnings
    ) throws Exception {
        Map<Object, Integer> sourcePages = new HashMap<>();
        for (int index = 0; index < source.getNumberOfPages(); index++) sourcePages.put(source.getPage(index).getCOSObject(), index);
        for (int pageIndex = 0; pageIndex < target.getNumberOfPages(); pageIndex++) {
            Integer originalPageIndex = outputToSource.get(pageIndex);
            List<PDAnnotation> targetAnnotations = target.getPage(pageIndex).getAnnotations();
            List<PDAnnotation> sourceAnnotations = originalPageIndex == null ? null : source.getPage(originalPageIndex).getAnnotations();
            for (int annotationIndex = 0; annotationIndex < targetAnnotations.size(); annotationIndex++) {
                PDAnnotation annotation = targetAnnotations.get(annotationIndex);
                if (!(annotation instanceof PDAnnotationLink)) continue;
                PDAnnotationLink link = (PDAnnotationLink) annotation;
                PDAnnotationLink originalLink = sourceAnnotations != null && annotationIndex < sourceAnnotations.size() && sourceAnnotations.get(annotationIndex) instanceof PDAnnotationLink
                    ? (PDAnnotationLink) sourceAnnotations.get(annotationIndex) : link;
                PDDestination destination = originalLink.getDestination();
                PDAction action = originalLink.getAction();
                if (action instanceof PDActionGoTo) destination = ((PDActionGoTo) action).getDestination();
                if (!(destination instanceof PDPageDestination)) {
                    if (action instanceof PDActionGoTo) removeInternalTarget(link, warnings);
                    continue;
                }
                PDPageDestination pageDestination = (PDPageDestination) destination;
                Integer sourceIndex = null;
                PDPage sourcePage = pageDestination.getPage();
                if (sourcePage != null) sourceIndex = sourcePages.get(sourcePage.getCOSObject());
                if (sourceIndex == null) {
                    int numbered = pageDestination.retrievePageNumber();
                    if (numbered >= 0 && numbered < source.getNumberOfPages()) sourceIndex = numbered;
                }
                Integer outputIndex = sourceIndex == null ? null : sourceToOutput.get(sourceIndex);
                if (outputIndex == null) {
                    removeInternalTarget(link, warnings);
                } else {
                    pageDestination.setPage(target.getPage(outputIndex));
                    if (link.getAction() instanceof PDActionGoTo) ((PDActionGoTo) link.getAction()).setDestination(pageDestination);
                    else link.setDestination(pageDestination);
                }
            }
        }
    }

    private void removeInternalTarget(PDAnnotationLink link, List<String> warnings) {
        // Leave the rectangle, border and appearance stream untouched; only disable navigation.
        link.getCOSObject().removeItem(COSName.DEST);
        link.getCOSObject().removeItem(COSName.A);
        if (!warnings.contains("INTERNAL_LINK_TARGET_REMOVED")) warnings.add("INTERNAL_LINK_TARGET_REMOVED");
    }
    private static final class SplitProgress implements PdfProgress { private final PdfProgress delegate; private final int total; SplitProgress(PdfProgress d,int t){delegate=d;total=t;} public void emit(String phase,int c,int ignored){delegate.emit(phase,c,total);} public void checkCancelled() throws PdfOperationException {delegate.checkCancelled();} }
    public static final class Range { public final int from,to; public Range(int from,int to){this.from=from;this.to=to;} }
    public static final class Plan { public final String name; public final List<Range> ranges; public Plan(String name,List<Range> ranges){this.name=name;this.ranges=ranges;} }
    public static final class Result { public final List<File> files; public final List<String> warnings; Result(List<File> files,List<String>warnings){this.files=files;this.warnings=warnings;} }
}
