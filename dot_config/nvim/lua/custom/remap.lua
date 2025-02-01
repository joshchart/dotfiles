-- Move text up and down
vim.keymap.set('v', 'J', ":m '>+1<CR>gv=gv")
vim.keymap.set('v', 'K', ":m '<-2<CR>gv=gv")

-- Vmap for maintain Visual Mode after shifting > and <
vim.api.nvim_set_keymap('v', '<', '<gv', {})
vim.api.nvim_set_keymap('v', '>', '>gv', {})

-- Keeps search result in center of window
vim.keymap.set('n', 'n', 'nzzzv')
vim.keymap.set('n', 'N', 'Nzzzv')

-- Keeps cursor in center of window while nevigating by half page
vim.keymap.set('n', '<C-d>', '<C-d>zz')
vim.keymap.set('n', '<C-u>', '<C-u>zz')

-- Delete highlighted word into void register then paste original
vim.keymap.set('x', '<leader>p', [["_dP]], { desc = '[p]aste w/o vim clipboard' })

-- Copy to OS clipboard
vim.keymap.set({ 'n', 'v' }, '<leader>y', [["+y]], { desc = '[y]ank to OS clipboard' })
vim.keymap.set('n', '<leader>Y', [["+Y]], { desc = '[Y]ank line to OS clipboard' })

-- Delete and not store to vim clipboard
vim.keymap.set({ 'n', 'v' }, '<leader>d', [["_d]], { desc = '[d]elete w/o vim clipboard' })

vim.keymap.set('n', '<leader>r', [[:%s/\<<C-r><C-w>\>/<C-r><C-w>/gI<Left><Left><Left>]])
