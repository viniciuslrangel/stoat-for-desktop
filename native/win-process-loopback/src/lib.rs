#![deny(unsafe_op_in_unsafe_fn)]

mod exclude;
mod format;
mod pcm;
mod process;
mod wasapi;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread::JoinHandle;

use napi::bindgen_prelude::Float32Array;
use napi::{Error, Result, Status};
use napi_derive::napi;
use parking_lot::Mutex;

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

struct Slot {
    plan: CapturePlan,
    ring: Arc<Ring>,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
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

    let ring = Arc::new(Ring::new(2_400));
    let stop = Arc::new(AtomicBool::new(false));
    let mut pump = wasapi::start(plan.clone(), Arc::clone(&ring), Arc::clone(&stop))?;

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
