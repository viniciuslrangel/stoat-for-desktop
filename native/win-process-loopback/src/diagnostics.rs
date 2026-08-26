use std::sync::atomic::{AtomicU64, Ordering};

use parking_lot::Mutex;

#[derive(Default)]
pub struct CaptureMetrics {
    frames_captured: AtomicU64,
    silent_packets: AtomicU64,
    last_error: Mutex<Option<String>>,
}

#[allow(dead_code)]
impl CaptureMetrics {
    pub fn add_frames_captured(&self, frames: usize) {
        self.frames_captured
            .fetch_add(frames as u64, Ordering::Relaxed);
    }

    pub fn add_silent_packet(&self) {
        self.silent_packets.fetch_add(1, Ordering::Relaxed);
    }

    pub fn set_last_error(&self, error: String) {
        *self.last_error.lock() = Some(error);
    }

    pub fn snapshot(&self) -> CaptureMetricsSnapshot {
        CaptureMetricsSnapshot {
            frames_captured: self.frames_captured.load(Ordering::Relaxed),
            silent_packets: self.silent_packets.load(Ordering::Relaxed),
            last_error: self.last_error.lock().clone(),
        }
    }
}

pub struct CaptureMetricsSnapshot {
    pub frames_captured: u64,
    pub silent_packets: u64,
    pub last_error: Option<String>,
}
