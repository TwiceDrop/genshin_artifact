export function shouldShowWebVersionNotice({native, tauri, development}) {
    return !development && !native && !tauri
}
