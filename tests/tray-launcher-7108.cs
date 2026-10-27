using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public static class TrayLauncherProbe
{
    private const BindingFlags Fields = BindingFlags.Instance | BindingFlags.NonPublic;
    private const string MutexName = "Local\\MonaArtifactLauncher4184";
    private const string EventName = "Local\\MonaArtifactLauncher4184.Open";
    private static T Get<T>(object target, string field)
    {
        return (T)target.GetType().GetField(field, Fields).GetValue(target);
    }
    private static void Require(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
    private static void PumpUntil(Func<bool> condition, string message)
    {
        var watch = Stopwatch.StartNew();
        while (watch.ElapsedMilliseconds < 15000)
        {
            Application.DoEvents();
            if (condition()) return;
            Thread.Sleep(30);
        }
        throw new Exception(message);
    }
    private static string ReadIndex()
    {
        using (var client = new WebClient { Encoding = Encoding.UTF8 }) return Encoding.UTF8.GetString(client.DownloadData("http://127.0.0.1:4184/"));
    }
    private static bool PortClosed()
    {
        try { ReadIndex(); return false; }
        catch (WebException) { return true; }
    }
    private static bool Gone(int pid)
    {
        try { using (var process = Process.GetProcessById(pid)) return process.HasExited; }
        catch (ArgumentException) { return true; }
    }
    private static int failures;
    private static void Check(string name, Action action)
    {
        try { action(); Console.WriteLine("PASS " + name); }
        catch (Exception e) { failures++; Console.WriteLine("FAIL " + name + ": " + e.Message); }
    }
    [STAThread]
    public static int Run(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string root = Path.GetFullPath(args[0]);
        string evidence = Path.GetFullPath(args[1]);
        string exe = Path.Combine(root, "启动7.1.08beta.exe");
        Directory.CreateDirectory(evidence);
        using (var mutex = new Mutex(false, MutexName))
        using (var openEvent = new EventWaitHandle(false, EventResetMode.AutoReset, EventName))
        {
            bool owns;
            try { owns = mutex.WaitOne(0); }
            catch (AbandonedMutexException) { owns = true; }
            Require(owns, "已有启动器正在运行，不能干扰其服务。");
            Require(PortClosed(), "4184 已被使用，不能干扰已有服务。");
            ApplicationContext app = null;
            string openedUrl = null;
            int browserOpens = 0;
            Action<string> openPage = url => { openedUrl = url; browserOpens++; };
            try
            {
                var assembly = Assembly.LoadFrom(exe);
                var type = assembly.GetType("TrayApp", true);
                app = (ApplicationContext)Activator.CreateInstance(type, Fields | BindingFlags.Public, null,
                    new object[] { root, openEvent, openPage }, null);
                type.GetField("openWhenReady", Fields).SetValue(app, false);
                PumpUntil(() => Get<bool>(app, "running"), "服务未就绪。");
                var form = Get<Form>(app, "logWindow");
                var tray = Get<NotifyIcon>(app, "tray");
                var menu = Get<ContextMenuStrip>(app, "menu");
                var timer = Get<System.Windows.Forms.Timer>(app, "timer");
                int pid = Get<Process>(app, "server").Id;
                string expected = File.ReadAllText(Path.Combine(root, "dist", "index.html"));

                Check("1 启动日志、版本与两个托盘菜单", () =>
                {
                    Require(form.Visible && tray.Visible, "日志或托盘未显示。");
                    Require(tray.Text == "莫娜占卜铺 7.1.08beta", "托盘名称错误。");
                    Require(menu.Items.Count == 2 && menu.Items[0].Text == "打开界面" &&
                        menu.Items[1].Text == "关闭莫娜占卜铺", "菜单名称或数量错误。");
                    Require(FileVersionInfo.GetVersionInfo(exe).ProductVersion == "7.1.08beta", "EXE 版本错误。");
                    var output = (TextBox)form.Controls[0];
                    Require(output.Text.Contains("莫娜已启动：http://127.0.0.1:4184/#/calculate"), "真实服务日志未接入。");
                    Require(!output.Text.Contains("MONA_LAUNCHER_READY"), "内部就绪信号进入了显示日志。");
                    string served = ReadIndex();
                    File.WriteAllText(Path.Combine(evidence, "served-index.html"), served);
                    Console.WriteLine("  index chars " + served.Length + "/" + expected.Length);
                    Require(served == expected, "首页内容不匹配：响应长度 " + served.Length + "，构建长度 " + expected.Length + "。");
                    using (var bitmap = new Bitmap(form.Width, form.Height))
                    {
                        form.DrawToBitmap(bitmap, new Rectangle(0, 0, bitmap.Width, bitmap.Height));
                        bitmap.Save(Path.Combine(evidence, "startup-log.png"));
                    }
                    File.WriteAllText(Path.Combine(evidence, "startup-log.txt"), output.Text);
                    Console.WriteLine("  tray=" + tray.Text + "; menu=" + menu.Items[0].Text + ", " + menu.Items[1].Text);
                });

                Check("2 关闭日志仍运行，打开界面可恢复", () =>
                {
                    form.Close();
                    Application.DoEvents();
                    Require(!form.Visible && !form.IsDisposed, "关闭窗口没有隐藏保留。");
                    Require(tray.Visible && Get<Process>(app, "server").Id == pid && ReadIndex() == expected,
                        "关窗口后服务或托盘退出。");
                    menu.Items[0].PerformClick();
                    Application.DoEvents();
                    Require(form.Visible && ReadIndex() == expected, "打开界面未恢复日志和服务。");
                    Require(openedUrl == "http://127.0.0.1:4184/#/calculate" && browserOpens == 1, "打开界面没有调用原访问地址。");
                });

                Check("3 重复 EXE 启动只发送打开信号", () =>
                {
                    timer.Stop();
                    try
                    {
                        openEvent.WaitOne(0);
                        using (var second = Process.Start(new ProcessStartInfo(exe)
                            { UseShellExecute = false, CreateNoWindow = true }))
                        {
                            Require(second.WaitForExit(5000) && second.ExitCode == 0, "第二个启动器未正常退出。");
                        }
                        Require(openEvent.WaitOne(0), "没有通知已有托盘打开界面。");
                        Require(Get<Process>(app, "server").Id == pid && ReadIndex() == expected,
                            "重复启动更换了服务进程。");
                    }
                    finally { timer.Start(); }
                });

                Check("4 服务意外退出后托盘自动重启", () =>
                {
                    Get<Process>(app, "server").Kill();
                    PumpUntil(() => Get<bool>(app, "running") && Get<Process>(app, "server") != null &&
                        Get<Process>(app, "server").Id != pid, "守护没有重启服务。");
                    Require(ReadIndex() == expected && tray.Visible, "重启后服务或托盘不可用。");
                    Require(browserOpens == 1, "守护重启重复打开了浏览器。");
                    Require(((TextBox)form.Controls[0]).Text.Contains("托盘守护正在重启本地服务。"), "重启日志缺失。");
                    Console.WriteLine("  server PID " + pid + " -> " + Get<Process>(app, "server").Id);
                });

                Check("5 托盘关闭停止服务并释放端口", () =>
                {
                    int finalPid = Get<Process>(app, "server").Id;
                    menu.Items[1].PerformClick();
                    PumpUntil(() => Gone(finalPid) && PortClosed(), "托盘退出后仍有后台服务。");
                    Require(!tray.Visible && form.IsDisposed, "托盘或日志窗口未关闭。");
                    Require(Get<Process>(app, "server") == null, "服务对象未释放。");
                    Require(Get<bool>(app, "stopping"), "退出仍允许守护重启。");
                });
                Console.WriteLine("RESULT " + (5 - failures) + "/5 passed");
                return failures == 0 ? 0 : 1;
            }
            finally
            {
                if (app != null) { app.ExitThread(); app.Dispose(); }
                mutex.ReleaseMutex();
            }
        }
    }
}
