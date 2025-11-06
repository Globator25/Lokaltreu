# Changesets

- `main` push → `.github/workflows/changeset-version.yml` runs `npx changeset version`, commits and pushes.
- Manual release → trigger `.github/workflows/changeset-release.yml`, runs `npx changeset publish --no-git-tag`.
- Continue to author changesets with `npx changeset`.
