// TODO: Aggregate critic scores
// NOTE: No public API exists for this. Options:
//   1. Manual entry — site owner updates scores.json directly (current approach)
//   2. Metacritic scraping — legal grey area, not recommended
//   3. Partnership with outlets for data feed — ideal long-term solution
// Current approach: all critic scores are manually maintained in /data/scores.json

async function getCriticScores(albumId) {
  // STUB — reads from local data, not a live API
  // This function exists so dataService.js doesn't need to change when live data arrives
  const scores = await fetch('/data/scores.json').then(r => r.json());
  return scores.scores[albumId]?.critic_inputs || null;
}

export { getCriticScores };
