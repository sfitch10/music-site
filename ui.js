// All DOM rendering and user interactions

import { setActiveNav, getAlbumIdFromUrl } from './router.js';
import {
  getTopAlbumsByMonth, getAllTimeRankings, getScoredOnDeckAlbums,
  getCurrentDebate, getPastDebates, getScoredAlbum, getMatrix,
  getVibeTap, setVibeTap, getDebateVote, setDebateVote, getDebateTallies,
  getScoresForAlbum
} from './dataService.js';

// ─── Shared utilities ───────────────────────────────────────────────

function getArtPlaceholder(title) {
  const emoji = ['🎵', '🎸', '🎹', '🎺', '🥁', '🎤', '🎧', '🎼'];
  const idx = title.charCodeAt(0) % emoji.length;
  return emoji[idx];
}

function buildArtEl(album) {
  if (album.cover_art_url) {
    const img = document.createElement('img');
    img.src = album.cover_art_url;
    img.alt = `${album.title} by ${album.artist}`;
    img.loading = 'lazy';
    img.onerror = () => { img.replaceWith(buildPlaceholder(album)); };
    return img;
  }
  return buildPlaceholder(album);
}

function buildPlaceholder(album) {
  const div = document.createElement('div');
  div.className = 'album-art-placeholder';
  div.textContent = getArtPlaceholder(album.title);
  return div;
}

function tierBadgeHTML(tier) {
  if (!tier) return '';
  return `<span class="tier-badge ${tier.key}">${tier.emoji} ${tier.label}</span>`;
}

function gapBadgeHTML(badge) {
  if (!badge) return '';
  return `<span class="gap-badge">${badge.emoji} ${badge.label}</span>`;
}

function countUp(el, target, duration = 800) {
  if (target === null || target === undefined) { el.textContent = '--'; return; }
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    el.textContent = Math.round(eased * target);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function observeCountUp(el, target) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        countUp(el, target);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });
  observer.observe(el);
}

function staggerCards(cards) {
  cards.forEach((card, i) => {
    card.style.animationDelay = `${i * 50}ms`;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { card.classList.add('visible'); observer.unobserve(card); }
      });
    }, { threshold: 0.05 });
    observer.observe(card);
  });
}

// ─── Album card builder ─────────────────────────────────────────────

function buildAlbumCard(album, rank) {
  const a = document.createElement('a');
  a.className = 'album-card';
  a.href = `album.html?id=${encodeURIComponent(album.id)}`;

  const artWrap = document.createElement('div');
  artWrap.className = 'album-card-art';
  artWrap.appendChild(buildArtEl(album));

  const yearBadge = document.createElement('span');
  yearBadge.className = 'album-year-badge';
  yearBadge.textContent = album.year;
  artWrap.appendChild(yearBadge);

  if (rank !== undefined) {
    const rankEl = document.createElement('span');
    rankEl.className = 'album-rank';
    rankEl.textContent = `#${rank}`;
    artWrap.appendChild(rankEl);
  }

  const body = document.createElement('div');
  body.className = 'album-card-body';

  const artist = document.createElement('div');
  artist.className = 'album-artist';
  artist.textContent = album.artist;

  const title = document.createElement('div');
  title.className = 'album-title';
  title.textContent = album.title;

  const scoreEl = document.createElement('div');
  scoreEl.className = 'album-score-main';
  const scoreNum = document.createElement('span');
  scoreNum.className = 'score-number';
  scoreNum.textContent = album.combinedScore ?? '--';
  scoreEl.appendChild(scoreNum);

  const tierEl = document.createElement('div');
  tierEl.style.display = 'flex';
  tierEl.style.justifyContent = 'center';
  tierEl.innerHTML = tierBadgeHTML(album.tier);

  const subScores = document.createElement('div');
  subScores.className = 'sub-scores';
  subScores.innerHTML = `
    <div class="sub-score">
      <div class="sub-score-label">🎙️ The Stage</div>
      <div class="sub-score-value">${album.criticScore ?? '--'}</div>
      <div class="sub-score-tier">${album.criticTier?.label ?? ''}</div>
    </div>
    <div class="sub-score">
      <div class="sub-score-label">👥 The Crowd</div>
      <div class="sub-score-value">${album.crowdScore ?? '--'}</div>
      <div class="sub-score-tier">${album.crowdTier?.label ?? ''}</div>
    </div>
  `;

  const gapEl = document.createElement('div');
  gapEl.style.textAlign = 'center';
  gapEl.innerHTML = gapBadgeHTML(album.gapBadge);

  body.appendChild(artist);
  body.appendChild(title);
  body.appendChild(scoreEl);
  body.appendChild(tierEl);
  body.appendChild(subScores);
  if (album.gapBadge) body.appendChild(gapEl);

  a.appendChild(artWrap);
  a.appendChild(body);

  // Count-up animation
  observeCountUp(scoreNum, album.combinedScore);

  return a;
}

