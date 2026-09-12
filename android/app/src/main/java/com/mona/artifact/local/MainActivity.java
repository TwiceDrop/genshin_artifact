package com.mona.artifact.local;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(MonaLocalPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.view.WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        // Resize the native viewport, not WebView's internal padding: CSS fixed
        // elements and teleported dialogs must share the same safe rectangle.
        android.view.View container = (android.view.View) bridge.getWebView().getParent();
        container.setBackgroundColor(android.graphics.Color.WHITE);
        SafeViewport.install(container);
    }
}
