#!/bin/bash

ZIP_FILE="mockzilla.zip"
TEMP_DIR="dist_temp"

echo -e "\e[36mBuilding injected.bundle.js...\e[0m"
npm run build
if [ $? -ne 0 ]; then
    echo -e "\e[31mBuild failed! Aborting zip.\e[0m"
    exit 1
fi

echo -e "\e[36mPreparing files for zipping...\e[0m"

# Define files and folders to include in the bundle
FILES_TO_INCLUDE=(
    "manifest.json"
    "background.js"
    "content-script.js"
    "injected.bundle.js"
    "popup.html"
    "popup.js"
    "options.html"
    "tailwind-v4.js"
    "assets"
    "src"
)

# Clean up old artifacts
rm -f "$ZIP_FILE"
rm -rf "$TEMP_DIR"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Copy items to temporary directory
for item in "${FILES_TO_INCLUDE[@]}"; do
    if [ -e "$item" ]; then
        cp -r "$item" "$TEMP_DIR/"
    else
        echo -e "\e[33mWarning: Required file or folder not found: $item\e[0m"
    fi
done

# Create the zip archive
echo -e "\e[36mCompressing archive to $ZIP_FILE...\e[0m"
cd "$TEMP_DIR" || exit 1
zip -r "../$ZIP_FILE" ./* > /dev/null
cd ..

# Final cleanup
rm -rf "$TEMP_DIR"

echo -e "\e[32mSuccess! Extension packaged and ready in $ZIP_FILE\e[0m"
