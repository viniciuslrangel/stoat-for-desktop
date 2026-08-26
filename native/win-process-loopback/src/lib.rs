#![deny(unsafe_op_in_unsafe_fn)]

mod diagnostics;
mod exclude;
mod format;
mod pcm;
mod process;
mod wasapi;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread::JoinHandle;
use std::time::{SystemTime, UNIX_EPOCH};

use napi::bindgen_prelude::Float32Array;
use napi::{Error, Result, Status};
use napi_derive::napi;
use parking_lot::Mutex;

use crate::diagnostics::CaptureMetrics;
use crate::exclude::CapturePlan;
use crate::pcm::Ring;

#[napi(object)]
#[derive(Clone)]
pub struct StartResult {
    #[napi(js_name = "sampleRate")]
    pub sample_rate: u32,
    pub channels: u32,
    pub format: String,
}

#[napi(object)]
pub struct Diagnostics {
    #[napi(js_name = "startedAt")]
    pub started_at: Option<f64>,
    #[napi(js_name = "framesCaptured")]
    pub frames_captured: f64,
    #[napi(js_name = "framesRead")]
    pub frames_read: f64,
    pub underruns: f64,
    pub overruns: f64,
    #[napi(js_name = "silentPackets")]
    pub silent_packets: f64,
    #[napi(js_name = "avgFillMs")]
    pub avg_fill_ms: f64,
    #[napi(js_name = "peakFillMs")]
    pub peak_fill_ms: f64,
    #[napi(js_name = "queueMs")]
    pub queue_ms: f64,
    #[napi(js_name = "lastError")]
    pub last_error: Option<String>,
}

struct Slot {
    plan: CapturePlan,
    ring: Arc<Ring>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    metrics: Arc<CaptureMetrics>,
    started_at: u64,
    #[allow(dead_code)]
    result: StartResult,
}

static SESSION: OnceLock<Mutex<Option<Slot>>> = OnceLock::new();

fn session_slot() -> &'static Mutex<Option<Slot>> {
    SESSION.get_or_init(|| Mutex::new(None))
}

fn error(reason: impl Into<String>) -> Error {
    Error::new(Status::GenericFailure, reason.into())
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[napi(js_name = "isSupported")]
pub fn is_supported() -> bool {
    cfg!(windows)
}

#[napi(js_name = "pidFromHwnd")]
pub fn pid_from_hwnd(hwnd: u32) -> Result<u32> {
    process::pid_from_hwnd(hwnd).map_err(error)
}

#[napi(js_name = "queryProcessImage")]
pub fn query_process_image(pid: u32) -> Result<String> {
    process::query_process_image(pid).map_err(error)
}

#[napi(js_name = "findProcessesByImageName")]
pub fn find_processes_by_image_name(image_name: String) -> Result<Vec<u32>> {
    process::find_processes_by_image_name(&image_name).map_err(error)
}

#[napi(js_name = "startCapture")]
pub fn start_capture(mode: String, pid: u32, exclude_pids: Vec<u32>) -> Result<StartResult> {
    if !cfg!(windows) {
        return Err(error("process loopback is only supported on Windows"));
    }

    let plan = CapturePlan::parse(&mode, pid, &exclude_pids).map_err(error)?;

    let mut slot = session_slot().lock();
    if let Some(session) = slot.as_ref() {
        if session.plan == plan {
            return Ok(session.result.clone());
        }
        return Err(error("a capture session is already running"));
    }

    let ring = Arc::new(Ring::new(4_800));
    let stop = Arc::new(AtomicBool::new(false));
    let metrics = Arc::new(CaptureMetrics::default());
    let mut pump = wasapi::start(
        plan.clone(),
        Arc::clone(&ring),
        Arc::clone(&stop),
        Arc::clone(&metrics),
    )?;

    if let Err(reason) = pump.wait_until_ready() {
        stop.store(true, Ordering::Release);
        pump.join();
        return Err(error(reason));
    }

    let result = StartResult {
        sample_rate: 48_000,
        channels: 2,
        format: "f32".to_string(),
    };
    *slot = Some(Slot {
        plan,
        ring,
        stop,
        thread: pump.take_thread(),
        metrics,
        started_at: now_millis(),
        result: result.clone(),
    });
    Ok(result)
}

#[napi(js_name = "stopCapture")]
pub fn stop_capture() -> Result<()> {
    let session = session_slot().lock().take();
    if let Some(mut session) = session {
        session.stop.store(true, Ordering::Release);
        if let Some(thread) = session.thread.take() {
            let _ = thread.join();
        }
    }
    Ok(())
}

#[napi(js_name = "readPcm")]
pub fn read_pcm(max_frames: u32) -> Result<Float32Array> {
    let max_frames = usize::try_from(max_frames)
        .map_err(|_| error("invalid frame count"))?
        .min(48_000);
    let mut output = Vec::with_capacity(max_frames.saturating_mul(2));
    if let Some(session) = session_slot().lock().as_ref() {
        session.ring.read_into(max_frames, &mut output);
    }
    Ok(Float32Array::new(output))
}

#[napi(js_name = "getDiagnostics")]
pub fn get_diagnostics() -> Diagnostics {
    let session = session_slot().lock();
    let Some(session) = session.as_ref() else {
        return Diagnostics {
            started_at: None,
            frames_captured: 0.0,
            frames_read: 0.0,
            underruns: 0.0,
            overruns: 0.0,
            silent_packets: 0.0,
            avg_fill_ms: 0.0,
            peak_fill_ms: 0.0,
            queue_ms: 0.0,
            last_error: None,
        };
    };
    let ring = session.ring.snapshot();
    let metrics = session.metrics.snapshot();
    Diagnostics {
        started_at: Some(session.started_at as f64),
        frames_captured: metrics.frames_captured as f64,
        frames_read: ring.frames_read as f64,
        underruns: ring.underruns as f64,
        overruns: ring.overruns as f64,
        silent_packets: metrics.silent_packets as f64,
        avg_fill_ms: ring.average_fill_frames() / 48.0,
        peak_fill_ms: ring.peak_fill_frames as f64 / 48.0,
        queue_ms: ring.queued_frames as f64 / 48.0,
        last_error: metrics.last_error,
    }
}
