param(
    [string]$WorkingDirectory = (Join-Path $PSScriptRoot ".."),
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [string]$CommandLine
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ConfirmPreference = "None"

if ([string]::IsNullOrWhiteSpace($CommandLine)) {
    throw "A command line is required. Example: .\\scripts\\invoke-clean.ps1 -WorkingDirectory . -CommandLine `"pnpm run redis:healthcheck`""
}

$resolvedWorkingDirectory = (Resolve-Path -Path $WorkingDirectory).Path
$stdoutPath = [System.IO.Path]::GetTempFileName()
$stderrPath = [System.IO.Path]::GetTempFileName()

$originalCi = $env:CI
$originalNpmConfigYes = $env:npm_config_yes
$originalNoColor = $env:NO_COLOR

try {
    $env:CI = "1"
    $env:npm_config_yes = "true"
    $env:NO_COLOR = "1"

    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/d", "/s", "/c", $CommandLine -WorkingDirectory $resolvedWorkingDirectory -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    $stdout = if (Test-Path $stdoutPath) { Get-Content -Path $stdoutPath -Raw } else { "" }
    $stderr = if (Test-Path $stderrPath) { Get-Content -Path $stderrPath -Raw } else { "" }
    $combinedOutput = ($stdout, $stderr | Where-Object { $_ -and $_.Trim().Length -gt 0 }) -join [Environment]::NewLine

    if ($OutputPath) {
        $resolvedOutputDirectory = Split-Path -Path $OutputPath -Parent
        if ($resolvedOutputDirectory) {
            New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null
        }
        Set-Content -Path $OutputPath -Value $combinedOutput
        Write-Host "Wrote output to $OutputPath"
    }

    if ($combinedOutput) {
        Write-Host $combinedOutput
    }

    exit $process.ExitCode
}
finally {
    if ($null -eq $originalCi) {
        Remove-Item Env:CI -ErrorAction SilentlyContinue
    }
    else {
        $env:CI = $originalCi
    }

    if ($null -eq $originalNpmConfigYes) {
        Remove-Item Env:npm_config_yes -ErrorAction SilentlyContinue
    }
    else {
        $env:npm_config_yes = $originalNpmConfigYes
    }

    if ($null -eq $originalNoColor) {
        Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
    }
    else {
        $env:NO_COLOR = $originalNoColor
    }

    Remove-Item -Path $stdoutPath, $stderrPath -ErrorAction SilentlyContinue
}