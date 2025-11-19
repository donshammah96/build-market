# Scripts

This directory contains utility scripts for development and deployment workflows.

## Available Scripts

### create-pr.ps1 (PowerShell)
PowerShell script for creating a feature branch, committing changes, and creating a pull request.

**Usage (Windows PowerShell):**
```powershell
.\scripts\create-pr.ps1
```

### create-pr.sh (Bash)
Bash script for creating a feature branch, committing changes, and creating a pull request.

**Usage (Linux/Mac/Git Bash):**
```bash
chmod +x scripts/create-pr.sh
./scripts/create-pr.sh
```

## Features

Both scripts automate the following workflow:
- ✅ Create a new feature branch from current branch
- ✅ Stage and commit changes with conventional commit message
- ✅ Push the branch to remote
- ✅ Create a Pull Request (if GitHub CLI is installed)
- ✅ Provide fallback instructions if GitHub CLI is not available

## Requirements

- Git installed and configured
- GitHub CLI (`gh`) - Optional, but recommended for automatic PR creation
  - Install from: https://cli.github.com/

## Notes

- The scripts include proper error handling at each step
- Colored output for better visibility
- Automatically generates descriptive PR descriptions

