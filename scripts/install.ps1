<#
.SYNOPSIS
    Autonomous Spec-Driven Superpowers (ASDS) Global Installer for Windows
.DESCRIPTION
    Installs OpenSpec, ASDS operational skills, Superpowers toolset, and universal AGENTS.md rules.
#>

[CmdletBinding()]
param(
    [switch]$SkipNpmGlobal = $false
)

$ErrorActionPreference = "Stop"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Autonomous Spec-Driven Superpowers (ASDS) Installer   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$UserHome = [Environment]::GetFolderPath("UserProfile")
$GeminiConfig = Join-Path $UserHome ".gemini\config"
$SkillsTarget = Join-Path $GeminiConfig "skills"
$RulesTarget = Join-Path $GeminiConfig "rules"
$PluginsTarget = Join-Path $GeminiConfig "plugins"
$AgentsTarget = Join-Path $UserHome ".agents"

$RepoRoot = Split-Path -Parent $PSScriptRoot

# 1. Check Node.js & npm
Write-Host "[1/5] Checking Node.js environment..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not found in PATH. Please install Node.js (v18+) before continuing."
}
$nodeVersion = node --version
Write-Host "  -> Node.js detected: $nodeVersion" -ForegroundColor Green

# 2. OpenSpec Installation
Write-Host "[2/5] Ensuring OpenSpec CLI is installed..." -ForegroundColor Yellow
if (-not (Get-Command openspec -ErrorAction SilentlyContinue)) {
    if (-not $SkipNpmGlobal) {
        Write-Host "  -> Installing @fission-ai/openspec globally via npm..." -ForegroundColor Cyan
        npm install -g @fission-ai/openspec
    } else {
        Write-Warning "OpenSpec CLI not found and -SkipNpmGlobal was set."
    }
} else {
    $openspecVersion = openspec --version
    Write-Host "  -> OpenSpec detected: $openspecVersion" -ForegroundColor Green
}

# 3. Create Target Directories
Write-Host "[3/5] Setting up global agent directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $GeminiConfig | Out-Null
New-Item -ItemType Directory -Force -Path $SkillsTarget | Out-Null
New-Item -ItemType Directory -Force -Path $RulesTarget | Out-Null
New-Item -ItemType Directory -Force -Path $PluginsTarget | Out-Null

# Setup Junction ~/.agents <-> ~/.gemini/config if not present
if (-not (Test-Path $AgentsTarget)) {
    Write-Host "  -> Creating directory junction ~/.agents -> ~/.gemini/config..." -ForegroundColor Cyan
    cmd /c mklink /J "$AgentsTarget" "$GeminiConfig" | Out-Null
}

# 4. Copy Skills & Rules
Write-Host "[4/5] Deploying ASDS skills and universal rules..." -ForegroundColor Yellow

# Copy ASDS master skill
$masterSkillSource = Join-Path $RepoRoot "skills\spec-driven-superpowers"
$masterSkillDest = Join-Path $SkillsTarget "spec-driven-superpowers"
if (Test-Path $masterSkillSource) {
    Copy-Item -Path $masterSkillSource -Destination $masterSkillDest -Recurse -Force
    Write-Host "  -> Deployed master skill: spec-driven-superpowers" -ForegroundColor Green
}

# Copy OpenSpec skills
$openspecSkillsSource = Join-Path $RepoRoot "skills\openspec"
if (Test-Path $openspecSkillsSource) {
    Get-ChildItem -Path $openspecSkillsSource -Directory | ForEach-Object {
        $dest = Join-Path $SkillsTarget $_.Name
        Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
    }
    Write-Host "  -> Deployed OpenSpec skills collection" -ForegroundColor Green
}

# Copy Superpowers skills
$superpowersSkillsSource = Join-Path $RepoRoot "skills\superpowers"
if (Test-Path $superpowersSkillsSource) {
    Get-ChildItem -Path $superpowersSkillsSource -Directory | ForEach-Object {
        $dest = Join-Path $SkillsTarget $_.Name
        Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
    }
    Write-Host "  -> Deployed Superpowers skills collection" -ForegroundColor Green
}

# Deploy universal rules
$rulesSource = Join-Path $RepoRoot "rules\AGENTS.md"
$rulesDest = Join-Path $RulesTarget "AGENTS.md"
if (Test-Path $rulesSource) {
    Copy-Item -Path $rulesSource -Destination $rulesDest -Force
    Write-Host "  -> Deployed universal governance rule: rules/AGENTS.md" -ForegroundColor Green
}

# 5. Summary & Verification
Write-Host "[5/5] Verifying installation..." -ForegroundColor Yellow
$skillsCount = (Get-ChildItem -Path $SkillsTarget -Directory).Count
Write-Host "  -> Total global skills active: $skillsCount" -ForegroundColor Green
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  ASDS Installation Complete! Ready for Autonomous Work. " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
