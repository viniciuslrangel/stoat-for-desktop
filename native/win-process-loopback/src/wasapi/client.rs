#![cfg(windows)]

use std::collections::VecDeque;
use std::ptr;

use windows::Win32::Media::Audio::{
    IAudioCaptureClient, IAudioClient, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_LOOPBACK, WAVEFORMATEX, WAVE_FORMAT_PCM,
};
use windows::Win32::Media::Multimedia::WAVE_FORMAT_IEEE_FLOAT;
use windows::Win32::System::Com::CoTaskMemFree;

use crate::exclude::{CapturePlan, Strategy};
use crate::format::{from_wave_format, normalize_packet, resample_linear, SourceFormat};
use crate::pcm::Ring;

const OUTPUT_RATE: u32 = 48_000;
const OUTPUT_CHANNELS: usize = 2;

pub(super) struct CaptureClient {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    source_format: SourceFormat,
    block_align: usize,
    normalized: Vec<f32>,
    resampled: Vec<f32>,
}

impl CaptureClient {
    fn open_endpoint(client: IAudioClient) -> Result<Self, String> {
        let mix_format = unsafe {
            client
                .GetMixFormat()
                .map_err(|error| format!("WASAPI GetMixFormat failed: {error}"))?
        };
        if mix_format.is_null() {
            return Err("WASAPI returned a null mix format".to_string());
        }
        let source_format = unsafe {
            from_wave_format(&*mix_format)
                .ok_or_else(|| "unsupported WASAPI mix format".to_string())
        };
        let source_format = match source_format {
            Ok(source_format) => source_format,
            Err(error) => {
                unsafe {
                    CoTaskMemFree(Some(mix_format.cast()));
                }
                return Err(error);
            }
        };
        let block_align = usize::from(unsafe { (*mix_format).nBlockAlign });
        if block_align == 0 || source_format.channels == 0 {
            unsafe {
                CoTaskMemFree(Some(mix_format.cast()));
            }
            return Err("WASAPI returned an invalid block alignment".to_string());
        }

        let initialized = unsafe { initialize(&client, &*mix_format) };
        unsafe {
            CoTaskMemFree(Some(mix_format.cast()));
        }
        initialized.map_err(|error| format!("WASAPI Initialize failed: {error}"))?;
        Self::finish_open(client, source_format, block_align)
    }

    fn open_process_loopback(client: IAudioClient) -> Result<Self, String> {
        let mut errors = Vec::new();
        for format in ProcessLoopbackFormat::ALL {
            let wave_format = format.wave_format();
            match unsafe { initialize(&client, &wave_format) } {
                Ok(()) => {
                    let source_format = format.source_format();
                    return Self::finish_open(
                        client,
                        source_format,
                        source_format.bytes_per_frame(),
                    );
                }
                Err(error) => errors.push(format!("{format:?}: {error}")),
            }
        }
        Err(format!(
            "WASAPI process loopback Initialize failed: {}",
            errors.join("; ")
        ))
    }

    fn finish_open(
        client: IAudioClient,
        source_format: SourceFormat,
        block_align: usize,
    ) -> Result<Self, String> {
        let capture = unsafe {
            client
                .GetService::<IAudioCaptureClient>()
                .map_err(|error| format!("WASAPI capture service failed: {error}"))?
        };
        unsafe {
            client
                .Start()
                .map_err(|error| format!("WASAPI Start failed: {error}"))?;
        }
        Ok(Self {
            client,
            capture,
            source_format,
            block_align,
            normalized: Vec::new(),
            resampled: Vec::new(),
        })
    }

    fn read_available(&mut self, queue: &mut VecDeque<f32>) -> Result<(), String> {
        loop {
            let packet_frames = unsafe {
                self.capture
                    .GetNextPacketSize()
                    .map_err(|error| format!("WASAPI GetNextPacketSize failed: {error}"))?
            };
            if packet_frames == 0 {
                break;
            }

            let mut data = ptr::null_mut();
            let mut frames = 0_u32;
            let mut flags = 0_u32;
            unsafe {
                self.capture
                    .GetBuffer(&mut data, &mut frames, &mut flags, None, None)
                    .map_err(|error| format!("WASAPI GetBuffer failed: {error}"))?;
            }
            let frame_count = match usize::try_from(frames) {
                Ok(frame_count) => frame_count,
                Err(_) => {
                    unsafe {
                        let _ = self.capture.ReleaseBuffer(frames);
                    }
                    return Err("WASAPI returned too many frames".to_string());
                }
            };
            let byte_count = frame_count.saturating_mul(self.block_align);
            if flags & (AUDCLNT_BUFFERFLAGS_SILENT.0 as u32) != 0 {
                self.normalized.clear();
                self.normalized.resize(frame_count * OUTPUT_CHANNELS, 0.0);
            } else if data.is_null() {
                unsafe {
                    let _ = self.capture.ReleaseBuffer(frames);
                }
                return Err("WASAPI returned a null capture buffer".to_string());
            } else {
                let bytes = unsafe { std::slice::from_raw_parts(data.cast::<u8>(), byte_count) };
                normalize_packet(bytes, self.source_format, &mut self.normalized);
            }
            unsafe {
                self.capture
                    .ReleaseBuffer(frames)
                    .map_err(|error| format!("WASAPI ReleaseBuffer failed: {error}"))?;
            }
            resample_linear(
                &self.normalized,
                self.source_format.sample_rate,
                OUTPUT_RATE,
                &mut self.resampled,
            );
            queue.extend(self.resampled.iter().copied());
        }
        Ok(())
    }
}

