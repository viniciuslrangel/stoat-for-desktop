#[cfg(windows)]
mod windows_impl {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND};
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetWindowThreadProcessId;

    struct OwnedHandle(HANDLE);

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            if !self.0.is_invalid() {
                // SAFETY: this handle was returned by a Win32 handle-opening
                // API and is closed exactly once by this owner.
                unsafe {
                    let _ = CloseHandle(self.0);
                }
            }
        }
    }

    fn image_basename(image: &str) -> &str {
        image
            .rsplit_once(['\\', '/'])
            .map_or(image, |(_, basename)| basename)
    }

    pub fn pid_from_hwnd(hwnd: u32) -> Result<u32, String> {
        if hwnd == 0 {
            return Err("invalid window handle".to_string());
        }
        let hwnd = HWND(hwnd as _);
        let mut pid = 0_u32;
        let thread_id = unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
        if thread_id == 0 || pid == 0 {
            return Err("invalid window handle".to_string());
        }
        Ok(pid)
    }

    pub fn query_process_image(pid: u32) -> Result<String, String> {
        if pid == 0 {
            return Err("invalid process id".to_string());
        }
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }
            .map_err(|error| format!("OpenProcess failed: {error}"))?;
        let _handle = OwnedHandle(handle);
        let mut buffer = vec![0_u16; 32_768];
        let mut length = match u32::try_from(buffer.len()) {
            Ok(length) => length,
            Err(_) => return Err("process image buffer is too large".to_string()),
        };
        unsafe {
            QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_FORMAT(0),
                PWSTR(buffer.as_mut_ptr()),
                &mut length,
            )
            .map_err(|error| format!("QueryFullProcessImageNameW failed: {error}"))?;
        }
        let length = match usize::try_from(length) {
            Ok(length) => length,
            Err(_) => return Err("invalid process image length".to_string()),
        };
        buffer.truncate(length);
        if buffer.is_empty() {
            return Err("process image path was empty".to_string());
        }
        Ok(String::from_utf16_lossy(&buffer))
    }

    pub fn find_processes_by_image_name(image_name: &str) -> Result<Vec<u32>, String> {
        let expected = image_basename(image_name.trim());
        if expected.is_empty() {
            return Err("image name must not be empty".to_string());
        }

        let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }
            .map_err(|error| format!("CreateToolhelp32Snapshot failed: {error}"))?;
        let _snapshot = OwnedHandle(snapshot);
        let mut entry = PROCESSENTRY32W::default();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut pids = Vec::new();

        let first = unsafe { Process32FirstW(snapshot, &mut entry) };
        if let Err(error) = first {
            return Err(format!("Process32FirstW failed: {error}"));
        }
        loop {
            let name_end = match entry.szExeFile.iter().position(|value| *value == 0) {
                Some(index) => index,
                None => entry.szExeFile.len(),
            };
            let name = String::from_utf16_lossy(&entry.szExeFile[..name_end]);
            if name.eq_ignore_ascii_case(expected) {
                pids.push(entry.th32ProcessID);
            }
            match unsafe { Process32NextW(snapshot, &mut entry) } {
                Ok(()) => {}
                Err(_) => break,
            }
        }
        pids.sort_unstable();
        pids.dedup();
        Ok(pids)
    }
}

#[cfg(windows)]
pub use windows_impl::{find_processes_by_image_name, pid_from_hwnd, query_process_image};

#[cfg(not(windows))]
pub fn pid_from_hwnd(_: u32) -> Result<u32, String> {
    Err("process helpers are only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn query_process_image(_: u32) -> Result<String, String> {
    Err("process helpers are only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn find_processes_by_image_name(_: &str) -> Result<Vec<u32>, String> {
    Err("process helpers are only supported on Windows".to_string())
}
