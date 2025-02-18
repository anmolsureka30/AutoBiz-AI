use std::process::Command;

fn main() {
    // Check if wasm-pack is installed
    if Command::new("wasm-pack").arg("--version").output().is_err() {
        println!("cargo:warning=wasm-pack is not installed. Installing...");
        if let Err(e) = Command::new("cargo")
            .args(&["install", "wasm-pack"])
            .status()
        {
            panic!("Failed to install wasm-pack: {}", e);
        }
    }

    // Set link-args for better optimization
    println!("cargo:rustc-link-arg=-s"); // Strip symbols
    println!("cargo:rustc-link-arg=-O3"); // Optimize aggressively
    println!("cargo:rustc-link-arg=--no-entry"); // No start function needed
    println!("cargo:rustc-link-arg=--export-dynamic"); // Export all symbols
} 