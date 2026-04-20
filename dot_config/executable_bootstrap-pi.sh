#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPECTED_CONFIG_DIR="$HOME/.config"
BREWFILE="$SCRIPT_DIR/Brewfile"
SKETCHYBAR_SETUP="$SCRIPT_DIR/sketchybar/helpers/install.sh"
PI_AGENT_DIR="$SCRIPT_DIR/pi/agent"
PI_AGENT_SETUP="$PI_AGENT_DIR/setup.sh"
PI_CLI_PACKAGE="@mariozechner/pi-coding-agent"

say() {
  printf '==> %s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

if [ "$SCRIPT_DIR" != "$EXPECTED_CONFIG_DIR" ]; then
  die "Expected this repo at $EXPECTED_CONFIG_DIR (found $SCRIPT_DIR)"
fi

[ -f "$BREWFILE" ] || die "Missing Brewfile at $BREWFILE"
[ -f "$SKETCHYBAR_SETUP" ] || die "Missing sketchybar setup script at $SKETCHYBAR_SETUP"
[ -f "$PI_AGENT_SETUP" ] || die "Missing pi setup script at $PI_AGENT_SETUP"
command -v brew >/dev/null 2>&1 || die "Homebrew is required. Install Homebrew first."

say "Installing Brewfile dependencies"
brew bundle --file="$BREWFILE"

say "Running sketchybar setup"
bash "$SKETCHYBAR_SETUP"

command -v npm >/dev/null 2>&1 || die "npm is required after brew bundle. Ensure node is in Brewfile."

say "Installing pi CLI ($PI_CLI_PACKAGE)"
npm install -g "$PI_CLI_PACKAGE"
hash -r 2>/dev/null || true
command -v pi >/dev/null 2>&1 || die "pi was not found after npm install"

say "Running pi agent setup"
bash "$PI_AGENT_SETUP"

say "Bootstrap complete"
printf '\nNext steps:\n'
printf '  1. Run: pi\n'
printf '  2. Authenticate with /login if needed\n'
