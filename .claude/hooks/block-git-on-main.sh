#!/bin/bash
# PreToolUse hook: blocks `git commit` and `git push` while on main, and any
# push that targets main. Work goes on a branch and reaches main through a PR.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
BRANCH=$(git -C "${CWD:-.}" branch --show-current 2>/dev/null)

GIT='(^|[;&|(]|\s)git(\s+-C\s+\S+)?\s+'

block() {
  echo "BLOCKED: $1 Create a branch first (git switch -c <name>), commit there, and open a PR into main." >&2
  exit 2
}

if [ "$BRANCH" = "main" ] && echo "$COMMAND" | grep -qE "${GIT}(commit|push)(\s|$)"; then
  block "'git commit' and 'git push' are not allowed while on main."
fi

if echo "$COMMAND" | grep -qE "${GIT}push([[:space:]][^;&|]*)?[[:space:]:+]main(\s|$|;|&)"; then
  block "Pushing to main is not allowed."
fi

exit 0
