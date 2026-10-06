# Research: CI Validation Workflow

## Decision: Target `master` for push validation

- **Decision**: Configure the push trigger for `master`.
- **Rationale**: `git remote show` metadata in this repository resolves `origin/HEAD` to `origin/master`, identifying the default branch without guessing.
- **Alternatives considered**: Trigger every branch, which would duplicate checks beyond the requested default-branch validation; trigger `main`, which does not match repository metadata.

## Decision: Use the locked npm install

- **Decision**: Run `npm ci` before validation.
- **Rationale**: `package-lock.json` is tracked and the captain explicitly requires `npm ci`; it provides deterministic CI installation without changing dependencies.
- **Alternatives considered**: `npm install`, which can rewrite the lockfile and is not the requested validation contract.

## Decision: Keep required commands as separate steps

- **Decision**: Run `npm test`, `npm run check`, and `npm run build` in separate workflow steps after installation.
- **Rationale**: Separate steps expose the failing command as a registered check and preserve fail-fast behavior. The commands are the requested package-script contract even though the current package does not define `test` or `check`.
- **Alternatives considered**: A compound shell command, which obscures the failing check; adding scripts or dependencies, which is outside this feature's scope.

## Decision: Exclude deployment

- **Decision**: Do not invoke `npm run deploy`, Wrangler, or any release action.
- **Rationale**: The feature validates changes only. Deployment requires credentials and belongs to a separate release flow.
- **Alternatives considered**: A combined validation/deployment workflow, rejected because it broadens scope and introduces release side effects.
