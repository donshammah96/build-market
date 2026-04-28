<#
.SYNOPSIS
    Clear users from Clerk and database.

.DESCRIPTION
    PowerShell wrapper for the clear-users.ts script.
    Deletes users from both Clerk and the database for development/testing.

.PARAMETER Role
    Filter by role: client, professional, or all (default: all)

.PARAMETER DryRun
    Show what would be deleted without actually deleting

.PARAMETER Confirm
    Skip confirmation prompt

.EXAMPLE
    .\scripts\clear-users.ps1 -Role client -DryRun
    Show what client users would be deleted

.EXAMPLE
    .\scripts\clear-users.ps1 -Role all -Confirm
    Delete all clients and professionals without prompting
#>

param(
    [ValidateSet("client", "professional", "all")]
    [string]$Role = "all",
    
    [switch]$DryRun,
    
    [switch]$Confirm
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$scriptPath = Join-Path $projectRoot "scripts\clear-users.ts"

# Build arguments
$args = @()
$args += "--role"
$args += $Role

if ($DryRun) {
    $args += "--dry-run"
}

if ($Confirm) {
    $args += "--confirm"
}

Write-Host ""
Write-Host "Running clear-users script..." -ForegroundColor Cyan
Write-Host "Arguments: $($args -join ' ')" -ForegroundColor Gray
Write-Host ""

# Run the TypeScript script
& pnpm -C $projectRoot exec tsx $scriptPath @args
