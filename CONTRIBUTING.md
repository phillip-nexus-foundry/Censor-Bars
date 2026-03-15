# Contributing to Censor Bars

Thank you for your interest in contributing!

## Development Setup

1. Fork and clone the repository
2. Install prerequisites (Rust 1.70+, Node.js 18+, Tauri system dependencies)
3. Run `npm install` then `npm run tauri dev`

## Branch Strategy

- `main` — stable, release-ready code
- `develop` — integration branch for features
- `feature/*` — feature branches off `develop`
- `fix/*` — bug fix branches
- `release/*` — release preparation branches

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add gradient rotation animation
fix: prevent bar from going off-screen
docs: update keyboard shortcuts list
refactor: extract color picker into separate component
test: add unit tests for bar state management
```

## Pull Requests

1. Create a feature branch from `develop`
2. Write/update tests for your changes
3. Ensure `npm run lint` and `cargo clippy` pass
4. Ensure all tests pass: `npm test` and `cargo test`
5. Open a PR against `develop` with a clear description

## Code Style

- **Rust**: Follow `rustfmt` defaults. Run `cargo fmt` before committing.
- **Frontend**: Follow ESLint config. Run `npm run lint` before committing.
- **CSS**: BEM naming convention for custom classes.

## Reporting Issues

Use GitHub Issues with the provided templates. Include:
- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
