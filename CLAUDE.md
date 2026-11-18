# Expense Splitter

## Language

Talk to the user in Chinese. Everything else is English: code, comments, commit messages, PRs, issues, specs, `GLOSSARY.md`, ADRs and all other docs.

## Agent skills

### Issue tracker

Issues live in a separate GitHub repo, `JoshLiu111/issue-track` (not this code repo); always pass `-R JoshLiu111/issue-track`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Workflow

- Before implementing, if on `main`, create a branch: `git switch -c <issue-number>-<slug>`.
- Commit, then run `/code-review since main`. The review diffs commits (`main...HEAD`), not the working tree.
- After pushing, open the PR with `/pr`.
- A commit that changes how a `GLOSSARY.md` term behaves updates that term's definition in the same commit.
- Test counts in a PR name the commit they ran on, e.g. "`npm test` 258 passed @ `5d28e8a`". After a new commit or an amend, rerun them or cite the PR's CI run.
