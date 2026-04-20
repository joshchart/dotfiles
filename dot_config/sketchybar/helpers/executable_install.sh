#!/usr/bin/env bash
set -euo pipefail

say() {
  printf '==> %s\n' "$*"
}

say "Installing sketchybar dependencies"
brew install lua
brew install switchaudio-osx
brew install nowplaying-cli

brew tap felixkratz/formulae
brew install sketchybar

say "Installing sketchybar fonts"
brew install --cask sf-symbols
brew install --cask homebrew/cask-fonts/font-sf-mono
brew install --cask homebrew/cask-fonts/font-sf-pro

mkdir -p "$HOME/Library/Fonts"
curl -fsSL https://github.com/kvndrsslr/sketchybar-app-font/releases/download/v2.0.59/sketchybar-app-font.ttf \
  -o "$HOME/Library/Fonts/sketchybar-app-font.ttf"

say "Installing SbarLua"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

git clone --depth=1 https://github.com/FelixKratz/SbarLua.git "$tmpdir/SbarLua"
(
  cd "$tmpdir/SbarLua"
  make install
)

say "Sketchybar setup complete"
