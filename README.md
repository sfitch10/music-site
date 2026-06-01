# [SITE NAME] — Setup Guide

## Local Development
1. Install VS Code (code.visualstudio.com)
2. Install the "Live Server" extension in VS Code
3. Open this folder in VS Code
4. Right-click index.html → "Open with Live Server"
5. Site runs at localhost:5500

> **Important:** The site uses ES modules (`type="module"` scripts), which require a local server to work correctly. Opening index.html directly as a file:// URL will not work. Use Live Server or any local HTTP server.

## Deploying to GitHub Pages
1. Create a GitHub account at github.com
2. Create a new repository named: [your-site-name]
3. Upload all files to the repository
4. Go to repository Settings → Pages
5. Set Source to: Deploy from a branch → main → / (root)
6. Your site will be live at: [username].github.io/[repo-name]

## Updating Scores
Edit `/data/scores.json` directly. Each album has an entry keyed by its ID.
Each entry contains `critic_inputs` (one value per outlet) and `crowd_inputs` (streaming, chart, vibe tap data).
Edit `/data/debate.json` to update the weekly debate.
Edit `/data/ondeck.json` to add new releases to On Deck.

## Adjusting Rankings
Edit `/data/matrix.json`. Every weight has a comment explaining what it does.
All weights within a group must sum to 1.0.
The tier score thresholds are also in matrix.json — adjust them to recalibrate how many albums land in each tier.

## Adding Albums
1. Add an entry to `/data/albums.json` following the existing format (all fields required).
2. Add a matching entry to `/data/scores.json` with stub scores.
3. The album will appear in rankings automatically on next page load.

For On Deck albums, also add an entry to `/data/ondeck.json`.

## Album Cover Art
Set the `cover_art_url` field in albums.json to any publicly accessible image URL.
If left empty, a placeholder emoji is shown instead.

## File Structure
```
/root
  index.html          ← Landing page (Monthly Setlist)
  alltime.html        ← All-Time rankings
  album.html          ← Individual album page (populated by JS)
  debate.html         ← Weekly Debate feature
  ondeck.html         ← On Deck — new releases accumulating scores
  howwescore.html     ← Methodology and credibility page

  /css
    styles.css        ← All styling
    themes.css        ← CSS custom properties (color, typography, spacing)

  /js
    scoring.js        ← Pure scoring math engine
    dataService.js    ← All data flows through here
    ui.js             ← DOM rendering and interactions
    router.js         ← URL parameter handling

  /data
    albums.json       ← Full album catalog
    scores.json       ← All scores (critic + crowd inputs)
    matrix.json       ← Ranking weights config
    debate.json       ← Current and past debate albums
    ondeck.json       ← Albums in 30-day evaluation window

  /api
    spotify.js        ← STUB: future Spotify API integration
    billboard.js      ← STUB: future Billboard API integration
    critics.js        ← STUB: future critic score aggregation
```

## Future Features (tracked as FUTURE.md)
See FUTURE.md for planned features including live Spotify integration,
Billboard API, Critic/Crowd Divide Leaderboard, Genre Health Index,
Hall of Fame, and more.
