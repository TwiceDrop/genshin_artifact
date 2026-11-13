#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    error::Error,
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Cursor, Write},
    os::windows::{io::{AsRawHandle, FromRawHandle, OwnedHandle}, process::CommandExt},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::webview::{DownloadEvent, NewWindowResponse};
use windows_sys::Win32::{
    System::{JobObjects::{CreateJobObjectW, SetInformationJobObject, AssignProcessToJobObject,
        JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE},
        Threading::CREATE_NO_WINDOW},
    UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
};

const PAYLOAD: &[u8] = include_bytes!("../payload.tar.gz");
const BUILD_REVISION: &str = "20261112-r2";
// Fixed: the port is part of the WebView storage origin, so changing it loses saved data.
const PORT: u16 = 47504;

struct Backend {
    child: Mutex<Child>,
    _job: OwnedHandle,
}

fn log(path: &Path, message: &str) {
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{message}");
    }
}

fn start_backend(root: &Path, data: &Path) -> Result<Backend, Box<dyn Error>> {
    fs::create_dir_all(data)?;
    let runtime = root.join(BUILD_REVISION);
    if !runtime.join(".ready").is_file() {
        fs::create_dir_all(&runtime)?;
        let gzip = flate2::read::GzDecoder::new(Cursor::new(PAYLOAD));
        tar::Archive::new(gzip).unpack(&runtime)?;
        fs::write(runtime.join(".ready"), BUILD_REVISION)?;
    }
    let stderr = OpenOptions::new().create(true).append(true).open(data.join("backend.log"))?;
    let mut child = Command::new(runtime.join("runtime/node.exe"))
        .arg(runtime.join("start-server.mjs"))
        .current_dir(&runtime)
        .env("MONA_PORT", PORT.to_string())
        .env("MONA_DATA_DIR", data.join("credentials"))
        .env_remove("MONA_LAUNCHER_PID")
        .creation_flags(CREATE_NO_WINDOW)
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(stderr)
        .spawn()?;
    let job = unsafe {
        let raw = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if raw.is_null() { child.kill()?; return Err(std::io::Error::last_os_error().into()); }
        let handle = OwnedHandle::from_raw_handle(raw);
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(raw, JobObjectExtendedLimitInformation,
            &info as *const _ as *const _, std::mem::size_of_val(&info) as u32) == 0
            || AssignProcessToJobObject(raw, child.as_raw_handle()) == 0 {
            let error = std::io::Error::last_os_error();
            child.kill()?;
            return Err(error.into());
        }
        handle
    };
    let stdout = child.stdout.take().ok_or("Missing backend startup pipe")?;
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let mut line = String::new();
        let result = BufReader::new(stdout).read_line(&mut line).map(|_| line);
        let _ = sender.send(result);
    });
    let line = receiver.recv_timeout(Duration::from_secs(20))??;
    let ready: serde_json::Value = serde_json::from_str(&line)
        .map_err(|error| format!("本地服务未就绪：{error}；日志：{}", data.join("backend.log").display()))?;
    if ready["port"].as_u64() != Some(PORT as u64) {
        return Err("本地服务端口与窗口不一致".into());
    }
    fs::write(data.join("running.json"), serde_json::to_vec_pretty(&serde_json::json!({
        "applicationPid": std::process::id(), "backendPid": child.id(), "port": PORT,
        "version": env!("MONA_DISPLAY_VERSION"), "runtime": runtime,
    }))?)?;
    Ok(Backend {child: Mutex::new(child), _job: job})
}

fn open_external(url: &str) -> Result<(), String> {
    let wide: Vec<u16> = url.encode_utf16().chain(Some(0)).collect();
    let result = unsafe { ShellExecuteW(std::ptr::null_mut(), std::ptr::null(), wide.as_ptr(),
        std::ptr::null(), std::ptr::null(), SW_SHOWNORMAL) };
    if result as isize <= 32 { Err(format!("无法打开外部链接：错误 {}", result as isize)) } else { Ok(()) }
}

fn main() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let app_data = app.path().app_local_data_dir()?;
            let data = std::env::var_os("MONA_TAURI_TEST_DATA_DIR")
                .map(PathBuf::from).unwrap_or_else(|| app_data.join("data"));
            let backend = start_backend(&app_data.join("runtime"), &data)?;
            app.manage(backend);
            let error_log = data.join("window.log");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(
                format!("http://127.0.0.1:{PORT}/#/calculate").parse()?))
                .title(format!("莫娜占卜铺 {} · Tauri 2", env!("MONA_DISPLAY_VERSION")))
                .inner_size(1440.0, 960.0)
                .min_inner_size(960.0, 640.0)
                .data_directory(data.join("webview"))
                .on_new_window(move |url, _| {
                    if matches!(url.scheme(), "http" | "https") {
                        if let Err(error) = open_external(url.as_str()) {
                            log(&error_log, &error);
                        }
                    }
                    NewWindowResponse::Deny
                })
                .on_download(|_, event| {
                    if let DownloadEvent::Requested { destination, .. } = event {
                        let name = destination.file_name().unwrap_or_default().to_string_lossy();
                        match rfd::FileDialog::new().set_file_name(name.as_ref()).save_file() {
                            Some(path) => *destination = path,
                            None => return false,
                        }
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!());
    match result {
        Ok(app) => app.run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(backend) = app.try_state::<Backend>() {
                    if let Ok(mut child) = backend.child.lock() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        }),
        Err(error) => {
            rfd::MessageDialog::new().set_title("莫娜占卜铺启动失败")
                .set_description(error.to_string()).set_level(rfd::MessageLevel::Error).show();
        }
    }
}
