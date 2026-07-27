package de.medialesson.journalitea;

import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@CapacitorPlugin(name = "JournaliteaFiles")
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