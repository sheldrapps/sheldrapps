package com.sheldrapps.plugins.epubrewrite;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.zip.ZipEntry;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipFile;
import org.json.JSONArray;
import org.json.JSONObject;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

final class SelectiveEpubMetadataIo {
    private static final String DC_NAMESPACE = "http://purl.org/dc/elements/1.1/";
    private static final String OPF_NAMESPACE = "http://www.idpf.org/2007/opf";
    private static final String EPUB_MIMETYPE = "application/epub+zip";
    private static final String DCTERMS_MODIFIED = "dcterms:modified";
    private static final long MAX_XML_BYTES = 16L * 1024L * 1024L;
    private static final String[] DC_FIELDS = {
        "title", "creator", "language", "identifier", "publisher", "date",
        "description", "subject", "contributor", "type", "format", "source",
        "relation", "coverage", "rights"
    };

    private SelectiveEpubMetadataIo() {}

    static JSObject read(Path inputPath, BooleanSupplier cancelled) throws Exception {
        try (ArchiveContext context = ArchiveContext.open(inputPath)) {
            checkCancelled(cancelled);
            Document opf = parseXml(readEntryBytes(context.zip, context.opfEntry));
            Element packageElement = firstElement(opf, "package");
            Element metadataElement = firstElement(packageElement, "metadata");
            if (packageElement == null || metadataElement == null) {
                throw new IOException("EPUB package metadata is missing");
            }
            return toResult(packageElement, metadataElement, opf);
        }
    }

