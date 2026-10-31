package com.mona.artifact.local;

import android.webkit.WebView;
import android.widget.Button;
import android.view.View;
import android.view.ViewGroup;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class HoyolabLoginDialogTest {
    private void ui(Runnable action) { InstrumentationRegistry.getInstrumentation().runOnMainSync(action); }
    @SuppressWarnings("unchecked") private ArrayList<WebView> windows(HoyolabLoginDialog dialog) {
        try { Field f=HoyolabLoginDialog.class.getDeclaredField("windows"); f.setAccessible(true); return (ArrayList<WebView>)f.get(dialog); }
        catch(Exception e) { throw new AssertionError(e); }
    }
    private String js(WebView web,String script) throws Exception {
        CountDownLatch done=new CountDownLatch(1); AtomicReference<String> value=new AtomicReference<>();
        ui(()->web.evaluateJavascript(script,v->{value.set(v);done.countDown();}));
        assertTrue("JavaScript callback",done.await(5,TimeUnit.SECONDS));return value.get();
    }
    private void count(HoyolabLoginDialog dialog,int expected) throws Exception {
        AtomicInteger actual=new AtomicInteger();
        for(int i=0;i<50;i++){ui(()->actual.set(windows(dialog).size()));if(actual.get()==expected)return;Thread.sleep(100);}
        assertEquals("Native window count",expected,actual.get());
    }
    private Button button(View view,String text) {
        if(view instanceof Button && text.contentEquals(((Button)view).getText()))return (Button)view;
        if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++){Button found=button(((ViewGroup)view).getChildAt(i),text);if(found!=null)return found;}
        return null;
    }

    @Test public void realWebViewPreservesOpenerCallbackAndSiblingWindows() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<HoyolabLoginDialog> ref=new AtomicReference<>(); AtomicInteger cancelled=new AtomicInteger();
            scenario.onActivity(a->{HoyolabLoginDialog d=new HoyolabLoginDialog(a,new HoyolabLoginDialog.Result(){
                public void complete(String cookie){fail("No real login in synthetic test");}
                public void cancelled(){cancelled.incrementAndGet();}
            });ref.set(d);d.open("about:blank");});
            HoyolabLoginDialog dialog=ref.get(); WebView root=windows(dialog).get(0);
            try {
                js(root,"window.received=0;window.addEventListener('message',e=>{if(e.data.type==='syncLoginStatusCallback')window.received++});window.first=window.open('about:blank');'opened'");
                count(dialog,2); WebView first=windows(dialog).get(1);
                assertEquals("true",js(first,"!!window.parent.opener"));
                js(first,"window.parent.opener.postMessage({type:'syncLoginStatusCallback'},'*');'sent'");
                String received="0";for(int i=0;i<30;i++){received=js(root,"window.received");if("1".equals(received))break;Thread.sleep(100);}
                assertEquals("Original login page receives official-shaped callback","1",received);
                js(root,"window.second=window.open('about:blank');'opened'");count(dialog,3);
                WebView second=windows(dialog).get(2);
                js(first,"window.close();'closed'");count(dialog,2);
                assertSame("Sibling opened by root survives",second,windows(dialog).get(1));
                ui(dialog::onBackPressed);count(dialog,1);
                assertEquals(0,cancelled.get());
                ui(dialog::dismiss);count(dialog,0);assertEquals(1,cancelled.get());
            } finally { ui(dialog::dismiss); }
        }
    }

    @Test public void incompleteLoginStaysOpenAndBackCancelsOnce() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            AtomicReference<HoyolabLoginDialog> ref=new AtomicReference<>();AtomicInteger cancelled=new AtomicInteger();
            scenario.onActivity(a->{HoyolabLoginDialog d=new HoyolabLoginDialog(a,new HoyolabLoginDialog.Result(){
                public void complete(String cookie){fail("No cookies were supplied");}
                public void cancelled(){cancelled.incrementAndGet();}
            });ref.set(d);d.open("about:blank");});
            HoyolabLoginDialog dialog=ref.get();
            ui(()->button(dialog.getWindow().getDecorView(),"完成登录").performClick());
            assertTrue(dialog.isShowing());assertEquals(0,cancelled.get());
            ui(dialog::onBackPressed);count(dialog,0);assertEquals(1,cancelled.get());
            ui(dialog::dismiss);assertEquals(1,cancelled.get());
        }
    }
}
