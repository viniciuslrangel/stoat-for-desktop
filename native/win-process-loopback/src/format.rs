#![allow(dead_code)]

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SampleEncoding {
    Pcm8,
    Pcm16,
    Pcm24,
    Pcm32,
    Float32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SourceFormat {
    pub sample_rate: u32,
    pub channels: u16,
    pub encoding: SampleEncoding,
    pub valid_bits: u16,
}

impl SourceFormat {
    pub fn bytes_per_sample(self) -> usize {
        match self.encoding {
            SampleEncoding::Pcm8 => 1,
            SampleEncoding::Pcm16 => 2,
            SampleEncoding::Pcm24 => 3,
            SampleEncoding::Pcm32 | SampleEncoding::Float32 => 4,
        }
    }

    pub fn bytes_per_frame(self) -> usize {
        self.bytes_per_sample() * usize::from(self.channels)
    }
}

/// Convert a WASAPI packet to deterministic stereo f32.
pub fn normalize_packet(input: &[u8], format: SourceFormat, output: &mut Vec<f32>) -> usize {
    let channels = usize::from(format.channels);
    let bytes_per_sample = format.bytes_per_sample();
    let frame_size = format.bytes_per_frame();
    if channels == 0 || frame_size == 0 {
        return 0;
    }
    let frames = input.len() / frame_size;
    output.clear();
    output.reserve(frames.saturating_mul(2));

    for frame in 0..frames {
        let start = frame * frame_size;
        if channels == 1 {
            let value = decode_sample(
                &input[start..start + bytes_per_sample],
                format.encoding,
                format.valid_bits,
            );
            output.extend_from_slice(&[value, value]);
            continue;
        }

        let mut left = 0.0;
        let mut right = 0.0;
        let mut left_count = 0_u32;
        let mut right_count = 0_u32;
        for channel in 0..channels {
            let sample_start = start + channel * bytes_per_sample;
            let value = decode_sample(
                &input[sample_start..sample_start + bytes_per_sample],
                format.encoding,
                format.valid_bits,
            );
            if channel % 2 == 0 {
                left += value;
                left_count += 1;
            } else {
                right += value;
                right_count += 1;
            }
        }
        output.push(left / left_count.max(1) as f32);
        output.push(right / right_count.max(1) as f32);
    }
    frames
}

pub fn resample_linear(input: &[f32], source_rate: u32, output_rate: u32, output: &mut Vec<f32>) {
    if source_rate == 0 || output_rate == 0 || input.len() < 2 {
        output.clear();
        output.extend_from_slice(input);
        return;
    }
    if source_rate == output_rate {
        output.clear();
        output.extend_from_slice(input);
        return;
    }

    let source_frames = input.len() / 2;
    let output_frames = ((source_frames as u64 * u64::from(output_rate) + u64::from(source_rate)
        - 1)
        / u64::from(source_rate)) as usize;
    output.clear();
    output.reserve(output_frames.saturating_mul(2));
    for output_frame in 0..output_frames {
        let source_position = output_frame as f64 * f64::from(source_rate) / f64::from(output_rate);
        let first = source_position.floor() as usize;
        let second = (first + 1).min(source_frames - 1);
        let fraction = (source_position - first as f64) as f32;
        for channel in 0..2 {
            let a = input[first * 2 + channel];
            let b = input[second * 2 + channel];
            output.push(a + (b - a) * fraction);
        }
    }
}

fn decode_sample(bytes: &[u8], encoding: SampleEncoding, valid_bits: u16) -> f32 {
    match encoding {
        SampleEncoding::Pcm8 => (f32::from(bytes[0]) - 128.0) / 128.0,
        SampleEncoding::Pcm16 => {
            let value = i16::from_le_bytes([bytes[0], bytes[1]]);
            f32::from(value) / 32_768.0
        }
        SampleEncoding::Pcm24 => {
            let value =
                i32::from(bytes[0]) | (i32::from(bytes[1]) << 8) | (i32::from(bytes[2]) << 16);
            let value = if value & 0x0080_0000 != 0 {
                value | !0x00ff_ffff
            } else {
                value
            };
            value as f32 / 8_388_608.0
        }
        SampleEncoding::Pcm32 => {
            let value = i32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
            let scale = if valid_bits > 0 && valid_bits < 32 {
                (1_u64 << (u32::from(valid_bits) - 1)) as f32
            } else {
                2_147_483_648.0
            };
            value as f32 / scale
        }
        SampleEncoding::Float32 => f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
    }
    .clamp(-1.0, 1.0)
}

#[cfg(windows)]
pub fn from_wave_format(
    wave_format: &windows::Win32::Media::Audio::WAVEFORMATEX,
) -> Option<SourceFormat> {
    use windows::Win32::Media::Audio::{WAVEFORMATEXTENSIBLE, WAVE_FORMAT_PCM};
    use windows::Win32::Media::KernelStreaming::{
        KSDATAFORMAT_SUBTYPE_PCM, WAVE_FORMAT_EXTENSIBLE,
    };
    use windows::Win32::Media::Multimedia::{
        KSDATAFORMAT_SUBTYPE_IEEE_FLOAT, WAVE_FORMAT_IEEE_FLOAT,
    };

    let format_tag = u32::from(wave_format.wFormatTag);
    let encoding = match format_tag {
        tag if tag == WAVE_FORMAT_PCM => match wave_format.wBitsPerSample {
            8 => SampleEncoding::Pcm8,
            16 => SampleEncoding::Pcm16,
            24 => SampleEncoding::Pcm24,
            32 => SampleEncoding::Pcm32,
            _ => return None,
        },
        tag if tag == WAVE_FORMAT_IEEE_FLOAT && wave_format.wBitsPerSample == 32 => {
            SampleEncoding::Float32
        }
        tag if tag == WAVE_FORMAT_EXTENSIBLE => {
            if wave_format.cbSize < 22 {
                return None;
            }
            // WAVEFORMATEXTENSIBLE is packed and starts with WAVEFORMATEX.
            // The length check above makes this view valid for GetMixFormat's
            // documented buffer layout.
            let extensible = unsafe { &*(wave_format as *const _ as *const WAVEFORMATEXTENSIBLE) };
            let sub_format =
                unsafe { std::ptr::read_unaligned(std::ptr::addr_of!(extensible.SubFormat)) };
            if sub_format == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT {
                if wave_format.wBitsPerSample == 32 {
                    SampleEncoding::Float32
                } else {
                    return None;
                }
            } else if sub_format == KSDATAFORMAT_SUBTYPE_PCM {
                match wave_format.wBitsPerSample {
                    8 => SampleEncoding::Pcm8,
                    16 => SampleEncoding::Pcm16,
                    24 => SampleEncoding::Pcm24,
                    32 => SampleEncoding::Pcm32,
                    _ => return None,
                }
            } else {
                return None;
            }
        }
        _ => return None,
    };
    Some(SourceFormat {
        sample_rate: wave_format.nSamplesPerSec,
        channels: wave_format.nChannels,
        encoding,
        valid_bits: wave_format.wBitsPerSample,
    })
}

#[cfg(test)]
mod tests {
    use super::{normalize_packet, resample_linear, SampleEncoding, SourceFormat};

    #[test]
    fn duplicates_mono_pcm16_into_stereo() {
        let mut output = Vec::new();
        let frames = normalize_packet(
            &[0, 64, 0, 192],
            SourceFormat {
                sample_rate: 48_000,
                channels: 1,
                encoding: SampleEncoding::Pcm16,
                valid_bits: 16,
            },
            &mut output,
        );
        assert_eq!(frames, 2);
        assert_eq!(output, vec![0.5, 0.5, -0.5, -0.5]);
    }

    #[test]
    fn resamples_interleaved_stereo() {
        let mut output = Vec::new();
        resample_linear(&[0.0, 0.0, 1.0, 1.0], 24_000, 48_000, &mut output);
        assert_eq!(output.len(), 8);
        assert_eq!(&output[..4], &[0.0, 0.0, 0.5, 0.5]);
    }
}