    static void rewrite(
        Path inputPath,
        Path outputPath,
        JSObject rawMetadata,
        BooleanSupplier cancelled
    ) throws Exception {
        Path source = inputPath.toAbsolutePath().normalize();
        Path target = outputPath == null
            ? source
            : outputPath.toAbsolutePath().normalize();
        Path temporary = target.resolveSibling(
            target.getFileName() + ".metadata-" + UUID.randomUUID() + ".tmp"
        );

        try {
            writeArchive(source, temporary, rawMetadata, cancelled);
            validateArchive(temporary);
            moveReplace(temporary, target);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private static void writeArchive(
        Path sourcePath,
        Path outputPath,
        JSObject rawMetadata,
        BooleanSupplier cancelled
    ) throws Exception {
        Files.createDirectories(outputPath.toAbsolutePath().normalize().getParent());
        try (ArchiveContext context = ArchiveContext.open(sourcePath)) {
            checkCancelled(cancelled);
            Document opf = parseXml(readEntryBytes(context.zip, context.opfEntry));
            Element packageElement = firstElement(opf, "package");
            Element metadataElement = firstElement(packageElement, "metadata");
            if (packageElement == null || metadataElement == null) {
                throw new IOException("EPUB package metadata is missing");
            }

            JSObject metadata = rawMetadata;
            updateMetadata(packageElement, metadataElement, opf, metadata);
            byte[] updatedOpf = serializeXml(opf);
            ZipArchiveEntry mimetype = context.entries.get("mimetype");
            if (mimetype == null || mimetype.getMethod() != ZipEntry.STORED) {
                throw new IOException("EPUB mimetype must be the stored first entry");
            }

            try (StreamingEpubArchiveWriter writer =
                new StreamingEpubArchiveWriter(outputPath)) {
                writer.writeRaw(context.zip, mimetype, "mimetype");
                for (ZipArchiveEntry entry : context.orderedEntries) {
                    checkCancelled(cancelled);
                    String name = normalizePath(entry.getName());
                    if (name.equals("mimetype") || entry.isDirectory()) {
                        continue;
                    }
                    if (name.equals(context.opfPath)) {
                        writer.writeDeflatedBytes(name, updatedOpf);
                    } else {
                        writer.writeRaw(context.zip, entry, name);
                    }
                }
            }
        }
    }

    private static void updateMetadata(
        Element packageElement,
        Element metadataElement,
        Document document,
        JSObject metadata
    ) throws Exception {
        Element existingIdentifier = findIdentifier(packageElement, metadataElement);
        String identifierId = value(existingIdentifier, "id");
        if (identifierId.isEmpty()) {
            identifierId = value(packageElement, "unique-identifier");
        }
        if (identifierId.isEmpty()) {
            identifierId = "book-id";
        }

        List<String> creatorIds = childElements(metadataElement, "creator").stream()
            .map(element -> value(element, "id"))
            .filter(value -> !value.isEmpty())
            .collect(java.util.stream.Collectors.toList());
        List<String> contributorIds = childElements(metadataElement, "contributor").stream()
            .map(element -> value(element, "id"))
            .filter(value -> !value.isEmpty())
            .collect(java.util.stream.Collectors.toList());

        removeManagedMetadata(metadataElement, document, creatorIds, contributorIds, identifierId);
        packageElement.setAttribute("unique-identifier", identifierId);

        appendDc(document, metadataElement, "title", metadata.getString("title", ""), null);
        appendPeople(document, metadataElement, "creator", people(metadata.optJSONArray("creators")), creatorIds,
            packageVersion(packageElement));
        appendDc(document, metadataElement, "language", metadata.getString("language", ""), null);
        JSONObject identifier = metadata.optJSONObject("identifier");
        appendIdentifier(document, metadataElement, identifier, identifierId);
        appendOptionalDc(document, metadataElement, "publisher", metadata, "publisher");
        appendOptionalDc(document, metadataElement, "date", metadata, "date");
        appendOptionalDc(document, metadataElement, "description", metadata, "description");
        JSONArray subjects = metadata.optJSONArray("subjects");
        if (subjects != null) {
            for (int index = 0; index < subjects.length(); index++) {
                appendDc(document, metadataElement, "subject", subjects.optString(index, ""), null);
            }
        }
        appendPeople(document, metadataElement, "contributor", people(metadata.optJSONArray("contributors")),
            contributorIds, packageVersion(packageElement));
        appendOptionalDc(document, metadataElement, "type", metadata, "type");
        appendOptionalDc(document, metadataElement, "format", metadata, "format");
        appendOptionalDc(document, metadataElement, "source", metadata, "source");
        appendOptionalDc(document, metadataElement, "relation", metadata, "relation");
        appendOptionalDc(document, metadataElement, "coverage", metadata, "coverage");
        appendOptionalDc(document, metadataElement, "rights", metadata, "rights");
        if (packageVersion(packageElement) == PackageVersion.EPUB3) {
            appendMeta(document, metadataElement, DCTERMS_MODIFIED, java.time.Instant.now().toString(), null, null);
        }
    }

    private static void appendOptionalDc(
        Document document,
        Element metadataElement,
        String field,
        JSObject metadata,
        String key
    ) {
        appendDc(document, metadataElement, field, metadata.getString(key, ""), null);
    }

    private static void appendIdentifier(
        Document document,
        Element metadataElement,
        JSONObject identifier,
        String id
    ) {
        if (identifier == null) {
            return;
        }
        Element element = appendDc(document, metadataElement, "identifier", identifier.optString("value", ""), id);
        if (element != null && !identifier.optString("scheme", "").trim().isEmpty()) {
            element.setAttribute("scheme", identifier.optString("scheme").trim());
        }
    }

    private static void appendPeople(
        Document document,
        Element metadataElement,
        String field,
        List<Person> people,
        List<String> existingIds,
        PackageVersion version
    ) {
        for (int index = 0; index < people.size(); index++) {
            Person person = people.get(index);
            String id = index < existingIds.size() ? existingIds.get(index) : field + "-" + (index + 1);
            Element element = appendDc(document, metadataElement, field, person.name, id);
            if (element == null) {
                continue;
            }
            if (version == PackageVersion.EPUB2) {
                if (!person.role.isEmpty()) element.setAttribute("role", person.role);
                if (!person.fileAs.isEmpty()) element.setAttribute("file-as", person.fileAs);
            } else {
                appendMeta(document, metadataElement, "role", person.role, element, null);
                appendMeta(document, metadataElement, "file-as", person.fileAs, element, null);
            }
        }
    }

    private static Element appendDc(
        Document document,
        Element metadataElement,
        String field,
        String rawValue,
        String id
    ) {
        String normalized = rawValue == null ? "" : rawValue.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        Element element = document.createElementNS(DC_NAMESPACE, "dc:" + field);
        if (id != null && !id.trim().isEmpty()) {
            element.setAttribute("id", id);
        }
        element.setTextContent(normalized);
        metadataElement.appendChild(element);
        return element;
    }

    private static void appendMeta(
        Document document,
        Element metadataElement,
        String property,
        String rawValue,
        Element refines,
        String unused
    ) {
        String normalized = rawValue == null ? "" : rawValue.trim();
        if (normalized.isEmpty()) {
            return;
        }
        Element element = document.createElementNS(OPF_NAMESPACE, "meta");
        if (refines != null && !value(refines, "id").isEmpty()) {
            element.setAttribute("refines", "#" + value(refines, "id"));
        }
        element.setAttribute("property", property);
        element.setTextContent(normalized);
        metadataElement.appendChild(element);
    }

    private static void removeManagedMetadata(
        Element metadataElement,
        Document document,
        List<String> creatorIds,
        List<String> contributorIds,
        String identifierId
    ) {
        HashSet<String> ids = new HashSet<>();
        for (String id : creatorIds) ids.add("#" + id);
        for (String id : contributorIds) ids.add("#" + id);
        ids.add("#" + identifierId);

        List<Node> removals = new ArrayList<>();
        NodeList all = document.getElementsByTagName("*");
        for (int index = 0; index < all.getLength(); index++) {
            Node node = all.item(index);
            if (!(node instanceof Element)) continue;
            Element element = (Element) node;
            String localName = localName(element);
            if (node.getParentNode() == metadataElement
                && DC_FIELDS_SET.contains(localName)
                && DC_NAMESPACE.equals(element.getNamespaceURI())) {
                removals.add(node);
                continue;
            }
            if (!"meta".equals(localName)) continue;
            String refines = value(element, "refines");
            String property = value(element, "property");
            if (ids.contains(refines)
                || "role".equals(property)
                || "file-as".equals(property)
                || DCTERMS_MODIFIED.equals(property)) {
                removals.add(node);
            }
        }
        for (Node removal : removals) {
            Node parent = removal.getParentNode();
            if (parent != null) parent.removeChild(removal);
        }
    }

    private static final java.util.Set<String> DC_FIELDS_SET =
        new HashSet<>(java.util.Arrays.asList(DC_FIELDS));

    private static JSObject toResult(
        Element packageElement,
        Element metadataElement,
        Document document
    ) {
        String detectedVersion = value(packageElement, "version");
        if (detectedVersion.isEmpty()) detectedVersion = "3.0";
        PackageVersion version = detectedVersion.startsWith("2") ? PackageVersion.EPUB2 : PackageVersion.EPUB3;
        Element identifierElement = findIdentifier(packageElement, metadataElement);
        JSObject metadata = new JSObject();
        metadata.put("title", text(firstChild(metadataElement, "title")));
        metadata.put("creators", peopleArray(document, childElements(metadataElement, "creator")));
        metadata.put("language", text(firstChild(metadataElement, "language")));
        JSObject identifier = new JSObject();
        identifier.put("value", text(identifierElement));
        String scheme = value(identifierElement, "scheme");
        if (scheme.isEmpty()) scheme = refinement(document, identifierElement, "scheme");
        if (!scheme.isEmpty()) identifier.put("scheme", scheme);
        metadata.put("identifier", identifier);
        putOptional(metadata, "publisher", text(firstChild(metadataElement, "publisher")));
        putOptional(metadata, "date", text(firstChild(metadataElement, "date")));
        putOptional(metadata, "description", text(firstChild(metadataElement, "description")));
        JSArray subjects = new JSArray();
        for (Element subject : childElements(metadataElement, "subject")) {
            if (!text(subject).isEmpty()) subjects.put(text(subject));
        }
        metadata.put("subjects", subjects);
        metadata.put("contributors", peopleArray(document, childElements(metadataElement, "contributor")));
        putOptional(metadata, "type", text(firstChild(metadataElement, "type")));
        putOptional(metadata, "format", text(firstChild(metadataElement, "format")));
        putOptional(metadata, "source", text(firstChild(metadataElement, "source")));
        putOptional(metadata, "relation", text(firstChild(metadataElement, "relation")));
        putOptional(metadata, "coverage", text(firstChild(metadataElement, "coverage")));
        putOptional(metadata, "rights", text(firstChild(metadataElement, "rights")));

        JSObject result = new JSObject();
        result.put("version", version == PackageVersion.EPUB2 ? "epub2" : "epub3");
        result.put("detectedVersion", detectedVersion);
        result.put("metadata", metadata);
        return result;
    }

    private static JSArray peopleArray(Document document, List<Element> elements) {
        JSArray result = new JSArray();
        for (Element element : elements) {
            JSObject person = new JSObject();
            person.put("name", text(element));
            String role = value(element, "role");
            if (role.isEmpty()) role = refinement(document, element, "role");
            String fileAs = value(element, "file-as");
            if (fileAs.isEmpty()) fileAs = refinement(document, element, "file-as");
            if (!role.isEmpty()) person.put("role", role);
            if (!fileAs.isEmpty()) person.put("fileAs", fileAs);
            result.put(person);
        }
        return result;
    }

    private static List<Person> people(JSONArray values) {
        List<Person> result = new ArrayList<>();
        if (values == null) return result;
        for (int index = 0; index < values.length(); index++) {
            JSONObject value = values.optJSONObject(index);
            if (value == null) continue;
            String name = value.optString("name", "").trim();
            if (!name.isEmpty()) {
                result.add(new Person(
                    name,
                    value.optString("role", "").trim(),
                    value.optString("fileAs", "").trim()
                ));
            }
        }
        return result;
    }

    private static void putOptional(JSObject target, String key, String value) {
        if (!value.isEmpty()) target.put(key, value);
    }

    private static Element findIdentifier(Element packageElement, Element metadataElement) {
        String uniqueId = value(packageElement, "unique-identifier");
        List<Element> identifiers = childElements(metadataElement, "identifier");
        for (Element identifier : identifiers) {
            if (!uniqueId.isEmpty() && uniqueId.equals(value(identifier, "id"))) return identifier;
        }
        return identifiers.isEmpty() ? null : identifiers.get(0);
    }

    private static String refinement(Document document, Element target, String property) {
        String id = value(target, "id");
        if (id.isEmpty()) return "";
        NodeList all = document.getElementsByTagName("*");
        for (int index = 0; index < all.getLength(); index++) {
            Node node = all.item(index);
            if (!(node instanceof Element)) continue;
            Element element = (Element) node;
            if ("meta".equals(localName(element))
                && ("#" + id).equals(value(element, "refines"))
                && property.equals(value(element, "property"))) {
                return text(element);
            }
        }
        return "";
    }

    private static Element firstChild(Element parent, String name) {
        if (parent == null) return null;
        for (Element element : childElements(parent, name)) return element;
        return null;
    }

    private static List<Element> childElements(Element parent, String name) {
        List<Element> result = new ArrayList<>();
        if (parent == null) return result;
        NodeList children = parent.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            Node node = children.item(index);
            if (node instanceof Element && name.equals(localName((Element) node))) {
                result.add((Element) node);
            }
        }
        return result;
    }

    private static Element firstElement(Node parent, String name) {
        if (parent == null) return null;
        if (parent instanceof Element && name.equals(localName((Element) parent))) {
            return (Element) parent;
        }
        NodeList children = parent.getChildNodes();
        for (int index = 0; index < children.getLength(); index++) {
            Element found = firstElement(children.item(index), name);
            if (found != null) return found;
        }
        return null;
    }

    private static String text(Element element) {
        return element == null || element.getTextContent() == null
            ? ""
            : element.getTextContent().trim();
    }

    private static String value(Element element, String attribute) {
        if (element == null) return "";
        String value = element.getAttribute(attribute);
        return value == null ? "" : value.trim();
    }

    private static String localName(Element element) {
        String localName = element.getLocalName();
        if (localName != null) return localName;
        String nodeName = element.getNodeName();
        int separator = nodeName.indexOf(':');
        return separator >= 0 ? nodeName.substring(separator + 1) : nodeName;
    }

    private static PackageVersion packageVersion(Element packageElement) {
        return value(packageElement, "version").startsWith("2")
            ? PackageVersion.EPUB2
            : PackageVersion.EPUB3;
    }

    private static byte[] readEntryBytes(ZipFile zip, ZipArchiveEntry entry) throws IOException {
        if (entry == null || entry.getSize() > MAX_XML_BYTES) {
            throw new IOException("EPUB XML entry exceeds the safe size limit");
        }
        try (InputStream input = zip.getInputStream(entry);
             ByteArrayOutputStream output = new ByteArrayOutputStream((int) Math.max(0L, entry.getSize()))) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            long total = 0L;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_XML_BYTES) throw new IOException("EPUB XML entry exceeds the safe size limit");
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static Document parseXml(byte[] bytes) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        setFeatureIfSupported(factory, "http://apache.org/xml/features/disallow-doctype-decl", true);
        setFeatureIfSupported(factory, "http://xml.org/sax/features/external-general-entities", false);
        setFeatureIfSupported(factory, "http://xml.org/sax/features/external-parameter-entities", false);
        setFeatureIfSupported(factory, "http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        try {
            factory.setXIncludeAware(false);
        } catch (UnsupportedOperationException ignored) {
        }
        factory.setExpandEntityReferences(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        builder.setEntityResolver((publicId, systemId) ->
            new InputSource(new ByteArrayInputStream(new byte[0]))
        );
        return builder.parse(new ByteArrayInputStream(bytes));
    }

    private static void setFeatureIfSupported(
        DocumentBuilderFactory factory,
        String feature,
        boolean value
    ) {
        try {
            factory.setFeature(feature, value);
        } catch (Exception ignored) {
        }
    }

    private static byte[] serializeXml(Document document) throws Exception {
        TransformerFactory factory = TransformerFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        Transformer transformer = factory.newTransformer();
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty(OutputKeys.INDENT, "no");
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        transformer.transform(new DOMSource(document), new StreamResult(output));
        return output.toByteArray();
    }

    private static void validateArchive(Path outputPath) throws Exception {
        try (ArchiveContext context = ArchiveContext.open(outputPath)) {
            if (context.orderedEntries.isEmpty()
                || !"mimetype".equals(normalizePath(context.orderedEntries.get(0).getName()))) {
                throw new IOException("EPUB mimetype is not the first entry");
            }
            if (context.orderedEntries.get(0).getMethod() != ZipEntry.STORED) {
                throw new IOException("EPUB mimetype is not stored");
            }
            Document opf = parseXml(readEntryBytes(context.zip, context.opfEntry));
            if (firstElement(opf, "package") == null) {
                throw new IOException("EPUB package document is invalid");
            }
        }
    }

    private static void moveReplace(Path source, Path target) throws IOException {
        Files.createDirectories(target.getParent());
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException ex) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void checkCancelled(BooleanSupplier cancelled) throws IOException {
        if (cancelled != null && cancelled.getAsBoolean()) {
            throw new IOException("Metadata rewrite cancelled");
        }
    }

    private static String normalizePath(String value) {
        String[] parts = value.replace('\\', '/').split("/");
        List<String> normalized = new ArrayList<>();
        for (String part : parts) {
            if (part.isEmpty() || ".".equals(part)) continue;
            if ("..".equals(part)) {
                if (!normalized.isEmpty()) normalized.remove(normalized.size() - 1);
                continue;
            }
            normalized.add(part);
        }
        return String.join("/", normalized);
    }

    private enum PackageVersion { EPUB2, EPUB3 }

    private static final class Person {
        private final String name;
        private final String role;
        private final String fileAs;

        private Person(String name, String role, String fileAs) {
            this.name = name;
            this.role = role;
            this.fileAs = fileAs;
        }
    }

    private static final class ArchiveContext implements Closeable {
        private final ZipFile zip;
        private final Map<String, ZipArchiveEntry> entries;
        private final List<ZipArchiveEntry> orderedEntries;
        private final String opfPath;
        private final ZipArchiveEntry opfEntry;

        private ArchiveContext(
            ZipFile zip,
            Map<String, ZipArchiveEntry> entries,
            List<ZipArchiveEntry> orderedEntries,
            String opfPath,
            ZipArchiveEntry opfEntry
        ) {
            this.zip = zip;
            this.entries = entries;
            this.orderedEntries = orderedEntries;
            this.opfPath = opfPath;
            this.opfEntry = opfEntry;
        }

        private static ArchiveContext open(Path path) throws Exception {
            ZipFile zip = new ZipFile(path.toFile());
            try {
                Map<String, ZipArchiveEntry> entries = new HashMap<>();
                List<ZipArchiveEntry> ordered = new ArrayList<>();
                java.util.Enumeration<ZipArchiveEntry> enumeration = zip.getEntries();
                while (enumeration.hasMoreElements()) {
                    ZipArchiveEntry entry = enumeration.nextElement();
                    String name = normalizePath(entry.getName());
                    if (entries.put(name, entry) != null) throw new IOException("Duplicate EPUB entry: " + name);
                    ordered.add(entry);
                }
                ZipArchiveEntry container = entries.get("META-INF/container.xml");
                if (container == null) throw new IOException("EPUB container.xml is missing");
                Document containerDocument = parseXml(readEntryBytes(zip, container));
                Element rootfile = firstElement(containerDocument, "rootfile");
                String opfPath = normalizePath(value(rootfile, "full-path"));
                ZipArchiveEntry opf = entries.get(opfPath);
                if (opf == null || opfPath.isEmpty()) throw new IOException("EPUB package document is missing");
                return new ArchiveContext(zip, entries, ordered, opfPath, opf);
            } catch (Exception error) {
                zip.close();
                throw error;
            }
        }

        @Override
        public void close() throws IOException {
            zip.close();
        }
    }
}
