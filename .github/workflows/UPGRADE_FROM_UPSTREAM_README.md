# Langfuse Upstream Upgrade Workflow - Complete Guide

This document explains all scenarios handled by the automated upstream upgrade workflows and the exact actions required for each.

## 📚 Table of Contents

1. [Overview](#overview)
2. [Prerequisites & Setup](#prerequisites--setup)
3. [Workflows](#workflows)
4. [Scenarios](#scenarios)
   - [Scenario 1: Clean Merge + Auto-Merge Enabled](#scenario-1-clean-merge--auto-merge-enabled)
   - [Scenario 2: Clean Merge + Manual Review](#scenario-2-clean-merge--manual-review)
   - [Scenario 3: Merge Conflicts + Auto-Merge Intended](#scenario-3-merge-conflicts--auto-merge-intended)
   - [Scenario 4: Merge Conflicts + Manual Review](#scenario-4-merge-conflicts--manual-review)
   - [Scenario 5: No Changes (Already Up-to-Date)](#scenario-5-no-changes-already-up-to-date)
   - [Scenario 6: Branch Already Exists](#scenario-6-branch-already-exists)
   - [Scenario 7: Invalid Branch Name Format](#scenario-7-invalid-branch-name-format)
   - [Scenario 8: Workflow Failures](#scenario-8-workflow-failures)
5. [Configuration Reference](#configuration-reference)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The upgrade system consists of two complementary workflows:

1. **Main Upgrade Workflow** (`upgrade-from-upstream.yml`)
   - Fetches upstream changes
   - Creates upgrade branch
   - Merges upstream tag
   - Creates PR (if no conflicts)
   - Pushes branch even with conflicts

2. **PR Automation Workflow** (`upgrade-pr-automation.yml`)
   - Monitors all PRs from upgrade branches
   - Handles auto-approval and auto-merge
   - Triggers build workflows
   - Works for both automatically-created and manually-created PRs

---

## Prerequisites & Setup

### Required Secrets

| Secret | Purpose | Required When | Scopes Needed |
|--------|---------|---------------|---------------|
| `GITHUB_TOKEN` | Default token | Always (automatic) | Provided by GitHub Actions |
| `LANGFUSE_PR_PAT` | Personal Access Token | Auto-merge enabled | `repo`, `workflow` |
| `DOCKER_USERNAME` | Docker Hub username | Build workflow | - |
| `DOCKER_PASSWORD` | Docker Hub token | Build workflow | - |

### Setting up LANGFUSE_PR_PAT

1. Create Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with scopes: `repo`, `workflow`

2. Add to repository secrets:
   - Repository Settings → Secrets and variables → Actions
   - New repository secret: `LANGFUSE_PR_PAT`

### Upstream Repository

The workflows automatically sync from:
```
https://github.com/langfuse/langfuse.git
```

---

## Workflows

### Main Upgrade Workflow

**File:** `.github/workflows/upgrade-from-upstream.yml`

**Triggers:**
- Manual: `workflow_dispatch` with inputs
- Cross-repo: `repository_dispatch` event

**Inputs:**
- `git_tag` (required): Upstream git tag (e.g., `v2.75.2`)
- `auto_merge` (optional): Enable auto-merge (default: `false`)

### PR Automation Workflow

**File:** `.github/workflows/upgrade-pr-automation.yml`

**Triggers:**
- Pull request opened/reopened/synchronized
- Only for branches matching: `weekly-upgrade-langfuse-*`

**Automatic Detection:**
- Git tag from branch name
- Auto-merge setting from PR body

---

## Scenarios

### Scenario 1: Clean Merge + Auto-Merge Enabled

**When:** Upstream changes merge cleanly and auto-merge is enabled.

**Flow:**

```
Main Workflow
    ↓
1. Fetch upstream tag
    ↓
2. Create branch: weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
    ↓
3. Merge upstream tag → ✅ No conflicts
    ↓
4. Push branch to remote
    ↓
5. Check for changes → ✅ Changes detected
    ↓
6. Create PR with auto-merge marker
    ↓
PR Automation Workflow (auto-triggered)
    ↓
7. Extract tag from branch name → v2.75.2
    ↓
8. Check PR body → auto-merge: true
    ↓
9. Wait 30 seconds for checks
    ↓
10. Auto-approve PR
    ↓
11. Auto-merge PR
    ↓
12. Trigger build workflow with tag v2.75.2
    ↓
✅ COMPLETE - Fully automated
```

**User Actions Required:** ❌ **NONE**

**Command to Trigger:**
```bash
gh workflow run upgrade-from-upstream.yml \
  -f git_tag=v2.75.2 \
  -f auto_merge=true
```

**Expected Outcome:**
- ✅ Branch created and pushed
- ✅ PR created automatically
- ✅ PR approved automatically
- ✅ PR merged automatically
- ✅ Build workflow triggered automatically
- ⏱️ Total time: ~2-3 minutes

**Workflow Summary Shows:**
```
Status: ✅ Success - PR Created
PR: https://github.com/your-org/langfuse/pull/123
🤖 PR Automation: Auto-merge is enabled
The PR Automation workflow will handle approval, merge, and build trigger automatically.
```

---

### Scenario 2: Clean Merge + Manual Review

**When:** Upstream changes merge cleanly but manual review is desired.

**Flow:**

```
Main Workflow
    ↓
1. Fetch upstream tag
    ↓
2. Create branch: weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
    ↓
3. Merge upstream tag → ✅ No conflicts
    ↓
4. Push branch to remote
    ↓
5. Check for changes → ✅ Changes detected
    ↓
6. Create PR (without auto-merge marker)
    ↓
PR Automation Workflow (auto-triggered)
    ↓
7. Extract tag from branch name → v2.75.2
    ↓
8. Check PR body → auto-merge: false
    ↓
9. Add comment explaining manual review required
    ↓
⏸️ WAITING - Manual review needed
```

**User Actions Required:** ✅ **MANUAL**

**Command to Trigger:**
```bash
gh workflow run upgrade-from-upstream.yml \
  -f git_tag=v2.75.2 \
  -f auto_merge=false
```

**User Must:**

1. **Review the PR:**
   - Check the changes in the PR
   - Verify no breaking changes
   - Review test results (if any)

2. **Approve the PR:**
   ```bash
   gh pr review <PR-NUMBER> --approve
   ```

3. **Merge the PR:**
   ```bash
   gh pr merge <PR-NUMBER> --squash --admin
   ```

4. **Trigger Build Workflow:**
   ```bash
   gh workflow run build-push-neubirdai.yml -f git_tag=v2.75.2
   ```

**Expected Outcome:**
- ✅ Branch created and pushed
- ✅ PR created automatically
- 👤 Manual review and approval
- 👤 Manual merge
- 👤 Manual build trigger

**Workflow Summary Shows:**
```
Status: ✅ Success - PR Created
PR: https://github.com/your-org/langfuse/pull/123
👀 Manual Review Required
Review and merge the PR manually. After merge, trigger build workflow:
gh workflow run build-push-neubirdai.yml -f git_tag="v2.75.2"
```

---

### Scenario 3: Merge Conflicts + Auto-Merge Intended

**When:** Upstream changes conflict with local changes, but you want automation after resolution.

**Flow:**

```
Main Workflow
    ↓
1. Fetch upstream tag
    ↓
2. Create branch: weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
    ↓
3. Merge upstream tag → ❌ CONFLICTS detected
    ↓
4. Push branch to remote (with conflicts!)
    ↓
5. Detect conflicts and log details
    ↓
⏸️ WAITING - Manual conflict resolution needed
    ↓
👤 USER resolves conflicts locally
    ↓
👤 USER pushes resolved changes
    ↓
👤 USER creates PR with [auto-merge] marker
    ↓
PR Automation Workflow (auto-triggered)
    ↓
6. Extract tag from branch name → v2.75.2
    ↓
7. Check PR body → [auto-merge] found
    ↓
8. Auto-approve PR
    ↓
9. Auto-merge PR
    ↓
10. Trigger build workflow
    ↓
✅ COMPLETE - Automation resumed
```

**User Actions Required:** ✅ **PARTIAL MANUAL**

**Command to Trigger:**
```bash
gh workflow run upgrade-from-upstream.yml \
  -f git_tag=v2.75.2 \
  -f auto_merge=true
```

**User Must:**

1. **Check workflow summary for conflict details:**
   - Go to Actions → Find the workflow run
   - Check "Workflow summary" section
   - Note the branch name and conflicted files

2. **Checkout the branch:**
   ```bash
   git fetch origin
   git checkout weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
   ```

3. **Resolve conflicts:**
   - Open each conflicted file
   - Remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
   - Keep the correct code
   - Test locally if needed

4. **Commit resolved changes:**
   ```bash
   git add <resolved-files>
   git commit -m "Resolve conflicts for v2.75.2 upgrade"
   ```

5. **Push changes:**
   ```bash
   git push origin weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
   ```

6. **Create PR with auto-merge marker:**
   ```bash
   gh pr create \
     --title "Upgrade Langfuse to v2.75.2" \
     --body "## Upgrade Langfuse to v2.75.2

Conflicts resolved manually.

[auto-merge]
" \
     --base main \
     --head weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
   ```

7. **Wait for automation:**
   - PR Automation workflow will activate
   - PR will be auto-approved and merged
   - Build workflow will be triggered automatically

**Expected Outcome:**
- ✅ Branch created and pushed (with conflicts)
- 👤 Manual conflict resolution
- ✅ PR created manually with auto-merge marker
- ✅ PR approved automatically
- ✅ PR merged automatically
- ✅ Build workflow triggered automatically

**Workflow Summary Shows:**
```
Status: ⚠️ Merge conflicts detected
Branch: weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890 (pushed to remote)
Conflicted Files: 3

Conflicted Files:
web/src/components/Header.tsx
worker/src/queues/processor.ts
packages/shared/src/config.ts

✅ Good news: The branch has been pushed to remote for you!

[Step-by-step resolution instructions...]

💡 Pro Tip: Add [auto-merge] to the PR body to enable automatic approval, merge, and build trigger!
🤖 Automation Ready: Once you create the PR, the PR Automation workflow will activate and can handle the rest automatically if you enable auto-merge.
```

---

### Scenario 4: Merge Conflicts + Manual Review

**When:** Upstream changes conflict with local changes and you want to review before merging.

**Flow:**

```
Main Workflow
    ↓
1. Fetch upstream tag
    ↓
2. Create branch: weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
    ↓
3. Merge upstream tag → ❌ CONFLICTS detected
    ↓
4. Push branch to remote (with conflicts!)
    ↓
5. Detect conflicts and log details
    ↓
⏸️ WAITING - Manual conflict resolution needed
    ↓
👤 USER resolves conflicts locally
    ↓
👤 USER pushes resolved changes
    ↓
👤 USER creates PR (without auto-merge marker)
    ↓
PR Automation Workflow (auto-triggered)
    ↓
6. Extract tag from branch name → v2.75.2
    ↓
7. Check PR body → auto-merge: false
    ↓
8. Add comment explaining manual review required
    ↓
⏸️ WAITING - Manual review and merge needed
```

**User Actions Required:** ✅ **FULL MANUAL**

**Command to Trigger:**
```bash
gh workflow run upgrade-from-upstream.yml \
  -f git_tag=v2.75.2 \
  -f auto_merge=false
```

**User Must:**

1. **Checkout and resolve conflicts** (same as Scenario 3, steps 1-5)

2. **Create PR without auto-merge marker:**
   ```bash
   gh pr create \
     --title "Upgrade Langfuse to v2.75.2" \
     --base main \
     --head weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
   ```

3. **Review, approve, and merge PR manually:**
   ```bash
   gh pr review <PR-NUMBER> --approve
   gh pr merge <PR-NUMBER> --squash --admin
   ```

4. **Trigger build workflow:**
   ```bash
   gh workflow run build-push-neubirdai.yml -f git_tag=v2.75.2
   ```

**Expected Outcome:**
- ✅ Branch created and pushed (with conflicts)
- 👤 Manual conflict resolution
- 👤 PR created manually
- 👤 Manual review and approval
- 👤 Manual merge
- 👤 Manual build trigger

---

### Scenario 5: No Changes (Already Up-to-Date)

**When:** Repository is already at the requested upstream version.

**Flow:**

```
Main Workflow
    ↓
1. Fetch upstream tag
    ↓
2. Create branch: weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
    ↓
3. Merge upstream tag → ✅ Success
    ↓
4. Push branch to remote
    ↓
5. Check for changes → ❌ No differences detected
    ↓
6. Delete branch (cleanup)
    ↓
✅ COMPLETE - No action needed
```

**User Actions Required:** ❌ **NONE**

**Command to Trigger:**
```bash
gh workflow run upgrade-from-upstream.yml -f git_tag=v2.75.2
```

**Expected Outcome:**
- ✅ Branch created
- ✅ Merge completed
- ✅ No changes detected
- ✅ Branch deleted (cleanup)
- ℹ️ No PR created

**Workflow Summary Shows:**
```
Status: ℹ️ No Changes - Already Up-to-Date
✅ Repository is already up-to-date with tag v2.75.2.
No pull request needed - no differences detected between main and the upstream tag.
```

---

### Scenario 6: Branch Already Exists

**When:** A branch with the same name already exists (from a previous run).

**Flow:**

```
Main Workflow
    ↓
1. Fetch upstream tag
    ↓
2. Check if branch exists → ❌ Branch exists!
    ↓
3. Fail with clear message
    ↓
❌ STOPPED - Cleanup needed
```

**User Actions Required:** ✅ **CLEANUP**

**Command to Trigger:**
```bash
gh workflow run upgrade-from-upstream.yml -f git_tag=v2.75.2
```

**User Must:**

**Option 1: Delete existing branch and retry**
```bash
# Delete remote branch
git push origin --delete weekly-upgrade-langfuse-v2.75.2-YYYY-MM-DD-NNNNNNNNNN

# Re-run workflow
gh workflow run upgrade-from-upstream.yml -f git_tag=v2.75.2
```

**Option 2: Check for existing PR**
```bash
# List open PRs
gh pr list

# If PR exists for this upgrade, review/merge it instead
```

**Expected Outcome:**
- ❌ Workflow stops early
- ℹ️ Clear error message about branch existence

**Workflow Summary Shows:**
```
Status: ⚠️ Branch already exists

This could mean:
  1. A previous upgrade workflow run created this branch
  2. There might be an open PR for this upgrade already

Please check:
  - Open PRs: https://github.com/your-org/langfuse/pulls
  - Or delete the branch to retry: git push origin --delete <branch-name>
```

---

### Scenario 7: Invalid Branch Name Format

**When:** A PR is created from a branch that doesn't follow the naming pattern.

**Flow:**

```
User creates PR from non-standard branch
    ↓
PR Automation Workflow (triggered)
    ↓
1. Try to extract tag from branch name
    ↓
2. Extraction fails → ❌ Invalid format
    ↓
3. Post error comment to PR
    ↓
4. Skip all automation steps
    ↓
⏸️ WAITING - Manual intervention required
```

**User Actions Required:** ✅ **MANUAL HANDLING**

**When This Happens:**
- User manually creates branch with wrong name
- User creates PR from branch not created by main workflow

**Example of Invalid Branch Names:**
- `upgrade-to-v2.75.2`
- `langfuse-upgrade`
- `my-custom-upgrade-branch`

**Expected Branch Name Format:**
```
weekly-upgrade-langfuse-<TAG>-YYYY-MM-DD-<timestamp>
```

**What Happens:**
- ⚠️ PR Automation detects the PR
- ❌ Cannot extract git tag from branch name
- 🤖 Posts error comment to PR
- ❌ Auto-merge skipped
- ❌ Build trigger skipped

**PR Comment Shows:**
```
⚠️ Upgrade PR Automation - Configuration Error

Problem: Could not extract git tag from branch name.
Branch name: my-custom-upgrade-branch

Expected Format:
weekly-upgrade-langfuse-<TAG>-YYYY-MM-DD-<timestamp>

What This Means:
- ❌ Auto-merge cannot proceed
- ❌ Build workflow cannot be triggered automatically
- 👤 Manual intervention required

Manual Steps:
1. Review and approve this PR manually
2. Merge the PR
3. Manually trigger build workflow with correct tag
```

**User Must:**
```bash
# Review and approve PR
gh pr review <PR-NUMBER> --approve

# Merge PR
gh pr merge <PR-NUMBER> --squash

# Manually trigger build with correct tag
gh workflow run build-push-neubirdai.yml -f git_tag=v2.75.2
```

**Prevention:**
- ✅ Always use the main upgrade workflow to create branches
- ✅ If creating manually, follow the branch naming pattern exactly

---

### Scenario 8: Workflow Failures

**When:** Something goes wrong during workflow execution.

#### 8.1 Upstream Fetch Failure

**Possible Causes:**
- GitHub connectivity issues
- Upstream repository unavailable
- Rate limiting

**User Actions:**
```bash
# Wait a few minutes and retry
gh workflow run upgrade-from-upstream.yml -f git_tag=v2.75.2
```

#### 8.2 Invalid Git Tag

**Flow:**
```
Main Workflow
    ↓
1. Fetch upstream tag
    ↓
2. Validate tag exists → ❌ Tag not found
    ↓
3. List available recent tags
    ↓
❌ FAILED - Invalid tag provided
```

**User Actions:**
```bash
# Check available upstream tags
git ls-remote --tags https://github.com/langfuse/langfuse.git | grep -E 'v[0-9]+\.[0-9]+\.[0-9]+$' | tail -20

# Re-run with correct tag
gh workflow run upgrade-from-upstream.yml -f git_tag=v2.75.3
```

#### 8.3 PR Creation Failure

**Possible Causes:**
- Token permission issues
- Network problems
- GitHub API rate limiting

**User Actions:**
```bash
# Branch should exist even if PR creation failed
# Create PR manually
gh pr create \
  --title "Upgrade Langfuse to v2.75.2" \
  --base main \
  --head weekly-upgrade-langfuse-v2.75.2-YYYY-MM-DD-NNNNNNNNNN
```

#### 8.4 Auto-Merge Failure

**Possible Causes:**
- `LANGFUSE_PR_PAT` not configured
- PAT lacks required permissions
- Merge conflicts during auto-merge attempt

**User Actions:**
```bash
# Check if LANGFUSE_PR_PAT is configured
# Settings → Secrets → Actions

# If not configured, merge manually
gh pr merge <PR-NUMBER> --squash --admin

# Then trigger build
gh workflow run build-push-neubirdai.yml -f git_tag=v2.75.2
```

#### 8.5 Build Workflow Trigger Failure

**Possible Causes:**
- Token permission issues
- Build workflow file missing/renamed
- Workflow disabled

**User Actions:**
```bash
# Manually trigger build workflow
gh workflow run build-push-neubirdai.yml -f git_tag=v2.75.2

# Or trigger via GitHub UI:
# Actions → Build Push Neubirdai → Run workflow → Enter git_tag
```

---

## Configuration Reference

### Main Workflow Inputs

| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `git_tag` | string | Yes | - | Upstream git tag (e.g., `v2.75.2`) |
| `auto_merge` | boolean | No | `false` | Enable auto-merge after PR creation |

### PR Automation Detection

The PR Automation workflow automatically detects configuration:

**Git Tag:** Extracted from branch name
```
weekly-upgrade-langfuse-v2.75.2-2026-08-11-1234567890
                         ^^^^^^^ extracted tag
```

**Auto-Merge:** Detected from PR body
```markdown
<!-- Any of these patterns trigger auto-merge: -->

[auto-merge]

auto-merge: enabled

auto-merge: true
```

### Branch Naming Pattern

```
weekly-upgrade-langfuse-<TAG>-<DATE>-<TIMESTAMP>
│                       │     │     │
│                       │     │     └─ Unix timestamp (10 digits)
│                       │     └─────── YYYY-MM-DD format
│                       └───────────── Git tag (e.g., v2.75.2)
└───────────────────────────────────── Fixed prefix
```

**Examples:**
- `weekly-upgrade-langfuse-v2.75.2-2026-08-11-1723401234`
- `weekly-upgrade-langfuse-v3.0.0-2026-09-15-1726401234`

---

## Troubleshooting

### Q: Workflow says "branch already exists" but I don't see it

**Solution:**
```bash
# List all remote branches with the pattern
git ls-remote --heads origin | grep weekly-upgrade-langfuse

# Delete the old branch
git push origin --delete <branch-name>

# Re-run the workflow
```

### Q: PR Automation workflow didn't run

**Check:**
1. Branch name matches pattern: `weekly-upgrade-langfuse-*`
2. PR targets `main` branch
3. PR event is `opened`, `reopened`, or `synchronize`

**View workflow runs:**
```bash
gh run list --workflow=upgrade-pr-automation.yml
```

### Q: Auto-merge isn't working

**Common Causes:**

1. **LANGFUSE_PR_PAT not configured:**
   - Go to Settings → Secrets → Actions
   - Add secret: `LANGFUSE_PR_PAT`
   - Value: Personal Access Token with `repo` and `workflow` scopes

2. **PR has no auto-merge marker:**
   - Check PR body contains `[auto-merge]` or `auto-merge: enabled`
   - Edit PR description and add the marker

3. **PR has failing checks:**
   - Auto-merge waits for checks to pass
   - Fix any failing tests or checks

### Q: Build workflow wasn't triggered

**Check:**
1. Was PR actually merged?
2. Check "Trigger build workflow" step in PR Automation logs
3. Verify build workflow file exists: `.github/workflows/build-push-neubirdai.yml`

**Manual trigger:**
```bash
gh workflow run build-push-neubirdai.yml -f git_tag=v2.75.2
```

### Q: How do I know which tag to use?

**List recent upstream tags:**
```bash
git ls-remote --tags https://github.com/langfuse/langfuse.git | \
  grep -E 'v[0-9]+\.[0-9]+\.[0-9]+$' | \
  sed 's/.*refs\/tags\///' | \
  sort -V | \
  tail -20
```

**Check current fork version:**
```bash
git describe --tags --abbrev=0
```

### Q: Can I test without actually merging?

**Yes, use a test branch:**
1. Create test branch in your fork
2. Modify workflow to target test branch instead of `main`
3. Run workflow and verify behavior
4. Delete test artifacts
5. Run workflow targeting `main` for real

### Q: How do I roll back an upgrade?

**If not deployed yet:**
```bash
# Just don't deploy the new images
```

**If already deployed:**
```bash
# Revert the PR
gh pr revert <PR-NUMBER>

# Or manually revert
git revert <merge-commit-sha>
git push origin main
```

---

## Quick Reference

### Fully Automated Upgrade (No Conflicts)
```bash
gh workflow run upgrade-from-upstream.yml \
  -f git_tag=v2.75.2 \
  -f auto_merge=true
```
**Result:** Everything happens automatically, ~2-3 minutes

### Manual Review Upgrade (No Conflicts)
```bash
gh workflow run upgrade-from-upstream.yml \
  -f git_tag=v2.75.2 \
  -f auto_merge=false
```
**Then:** Review, approve, merge PR, trigger build manually

### After Conflict Resolution
```bash
# 1. Resolve conflicts locally
# 2. Push changes
# 3. Create PR with auto-merge
gh pr create --title "Upgrade Langfuse to v2.75.2" --body "[auto-merge]" --base main --head <branch-name>
```
**Result:** Automation resumes, PR auto-merged, build triggered

### Emergency Manual Override
```bash
# Skip all automation
gh pr create --title "Upgrade Langfuse to v2.75.2" --base main --head <branch-name>
gh pr review <PR-NUMBER> --approve
gh pr merge <PR-NUMBER> --squash
gh workflow run build-push-neubirdai.yml -f git_tag=v2.75.2
```

---

## Support

For issues or questions:
1. Check workflow run logs in GitHub Actions
2. Review workflow summary section for detailed steps
3. Check this README for your specific scenario
4. Review workflow files for implementation details

**Key Files:**
- `.github/workflows/upgrade-from-upstream.yml` - Main upgrade workflow
- `.github/workflows/upgrade-pr-automation.yml` - PR automation workflow
- `.github/workflows/build-push-neubirdai.yml` - Build and push workflow
