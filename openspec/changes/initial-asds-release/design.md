# Technical Design: ASDS Framework

## Architecture Overview
The repository provides:
1. **Operational Skills**: The `spec-driven-superpowers` skill and bundled OpenSpec + Superpowers skills.
2. **Global Rules**: `AGENTS.md` directive for automatic discovery in `~/.gemini/config/rules/` and `plugins/`.
3. **OpenSpec Schema (`superpowers-bridge`)**: Custom schema with templates enforcing Master-Detail task decomposition and Evidence Ledgers.
4. **Installer Scripts**: Shell and PowerShell automation deploying skills and junctions to `~/.gemini/` and `~/.agents/`.
5. **Continuous Integration**: GitHub Actions workflow validating skills and OpenSpec schema consistency.
