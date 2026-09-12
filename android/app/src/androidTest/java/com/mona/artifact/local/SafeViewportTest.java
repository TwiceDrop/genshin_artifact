package com.mona.artifact.local;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.coordinatorlayout.widget.CoordinatorLayout;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SafeViewportTest {
    @Test public void nativeViewportAvoidsBarsCutoutAndKeyboardWithoutAccumulatingPadding() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            CoordinatorLayout container = new CoordinatorLayout(InstrumentationRegistry.getInstrumentation().getTargetContext());
            WebView web = new WebView(container.getContext());
            container.addView(web, new CoordinatorLayout.LayoutParams(-1, -1));
            SafeViewport.install(container);
            // Gesture navigation, three buttons, landscape cutout, IME, then dismissed.
            int[][] cases = {{0,32,0,24,0}, {0,32,0,48,0}, {58,0,24,0,0}, {0,32,0,24,320}, {0,32,0,24,0}};
            for (int[] c : cases) {
                WindowInsetsCompat input = new WindowInsetsCompat.Builder()
                    .setInsets(WindowInsetsCompat.Type.systemBars(), Insets.of(0,c[1],c[2],c[3]))
                    .setInsets(WindowInsetsCompat.Type.displayCutout(), Insets.of(c[0],0,0,0))
                    .setInsets(WindowInsetsCompat.Type.ime(), Insets.of(0,0,0,c[4])).build();
                WindowInsetsCompat remaining = ViewCompat.dispatchApplyWindowInsets(container, input);
                container.measure(View.MeasureSpec.makeMeasureSpec(400, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(850, View.MeasureSpec.EXACTLY));
                container.layout(0,0,400,850);
                assertEquals(c[0], web.getLeft());
                assertEquals(c[1], web.getTop());
                assertEquals(400-c[2], web.getRight());
                assertEquals(850-Math.max(c[3],c[4]), web.getBottom());
                assertEquals(0, web.getPaddingTop());
                assertEquals(Insets.NONE, remaining.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime()));
            }
            web.destroy();
        });
    }

    @Test public void activityUsesSafeNativeContainerOnDevice() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            scenario.onActivity(activity -> {
                WebView web = activity.getBridge().getWebView();
                ViewGroup container = (ViewGroup) web.getParent();
                WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(container);
                assertNotNull(insets);
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                assertTrue("Device has a visible status bar", bars.top > 0);
                assertEquals(bars.top, container.getPaddingTop());
                assertEquals(bars.bottom, container.getPaddingBottom());
                assertTrue(web.getTop() >= bars.top);
                assertTrue(web.getBottom() <= container.getHeight() - bars.bottom);
            });
        }
    }
}
