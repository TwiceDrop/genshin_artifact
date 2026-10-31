using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class HoyolabLogin : Form {
    readonly WebView2 web = new WebView2();
    readonly Button done = new Button { Text = "完成登录", Dock = DockStyle.Bottom, Height = 44 };
    readonly Label status = new Label { Text = "请在官方页面登录，完成后点击下方按钮", Dock = DockStyle.Top, Height = 32 };
    readonly string profile;
    bool completed;
    HoyolabLogin(string directory) {
        profile = directory; Text = "HoYoLAB 官方登录"; Width = 1050; Height = 780;
        web.Dock = DockStyle.Fill; Controls.Add(web); Controls.Add(status); Controls.Add(done);
        done.Enabled = false; done.Click += Finish;
        Shown += Initialize;
        FormClosed += delegate { if (!completed) Environment.ExitCode = 2; web.Dispose(); };
    }
    async void Initialize(object sender, EventArgs args) {
        try {
            Directory.CreateDirectory(profile);
            var environment = await CoreWebView2Environment.CreateAsync(null, profile);
            await web.EnsureCoreWebView2Async(environment);
            // Keep WebView2's native popup behavior: the official security page
            // reports completion through window.parent.opener.postMessage().
            web.CoreWebView2.Navigate("https://www.hoyolab.com/home");
            done.Enabled = true;
        } catch (Exception e) { status.Text = "登录窗口启动失败：" + e.Message; }
    }
    async void Finish(object sender, EventArgs args) {
        done.Enabled = false;
        try {
            var cookies = await web.CoreWebView2.CookieManager.GetCookiesAsync("https://www.hoyolab.com/");
            var names = new HashSet<string>(new [] { "ltoken", "ltuid", "cookie_token", "account_id", "ltoken_v2", "ltuid_v2", "cookie_token_v2", "account_id_v2", "ltmid_v2", "account_mid_v2", "mid" });
            var values = cookies.Where(c => names.Contains(c.Name)).GroupBy(c => c.Name).ToDictionary(g => g.Key, g => g.First().Value);
            if (!(values.ContainsKey("ltoken") || values.ContainsKey("ltoken_v2")) || !(values.ContainsKey("cookie_token") || values.ContainsKey("cookie_token_v2"))) {
                status.Text = "尚未取得完整登录信息，请先完成 HoYoLAB 登录后再点击。"; return;
            }
            var cookie = String.Join(";", values.Select(p => p.Key + "=" + p.Value)) + ";";
            Console.Write(new JavaScriptSerializer().Serialize(new { cookie = cookie }));
            completed = true; Close();
        } catch (Exception e) { status.Text = "读取登录结果失败：" + e.Message; }
        finally { if (!completed) done.Enabled = true; }
    }
    [STAThread] static void Main(string[] args) {
        if (args.Length != 1) { Environment.ExitCode = 2; return; }
        Application.EnableVisualStyles(); Application.Run(new HoyolabLogin(args[0]));
    }
}
