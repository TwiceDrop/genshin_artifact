use sha2::{Digest, Sha256};
use std::{fs::File, io};

fn main() {
    println!("cargo:rerun-if-changed=../package.json");
    println!("cargo:rerun-if-changed=payload.tar.gz");
    let mut payload = File::open("payload.tar.gz").expect("Missing Tauri payload");
    let mut digest = Sha256::new();
    io::copy(&mut payload, &mut digest).expect("Cannot hash Tauri payload");
    println!("cargo:rustc-env=MONA_PAYLOAD_SHA256={:x}", digest.finalize());
    let package: serde_json::Value = serde_json::from_slice(
        &std::fs::read("../package.json").expect("Cannot read package.json"),
    ).expect("Cannot parse package.json");
    let display = package["displayVersion"].as_str().expect("Missing displayVersion");
    println!("cargo:rustc-env=MONA_DISPLAY_VERSION={display}");
    tauri_build::build();
}
