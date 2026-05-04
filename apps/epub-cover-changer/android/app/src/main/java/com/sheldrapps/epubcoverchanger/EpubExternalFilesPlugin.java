package com.sheldrapps.epubcoverchanger;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

@CapacitorPlugin(name = "EpubExternalFilesPlugin")
public class EpubExternalFilesPlugin extends Plugin {
    @PluginMethod
    public void isAllFilesAccessGranted(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasAllFilesAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void openAllFilesAccessSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception firstError) {
            try {
                Intent fallbackIntent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallbackIntent);

                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Failed to open all files access settings", error);
            }
        }
    }

    @PluginMethod
    public void listEpubs(PluginCall call) {
        JSArray folders = call.getArray("folders");
        JSArray files = new JSArray();
        Set<String> seenLower = new HashSet<>();

        if (folders == null || folders.length() == 0) {
            JSObject result = new JSObject();
            result.put("files", files);
            call.resolve(result);
            return;
        }

        for (int i = 0; i < folders.length(); i++) {
            String folder = folders.optString(i, null);
            if (folder == null || folder.trim().isEmpty()) {
                continue;
            }

            File dir = new File(folder);
            File[] entries = dir.listFiles();
            if (entries == null) {
                continue;
            }

            for (File entry : entries) {
                if (entry == null || !entry.isFile()) {
                    continue;
                }

                String name = entry.getName();
                if (name == null || !name.toLowerCase(Locale.ROOT).endsWith(".epub")) {
                    continue;
                }

                String key = name.toLowerCase(Locale.ROOT);
                if (seenLower.contains(key)) {
                    continue;
                }
                seenLower.add(key);

                JSObject item = new JSObject();
                item.put("name", name);
                item.put("path", entry.getAbsolutePath());
                item.put("size", entry.length());
                item.put("lastModified", entry.lastModified());
                files.put(item);
            }
        }

        JSObject result = new JSObject();
        result.put("files", files);
        call.resolve(result);
    }

    @PluginMethod
    public void readFileBase64(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("Missing path");
            return;
        }

        File file = new File(path);
        if (!file.exists() || !file.isFile()) {
            call.reject("File not found");
            return;
        }

        try {
            byte[] bytes = readAllBytes(file);
            JSObject result = new JSObject();
            result.put("data", Base64.encodeToString(bytes, Base64.NO_WRAP));
            call.resolve(result);
        } catch (IOException error) {
            call.reject("Failed to read file", error);
        }
    }

    @PluginMethod
    public void deleteFile(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.trim().isEmpty()) {
            call.reject("Missing path");
            return;
        }

        File file = new File(path);
        JSObject result = new JSObject();
        result.put("deleted", file.exists() && file.delete());
        call.resolve(result);
    }

    private boolean hasAllFilesAccess() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return true;
        }
        return Environment.isExternalStorageManager();
    }

    private byte[] readAllBytes(File file) throws IOException {
        try (FileInputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }
}
