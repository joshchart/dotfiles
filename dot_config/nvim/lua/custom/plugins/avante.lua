return {
  {
    'yetone/avante.nvim',
    event = 'VeryLazy',
    version = false, -- Never set this value to "*"! Never!
    -- Multiple Copilot: https://github.com/yetone/avante.nvim/issues/1566
    opts = {
      provider = 'copilot',
      -- auto_suggestions_provider = "copilot",
      copilot = {
        endpoint = 'https://api.githubcopilot.com',
        model = 'gemini-2.5-pro',
      },
      openai = {
        hide_in_model_selector = true,
      },
      claude = {
        hide_in_model_selector = true,
      },
      aihubmix = {
        hide_in_model_selector = true,
      },
      ['aihubmix-claude'] = {
        hide_in_model_selector = true,
      },
      gemini = {
        hide_in_model_selector = true,
      },
      vertex = {
        hide_in_model_selector = true,
      },
      vertex_claude = {
        hide_in_model_selector = true,
      },
      cohere = {
        hide_in_model_selector = true,
      },
      bedrock = {
        hide_in_model_selector = true,
      },
      ['bedrock-claude-3.7-sonnet'] = {
        hide_in_model_selector = true,
      },
      ['claude-haiku'] = {
        hide_in_model_selector = true,
      },
      ['claude-opus'] = {
        hide_in_model_selector = true,
      },
      ['openai-gpt-4o-mini'] = {
        hide_in_model_selector = true,
      },
      vendors = {
        copilot_claude_3_7 = {
          __inherited_from = 'copilot',
          model = 'claude-3.7-sonnet',
        },
        copilot_claude_3_7_thinking = {
          __inherited_from = 'copilot',
          model = 'claude-3.7-sonnet-thought',
        },
        copilot_gemini_2_0_flash = {
          __inherited_from = 'copilot',
          model = 'gemini-2.0-flash-001',
        },
        copilot_gemini_2_5_pro = {
          __inherited_from = 'copilot',
          model = 'gemini-2.5-pro',
        },
        copilot_openai_o4_mini_high = {
          __inherited_from = 'copilot',
          model = 'o4-mini-high',
        },
        copilot_openai_4_1 = {
          __inherited_from = 'copilot',
          model = 'gpt-4.1',
        },
      }, -- if you want to build from source then do `make BUILD_FROM_SOURCE=true`
    },
    build = 'make',
    -- build = "powershell -ExecutionPolicy Bypass -File Build.ps1 -BuildFromSource false" -- for windows
    dependencies = {
      'nvim-treesitter/nvim-treesitter',
      'stevearc/dressing.nvim',
      'nvim-lua/plenary.nvim',
      'MunifTanjim/nui.nvim',
      --- The below dependencies are optional,
      'echasnovski/mini.pick', -- for file_selector provider mini.pick
      'nvim-telescope/telescope.nvim', -- for file_selector provider telescope
      'hrsh7th/nvim-cmp', -- autocompletion for avante commands and mentions
      'ibhagwan/fzf-lua', -- for file_selector provider fzf
      'nvim-tree/nvim-web-devicons', -- or echasnovski/mini.icons
      'zbirenbaum/copilot.lua', -- for providers='copilot'
      {
        -- support for image pasting
        'HakonHarnes/img-clip.nvim',
        event = 'VeryLazy',
        opts = {
          -- recommended settings
          default = {
            embed_image_as_base64 = false,
            prompt_for_file_name = false,
            drag_and_drop = {
              insert_mode = true,
            },
            -- required for Windows users
            use_absolute_path = true,
          },
        },
      },
      {
        -- Make sure to set this up properly if you have lazy=true
        'MeanderingProgrammer/render-markdown.nvim',
        opts = {
          file_types = { 'markdown', 'Avante' },
        },
        ft = { 'markdown', 'Avante' },
      },
    },
  },
}

-- Key Binding	Description
-- Leaderaa	show sidebar
-- Leaderat	toggle sidebar visibility
-- Leaderar	refresh sidebar
-- Leaderaf	switch sidebar focus
-- Leadera?	select model
-- Leaderae	edit selected blocks
-- LeaderaS	stop current AI request
-- co	choose ours
-- ct	choose theirs
-- ca	choose all theirs
-- c0	choose none
-- cb	choose both
-- cc	choose cursor
-- ]x	move to previous conflict
-- [x	move to next conflict
-- [[	jump to previous codeblocks (results window)
-- ]]	jump to next codeblocks (results windows)
