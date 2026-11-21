export function shouldShowWebVersionNotice({native, tauri}) {
    return !native && !tauri
}
