-- Set <space> as the leader key
-- See `:help mapleader`
--  NOTE: Must happen before plugins are loaded (otherwise wrong leader will be used)
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '

-- Set to true if you have a Nerd Font installed and selected in the terminal
vim.g.have_nerd_font = true

-- Sync clipboard between OS and Neovim.
--  Remove this option if you want your OS clipboard to remain independent.
--  See `:help 'clipboard'`
-- vim.opt.clipboard = 'unnamedplus'

-- Enable break indent
vim.opt.breakindent = true

-- Save undo history
vim.opt.undofile = true

-- Case-insensitive searching UNLESS \C or one or more capital letters in the search term
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- Keep signcolumn on by default
vim.opt.signcolumn = 'yes'

-- Decrease update time
vim.opt.updatetime = 250

-- Decrease mapped sequence wait time
-- Displays which-key popup sooner
vim.opt.timeoutlen = 300

-- Sets how neovim will display certain whitespace characters in the editor.
--  See `:help 'list'`
--  and `:help 'listchars'`
vim.opt.list = true
vim.opt.listchars = { tab = '» ', trail = '·', nbsp = '␣' }

-- Preview substitutions live, as you type!
vim.opt.inccommand = 'split'

-- Minimal number of screen lines to keep above and below the cursor.
vim.opt.scrolloff = 10

-- Show line marking 80 chars
-- vim.opt.colorcolumn = '80'

-- Use spaces instead of tabs
-- vim.opt.expandtab = true -- Convert tabs to spaces
-- vim.opt.tabstop = 4 -- Width of a tab character
-- vim.opt.shiftwidth = 4 -- Number of spaces to use for each step of (auto)indent
-- vim.opt.softtabstop = 4 -- Number of spaces Neovim uses for <Tab> in insert mode

-- Highlight when yanking (copying) text
--  Try it with `yap` in normal mode
--  See `:help vim.highlight.on_yank()`
vim.api.nvim_create_autocmd('TextYankPost', {
  desc = 'Highlight when yanking (copying) text',
  group = vim.api.nvim_create_augroup('kickstart-highlight-yank', { clear = true }),
  callback = function()
    vim.highlight.on_yank()
  end,
})

if vim.g.vscode then
  -- VSCode extension
  local opts = { noremap = true, silent = true }

  -- https://github.com/vscode-neovim/vscode-neovim/blob/HEAD/runtime/vscode/overrides/vscode-window-commands.vim
  vim.keymap.set({ 'n', 'x' }, '<C-j>', "<Cmd>call VSCodeNotify('workbench.action.navigateDown')<CR>", opts)
  vim.keymap.set({ 'n', 'x' }, '<C-k>', "<Cmd>call VSCodeNotify('workbench.action.navigateUp')<CR>", opts)
  vim.keymap.set({ 'n', 'x' }, '<C-h>', "<Cmd>call VSCodeNotify('workbench.action.navigateLeft')<CR>", opts)
  vim.keymap.set({ 'n', 'x' }, '<C-l>', "<Cmd>call VSCodeNotify('workbench.action.navigateRight')<CR>", opts)

  -- Require the vscode module
  local vscode = require 'vscode'

  -- Define a function to split the editor
  local function split(direction)
    -- Determine the VSCode command based on the direction
    local command = (direction == 'h') and 'workbench.action.splitEditorDown' or 'workbench.action.splitEditorRight'

    -- Call the VSCode command to split the editor
    vscode.call(command)
  end

  vim.keymap.set({ 'n', 'x' }, '<leader>h', function()
    split 'h'
  end, opts)
  vim.keymap.set({ 'n', 'x' }, '<leader>v', function()
    split 'v'
  end, opts)

  vim.keymap.set('n', '<leader>pv', vim.cmd.Ex, { desc = '[p]roject [v]iew' })
