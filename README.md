# Content Approval Desk

Small social-media teams often keep a content plan in a spreadsheet and approvals in chat. That makes it easy to publish the wrong version, miss a booking link, or schedule two posts in the same slot. This personal open-source demo creates one local review board with clear checks and decisions before anything is scheduled.

## Why this project

Recent discussions in [r/socialmedia](https://www.reddit.com/r/socialmedia/comments/1u84clo/content_planningposting_tools/) and [r/SocialMediaMarketing](https://www.reddit.com/r/SocialMediaMarketing/comments/1qtmosb/affordablefree_social_media_scheduling_tools_for/) repeatedly mention visual calendars, simple approval links, status tracking, and avoiding spreadsheet double-entry. This project focuses on that narrow operations problem instead of trying to publish to every platform.

## What it does

- normalizes a small campaign brief for Instagram, Facebook, LinkedIn, and Google Business Profile
- checks required hooks, captions, CTAs, assets, alt text, dates, and destination URLs
- warns about platform caption/hashtag limits and unsupported result claims
- finds duplicate platform/time slots before scheduling
- tracks `needs_changes`, `ready_for_approval`, `changes_requested`, and `approved`
- records reviewer decisions without requiring a social-platform login
- serves a read-only local board at a shareable review URL

It intentionally does **not** log into Instagram, Facebook, LinkedIn, or Google, and it never publishes content. All fixture content is synthetic. This is a personal demo, not paid client work or a production claim.

## Run it

Requires Node.js 20 or newer. There are no external packages.

```bash
npm test
npm run validate
npm run serve
```

Open `http://127.0.0.1:4173` after `npm run serve`.

The CLI also supports:

```bash
npm run board   # readable review board
npm run json    # machine-readable board data
```

## Example output

```text
CONTENT APPROVAL DESK  |  Bhagalpur Fitness Week
campaign=bhagalpur-september-demo  objective=give a small local team a reviewable weekly content plan
review_link=http://localhost:4173/review/bhagalpur-september-demo
──────────────────────────────────────────────────────────────────────────────────
ITEMS 3  NEEDS_CHANGES 2  READY 0  APPROVED 1  COLLISIONS 1
instagram      fitness-001    needs_changes      issues=1 warnings=0
  ! scheduled slot is already used by another item
instagram      fitness-002    needs_changes      issues=1 warnings=0
  ! scheduled slot is already used by another item
linkedin       fitness-003    approved           issues=0 warnings=1
  ? claim needs evidence or human review
```

The [architecture diagram](docs/architecture.svg) shows the boundary between a brief, deterministic checks, and human approval. It is generated as a repository-native SVG rather than a fabricated product screenshot.

## Design notes

- The same input produces the same checks; no model call or network fetch is required.
- A duplicate slot is a blocking issue for both items so the operator has to make the conflict explicit.
- A claim warning is not silently removed. A reviewer can approve it only after deciding that the wording is supported.
- The local board is read-only. Real OAuth, permissions, rate limits, moderation rules, storage, and audit retention need a separate security review.

## Roadmap

1. Add an import/export format for Notion and CSV while preserving IDs.
2. Add a signed, expiring review link for a hosted deployment.
3. Add a SQLite audit store and role-based reviewer permissions.
4. Add platform adapters only after credential isolation and abuse controls are designed.
