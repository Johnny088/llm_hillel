$ErrorActionPreference = "Stop"

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string] $Name,

        [Parameter(Mandatory)]
        [scriptblock] $Command
    )

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$Name завершилася з кодом $LASTEXITCODE."
    }
}

Invoke-CheckedCommand -Name "corepack enable" -Command { corepack enable }
Invoke-CheckedCommand -Name "yarn --version" -Command { yarn --version }
Invoke-CheckedCommand -Name "yarn install --immutable" -Command { yarn install --immutable }
Invoke-CheckedCommand -Name "yarn check:solution" -Command { yarn check:solution }

Write-Host ""
Write-Host "Готово. Lockfile та solution пройшли перевірку."
