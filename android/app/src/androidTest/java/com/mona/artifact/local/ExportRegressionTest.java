package com.mona.artifact.local;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;
import android.os.Parcel;
import android.view.accessibility.AccessibilityNodeInfo;
import androidx.activity.result.ActivityResult;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ExportRegressionTest {
    private static class RecordingCall extends PluginCall {
        final CountDownLatch done = new CountDownLatch(1);
        JSObject result;
        String errorCode;
        RecordingCall(JSObject options) {
            super(null, "MonaLocal", "synthetic-export", "saveFile", options);
        }
        @Override public void resolve(JSObject value) { result = value; done.countDown(); }
        @Override public void reject(String message, String code, Exception ex, JSObject data) {
            errorCode = code; done.countDown();
        }
        @Override public void reject(String message, String code, Exception ex) {
            reject(message, code, ex, null);
        }
        @Override public void reject(String message, String code) {
            reject(message, code, null, null);
        }
        void await() throws Exception {
            assertTrue("Export completed", done.await(15, TimeUnit.SECONDS));
        }
    }

    private static class CapturingPlugin extends MonaLocalPlugin {
        final CountDownLatch launched = new CountDownLatch(1);
        boolean onMainThread, failLaunch;
        Intent intent;
        @Override public void startActivityForResult(PluginCall call, Intent value, String callback) {
            onMainThread = Looper.myLooper() == Looper.getMainLooper();
            intent = value;
            launched.countDown();
            if (failLaunch) throw new ActivityNotFoundException("synthetic missing picker");
        }
    }

    private CapturingPlugin plugin(ActivityScenario<MainActivity> activity) {
        CapturingPlugin plugin = new CapturingPlugin();
        activity.onActivity(a -> plugin.setBridge(a.getBridge()));
        return plugin;
    }
    private void stage(CapturingPlugin plugin, RecordingCall call) throws Exception {
        plugin.getBridge().execute(() -> plugin.saveFile(call));
        assertTrue("Picker launched", plugin.launched.await(15, TimeUnit.SECONDS));
        assertTrue("Picker uses main thread", plugin.onMainThread);
    }
    private File staged(CapturingPlugin plugin, PluginCall call) {
        return new File(new File(plugin.getContext().getFilesDir(), "pending-exports"), call.getString("_monaExport"));
    }
    private byte[] read(File file) throws Exception {
        try (InputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }
    private void selected(CapturingPlugin plugin, RecordingCall call, File output) throws Exception {
        java.lang.reflect.Method callback = MonaLocalPlugin.class.getDeclaredMethod("fileSelected", PluginCall.class, ActivityResult.class);
        callback.setAccessible(true);
        callback.invoke(plugin, call, new ActivityResult(Activity.RESULT_OK, new Intent().setData(Uri.fromFile(output))));
    }
    private void awaitDeleted(File file) throws Exception {
        long end = System.currentTimeMillis() + 10000;
        while (file.exists() && System.currentTimeMillis() < end) Thread.sleep(50);
        assertFalse("Temporary payload removed", file.exists());
    }

    @Test public void largeUnicodeExportHasSmallStateAndRestoresLosslessly() throws Exception {
        StringBuilder builder = new StringBuilder("{\"synthetic\":\"");
        for (int i = 0; i < 220000; i++) builder.append("合成圣遗物🌙");
        String text = builder.append("\"}").toString();
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            CapturingPlugin plugin = plugin(activity);
            RecordingCall call = new RecordingCall(new JSObject().put("text", text).put("filename", "synthetic").put("mimeType", "application/json"));
            stage(plugin, call);
            assertFalse(call.getData().has("text"));
            assertFalse(call.getData().has("base64"));
            assertEquals("synthetic.json", plugin.intent.getStringExtra(Intent.EXTRA_TITLE));
            Parcel state = Parcel.obtain();
            try {
                // Capacitor stores the same options in both the bridge and plugin Bundle.
                state.writeString(call.getData().toString()); state.writeString(call.getData().toString());
                assertTrue("Persisted options remain under 4 KiB", state.dataSize() < 4096);
            } finally { state.recycle(); }
            File temporary = staged(plugin, call);
            assertArrayEquals(text.getBytes(StandardCharsets.UTF_8), read(temporary));
            // Recreate both plugin and options, as the bridge does after process restoration.
            RecordingCall restored = new RecordingCall(new JSObject(call.getData().toString()));
            CapturingPlugin restarted = plugin(activity);
            File output = new File(plugin.getContext().getCacheDir(), "synthetic-restored-export.json");
            try {
                selected(restarted, restored, output); restored.await();
                assertNull(restored.errorCode); assertTrue(restored.result.getBool("saved"));
                assertArrayEquals(text.getBytes(StandardCharsets.UTF_8), read(output));
                awaitDeleted(temporary);
            } finally { output.delete(); temporary.delete(); }
        }
    }

    @Test public void base64ExportPreservesBytesAndCleansTemporaryFile() throws Exception {
        byte[] bytes = new byte[65537];
        for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) i;
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            CapturingPlugin plugin = plugin(activity);
            RecordingCall call = new RecordingCall(new JSObject().put("base64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP))
                .put("mimeType", "image/png").put("filename", "synthetic.png"));
            stage(plugin, call);
            assertFalse(call.getData().has("base64"));
            File temporary = staged(plugin, call);
            File output = new File(plugin.getContext().getCacheDir(), "synthetic-image.png");
            try {
                selected(plugin, call, output); call.await();
                assertNull(call.errorCode); assertTrue(call.result.getBool("saved"));
                assertArrayEquals(bytes, read(output));
                awaitDeleted(temporary);
            } finally { output.delete(); temporary.delete(); }
        }
    }

    @Test public void pickerAndWriteFailuresRejectAndPermitAnotherExport() throws Exception {
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            CapturingPlugin plugin = plugin(activity); plugin.failLaunch = true;
            RecordingCall failed = new RecordingCall(new JSObject().put("text", "{}"));
            stage(plugin, failed); failed.await();
            assertEquals("EXPORT_PICKER", failed.errorCode);
            awaitDeleted(staged(plugin, failed));
            plugin.failLaunch = false;
            RecordingCall retry = new RecordingCall(new JSObject().put("text", "{}"));
            plugin.getBridge().execute(() -> plugin.saveFile(retry));
            long end = System.currentTimeMillis() + 10000;
            while (retry.getString("_monaExport") == null && System.currentTimeMillis() < end) Thread.sleep(50);
            assertNotNull(retry.getString("_monaExport"));
            // An unwritable destination must produce a useful error without terminating the app.
            selected(plugin, retry, plugin.getContext().getCacheDir()); retry.await();
            assertEquals("EXPORT_WRITE", retry.errorCode);
            awaitDeleted(staged(plugin, retry));
        }
    }

    private String js(ActivityScenario<MainActivity> activity, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        activity.onActivity(a -> a.getBridge().getWebView().evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        assertTrue("WebView completed JavaScript: " + script.substring(0, Math.min(script.length(), 120)), done.await(10, TimeUnit.SECONDS)); return result.get();
    }
    private void until(ActivityScenario<MainActivity> activity, String expression) throws Exception {
        long end = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < end) {
            if ("true".equals(js(activity, "Boolean(" + expression + ")"))) return;
            Thread.sleep(100);
        }
        fail("Timed out: " + expression);
    }

    private AccessibilityNodeInfo find(AccessibilityNodeInfo node, java.util.function.Predicate<AccessibilityNodeInfo> match) {
        if (node == null) return null;
        if (match.test(node)) return node;
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo result = find(node.getChild(i), match);
            if (result != null) return result;
        }
        return null;
    }
    private boolean click(AccessibilityNodeInfo node) {
        while (node != null) {
            if (node.isClickable() && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true;
            node = node.getParent();
        }
        return false;
    }
    private AccessibilityNodeInfo pickerRoot() throws Exception {
        long end = System.currentTimeMillis() + 20000;
        while (System.currentTimeMillis() < end) {
            AccessibilityNodeInfo root = InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
            if (root != null && String.valueOf(root.getPackageName()).contains("documentsui")) return root;
            Thread.sleep(100);
        }
        throw new AssertionError("Android document picker did not open");
    }
    private byte[] shellFile(String filename) throws Exception {
        // Only read this test's unique synthetic output; never inspect saved user files.
        try (InputStream in = new android.os.ParcelFileDescriptor.AutoCloseInputStream(
                InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("cat /sdcard/Download/" + filename));
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toByteArray();
        }
    }
    private String systemSave(ActivityScenario<MainActivity> activity, String filename) throws Exception {
        AccessibilityNodeInfo root = pickerRoot();
        // Allow the native Activity to stop fully behind DocumentsUI.
        Thread.sleep(1500);
        root = pickerRoot();
        AccessibilityNodeInfo drawer = find(root, node -> String.valueOf(node.getContentDescription()).equals("Show roots"));
        if (drawer != null) {
            assertTrue("Open provider drawer", click(drawer));
            Thread.sleep(200);
            root = pickerRoot();
            AccessibilityNodeInfo downloads = find(root, node -> "Downloads".equals(String.valueOf(node.getText())));
            assertNotNull("Downloads provider available", downloads);
            assertTrue("Select Downloads provider", click(downloads));
            Thread.sleep(200);
            root = pickerRoot();
        }
        AccessibilityNodeInfo name = find(root, AccessibilityNodeInfo::isEditable);
        assertNotNull("Document filename field exists", name);
        android.os.Bundle args = new android.os.Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, filename);
        assertTrue("Set unique synthetic filename", name.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args));
        Thread.sleep(200);
        root = pickerRoot();
        AccessibilityNodeInfo save = find(root, node -> node.isEnabled() && (
            "SAVE".equalsIgnoreCase(String.valueOf(node.getText())) || "保存".equals(String.valueOf(node.getText()))));
        assertNotNull("System Save button exists", save);
        assertTrue("Click system Save", click(save));
        until(activity, "window.__exportOutcome");
        assertEquals("Native save callback completed", "true", js(activity, "window.__exportOutcome.saved === true"));
        String expected = new org.json.JSONArray("[" + js(activity, "window.__exportExpected") + "]").getString(0);
        byte[] actual = shellFile(filename);
        assertArrayEquals("Real Downloads file exactly matches exported UTF-8 bytes", expected.getBytes(StandardCharsets.UTF_8), actual);
        assertEquals("true", js(activity, "location.origin === 'https://localhost'"));
        System.out.println("Verified Downloads output " + filename + ": " + actual.length + " bytes");
        return new String(actual, StandardCharsets.UTF_8);
    }
    private void importUidFile(ActivityScenario<MainActivity> activity, String text, String filename) throws Exception {
        until(activity, "document.querySelector('.mys-backup input[type=file]') && Array.from(document.querySelectorAll('.mys-backup button')).some(b=>b.textContent.includes('导入') && !b.disabled)");
        js(activity, "(()=>{const f=document.querySelector('.mys-backup input[type=file]'),d=new DataTransfer();d.items.add(new File([" +
            org.json.JSONObject.quote(text) + "]," + org.json.JSONObject.quote(filename) +
            ",{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()");
        until(activity, "Array.from(document.querySelectorAll('.mys-import-record strong')).some(e=>e.textContent.includes(" + org.json.JSONObject.quote(filename) + "))");
    }

    @Test public void realPickerSavesUidAndArtifactsAsCompleteReimportableFiles() throws Exception {
        String fixture;
        try (InputStream in = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("synthetic-uid.json");
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            fixture = out.toString("UTF-8");
        }
        org.json.JSONObject pack = new org.json.JSONObject(fixture);
        org.json.JSONArray inventory = pack.getJSONArray("artifacts");
        org.json.JSONObject seed = inventory.getJSONObject(0);
        for (int i = inventory.length(); i < 2500; i++) {
            org.json.JSONObject artifact = new org.json.JSONObject(seed.toString());
            artifact.put("id", 10000 + i);
            artifact.put("level", 0);
            artifact.getJSONObject("mainTag").put("value", 717);
            inventory.put(artifact);
        }
        fixture = pack.toString();
        String run = Long.toString(System.currentTimeMillis());
        String uidFilename = "mona-synthetic-uid-" + run + ".json";
        String artifactFilename = "mona-synthetic-artifacts-" + run + ".json";
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            until(activity, "window.Capacitor && document.querySelector('.mobile-bottom-nav')");
            js(activity, "location.hash='/uid-data'");
            importUidFile(activity, fixture, "synthetic-source-" + run + ".json");
            until(activity, "document.body.innerText.includes('此 UID 将导出 2500 件圣遗物')");
            // Observe the existing public bridge without substituting the picker or storage.
            js(activity, "(()=>{const original=window.Capacitor.nativePromise.bind(window.Capacitor);window.Capacitor.nativePromise=(p,m,o)=>{if(p==='MonaLocal'&&m==='saveFile'){window.__exportExpected=o.text;window.__exportOutcome=null;return original(p,m,o).then(r=>{window.__exportOutcome=r;return r}).catch(e=>{window.__exportOutcome={error:e.message};throw e})}return original(p,m,o)}})()");
            js(activity, "Array.from(document.querySelectorAll('.mys-backup button')).find(b=>b.textContent.includes('导出此 UID')).click()");
            String uidText = systemSave(activity, uidFilename);
            org.json.JSONObject savedUid = new org.json.JSONObject(uidText);
            assertEquals("mona-uid", savedUid.getString("format"));
            assertEquals("444444444", savedUid.getString("uid"));
            assertEquals(4, savedUid.getJSONArray("characters").length());
            assertEquals(2500, savedUid.getJSONArray("artifacts").length());
            importUidFile(activity, uidText, uidFilename);
            until(activity, "Array.from(document.querySelectorAll('.mys-import-record')).some(e=>e.textContent.includes(" +
                org.json.JSONObject.quote(uidFilename) + ") && e.textContent.includes('新增 0 件'))");
            js(activity, "location.hash='/artifacts'");
            until(activity, "document.querySelectorAll('.toolbar-mobile .el-dropdown').length===2");
            js(activity, "document.querySelectorAll('.toolbar-mobile .el-dropdown')[1].querySelector('button').click()");
            until(activity, "Array.from(document.querySelectorAll('.el-dropdown-menu__item')).some(e=>e.getClientRects().length && e.textContent.includes('导出莫娜JSON'))");
            js(activity, "Array.from(document.querySelectorAll('.el-dropdown-menu__item')).find(e=>e.getClientRects().length && e.textContent.includes('导出莫娜JSON')).click()");
            String artifactText = systemSave(activity, artifactFilename);
            org.json.JSONObject savedArtifacts = new org.json.JSONObject(artifactText);
            assertEquals("1", savedArtifacts.getString("version"));
            int total = 0;
            for (String slot : new String[]{"flower","feather","sand","cup","head"}) total += savedArtifacts.getJSONArray(slot).length();
            assertEquals(2500, total);
            js(activity, "document.querySelectorAll('.toolbar-mobile .el-dropdown')[1].querySelector('button').click()");
            until(activity, "Array.from(document.querySelectorAll('.el-dropdown-menu__item')).some(e=>e.getClientRects().length && e.textContent.trim()==='导入')");
            js(activity, "Array.from(document.querySelectorAll('.el-dropdown-menu__item')).find(e=>e.getClientRects().length && e.textContent.trim()==='导入').click()");
            until(activity, "document.querySelector('.el-dialog input[type=file]')");
            js(activity, "(()=>{const f=document.querySelector('.el-dialog input[type=file]'),d=new DataTransfer();d.items.add(new File([" +
                org.json.JSONObject.quote(artifactText) + "]," + org.json.JSONObject.quote(artifactFilename) +
                ",{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()");
            until(activity, "document.body.innerText.includes(" + org.json.JSONObject.quote(artifactFilename) + ")");
            js(activity, "(()=>{const original=console.log;window.__artifactImportResult=null;console.log=(...args)=>{if(String(args[0]).startsWith('import result:'))window.__artifactImportResult=String(args[0]);original.apply(console,args)}})()");
            js(activity, "Array.from(document.querySelectorAll('.el-dialog__footer button')).find(b=>b.textContent.trim()==='确定').click()");
            until(activity, "window.__artifactImportResult==='import result: skip2500, upgrade0, new0, remove0'");
            until(activity, "!Array.from(document.querySelectorAll('.el-loading-mask,.el-dialog')).some(d=>d.getClientRects().length)");
            assertEquals("Artifact file accepted by real importer", "false", js(activity, "document.body.innerText.includes('格式不正确')"));
            System.out.println("UID and artifact exports both reimported through the app.");
        }
    }
}
