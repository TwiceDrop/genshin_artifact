using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyVersion("7.1.4.0")]
[assembly: System.Reflection.AssemblyFileVersion("7.1.4.0")]
internal static class Launcher {
    [STAThread] static void Main() {
        Application.EnableVisualStyles();
        using (var mutex = new Mutex(false, "Local\\MonaArtifactLauncher")) {
            bool owns;
            try { owns = mutex.WaitOne(0); } catch (AbandonedMutexException) { owns = true; }
            if (!owns) { Open(); return; }
            try { using (var app = new LocalApp()) Application.Run(app); }
            finally { mutex.ReleaseMutex(); }
        }
    }
    internal static void Open() {
        try { Process.Start(new ProcessStartInfo("http://127.0.0.1:4174/#/calculate") { UseShellExecute = true }); }
        catch (Exception e) { MessageBox.Show(e.Message, "无法打开浏览器"); }
    }
}
internal sealed class LocalApp : ApplicationContext {
    readonly NotifyIcon tray;
    readonly Process server;
    readonly System.Windows.Forms.Timer timer;
    string error = "";
    volatile bool ready;
    bool stopping;
    public LocalApp() {
        var root = AppDomain.CurrentDomain.BaseDirectory;
        tray = new NotifyIcon { Text = "莫娜占卜铺 V7.1.04", Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath), Visible = true };
        var menu = new ContextMenuStrip();
        menu.Items.Add("打开莫娜占卜铺", null, (s,e) => Launcher.Open());
        menu.Items.Add("退出", null, (s,e) => ExitThread());
        tray.ContextMenuStrip = menu;
        tray.DoubleClick += (s,e) => Launcher.Open();
        var start = new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"), "\"" + Path.Combine(root,"script","start-local.mjs") + "\" --no-browser") {
            WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardOutputEncoding = System.Text.Encoding.UTF8, StandardErrorEncoding = System.Text.Encoding.UTF8
        };
        start.EnvironmentVariables["MONA_PORT"] = "4174";
        start.EnvironmentVariables["MONA_DATA_DIR"] = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MonaArtifact","data");
        server = new Process { StartInfo = start };
        server.OutputDataReceived += (s,e) => { if (e.Data != null && (e.Data.Contains("莫娜已启动") || e.Data.Contains("莫娜已在运行"))) ready = true; };
        server.ErrorDataReceived += (s,e) => { if (e.Data != null) error += e.Data + Environment.NewLine; };
        timer = new System.Windows.Forms.Timer { Interval = 200 };
        timer.Tick += (s,e) => {
            if (ready) { ready = false; Launcher.Open(); }
            if (server.HasExited) {
                if (server.ExitCode != 0) MessageBox.Show(string.IsNullOrWhiteSpace(error) ? "本地服务启动失败。请确认 4174 端口没有被其他版本占用。" : error, "莫娜占卜铺");
                ExitThread();
            }
        };
        try { server.Start(); server.BeginOutputReadLine(); server.BeginErrorReadLine(); timer.Start(); }
        catch (Exception e) { tray.Visible = false; MessageBox.Show(e.Message, "启动失败"); throw; }
    }
    protected override void ExitThreadCore() {
        if (stopping) return;
        stopping = true;
        timer.Stop(); timer.Dispose();
        try { if (!server.HasExited) server.Kill(); } catch (InvalidOperationException) { }
        server.Dispose(); tray.Visible = false; tray.Dispose();
        base.ExitThreadCore();
    }
}
