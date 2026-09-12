package com.mona.artifact.local;

import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

final class SafeViewport {
    private SafeViewport() {}

    static void install(View container) {
        ViewCompat.setOnApplyWindowInsetsListener(container, (view, insets) -> {
            int types = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets bars = insets.getInsets(types);
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            int bottom = Math.max(bars.bottom, ime.bottom);
            view.setPadding(bars.left, bars.top, bars.right, bottom);
            // Pass zero values instead of CONSUMED so WebView also learns when
            // insets disappear after rotating or dismissing the keyboard.
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(types | WindowInsetsCompat.Type.ime(), Insets.NONE)
                .build();
        });
        ViewCompat.requestApplyInsets(container);
    }
}
