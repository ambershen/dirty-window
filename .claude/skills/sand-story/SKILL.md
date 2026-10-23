---
name: sand-story
description: Add a story to the sand-scroll story database (src/vj/stories), either a classical tale (epic, myth, scripture) or the story behind an artwork, broken into drawable episodes. Use when asked to add, ingest or write a story for the drawing agent, e.g. "/sand-story the Last Supper".
---

# Add a story for the drawing agent

Write `src/vj/stories/<id>.json`. One file holds one story. Stories must be public domain, or retold in our own words with the source named.

## Schema
```json
{ "id": "lastsupper", "title": "The Last Supper", "kind": "epic | myth | scripture | artwork",
  "ground": "sea | land | both",
  "tone": "How it should be drawn: one sentence naming a historical drawing style that suits sand lines.",
  "source": "Where the story comes from (text, painting, museum)", "license": "public domain | retold",
  "artwork": { "title": "…", "artist": "…", "year": "…", "pieceId": "id in the library if traced" },
  "episodes": [
    { "id": "short-id", "title": "…", "mood": "quiet | journey | busy | climax",
      "scene": "One or two sentences: what happens.",
      "keyImage": "The single picture that tells it, as a sand drawing: who, in what pose, where, facing which way.",
      "cast": ["piece or figure ids"], "props": ["…"], "setting": ["…"] } ] }
```
`artwork` is only filled in for `kind: "artwork"`. These tell the story behind a painting or sculpture, such as how it was made, what it shows, and what happened to it.

## Rules
- Use 5–10 episodes and **at least one** of each of quiet, journey and climax, so the music has something to pick from in every section.
- `keyImage` is what matters most. Write it so it can be drawn in at most 3 figures plus a setting, in profile, as outlines. Avoid crowds, interiors with depth, and text.
- `cast` uses existing library ids where possible. Check them with `node scripts/catalog.mjs`. List any missing figure under `"needs": [...]` at the top level, so `/sand-library` knows what to add.
- Keep wording in our own words, and keep it short.
