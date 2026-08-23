#![cfg(windows)]

use std::mem::{size_of, ManuallyDrop};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::time::Duration;

use windows::core::{implement, Error as WindowsError, IUnknown, Interface, Result, HRESULT};
use windows::Win32::Media::Audio::{
    ActivateAudioInterfaceAsync, IActivateAudioInterfaceAsyncOperation,
    IActivateAudioInterfaceCompletionHandler, IActivateAudioInterfaceCompletionHandler_Impl,
    IAudioClient, AUDIOCLIENT_ACTIVATION_PARAMS, AUDIOCLIENT_ACTIVATION_PARAMS_0,
    AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK, AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS,
    PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
    PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
};
use windows::Win32::System::Variant::VT_BLOB;
use windows_core::imp::{
    BLOB, PROPVARIANT as RawPropVariant, PROPVARIANT_0, PROPVARIANT_0_0, PROPVARIANT_0_0_0,
};
use windows_core::PROPVARIANT;

use crate::exclude::{CapturePlan, Strategy};

type ActivationResult = std::result::Result<IAudioClient, String>;

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct CompletionHandler {
    sender: Mutex<Option<Sender<ActivationResult>>>,
}

impl IActivateAudioInterfaceCompletionHandler_Impl for CompletionHandler_Impl {
    fn ActivateCompleted(
        &self,
        activate_operation: Option<&IActivateAudioInterfaceAsyncOperation>,
    ) -> Result<()> {
        let result = (|| {
            let operation = activate_operation.ok_or_else(|| {
                WindowsError::new(HRESULT(0x80004005_u32 as i32), "missing operation")
            })?;
            let mut status = HRESULT(0);
            let mut activated: Option<IUnknown> = None;
            unsafe {
                operation.GetActivateResult(&mut status, &mut activated)?;
            }
            status.ok()?;
            let activated = activated.ok_or_else(|| {
                WindowsError::new(
                    HRESULT(0x80004005_u32 as i32),
                    "activation returned no interface",
                )
            })?;
            activated.cast::<IAudioClient>()
        })();

        if let Some(sender) = self
            .sender
            .lock()
            .map_err(|_| {
                WindowsError::new(
                    HRESULT(0x80004005_u32 as i32),
                    "activation handler lock poisoned",
                )
            })?
            .take()
        {
            let send_result = match result {
                Ok(client) => Ok(client),
                Err(error) => Err(message_or_error(error.to_string())),
            };
            let _ = sender.send(send_result);
        }
        Ok(())
    }
}

fn message_or_error(message: String) -> String {
    if message.is_empty() {
        "WASAPI process loopback activation failed".to_string()
    } else {
        format!("WASAPI process loopback activation failed: {message}")
    }
}

fn activation_params(plan: &CapturePlan) -> AUDIOCLIENT_ACTIVATION_PARAMS {
    let (mode, target) = match &plan.strategy {
        Strategy::IncludeTree { pid } => (PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, *pid),
        Strategy::NativeExcludeTree { exclusion_root } => (
            PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE,
            *exclusion_root,
        ),
        Strategy::Subtractive { .. } => (PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE, 0),
    };
    AUDIOCLIENT_ACTIVATION_PARAMS {
        ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
        Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 {
            ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: target,
                ProcessLoopbackMode: mode,
            },
        },
    }
}

pub fn activate_process_client(plan: &CapturePlan) -> std::result::Result<IAudioClient, String> {
    if matches!(plan.strategy, Strategy::Subtractive { .. }) {
        return Err("subtractive plans use endpoint and per-process clients".to_string());
    }

    let params = activation_params(plan);
    let blob = BLOB {
        cbSize: size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
        pBlobData: (&params as *const AUDIOCLIENT_ACTIVATION_PARAMS)
            .cast_mut()
            .cast(),
    };
    let variant_value = PROPVARIANT_0_0 {
        vt: VT_BLOB.0 as u16,
        wReserved1: 0,
        wReserved2: 0,
        wReserved3: 0,
        Anonymous: PROPVARIANT_0_0_0 { blob },
    };
    let variant = ManuallyDrop::new(unsafe {
        PROPVARIANT::from_raw(RawPropVariant {
            Anonymous: PROPVARIANT_0 {
                Anonymous: variant_value,
            },
        })
    });

    let (sender, receiver): (Sender<ActivationResult>, Receiver<ActivationResult>) =
        mpsc::channel();
    let handler = CompletionHandler {
        sender: Mutex::new(Some(sender)),
    };
    let handler: IActivateAudioInterfaceCompletionHandler = handler.into();
    unsafe {
        ActivateAudioInterfaceAsync(
            VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID,
            Some((&*variant) as *const PROPVARIANT),
            &handler,
        )
        .map_err(|error| message_or_error(error.to_string()))?;
    }

    receiver
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "timed out waiting for WASAPI activation".to_string())?
}

pub fn activate_endpoint_client() -> std::result::Result<IAudioClient, String> {
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};

    let enumerator: IMMDeviceEnumerator = unsafe {
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|error| format!("WASAPI endpoint enumeration failed: {error}"))?
    };
    let device = unsafe {
        enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|error| format!("WASAPI default render endpoint failed: {error}"))?
    };
    unsafe {
        device
            .Activate(CLSCTX_ALL, None)
            .map_err(|error| format!("WASAPI endpoint activation failed: {error}"))
    }
}
