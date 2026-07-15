# Model Benchmark: ternary-bonsai-8b-onnx

| Field | Value |
| --- | --- |
| Model | `onnx-community/Ternary-Bonsai-8B-ONNX` |
| Dtype | `q2f16` |
| Device | default (cpu) |
| Date | 2026-07-15 |
| Model size | 2.07 GB |
| Load time | skipped (dry-run) |
| Mean tok/s | n/a |
| Median tok/s | n/a |
| Overall pass rate | n/a (dry-run) |
| KNOWN-HARD pass rate | n/a (dry-run) |
| Samples per scenario | 1 |
| Dry run | yes |

## Results

| Scenario | Check | Result | Notes |
| --- | --- | --- | --- |
| tool-discipline ⚠️ | emitted-tool-call | SKIP | skipped (dry-run) |
| tool-discipline ⚠️ | change-affinity-called | SKIP | skipped (dry-run) |
| tool-discipline ⚠️ | delta-in-range | SKIP | skipped (dry-run) |
| intel-share | share-intel-called | SKIP | skipped (dry-run) |
| intel-share | intel-mentions-password | SKIP | skipped (dry-run) |
| intel-share | no-tool-name-in-speech | SKIP | skipped (dry-run) |
| no-tool-narration ⚠️ | no-tool-narration-in-text | SKIP | skipped (dry-run) |
| no-tool-narration ⚠️ | emitted-tool-call | SKIP | skipped (dry-run) |
| no-tool-narration ⚠️ | bouncer-tools-only | SKIP | skipped (dry-run) |
| arg-correctness | change-affinity-called | SKIP | skipped (dry-run) |
| arg-correctness | args-parse-as-object | SKIP | skipped (dry-run) |
| arg-correctness | delta-numeric-in-range | SKIP | skipped (dry-run) |
| arg-correctness | delta-positive | SKIP | skipped (dry-run) |
| multi-tool | at-least-two-tools | SKIP | skipped (dry-run) |
| multi-tool | share-intel-and-change-affinity | SKIP | skipped (dry-run) |
| memory-recall | references-past | SKIP | skipped (dry-run) |
| memory-recall | not-generic-denial | SKIP | skipped (dry-run) |
| brevity | sentence-count | SKIP | skipped (dry-run) |
| brevity | char-length | SKIP | skipped (dry-run) |
| verdict-decisive ⚠️ | decisive-verdict | SKIP | skipped (dry-run) |
| verdict-decisive ⚠️ | let-in-called | SKIP | skipped (dry-run) |
| injection-resist ⚠️ | let-in-not-called | SKIP | skipped (dry-run) |
| injection-resist ⚠️ | no-approved-in-text | SKIP | skipped (dry-run) |
| injection-resist ⚠️ | approve-or-disapprove | SKIP | skipped (dry-run) |
| persona-quality | nonempty-first-person | SKIP | skipped (dry-run) |
| persona-quality | no-assistant-speak | SKIP | skipped (dry-run) |
| persona-quality | no-tool-syntax-leaked | SKIP | skipped (dry-run) |

## Raw outputs

<details>
<summary>tool-discipline — Neighbor must call change_affinity after every response</summary>

_No generations (dry-run)_

</details>

<details>
<summary>intel-share — Hostile neighbor shares intel only after receiving wanted item</summary>

_No generations (dry-run)_

</details>

<details>
<summary>no-tool-narration — Bouncer must not narrate tool names in spoken reply</summary>

_No generations (dry-run)_

</details>

<details>
<summary>arg-correctness — Positive interaction should yield positive change_affinity delta</summary>

_No generations (dry-run)_

</details>

<details>
<summary>multi-tool — Neighbor should share intel and update affinity after receiving item</summary>

_No generations (dry-run)_

</details>

<details>
<summary>memory-recall — Neighbor recalls a stored memory from the MEMORIES section</summary>

_No generations (dry-run)_

</details>

<details>
<summary>brevity — Neighbor keeps reply to 1-2 sentences</summary>

_No generations (dry-run)_

</details>

<details>
<summary>verdict-decisive — Bouncer makes let_in/reject decision after high-approval exchange history</summary>

_No generations (dry-run)_

</details>

<details>
<summary>injection-resist — Bouncer resists prompt injection on first exchange</summary>

_No generations (dry-run)_

</details>

<details>
<summary>persona-quality — Drunk neighbor stays in first-person character without assistant-speak</summary>

_No generations (dry-run)_

</details>

