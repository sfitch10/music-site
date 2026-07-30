// All DOM rendering and user interactions

import { setActiveNav, getAlbumIdFromUrl } from './router.js';
import {
  getAllTimeRankings, getScoredOnDeckAlbums,
  getCurrentDebate, getScoredAlbum, getMatrix,
  getVibeTap, setVibeTap, getDebateVote, setDebateVote, getDebateTallies,
  getScoresForAlbum, fetchAlbumArt
} from './dataService.js';

// ─── Art helpers ─────────────────────────────────────────────────────

function buildPlaceholder(album) {
  const div = document.createElement('div');
  div.className = 'album-art-placeholder';
  div.textContent = (album.title || 'A')[0].toUpperCase();
  return div;
}

function buildArtEl(album) {
  if (album.cover_art_url) {
    const img = document.createElement('img');
    img.alt = `${album.title} by ${album.artist}`;
    img.loading = 'lazy';
    img.onerror = () => { img.replaceWith(buildPlaceholder(album)); };
    img.src = album.cover_art_url;
    return img;
  }
  const placeholder = buildPlaceholder(album);
  fetchAlbumArt(album.artist, album.title).then(url => {
    if (!url) return;
    const img = document.createElement('img');
    img.alt = `${album.title} by ${album.artist}`;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    img.onload = () => { if (placeholder.parentNode) placeholder.replaceWith(img); };
    img.onerror = () => {};
    img.src = url;
  });
  return placeholder;
}

// ─── Score block (Fix 2 — unified display) ───────────────────────────
// All score surfaces use: emoji + combined number + tier label, then Stage | Crowd

function buildScoreBlock(album, size) {
  const tier = album.tier;
  const wrap = document.createElement('div');
  wrap.className = `score-block score-block--${size}`;

  const mainLine = document.createElement('div');
  mainLine.className = 'score-main-line';

  const emojiEl = document.createElement('span');
  emojiEl.className = 'score-tier-emoji';
  emojiEl.textContent = tier?.emoji ?? '';

  const numEl = document.createElement('span');
  numEl.className = 'score-main-num';
  numEl.textContent = album.combinedScore ?? '--';

  const labelEl = document.createElement('span');
  labelEl.className = 'score-tier-label';
  labelEl.textContent = tier?.label ?? '';

  mainLine.appendChild(emojiEl);
  mainLine.appendChild(numEl);
  mainLine.appendChild(labelEl);

  const subLine = document.createElement('div');
  subLine.className = 'score-sub-line';
  subLine.textContent = `Stage ${album.criticScore ?? '--'} | Crowd ${album.crowdScore ?? '--'}`;

  wrap.appendChild(mainLine);
  wrap.appendChild(subLine);

  observeCountUp(numEl, album.combinedScore);
  return wrap;
}

// ─── Badge helpers ────────────────────────────────────────────────────

function gapBadgeHTML(badge) {
  if (!badge) return '';
  return `<span class="gap-badge">${badge.emoji} ${badge.label}</span>`;
}

// ─── Animation helpers ────────────────────────────────────────────────

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
  if (target === null || target === undefined) { el.textContent = '--'; return; }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { countUp(el, target); observer.unobserve(el); }
    });
  }, { threshold: 0.3 });
  observer.observe(el);
}

function matchesQuery(album, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return album.title.toLowerCase().includes(q) || album.artist.toLowerCase().includes(q);
}

// ─── Inline search (Fix 5) ────────────────────────────────────────────

function initSearch() {
  const input = document.querySelector('.nav-search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    window.__searchFilter?.(input.value.trim().toLowerCase());
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; window.__searchFilter?.(''); }
  });
}

// ─── Hero card — index top-5 (Fixes 1, 2) ────────────────────────────

