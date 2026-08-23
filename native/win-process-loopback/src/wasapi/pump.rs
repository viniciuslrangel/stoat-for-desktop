use std::sync::atomic::AtomicBool;
#[cfg(windows)]
use std::sync::atomic::Ordering;
use std::sync::mpsc::Receiver;
#[cfg(windows)]
use std::sync::mpsc::{self, Sender};
use std::sync::Arc;
#[cfg(windows)]
use std::thread;
use std::thread::JoinHandle;
#[cfg(windows)]
use std::time::Duration;

use napi::{Error, Result, Status};

use crate::exclude::CapturePlan;
use crate::pcm::Ring;

pub struct PumpHandle {
    ready: Option<Receiver<std::result::Result<(), String>>>,
    thread: Option<JoinHandle<()>>,
}

impl PumpHandle {
    pub fn wait_until_ready(&mut self) -> std::result::Result<(), String> {
        match self.ready.take() {
            Some(receiver) => receiver
                .recv()
                .map_err(|_| "WASAPI pump stopped during startup".to_string())?
                .map_err(|error| error),
            None => Err("WASAPI pump startup was already consumed".to_string()),
        }
    }

    pub fn take_thread(&mut self) -> Option<JoinHandle<()>> {
        self.thread.take()
    }

    pub fn join(&mut self) {
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

#[cfg(windows)]
pub fn start(plan: CapturePlan, ring: Arc<Ring>, stop: Arc<AtomicBool>) -> Result<PumpHandle> {
    let (sender, receiver): (
        Sender<std::result::Result<(), String>>,
        Receiver<std::result::Result<(), String>>,
    ) = mpsc::channel();
    let thread = thread::Builder::new()
        .name("stoat-wasapi-pump".to_string())
        .spawn(move || {
            let initialized = unsafe {
                windows::Win32::System::Com::CoInitializeEx(
                    None,
                    windows::Win32::System::Com::COINIT_MULTITHREADED,
                )
            };
            if let Err(error) = initialized.ok() {
                let _ = sender.send(Err(format!("COM initialization failed: {error}")));
                return;
            }

            let graph = super::client::PumpGraph::open(&plan);
            let mut graph = match graph {
                Ok(graph) => {
                    let _ = sender.send(Ok(()));
                    graph
                }
                Err(error) => {
                    let _ = sender.send(Err(error));
                    unsafe {
                        windows::Win32::System::Com::CoUninitialize();
                    }
                    return;
                }
            };

            while !stop.load(Ordering::Acquire) {
                if graph.pump_once(&ring).is_err() {
                    break;
                }
                thread::sleep(Duration::from_millis(2));
            }
            drop(graph);
            unsafe {
                windows::Win32::System::Com::CoUninitialize();
            }
        })
        .map_err(|error| {
            Error::new(
                Status::GenericFailure,
                format!("failed to start pump: {error}"),
            )
        })?;

    Ok(PumpHandle {
        ready: Some(receiver),
        thread: Some(thread),
    })
}

#[cfg(not(windows))]
pub fn start(_: CapturePlan, _: Arc<Ring>, _: Arc<AtomicBool>) -> Result<PumpHandle> {
    Err(Error::new(
        Status::GenericFailure,
        "process loopback is only supported on Windows",
    ))
}
