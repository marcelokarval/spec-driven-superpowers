# Releases

The version in `package.json` and the root entries of `package-lock.json` must
match. Publish source releases through a reviewed pull request to `main`, passing
the validation matrix, followed by an immutable `v<version>` tag and GitHub release
at the merged commit. Do not rewrite existing release tags.

Before publication, run `npm run check`, `npm run validate`, `npm test` and
`git diff --check`. When changing the handoff, also exercise the actual Accelerate
producer with `scripts/check-accelerate-handoff.mjs --accelerate <checkout>`.
Keep model/session evidence distinct from deterministic contract tests.

Global installation is a separate operation through the documented installer.
Source publication does not install skills, activate a project or initialize
OpenSpec. Verify existing installed payloads against the planned source before
claiming that an installation corresponds to a release.
