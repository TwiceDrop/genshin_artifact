using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Windows.Forms;

internal static class TrayLauncher
{
    internal const string ProductName = "莫娜占卜铺 " + LauncherBuild.DisplayVersion;
    internal const string PageUrl = "http://127.0.0.1:4184/#/calculate";
    internal const string MutexName = "Local\\MonaArtifactLauncher4184";
    internal const string OpenEventName = "Local\\MonaArtifactLauncher4184.Open";

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        using (var openEvent = new EventWaitHandle(false, EventResetMode.AutoReset, OpenEventName))
        using (var mutex = new Mutex(false, MutexName))
        {
            bool owns;
            try { owns = mutex.WaitOne(0); }
            catch (AbandonedMutexException) { owns = true; }
            if (!owns)
            {
                openEvent.Set();
                return;
            }
            try
            {
                using (var app = new TrayApp(AppDomain.CurrentDomain.BaseDirectory, openEvent, url => Process.Start(new ProcessStartInfo(url) { UseShellExecute = true })))
                    Application.Run(app);
            }
            finally { mutex.ReleaseMutex(); }
        }
    }
}

internal sealed class LogWindow : Form
{
    private readonly TextBox output;

    internal LogWindow(Icon icon)
    {
        Text = TrayLauncher.ProductName + " · 日志";
        Icon = icon;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(880, 420);
        MinimumSize = new Size(600, 280);
        output = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            WordWrap = false,
            ScrollBars = ScrollBars.Both,
            BackColor = Color.FromArgb(24, 24, 28),
            ForeColor = Color.FromArgb(230, 230, 235),
            BorderStyle = BorderStyle.None,
            Font = new Font("Consolas", 10),
            MaxLength = 0
        };
        Controls.Add(output);
    }

    internal void Append(string line)
    {
        output.AppendText(line + Environment.NewLine);
    }

    internal void Open()
    {
        Show();
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            Hide();
        }
        base.OnFormClosing(e);
    }
}

internal sealed class TrayApp : ApplicationContext
{
    private readonly string root;
    private readonly EventWaitHandle openEvent;
    private readonly Action<string> openPage;
    private readonly Icon icon;
    private readonly NotifyIcon tray;
    private readonly ContextMenuStrip menu;
    private readonly LogWindow logWindow;
    private readonly System.Windows.Forms.Timer timer;
    private readonly ConcurrentQueue<string> lines = new ConcurrentQueue<string>();
    private Process server;
    private volatile bool ready;
    private bool running;
    private bool guardActive;
    private bool openWhenReady = true;
    private bool stopping;
    private volatile bool updateRequested;
    private DateTime restartAt;

    internal TrayApp(string root, EventWaitHandle openEvent, Action<string> openPage)
    {
        this.root = root;
        this.openEvent = openEvent;
        this.openPage = openPage;
        icon = Icon.ExtractAssociatedIcon(typeof(TrayLauncher).Assembly.Location);
        logWindow = new LogWindow(icon);
        menu = new ContextMenuStrip();
        menu.Items.Add("打开界面", null, (s, e) => OpenInterface());
        menu.Items.Add("关闭莫娜占卜铺", null, (s, e) => ExitThread());
        tray = new NotifyIcon
        {
            Text = TrayLauncher.ProductName,
            Icon = icon,
            ContextMenuStrip = menu,
            Visible = true
        };
        tray.DoubleClick += (s, e) => OpenInterface();
        logWindow.FormClosing += (s, e) =>
        {
            if (e.CloseReason == CloseReason.WindowsShutDown) ExitThread();
        };
        timer = new System.Windows.Forms.Timer { Interval = 200 };
        timer.Tick += (s, e) => Tick();
        logWindow.Show();
        Log("启动 " + TrayLauncher.ProductName);
        StartServer();
        DrainLogs();
        timer.Start();
    }

    private void Log(string line)
    {
        lines.Enqueue("[" + DateTime.Now.ToString("HH:mm:ss") + "] " + line);
    }

