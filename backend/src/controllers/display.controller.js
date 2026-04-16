import * as displayService from '../services/display.service.js';

export async function board(req, res) {
  try {
    const nextRaw = req.query?.nextCount;
    const nextCount = nextRaw != null ? Number(nextRaw) : undefined;
    const data = await displayService.getDisplayBoard(req.query?.doctorId, {
      nextCount: Number.isFinite(nextCount) ? nextCount : undefined,
      department: req.query?.department,
    });
    return res.json(data);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Display board failed' });
  }
}
