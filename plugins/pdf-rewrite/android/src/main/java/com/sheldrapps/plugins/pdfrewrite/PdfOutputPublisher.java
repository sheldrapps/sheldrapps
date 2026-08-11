package com.sheldrapps.plugins.pdfrewrite;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** Publishes only fully validated files using MediaStore's pending transaction. */
public final class PdfOutputPublisher {
    private static final String TAG = "PMAS.PdfPublisher";
    public static final String PUBLIC_FOLDER = "PdfMergerAndSplitter";
    private final Context context;
    public PdfOutputPublisher(Context context) { this.context = context.getApplicationContext(); }
    public Published publish(File source, String requestedName) throws Exception {
        String name = normalizeName(requestedName);
        Uri collection = MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
        values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOCUMENTS + "/" + PUBLIC_FOLDER + "/");
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = context.getContentResolver().insert(collection, values);
        if (uri == null) throw new PdfOperationException("PUBLIC_EXPORT_FAILED", "publish");
        try {
            long size = copy(source, uri);
            ContentValues done = new ContentValues(); done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (context.getContentResolver().update(uri, done, null, null) != 1) throw new PdfOperationException("PUBLIC_EXPORT_FAILED", "publish");
            return new Published(uri.toString(), name, size);
        } catch (Exception error) {
            Log.e(TAG, "publish failed name=" + name + " uri=" + uri, error);
            context.getContentResolver().delete(uri, null, null);
            throw error;
        }
    }
    public void rollback(Published published) { try { context.getContentResolver().delete(Uri.parse(published.uri), null, null); } catch (Exception ignored) { } }
    private long copy(File source, Uri destination) throws Exception {
        long size = 0; byte[] buffer = new byte[PdfResourceBudget.COPY_BUFFER_BYTES];
        OutputStream rawOutput = context.getContentResolver().openOutputStream(destination, "w");
        if (rawOutput == null) throw new PdfOperationException("PUBLIC_EXPORT_FAILED", "publish");
        try (InputStream input = new BufferedInputStream(new FileInputStream(source)); OutputStream output = new BufferedOutputStream(rawOutput)) {
            int read; while ((read = input.read(buffer)) != -1) { output.write(buffer, 0, read); size += read; } output.flush();
        }
        return size;
    }
    private String normalizeName(String value) {
        String name = value == null ? "document.pdf" : value.replaceAll("[\\\\/:*?\"<>|]", " ").trim();
        if (!name.toLowerCase().endsWith(".pdf")) name += ".pdf";
        return name.isEmpty() ? "document.pdf" : name;
    }
    public static final class Published { public final String uri, name; public final long size; Published(String uri, String name, long size) { this.uri=uri; this.name=name; this.size=size; } }
}
