// Pure scoring math engine. No DOM access. No data fetching.
// Takes numbers in, returns numbers out.

const LETTER_GRADE_MAP = { 'A+': 100, 'A': 96, 'A-': 92, 'B+': 88, 'B': 83, 'B-': 78, 'C+': 72, 'C': 67, 'C-': 62, 'D+': 58, 'D': 52, 'D-': 45, 'F': 30 };

// Outlet baseline corrections — adjusts for outlets that score systematically high or low
const BASELINE_OFFSETS = {
  pitchfork: -3,
  rolling_stone: 2,
  nme: 3,
  allmusic: 0,
  the_guardian: 2,
  paste_magazine: -1,
  consequence_of_sound: 0
};

function normalizeOutletScore(score, scale) {
  if (score === null || score === undefined) return null;

  if (scale === '0-10') {
    return Math.min(100, Math.max(0, (score / 10) * 100));
  }
  if (scale === '1-5 stars') {
    return Math.min(100, Math.max(0, ((score - 1) / 4) * 100));
  }
  if (scale === 'A-F letter') {
    const key = String(score).trim().toUpperCase();
    return LETTER_GRADE_MAP[key] ?? null;
  }
  return null;
}

function applyBaselineCorrection(normalizedScore, outletName, baselineOffsets) {
  if (normalizedScore === null) return null;
  const offset = baselineOffsets[outletName] ?? 0;
  return Math.min(100, Math.max(0, normalizedScore + offset));
}

function calculateCriticScore(outletScores, matrixConfig) {
  const inputs = matrixConfig.critic_score.inputs;
  const minOutlets = matrixConfig.critic_score.normalization.minimum_outlets_required;

  let totalWeight = 0;
  let weightedSum = 0;
  let reviewCount = 0;

  for (const [outlet, config] of Object.entries(inputs)) {
    const rawScore = outletScores[outlet];
    if (rawScore === null || rawScore === undefined) continue;

    const normalized = normalizeOutletScore(rawScore, config.scale);
    if (normalized === null) continue;

    const corrected = applyBaselineCorrection(normalized, outlet, BASELINE_OFFSETS);
    if (corrected === null) continue;

    totalWeight += config.weight;
    weightedSum += corrected * config.weight;
    reviewCount++;
  }

  if (reviewCount < minOutlets) {
    return { score: totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null, lowConfidence: true, reviewCount };
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  return { score, lowConfidence: false, reviewCount };
}

function normalizeStreamingData(rawStreams, releaseDate, catalogSize) {
  // With live data: apply time decay and catalog size normalization
  // Currently passed through as a pre-normalized 0-100 value
  if (rawStreams === null || rawStreams === undefined) return null;
  return Math.min(100, Math.max(0, rawStreams));
}

function calculateCrowdScore(crowdInputs, matrixConfig, vibeTapOverride) {
  const weights = matrixConfig.crowd_score.inputs;

  let totalWeight = 0;
  let weightedSum = 0;

  const streaming = normalizeStreamingData(crowdInputs.streaming_data, null, null);
  if (streaming !== null) {
    totalWeight += weights.streaming_data.weight;
    weightedSum += streaming * weights.streaming_data.weight;
  }

  const chartScore = crowdInputs.sales_chart_performance;
  if (chartScore !== null && chartScore !== undefined) {
    totalWeight += weights.sales_chart_performance.weight;
    weightedSum += Math.min(100, Math.max(0, chartScore)) * weights.sales_chart_performance.weight;
  }

  // Use override (from localStorage) if available, else fall back to stored value
  const vibeTap = vibeTapOverride ?? crowdInputs.onsite_vibe_tap;
  if (vibeTap !== null && vibeTap !== undefined) {
    // Convert 1-5 scale to 0-100
    const normalizedVibe = ((vibeTap - 1) / 4) * 100;
    totalWeight += weights.onsite_vibe_tap.weight;
    weightedSum += Math.min(100, Math.max(0, normalizedVibe)) * weights.onsite_vibe_tap.weight;
  }

  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

function calculateCombinedScore(criticScore, crowdScore, rankingType, matrixConfig) {
  const weights = rankingType === 'alltime'
    ? matrixConfig.combined_score.alltime_rankings
    : matrixConfig.combined_score.monthly_rankings;

  if (criticScore === null && crowdScore === null) return null;
  if (criticScore === null) return crowdScore;
  if (crowdScore === null) return criticScore;

  return Math.round(criticScore * weights.critic_weight + crowdScore * weights.crowd_weight);
}

function getTier(score, thresholds) {
  if (score === null || score === undefined) return null;
  for (const [key, config] of Object.entries(thresholds)) {
    if (score >= config.min && score <= config.max) {
      return { key, emoji: config.emoji, label: config.label };
    }
  }
  return null;
}

function getGapBadge(criticScore, crowdScore, gapBadgeConfig) {
  if (criticScore === null || crowdScore === null) return null;
  const diff = crowdScore - criticScore;
  const absDiff = Math.abs(diff);

  if (diff >= 15) return gapBadgeConfig.peoples_champion;
  if (diff <= -15) return gapBadgeConfig.critics_darling;
  if (absDiff <= 5) return gapBadgeConfig.unanimous;
  return null;
}

function getOnDeckState(releaseDate, onDeckConfig) {
  if (!releaseDate) return null;
  const release = new Date(releaseDate);
  const now = new Date();
  const daysSince = Math.floor((now - release) / (1000 * 60 * 60 * 24));

  if (daysSince <= 2)  return { ...onDeckConfig.early_signal, daysSince };
  if (daysSince <= 7)  return { ...onDeckConfig.taking_shape, daysSince };
  if (daysSince <= 29) return { ...onDeckConfig.almost_locked, daysSince };
  return { ...onDeckConfig.score_locked, daysSince };
}

function scoreAlbum(album, scores, matrixConfig, rankingType, vibeTapOverride) {
  const albumScores = scores[album.id];
  if (!albumScores) {
    return { ...album, criticScore: null, crowdScore: null, combinedScore: null, tier: null, criticTier: null, crowdTier: null, gapBadge: null, lowConfidence: true, reviewCount: 0 };
  }

  const criticResult = calculateCriticScore(albumScores.critic_inputs, matrixConfig);
  const crowdScore = calculateCrowdScore(albumScores.crowd_inputs, matrixConfig, vibeTapOverride);
  const combinedScore = calculateCombinedScore(criticResult.score, crowdScore, rankingType, matrixConfig);

  const tier = getTier(combinedScore, matrixConfig.tier_thresholds);
  const criticTier = getTier(criticResult.score, matrixConfig.critic_tier_thresholds);
  const crowdTier = getTier(crowdScore, matrixConfig.crowd_tier_thresholds);
  const gapBadge = getGapBadge(criticResult.score, crowdScore, matrixConfig.gap_badges);

  const onDeckState = album.status === 'ondeck'
    ? getOnDeckState(album.release_date, matrixConfig.ondeck_states)
    : null;

  return {
    ...album,
    criticScore: criticResult.score,
    crowdScore,
    combinedScore,
    tier,
    criticTier,
    crowdTier,
    gapBadge,
    lowConfidence: criticResult.lowConfidence,
    reviewCount: criticResult.reviewCount,
    onDeckState,
    rawScores: albumScores
  };
}

export {
  normalizeOutletScore,
  applyBaselineCorrection,
  calculateCriticScore,
  normalizeStreamingData,
  calculateCrowdScore,
  calculateCombinedScore,
  getTier,
  getGapBadge,
  getOnDeckState,
  scoreAlbum
};
