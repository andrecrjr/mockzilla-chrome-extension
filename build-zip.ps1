# Build and Zip script for Mockzilla Extension

$ZipFile = "mockzilla.zip"
$TempDir = "dist_temp"

Write-Host "Building injected.bundle.js..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Aborting zip." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Preparing files for zipping..." -ForegroundColor Cyan

# Define files and folders to include in the bundle
$FilesToInclude = @(
    "manifest.json",
    "background.js",
    "content-script.js",
    "injected.bundle.js",
    "popup.html",
    "popup.js",
    "options.html",
    "tailwind-v4.js",
    "assets",
    "src"
)

# Clean up old artifacts
if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }
if (Test-Path $TempDir) { Remove-Item -Recurse -Force $TempDir }

# Create temporary directory
New-Item -ItemType Directory -Path $TempDir | Out-Null

# Copy items to temporary directory
foreach ($Item in $FilesToInclude) {
    if (Test-Path $Item) {
        # Using Recurse for folders
        Copy-Item -Path $Item -Destination $TempDir -Recurse
    } else {
        Write-Warning "Warning: Required file or folder not found: $Item"
    }
}

# Create the zip archive
Write-Host "Compressing archive to $ZipFile..." -ForegroundColor Cyan
Compress-Archive -Path "$TempDir\*" -DestinationPath $ZipFile -Force

# Final cleanup
Remove-Item -Recurse -Force $TempDir

Write-Host "Success! Extension packaged and ready in $ZipFile" -ForegroundColor Green
