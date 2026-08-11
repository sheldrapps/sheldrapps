package com.sheldrapps.plugins.pdfrewrite;

import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** Resolves Android content/file URIs without retaining the caller's document. */
public final class AndroidUriResolver {
    private static final int BUFFER_SIZE = PdfResourceBudget.COPY_BUFFER_BYTES;
    private final Context context;

    public AndroidUriResolver(Context context) { this.context = context.getApplicationContext(); }

    public String displayName(String value) {
        Uri uri = Uri.parse(value);
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (index >= 0 && cursor.getString(index) != null) return cursor.getString(index);
                }
            } catch (Exception ignored) { }
        }
        String name = new File(uri.getPath() == null ? value : uri.getPath()).getName();
        return name.isEmpty() ? "document.pdf" : name;
    }

    public long size(String value) {
        Uri uri = Uri.parse(value);
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = context.getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                    if (index >= 0 && !cursor.isNull(index)) return cursor.getLong(index);
                }
            } catch (Exception ignored) { }
        }
        return new File(uri.getPath() == null ? value : uri.getPath()).length();
    }

    public long copyToPrivateFile(String value, File destination, long maximumBytes) throws Exception {
        Uri uri = Uri.parse(value);
        if (destination.getParentFile() != null && !destination.getParentFile().exists() && !destination.getParentFile().mkdirs()) {
            throw new PdfOperationException("NO_SPACE", "import");
        }
        ContentResolver resolver = context.getContentResolver();
        try (InputStream input = "content".equals(uri.getScheme())
                ? resolver.openInputStream(uri) : new FileInputStream(new File(uri.getPath()));
             OutputStream output = new FileOutputStream(destination)) {
            if (input == null) throw new PdfOperationException("SOURCE_FILE_NOT_FOUND", "import");
            byte[] buffer = new byte[BUFFER_SIZE];
            long copied = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                copied += read;
                if (maximumBytes > 0 && copied > maximumBytes) throw new PdfOperationException("PDF_TOO_LARGE", "import");
                output.write(buffer, 0, read);
            }
            output.flush();
            return copied;
        }
    }
}
