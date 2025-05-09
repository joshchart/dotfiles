#!/bin/bash

# Get the current input source
INPUT_SOURCE=$(defaults read ~/Library/Preferences/com.apple.HIToolbox.plist AppleSelectedInputSources | grep "KeyboardLayout Name" | sed -E 's/.*"KeyboardLayout Name" = "([^"]+).*/\1/')

# If nothing found, try to get the input source name
if [ -z "$INPUT_SOURCE" ]; then
  INPUT_SOURCE=$(defaults read ~/Library/Preferences/com.apple.HIToolbox.plist AppleSelectedInputSources | grep "InputSourceID" | sed -E 's/.*"InputSourceID" = "([^"]+).*/\1/' | sed -E 's/.*://g')
fi

# If still nothing found, try to get the input method name
if [ -z "$INPUT_SOURCE" ]; then
  INPUT_SOURCE=$(defaults read ~/Library/Preferences/com.apple.HIToolbox.plist AppleSelectedInputSources | grep "InputMethodName" | sed -E 's/.*"InputMethodName" = "([^"]+).*/\1/' | sed -E 's/.*://g')
fi

# If still nothing found, try to get the bundle ID
if [ -z "$INPUT_SOURCE" ]; then
  INPUT_SOURCE=$(defaults read ~/Library/Preferences/com.apple.HIToolbox.plist AppleSelectedInputSources | grep "Bundle ID" | sed -E 's/.*"Bundle ID" = "([^"]+).*/\1/' | sed -E 's/.*://g')
fi

# Default icon if all else fails
if [ -z "$INPUT_SOURCE" ]; then
  echo "⌨️"
  exit 0
fi

# Map common input sources to nicer labels/emojis
case "$INPUT_SOURCE" in 
  "ABC")
    echo "🇺🇸"
    ;;
  "US")
    echo "🇺🇸"
    ;;
  "USInternational-PC")
    echo "🇺🇸🌐"
    ;;
  "Spanish")
    echo "🇪🇸"
    ;;
  "French")
    echo "🇫🇷"
    ;;
  "German")
    echo "🇩🇪"
    ;;
  "Russian")
    echo "🇷🇺"
    ;;
  "Japanese")
    echo "🇯🇵"
    ;;
  "Korean")
    echo "🇰🇷"
    ;;
  "Chinese")
    echo "🇨🇳"
    ;;
  *)
    # Fall back to the input source name if no mapping exists
    echo "$INPUT_SOURCE"
    ;;
esac
