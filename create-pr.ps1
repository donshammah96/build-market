# PowerShell script to create a branch, commit, and create a PR

# Configuration
$BRANCH_NAME = "fix/order-chart-error-handling"
$COMMIT_MESSAGE = "fix: add response validation to order chart data fetch

- Add res.ok check before parsing JSON in order chart data fetch
- Throw error if API returns error status
- Align error handling with pattern used in AddCategory, AddUser, and AddProduct components
- Prevents malformed data from being passed to AppBarChart component"

# Colors for output
function Write-Success { param($message) Write-Host $message -ForegroundColor Green }
function Write-Info { param($message) Write-Host $message -ForegroundColor Cyan }
function Write-Error { param($message) Write-Host $message -ForegroundColor Red }

# Check if there are uncommitted changes
Write-Info "Checking for changes..."
$status = git status --porcelain
if (-not $status) {
    Write-Error "No changes to commit!"
    exit 1
}

# Create and checkout new branch
Write-Info "Creating and switching to branch: $BRANCH_NAME"
git checkout -b $BRANCH_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create branch!"
    exit 1
}
Write-Success "✓ Branch created successfully"

# Stage the changes
Write-Info "Staging changes..."
git add apps/admin/src/app/(dashboard)/page.tsx
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to stage changes!"
    exit 1
}
Write-Success "✓ Changes staged successfully"

# Commit the changes
Write-Info "Committing changes..."
git commit -m $COMMIT_MESSAGE
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to commit changes!"
    exit 1
}
Write-Success "✓ Changes committed successfully"

# Push the branch to remote
Write-Info "Pushing branch to remote..."
git push -u origin $BRANCH_NAME
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to push branch!"
    exit 1
}
Write-Success "✓ Branch pushed successfully"

# Create PR using GitHub CLI (if available)
Write-Info "Creating Pull Request..."
$ghCliAvailable = Get-Command gh -ErrorAction SilentlyContinue
if ($ghCliAvailable) {
    $PR_TITLE = "Fix: Add response validation to order chart data fetch"
    $PR_BODY = @"
## Description
This PR fixes a bug where the order chart data fetch call doesn't validate the response before parsing JSON.

## Changes
- Added \`res.ok\` check before calling \`res.json()\` in the order chart data fetch
- Throw appropriate error if API returns an error status
- Aligned error handling with the pattern used in other components (AddCategory, AddUser, AddProduct)

## Problem
When the API returns an error status, the code was attempting to parse the error response as JSON and passing it to \`AppBarChart\`, causing the component to receive malformed data instead of the expected \`OrderChartType[]\` array.

## Solution
Added response validation to ensure only successful responses are parsed and passed to the component. This prevents unexpected data from breaking the chart component.

## Testing
- Verify that order chart loads correctly when API returns successful response
- Verify that appropriate error is thrown when API returns error status
"@

    gh pr create --title $PR_TITLE --body $PR_BODY --base main
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ Pull Request created successfully!"
    } else {
        Write-Error "Failed to create PR with GitHub CLI"
        Write-Info "You can create the PR manually at: https://github.com/YOUR_ORG/build-market/compare/$BRANCH_NAME"
    }
} else {
    Write-Info "GitHub CLI (gh) is not installed."
    Write-Info "You can create the PR manually at the following URL:"
    Write-Info "https://github.com/YOUR_ORG/build-market/compare/$BRANCH_NAME"
    Write-Info ""
    Write-Info "Or install GitHub CLI: https://cli.github.com/"
}

Write-Success "`n✓ All done!"
Write-Info "Branch: $BRANCH_NAME"

