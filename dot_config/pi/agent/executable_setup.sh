#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXPECTED_DIR="$HOME/.config/pi/agent"
SETTINGS_PATH="$EXPECTED_DIR/settings.json"
WORKSPACES_DIR="$HOME/workspaces"
PI_SLOPCHOP_REPO_URL="https://github.com/joshchart/pi-slopchop.git"
PI_SLOPCHOP_DIR="$WORKSPACES_DIR/pi-slopchop"
PI_SLOPCHOP_ENTRY="~/workspaces/pi-slopchop/src/index.ts"
PI_SLOPCHOP_ENTRY_PATH="$PI_SLOPCHOP_DIR/src/index.ts"
LAST_CHANGELOG_VERSION="0.85.0"
PI_VIM_PACKAGE="ssh://git@github.com/joshchart/pi-vim.git"

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
    "$PI_VIM_PACKAGE",
    {
      "source": "npm:pi-provider-kiro",
      "extensions": [
        "-dist/index.js"
      ]
    },
    "git:github.com/joshchart/pi-sessionizer"
  ],
  "extensions": [
    "$PI_SLOPCHOP_ENTRY"
  ],
  "hideThinkingBlock": false,
  "enabledModels": [
    "openai-codex/gpt-5.4",
    "openai-codex/gpt-5.5"
  ],
  "theme": "tokyo-night",
  "quietStartup": true,
  "enableInstallTelemetry": true
}
EOF
else
  echo "settings.json already exists — syncing managed settings"
  export SETTINGS_PATH PI_SLOPCHOP_ENTRY LAST_CHANGELOG_VERSION PI_VIM_PACKAGE
  python3 <<'PY'
import json
import os
from pathlib import Path

settings_path = Path(os.environ["SETTINGS_PATH"])
entry = os.environ["PI_SLOPCHOP_ENTRY"]
last_changelog_version = os.environ["LAST_CHANGELOG_VERSION"]
pi_vim_package = os.environ["PI_VIM_PACKAGE"]

data = json.loads(settings_path.read_text())

data["lastChangelogVersion"] = last_changelog_version
data["defaultProvider"] = "openai-codex"
data["defaultModel"] = "gpt-5.4"
data["defaultThinkingLevel"] = "high"
data["packages"] = [
    pi_vim_package,
    {
        "source": "npm:pi-provider-kiro",
        "extensions": ["-dist/index.js"],
    },
    "git:github.com/joshchart/pi-sessionizer",
]
data["extensions"] = [entry]
data["hideThinkingBlock"] = False
data["enabledModels"] = [
    "openai-codex/gpt-5.4",
    "openai-codex/gpt-5.5",
]
data["theme"] = "tokyo-night"
data["quietStartup"] = True
data["enableInstallTelemetry"] = True

settings_path.write_text(json.dumps(data, indent=2) + "\n")
PY
  echo ""
fi

# Install packages used by this config
echo "Installing packages..."
pi install "$PI_VIM_PACKAGE" 2>/dev/null || echo "  pi-vim already installed"
pi install npm:pi-provider-kiro 2>/dev/null || echo "  pi-provider-kiro already installed"
pi install git:github.com/joshchart/pi-sessionizer 2>/dev/null || echo "  pi-sessionizer already installed"
echo ""

# Clone/update pi-slopchop in ~/workspaces
mkdir -p "$WORKSPACES_DIR"
if [ -d "$PI_SLOPCHOP_DIR/.git" ]; then
  echo "Updating pi-slopchop in $PI_SLOPCHOP_DIR"
  if git -C "$PI_SLOPCHOP_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    git -C "$PI_SLOPCHOP_DIR" pull --ff-only
  else
    echo "  No upstream configured for current branch; skipping pull"
  fi
elif [ -e "$PI_SLOPCHOP_DIR" ]; then
  echo "⚠️  $PI_SLOPCHOP_DIR exists but is not a git repo"
  echo "   Remove it or clone $PI_SLOPCHOP_REPO_URL manually"
else
  echo "Cloning pi-slopchop into $PI_SLOPCHOP_DIR"
  git clone "$PI_SLOPCHOP_REPO_URL" "$PI_SLOPCHOP_DIR"
fi
echo ""

if [ -f "$PI_SLOPCHOP_DIR/package.json" ]; then
  echo "Installing workspace extension dependencies: pi-slopchop"
  (
    cd "$PI_SLOPCHOP_DIR"
    if [ -f package-lock.json ]; then
      npm ci
    else
      npm install
    fi
  )
  echo ""
fi

echo "Configured packages and extensions:"
printf '  - %s\n' \
  "$PI_VIM_PACKAGE" \
  'npm:pi-provider-kiro (-dist/index.js)' \
  git:github.com/joshchart/pi-sessionizer \
  "$PI_SLOPCHOP_ENTRY"

echo ""
echo "✅ Setup complete!"
echo ""
echo "pi-slopchop path: $PI_SLOPCHOP_ENTRY_PATH"
echo "Restart pi or run /reload to pick up all changes."