impl Drop for CaptureClient {
    fn drop(&mut self) {
        // This object is dropped by the pump thread, preserving WASAPI's
        // same-thread release requirement for the client and its service.
        unsafe {
            let _ = self.client.Stop();
        }
    }
}

pub(super) enum PumpGraph {
    Single(CaptureClient),
    Subtractive {
        endpoint: CaptureClient,
        exclusions: Vec<CaptureClient>,
        endpoint_queue: VecDeque<f32>,
        exclusion_queues: Vec<VecDeque<f32>>,
        mixed: Vec<f32>,
    },
}

impl PumpGraph {
    pub(super) fn open(plan: &CapturePlan) -> Result<Self, String> {
        match &plan.strategy {
            Strategy::IncludeTree { .. } | Strategy::NativeExcludeTree { .. } => {
                let client = super::activate::activate_process_client(plan)?;
                Ok(Self::Single(CaptureClient::open_process_loopback(client)?))
            }
            Strategy::Subtractive { exclusion_roots } => {
                let endpoint =
                    CaptureClient::open_endpoint(super::activate::activate_endpoint_client()?)?;
                let mut exclusions = Vec::with_capacity(exclusion_roots.len());
                for root in exclusion_roots {
                    let process_client = super::activate::activate_process_client(&CapturePlan {
                        target_pid: *root,
                        strategy: Strategy::IncludeTree { pid: *root },
                    })?;
                    exclusions.push(CaptureClient::open_process_loopback(process_client)?);
                }
                let exclusion_queues = (0..exclusions.len()).map(|_| VecDeque::new()).collect();
                Ok(Self::Subtractive {
                    endpoint,
                    exclusions,
                    endpoint_queue: VecDeque::new(),
                    exclusion_queues,
                    mixed: Vec::new(),
                })
            }
        }
    }

    pub(super) fn pump_once(&mut self, ring: &Ring) -> Result<(), String> {
        match self {
            Self::Single(client) => {
                let mut queue = VecDeque::new();
                client.read_available(&mut queue)?;
                let available = queue.make_contiguous();
                let _ = ring.write(available);
            }
            Self::Subtractive {
                endpoint,
                exclusions,
                endpoint_queue,
                exclusion_queues,
                mixed,
            } => {
                endpoint.read_available(endpoint_queue)?;
                for (client, queue) in exclusions.iter_mut().zip(exclusion_queues.iter_mut()) {
                    client.read_available(queue)?;
                }
                let available = std::iter::once(endpoint_queue.len())
                    .chain(exclusion_queues.iter().map(VecDeque::len))
                    .min()
                    .map_or(0, |length| length);
                let frames = available / OUTPUT_CHANNELS;
                mixed.clear();
                mixed.reserve(frames * OUTPUT_CHANNELS);
                for _ in 0..frames {
                    let left = pop_sample(endpoint_queue)
                        - exclusion_queues.iter_mut().map(pop_sample).sum::<f32>();
                    let right = pop_sample(endpoint_queue)
                        - exclusion_queues.iter_mut().map(pop_sample).sum::<f32>();
                    mixed.extend_from_slice(&[left.clamp(-1.0, 1.0), right.clamp(-1.0, 1.0)]);
                }
                let _ = ring.write(mixed);
            }
        }
        Ok(())
    }
}

fn pop_sample(queue: &mut VecDeque<f32>) -> f32 {
    match queue.pop_front() {
        Some(value) => value,
        None => 0.0,
    }
}

#[derive(Clone, Copy, Debug)]
enum ProcessLoopbackFormat {
    Float32,
    Pcm16,
}

impl ProcessLoopbackFormat {
    const ALL: [Self; 2] = [Self::Float32, Self::Pcm16];

    fn source_format(self) -> SourceFormat {
        SourceFormat {
            sample_rate: OUTPUT_RATE,
            channels: OUTPUT_CHANNELS as u16,
            encoding: match self {
                Self::Float32 => crate::format::SampleEncoding::Float32,
                Self::Pcm16 => crate::format::SampleEncoding::Pcm16,
            },
            valid_bits: match self {
                Self::Float32 => 32,
                Self::Pcm16 => 16,
            },
        }
    }

    fn wave_format(self) -> WAVEFORMATEX {
        let (w_format_tag, bits_per_sample) = match self {
            Self::Float32 => (WAVE_FORMAT_IEEE_FLOAT as u16, 32),
            Self::Pcm16 => (WAVE_FORMAT_PCM as u16, 16),
        };
        let block_align = OUTPUT_CHANNELS as u16 * (bits_per_sample / 8);
        WAVEFORMATEX {
            wFormatTag: w_format_tag,
            nChannels: OUTPUT_CHANNELS as u16,
            nSamplesPerSec: OUTPUT_RATE,
            nAvgBytesPerSec: OUTPUT_RATE * u32::from(block_align),
            nBlockAlign: block_align,
            wBitsPerSample: bits_per_sample,
            cbSize: 0,
        }
    }
}

unsafe fn initialize(client: &IAudioClient, format: &WAVEFORMATEX) -> windows::core::Result<()> {
    let flags = AUDCLNT_STREAMFLAGS_LOOPBACK;
    unsafe { client.Initialize(AUDCLNT_SHAREMODE_SHARED, flags, 10_000_000, 0, format, None) }
}
