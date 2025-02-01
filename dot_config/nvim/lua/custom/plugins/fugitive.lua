return {
  'tpope/vim-fugitive',
  config = function()
    vim.keymap.set('n', '<leader>gs', vim.cmd.Git, { desc = '[g]it [s]tatus' })
    vim.keymap.set('n', 'gf', '<cmd>diffget //2<CR>')
    vim.keymap.set('n', 'gj', '<cmd>diffget //3<CR>')
  end,
}
