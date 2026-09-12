package com.mona.artifact.local;

import android.app.Activity;
import android.content.Intent;
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
    @PluginMethod public void saveFile(PluginCall call) {
        if (call.getString("text") == null && call.getString("base64") == null) { call.reject("文件内容为空"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mimeType", "application/json"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "mona-backup.json"));
        startActivityForResult(call, intent, "fileSelected");
    }
    @ActivityCallback private void fileSelected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.resolve(new JSObject().put("cancelled", true)); return; }
        getBridge().execute(() -> {
            try (OutputStream out = getContext().getContentResolver().openOutputStream(result.getData().getData(), "wt")) {
                if (out == null) throw new IOException();
                out.write(call.getString("base64") != null ? Base64.decode(call.getString("base64"), Base64.DEFAULT) : call.getString("text", "").getBytes(StandardCharsets.UTF_8));
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception e) { call.reject("无法保存文件，请重新选择位置"); }
        });
    }
}
