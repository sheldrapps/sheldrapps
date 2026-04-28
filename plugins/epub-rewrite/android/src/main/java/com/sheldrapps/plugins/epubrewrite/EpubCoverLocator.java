package com.sheldrapps.plugins.epubrewrite;

import net.lingala.zip4j.ZipFile;
import net.lingala.zip4j.model.FileHeader;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

final class EpubCoverLocator {
    String findCoverEntryPath(ZipFile zipFile, List<FileHeader> headers) throws IOException {
        String opfPath = resolveOpfPath(zipFile, headers);
        if (opfPath != null) {
            String opfCoverPath = findCoverPathFromOpf(zipFile, headers, opfPath);
            if (opfCoverPath != null) {
                return opfCoverPath;
            }
        }

        for (String commonPath : new String[] {
            "OEBPS/cover.jpg",
            "OEBPS/cover.jpeg",
            "OEBPS/cover.png",
            "OEBPS/cover.webp",
            "cover.jpg",
            "cover.jpeg",
            "cover.png",
            "cover.webp"
        }) {
            if (findHeader(headers, commonPath) != null) {
                return commonPath;
            }
        }

        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }

            String lower = normalizeZipPath(header.getFileName()).toLowerCase(Locale.US);
            if (isImagePath(lower) && lower.contains("cover")) {
                return normalizeZipPath(header.getFileName());
            }
        }

        for (FileHeader header : headers) {
            if (header == null || header.isDirectory()) {
                continue;
            }

            String lower = normalizeZipPath(header.getFileName()).toLowerCase(Locale.US);
            if (isImagePath(lower)) {
                return normalizeZipPath(header.getFileName());
            }
        }

        return null;
    }

    private String resolveOpfPath(ZipFile zipFile, List<FileHeader> headers) throws IOException {
        FileHeader containerHeader = findHeader(headers, "META-INF/container.xml");
        if (containerHeader == null) {
            return null;
        }

        Document containerDocument = readEntryXml(zipFile, containerHeader);
        Element rootfile = firstElementByName(containerDocument, "rootfile");
        if (rootfile == null) {
            return null;
        }

        String opfPath = normalizeZipPath(rootfile.getAttribute("full-path"));
        if (opfPath.isBlank()) {
            return null;
        }
        return findHeader(headers, opfPath) == null ? null : opfPath;
    }

    private String findCoverPathFromOpf(ZipFile zipFile, List<FileHeader> headers, String opfPath)
        throws IOException {
        FileHeader opfHeader = findHeader(headers, opfPath);
        if (opfHeader == null) {
            return null;
        }

        Document opfDocument = readEntryXml(zipFile, opfHeader);
        String coverHref = coverHrefFromProperty(opfDocument);
        if (coverHref == null) {
            coverHref = coverHrefFromMetaCover(opfDocument);
        }
        if (coverHref == null) {
            coverHref = coverHrefFromImageFallback(opfDocument);
        }
        if (coverHref == null) {
            return null;
        }

        String opfDir = "";
        int slashIndex = opfPath.lastIndexOf('/');
        if (slashIndex >= 0) {
            opfDir = opfPath.substring(0, slashIndex);
        }

        String resolved = resolveRelativePath(opfDir, coverHref);
        return findHeader(headers, resolved) == null ? null : resolved;
    }

    private String coverHrefFromProperty(Document opfDocument) {
        for (Element item : elementsByName(opfDocument, "item")) {
            String properties = item.getAttribute("properties");
            if (properties == null || properties.isBlank()) {
                continue;
            }
            for (String property : properties.toLowerCase(Locale.US).split("\\s+")) {
                if ("cover-image".equals(property.trim())) {
                    String href = item.getAttribute("href");
                    if (href != null && !href.isBlank()) {
                        return href;
                    }
                }
            }
        }
        return null;
    }

    private String coverHrefFromMetaCover(Document opfDocument) {
        String coverId = null;
        for (Element meta : elementsByName(opfDocument, "meta")) {
            String metaName = meta.getAttribute("name");
            if ("cover".equalsIgnoreCase(metaName)) {
                String content = meta.getAttribute("content");
                if (content != null && !content.isBlank()) {
                    coverId = content;
                    break;
                }
            }
        }
        if (coverId == null) {
            return null;
        }

        for (Element item : elementsByName(opfDocument, "item")) {
            if (coverId.equals(item.getAttribute("id"))) {
                String href = item.getAttribute("href");
                if (href != null && !href.isBlank()) {
                    return href;
                }
                break;
            }
        }
        return null;
    }

    private String coverHrefFromImageFallback(Document opfDocument) {
        for (Element item : elementsByName(opfDocument, "item")) {
            String href = item.getAttribute("href");
            String mediaType = item.getAttribute("media-type");
            if (href == null || href.isBlank() || mediaType == null || mediaType.isBlank()) {
                continue;
            }
            if (mediaType.toLowerCase(Locale.US).startsWith("image/")
                && href.toLowerCase(Locale.US).contains("cover")) {
                return href;
            }
        }
        return null;
    }

    private Document readEntryXml(ZipFile zipFile, FileHeader header) throws IOException {
        try (InputStream inputStream = new BufferedInputStream(zipFile.getInputStream(header))) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            configureSecureXmlFactory(factory);
            Document document = factory.newDocumentBuilder().parse(inputStream);
            document.getDocumentElement().normalize();
            return document;
        } catch (ParserConfigurationException | SAXException ex) {
            throw new IOException("Unable to parse XML entry: " + header.getFileName(), ex);
        }
    }

    private void configureSecureXmlFactory(DocumentBuilderFactory factory)
        throws ParserConfigurationException {
        safeSetFeature(factory, XMLConstants.FEATURE_SECURE_PROCESSING, true);
        safeSetFeature(factory, "http://apache.org/xml/features/disallow-doctype-decl", true);
        safeSetFeature(factory, "http://xml.org/sax/features/external-general-entities", false);
        safeSetFeature(factory, "http://xml.org/sax/features/external-parameter-entities", false);
        safeSetAttribute(factory, "http://javax.xml.XMLConstants/property/accessExternalDTD", "");
        safeSetAttribute(factory, "http://javax.xml.XMLConstants/property/accessExternalSchema", "");
        factory.setExpandEntityReferences(false);
        factory.setXIncludeAware(false);
    }

    private void safeSetFeature(DocumentBuilderFactory factory, String name, boolean value)
        throws ParserConfigurationException {
        try {
            factory.setFeature(name, value);
        } catch (ParserConfigurationException ex) {
            throw ex;
        } catch (Exception ignored) {
            // Best effort: some Android XML implementations do not expose every feature.
        }
    }

    private void safeSetAttribute(DocumentBuilderFactory factory, String name, String value) {
        try {
            factory.setAttribute(name, value);
        } catch (Exception ignored) {
            // Best effort: some Android XML implementations do not expose every attribute.
        }
    }

    private Element firstElementByName(Document document, String localName) {
        List<Element> elements = elementsByName(document, localName);
        return elements.isEmpty() ? null : elements.get(0);
    }

    private List<Element> elementsByName(Document document, String localName) {
        NodeList wildcardMatches = document.getElementsByTagNameNS("*", localName);
        if (wildcardMatches.getLength() > 0) {
            return toElementList(wildcardMatches);
        }
        return toElementList(document.getElementsByTagName(localName));
    }

    private List<Element> toElementList(NodeList nodeList) {
        List<Element> elements = new ArrayList<>();
        for (int index = 0; index < nodeList.getLength(); index++) {
            Node node = nodeList.item(index);
            if (node instanceof Element) {
                elements.add((Element) node);
            }
        }
        return elements;
    }

    private FileHeader findHeader(List<FileHeader> headers, String fileName) {
        if (headers == null || fileName == null) {
            return null;
        }

        String normalized = normalizeZipPath(fileName);
        for (FileHeader header : headers) {
            if (header == null) {
                continue;
            }
            if (normalized.equals(normalizeZipPath(header.getFileName()))) {
                return header;
            }
        }
        return null;
    }

    private String resolveRelativePath(String baseDir, String href) {
        String normalizedHref = normalizeZipPath(href);
        if (normalizedHref.matches("^[a-zA-Z]+://.*$")) {
            return normalizedHref;
        }

        String merged = baseDir == null || baseDir.isBlank()
            ? normalizedHref
            : baseDir + "/" + normalizedHref;

        String[] parts = merged.split("/");
        StringBuilder out = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.isBlank() || ".".equals(part)) {
                continue;
            }
            if ("..".equals(part)) {
                int lastSlash = out.lastIndexOf("/");
                if (lastSlash >= 0) {
                    out.delete(lastSlash, out.length());
                } else {
                    out.setLength(0);
                }
                continue;
            }
            if (!out.isEmpty()) {
                out.append('/');
            }
            out.append(part);
        }
        return out.toString();
    }

    private boolean isImagePath(String path) {
        return path.endsWith(".jpg")
            || path.endsWith(".jpeg")
            || path.endsWith(".png")
            || path.endsWith(".webp");
    }

    private String normalizeZipPath(String path) {
        return path == null ? "" : path.replace('\\', '/');
    }
}