// ─── Filter/Sort bar ────────────────────────────────────────────────

function buildFilterBar(albums, onFilter) {
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;

  const genres = [...new Set(albums.flatMap(a => a.genre))].sort();
  let activeGenres = new Set();
  let activeSort = 'combined';

  const genreGroup = bar.querySelector('.genre-pills');
  if (genreGroup) {
    genres.forEach(g => {
      const btn = document.createElement('button');
      btn.className = 'filter-pill';
      btn.textContent = g;
      btn.addEventListener('click', () => {
        if (activeGenres.has(g)) { activeGenres.delete(g); btn.classList.remove('active'); }
        else { activeGenres.add(g); btn.classList.add('active'); }
        onFilter(activeGenres, activeSort);
      });
      genreGroup.appendChild(btn);
    });
  }

  const sortSelect = bar.querySelector('.sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      activeSort = e.target.value;
      onFilter(activeGenres, activeSort);
    });
  }
}

function filterAndSort(albums, genres, sortKey) {
  let result = [...albums];
  if (genres.size > 0) {
    result = result.filter(a => a.genre && a.genre.some(g => genres.has(g)));
  }
  result.sort((a, b) => {
    if (sortKey === 'critic') return (b.criticScore ?? -1) - (a.criticScore ?? -1);
    if (sortKey === 'crowd')  return (b.crowdScore  ?? -1) - (a.crowdScore  ?? -1);
    return (b.combinedScore ?? -1) - (a.combinedScore ?? -1);
  });
  return result;
}

function renderGrid(container, albums, showRank) {
  container.innerHTML = '';
  if (albums.length === 0) {
    container.innerHTML = '<div class="empty-state">No albums match this filter.</div>';
    return;
  }
  const cards = albums.map((album, i) => buildAlbumCard(album, showRank ? i + 1 : undefined));
  cards.forEach(c => container.appendChild(c));
  staggerCards(cards);
}

// ─── Index page ─────────────────────────────────────────────────────

