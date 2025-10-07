#!/bin/bash
set -euo pipefail

PR=3
OWNER=$(gh repo view --json owner --jq .owner.login)
REPO=$(gh repo view --json name --jq .name)
OUT=.tmp/pr_${PR}_unresolved.tsv

mkdir -p .tmp
: > "$OUT"

CURSOR=""
while true; do
  if [ -z "$CURSOR" ]; then
    RESP=$(gh api graphql \
      -f owner="$OWNER" -f name="$REPO" -F number="$PR" \
      -f query='
      query($owner:String!, $name:String!, $number:Int!) {
        repository(owner:$owner, name:$name) {
          pullRequest(number:$number) {
            reviewThreads(first:100) {
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
      }')
  else
    RESP=$(gh api graphql \
      -f owner="$OWNER" -f name="$REPO" -F number="$PR" -F cursor="$CURSOR" \
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
      }')
  fi

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
