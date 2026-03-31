#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_DIR="$HOME/.config/pi/agent"
SETTINGS_PATH="$EXPECTED_DIR/settings.json"
WORKSPACES_DIR="$HOME/workspaces"
PI_DIFF_REVIEW_REPO_URL="https://github.com/joshchart/pi-diff-review.git"
PI_DIFF_REVIEW_DIR="$WORKSPACES_DIR/pi-diff-review"
PI_DIFF_REVIEW_ENTRY="$PI_DIFF_REVIEW_DIR/src/index.ts"
LAST_CHANGELOG_VERSION="0.64.0"

# Verify we're in the right place
if [ "$SCRIPT_DIR" != "$EXPECTED_DIR" ]; then
  echo "⚠️  This repo should be cloned to ~/.config/pi/agent/"
  echo "   Current location: $SCRIPT_DIR"
  echo "   Expected: $EXPECTED_DIR"
  echo ""
  exit 1
fi

echo "Setting up pi-config at $EXPECTED_DIR"
echo ""

# Create settings.json if it doesn't exist
if [ ! -f "$SETTINGS_PATH" ]; then
  echo "Creating settings.json..."
  cat > "$SETTINGS_PATH" <<EOF
{
  "lastChangelogVersion": "$LAST_CHANGELOG_VERSION",
  "defaultProvider": "openai-codex",
  "defaultModel": "gpt-5.4",
  "defaultThinkingLevel": "high",
  "packages": [
    {
      "source": "git:github.com/HazAT/pi-interactive-subagents",
      "extensions": [
        "-pi-extension/session-artifacts/index.ts",
        "-pi-extension/subagents/index.ts"
      ]
    },
    "npm:pi-vim",
    {
      "source": "npm:pi-provider-kiro",
      "extensions": [
        "-dist/index.js"
      ]
    }
  ],
  "extensions": [
    "$PI_DIFF_REVIEW_ENTRY"
  ],
  "hideThinkingBlock": true,
  "enabledModels": [
    "openai-codex/gpt-5.3-codex",
    "openai-codex/gpt-5.4",
    "anthropic/claude-haiku-4-5",
    "anthropic/claude-opus-4-6",
    "anthropic/claude-opus-4-5",
    "anthropic/claude-sonnet-4-6"
  ],
  "theme": "tokyo-night",
  "quietStartup": true
}
EOF
else
  echo "settings.json already exists — updating pi-diff-review path"
  export SETTINGS_PATH PI_DIFF_REVIEW_ENTRY LAST_CHANGELOG_VERSION
  python3 <<'PY'
import json
import os
from pathlib import Path

settings_path = Path(os.environ["SETTINGS_PATH"])
entry = os.environ["PI_DIFF_REVIEW_ENTRY"]
last_changelog_version = os.environ["LAST_CHANGELOG_VERSION"]

data = json.loads(settings_path.read_text())

data["lastChangelogVersion"] = last_changelog_version
data["defaultProvider"] = "openai-codex"
data["defaultModel"] = "gpt-5.4"
data["defaultThinkingLevel"] = "high"
data["hideThinkingBlock"] = True
data["enabledModels"] = [
    "openai-codex/gpt-5.3-codex",
    "openai-codex/gpt-5.4",
    "anthropic/claude-haiku-4-5",
    "anthropic/claude-opus-4-6",
    "anthropic/claude-opus-4-5",
    "anthropic/claude-sonnet-4-6",
]
data["theme"] = "tokyo-night"
data["quietStartup"] = True

extensions = data.get("extensions")
if not isinstance(extensions, list):
    extensions = []
extensions = [
    value for value in extensions
    if not (isinstance(value, str) and value.endswith("/workspaces/pi-diff-review/src/index.ts"))
]
extensions.append(entry)
data["extensions"] = extensions

packages = data.get("packages")
if isinstance(packages, list):
    data["packages"] = [
        value for value in packages
        if not (
            isinstance(value, str)
            and (
                value.endswith("/workspaces/pi-diff-review")
                or value.endswith("/workspaces/pi-diff-review/src/index.ts")
            )
        )
    ]

settings_path.write_text(json.dumps(data, indent=2) + "\n")
PY
  echo ""
fi

# Install packages used by this config
echo "Installing packages..."
pi install git:github.com/HazAT/pi-interactive-subagents 2>/dev/null || echo "  pi-interactive-subagents already installed"
pi install npm:pi-vim 2>/dev/null || echo "  pi-vim already installed"
pi install npm:pi-provider-kiro 2>/dev/null || echo "  pi-provider-kiro already installed"
echo ""

# Clone/update pi-diff-review in ~/workspaces
mkdir -p "$WORKSPACES_DIR"
if [ -d "$PI_DIFF_REVIEW_DIR/.git" ]; then
  echo "Updating pi-diff-review in $PI_DIFF_REVIEW_DIR"
  git -C "$PI_DIFF_REVIEW_DIR" pull --ff-only
elif [ -e "$PI_DIFF_REVIEW_DIR" ]; then
  echo "⚠️  $PI_DIFF_REVIEW_DIR exists but is not a git repo"
  echo "   Remove it or clone $PI_DIFF_REVIEW_REPO_URL manually"
else
  echo "Cloning pi-diff-review into $PI_DIFF_REVIEW_DIR"
  git clone "$PI_DIFF_REVIEW_REPO_URL" "$PI_DIFF_REVIEW_DIR"
fi
echo ""

if [ -f "$PI_DIFF_REVIEW_DIR/package.json" ]; then
  echo "Installing workspace extension dependencies: pi-diff-review"
  (
    cd "$PI_DIFF_REVIEW_DIR"
    if [ -f package-lock.json ]; then
      npm ci
    else
      npm install
    fi
  )
  echo ""
fi

echo "Extensions present in this config:"
printf '  - %s\n' \
  answer \
  compact-header \
  execute-command \
  handoff \
  parrot \
  pi-diff-review \
  review \
  split-fork \
  todos

echo ""
echo "✅ Setup complete!"
echo ""
echo "pi-diff-review path: $PI_DIFF_REVIEW_ENTRY"
echo "Restart pi or run /reload to pick up all changes."