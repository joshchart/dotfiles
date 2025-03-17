return {
  -- NOTE: Plugins can also be configured to run Lua code when they are loaded.
  --
  -- This is often very useful to both group configuration, as well as handle
  -- lazy loading plugins that don't need to be loaded immediately at startup.
  --
  -- For example, in the following configuration, we use:
  --  event = 'VimEnter'
  --
  -- which loads which-key before all the UI elements are loaded. Events can be
  -- normal autocommands events (`:help autocmd-events`).
  --
  -- Then, because we use the `config` key, the configuration only runs
  -- after the plugin has been loaded:
  --  config = function() ... end

  {
    'folke/which-key.nvim',
    event = 'VimEnter',
    config = function()
      local wk = require 'which-key'
      wk.setup()

      -- Adding normal mode mappings
      wk.add {
        { '<leader>c', group = '[C]ode' }, -- Group for code-related keybinds
        { '<leader>d', group = '[D]ocument' }, -- Group for document-related keybinds
        { '<leader>r', group = '[R]ename' }, -- Group for rename-related keybinds
        { '<leader>s', group = '[S]earch' }, -- Group for search-related keybinds
        { '<leader>w', group = '[W]orkspace' }, -- Group for workspace-related keybinds
        { '<leader>t', group = '[T]oggle' }, -- Group for toggle-related keybinds
        { '<leader>h', group = 'Git [H]unk' }, -- Group for Git hunk-related keybinds
        { '<leader>c_', hidden = true }, -- Hidden keymap
        { '<leader>d_', hidden = true }, -- Hidden keymap
        { '<leader>r_', hidden = true }, -- Hidden keymap
        { '<leader>s_', hidden = true }, -- Hidden keymap
        { '<leader>w_', hidden = true }, -- Hidden keymap
        { '<leader>t_', hidden = true }, -- Hidden keymap
        { '<leader>h_', hidden = true }, -- Hidden keymap
      }

      -- Adding visual mode mappings
      wk.add {
        { '<leader>h', desc = 'Git [H]unk', mode = 'v' }, -- Visual mode mapping for Git Hunk
      }
    end,
  },
}
