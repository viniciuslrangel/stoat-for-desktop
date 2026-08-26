use std::cell::UnsafeCell;
use std::sync::atomic::{AtomicUsize, Ordering};

/// A bounded stereo SPSC queue.
///
/// The WASAPI pump is the sole producer and napi calls are the sole consumer.
/// The indices use acquire/release ordering so the data slots never need a
/// mutex on the audio thread or the JS thread.
pub struct Ring {
    samples: Box<[UnsafeCell<f32>]>,
    capacity_frames: usize,
    read: AtomicUsize,
    write: AtomicUsize,
    frames_read: AtomicUsize,
    underruns: AtomicUsize,
    overruns: AtomicUsize,
    fill_sum: AtomicUsize,
    fill_samples: AtomicUsize,
    peak_fill: AtomicUsize,
}

pub struct RingSnapshot {
    pub queued_frames: usize,
    pub frames_read: u64,
    pub underruns: u64,
    pub overruns: u64,
    pub peak_fill_frames: usize,
    fill_sum: u64,
    fill_samples: u64,
}

unsafe impl Send for Ring {}
unsafe impl Sync for Ring {}

impl Ring {
    pub fn new(capacity_frames: usize) -> Self {
        let capacity_frames = capacity_frames.max(1);
        let samples = (0..capacity_frames.saturating_mul(2))
            .map(|_| UnsafeCell::new(0.0))
            .collect::<Vec<_>>()
            .into_boxed_slice();
        Self {
            samples,
            capacity_frames,
            read: AtomicUsize::new(0),
            write: AtomicUsize::new(0),
            frames_read: AtomicUsize::new(0),
            underruns: AtomicUsize::new(0),
            overruns: AtomicUsize::new(0),
            fill_sum: AtomicUsize::new(0),
            fill_samples: AtomicUsize::new(0),
            peak_fill: AtomicUsize::new(0),
        }
    }

    pub fn write(&self, interleaved: &[f32]) -> usize {
        let requested = interleaved.len() / 2;
        if requested == 0 {
            return 0;
        }
        let write = self.write.load(Ordering::Relaxed);
        let read = self.read.load(Ordering::Acquire);
        let available = self.capacity_frames.saturating_sub(write - read);
        let frames = requested.min(available);

        for frame in 0..frames {
            let slot = (write + frame) % self.capacity_frames * 2;
            // SAFETY: only the producer writes a slot after observing the
            // consumer's released read index.
            unsafe {
                *self.samples[slot].get() = interleaved[frame * 2];
                *self.samples[slot + 1].get() = interleaved[frame * 2 + 1];
            }
        }
        self.write
            .store(write.saturating_add(frames), Ordering::Release);
        self.record_fill(write.saturating_add(frames) - read);
        if frames < requested {
            self.overruns.fetch_add(1, Ordering::Relaxed);
        }
        frames
    }

    pub fn read_into(&self, max_frames: usize, output: &mut Vec<f32>) -> usize {
        if max_frames == 0 {
            return 0;
        }
        let read = self.read.load(Ordering::Relaxed);
        let write = self.write.load(Ordering::Acquire);
        let frames = max_frames.min(write - read);
        if frames < max_frames {
            self.underruns.fetch_add(1, Ordering::Relaxed);
        }
        output.reserve(frames.saturating_mul(2));

        for frame in 0..frames {
            let slot = (read + frame) % self.capacity_frames * 2;
            // SAFETY: only the consumer reads a slot after observing the
            // producer's released write index.
            unsafe {
                output.push(*self.samples[slot].get());
                output.push(*self.samples[slot + 1].get());
            }
        }
        self.read
            .store(read.saturating_add(frames), Ordering::Release);
        self.frames_read.fetch_add(frames, Ordering::Relaxed);
        self.record_fill(write.saturating_sub(read.saturating_add(frames)));
        frames
    }

    pub fn snapshot(&self) -> RingSnapshot {
        let read = self.read.load(Ordering::Acquire);
        let write = self.write.load(Ordering::Acquire);
        RingSnapshot {
            queued_frames: write.saturating_sub(read),
            frames_read: self.frames_read.load(Ordering::Relaxed) as u64,
            underruns: self.underruns.load(Ordering::Relaxed) as u64,
            overruns: self.overruns.load(Ordering::Relaxed) as u64,
            peak_fill_frames: self.peak_fill.load(Ordering::Relaxed),
            fill_sum: self.fill_sum.load(Ordering::Relaxed) as u64,
            fill_samples: self.fill_samples.load(Ordering::Relaxed) as u64,
        }
    }

    fn record_fill(&self, fill_frames: usize) {
        self.fill_sum.fetch_add(fill_frames, Ordering::Relaxed);
        self.fill_samples.fetch_add(1, Ordering::Relaxed);
        let mut peak = self.peak_fill.load(Ordering::Relaxed);
        while fill_frames > peak {
            match self.peak_fill.compare_exchange_weak(
                peak,
                fill_frames,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => break,
                Err(next) => peak = next,
            }
        }
    }
}

impl RingSnapshot {
    pub fn average_fill_frames(&self) -> f64 {
        if self.fill_samples == 0 {
            0.0
        } else {
            self.fill_sum as f64 / self.fill_samples as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Ring;

    #[test]
    fn drops_newest_when_full() {
        let ring = Ring::new(2);
        assert_eq!(ring.write(&[1.0, 2.0, 3.0, 4.0, 5.0, 6.0]), 2);
        let mut output = Vec::new();
        assert_eq!(ring.read_into(3, &mut output), 2);
        assert_eq!(output, vec![1.0, 2.0, 3.0, 4.0]);
    }

    #[test]
    fn records_fill_and_short_reads() {
        let ring = Ring::new(4);
        assert_eq!(ring.write(&[1.0, 2.0, 3.0, 4.0]), 2);
        let mut output = Vec::new();
        assert_eq!(ring.read_into(4, &mut output), 2);
        let snapshot = ring.snapshot();
        assert_eq!(snapshot.frames_read, 2);
        assert_eq!(snapshot.underruns, 1);
        assert_eq!(snapshot.overruns, 0);
        assert_eq!(snapshot.queued_frames, 0);
        assert!(snapshot.peak_fill_frames >= 2);
    }
}
