/* VAVH AI admin dashboard. Read-only analytics and recommendations. */
let vavhAiChart;

function vavhAiEscape(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function vavhAiRangeQuery() {
  const range = document.getElementById('vavh-ai-range')?.value || '30';
  if (range !== 'custom') return `range=${encodeURIComponent(range)}`;
  const from = document.getElementById('vavh-ai-from')?.value;
  const to = document.getElementById('vavh-ai-to')?.value;
  return `range=custom&from=${encodeURIComponent(from || '')}&to=${encodeURIComponent(to || '')}`;
}

async function renderVavhAiDashboard(container) {
  container.innerHTML = `
    <section class="glass-panel" style="padding:20px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;"><i class="fas fa-wand-magic-sparkles" style="color:#f59e0b;font-size:20px;"></i><h3 style="margin:0;font-size:1.35rem;">VAVH AI</h3></div>
          <p style="margin:7px 0 0;color:var(--text-muted-dark);">Read-only analysis of real sales and website behavior.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="vavh-ai-range" class="form-control" onchange="renderVavhAiDashboard(document.getElementById('mgmt-content'))">
            <option value="today">Today</option><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 3 months</option><option value="180">Last 6 months</option><option value="365">Last 12 months</option><option value="all">All time</option><option value="custom">Custom range</option>
          </select>
          <input id="vavh-ai-from" class="form-control" type="date" style="display:none;" onchange="renderVavhAiDashboard(document.getElementById('mgmt-content'))">
          <input id="vavh-ai-to" class="form-control" type="date" style="display:none;" onchange="renderVavhAiDashboard(document.getElementById('mgmt-content'))">
          <button class="btn btn-sec btn-sm" onclick="renderVavhAiDashboard(document.getElementById('mgmt-content'))"><i class="fas fa-sync"></i> Refresh</button>
        </div>
      </div>
    </section>
    <div id="vavh-ai-loading" style="padding:28px;color:var(--text-muted-dark);">Analyzing recorded data...</div>
  `;

  const rangeSelect = document.getElementById('vavh-ai-range');
  const fromInput = document.getElementById('vavh-ai-from');
  const toInput = document.getElementById('vavh-ai-to');
  const showCustom = rangeSelect?.value === 'custom';
  if (fromInput) fromInput.style.display = showCustom ? '' : 'none';
  if (toInput) toInput.style.display = showCustom ? '' : 'none';

  try {
    const response = await API.get('/ai/dashboard?' + vavhAiRangeQuery());
    if (!response?.success) throw new Error(response?.message || 'VAVH AI unavailable');
    const data = response.data;
    const actual = data.actualData || {};
    const currency = (value) => `BDT ${Number(value || 0).toLocaleString()}`;
    const cards = [
      ['Visitors', actual.visitors, 'fa-users', '#22c55e'],
      ['Product Views', actual.productViews, 'fa-eye', '#38bdf8'],
      ['Product Clicks', actual.productClicks, 'fa-arrow-pointer', '#f59e0b'],
      ['Orders', actual.orders, 'fa-shopping-bag', '#a78bfa'],
      ['Sales', currency(actual.revenue), 'fa-coins', '#34d399'],
      ['Trending Product', data.trending?.[0]?.name || 'No trend yet', 'fa-fire', '#fb7185'],
    ];
    const insightHtml = (data.insights || []).map((item) => `<div class="glass-panel" style="padding:14px;border-left:3px solid ${item.type === 'actual' ? '#38bdf8' : '#f59e0b'};"><strong>${vavhAiEscape(item.title)}</strong><p style="margin:6px 0 0;color:var(--text-muted-dark);">${vavhAiEscape(item.text)}</p><small style="color:${item.type === 'actual' ? '#38bdf8' : '#f59e0b'};">${item.type === 'actual' ? 'Actual data' : 'AI recommendation'}</small></div>`).join('');
    const trendRows = (data.trending || []).map((item) => `<tr><td>${vavhAiEscape(item.name)}</td><td>${vavhAiEscape(item.category)}</td><td>${item.views}</td><td>${item.clicks}</td><td>${item.cartAdds}</td><td>${item.quantity}</td><td>${item.conversionRate.toFixed(1)}%</td><td>${item.growthPercent === null ? 'New baseline' : `${item.growthPercent >= 0 ? '+' : ''}${item.growthPercent.toFixed(1)}%`}<br><strong>${item.trendScore}/100</strong> ${vavhAiEscape(item.trendDirection)}</td></tr>`).join('');
    const salesRows = (data.sales?.products || []).slice(0, 8).map((item) => `<tr><td>${vavhAiEscape(item.name)}</td><td>${item.quantity}</td><td>${currency(item.revenue)}</td></tr>`).join('');
    const relatedRows = (data.related || []).map((item) => `<tr><td>${vavhAiEscape(item.product)}</td><td>${vavhAiEscape(item.relatedProduct)}</td><td>${item.purchasesTogether}</td></tr>`).join('');

    container.innerHTML = `
      <div class="mgmt-stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:16px;">${cards.map(([label, value, icon, color]) => `<div class="mgmt-stat-card"><div class="mgmt-stat-icon" style="color:${color};background:${color}22"><i class="fas ${icon}"></i></div><div><h3 style="font-size:1.35rem;color:${color};">${vavhAiEscape(value)}</h3><p style="color:var(--text-muted-dark);">${label}</p></div></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:16px;margin-bottom:16px;">
        <div class="glass-panel" style="padding:18px;"><h4 style="margin:0 0 12px;">Sales over time <small style="font-weight:400;color:var(--text-muted-dark);">Actual data</small></h4><div style="height:260px;"><canvas id="vavh-ai-sales-chart"></canvas></div></div>
        <div class="glass-panel" style="padding:18px;"><h4 style="margin:0 0 12px;">AI Insights</h4><div style="display:grid;gap:10px;">${insightHtml || '<p style="color:var(--text-muted-dark);">More activity is needed before insights can be generated.</p>'}</div></div>
      </div>
      <div class="glass-panel" style="padding:18px;margin-bottom:16px;overflow:auto;"><h4 style="margin:0 0 12px;">Trending Products <small style="font-weight:400;color:var(--text-muted-dark);">Combined score: views, clicks, carts, sales</small></h4><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Views</th><th>Clicks</th><th>Carts</th><th>Sold</th><th>Conversion</th><th>Trend</th></tr></thead><tbody>${trendRows || '<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--text-muted-dark);">No product activity recorded yet.</td></tr>'}</tbody></table></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;"><div class="glass-panel" style="padding:18px;overflow:auto;"><h4 style="margin:0 0 12px;">Top products by sales <small style="font-weight:400;color:var(--text-muted-dark);">Actual data</small></h4><table class="data-table"><thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>${salesRows || '<tr><td colspan="3" style="text-align:center;padding:18px;">No sales recorded.</td></tr>'}</tbody></table></div><div class="glass-panel" style="padding:18px;overflow:auto;"><h4 style="margin:0 0 12px;">Related product opportunities</h4><table class="data-table"><thead><tr><th>Product</th><th>Often with</th><th>Orders</th></tr></thead><tbody>${relatedRows || '<tr><td colspan="3" style="text-align:center;padding:18px;">No co-purchase pattern yet.</td></tr>'}</tbody></table></div></div>
      <div class="glass-panel" style="padding:18px;margin-bottom:16px;"><h4 style="margin:0 0 12px;">Ask VAVH AI</h4><div style="display:flex;gap:8px;"><input id="vavh-ai-question" class="form-control" placeholder="Which product should we promote?"><button class="btn btn-primary" onclick="askVavhAi()"><i class="fas fa-paper-plane"></i></button></div><div id="vavh-ai-answer" style="margin-top:14px;color:var(--text-muted-dark);">Answers use actual database metrics. Recommendations are labeled separately.</div></div>
    `;
    drawVavhAiChart(data.sales?.daily || []);
  } catch (err) {
    container.innerHTML = `<div class="glass-panel" style="padding:24px;"><h3>VAVH AI is unavailable</h3><p style="color:var(--text-muted-dark);">${vavhAiEscape(err.message || 'Check the server and database connection.')}</p></div>`;
  }
}

function drawVavhAiChart(daily) {
  const canvas = document.getElementById('vavh-ai-sales-chart');
  if (!canvas || !window.Chart) return;
  if (vavhAiChart) vavhAiChart.destroy();
  vavhAiChart = new Chart(canvas, { type: 'line', data: { labels: daily.map((item) => item.day), datasets: [{ label: 'Revenue', data: daily.map((item) => Number(item.revenue || 0)), borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.16)', fill: true, tension: .3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
}

async function askVavhAi() {
  const input = document.getElementById('vavh-ai-question');
  const output = document.getElementById('vavh-ai-answer');
  if (!input || !output || !input.value.trim()) return;
  output.textContent = 'Checking actual data...';
  try {
    const result = await API.post('/ai/ask', { question: input.value.trim(), range: document.getElementById('vavh-ai-range')?.value || '30' });
    if (!result?.success || !result.data?.answer) {
      throw new Error(result?.message || 'Your admin session has expired. Please sign in again.');
    }
    output.innerHTML = `<strong>${vavhAiEscape(result.data.answer)}</strong><br><small>${vavhAiEscape(result.data.basis)}</small>`;
  } catch (err) {
    output.textContent = err.message || 'Unable to answer right now.';
  }
}
