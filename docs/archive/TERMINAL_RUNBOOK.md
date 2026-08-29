# Terminal Runbook

This runbook defines the repo standard for terminal execution. The goal is deterministic commands, reproducible output, and minimal exposure to shared-shell state.

## Core Rules

1. Treat the shared foreground terminal as disposable after any interrupted command, blocked prompt, malformed inline command, or unexpected directory change.
2. Do not use `cd ...; <command>` in repeatable workflows. Use fixed-directory invocation such as `pnpm -C apps/admin run check-types`.
3. Do not use non-trivial `node -e` or `tsx -e` commands in PowerShell. If the command needs nested quotes, objects, JSON, or branching, move it into a checked-in script.
4. Do not run multiple foreground commands in parallel. Use separate background processes or VS Code tasks instead.
5. Prefer root package scripts and workspace tasks for recurring commands. They are the supported entry points for validation and diagnostics.
6. Capture high-value output to a file when log fidelity matters. Terminal transcript rendering can wrap or truncate output.
7. Make commands non-interactive by default. Commands that can prompt must be invoked with force flags or through wrappers that set CI-style defaults.

## Failure Modes This Prevents

- Shared-shell contamination after `Terminate batch job (Y/N)?`
- Working-directory drift across commands
- Broken PowerShell parsing from nested quotes or object literals
- Mixed or wrapped output that looks corrupt in terminal capture
- Duplicate or conflicting task definitions that run the same workflow in different ways

## Approved Command Patterns

Use root scripts for recurring workflows:

```powershell
pnpm run admin:check-types
pnpm run client:tsc-noemit
pnpm run queue-server:check-types
pnpm run redis:healthcheck
pnpm run redis:audit
pnpm run client:test:browser-hook-sweep
pnpm run client:test:dashboard-hook
```

Use tasks when you want a stable editor entry point:

- `admin-check-types`
- `queue-server-check-types`
- `redis-healthcheck`
- `redis-audit`
- `client-browser-hook-sweep-tests`
- `client-dashboard-hook-tests`

## PowerShell Wrapper Pattern

Use [scripts/invoke-clean.ps1](../scripts/invoke-clean.ps1) when you need a clean process boundary or durable output capture.

```powershell
.\scripts\invoke-clean.ps1 -WorkingDirectory . -CommandLine "pnpm run redis:healthcheck"
.\scripts\invoke-clean.ps1 -WorkingDirectory . -OutputPath .\tmp\redis-audit.log -CommandLine "pnpm run redis:audit"
```

What the wrapper does:

- Runs the command in a fresh child process
- Fixes the working directory explicitly
- Sets `CI=1` and `npm_config_yes=true`
- Optionally writes combined stdout and stderr to a log file

## Staff-Level Guidance

- Standardize once at the repo root, then consume everywhere else.
- Remove duplicate task variants rather than keeping "working" and "clean" copies.
- Keep shell logic shallow. Business logic and data inspection belong in checked-in scripts, not inline terminal commands.
- If a command fails after an interrupted foreground session, rerun it through the wrapper or a workspace task before treating it as a real code failure.

## Change Checklist

When adding a new recurring workflow:

1. Add a root `package.json` script that uses `pnpm -C ...` or another fixed-directory form.
2. Add a single VS Code task that calls that root script.
3. If output fidelity matters, document the `invoke-clean.ps1` wrapper form.
4. Do not add a second variant that relies on `Set-Location`, inline JavaScript, or shell-specific quoting tricks.
