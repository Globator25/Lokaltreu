# Commit Convention (Conventional Commits)

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

**Types**
- `feat` → new feature
- `fix` → bug fix
- `chore` → tooling / infra
- `test` → testing-related
- `docs` → documentation
- `refactor` → internal restructuring
- `ci` → workflow or pipeline update

**Examples**
- `feat(api): add referral plan gate`
- `test(web): enforce device-proof test coverage`
- `chore(ci): add GDPR compliance workflow`

**Rules**
- Use lowercase
- Max 72 characters subject
- Scope optional
- Imperative tone (“add”, not “added”)
