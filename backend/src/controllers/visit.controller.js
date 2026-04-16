import * as paymentService from '../services/payment.service.js';
import * as doctorService from '../services/doctor.service.js';
import * as queueService from '../services/queue.service.js';
import { getIo } from '../socket.js';

export async function updatePayment(req, res) {
  try {
    const visitId = String(req.params.id || '').trim();
    const { paymentStatus, amount, doctorId: doctorIdIn } = req.body || {};
    let doctorResolved;
    if (doctorIdIn != null && String(doctorIdIn).trim() !== '') {
      doctorResolved = await doctorService.resolveDoctorId(doctorIdIn);
    }
    const out = await paymentService.updateVisitPayment({
      visitId,
      doctorId: doctorResolved,
      paymentStatus,
      amount,
    });
    const io = getIo();
    if (io) await queueService.broadcastQueue(io);
    return res.json({
      id: out.id,
      paymentStatus: out.paymentStatus,
      amount: out.amount,
    });
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Payment update failed' });
  }
}
