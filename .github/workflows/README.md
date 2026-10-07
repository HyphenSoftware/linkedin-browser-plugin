# GitHub Actions Workflows

This directory contains automated workflows for the LinkedIn Profile Extractor project.

## Workflows

### 🧪 Test Workflow (`test.yml`)

**Triggers:**
- Pull requests to `main` or `linkedin-to-api` branches
- Pushes to `main` or `linkedin-to-api` branches

**What it does:**
1. Runs on Node.js 18.x and 20.x (matrix testing)
2. Installs dependencies
3. Runs TypeScript type checking (`npm run type-check`)
4. Runs ESLint (`npm run lint`)
5. Runs test suite (`npm test`)
6. Uploads coverage reports to Codecov (Node 20.x only)

**Status:** ✅ Ensures all PRs are tested before merge

---

### 📦 Build Extension Workflow (`build-extension.yml`)

**Triggers:**
- **Tag push:** When you push a tag starting with `v` (e.g., `v1.1.0`)
- **Manual trigger:** Via GitHub Actions UI with optional release creation

**What it does:**
1. Runs full test suite first
2. Builds the browser extension (`npm run package:browserext`)
3. Extracts version from `package.json`
4. Creates a zip file named `build_[version].zip` in `webstore-zips/`
5. Uploads the zip as a GitHub Actions artifact (retained for 90 days)
6. **If triggered by tag:** Creates a draft GitHub release with the zip file

**Output:**
- Artifact: `browser-extension-[version]` containing `build_[version].zip`
- Release: Draft release with auto-generated release notes (for tags only)

---

## Quick Setup Checklist

Before using the workflows, complete these one-time setup steps:

- [ ] **Set up `CODECOV_TOKEN` secret** (Optional for test coverage)
  - Only needed if you want coverage reports on codecov.io
  
- [ ] **Test the workflows**
  - Create a test PR to verify the test workflow runs
  - Manually trigger the build workflow to verify it works

---

## Usage

### Running Tests on Pull Requests

Tests run automatically when you create or update a PR. Just push your changes!

```bash
git checkout -b feature/my-feature
git commit -am "Add my feature"
git push origin feature/my-feature
# Create PR on GitHub - tests will run automatically
```

### Building the Extension

#### Option 1: Create a Git Tag (Recommended for releases)

```bash
# Update version in package.json first
npm version patch  # or minor, or major

# Push the tag
git push origin v1.1.0

# This will:
# 1. Run tests
# 2. Build extension
# 3. Create build_1.1.0.zip
# 4. Create draft GitHub release
```

#### Option 2: Manual Trigger (Testing/Development)

1. Go to the **Actions** tab on GitHub
2. Select **"Build Browser Extension"** workflow
3. Click **"Run workflow"**
4. Choose branch and optionally enable "Create a GitHub release"
5. Click **"Run workflow"**

The artifact will be available in the workflow run for download.

---

## Workflow Files

### `test.yml`
- **Purpose:** Continuous integration testing
- **Strategy:** Matrix testing on Node 18.x and 20.x
- **Coverage:** Uploads coverage to Codecov
- **Fast:** Usually completes in 2-3 minutes

### `build-extension.yml`
- **Purpose:** Build production-ready extension package
- **Output:** `webstore-zips/build_[version].zip`
- **Release:** Creates draft releases for tags
- **Artifact Retention:** 90 days

---

## Required Secrets

### For Build Workflow

The build workflow needs no secrets: users sign in with Entra, and `browser-ext/environments.json` is committed.

### For Test Workflow

The test workflow optionally uses:
- **`CODECOV_TOKEN`** (Optional) - For uploading coverage reports to Codecov
  - Get from [codecov.io](https://codecov.io)
  - If not set, workflow continues without uploading coverage

---

## Troubleshooting

### Test Workflow Fails

**Check:**
1. Do tests pass locally? (`npm test`)
2. Is TypeScript compilation clean? (`npm run type-check`)
3. Are there linting errors? (`npm run lint`)

### Build Workflow Fails

**Common issues:**
1. **Missing dependencies:** Ensure `package.json` is up to date
2. **Build script errors:** Test locally with `npm run package:browserext`
3. **Version mismatch:** Check `package.json` version is correct

**Debug locally:**
```bash
npm ci
npm test
npm run package:browserext
ls -la webstore-zips/
```

### Release Not Created

**Checklist:**
- [ ] Did you push a tag starting with `v`?
- [ ] Does the tag match the version in `package.json`?
- [ ] Did the build workflow complete successfully?
- [ ] Check the Actions tab for any errors

---

## Maintenance

### Updating Node Versions

Edit the matrix in `test.yml`:
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x]  # Add new versions here
```

### Changing Artifact Retention

Edit `retention-days` in `build-extension.yml`:
```yaml
retention-days: 90  # Change to desired number of days (1-90)
```

### Customizing Release Notes

The workflow uses auto-generated release notes. To customize, edit the release creation step in `build-extension.yml`.

---

## Best Practices

### For Contributors
- ✅ Always create PRs - tests run automatically
- ✅ Fix any test failures before requesting review
- ✅ Check workflow status in the PR

### For Maintainers
- ✅ Use semantic versioning for tags (`v1.2.3`)
- ✅ Review and publish draft releases after testing
- ✅ Download artifacts from Actions for manual testing
- ✅ Keep Node versions in matrix up to date

---

## Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Package.json Version Field](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#version)

