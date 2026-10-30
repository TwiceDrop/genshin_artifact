package com.mona.artifact.local;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

@RunWith(AndroidJUnit4.class)
public class UpdateRegressionTest {
    private static class RecordingCall extends PluginCall {
        final CountDownLatch done = new CountDownLatch(1);
        JSObject result;
        String error;
        RecordingCall(JSObject options) { super(null, "MonaLocal", "synthetic-update", "updateStatus", options); }
        @Override public void resolve(JSObject value) { result = value; done.countDown(); }
        @Override public void reject(String message, String code, Exception ex) { error = message; done.countDown(); }
        void await() throws Exception { assertTrue(done.await(15, TimeUnit.SECONDS)); assertNull(error); }
    }
    private MonaLocalPlugin plugin(ActivityScenario<MainActivity> activity) {
        MonaLocalPlugin plugin = new MonaLocalPlugin();
        activity.onActivity(a -> plugin.setBridge(a.getBridge()));
        return plugin;
    }
    private JSObject status(MonaLocalPlugin plugin) throws Exception {
        RecordingCall call = new RecordingCall(new JSObject());
        plugin.updateStatus(call); call.await(); return call.result;
    }
    private void cancel(MonaLocalPlugin plugin) throws Exception {
        RecordingCall call = new RecordingCall(new JSObject());
        plugin.cancelUpdate(call); call.await(); assertEquals("cancelled", call.result.getString("phase"));
    }
    private String shell(String command) throws Exception {
        try (ParcelFileDescriptor result = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command);
             InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(result);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString("UTF-8").trim();
        }
    }
    @Test public void actualWaitingDownloadReportsSystemStateAndCanBeCancelled() throws Exception {
        assumeTrue(Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish"));
        boolean wifi = "1".equals(shell("settings get global wifi_on"));
        boolean data = "1".equals(shell("settings get global mobile_data"));
        try {
            shell("svc wifi disable"); shell("svc data disable");
            try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
                MonaLocalPlugin plugin = plugin(activity);
                try {
                    RecordingCall start = new RecordingCall(new JSObject().put("url", "https://example.invalid/synthetic-update.apk")
                        .put("size", 64).put("version", "v7.1.11"));
                    plugin.downloadUpdate(start); start.await();
                    JSObject result = status(plugin);
                    assertTrue(result.toString(), "pending".equals(result.getString("phase")) || "paused".equals(result.getString("phase")));
                    assertEquals(0L, result.getLong("downloaded"));
                    assertEquals(64L, result.getLong("total"));
                    assertEquals("v7.1.11", result.getString("version"));
                    assertFalse(result.getString("message").isEmpty());
                    assertEquals("", result.getString("error"));
                    long id = plugin.getContext().getSharedPreferences("mona-updates", 0).getLong("downloadId", -1);
                    DownloadManager downloads = (DownloadManager) plugin.getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                    try (Cursor row = downloads.query(new DownloadManager.Query().setFilterById(id))) {
                        assertTrue(row.moveToFirst());
                        assertEquals(row.getInt(row.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)), result.getInteger("nativeStatus").intValue());
                        assertEquals(row.getInt(row.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)), result.getInteger("reason").intValue());
                    }
                    cancel(plugin);
                    assertEquals("idle", status(plugin).getString("phase"));
                    try (Cursor row = downloads.query(new DownloadManager.Query().setFilterById(id))) { assertFalse(row.moveToFirst()); }
                } finally { cancel(plugin); }
            }
        } finally {
            shell("svc wifi " + (wifi ? "enable" : "disable")); shell("svc data " + (data ? "enable" : "disable"));
        }
    }
    @Test public void actualCompletedRecordKeepsSizeCheckBeforeInstall() throws Exception {
        assumeTrue(Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish"));
        boolean wifi = "1".equals(shell("settings get global wifi_on"));
        boolean data = "1".equals(shell("settings get global mobile_data"));
        try {
            shell("svc wifi enable"); shell("svc data enable");
            try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
                MonaLocalPlugin plugin = plugin(activity);
                try {
                    // Immutable public text payload: no release APK is installed by this test.
                    RecordingCall start = new RecordingCall(new JSObject().put("url", "https://raw.githubusercontent.com/nodejs/node/v22.23.2/SECURITY.md")
                        .put("size", 23067).put("version", "v7.1.11"));
                    plugin.downloadUpdate(start); start.await();
                    JSObject ready = status(plugin);
                    long end = System.currentTimeMillis() + 60000;
                    while (!"ready".equals(ready.getString("phase")) && !"error".equals(ready.getString("phase")) && System.currentTimeMillis() < end) {
                        Thread.sleep(200); ready = status(plugin);
                    }
                    assertEquals(ready.toString(), "ready", ready.getString("phase"));
                    assertEquals(23067L, ready.getLong("downloaded"));
                    assertEquals(DownloadManager.STATUS_SUCCESSFUL, ready.getInteger("nativeStatus").intValue());
                    Context context = plugin.getContext();
                    long id = context.getSharedPreferences("mona-updates", 0).getLong("downloadId", -1);
                    DownloadManager downloads = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                    int bytes = 0;
                    try (InputStream input = context.getContentResolver().openInputStream(downloads.getUriForDownloadedFile(id))) {
                        byte[] buffer = new byte[8192]; int count;
                        while ((count = input.read(buffer)) != -1) bytes += count;
                    }
                    assertEquals(23067, bytes);
                    context.getSharedPreferences("mona-updates", 0).edit().putLong("size", bytes + 1).commit();
                    JSObject shortFile = status(plugin);
                    assertEquals("error", shortFile.getString("phase"));
                    assertTrue(shortFile.getString("error").contains("下载不完整"));
                } finally { cancel(plugin); }
            }
        } finally {
            shell("svc wifi " + (wifi ? "enable" : "disable")); shell("svc data " + (data ? "enable" : "disable"));
        }
    }
}
