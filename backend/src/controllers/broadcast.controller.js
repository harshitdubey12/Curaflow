import * as broadcastService from '../services/broadcast.service.js';

export async function postBroadcast(req, res) {
  try {
    const { message, messageHi } = req.body || {};
    const result = await broadcastService.sendBroadcastMessage(message, messageHi);
    return res.json({ ok: true, ...result });
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Broadcast failed' });
  }
}
