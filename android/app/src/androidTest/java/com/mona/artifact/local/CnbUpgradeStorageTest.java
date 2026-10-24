package com.mona.artifact.local;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import android.content.Context;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONTokener;
import org.json.JSONObject;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Runs only with synthetic data in an isolated acceptance emulator. */
@RunWith(AndroidJUnit4.class)
public class CnbUpgradeStorageTest {
    private Object js(ActivityScenario<MainActivity> activity, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        activity.onActivity(a -> a.getBridge().getWebView().evaluateJavascript(script, result -> {
            value.set(result); done.countDown();
        }));
        assertTrue("WebView response", done.await(10, TimeUnit.SECONDS));
        return new JSONTokener(value.get()).nextValue();
    }
    private void waitFor(ActivityScenario<MainActivity> activity, String script, String wanted) throws Exception {
        long end = System.currentTimeMillis() + 30000;
        Object actual;
        do {
            actual = js(activity, script);
            if (wanted.equals(actual)) return;
            Thread.sleep(150);
        } while (System.currentTimeMillis() < end);
        assertEquals(wanted, actual);
    }
    @Test public void offlineUpgradeKeepsWebStorageAndNativePreferences() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String stage = InstrumentationRegistry.getArguments().getString("stage", "seed");
        String expected = InstrumentationRegistry.getArguments().getString("expectedVersion", "7.1.11");
        assertEquals(expected, context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName);
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            waitFor(activity, "location.origin==='https://localhost'&&document.readyState==='complete'&&window.monaApp?'ready':'waiting'", "ready");
            if ("seed".equals(stage)) {
                context.getSharedPreferences("cnb-acceptance", 0).edit().putString("synthetic", "keep-7111-to-7112").commit();
                js(activity, "localStorage.setItem('mona.automaticReleaseUpdates','false');localStorage.setItem('cnb.acceptance.synthetic','keep-7111-to-7112');window.__cnbStorage='pending';var q=indexedDB.open('localforage');q.onupgradeneeded=function(){q.result.createObjectStore('keyvaluepairs')};q.onsuccess=function(){var d=q.result,t=d.transaction('keyvaluepairs','readwrite');t.objectStore('keyvaluepairs').put({artifacts:[990001,990002,990003,990004,990005],preset:'synthetic'},'cnb-acceptance-synthetic');t.oncomplete=function(){d.close();window.__cnbStorage='seeded'}};");
                waitFor(activity, "window.__cnbStorage", "seeded");
                assertEquals("keep-7111-to-7112", js(activity, "localStorage.getItem('cnb.acceptance.synthetic')"));
                // Instrumentation terminates the process on completion. Keep the WebView
                // alive so its asynchronous localStorage disk write can complete.
                int settleMillis = Integer.parseInt(InstrumentationRegistry.getArguments().getString("settleMillis", "5000"));
                Thread.sleep(settleMillis);
                js(activity, "(()=>{window.__cnbReadback='pending';const q=indexedDB.open('localforage');q.onerror=()=>window.__cnbReadback=String(q.error);q.onsuccess=()=>{const d=q.result,t=d.transaction('keyvaluepairs'),r=t.objectStore('keyvaluepairs').get('cnb-acceptance-synthetic');r.onsuccess=()=>{window.__cnbReadback=JSON.stringify(r.result)||'missing';d.close()};r.onerror=()=>window.__cnbReadback=String(r.error)}})()");
                waitFor(activity, "window.__cnbReadback", "{\"artifacts\":[990001,990002,990003,990004,990005],\"preset\":\"synthetic\"}");
            } else {
                assertEquals("keep-7111-to-7112", context.getSharedPreferences("cnb-acceptance", 0).getString("synthetic", ""));
                assertEquals("keep-7111-to-7112", js(activity, "localStorage.getItem('cnb.acceptance.synthetic')"));
                assertEquals("false", js(activity, "localStorage.getItem('mona.automaticReleaseUpdates')"));
                js(activity, "(()=>{window.__cnbStorage='pending';const q=indexedDB.open('localforage');q.onerror=()=>window.__cnbStorage=String(q.error);q.onsuccess=()=>{const d=q.result,t=d.transaction('keyvaluepairs'),r=t.objectStore('keyvaluepairs').get('cnb-acceptance-synthetic');r.onsuccess=()=>{window.__cnbStorage=JSON.stringify(r.result)||'missing';d.close()};r.onerror=()=>window.__cnbStorage=String(r.error)}})()");
                waitFor(activity, "window.__cnbStorage", "{\"artifacts\":[990001,990002,990003,990004,990005],\"preset\":\"synthetic\"}");
            }
        }
        // WebView destruction also schedules storage work; do not let the test
        // runner kill the process immediately after ActivityScenario.close().
        if ("seed".equals(stage)) Thread.sleep(5000);
    }

    @Test public void actualImportedAccountSurvivesRestartAndUpgrade() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String stage = InstrumentationRegistry.getArguments().getString("stage", "seed");
        String expected = InstrumentationRegistry.getArguments().getString("expectedVersion", "7.1.12");
        assertEquals(expected, context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName);
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            waitFor(activity, "window.monaApp?'ready':'waiting'", "ready");
            if ("seed".equals(stage)) js(activity, "localStorage.setItem('mona.automaticReleaseUpdates','false')");
            else assertEquals("false", js(activity, "localStorage.getItem('mona.automaticReleaseUpdates')"));
            js(activity, "location.hash='/uid-data'");
            waitFor(activity, "document.querySelector('.mys-backup input[type=file]')?'ready':'waiting'", "ready");
            if ("seed".equals(stage)) {
                String fixture;
                try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("synthetic-uid.json"); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192]; int n;
                    while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n);
                    fixture = output.toString("UTF-8");
                }
                js(activity, "(()=>{const f=document.querySelector('.mys-backup input[type=file]'),d=new DataTransfer();d.items.add(new File([" + JSONObject.quote(fixture) + "],'cnb-upgrade-synthetic.json',{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()");
                waitFor(activity, "document.body.innerText.includes('444444444')&&document.body.innerText.includes('21 件圣遗物')?'imported':'waiting'", "imported");
            }
            js(activity, "(()=>{window.__actualStorage='pending';const q=indexedDB.open('localforage');q.onerror=()=>window.__actualStorage=String(q.error);q.onsuccess=()=>{const d=q.result,t=d.transaction('keyvaluepairs'),s=t.objectStore('keyvaluepairs'),keys=['mona_accounts','mona_account_artifacts_1','mona_account_presets_1','mona_account_miyoushe_1'],values={};keys.forEach(k=>{const r=s.get(k);r.onsuccess=()=>values[k]=r.result});t.oncomplete=()=>{window.__actualStorage=JSON.stringify(values);d.close()}}})()");
            waitFor(activity, "window.__actualStorage&&window.__actualStorage!=='pending'?'read':'waiting'", "read");
            String snapshot = (String) js(activity, "window.__actualStorage");
            assertTrue("Stored synthetic account", snapshot.contains("444444444"));
            if ("seed".equals(stage)) {
                assertTrue(context.getSharedPreferences("cnb-acceptance", 0).edit().putString("appSnapshot", snapshot).commit());
                Thread.sleep(5000);
            } else {
                assertEquals("Actual account/artifacts/presets/UID data", context.getSharedPreferences("cnb-acceptance", 0).getString("appSnapshot", ""), snapshot);
                assertEquals("Restored UI", "restored", js(activity, "document.body.innerText.includes('444444444')&&document.body.innerText.includes('21 件圣遗物')?'restored':'missing'"));
            }
        }
        if ("seed".equals(stage)) Thread.sleep(5000);
    }
}
