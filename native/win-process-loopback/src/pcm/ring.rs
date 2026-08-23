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
        }
    }

    #[allow(dead_code)]
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
        frames
    }

    pub fn read_into(&self, max_frames: usize, output: &mut Vec<f32>) -> usize {
        if max_frames == 0 {
            return 0;
        }
        let read = self.read.load(Ordering::Relaxed);
        let write = self.write.load(Ordering::Acquire);
        let frames = max_frames.min(write - read);
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
        frames
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
}
