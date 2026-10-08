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
- **Push** to `linkedin-to-api-ts`
- **Manual trigger:** Via GitHub Actions UI

**What it does:**
1. Runs full test suite first
2. Builds the browser extension (`npm run package:browserext`)
3. Extracts version from `package.json`
4. Creates a zip file named `build_[version].zip` in `webstore-zips/`
5. Uploads the zip as a GitHub Actions artifact (retained for 90 days)
6. **On `linkedin-to-api-ts` only:** drafts the release `v[version]` with the zip and auto-generated release notes. If that draft already exists, it replaces the zip and points the draft at the new commit. If `v[version]` is already published, it skips this step until the version in `package.json` is bumped.

**Output:**
- Artifact: `browser-extension-[version]` containing `build_[version].zip`
- Release: Draft release `v[version]`

Publishing the draft (not as a pre-release) is the only manual step. GitHub then creates the `v[version]` tag on the draft's commit, and the update rolls out: the popup checks the latest published release and, when its tag is newer than the installed version, shows an update banner with a link to its zip. Users see it within an hour.

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

#### Releasing a New Version

```bash
# Bump the version in package.json without creating a tag
npm version patch --no-git-tag-version  # or minor, or major
git commit -am "chore: release 1.1.0"
git push origin linkedin-to-api-ts
```

The workflow drafts the release `v1.1.0`. Later pushes before publishing update that draft. Review it under **Releases** and publish it.

#### Manual Trigger (Testing/Development)

1. Go to the **Actions** tab on GitHub
2. Select **"Build Browser Extension"** workflow
3. Click **"Run workflow"**
4. Choose a branch and click **"Run workflow"**

The artifact will be available in the workflow run for download. Only runs on `linkedin-to-api-ts` touch the draft release.

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
- **Release:** Creates or updates the draft release for the version in `package.json`
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
- [ ] Did you push to `linkedin-to-api-ts`?
- [ ] Is the version in `package.json` higher than the last published release? The run shows a notice when it isn't.
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
- ✅ Use semantic versioning in `package.json` (`1.2.3`)
- ✅ Review and publish draft releases after testing
- ✅ Download artifacts from Actions for manual testing
- ✅ Keep Node versions in matrix up to date

---

## Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Package.json Version Field](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#version)

