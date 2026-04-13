# 設計書 - Phase 2: hooks 注入（ラッパースクリプト）

## アーキテクチャ

### 対象コンポーネント

```
spawn_pty (Rust)
    │ env: SPEC_PROMPT_NOTIFICATION=1
    │ env: PATH=~/.config/spec-prompt/bin:$PATH
    ▼
ユーザーが "claude" を入力
    │
    ▼
~/.config/spec-prompt/bin/claude (ラッパー)
    │ --settings '{"hooks":{...}}' を付与
    ▼
本物の claude バイナリ (hooks 付きで起動)
    │
    │ hooks イベント発火 → claude-notify.sh 実行
    ▼
claude-notify.sh
    │ stdin → curl POST → HTTP サーバー (Phase 1)
    ▼
macOS 通知
```

### 影響範囲

- **フロントエンド**: 変更なし
- **バックエンド（Rust）**: `pty.rs` に環境変数追加、スクリプト配置コマンド追加

## 実装方針

### 概要

cmux の実装パターンをそのまま踏襲する。claude コマンドのラッパースクリプトを PATH の先頭に配置し、`--settings` フラグで hooks を注入する。

### 詳細

1. `claude-notify.sh` を作成（stdin → curl POST）
2. `claude-wrapper.sh` を作成（`--settings` で hooks 注入）
3. Tauri のセットアップで `~/.config/spec-prompt/` にスクリプトを配置
4. `spawn_pty` で環境変数 `SPEC_PROMPT_NOTIFICATION` と PATH を設定

## スクリプト設計

### claude-notify.sh

```bash
#!/bin/bash
# SpecPrompt Claude Code notification hook
# stdin から JSON を読み取り、HTTP サーバーに POST する
INPUT=$(cat)
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "$INPUT" \
  "http://127.0.0.1:19823/claude-hook/${SPEC_PROMPT_HOOK_EVENT:-notification}" \
  --connect-timeout 2 \
  2>/dev/null || true
echo '{}'
```

### claude-wrapper.sh

```bash
#!/bin/bash
# SpecPrompt claude wrapper
# SPEC_PROMPT_NOTIFICATION が設定されている場合のみ hooks を注入

find_real_claude() {
    local self_dir
    self_dir="$(cd "$(dirname "$0")" && pwd)"
    local IFS=:
    for d in $PATH; do
        [[ "$d" == "$self_dir" ]] && continue
        [[ -x "$d/claude" ]] && printf '%s' "$d/claude" && return 0
    done
    return 1
}

REAL_CLAUDE="$(find_real_claude)" || { echo "Error: claude not found in PATH" >&2; exit 127; }

# SpecPrompt ターミナル外では素通し
if [[ -z "$SPEC_PROMPT_NOTIFICATION" ]]; then
    exec "$REAL_CLAUDE" "$@"
fi

# hooks JSON
HOOK_CMD="SPEC_PROMPT_HOOK_EVENT=\${event} ~/.config/spec-prompt/hooks/claude-notify.sh"
HOOKS_JSON='{"hooks":{"Notification":[{"hooks":[{"type":"command","command":"SPEC_PROMPT_HOOK_EVENT=notification ~/.config/spec-prompt/hooks/claude-notify.sh","timeout":5000}]}],"Stop":[{"hooks":[{"type":"command","command":"SPEC_PROMPT_HOOK_EVENT=stop ~/.config/spec-prompt/hooks/claude-notify.sh","timeout":5000}]}]}}'

exec "$REAL_CLAUDE" --settings "$HOOKS_JSON" "$@"
```

## PTY 環境変数設定

### pty.rs の変更

```rust
// spawn_pty 内、既存の PATH 設定の後に追加

// 通知機能: ラッパースクリプトを PATH の先頭に追加
if let Ok(home) = std::env::var("HOME") {
    let wrapper_dir = format!("{}/.config/spec-prompt/bin", home);
    if std::path::Path::new(&wrapper_dir).exists() {
        let current_path = std::env::var("PATH").unwrap_or_default();
        cmd.env("PATH", format!("{}:{}", wrapper_dir, current_path));
        cmd.env("SPEC_PROMPT_NOTIFICATION", "1");
    }
}
```

## スクリプト配置コマンド

### notification.rs への追加

```rust
/// アプリリソースからスクリプトを ~/.config/spec-prompt/ にコピーする
pub fn setup_notification_scripts(app: &AppHandle) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let base = format!("{}/.config/spec-prompt", home);

    // ディレクトリ作成
    std::fs::create_dir_all(format!("{}/bin", base)).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(format!("{}/hooks", base)).map_err(|e| e.to_string())?;

    // リソースからコピー
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    copy_script(&resource_dir, &base, "claude-wrapper.sh", "bin/claude")?;
    copy_script(&resource_dir, &base, "claude-notify.sh", "hooks/claude-notify.sh")?;

    Ok(())
}

fn copy_script(resource_dir: &Path, base: &str, src: &str, dst: &str) -> Result<(), String> {
    let src_path = resource_dir.join(src);
    let dst_path = format!("{}/{}", base, dst);
    std::fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;

    // chmod +x
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dst_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

## 設計上の決定事項

| 決定事項 | 理由 | 代替案 |
|---|---|---|
| ラッパー + `--settings` 方式 | settings.json への書き込み不要、cmux と同じ方式で実績あり | settings.json への直接書き込み（既存設定破壊リスク） |
| 環境変数 `SPEC_PROMPT_NOTIFICATION` で制御 | SpecPrompt 外では自動的に無効化 | 設定ファイルで制御（起動前に読む必要がある） |
| スクリプトを `~/.config/spec-prompt/` に配置 | XDG 準拠、アプリ固有の設定ディレクトリ | `/tmp/`（再起動で消える）、アプリバンドル内（書き換え不可） |

## 未解決事項

- [ ] cmux がインストールされている場合のラッパー競合（cmux のラッパーと SpecPrompt のラッパーが両方 PATH にある場合）
- [ ] claude コマンドが存在しない場合のエラーハンドリング
