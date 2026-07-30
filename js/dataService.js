// All data flows through here. The UI never reads JSON directly.
// TODAY: reads from /data/*.json
// FUTURE: calls /api/spotify.js, /api/billboard.js, /api/critics.js

import { scoreAlbum } from './scoring.js?v=5';

const BASE_PATH = '';

// iTunes artwork cache — avoids re-fetching for repeated renders
const _artCache = new Map();

async function fetchAlbumArt(artist, title) {
  const key = `${artist}__${title}`;
  if (_artCache.has(key)) return _artCache.get(key);
  try {
    const query = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&entity=album&limit=1`);
    const data = await res.json();
    const raw = data.results?.[0]?.artworkUrl100 ?? null;
    const url = raw ? raw.replace(/\d+x\d+bb/, '600x600bb') : null;
    _artCache.set(key, url);
    return url;
  } catch {
    _artCache.set(key, null);
    return null;
  }
}

async function _fetchJSON(path) {
  const res = await fetch(BASE_PATH + path + '?v=4', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}

async function getMatrix() {
  const data = await _fetchJSON('matrix.json');
  return data;
}

async function getAllAlbums() {
  const data = await _fetchJSON('albums.json');
  return data.albums;
}

async function getAlbumById(id) {
  const albums = await getAllAlbums();
  return albums.find(a => a.id === id) ?? null;
}

async function getScores() {
  const data = await _fetchJSON('scores.json');
  return data.scores;
}

async function getScoresForAlbum(id) {
  const scores = await getScores();
  return scores[id] ?? null;
}

async function getTopAlbumsByMonth(month, year, limit = 50) {
  const [albums, scores, matrix] = await Promise.all([getAllAlbums(), getScores(), getMatrix()]);
  const living = albums.filter(a => a.catalog_type === 'living' && a.status === 'scored');
  const scored = living.map(a => scoreAlbum(a, scores, matrix, 'monthly', getVibeTap(a.id)));
  scored.sort((a, b) => (b.combinedScore ?? -1) - (a.combinedScore ?? -1));
  return limit ? scored.slice(0, limit) : scored;
}

async function getAllTimeRankings(limit = 200) {
  const [albums, scores, matrix] = await Promise.all([getAllAlbums(), getScores(), getMatrix()]);
  const allAlbums = albums.filter(a => a.status === 'scored');
  const scored = allAlbums.map(a => scoreAlbum(a, scores, matrix, 'alltime', getVibeTap(a.id)));
  scored.sort((a, b) => (b.combinedScore ?? -1) - (a.combinedScore ?? -1));
  return limit ? scored.slice(0, limit) : scored;
}

async function getOnDeckAlbums() {
  const data = await _fetchJSON('ondeck.json');
  return data.ondeck;
}

async function getScoredOnDeckAlbums() {
  const [onDeckList, albums, scores, matrix] = await Promise.all([
    getOnDeckAlbums(), getAllAlbums(), getScores(), getMatrix()
  ]);
  return onDeckList.map(entry => {
    const album = albums.find(a => a.id === entry.album_id);
    if (!album) return null;
    const scored = scoreAlbum(album, scores, matrix, 'monthly', getVibeTap(album.id));
    return { ...scored, outletsReviewed: entry.outlets_reviewed, outletsTotal: entry.outlets_total };
  }).filter(Boolean);
}

async function getCurrentDebate() {
  const data = await _fetchJSON('debate.json');
  return data;
}

async function getPastDebates() {
  const data = await getCurrentDebate();
  return data.archive ?? [];
}

// Vibe tap — reads/writes to localStorage
function getVibeTap(albumId) {
  try {
    const stored = localStorage.getItem(`vibe_${albumId}`);
    return stored ? parseFloat(stored) : null;
  } catch { return null; }
}

function setVibeTap(albumId, rating) {
  try {
    localStorage.setItem(`vibe_${albumId}`, String(rating));
  } catch { /* storage unavailable */ }
}

// Debate vote — one per visitor per debate
function getDebateVote(weekOf) {
  try {
    return localStorage.getItem(`debate_vote_${weekOf}`) ?? null;
  } catch { return null; }
}

function setDebateVote(weekOf, side) {
  try {
    localStorage.setItem(`debate_vote_${weekOf}`, side);
    // Tally locally
    const stageKey = `debate_tally_stage_${weekOf}`;
    const crowdKey = `debate_tally_crowd_${weekOf}`;
    if (side === 'stage') {
      localStorage.setItem(stageKey, String((parseInt(localStorage.getItem(stageKey) ?? '0') + 1)));
    } else {
      localStorage.setItem(crowdKey, String((parseInt(localStorage.getItem(crowdKey) ?? '0') + 1)));
    }
  } catch { /* storage unavailable */ }
}

function getDebateTallies(weekOf, seedStage, seedCrowd) {
  try {
    const stage = parseInt(localStorage.getItem(`debate_tally_stage_${weekOf}`) ?? '0') + seedStage;
    const crowd = parseInt(localStorage.getItem(`debate_tally_crowd_${weekOf}`) ?? '0') + seedCrowd;
    return { stage, crowd };
  } catch { return { stage: seedStage, crowd: seedCrowd }; }
}

async function getScoredAlbum(id, rankingType = 'monthly') {
  const [album, scores, matrix] = await Promise.all([getAlbumById(id), getScores(), getMatrix()]);
  if (!album) return null;
  return scoreAlbum(album, scores, matrix, rankingType, getVibeTap(id));
}

async function getScoredCatalog(rankingType = 'monthly') {
  const [albums, scores, matrix] = await Promise.all([getAllAlbums(), getScores(), getMatrix()]);
  return albums.map(a => scoreAlbum(a, scores, matrix, rankingType, getVibeTap(a.id)));
}

export {
  fetchAlbumArt,
  getAllAlbums,
  getAlbumById,
  getScoresForAlbum,
  getMatrix,
  getTopAlbumsByMonth,
  getAllTimeRankings,
  getOnDeckAlbums,
  getScoredOnDeckAlbums,
  getCurrentDebate,
  getPastDebates,
  getVibeTap,
  setVibeTap,
  getDebateVote,
  setDebateVote,
  getDebateTallies,
  getScoredAlbum,
  getScoredCatalog
};
