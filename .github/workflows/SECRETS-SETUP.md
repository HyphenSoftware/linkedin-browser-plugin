# GitHub Secrets Setup Guide

This document explains how to configure the required GitHub secrets for the workflows.

## Required Secrets

None. The extension signs users in with their Microsoft (Entra) account, so the build contains no
keys. Its non-secret settings per environment (API base URL, tenant, client ID, scope) live in the
committed `browser-ext/environments.json`.

---

## Optional Secrets

### `CODECOV_TOKEN`

**Used by:** `test.yml`  
**Purpose:** Uploads test coverage reports to Codecov (optional)

**How to set it up:**

1. Sign up at [codecov.io](https://codecov.io) and link your repository
2. Get your upload token from Codecov
3. Add it as a GitHub secret named `CODECOV_TOKEN`

If not set, the workflow will continue but won't upload coverage (due to `continue-on-error: true`).

---

## Verifying Secrets

### Test the Build Workflow

1. Go to **Actions** tab
2. Select **Build Browser Extension** workflow  
3. Click **Run workflow**
4. Select your branch
5. Click **Run workflow**

The build should complete successfully and create the extension zip file.

---

## Security Best Practices

### ✅ DO:
- Store all sensitive values in secrets
- Review who has access to repository secrets

### ❌ DON'T:
- Share secret values in issues or PRs
- Use production secrets for testing
- Log secret values in workflows (they're automatically masked)

---

## Troubleshooting

### Can't find where to add secrets

**Cause:** May need admin/write permissions  
**Fix:** Ask a repository admin to add the secret or grant you permissions

---

## Example: Adding the Secret via GitHub CLI

If you prefer using the command line:

```bash
# Install GitHub CLI: https://cli.github.com

# Login to GitHub
gh auth login

# Add the secret (will prompt for value)
gh secret set CODECOV_TOKEN

# Verify it was added
gh secret list
```

---

For more information about GitHub Secrets, see:
- [GitHub Docs: Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Docs: Using Secrets in Workflows](https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow)

