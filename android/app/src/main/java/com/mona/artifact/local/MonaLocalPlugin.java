package com.mona.artifact.local;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "MonaLocal")
public class MonaLocalPlugin extends Plugin {
    private static final String KEY = "mona-cookie-v1";
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(KEY)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY, null);
    }
    @PluginMethod public void readVault(PluginCall call) {
        try {
            String stored = getContext().getSharedPreferences("mona-vault", 0).getString("value", null);
            if (stored == null) { call.resolve(new JSObject().put("text", "{\"version\":1,\"accounts\":[]}")); return; }
            String[] parts = stored.split(":", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            String text = new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
            call.resolve(new JSObject().put("text", text));
        } catch (Exception e) { call.reject("无法读取本机加密 Cookie 库；原数据未修改"); }
    }
    @PluginMethod public void writeVault(PluginCall call) {
        try {
            String text = call.getString("text");
            if (text == null || text.length() > 2000000) { call.reject("Cookie 库格式无效"); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            String value = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(text.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!getContext().getSharedPreferences("mona-vault", 0).edit().putString("value", value).commit()) throw new IOException();
            call.resolve();
        } catch (Exception e) { call.reject("Cookie 保存失败，请检查设备存储空间"); }
    }
    private static final String EXPORT_TOKEN = "_monaExport";
    private volatile String pendingExport;

    private File exportFile(String token) throws IOException {
        if (token == null || !token.matches("mona-export-[a-f0-9-]{36}\\.tmp")) {
            throw new IOException("导出临时文件引用无效，请重新导出");
        }
        return new File(new File(getContext().getFilesDir(), "pending-exports"), token);
    }

    private void discardExport(PluginCall call) {
        String token = call.getString(EXPORT_TOKEN);
        try {
            File file = exportFile(token);
            if (file.exists() && !file.delete()) {
                Logger.error("无法清理本次导出临时文件");
            }
        } catch (IOException e) {
            Logger.error("无法清理本次导出临时文件", e);
        } finally {
            if (token != null && token.equals(pendingExport)) pendingExport = null;
        }
    }

    @PluginMethod public synchronized void saveFile(PluginCall call) {
        if (pendingExport != null) {
            call.reject("请先完成或取消当前导出", "EXPORT_BUSY");
            return;
        }
        String text = call.getString("text"), base64 = call.getString("base64");
        if (text == null && base64 == null) {
            call.reject("文件内容为空", "EXPORT_EMPTY");
            return;
        }
        String mimeType = call.getString("mimeType", "application/json");
        String filename = call.getString("filename", "mona-backup.json").replaceAll("[\\\\/\\r\\n]", "_");
        if (filename.length() > 160) filename = filename.substring(0, 160);
        if (filename.trim().isEmpty()) filename = "mona-backup.json";
        if ("application/json".equals(mimeType) && !filename.endsWith(".json")) filename += ".json";
        String token = "mona-export-" + java.util.UUID.randomUUID() + ".tmp";
        call.getData().put(EXPORT_TOKEN, token);
        pendingExport = token;
        try {
            File file = exportFile(token), directory = file.getParentFile();
            if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("无法创建导出临时目录");
            try (OutputStream out = new FileOutputStream(file)) {
                if (base64 != null) {
                    out.write(Base64.decode(base64, Base64.DEFAULT));
                } else {
                    try (Writer writer = new OutputStreamWriter(out, StandardCharsets.UTF_8)) {
                        writer.write(text);
                    }
                }
            }
            // Capacitor persists call options twice when the picker backgrounds
            // the Activity. Keep only a private file reference, never the payload.
            call.getData().remove("text");
            call.getData().remove("base64");
            call.getData().put("filename", filename);
            call.getData().put("mimeType", mimeType);
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, filename);
            getBridge().executeOnMainThread(() -> {
                try {
                    startActivityForResult(call, intent, "fileSelected");
                } catch (Exception e) {
                    discardExport(call);
                    call.reject("无法打开系统保存页面：" + e.getMessage(), "EXPORT_PICKER", e);
                }
            });
        } catch (Exception e) {
            discardExport(call);
            call.reject("导出准备失败：" + e.getMessage(), "EXPORT_PREPARE", e);
        }
    }
    private android.app.DownloadManager downloads() {
        return (android.app.DownloadManager) getContext().getSystemService(android.content.Context.DOWNLOAD_SERVICE);
    }
    private android.content.SharedPreferences updatePreferences() {
        return getContext().getSharedPreferences("mona-updates", 0);
    }
    private long updateId() { return updatePreferences().getLong("downloadId", -1); }

    @PluginMethod public void probeUpdate(PluginCall call) {
        java.util.concurrent.CompletableFuture.runAsync(() -> {
            java.net.HttpURLConnection connection = null;
            try {
                long start = System.currentTimeMillis();
                connection = (java.net.HttpURLConnection) new java.net.URL(call.getString("url")).openConnection();
                connection.setConnectTimeout(6000);
                connection.setReadTimeout(6000);
                connection.setRequestProperty("Range", "bytes=0-262143");
                connection.setRequestProperty("Accept-Encoding", "identity");
                int code = connection.getResponseCode();
                if (code < 200 || code >= 300) throw new IOException("HTTP " + code);
                int bytes = 0;
                try (InputStream input = connection.getInputStream()) {
                    byte[] buffer = new byte[8192];
                    while (bytes < 262144 && System.currentTimeMillis() - start < 10000) {
                        int count = input.read(buffer);
                        if (count < 0) break;
                        bytes += count;
                    }
                }
                if (bytes == 0) throw new IOException("未收到文件内容");
                long elapsed = Math.max(1, System.currentTimeMillis() - start);
                call.resolve(new JSObject().put("elapsed", elapsed).put("speed", bytes * 1000.0 / elapsed));
            } catch (Exception e) {call.reject("线路检测失败：" + e.getMessage(), "UPDATE_PROBE", e);}
            finally {if (connection != null) connection.disconnect();}
        });
    }

    @PluginMethod public void downloadUpdate(PluginCall call) {
        try {
            long size = call.getData().getLong("size");
            long previous = updateId();
            if (previous != -1) downloads().remove(previous);
            android.app.DownloadManager.Request request = new android.app.DownloadManager.Request(Uri.parse(call.getString("url")));
            request.setTitle("莫娜占卜铺更新");
            request.setMimeType("application/vnd.android.package-archive");
            request.setDestinationInExternalFilesDir(getContext(), android.os.Environment.DIRECTORY_DOWNLOADS, "mona-update.apk");
            request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.addRequestHeader("Accept-Encoding", "identity");
            long id = downloads().enqueue(request);
            updatePreferences().edit().putLong("downloadId", id).putLong("size", size)
                .putString("version", call.getString("version")).apply();
            call.resolve(new JSObject().put("phase", "downloading").put("downloaded", 0).put("total", size));
        } catch (Exception e) {call.reject("更新下载启动失败：" + e.getMessage(), "UPDATE_DOWNLOAD", e);}
    }

    private JSObject downloadStatus() throws IOException {
        long id = updateId(), expected = updatePreferences().getLong("size", 0);
        if (id == -1) return new JSObject().put("phase", "idle").put("downloaded", 0).put("total", 0);
        try (android.database.Cursor cursor = downloads().query(new android.app.DownloadManager.Query().setFilterById(id))) {
            if (!cursor.moveToFirst()) throw new IOException("更新下载记录不存在，请重新下载");
            int status = cursor.getInt(cursor.getColumnIndexOrThrow(android.app.DownloadManager.COLUMN_STATUS));
            long bytes = cursor.getLong(cursor.getColumnIndexOrThrow(android.app.DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            String phase = status == android.app.DownloadManager.STATUS_SUCCESSFUL ? "ready" :
                status == android.app.DownloadManager.STATUS_FAILED ? "error" : "downloading";
            String error = "";
            if ("error".equals(phase)) error = "下载失败（代码 " + cursor.getInt(cursor.getColumnIndexOrThrow(android.app.DownloadManager.COLUMN_REASON)) + "）";
            if ("ready".equals(phase) && bytes != expected) {
                phase = "error";
                error = "下载不完整：收到 " + bytes + "／" + expected + " 字节";
            }
            return new JSObject().put("phase", phase).put("downloaded", bytes).put("total", expected).put("error", error)
                .put("version", updatePreferences().getString("version", ""));
        }
    }

    @PluginMethod public void updateStatus(PluginCall call) {
        try {call.resolve(downloadStatus());}
        catch (Exception e) {call.reject("无法读取更新进度：" + e.getMessage(), "UPDATE_STATUS", e);}
    }
    @PluginMethod public void cancelUpdate(PluginCall call) {
        try {
            long id = updateId();
            if (id != -1) downloads().remove(id);
            updatePreferences().edit().remove("downloadId").remove("size").remove("version").apply();
            call.resolve(new JSObject().put("phase", "cancelled").put("downloaded", 0).put("total", 0));
        } catch (Exception e) {call.reject("取消下载失败：" + e.getMessage(), "UPDATE_CANCEL", e);}
    }

    @PluginMethod public void installUpdate(PluginCall call) {
        try {
            if (!"ready".equals(downloadStatus().getString("phase"))) throw new IOException("更新包尚未下载完成");
            getBridge().executeOnMainThread(() -> {
                try {
                    if (android.os.Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                        Intent settings = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + getContext().getPackageName()));
                        startActivityForResult(call, settings, "updatePermissionSelected");
                    } else openUpdateInstaller(call);
                } catch (Exception e) {call.reject("无法打开安装界面：" + e.getMessage(), "UPDATE_INSTALL", e);}
            });
        } catch (Exception e) {call.reject(e.getMessage(), "UPDATE_INSTALL", e);}
    }
    private void openUpdateInstaller(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(downloads().getUriForDownloadedFile(updateId()), "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(intent);
        call.resolve(new JSObject().put("phase", "installing"));
    }
    @android.annotation.TargetApi(26)
    @ActivityCallback void updatePermissionSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            if (!getContext().getPackageManager().canRequestPackageInstalls()) throw new IOException("未允许莫娜安装应用");
            openUpdateInstaller(call);
        } catch (Exception e) {call.reject("安装授权失败：" + e.getMessage(), "UPDATE_PERMISSION", e);}
    }

    @PluginMethod public void openExternal(PluginCall call) {
        try {
            String url = call.getString("url", "");
            Uri uri = Uri.parse(url);
            if (!"https".equals(uri.getScheme()) || !"github.com".equals(uri.getHost()) ||
                !uri.getPath().startsWith("/TwiceDrop/genshin_artifact/releases/")) {
                call.reject("更新地址无效"); return;
            }
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) { call.reject("无法打开下载页面"); }
    }
    @ActivityCallback void fileSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        getBridge().execute(() -> {
            try {
                if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
                    call.resolve(new JSObject().put("cancelled", true));
                    return;
                }
                File file = exportFile(call.getString(EXPORT_TOKEN));
                try (InputStream in = new FileInputStream(file);
                     OutputStream out = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                    if (out == null) throw new IOException("系统未提供可写文件");
                    byte[] buffer = new byte[8192];
                    int length;
                    while ((length = in.read(buffer)) != -1) out.write(buffer, 0, length);
                }
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception e) {
                call.reject("无法保存文件：" + e.getMessage() + "；请重新导出并选择保存位置", "EXPORT_WRITE", e);
            } finally {
                discardExport(call);
            }
        });
    }
}
