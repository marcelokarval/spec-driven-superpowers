#!/usr/bin/env bash
# Autonomous Spec-Driven Superpowers (ASDS) Global Installer for Linux & macOS
set -e

echo -e "\033[1;36m========================================================\033[0m"
echo -e "\033[1;36m  Autonomous Spec-Driven Superpowers (ASDS) Installer   \033[0m"
echo -e "\033[1;36m========================================================\033[0m"
echo ""

USER_HOME="$HOME"
GEMINI_CONFIG="$USER_HOME/.gemini/config"
SKILLS_TARGET="$GEMINI_CONFIG/skills"
RULES_TARGET="$GEMINI_CONFIG/rules"
PLUGINS_TARGET="$GEMINI_CONFIG/plugins"
AGENTS_TARGET="$USER_HOME/.agents"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# 1. Check Node.js & npm
echo -e "\033[1;33m[1/5] Checking Node.js environment...\033[0m"
if ! command -v node >/dev/null 2>&1; then
    echo -e "\033[1;31mError: Node.js is not found in PATH. Please install Node.js (v18+) before continuing.\033[0m"
    exit 1
fi
echo -e "  -> Node.js detected: $(node --version)"

# 2. OpenSpec Installation
echo -e "\033[1;33m[2/5] Ensuring OpenSpec CLI is installed...\033[0m"
if ! command -v openspec >/dev/null 2>&1; then
    echo -e "  -> Installing @fission-ai/openspec globally via npm..."
    npm install -g @fission-ai/openspec
else
    echo -e "  -> OpenSpec detected: $(openspec --version)"
fi

# 3. Create Target Directories
echo -e "\033[1;33m[3/5] Setting up global agent directories...\033[0m"
mkdir -p "$GEMINI_CONFIG" "$SKILLS_TARGET" "$RULES_TARGET" "$PLUGINS_TARGET"

# Setup symlink ~/.agents -> ~/.gemini/config if not present
if [ ! -e "$AGENTS_TARGET" ]; then
    echo -e "  -> Creating symlink ~/.agents -> ~/.gemini/config..."
    ln -s "$GEMINI_CONFIG" "$AGENTS_TARGET"
fi

# 4. Copy Skills & Rules
echo -e "\033[1;33m[4/5] Deploying ASDS skills and universal rules...\033[0m"

# Copy ASDS master skill
if [ -d "$REPO_ROOT/skills/spec-driven-superpowers" ]; then
    cp -r "$REPO_ROOT/skills/spec-driven-superpowers" "$SKILLS_TARGET/"
    echo -e "  -> Deployed master skill: spec-driven-superpowers"
fi

# Copy OpenSpec skills
if [ -d "$REPO_ROOT/skills/openspec" ]; then
    for skill in "$REPO_ROOT/skills/openspec"/*; do
        if [ -d "$skill" ]; then
            cp -r "$skill" "$SKILLS_TARGET/"
        fi
    done
    echo -e "  -> Deployed OpenSpec skills collection"
fi

# Copy Superpowers skills
if [ -d "$REPO_ROOT/skills/superpowers" ]; then
    for skill in "$REPO_ROOT/skills/superpowers"/*; do
        if [ -d "$skill" ]; then
            cp -r "$skill" "$SKILLS_TARGET/"
        fi
    done
    echo -e "  -> Deployed Superpowers skills collection"
fi

# Deploy universal rules
if [ -f "$REPO_ROOT/rules/AGENTS.md" ]; then
    cp "$REPO_ROOT/rules/AGENTS.md" "$RULES_TARGET/AGENTS.md"
    echo -e "  -> Deployed universal governance rule: rules/AGENTS.md"
fi

# 5. Summary & Verification
echo -e "\033[1;33m[5/5] Verifying installation...\033[0m"
skills_count=$(find "$SKILLS_TARGET" -mindepth 1 -maxdepth 1 -type d | wc -l)
echo -e "  -> Total global skills active: $skills_count"
echo ""
echo -e "\033[1;32m========================================================\033[0m"
echo -e "\033[1;32m  ASDS Installation Complete! Ready for Autonomous Work. \033[0m"
echo -e "\033[1;32m========================================================\033[0m"
echo ""
