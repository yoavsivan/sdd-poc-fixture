The reviewer answers six RUBRIC §stale questions per trial, unblinded.

Output schema:

```json
{
  "questions": [
    {"q": 1, "contradicted": [{"statement": "", "where": "", "code_ref": ""}]}
  ],
  "count": 0
}
```

`count` equals the number of contradicted statements across all six questions.
Do not name a model. The orchestrator runs this as a review-family task or a person.
