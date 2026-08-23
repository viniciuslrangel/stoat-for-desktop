fn main() {
    // napi-build needs the host's libnode.dll when checking/linking a GNU
    // Windows target. Native Windows builds run the normal setup; a Linux
    // cross-check only needs Rust to type-check the cfg-gated bindings.
    let host = std::env::var("HOST").unwrap_or_default();
    let target = std::env::var("TARGET").unwrap_or_default();
    if host == target || host.contains("windows") {
        napi_build::setup();
    }
}
