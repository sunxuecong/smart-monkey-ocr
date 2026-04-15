use base64::Engine;
use tauri::Emitter;
use tauri_plugin_global_shortcut::Code;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_global_shortcut::Modifiers;
use tauri_plugin_global_shortcut::ShortcutState;

#[tauri::command]
fn screenshot_region() -> Result<String, String> {
    let temp_path = "/tmp/tauri_screenshot_region.png";
    let status = std::process::Command::new("screencapture")
        .args(["-i", "-r", temp_path])
        .status()
        .map_err(|e| format!("screencapture failed: {e}"))?;

    if !status.success() {
        return Err("cancelled".to_string());
    }

    let data = std::fs::read(temp_path).map_err(|e| format!("read screenshot: {e}"))?;
    let _ = std::fs::remove_file(temp_path);

    Ok(format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(data)
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let shortcut = "CommandOrControl+Shift+A";
            if let Err(e) =
                app.global_shortcut()
                    .on_shortcut(shortcut, move |app_handle, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            let _ = app_handle.emit("screenshot-shortcut", ());
                        }
                    })
            {
                eprintln!("Failed to register shortcut handler: {e}");
            }
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("Failed to register shortcut: {e}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![screenshot_region])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
