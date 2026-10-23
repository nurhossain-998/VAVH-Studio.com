function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function buildOverviewData({
  productCount = 0,
  revenueTotal = 0,
  profitTotal = 0,
  orderCount = 0,
  topProducts = [],
  topClicks = [],
  monthlyTrend = [],
  categoryPerformance = [],
}) {
  const totalRevenue = safeNumber(revenueTotal);
  const totalProfit = safeNumber(profitTotal);
  const totalOrders = safeNumber(orderCount);
  const bestSeller = topProducts[0] || null;
  const mostClicked = topClicks[0] || null;

  const trend = (monthlyTrend || []).map((row) => ({
    month: row.month || 'N/A',
    revenue: safeNumber(row.revenue),
  }));

  return {
    stats: {
      productCount: safeNumber(productCount),
      revenue: totalRevenue,
      profit: totalProfit,
      orders: totalOrders,
      bestSeller: bestSeller ? {
        name: bestSeller.name || 'N/A',
        revenue: safeNumber(bestSeller.revenue),
        sales: safeNumber(bestSeller.sales),
      } : null,
      mostClicked: mostClicked ? {
        name: mostClicked.name || 'N/A',
        clicks: safeNumber(mostClicked.clicks),
      } : null,
    },
    topProducts: (topProducts || []).map((item) => ({
      name: item.name || 'Unknown product',
      sales: safeNumber(item.sales),
      revenue: safeNumber(item.revenue),
    })),
    topClicks: (topClicks || []).map((item) => ({
      name: item.name || 'Unknown product',
      clicks: safeNumber(item.clicks),
    })),
    categories: (categoryPerformance || []).map((item) => ({
      name: item.name || 'General',
      revenue: safeNumber(item.revenue),
      orders: safeNumber(item.orders),
    })),
    trend,
    insights: buildInsights({
      revenue: totalRevenue,
      profit: totalProfit,
      bestSeller,
      mostClicked,
      categoryPerformance,
    }),
  };
}

function buildProfitLossData({ revenue = 0, cost = 0, expenses = 0 }) {
  const totalRevenue = safeNumber(revenue);
  const totalCost = safeNumber(cost) + safeNumber(expenses);
  const totalProfit = totalRevenue - totalCost;

  return {
    revenue: totalRevenue,
    cost: totalCost,
    profit: totalProfit,
    margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
  };
}

function buildInsights({ revenue = 0, profit = 0, bestSeller, mostClicked, categoryPerformance = [] }) {
  const items = [];

  if (bestSeller && bestSeller.name) {
    items.push(`Best-selling product is ${bestSeller.name} with ${safeNumber(bestSeller.sales)} sales.`);
  } else {
    items.push('No completed sales have been recorded yet.');
  }

  if (mostClicked && mostClicked.name) {
    items.push(`${mostClicked.name} is getting the most product clicks at ${safeNumber(mostClicked.clicks)} interactions.`);
  } else {
    items.push('No product click data is available yet.');
  }

  if (profit < 0) {
    items.push('The current profit is negative, so review costs and margins before increasing promotions.');
  } else if (revenue > 0) {
    items.push(`Current revenue is healthy, and estimated profit is ${profit.toFixed(2)}.`);
  }

  if (categoryPerformance && categoryPerformance.length > 0) {
    const leader = categoryPerformance[0];
    items.push(`${leader.name || 'Top category'} is leading revenue performance right now.`);
  }

  return items.slice(0, 4);
}

module.exports = {
  safeNumber,
  buildOverviewData,
  buildProfitLossData,
  buildInsights,
};
