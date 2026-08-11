package com.sheldrapps.plugins.pdfrewrite;

import android.content.Context;
import java.io.File;
import java.util.UUID;

/** PMAS-only private working files. PCM continues to use its legacy folder. */
public final class TemporaryFileManager {
    public static final String PMAS_WORK_FOLDER = "PdfMergerAndSplitter";
    private final File root;

    public TemporaryFileManager(Context context) {
        root = new File(context.getFilesDir(), PMAS_WORK_FOLDER);
        if (!root.exists()) root.mkdirs();
        removeAbandoned();
    }
    public File createSessionDirectory(String sessionId) {
        File dir = new File(root, sessionId == null || sessionId.isEmpty() ? UUID.randomUUID().toString() : sessionId);
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }
    public File root() { return root; }
    public File tempOutput(File session, String name) { return new File(session, "." + name + ".partial"); }
    public void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        file.delete();
    }
    public void removeAbandoned() {
        long cutoff = System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
        File[] entries = root.listFiles();
        if (entries != null) for (File entry : entries) if (entry.lastModified() < cutoff) deleteRecursively(entry);
    }
}