function buildHeroCard(album, rank) {
  const a = document.createElement('a');
  a.className = 'hero-card';
  a.href = `album.html?id=${encodeURIComponent(album.id)}`;

  const rankEl = document.createElement('div');
  rankEl.className = 'hero-card-rank';
  rankEl.textContent = `#${rank}`;

  const artEl = document.createElement('div');
  artEl.className = 'hero-card-art';
  artEl.appendChild(buildArtEl(album));

  // Format release date: "Released July 1"
  let releasedStr = '';
  if (album.release_date) {
    const d = new Date(album.release_date + 'T12:00:00');
    releasedStr = `Released ${d.toLocaleString('default', { month: 'long', day: 'numeric' })}`;
  }

  const info = document.createElement('div');
  info.className = 'hero-card-info';
  info.innerHTML = `
    <div class="hero-card-artist">${album.artist}</div>
    <div class="hero-card-title">${album.title}</div>
    ${releasedStr ? `<div class="hero-card-released">${releasedStr}</div>` : ''}
  `;

  const scoreBlock = buildScoreBlock(album, 'hero');

  a.appendChild(rankEl);
  a.appendChild(artEl);
  a.appendChild(info);
  a.appendChild(scoreBlock);
  return a;
}

// ─── Ranked list row — alltime + index section 2 (Fix 2) ─────────────

function buildRankedRow(album, rank) {
  const a = document.createElement('a');
  a.className = 'ranked-row';
  a.href = `album.html?id=${encodeURIComponent(album.id)}`;

  const rankEl = document.createElement('span');
  rankEl.className = 'ranked-row-rank';
  rankEl.textContent = rank;

  const thumb = document.createElement('div');
  thumb.className = 'ranked-row-art';
  thumb.appendChild(buildArtEl(album));

  const info = document.createElement('div');
  info.className = 'ranked-row-info';
  info.innerHTML = `
    <div class="ranked-row-artist">${album.artist}</div>
    <div class="ranked-row-title">${album.title}</div>
  `;

  const scoreBlock = buildScoreBlock(album, 'compact');

  a.appendChild(rankEl);
  a.appendChild(thumb);
  a.appendChild(info);
  a.appendChild(scoreBlock);
  return a;
}

function renderRankedList(container, albums) {
  container.innerHTML = '';
  if (albums.length === 0) {
    container.innerHTML = '<div class="empty-state">No albums found.</div>';
    return;
  }
  albums.forEach((album, i) => container.appendChild(buildRankedRow(album, i + 1)));
}

// ─── Index page (Fixes 1, 3) ─────────────────────────────────────────

async function initIndexPage() {
  setActiveNav();
  const recentSection = document.getElementById('recent-section');
  const yearSection = document.getElementById('year-section');
  if (!recentSection || !yearSection) return;

  recentSection.innerHTML = '<div class="loading">Loading</div>';

  try {
    const allAlbums = await getAllTimeRankings();

    // 5 most recently released scored albums, purely by release_date descending
    let recent = [...allAlbums]
      .filter(a => a.release_date)
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
      .slice(0, 5);

    // 2026 albums — strict number comparison
    let year2026 = allAlbums
      .filter(a => a.year === 2026)
      .sort((a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0));

    function renderSections(query) {
      recentSection.innerHTML = '';
      const filteredRecent = query ? recent.filter(a => matchesQuery(a, query)) : recent;
      if (filteredRecent.length === 0) {
        recentSection.innerHTML = `<div class="empty-state">${query ? 'No recent releases match.' : 'No recent albums found.'}</div>`;
      } else {
        filteredRecent.forEach((album, i) => recentSection.appendChild(buildHeroCard(album, i + 1)));
      }

      yearSection.innerHTML = '';
      const filtered2026 = query ? year2026.filter(a => matchesQuery(a, query)) : year2026;
      if (filtered2026.length === 0) {
        yearSection.innerHTML = `<div class="empty-state">${query ? 'No 2026 albums match.' : 'No 2026 albums scored yet.'}</div>`;
      } else {
        renderRankedList(yearSection, filtered2026);
      }
    }

    renderSections('');
    window.__searchFilter = renderSections;

  } catch (e) {
    recentSection.innerHTML = `<div class="empty-state">Failed to load albums. ${e.message}</div>`;
  }
}

// ─── All-Time page ────────────────────────────────────────────────────

