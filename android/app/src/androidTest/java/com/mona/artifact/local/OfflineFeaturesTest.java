package com.mona.artifact.local;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class OfflineFeaturesTest {
    private String js(ActivityScenario<MainActivity> activity, String code) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        activity.onActivity(a -> a.getBridge().getWebView().evaluateJavascript(code, text -> { result.set(text); done.countDown(); }));
        assertTrue("JavaScript returned", done.await(10, TimeUnit.SECONDS));
        return result.get();
    }
    private void until(ActivityScenario<MainActivity> activity, String expression) throws Exception {
        long limit = System.currentTimeMillis() + 45000;
        while (System.currentTimeMillis() < limit) {
            if ("true".equals(js(activity, "Boolean(" + expression + ")"))) return;
            Thread.sleep(200);
        }
        fail("Timed out: " + expression + "\n" + js(activity, "document.body.innerText.slice(-3000)"));
    }
    private void importFile(ActivityScenario<MainActivity> activity, String content, String filename) throws Exception {
        until(activity, "document.querySelector('.mys-backup input[type=file]') && Array.from(document.querySelectorAll('.mys-backup button')).some(b=>b.textContent.includes('导入') && !b.disabled)");
        js(activity, "(()=>{const f=document.querySelector('.mys-backup input[type=file]'),d=new DataTransfer();d.items.add(new File([" + JSONObject.quote(content) + "]," + JSONObject.quote(filename) + ",{type:'application/json'}));f.files=d.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()");
        until(activity, "Array.from(document.querySelectorAll('.mys-import-record strong')).some(e=>e.textContent.includes(" + JSONObject.quote(filename) + "))");
    }

    @Test public void uidImportDuplicateUndoAndRestartWorkInNativeOfflineWebView() throws Exception {
        String fixture;
        try (InputStream stream = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("synthetic-uid.json")) {
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[8192]; int n;
            while ((n = stream.read(buffer)) >= 0) output.write(buffer, 0, n);
            fixture = output.toString("UTF-8");
        }
        String first = "native-import-" + System.currentTimeMillis() + ".json", duplicate = "repeat-" + first;
        try (ActivityScenario<MainActivity> activity = ActivityScenario.launch(MainActivity.class)) {
            until(activity, "window.Capacitor && document.querySelector('.mobile-bottom-nav')");
            assertEquals("\"https://localhost\"", js(activity, "location.origin"));
            js(activity, "location.hash='/uid-data'");
            importFile(activity, fixture, first);
            until(activity, "document.body.innerText.includes('444444444') && document.body.innerText.includes('21 件圣遗物')");
            importFile(activity, fixture, duplicate);
            until(activity, "Array.from(document.querySelectorAll('.mys-import-record')).some(e=>e.textContent.includes(" + JSONObject.quote(duplicate) + ") && e.textContent.includes('新增 0 件'))");
            activity.recreate();
            until(activity, "window.Capacitor && document.querySelector('.mobile-bottom-nav')");
            js(activity, "location.hash='/uid-data'");
            until(activity, "Array.from(document.querySelectorAll('.mys-import-record')).some(e=>e.textContent.includes(" + JSONObject.quote(duplicate) + ") && !e.querySelector('button').disabled)");
            js(activity, "Array.from(document.querySelectorAll('.mys-import-record')).find(e=>e.textContent.includes(" + JSONObject.quote(duplicate) + ")).querySelector('button').click()");
            until(activity, "Array.from(document.querySelectorAll('.mys-import-record')).some(e=>e.textContent.includes(" + JSONObject.quote(duplicate) + ") && e.textContent.includes('已撤销'))");
            assertEquals("true", js(activity, "document.body.innerText.includes('21 件圣遗物')"));
            js(activity, "location.hash='/calculate'");
            until(activity, "document.body.innerText.includes('是否允许替换其他角色已穿戴')");
            js(activity, "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='圣遗物与伤害').click()");
            until(activity, "document.body.innerText.includes('圣遗物总分') && document.body.innerText.includes('期望伤害')");
            until(activity, "document.querySelector('.el-table__body td') && !document.body.innerText.includes('WebAssembly.instantiate')");
            js(activity, "Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='面板与曲线').click()");
            until(activity, "document.body.innerText.includes('最优收益曲线') && document.body.innerText.includes('词条收益曲线') && document.body.innerText.includes('暴击率')");
        }
    }
}
