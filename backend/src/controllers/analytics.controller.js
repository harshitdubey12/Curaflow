import * as analyticsService from '../services/analytics.service.js';

export async function getAnalytics(_req, res) {
  try {
    const data = await analyticsService.getAnalyticsSummary();
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Analytics failed' });
  }
}
