fn main() {
    println!("cargo:rerun-if-changed=../package.json");
    println!("cargo:rerun-if-changed=payload.tar.gz");
    let package: serde_json::Value = serde_json::from_slice(
        &std::fs::read("../package.json").expect("Cannot read package.json"),
    ).expect("Cannot parse package.json");
    let display = package["displayVersion"].as_str().expect("Missing displayVersion");
    println!("cargo:rustc-env=MONA_DISPLAY_VERSION={display}");
    tauri_build::build();
}
