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
