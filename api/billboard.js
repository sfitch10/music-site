// TODO: Connect to Billboard API or MRC Data
// NOTE: Billboard API is not free. Budget required. Contact: billboard.com/business
// Alternative: manual weekly update of chart data in /data/scores.json
// Data needed: peak chart position, weeks on chart, chart name (Hot 200, etc.)
// Normalization formula (example):
//   peak_score = (201 - peak_position) / 200 * 100   → #1 = 100, #200 = 0.5
//   weeks_score = Math.min(weeks_on_chart / 52, 1) * 100
//   sales_chart_performance = (peak_score * 0.6) + (weeks_score * 0.4)

async function getChartData(albumTitle, artistName) {
  // STUB
  return {
    peak_position: null,
    weeks_on_chart: null,
    chart_name: null,
    source: "stub"
  };
}

export { getChartData };