async function initIndexPage() {
  setActiveNav();
  const grid = document.querySelector('.album-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">Loading setlist</div>';

  try {
    const now = new Date();
    const albums = await getTopAlbumsByMonth(now.getMonth() + 1, now.getFullYear());
    let current = [...albums];

    buildFilterBar(albums, (genres, sort) => {
      current = filterAndSort(albums, genres, sort);
      renderGrid(grid, current, false);
    });

    renderGrid(grid, current, false);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">Failed to load albums. ${e.message}</div>`;
  }
}

// ─── All-Time page ───────────────────────────────────────────────────

async function initAlltimePage() {
  setActiveNav();
  const grid = document.querySelector('.album-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">Loading rankings</div>';

  try {
    const albums = await getAllTimeRankings();
    let current = [...albums];

    buildFilterBar(albums, (genres, sort) => {
      current = filterAndSort(albums, genres, sort);
      renderGrid(grid, current, true);
    });

    renderGrid(grid, current, true);
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">Failed to load rankings. ${e.message}</div>`;
  }
}

// ─── Album page ──────────────────────────────────────────────────────

async function initAlbumPage() {
  setActiveNav();
  const id = getAlbumIdFromUrl();
  if (!id) { document.title = 'Album Not Found'; return; }

  try {
    const album = await getScoredAlbum(id, 'monthly');
    if (!album) { document.title = 'Album Not Found'; return; }

    document.title = `${album.title} — ${album.artist}`;

    // Hero background
    const heroBg = document.querySelector('.album-hero-bg');
    if (heroBg && album.cover_art_url) {
      heroBg.style.backgroundImage = `url(${album.cover_art_url})`;
    }

    // Art
    const artEl = document.querySelector('.album-hero-art');
    if (artEl) artEl.appendChild(buildArtEl(album));

    // Info
    const artistEl = document.querySelector('.album-hero-artist');
    if (artistEl) artistEl.textContent = album.artist;

    const titleEl = document.querySelector('.album-hero-title');
    if (titleEl) titleEl.textContent = album.title;

    const tagsEl = document.querySelector('.album-genre-tags');
    if (tagsEl && album.genre) {
      album.genre.forEach(g => {
        const span = document.createElement('span');
        span.className = 'genre-tag';
        span.textContent = g;
        tagsEl.appendChild(span);
      });
    }

    // Score display
    const tierEl = document.querySelector('.album-combined-score .tier-badge-slot');
    if (tierEl) tierEl.innerHTML = tierBadgeHTML(album.tier);

    const bigScore = document.querySelector('.score-big');
    if (bigScore) { bigScore.textContent = '0'; countUp(bigScore, album.combinedScore); }

    const criticScoreEl = document.querySelector('.critic-score-num');
    if (criticScoreEl) { criticScoreEl.textContent = '0'; countUp(criticScoreEl, album.criticScore); }

    const crowdScoreEl = document.querySelector('.crowd-score-num');
    if (crowdScoreEl) { crowdScoreEl.textContent = '0'; countUp(crowdScoreEl, album.crowdScore); }

    const criticTierEl = document.querySelector('.critic-tier-label');
    if (criticTierEl) criticTierEl.textContent = album.criticTier?.label ?? '';

    const crowdTierEl = document.querySelector('.crowd-tier-label');
    if (crowdTierEl) crowdTierEl.textContent = album.crowdTier?.label ?? '';

    const gapEl = document.querySelector('.album-gap-badge');
    if (gapEl) gapEl.innerHTML = gapBadgeHTML(album.gapBadge);

    // Frequency meter
    renderFrequencyMeter(album.combinedScore, album.tier);

    // Critic breakdown
    await renderCriticBreakdown(id, album);

    // Vibe tap
    renderVibeTap(id);

    // On Deck state
    if (album.status === 'ondeck' && album.onDeckState) {
      const ondeckEl = document.querySelector('.ondeck-progress-section');
      if (ondeckEl) {
        ondeckEl.style.display = 'block';
        const stateEl = ondeckEl.querySelector('.ondeck-state-badge');
        if (stateEl) stateEl.innerHTML = `${album.onDeckState.emoji} ${album.onDeckState.label}`;
        const fill = ondeckEl.querySelector('.progress-bar-fill');
        if (fill) fill.style.width = `${Math.min(100, (album.onDeckState.daysSince / 30) * 100)}%`;
        const label = ondeckEl.querySelector('.progress-label');
        if (label) label.textContent = `Day ${album.onDeckState.daysSince} of 30`;
      }
    }

  } catch (e) {
    console.error(e);
    document.querySelector('.album-hero-content')?.insertAdjacentHTML('beforeend',
      `<div class="empty-state">Failed to load album data.</div>`);
  }
}

function renderFrequencyMeter(score, tier) {
  const meter = document.querySelector('.frequency-meter');
  if (!meter) return;

  const bars = meter.querySelectorAll('.freq-bar');
  const s = score ?? 0;
  const tierColors = {
    certified_banger: 'var(--tier-banger)',
    absolute_slapper: 'var(--tier-slapper)',
    hard_rotation:    'var(--tier-rotation)',
    mid_season:       'var(--tier-mid)',
    deep_cut:         'var(--tier-deep)'
  };
  const color = tier ? (tierColors[tier.key] ?? 'var(--color-primary)') : 'var(--color-primary)';

  const heights = [0.5, 0.7, 1.0, 0.85, 0.6, 0.8, 0.45];
  bars.forEach((bar, i) => {
    const h = Math.round(heights[i] * (s / 100) * 40) + 4;
    bar.style.height = `${h}px`;
    bar.style.background = color;
  });
}

async function renderCriticBreakdown(id, album) {
  const section = document.querySelector('.critic-breakdown');
  if (!section) return;

  const matrix = await getMatrix();
  const scores = await getScoresForAlbum(id);
  const list = section.querySelector('.outlet-list-items');
  if (!list || !scores) return;

  const outlets = matrix.critic_score.inputs;

  if (album.lowConfidence) {
    section.querySelector('.confidence-warning')?.style.removeProperty('display');
  }

  for (const [outlet, config] of Object.entries(outlets)) {
    const raw = scores.critic_inputs[outlet];
    if (raw === null || raw === undefined) continue;

    let rawDisplay = raw;
    let normalized = null;

    if (config.scale === '0-10') {
      normalized = Math.round((raw / 10) * 100);
      rawDisplay = raw + '/10';
    } else if (config.scale === '1-5 stars') {
      normalized = Math.round(((raw - 1) / 4) * 100);
      rawDisplay = '★'.repeat(Math.round(raw));
    } else if (config.scale === 'A-F letter') {
      const grades = { 'A+': 100, 'A': 96, 'A-': 92, 'B+': 88, 'B': 83, 'B-': 78, 'C+': 72, 'C': 67, 'C-': 62, 'D+': 58, 'D': 52, 'D-': 45, 'F': 30 };
      normalized = grades[String(raw).trim().toUpperCase()] ?? null;
      rawDisplay = raw;
    }

    const row = document.createElement('div');
    row.className = 'outlet-row';
    row.innerHTML = `
      <span class="outlet-name">${outlet.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
      <span class="outlet-raw-score">${rawDisplay}</span>
      <div class="outlet-norm-bar"><div class="outlet-norm-fill" style="width:0%"></div></div>
      <span class="outlet-norm-score">${normalized ?? '--'}</span>
    `;
    list.appendChild(row);

    if (normalized !== null) {
      setTimeout(() => {
        row.querySelector('.outlet-norm-fill').style.width = `${normalized}%`;
      }, 100);
    }
  }
}

function renderVibeTap(albumId) {
  const section = document.querySelector('.vibe-tap-section');
  if (!section) return;

  const stars = section.querySelectorAll('.vibe-star');
  const avgEl = section.querySelector('.vibe-tap-avg');
  const existing = getVibeTap(albumId);

  function highlight(n) {
    stars.forEach((s, i) => s.classList.toggle('active', i < n));
  }

  if (existing) highlight(existing);

  stars.forEach((star, i) => {
    star.addEventListener('mouseenter', () => highlight(i + 1));
    star.addEventListener('mouseleave', () => highlight(existing ?? 0));
    star.addEventListener('click', () => {
      const rating = i + 1;
      setVibeTap(albumId, rating);
      highlight(rating);
      if (avgEl) avgEl.textContent = `Your vibe: ${rating}/5 — saved`;
    });
  });

  if (avgEl && existing) avgEl.textContent = `Your vibe: ${existing}/5 — saved`;
}

// ─── On Deck page ────────────────────────────────────────────────────

async function initOnDeckPage() {
  setActiveNav();
  const grid = document.querySelector('.ondeck-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">Loading On Deck</div>';

  try {
    const albums = await getScoredOnDeckAlbums();

    if (albums.length === 0) {
      grid.innerHTML = '<div class="empty-state">No albums currently On Deck.</div>';
      return;
    }

    grid.innerHTML = '';
    albums.forEach(album => {
      const daysSince = album.onDeckState?.daysSince ?? 0;
      const progress = Math.min(100, (daysSince / 30) * 100);

      const card = document.createElement('a');
      card.className = 'ondeck-card';
      card.href = `album.html?id=${encodeURIComponent(album.id)}`;

      const artWrap = document.createElement('div');
      artWrap.className = 'album-card-art';
      artWrap.appendChild(buildArtEl(album));

      const body = document.createElement('div');
      body.style.padding = 'var(--space-md)';
      body.innerHTML = `
        <div class="album-artist">${album.artist}</div>
        <div class="album-title">${album.title}</div>
        <div style="margin:8px 0">
          <span class="ondeck-state-badge">${album.onDeckState?.emoji ?? '📡'} ${album.onDeckState?.label ?? 'Early Signal'}</span>
        </div>
        <div class="ondeck-progress">
          <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
          <div class="progress-label">Day ${daysSince} of 30</div>
        </div>
        <div class="confidence-info">${album.outletsReviewed ?? album.reviewCount} of ${album.outletsTotal ?? 7} outlets reviewed</div>
        ${album.criticScore !== null ? `<div style="margin-top:8px;font-family:var(--font-mono);font-size:0.75rem;color:var(--color-text-secondary)">🎙️ Stage: ${album.criticScore}</div>` : ''}
        ${album.crowdScore !== null ? `<div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--color-text-secondary)">👥 Crowd: ${album.crowdScore}</div>` : ''}
      `;

      card.appendChild(artWrap);
      card.appendChild(body);
      grid.appendChild(card);
    });

  } catch (e) {
    grid.innerHTML = `<div class="empty-state">Failed to load On Deck albums. ${e.message}</div>`;
  }
}

// ─── Debate page ─────────────────────────────────────────────────────

async function initDebatePage() {
  setActiveNav();

  try {
    const debateData = await getCurrentDebate();
    const current = debateData.current;
    const album = await getScoredAlbum(current.album_id, 'monthly');

    // Album info
    const artEl = document.querySelector('.debate-album-art');
    if (artEl && album) artEl.appendChild(buildArtEl(album));

    const metaEl = document.querySelector('.debate-album-meta');
    if (metaEl && album) {
      metaEl.querySelector('h2').textContent = album.title;
      metaEl.querySelector('p').textContent = album.artist;
    }

    // Gap display
    const gapEl = document.querySelector('.debate-gap-display');
    if (gapEl && album) {
      gapEl.innerHTML = `Critics say <span class="score-highlight">${album.criticScore ?? '--'}</span>. The Crowd says <span class="score-highlight">${album.crowdScore ?? '--'}</span>. Someone's wrong.`;
    }

    // Arguments
    document.querySelector('.stage-argument')?.insertAdjacentText('afterbegin', current.stage_argument);
    document.querySelector('.crowd-argument')?.insertAdjacentText('afterbegin', current.crowd_argument);

    // Voting
    const weekOf = current.week_of;
    const existingVote = getDebateVote(weekOf);
    const tallies = getDebateTallies(weekOf, current.votes.stage, current.votes.crowd);

    const stageBtn = document.querySelector('.vote-btn.stage');
    const crowdBtn = document.querySelector('.vote-btn.crowd');
    const voteBar = document.querySelector('.vote-bar-container');

    function showVoteBar(t) {
      if (!voteBar) return;
      voteBar.classList.add('visible');
      const total = t.stage + t.crowd;
      const stagePct = total > 0 ? Math.round((t.stage / total) * 100) : 50;
      const crowdPct = 100 - stagePct;
      voteBar.querySelector('.vote-bar-stage').style.width = `${stagePct}%`;
      voteBar.querySelector('.vote-bar-labels').innerHTML =
        `<span>🎙️ Stage ${stagePct}%</span><span>👥 Crowd ${crowdPct}%</span>`;
    }

    if (existingVote) {
      stageBtn?.classList.toggle('voted', existingVote === 'stage');
      crowdBtn?.classList.toggle('voted', existingVote === 'crowd');
      showVoteBar(tallies);
    }

    stageBtn?.addEventListener('click', () => {
      if (getDebateVote(weekOf)) return;
      setDebateVote(weekOf, 'stage');
      stageBtn.classList.add('voted');
      showVoteBar(getDebateTallies(weekOf, current.votes.stage, current.votes.crowd));
    });

    crowdBtn?.addEventListener('click', () => {
      if (getDebateVote(weekOf)) return;
      setDebateVote(weekOf, 'crowd');
      crowdBtn.classList.add('voted');
      showVoteBar(getDebateTallies(weekOf, current.votes.stage, current.votes.crowd));
    });

    // Archive
    const archiveGrid = document.querySelector('.archive-grid');
    const archive = debateData.archive ?? [];
    if (archiveGrid && archive.length > 0) {
      for (const item of archive) {
        const past = await getScoredAlbum(item.album_id, 'monthly');
        if (!past) continue;
        const card = document.createElement('div');
        card.className = 'archive-card';
        const diff = past.criticScore !== null && past.crowdScore !== null
          ? Math.abs(past.criticScore - past.crowdScore) : null;
        card.innerHTML = `
          <div class="archive-card-artist">${past.artist}</div>
          <div class="archive-card-title">${past.title}</div>
          ${diff !== null ? `<div class="archive-card-gap">Gap: ${diff} points</div>` : ''}
          <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:4px">${item.week_of}</div>
        `;
        archiveGrid.appendChild(card);
      }
    }

  } catch (e) {
    console.error(e);
  }
}

// ─── Nav toggle ──────────────────────────────────────────────────────

function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

export {
  initIndexPage,
  initAlltimePage,
  initAlbumPage,
  initOnDeckPage,
  initDebatePage,
  initNavToggle
};