else
  vim.keymap.set('n', '<leader>pv', vim.cmd.Ex, { desc = '[p]roject [v]iew' })

  -- Remaps for Leetcode.nvim
  vim.keymap.set('n', '<leader>l', ':Leet<CR>', { desc = 'Open LeetCode dashboard' })
  vim.keymap.set('n', '<leader>lr', ':Leet run<CR>', { desc = 'Run LeetCode problem' })
  vim.keymap.set('n', '<leader>lg', ':Leet lang<CR>', { desc = 'Change LeetCode language' })
  vim.keymap.set('n', '<leader>ls', ':Leet submit<CR>', { desc = 'Submit LeetCode solution' })
  vim.keymap.set('n', '<leader>ll', ':Leet list<CR>', { desc = 'List LeetCode problems' })
  vim.keymap.set('n', '<leader>le', ':Leet exit<CR>', { desc = 'Exit LeetCode' })

  -- Show which line your cursor is on (NOTE: doesn't work with vscode)
  vim.opt.cursorline = true

  -- [[ Setting options ]]
  -- See `:help vim.opt`
  -- NOTE: You can change these options as you wish!
  --  For more options, you can see `:help option-list`

  -- Make line numbers default
  vim.opt.number = true
  -- You can also add relative line numbers, to help with jumping.
  --  Experiment for yourself to see if you like it!
  vim.opt.relativenumber = true

  -- Enable mouse mode, can be useful for resizing splits for example!
  vim.opt.mouse = 'a'

  -- Don't show the mode, since it's already in the status line
  vim.opt.showmode = false

  -- Configure how new splits should be opened
  vim.opt.splitright = true
  vim.opt.splitbelow = true

  -- [[ Basic Keymaps ]]
  --  See `:help vim.keymap.set()`

  -- Set highlight on search, but clear on pressing <Esc> in normal mode
  vim.opt.hlsearch = true
  vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<CR>')

  -- Diagnostic keymaps
  vim.keymap.set('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous [D]iagnostic message' })
  vim.keymap.set('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next [D]iagnostic message' })
  vim.keymap.set('n', '<leader>e', vim.diagnostic.open_float, { desc = 'Show diagnostic [E]rror messages' })
  vim.keymap.set('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostic [Q]uickfix list' })

  -- Exit terminal mode in the builtin terminal with a shortcut that is a bit easier
  -- for people to discover. Otherwise, you normally need to press <C-\><C-n>, which
  -- is not what someone will guess without a bit more experience.
  --
  -- NOTE: This won't work in all terminal emulators/tmux/etc. Try your own mapping
  -- or just use <C-\><C-n> to exit terminal mode
  vim.keymap.set('t', '<Esc><Esc>', '<C-\\><C-n>', { desc = 'Exit terminal mode' })

  -- TIP: Disable arrow keys in normal mode
  -- vim.keymap.set('n', '<left>', '<cmd>echo "Use h to move!!"<CR>')
  -- vim.keymap.set('n', '<right>', '<cmd>echo "Use l to move!!"<CR>')
  -- vim.keymap.set('n', '<up>', '<cmd>echo "Use k to move!!"<CR>')
  -- vim.keymap.set('n', '<down>', '<cmd>echo "Use j to move!!"<CR>')

  -- Keybinds to make split navigation easier.
  --  Use CTRL+<hjkl> to switch between windows
  --
  --  See `:help wincmd` for a list of all window commands
  vim.keymap.set('n', '<C-h>', '<C-w><C-h>', { desc = 'Move focus to the left window' })
  vim.keymap.set('n', '<C-l>', '<C-w><C-l>', { desc = 'Move focus to the right window' })
  vim.keymap.set('n', '<C-j>', '<C-w><C-j>', { desc = 'Move focus to the lower window' })
  vim.keymap.set('n', '<C-k>', '<C-w><C-k>', { desc = 'Move focus to the upper window' })

  -- [[ Basic Autocommands ]]
  --  See `:help lua-guide-autocommands`
end

-- [[ Install `lazy.nvim` plugin manager ]]
--    See `:help lazy.nvim.txt` or https://github.com/folke/lazy.nvim for more info
local lazypath = vim.fn.stdpath 'data' .. '/lazy/lazy.nvim'
if not vim.loop.fs_stat(lazypath) then
  local lazyrepo = 'https://github.com/folke/lazy.nvim.git'
  vim.fn.system { 'git', 'clone', '--filter=blob:none', '--branch=stable', lazyrepo, lazypath }
end ---@diagnostic disable-next-line: undefined-field
vim.opt.rtp:prepend(lazypath)

-- [[ Configure and install plugins ]]
--
--  To check the current status of your plugins, run
--    :Lazy
--
--  You can press `?` in this menu for help. Use `:q` to close the window
--
--  To update plugins you can run
--    :Lazy update
--
-- NOTE: Here is where you install your plugins.
require('lazy').setup({
  {
    import = 'custom.plugins_always',
    cond = true,
  },
  {
    import = 'custom.plugins_notvscode',
    cond = function()
      return not vim.g.vscode
    end,
  },
}, {
  ui = {
    -- If you are using a Nerd Font: set icons to an empty table which will use the
    -- default lazy.nvim defined Nerd Font icons, otherwise define a unicode icons table
    icons = vim.g.have_nerd_font and {} or {
      cmd = '⌘',
      config = '🛠',
      event = '📅',
      ft = '📂',
      init = '⚙',
      keys = '🗝',
      plugin = '🔌',
      runtime = '💻',
      require = '🌙',
      source = '📄',
      start = '🚀',
      task = '📌',
      lazy = '💤 ',
    },
  },
})

-- Load custom remaps
require 'custom.remap'
-- The line beneath this is called `modeline`. See `:help modeline`
-- vim: ts=2 sts=2 sw=2 et
