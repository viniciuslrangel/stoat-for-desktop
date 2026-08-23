mod pump;

#[cfg(windows)]
mod activate;
#[cfg(windows)]
mod client;

pub use pump::start;