    private void DrainLogs()
    {
        string line;
        while (lines.TryDequeue(out line)) logWindow.Append(line);
    }

    private void StartServer()
    {
        ready = false;
        running = false;
        restartAt = DateTime.MinValue;
        var start = new ProcessStartInfo(Path.Combine(root, "runtime", "node.exe"),
            "\"" + Path.Combine(root, "script", "start-local.mjs") + "\" --tray --no-browser")
        {
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        start.EnvironmentVariables["MONA_PORT"] = "4184";
        start.EnvironmentVariables["MONA_LAUNCHER_PID"] = Process.GetCurrentProcess().Id.ToString();
        var child = new Process { StartInfo = start };
        server = child;
        child.OutputDataReceived += (s, e) =>
        {
            if (e.Data == null) return;
            if (e.Data == "MONA_LAUNCHER_READY") ready = true;
            else if (e.Data == "MONA_LAUNCHER_UPDATE") updateRequested = true;
            else Log(e.Data);
        };
        child.ErrorDataReceived += (s, e) =>
        {
            if (e.Data != null) Log("[错误] " + e.Data);
        };
        try
        {
            child.Start();
            child.BeginOutputReadLine();
            child.BeginErrorReadLine();
            Log("本地服务进程已启动，PID " + child.Id);
        }
        catch (System.ComponentModel.Win32Exception e)
        {
            Log("[错误] 启动失败：" + e.Message);
            child.Dispose();
            server = null;
            if (guardActive) restartAt = DateTime.UtcNow.AddSeconds(2);
            logWindow.Open();
        }
    }

    private void Tick()
    {
        if (updateRequested) { ExitThread(); return; }
        DrainLogs();
        if (ready && !running)
        {
            running = true;
            guardActive = true;
            if (openWhenReady)
            {
                openWhenReady = false;
                OpenInterface();
            }
        }
        if (openEvent.WaitOne(0)) OpenInterface();
        if (server != null && server.HasExited)
        {
            server.WaitForExit();
            Log("本地服务已退出，退出码 " + server.ExitCode);
            server.Dispose();
            server = null;
            ready = false;
            running = false;
            if (guardActive)
            {
                Log("托盘守护正在重启本地服务。");
                restartAt = DateTime.UtcNow.AddSeconds(2);
            }
            else logWindow.Open();
        }
        if (server == null && restartAt != DateTime.MinValue && DateTime.UtcNow >= restartAt)
            StartServer();
        DrainLogs();
    }

    private void OpenInterface()
    {
        logWindow.Open();
        if (!running) return;
        try
        {
            openPage(TrayLauncher.PageUrl);
            Log("已打开界面：" + TrayLauncher.PageUrl);
        }
        catch (System.ComponentModel.Win32Exception e)
        {
            Log("[错误] 无法打开浏览器：" + e.Message);
        }
    }

    private void StopServer()
    {
        if (server == null) return;
        if (!server.HasExited)
        {
            try
            {
                server.StandardInput.WriteLine("shutdown");
                server.StandardInput.Flush();
            }
            catch (IOException e) { Log("[错误] 关闭服务通信：" + e.Message); }
            catch (InvalidOperationException e) { Log("[错误] 关闭服务通信：" + e.Message); }
            if (!server.WaitForExit(5000))
            {
                Log("正在结束本地服务进程，PID " + server.Id);
                try { server.Kill(); }
                catch (InvalidOperationException e) { Log("关闭服务进程：" + e.Message); }
                server.WaitForExit();
            }
        }
        server.WaitForExit();
        server.Dispose();
        server = null;
    }

    protected override void ExitThreadCore()
    {
        if (stopping) return;
        stopping = true;
        timer.Stop();
        StopServer();
        DrainLogs();
        tray.Visible = false;
        tray.Dispose();
        menu.Dispose();
        timer.Dispose();
        logWindow.Dispose();
        icon.Dispose();
        base.ExitThreadCore();
    }
}
