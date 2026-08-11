package com.sheldrapps.plugins.pdfrewrite;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class PdfSessionManager {
    public static final class Session {
        public final String id;
        public final String operation;
        public final File directory;
        public final Map<String, File> inputs = new HashMap<>();
        Session(String id, String operation, File directory) { this.id = id; this.operation = operation; this.directory = directory; }
    }
    private final TemporaryFileManager files;
    private final Map<String, Session> sessions = new HashMap<>();
    public PdfSessionManager(TemporaryFileManager files) { this.files = files; }
    public synchronized Session create(String operation) {
        String id = UUID.randomUUID().toString();
        Session session = new Session(id, operation, files.createSessionDirectory(id));
        sessions.put(id, session); return session;
    }
    public synchronized Session require(String id) throws PdfOperationException {
        Session session = sessions.get(id);
        if (session == null) throw new PdfOperationException("SESSION_NOT_FOUND", "session");
        return session;
    }
    public synchronized void cleanup(String id) { Session session = sessions.remove(id); if (session != null) files.deleteRecursively(session.directory); }
}