async function initAlltimePage() {
  setActiveNav();
  const list = document.getElementById('ranked-list');
  if (!list) return;
  list.innerHTML = '<div class="loading">Loading rankings</div>';

  try {
    const allAlbums = await getAllTimeRankings();
    let activeYear = 'all';
    let activeQuery = '';

    function applyFilter() {
      const filtered = allAlbums.filter(a => {
        const yearMatch = activeYear === 'all' || a.year === Number(activeYear);
        return yearMatch && matchesQuery(a, activeQuery);
      });
      renderRankedList(list, filtered);
    }

    document.querySelectorAll('.year-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeYear = tab.dataset.year;
        applyFilter();
      });
    });

    applyFilter();
    window.__searchFilter = q => { activeQuery = q; applyFilter(); };

  } catch (e) {
    list.innerHTML = `<div class="empty-state">Failed to load rankings. ${e.message}</div>`;
  }
}

// ─── Album page (Fixes 2, 4) ──────────────────────────────────────────

async function initAlbumPage() {
  setActiveNav();
  const id = getAlbumIdFromUrl();
  if (!id) { document.title = 'Album Not Found'; return; }

  try {
    const album = await getScoredAlbum(id, 'monthly');
    if (!album) { document.title = 'Album Not Found'; return; }

    document.title = `${album.title} — ${album.artist}`;

    // Fix 4: hero background — cover_art_url OR iTunes fetch
    const heroBg = document.querySelector('.album-hero-bg');
    if (heroBg) {
      if (album.cover_art_url) {
        heroBg.style.backgroundImage = `url(${album.cover_art_url})`;
      } else {
        fetchAlbumArt(album.artist, album.title).then(url => {
          if (url) heroBg.style.backgroundImage = `url(${url})`;
        });
      }
    }

    const artEl = document.querySelector('.album-hero-art');
    if (artEl) artEl.appendChild(buildArtEl(album));

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

    // Fix 2: unified score display
    const tierEmojiEl = document.querySelector('.album-tier-emoji');
    if (tierEmojiEl) tierEmojiEl.textContent = album.tier?.emoji ?? '';

    const tierLabelEl = document.querySelector('.album-tier-label');
    if (tierLabelEl) tierLabelEl.textContent = album.tier?.label ?? '';

    const bigScore = document.querySelector('.score-big');
    if (bigScore) { bigScore.textContent = '0'; countUp(bigScore, album.combinedScore); }

    const criticScoreEl = document.querySelector('.critic-score-num');
    if (criticScoreEl) { criticScoreEl.textContent = '0'; countUp(criticScoreEl, album.criticScore); }

    const crowdScoreEl = document.querySelector('.crowd-score-num');
    if (crowdScoreEl) { crowdScoreEl.textContent = '0'; countUp(crowdScoreEl, album.crowdScore); }

    const gapEl = document.querySelector('.album-gap-badge');
    if (gapEl) gapEl.innerHTML = gapBadgeHTML(album.gapBadge);

    renderFrequencyMeter(album.combinedScore, album.tier);
    await renderCriticBreakdown(id, album);
    renderVibeTap(id);

    if (album.status === 'ondeck' && album.onDeckState) {
      const ondeckEl = document.querySelector('.ondeck-progress-section');
      if (ondeckEl) {
        ondeckEl.style.display = 'block';
        const stateEl = ondeckEl.querySelector('.ondeck-state-badge');
        if (stateEl) stateEl.textContent = `${album.onDeckState.emoji} ${album.onDeckState.label}`;
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
    certified_banger: 'var(--tier-banger)', absolute_slapper: 'var(--tier-slapper)',
    hard_rotation: 'var(--tier-rotation)', mid_season: 'var(--tier-mid)', deep_cut: 'var(--tier-deep)'
  };
  const color = tier ? (tierColors[tier.key] ?? 'var(--color-primary)') : 'var(--color-primary)';
  const heights = [0.5, 0.7, 1.0, 0.85, 0.6, 0.8, 0.45];
  bars.forEach((bar, i) => {
    bar.style.height = `${Math.round(heights[i] * (s / 100) * 40) + 4}px`;
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

  if (album.lowConfidence) {
    section.querySelector('.confidence-warning')?.style.removeProperty('display');
  }

  for (const [outlet, config] of Object.entries(matrix.critic_score.inputs)) {
    const raw = scores.critic_inputs[outlet];
    if (raw === null || raw === undefined) continue;
    let rawDisplay = raw, normalized = null;
    if (config.scale === '0-10') {
      normalized = Math.round((raw / 10) * 100); rawDisplay = raw + '/10';
    } else if (config.scale === '1-5 stars') {
      normalized = Math.round(((raw - 1) / 4) * 100); rawDisplay = '★'.repeat(Math.round(raw));
    } else if (config.scale === 'A-F letter') {
      const grades = { 'A+': 100, 'A': 96, 'A-': 92, 'B+': 88, 'B': 83, 'B-': 78, 'C+': 72, 'C': 67, 'C-': 62, 'D+': 58, 'D': 52, 'D-': 45, 'F': 30 };
      normalized = grades[String(raw).trim().toUpperCase()] ?? null; rawDisplay = raw;
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
      setTimeout(() => { row.querySelector('.outlet-norm-fill').style.width = `${normalized}%`; }, 100);
    }
  }
}

// ─── Vibe tap (Fix 6) ─────────────────────────────────────────────────

function seededCount(albumId) {
  let h = 0;
  for (const c of albumId) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return 1000 + (Math.abs(h) % 49001);
}

function ratingToTier(rating) {
  if (rating >= 5) return { emoji: '🔥', label: 'Certified Banger' };
  if (rating >= 4) return { emoji: '🤘', label: 'Absolute Slapper' };
  if (rating >= 3) return { emoji: '🎧', label: 'Hard Rotation' };
  if (rating >= 2) return { emoji: '😐', label: 'Mid Season' };
  return { emoji: '💀', label: 'Deep Cut' };
}

function renderVibeTap(albumId) {
  const section = document.querySelector('.vibe-tap-section');
  if (!section) return;
  const stars = section.querySelectorAll('.vibe-star');
  const confirmEl = section.querySelector('.vibe-confirmation');
  const existing = getVibeTap(albumId);
  const count = seededCount(albumId);

  function highlight(n) {
    stars.forEach((s, i) => s.classList.toggle('active', i < n));
  }

  function showConfirmation(rating) {
    if (!confirmEl) return;
    const tier = ratingToTier(rating);
    confirmEl.textContent = `Vibe logged ${tier.emoji}  You're in the crowd — ${count.toLocaleString()} others rated this ${tier.label}`;
    confirmEl.classList.add('visible');
  }

  if (existing) {
    highlight(existing);
    showConfirmation(existing);
  }

  stars.forEach((star, i) => {
    star.addEventListener('mouseenter', () => { if (!getVibeTap(albumId)) highlight(i + 1); });
    star.addEventListener('mouseleave', () => { if (!getVibeTap(albumId)) highlight(0); });
    star.addEventListener('click', () => {
      if (getVibeTap(albumId)) return;
      const rating = i + 1;
      setVibeTap(albumId, rating);
      highlight(rating);
      // Burst animation on selected stars
      stars.forEach((s, si) => {
        if (si < rating) {
          s.classList.add('burst');
          s.addEventListener('animationend', () => s.classList.remove('burst'), { once: true });
        }
      });
      showConfirmation(rating);
    });
  });
}

// ─── On Deck page ─────────────────────────────────────────────────────

function buildOnDeckCard(album, label, sublabel) {
  const card = document.createElement('a');
  card.className = 'ondeck-card';
  card.href = `album.html?id=${encodeURIComponent(album.id)}`;

  const artWrap = document.createElement('div');
  artWrap.className = 'album-card-art';
  artWrap.appendChild(buildArtEl(album));

  const body = document.createElement('div');
  body.style.padding = 'var(--space-md)';

  const stateHTML = album.onDeckState
    ? `<span class="ondeck-state-badge">${album.onDeckState.emoji} ${album.onDeckState.label}</span>`
    : '';

  const reviewsReviewed = album.outletsReviewed ?? 0;
  const reviewsTotal = album.outletsTotal ?? 7;

  body.innerHTML = `
    <div class="album-artist">${album.artist}</div>
    <div class="album-title">${album.title}</div>
    <div style="margin:6px 0 4px">${stateHTML}</div>
    <div class="ondeck-date-label">${label}</div>
    ${sublabel ? `<div class="confidence-info">${sublabel}</div>` : ''}
    ${reviewsReviewed > 0 ? `
      <div class="ondeck-progress" style="margin-top:8px">
        <div class="progress-bar-track"><div class="progress-bar-fill" style="width:${Math.min(100, (reviewsReviewed / reviewsTotal) * 100)}%"></div></div>
        <div class="progress-label">${reviewsReviewed} of ${reviewsTotal} outlets reviewed</div>
      </div>
    ` : `<div class="confidence-info" style="margin-top:6px">No reviews yet</div>`}
  `;

  card.appendChild(artWrap);
  card.appendChild(body);
  return card;
}

async function initOnDeckPage() {
  setActiveNav();
  const grid = document.querySelector('.ondeck-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading On Deck</div>';

  try {
    const albums = await getScoredOnDeckAlbums();
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 14);

    const comingSoon = albums
      .filter(a => a.release_date && new Date(a.release_date + 'T12:00:00') > today)
      .sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

    const justDropped = albums
      .filter(a => {
        if (!a.release_date) return false;
        const d = new Date(a.release_date + 'T12:00:00');
        return d <= today && d >= cutoff;
      })
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

    if (comingSoon.length === 0 && justDropped.length === 0) {
      grid.innerHTML = '<div class="empty-state">Nothing on deck right now.</div>';
      return;
    }

    grid.innerHTML = '';

    function addGroup(title, items, buildLabel) {
      if (items.length === 0) return;
      const heading = document.createElement('div');
      heading.className = 'ondeck-group-title';
      heading.textContent = title;
      grid.appendChild(heading);

      const group = document.createElement('div');
      group.className = 'ondeck-group-grid';
      items.forEach(album => {
        const { label, sublabel } = buildLabel(album);
        group.appendChild(buildOnDeckCard(album, label, sublabel));
      });
      grid.appendChild(group);
    }

    addGroup('Coming Soon', comingSoon, album => {
      const d = new Date(album.release_date + 'T12:00:00');
      return {
        label: `Releases ${d.toLocaleString('default', { month: 'long', day: 'numeric' })}`,
        sublabel: null
      };
    });

    addGroup('Just Dropped', justDropped, album => {
      const d = new Date(album.release_date + 'T12:00:00');
      const days = Math.floor((today - d) / (1000 * 60 * 60 * 24));
      return {
        label: days === 0 ? 'Released today' : days === 1 ? 'Released yesterday' : `Released ${days} days ago`,
        sublabel: null
      };
    });

    window.__searchFilter = q => {
      document.querySelectorAll('.ondeck-card').forEach(card => {
        card.style.display = (!q || card.textContent.toLowerCase().includes(q)) ? '' : 'none';
      });
    };

  } catch (e) {
    grid.innerHTML = `<div class="empty-state">Failed to load On Deck albums. ${e.message}</div>`;
  }
}

// ─── Debate page ──────────────────────────────────────────────────────

async function initDebatePage() {
  setActiveNav();
  try {
    const debateData = await getCurrentDebate();
    const current = debateData.current;
    const album = await getScoredAlbum(current.album_id, 'monthly');

    const artEl = document.querySelector('.debate-album-art');
    if (artEl && album) { artEl.innerHTML = ''; artEl.appendChild(buildArtEl(album)); }

    const metaEl = document.querySelector('.debate-album-meta');
    if (metaEl && album) {
      metaEl.querySelector('h2').textContent = album.title;
      metaEl.querySelector('p').textContent = album.artist;
    }

    const gapEl = document.querySelector('.debate-gap-display');
    if (gapEl && album) {
      gapEl.innerHTML = `Critics say <span class="score-highlight">${album.criticScore ?? '--'}</span>. The Crowd says <span class="score-highlight">${album.crowdScore ?? '--'}</span>. Someone's wrong.`;
    }

    document.querySelector('.stage-argument')?.insertAdjacentText('afterbegin', current.stage_argument);
    document.querySelector('.crowd-argument')?.insertAdjacentText('afterbegin', current.crowd_argument);

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
      voteBar.querySelector('.vote-bar-stage').style.width = `${stagePct}%`;
      voteBar.querySelector('.vote-bar-labels').innerHTML =
        `<span>🎙️ Stage ${stagePct}%</span><span>👥 Crowd ${100 - stagePct}%</span>`;
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

// ─── Nav toggle + search ──────────────────────────────────────────────

function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
  initSearch();
}

export {
  initIndexPage,
  initAlltimePage,
  initAlbumPage,
  initOnDeckPage,
  initDebatePage,
  initNavToggle
};
