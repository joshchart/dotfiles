local colors = require("colors")
local settings = require("settings")

local input_source = sbar.add("item", "widgets.input_source", {
  position = "right",
  icon = {
    font = {
      style = settings.font.style_map["Regular"],
      size = 20.0,
    },
    color = colors.white,
  },
  label = { drawing = false },
  update_freq = 1,
})

-- Background around the item
sbar.add("bracket", "widgets.input_source.bracket", { input_source.name }, {
  background = { color = colors.bg1 }
})

-- Add padding after the item
sbar.add("item", "widgets.input_source.padding", {
  position = "right",
  width = settings.group_paddings
})

input_source:subscribe("routine", function()
  sbar.exec("$CONFIG_DIR/helpers/input_source.sh", function(source)
    input_source:set({ icon = { string = source:gsub("\n", "") } })
  end)
end)

input_source:subscribe("mouse.clicked", function()
  sbar.exec("open 'System Preferences:Sound'")
end)
