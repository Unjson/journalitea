package de.medialesson.journalitea;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@CapacitorPlugin(
    name = "JournaliteaFiles",
    permissions = {
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class JournaliteaFilesPlugin extends Plugin {
    private static final int BUFFER_SIZE = 64 * 1024;

    @PluginMethod
    public void createPhotoArchive(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || !isSafeArchiveName(fileName)) {
            call.reject("Invalid photo archive file name.");
            return;
        }

        execute(() -> {
            File photoRoot = new File(getContext().getFilesDir(), "photos");
            File archiveFile = new File(getContext().getCacheDir(), fileName);

            try {
                int fileCount = writePhotoArchive(photoRoot, archiveFile);
                JSObject result = new JSObject();
                result.put("path", Uri.fromFile(archiveFile).toString());
                result.put("hasPhotos", fileCount > 0);
                result.put("exists", true);
                call.resolve(result);
            } catch (IOException error) {
                archiveFile.delete();
                call.reject("Could not create photo archive.", error);
            }
        });
    }

    @PluginMethod
    public void savePhotoToDownloads(PluginCall call) {
        String relativePath = call.getString("relativePath");
        String fileName = call.getString("fileName");
        if (!isSafeManagedPhotoPath(relativePath)) {
            call.reject("Invalid managed photo path.");
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
            && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }

        execute(() -> savePhotoToDownloadsInternal(call, relativePath, fileName));
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("Storage permission is required to save the photo.");
            return;
        }

        String relativePath = call.getString("relativePath");
        String fileName = call.getString("fileName");
        execute(() -> savePhotoToDownloadsInternal(call, relativePath, fileName));
    }

    private void savePhotoToDownloadsInternal(
        PluginCall call,
        String relativePath,
        String requestedFileName
    ) {
        try {
            File sourceFile = resolveManagedPhotoFile(relativePath);
            if (!sourceFile.isFile()) {
                call.reject("The selected photo could not be found.");
                return;
            }

            String fileName = sanitizeDownloadFileName(requestedFileName, sourceFile.getName());
            JSObject result = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? saveToMediaStore(sourceFile, fileName)
                : saveToLegacyDownloads(sourceFile, fileName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not save the photo to Downloads.", error);
        }
    }

    private File resolveManagedPhotoFile(String relativePath) throws IOException {
        String normalizedPath = normalizeRelativePath(relativePath);
        File photosRoot = new File(getContext().getFilesDir(), "photos").getCanonicalFile();
        File sourceFile = new File(getContext().getFilesDir(), normalizedPath).getCanonicalFile();
        String rootPath = photosRoot.getPath() + File.separator;
        if (!sourceFile.getPath().startsWith(rootPath)) {
            throw new IOException("Invalid managed photo path.");
        }
        return sourceFile;
    }

    private JSObject saveToMediaStore(File sourceFile, String fileName) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, getMimeType(fileName));
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) {
            throw new IOException("Could not create the Downloads file.");
        }

        try {
            try (
                InputStream input = new BufferedInputStream(new FileInputStream(sourceFile));
                OutputStream output = resolver.openOutputStream(uri)
            ) {
                if (output == null) {
                    throw new IOException("Could not open the Downloads file.");
                }
                copy(input, output);
            }

            ContentValues publishedValues = new ContentValues();
            publishedValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, publishedValues, null, null);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("path", uri.toString());
            result.put("location", "Downloads");
            result.put("fileName", fileName);
            return result;
        } catch (Exception error) {
            resolver.delete(uri, null, null);
            if (error instanceof IOException) {
                throw (IOException) error;
            }
            throw new IOException("Could not publish the photo.", error);
        }
    }

    private JSObject saveToLegacyDownloads(File sourceFile, String fileName) throws IOException {
        File downloadsDirectory = Environment.getExternalStoragePublicDirectory(
            Environment.DIRECTORY_DOWNLOADS
        );
        if (!downloadsDirectory.exists() && !downloadsDirectory.mkdirs()) {
            throw new IOException("Could not create the Downloads folder.");
        }

        File targetFile = new File(downloadsDirectory, fileName);
        if (targetFile.exists()) {
            targetFile = new File(
                downloadsDirectory,
                appendSuffixBeforeExtension(fileName, "-" + System.currentTimeMillis())
            );
        }

        try {
            try (
                InputStream input = new BufferedInputStream(new FileInputStream(sourceFile));
                OutputStream output = new BufferedOutputStream(new FileOutputStream(targetFile))
            ) {
                copy(input, output);
            }
        } catch (Exception error) {
            if (targetFile.isFile()) {
                targetFile.delete();
            }
            if (error instanceof IOException) {
                throw (IOException) error;
            }
            throw new IOException("Could not write the Downloads file.", error);
        }

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("path", targetFile.getAbsolutePath());
        result.put("location", "Downloads");
        result.put("fileName", targetFile.getName());
        return result;
    }

    private void copy(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[BUFFER_SIZE];
        int bytesRead;
        while ((bytesRead = input.read(buffer)) != -1) {
            output.write(buffer, 0, bytesRead);
        }
    }

    private boolean isSafeManagedPhotoPath(String value) {
        if (value == null) {
            return false;
        }

        String normalizedPath = normalizeRelativePath(value);
        String[] segments = normalizedPath.split("/");
        if (segments.length < 3 || !"photos".equals(segments[0])) {
            return false;
        }

        for (String segment : segments) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                return false;
            }
        }
        return true;
    }

    private String normalizeRelativePath(String value) {
        return value == null ? "" : value.trim().replace('\\', '/').replaceFirst("^/+", "");
    }

    private String sanitizeDownloadFileName(String requestedFileName, String fallbackFileName) {
        String fileName = requestedFileName == null || requestedFileName.trim().isEmpty()
            ? fallbackFileName
            : requestedFileName.trim();
        fileName = new File(fileName.replace('\\', '/')).getName();
        fileName = fileName.replaceAll("[^A-Za-z0-9._-]", "-");
        if (fileName.isEmpty() || ".".equals(fileName) || "..".equals(fileName)) {
            return "photo-" + System.currentTimeMillis() + ".jpg";
        }
        return fileName;
    }

    private String appendSuffixBeforeExtension(String fileName, String suffix) {
        int extensionIndex = fileName.lastIndexOf('.');
        if (extensionIndex <= 0) {
            return fileName + suffix;
        }
        return fileName.substring(0, extensionIndex) + suffix + fileName.substring(extensionIndex);
    }

    private String getMimeType(String fileName) {
        String extension = MimeTypeMap.getFileExtensionFromUrl(fileName);
        String mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase());
        return mimeType == null ? "application/octet-stream" : mimeType;
    }

    private boolean isSafeArchiveName(String fileName) {
        return fileName.endsWith("_photos.zip")
            && fileName.equals(new File(fileName).getName());
    }

    private int writePhotoArchive(File photoRoot, File archiveFile) throws IOException {
        try (
            ZipOutputStream output = new ZipOutputStream(
                new BufferedOutputStream(new FileOutputStream(archiveFile))
            )
        ) {
            if (!photoRoot.isDirectory()) {
                return 0;
            }
            return addDirectory(photoRoot, photoRoot, output);
        }
    }

    private int addDirectory(File photoRoot, File directory, ZipOutputStream output) throws IOException {
        File[] children = directory.listFiles();
        if (children == null) {
            return 0;
        }

        int fileCount = 0;
        for (File child : children) {
            String relativePath = child.getAbsolutePath()
                .substring(photoRoot.getAbsolutePath().length() + 1)
                .replace('\\', '/');
            if (relativePath.equals("_staging") || relativePath.startsWith("_staging/")) {
                continue;
            }
            if (child.isDirectory()) {
                fileCount += addDirectory(photoRoot, child, output);
                continue;
            }
            if (!child.isFile()) {
                continue;
            }

            output.putNextEntry(new ZipEntry("photos/" + relativePath));
            try (BufferedInputStream input = new BufferedInputStream(new FileInputStream(child))) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int bytesRead;
                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                }
            }
            output.closeEntry();
            fileCount += 1;
        }
        return fileCount;
    }
}