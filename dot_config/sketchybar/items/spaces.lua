local colors = require("colors")
local icons = require("icons")
local settings = require("settings")
local app_icons = require("helpers.app_icons")

local LIST_ALL = "aerospace list-workspaces --all"
local LIST_CURRENT = "aerospace list-workspaces --focused"
local LIST_MONITORS = "aerospace list-monitors | awk '{print $1}'"
-- LIST_WORKSPACES is now constructed dynamically in drawSpaces
-- local LIST_WORKSPACES_BASE = "aerospace list-workspaces --monitor " -- Example if needed elsewhere
local LIST_APPS = "aerospace list-windows --workspace %s | awk -F'|' '{gsub(/^ *| *$/, \"\", $2); print $2}'"

local spaces = {}

local function getIconForApp(appName)
	return app_icons[appName] or "?"
end

-- Updates the icons for a given space based on its windows.
-- Returns true if apps were found, false otherwise.
local function updateSpaceIcons(spaceId, workspaceName, callback)
	local icon_strip = ""
	local apps_found = false

	sbar.exec(LIST_APPS:format(workspaceName), function(appsOutput)
		for app in appsOutput:gmatch("[^\r\n]+") do
			local appName = app:match("^%s*(.-)%s*$") -- Trim whitespace
			if appName and appName ~= "" then
				icon_strip = icon_strip .. " " .. getIconForApp(appName)
				apps_found = true
			end
		end

		-- If no apps found, use a placeholder or keep empty based on preference
		-- The shell script used " —", let's keep it empty for now.
		icon_strip = apps_found and icon_strip or " —"

		if spaces[spaceId] then
			spaces[spaceId].item:set({
				label = { string = icon_strip, drawing = apps_found },
			})
		else
			print("Warning: Space ID '" .. spaceId .. "' not found when updating icons.")
		end

		-- Execute the callback, passing whether apps were found
		if callback then
			callback(apps_found)
		end
	end)
end

-- Creates or updates a workspace item, handling visibility based on apps/focus.
local function updateOrCreateWorkspaceItem(workspaceName, monitorId, isFocused)
	local spaceId = "workspace_" .. workspaceName

	-- Check if the item needs to be created
	if not spaces[spaceId] then
		-- Create the space item using original aesthetics
		local space_item = sbar.add("item", spaceId, {
			icon = {
				font = { family = settings.font.numbers },
				string = workspaceName,
				padding_left = 15, -- Reverted
				padding_right = 8, -- Reverted
				color = colors.white, -- Reverted
				highlight_color = colors.red, -- Reverted
			},
			label = {
				padding_right = 20, -- Reverted
				color = colors.grey, -- Reverted (was grey before too)
				highlight_color = colors.white, -- Reverted
				font = "sketchybar-app-font:Regular:16.0", -- Reverted
				y_offset = -1,
				drawing = false, -- Keep logic: Initially hide label
			},
			padding_left = 1, -- Reverted
			padding_right = 1, -- Reverted
			background = {
				color = colors.bg1, -- Reverted
				border_width = 1,
				height = 26, -- Reverted
				border_color = colors.black, -- Reverted
				-- corner_radius removed
			},
			click_script = "aerospace workspace " .. workspaceName, -- Keep logic
			drawing = false, -- Keep logic: Initially hide item
		})

		-- Create the bracket using original aesthetics
		local space_bracket = sbar.add("bracket", { spaceId }, {
			background = {
				color = colors.transparent,
				border_color = colors.bg2, -- Reverted
				height = 28, -- Reverted
				border_width = 2, -- Reverted
				-- corner_radius removed
			},
			drawing = false, -- Keep logic: Initially hide bracket
		})

		space_item:subscribe("mouse.clicked", function()
			sbar.exec("aerospace workspace " .. workspaceName)
		end)

		spaces[spaceId] = { item = space_item, bracket = space_bracket }
		print("DEBUG: Created item and bracket for " .. spaceId)
	end

	-- Update common properties (highlighting, display)
	spaces[spaceId].item:set({
		icon = { highlight = isFocused },
		label = { highlight = isFocused },
		display = monitorId, -- Ensure it's on the correct monitor
	})
	spaces[spaceId].bracket:set({
		background = { border_color = isFocused and colors.dirty_white or colors.transparent },
		display = monitorId, -- Ensure bracket is also on the correct monitor
	})

	-- Update icons and determine visibility based on apps
	updateSpaceIcons(spaceId, workspaceName, function(apps_found)
		local should_draw = apps_found or isFocused
		print(
			"DEBUG: Space "
				.. spaceId
				.. " - Apps found: "
				.. tostring(apps_found)
				.. ", Is focused: "
				.. tostring(isFocused)
				.. ", Should draw: "
				.. tostring(should_draw)
		)
		spaces[spaceId].item:set({ drawing = should_draw })
		spaces[spaceId].bracket:set({ drawing = should_draw })
	end)
