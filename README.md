# Dotfiles bootstrap

This repo manages my macOS setup with chezmoi.

## Goal

On a new Mac, the intended setup flow is:

1. install Xcode Command Line Tools
2. install Homebrew
3. install chezmoi
4. apply this repo with chezmoi
5. run `~/.config/bootstrap-pi.sh`
6. finish app logins and macOS permissions

## Prerequisites

### 1. Install Xcode Command Line Tools

```sh
xcode-select --install
```

### 2. Install Homebrew

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Then load brew into your shell for the current terminal session:

```sh
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 3. Install chezmoi

```sh
brew install chezmoi
```

## Apply dotfiles

### Option A: SSH

```sh
chezmoi init --apply git@github.com:joshchart/dotfiles.git
```

### Option B: HTTPS

```sh
chezmoi init --apply https://github.com/joshchart/dotfiles.git
```

This should install the managed config into `~/.config`, including:

- `~/.config/Brewfile`
- `~/.config/bootstrap-pi.sh`
- `~/.config/pi/agent/setup.sh`
- `~/.config/sketchybar/helpers/install.sh`

## Run bootstrap

After chezmoi apply completes:

```sh
bash ~/.config/bootstrap-pi.sh
```

The bootstrap script currently does the following:

1. runs `brew bundle --file ~/.config/Brewfile`
2. runs `~/.config/sketchybar/helpers/install.sh`
3. installs the pi CLI globally with npm
4. runs `~/.config/pi/agent/setup.sh`

## Post-bootstrap manual steps

Some things still need to be done manually on a new machine.

### Logins / auth

Examples:

- `pi` and `/login` if needed
- `gh auth login`
- any cloud/provider logins
- any app-specific sign-in flows

### macOS permissions

Grant any required permissions for tools such as:

- Karabiner-Elements
- Aerospace
- Sketchybar helpers
- terminal apps that need Accessibility / Input Monitoring / Full Disk Access

## Recommended verification

After bootstrap finishes, verify the key pieces:

```sh
brew bundle check --file ~/.config/Brewfile || true
command -v pi
command -v sketchybar || true
command -v gh || true
```

You can also open a new shell and verify:

```sh
zsh
pi
```

## Updating an existing machine

To refresh an existing machine:

```sh
chezmoi update
bash ~/.config/bootstrap-pi.sh
```

## Notes

- `~/.config/bootstrap-pi.sh` expects this config to live at `~/.config`.
- This repo is intended to be applied with chezmoi, not cloned directly into arbitrary paths.
- This README is stored in the chezmoi source repo and ignored from target application.
