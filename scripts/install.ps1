# Forward explicit arguments; propagate native Node failures to callers and CI.
$ErrorActionPreference = "Stop"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js >=20.19.0 is required."
}
& node (Join-Path $PSScriptRoot "install.mjs") @args
exit $LASTEXITCODE
