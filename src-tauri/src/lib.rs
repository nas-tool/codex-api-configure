use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use toml_edit::{value, DocumentMut, Item, Table};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigureCodexPayload {
    api_key: String,
    base_url: String,
    supports_websockets: bool,
    config_content: Option<String>,
    auth_content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigureClaudePayload {
    api_key: String,
    base_url: String,
    settings_content: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfigureResult {
    message: String,
    written_files: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExistingConfig {
    codex_config: String,
    codex_auth: String,
    claude_settings: String,
    codex_config_path: String,
    codex_auth_path: String,
    claude_settings_path: String,
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    validate_external_url(&url)?;

    let status = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .status()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(&url).status()
    } else {
        Command::new("xdg-open").arg(&url).status()
    }
    .map_err(|error| format!("无法打开默认浏览器: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("默认浏览器打开失败。".to_string())
    }
}

#[tauri::command]
fn read_existing_config() -> Result<ExistingConfig, String> {
    let home = home_dir()?;
    let codex_dir = home.join(".codex");
    let claude_dir = home.join(".claude");
    let codex_config_path = codex_dir.join("config.toml");
    let codex_auth_path = codex_dir.join("auth.json");
    let claude_settings_path = claude_dir.join("settings.json");

    Ok(ExistingConfig {
        codex_config: fs::read_to_string(&codex_config_path).unwrap_or_default(),
        codex_auth: fs::read_to_string(&codex_auth_path).unwrap_or_default(),
        claude_settings: fs::read_to_string(&claude_settings_path).unwrap_or_default(),
        codex_config_path: codex_config_path.to_string_lossy().into_owned(),
        codex_auth_path: codex_auth_path.to_string_lossy().into_owned(),
        claude_settings_path: claude_settings_path.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
fn configure_codex(payload: ConfigureCodexPayload) -> Result<ConfigureResult, String> {
    validate_secret(&payload.api_key)?;
    validate_url(&payload.base_url)?;

    let codex_dir = home_dir()?.join(".codex");
    fs::create_dir_all(&codex_dir).map_err(|error| format!("无法创建 Codex 配置目录: {error}"))?;

    let config_path = codex_dir.join("config.toml");
    let auth_path = codex_dir.join("auth.json");

    if let Some(config_content) = payload.config_content {
        validate_toml(&config_content)?;
        fs::write(&config_path, ensure_trailing_newline(&config_content))
            .map_err(|error| format!("无法写入 Codex config.toml: {error}"))?;
    } else {
        write_codex_config(&config_path, &payload.base_url, payload.supports_websockets)?;
    }

    if let Some(auth_content) = payload.auth_content {
        validate_json_object(&auth_content)?;
        fs::write(&auth_path, ensure_trailing_newline(&auth_content))
            .map_err(|error| format!("无法写入 Codex auth.json: {error}"))?;
    } else {
        write_auth_json(&auth_path, &payload.api_key)?;
    }

    Ok(ConfigureResult {
        message: "Codex 配置已写入。".to_string(),
        written_files: paths_to_strings(&[config_path, auth_path]),
    })
}

#[tauri::command]
fn configure_claude(payload: ConfigureClaudePayload) -> Result<ConfigureResult, String> {
    validate_secret(&payload.api_key)?;
    validate_url(&payload.base_url)?;

    let claude_dir = home_dir()?.join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|error| format!("无法创建 Claude 配置目录: {error}"))?;

    let settings_path = claude_dir.join("settings.json");
    if let Some(settings_content) = payload.settings_content {
        validate_json_object(&settings_content)?;
        fs::write(&settings_path, ensure_trailing_newline(&settings_content))
            .map_err(|error| format!("无法写入 Claude settings.json: {error}"))?;
    } else {
        write_claude_settings(&settings_path, &payload.base_url, &payload.api_key)?;
    }

    Ok(ConfigureResult {
        message: "Claude Code 配置已写入。".to_string(),
        written_files: paths_to_strings(&[settings_path]),
    })
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_url,
            read_existing_config,
            configure_codex,
            configure_claude
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn write_codex_config(path: &Path, base_url: &str, supports_websockets: bool) -> Result<(), String> {
    let existing = fs::read_to_string(path).unwrap_or_default();
    let mut document = existing
        .parse::<DocumentMut>()
        .unwrap_or_else(|_| DocumentMut::new());

    for key in [
        "model_provider",
        "model",
        "review_model",
        "model_reasoning_effort",
        "disable_response_storage",
        "network_access",
        "windows_wsl_setup_acknowledged",
        "model_context_window",
        "model_auto_compact_token_limit",
    ] {
        document.remove(key);
    }

    if let Some(Item::Table(providers)) = document.get_mut("model_providers") {
        providers.remove("OpenAI");
        if providers.is_empty() {
            document.remove("model_providers");
        }
    }

    if let Some(Item::Table(features)) = document.get_mut("features") {
        features.remove("responses_websockets_v2");
        if features.is_empty() {
            document.remove("features");
        }
    }

    let mut prefix = DocumentMut::new();
    prefix["model_provider"] = value("OpenAI");
    prefix["model"] = value("gpt-5.4");
    prefix["review_model"] = value("gpt-5.4");
    prefix["model_reasoning_effort"] = value("xhigh");
    prefix["disable_response_storage"] = value(true);
    prefix["network_access"] = value("enabled");
    prefix["windows_wsl_setup_acknowledged"] = value(true);
    prefix["model_context_window"] = value(1_000_000);
    prefix["model_auto_compact_token_limit"] = value(900_000);

    let mut openai = Table::new();
    openai["name"] = value("OpenAI");
    openai["base_url"] = value(base_url);
    openai["wire_api"] = value("responses");
    if supports_websockets {
        openai["supports_websockets"] = value(true);
    }
    openai["requires_openai_auth"] = value(true);

    let mut providers = Table::new();
    providers["OpenAI"] = Item::Table(openai);
    prefix["model_providers"] = Item::Table(providers);

    if supports_websockets {
        let mut features = Table::new();
        features["responses_websockets_v2"] = value(true);
        prefix["features"] = Item::Table(features);
    }

    let mut output = prefix.to_string();
    let remainder = document.to_string();
    let trimmed = remainder.trim();
    if !trimmed.is_empty() {
        output.push('\n');
        output.push_str(trimmed);
        output.push('\n');
    }

    fs::write(path, output).map_err(|error| format!("无法写入 Codex config.toml: {error}"))
}

fn write_auth_json(path: &Path, api_key: &str) -> Result<(), String> {
    let mut root = read_json_object(path);
    root.insert("OPENAI_API_KEY".to_string(), Value::String(api_key.to_string()));
    write_json_object(path, root, "无法写入 Codex auth.json")
}

fn write_claude_settings(path: &Path, base_url: &str, api_key: &str) -> Result<(), String> {
    let mut root = read_json_object(path);
    let env_value = root
        .entry("env".to_string())
        .or_insert_with(|| Value::Object(Map::new()));

    if !env_value.is_object() {
        *env_value = Value::Object(Map::new());
    }

    let env_object = env_value
        .as_object_mut()
        .ok_or_else(|| "无法读取 Claude env 配置。".to_string())?;
    env_object.insert("ANTHROPIC_BASE_URL".to_string(), Value::String(base_url.to_string()));
    env_object.insert("ANTHROPIC_AUTH_TOKEN".to_string(), Value::String(api_key.to_string()));
    env_object.insert(
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC".to_string(),
        Value::String("1".to_string()),
    );
    env_object.insert(
        "CLAUDE_CODE_ATTRIBUTION_HEADER".to_string(),
        Value::String("0".to_string()),
    );

    write_json_object(path, root, "无法写入 Claude settings.json")
}

fn read_json_object(path: &Path) -> Map<String, Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

fn write_json_object(path: &Path, object: Map<String, Value>, context: &str) -> Result<(), String> {
    let content = serde_json::to_string_pretty(&json!(object))
        .map_err(|error| format!("{context}: {error}"))?;
    fs::write(path, format!("{content}\n")).map_err(|error| format!("{context}: {error}"))
}

fn validate_secret(value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err("请填写 API Key。".to_string())
    } else {
        Ok(())
    }
}

fn validate_url(value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        Err("请填写中转站地址。".to_string())
    } else {
        Ok(())
    }
}

fn validate_external_url(value: &str) -> Result<(), String> {
    let normalized = value.trim().to_ascii_lowercase();
    if normalized.starts_with("http://") || normalized.starts_with("https://") {
        Ok(())
    } else {
        Err("只能打开 http:// 或 https:// 链接。".to_string())
    }
}

fn validate_toml(value: &str) -> Result<(), String> {
    value
        .parse::<DocumentMut>()
        .map(|_| ())
        .map_err(|error| format!("手动编辑的 TOML 无法解析: {error}"))
}

fn validate_json_object(value: &str) -> Result<(), String> {
    serde_json::from_str::<Value>(value)
        .map_err(|error| format!("手动编辑的 JSON 无法解析: {error}"))
        .and_then(|value| {
            if value.is_object() {
                Ok(())
            } else {
                Err("手动编辑的 JSON 顶层必须是对象。".to_string())
            }
        })
}

fn ensure_trailing_newline(value: &str) -> String {
    if value.ends_with('\n') {
        value.to_string()
    } else {
        format!("{value}\n")
    }
}

fn home_dir() -> Result<PathBuf, String> {
    if cfg!(windows) {
        env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .ok_or_else(|| "无法读取 Windows 用户目录。".to_string())
    } else {
        env::var_os("HOME")
            .map(PathBuf::from)
            .ok_or_else(|| "无法读取用户目录。".to_string())
    }
}

fn paths_to_strings(paths: &[PathBuf]) -> Vec<String> {
    paths
        .iter()
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn codex_config_is_written_at_top_without_duplicate_managed_keys() {
        let path = temp_file("codex-config-basic.toml");
        fs::write(
            &path,
            r#"model_provider = "Old"
model = "old-model"
custom_value = "keep-me"

[model_providers.OpenAI]
base_url = "https://old.example.com"

[other]
enabled = true
"#,
        )
        .unwrap();

        write_codex_config(&path, "https://relay.example.com", false).unwrap();
        let content = fs::read_to_string(&path).unwrap();

        assert!(content.starts_with("model_provider = \"OpenAI\"\nmodel = \"gpt-5.4\""));
        assert_eq!(content.lines().filter(|line| *line == "model_provider = \"OpenAI\"").count(), 1);
        assert_eq!(content.matches("[model_providers.OpenAI]").count(), 1);
        assert!(content.contains("base_url = \"https://relay.example.com\""));
        assert!(content.contains("custom_value = \"keep-me\""));
        assert!(content.contains("[other]\nenabled = true"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn codex_config_can_enable_websocket_feature() {
        let path = temp_file("codex-config-websocket.toml");

        write_codex_config(&path, "https://relay.example.com", true).unwrap();
        let content = fs::read_to_string(&path).unwrap();

        assert!(content.contains("supports_websockets = true"));
        assert!(content.contains("[features]\nresponses_websockets_v2 = true"));

        let _ = fs::remove_file(path);
    }

    fn temp_file(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        env::temp_dir().join(format!("{nanos}-{name}"))
    }
}
