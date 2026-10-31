package com.mona.artifact.local;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

/** Owns the official login page and its popup WebViews until completion/cancellation. */
final class HoyolabLoginDialog extends Dialog {
    interface Result { void complete(String cookie); void cancelled(); }
    private final Activity activity;
    private final Result result;
    private final LinearLayout layout;
    private final FrameLayout pages;
    private final TextView status;
    private final ArrayList<WebView> windows = new ArrayList<>();
    private final Map<WebView, WebView> parents = new HashMap<>();
    private boolean completed;

    HoyolabLoginDialog(Activity activity, Result result) {
        super(activity, android.R.style.Theme_Material_Light_NoActionBar);
        this.activity = activity; this.result = result;
        layout = new LinearLayout(activity); layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.WHITE);
        LinearLayout actions = new LinearLayout(activity);
        Button back = new Button(activity); back.setText("返回"); back.setOnClickListener(v -> onBackPressed());
        Button close = new Button(activity); close.setText("取消登录"); close.setOnClickListener(v -> dismiss());
        actions.addView(back, new LinearLayout.LayoutParams(0, -2, 1));
        actions.addView(close, new LinearLayout.LayoutParams(0, -2, 1));
        layout.addView(actions);
        status = new TextView(activity); status.setText("请在官方页面登录，完成后点击下方按钮");
        layout.addView(status);
        pages = new FrameLayout(activity); layout.addView(pages, new LinearLayout.LayoutParams(-1, 0, 1));
        Button done = new Button(activity); done.setText("完成登录"); done.setOnClickListener(v -> finishLogin());
        layout.addView(done);
        setContentView(layout);
        setOnDismissListener(d -> {
            for (WebView web : new ArrayList<>(windows)) { pages.removeView(web); web.stopLoading(); web.destroy(); }
            windows.clear();
            parents.clear();
            if (!completed) result.cancelled();
        });
    }

    @Override protected void onStart() {
        super.onStart();
        getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        SafeViewport.install(layout);
    }

    void open(String url) { show(); createPage(null).loadUrl(url); }

    private WebView createPage(WebView opener) {
        WebView web = new WebView(activity);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setUseWideViewPort(true);
        web.getSettings().setLoadWithOverviewMode(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setSupportMultipleWindows(true);
        web.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) status.setText("页面加载失败（" + error.getErrorCode() + "）：" + error.getDescription());
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) status.setText("页面加载失败：HTTP " + response.getStatusCode());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView parent, boolean dialog, boolean userGesture, Message message) {
                // Hand Chromium the actual child WebView; do not navigate the parent.
                // The security page uses window.parent.opener.postMessage to finish login.
                WebView child = createPage(parent);
                ((WebView.WebViewTransport) message.obj).setWebView(child);
                message.sendToTarget();
                return true;
            }
            @Override public void onCloseWindow(WebView window) { closePage(window); }
        });
        if (!windows.isEmpty()) windows.get(windows.size() - 1).setVisibility(View.GONE);
        windows.add(web); parents.put(web, opener); pages.addView(web, new FrameLayout.LayoutParams(-1, -1)); web.requestFocus();
        return web;
    }

    private void closePage(WebView web) {
        int index = windows.indexOf(web);
        if (index == 0) { dismiss(); return; }
        if (index < 0) return;
        // A callback can open a sibling before the first popup closes.
        // Close this window and its descendants, preserving those sibling windows.
        for (int i = windows.size() - 1; i >= 0; i--) {
            WebView candidate = windows.get(i), ancestor = candidate;
            while (ancestor != null && ancestor != web) ancestor = parents.get(ancestor);
            if (ancestor != web) continue;
            windows.remove(i); parents.remove(candidate); pages.removeView(candidate); candidate.stopLoading(); candidate.destroy();
        }
        WebView current = windows.get(windows.size() - 1); current.setVisibility(View.VISIBLE); current.requestFocus();
    }

    @Override public void onBackPressed() {
        if (windows.size() > 1) closePage(windows.get(windows.size() - 1));
        else if (!windows.isEmpty() && windows.get(0).canGoBack()) windows.get(0).goBack();
        else dismiss();
    }

    private void finishLogin() {
        String cookie = CookieManager.getInstance().getCookie("https://www.hoyolab.com/");
        Map<String, String> values = new HashMap<>();
        if (cookie != null) for (String part : cookie.split(";")) {
            int at = part.indexOf('=');
            if (at > 0 && !part.substring(at + 1).trim().isEmpty()) values.put(part.substring(0, at).trim(), part.substring(at + 1).trim());
        }
        if (!(values.containsKey("ltoken") || values.containsKey("ltoken_v2")) || !(values.containsKey("cookie_token") || values.containsKey("cookie_token_v2"))) {
            status.setText("尚未取得完整登录信息，请完成 HoYoLAB 登录后重试。"); return;
        }
        completed = true;
        CookieManager.getInstance().flush();
        result.complete(cookie);
        dismiss();
    }
}
