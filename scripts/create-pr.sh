#!/bin/bash
# Bash script to create a branch, commit, and create a PR

# Configuration
BRANCH_NAME="fix/order-chart-error-handling"
COMMIT_MESSAGE="fix: add response validation to order chart data fetch

- Add res.ok check before parsing JSON in order chart data fetch
- Throw error if API returns error status
- Align error handling with pattern used in AddCategory, AddUser, and AddProduct components
- Prevents malformed data from being passed to AppBarChart component"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if there are uncommitted changes
echo -e "${CYAN}Checking for changes...${NC}"
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${RED}No changes to commit!${NC}"
    exit 1
fi

# Create and checkout new branch
echo -e "${CYAN}Creating and switching to branch: $BRANCH_NAME${NC}"
git checkout -b "$BRANCH_NAME"
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to create branch!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Branch created successfully${NC}"

# Stage the changes
echo -e "${CYAN}Staging changes...${NC}"
git add apps/admin/src/app/\(dashboard\)/page.tsx
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to stage changes!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Changes staged successfully${NC}"

# Commit the changes
echo -e "${CYAN}Committing changes...${NC}"
git commit -m "$COMMIT_MESSAGE"
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to commit changes!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Changes committed successfully${NC}"

# Push the branch to remote
echo -e "${CYAN}Pushing branch to remote...${NC}"
git push -u origin "$BRANCH_NAME"
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to push branch!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Branch pushed successfully${NC}"

# Create PR using GitHub CLI (if available)
echo -e "${CYAN}Creating Pull Request...${NC}"
if command -v gh &> /dev/null; then
    PR_TITLE="Fix: Add response validation to order chart data fetch"
    PR_BODY="## Description
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
- Verify that appropriate error is thrown when API returns error status"

    gh pr create --title "$PR_TITLE" --body "$PR_BODY" --base main
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Pull Request created successfully!${NC}"
    else
        echo -e "${RED}Failed to create PR with GitHub CLI${NC}"
        echo -e "${CYAN}You can create the PR manually at: https://github.com/YOUR_ORG/build-market/compare/$BRANCH_NAME${NC}"
    fi
else
    echo -e "${CYAN}GitHub CLI (gh) is not installed.${NC}"
    echo -e "${CYAN}You can create the PR manually at the following URL:${NC}"
    echo -e "${CYAN}https://github.com/YOUR_ORG/build-market/compare/$BRANCH_NAME${NC}"
    echo ""
    echo -e "${CYAN}Or install GitHub CLI: https://cli.github.com/${NC}"
fi

echo -e "${GREEN}\n✓ All done!${NC}"
echo -e "${CYAN}Branch: $BRANCH_NAME${NC}"