end

local function drawSpaces()
	print("DEBUG: drawSpaces() called")
	-- Get the focused workspace first
	sbar.exec(LIST_CURRENT, function(focusedWorkspaceOutput)
		local focusedWorkspace = focusedWorkspaceOutput:match("[^\r\n]+")
		print("DEBUG: Focused workspace: " .. (focusedWorkspace or "nil"))

		-- Then get all monitors
		sbar.exec(LIST_MONITORS, function(monitorsOutput)
			if not monitorsOutput or monitorsOutput == "" then
				print("ERROR: No monitors found.")
				return
			end
			print("DEBUG: Monitors found: " .. monitorsOutput:gsub("\n", ", "))

			-- Keep track of workspaces encountered to potentially hide old ones later (optional)
			-- local current_workspaces = {}

			-- Iterate through each monitor
			for monitorId in monitorsOutput:gmatch("[^\r\n]+") do
				print("DEBUG: Processing monitor ID: " .. monitorId)
				-- Get all workspaces for this monitor
				local list_monitor_workspaces_cmd = "aerospace list-workspaces --monitor " .. monitorId
				sbar.exec(list_monitor_workspaces_cmd, function(workspacesOutput)
					if not workspacesOutput or workspacesOutput == "" then
						print("DEBUG: No workspaces found for monitor " .. monitorId)
						return -- No workspaces on this monitor
					end
					print("DEBUG: Workspaces on monitor " .. monitorId .. ": " .. workspacesOutput:gsub("\n", ", "))

					for workspaceName in workspacesOutput:gmatch("[^\r\n]+") do
						local isFocused = (workspaceName == focusedWorkspace)
						-- table.insert(current_workspaces, "workspace_" .. workspaceName) -- Track
						print(
							"DEBUG: Updating/Creating workspace: "
								.. workspaceName
								.. " on monitor "
								.. monitorId
								.. ", Focused: "
								.. tostring(isFocused)
						)
						updateOrCreateWorkspaceItem(workspaceName, monitorId, isFocused)
					end
				end)
			end

			-- Optional: Hide items for workspaces that no longer exist
			-- for spaceId, spaceData in pairs(spaces) do
			--     local found = false
			--     for _, currentId in ipairs(current_workspaces) do
			--         if spaceId == currentId then
			--             found = true
			--             break
			--         end
			--     end
			--     if not found then
			--         print("DEBUG: Hiding potentially stale workspace item: " .. spaceId)
			--         spaceData.item:set({ drawing = false })
			--         spaceData.bracket:set({ drawing = false })
			--     end
			-- end
		end)
	end)
end

drawSpaces()

local space_window_observer = sbar.add("item", {
	drawing = false,
	updates = true,
})

space_window_observer:subscribe("aerospace_workspace_change", function(env)
	drawSpaces()
end)

space_window_observer:subscribe("front_app_switched", function()
	drawSpaces()
end)

space_window_observer:subscribe("space_windows_change", function()
	drawSpaces()
end)

--[[
-- Indicator for swapping menus and spaces
local spaces_indicator = sbar.add("item", {
    padding_left = -3,
    padding_right = 3,
    icon = {
        padding_left = 8,
        padding_right = 9,
        color = colors.grey,
        string = icons.switch.on,
    },
    label = {
        width = 0,
        padding_left = 0,
        padding_right = 8,
        string = "Spaces",
        color = colors.bg1,
    },
    background = {
        color = colors.with_alpha(colors.grey, 0.0),
        border_color = colors.with_alpha(colors.bg1, 0.0),
    }
})

spaces_indicator:subscribe("swap_menus_and_spaces", function(env)
    local currently_on = spaces_indicator:query().icon.value == icons.switch.on
    spaces_indicator:set({
        icon = currently_on and icons.switch.off or icons.switch.on
    })
end)

spaces_indicator:subscribe("mouse.entered", function(env)
    sbar.animate("tanh", 30, function()
        spaces_indicator:set({
            background = {
                color = { alpha = 1.0 },
                border_color = { alpha = 0.5 },
            },
            icon = { color = colors.bg1 },
            label = { width = "dynamic" }
        })
    end)
end)

spaces_indicator:subscribe("mouse.exited", function(env)
    sbar.animate("tanh", 30, function()
        spaces_indicator:set({
            background = {
                color = { alpha = 0.0 },
                border_color = { alpha = 0.0 },
            },
            icon = { color = colors.grey },
            label = { width = 0, }
        })
    end)
end)

spaces_indicator:subscribe("mouse.clicked", function(env)
    sbar.trigger("swap_menus_and_spaces")
end)
]]
--
