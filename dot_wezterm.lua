-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices
config.color_scheme = "Lavandula (Gogh)"

-- Enable the scrollbar.
-- It will occupy the right window padding space.
-- If right padding is set to 0 then it will be increased
-- to a single cell width
config.enable_scroll_bar = true

-- How many lines of scrollback you want to retain per tab
config.scrollback_lines = 3500

-- config.font = wezterm.font("Monaco")

-- Remove title header w/ close button
config.window_decorations = "RESIZE"

---- and finally, return the configuration to wezterm
return config
