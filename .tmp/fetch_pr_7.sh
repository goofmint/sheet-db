#!/bin/bash
set -euo pipefail

PR=7
OWNER=$(gh repo view --json owner --jq .owner.login)
REPO=$(gh repo view --json name --jq .name)
OUT=.tmp/pr_${PR}_unresolved.tsv

mkdir -p .tmp
: > "$OUT"

CURSOR=""
while :; do
  if [ -n "$CURSOR" ]; then
    CURSOR_ARG="-F cursor=$CURSOR"
  else
    CURSOR_ARG=""
  fi

  RESP=$(
    gh api graphql \
      -f owner="$OWNER" -f name="$REPO" -F number="$PR" $CURSOR_ARG \
      -f query='
      query($owner:String!, $name:String!, $number:Int!, $cursor:String) {
        repository(owner:$owner, name:$name) {
          pullRequest(number:$number) {
            reviewThreads(first:100, after:$cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                isResolved
                comments(first:1) {
                  nodes { url path body }
                }
              }
            }
          }
        }
      }'
  )

  echo "$RESP" | jq -r '
    (.data.repository.pullRequest.reviewThreads.nodes // [])
    | map(select(.isResolved==false and (.comments.nodes | length > 0)))
    | .[]
    | .comments.nodes[0]
    | [
        .url,
        (.path // "-"),
        (.body | gsub("\r";" ") | gsub("\n";" ") | gsub("\t";" "))
      ]
    | @tsv
  ' >> "$OUT"

  HAS_NEXT=$(echo "$RESP" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage')
  if [ "$HAS_NEXT" != "true" ]; then break; fi
  CURSOR=$(echo "$RESP" | jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor')
done

echo "✅ Saved to $OUT"
cat "$OUT"
