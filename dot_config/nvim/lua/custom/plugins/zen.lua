-- ZenMode: keeps buffer in the middle of the screen
return {
  {
    'folke/zen-mode.nvim',
    opts = {
      plugins = {
        options = {
          laststatus = 3, -- 0 to Hide the status line in Zen Mode
        },
      },
    },
    config = function(_, opts)
      require('zen-mode').setup(opts)
      vim.keymap.set('n', '<leader>zz', '<cmd>ZenMode<CR>', { desc = 'Toggle Zen Mode' })
    end,
  },
}
