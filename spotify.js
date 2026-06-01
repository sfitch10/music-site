// TODO: Connect to Spotify Web API
// Endpoint needed: Get Album (https://api.spotify.com/v1/albums/{id})
// Data needed: popularity score, total streams (via third-party or Spotify for Artists)
// Auth needed: Client Credentials flow (no user login required)
// Normalization: apply normalizeStreamingData() from scoring.js
// Steps to implement:
//   1. Register app at developer.spotify.com
//   2. Get Client ID and Client Secret
//   3. Exchange for access token via POST to https://accounts.spotify.com/api/token
//   4. Call GET https://api.spotify.com/v1/albums/{id} with Authorization: Bearer <token>
//   5. Map response.popularity (0-100) to streaming_data field in scores.json

async function getStreamingData(albumSpotifyId) {
  // STUB — returns placeholder data
  // Replace this entire function body when wiring live API
  return {
    streams_total: null,
    popularity: null,
    release_date: null,
    source: "stub"
  };
}

export { getStreamingData };
