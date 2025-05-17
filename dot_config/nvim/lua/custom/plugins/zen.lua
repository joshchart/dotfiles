-- ZenMode: keeps buffer in the middle of the screen
return {
  {
    'folke/zen-mode.nvim',
    opts = {
      plugins = {
        options = {
          laststatus = 3, -- 0 to Hide the status line in Zen Mode
        },
        todo = { enabled = false }, -- if set to "true", todo-comments.nvim highlights will be disabled
        gitsigns = { enabled = false }, -- disables git signs
      },
    },
    config = function(_, opts)
      require('zen-mode').setup(opts)
      vim.keymap.set('n', '<leader>zz', '<cmd>ZenMode<CR>', { desc = 'Toggle Zen Mode' })
    end,
  },
}
