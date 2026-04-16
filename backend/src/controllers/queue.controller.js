import * as queueService from '../services/queue.service.js';
import { normalizePhoneForStorage } from '../services/twilio.service.js';
import { translateMessage } from '../services/translation.service.js';
import { getIo } from '../socket.js';

function doctorIdFromRequest(req) {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (b.doctorId != null && String(b.doctorId).trim() !== '') return String(b.doctorId).trim();
  if (req.query?.doctorId != null && String(req.query.doctorId).trim() !== '') return String(req.query.doctorId).trim();
  return undefined;
}

function departmentFromRequest(req) {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  if (b.department != null && String(b.department).trim() !== '') return String(b.department).trim();
  if (req.query?.department != null && String(req.query.department).trim() !== '') return String(req.query.department).trim();
  return undefined;
}

export async function snapshot(req, res) {
  try {
    const snap = await queueService.getQueueSnapshot(doctorIdFromRequest(req), {
      department: req.query?.department,
    });
    return res.json(snap);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'snapshot failed' });
  }
}

/** GET /queue — same payload as snapshot; optional ?doctorId= */
export async function getQueue(req, res) {
  return snapshot(req, res);
}

export async function statusByPhone(req, res) {
  try {
    const raw = decodeURIComponent(req.params.phone || '');
    if (!raw) {
      return res.status(400).json({ error: 'phone required' });
    }

    const phone = normalizePhoneForStorage(raw);
    const pos = await queueService.getPositionByPhone(phone);
    if (!pos) {
      return res.status(404).json({ error: 'No active queue entry for this phone' });
    }

    const docSnap = await queueService.getQueueSnapshot(pos.queueEntry.doctorId);

    return res.json({
      tokenNumber: pos.queueEntry.tokenNumber,
      queueEntryId: pos.queueEntry.id,
      patientId: pos.patient.id,
      position: pos.position,
      ahead: pos.ahead,
      estimatedWaitMinutes: pos.estimatedWaitMinutes,
      currentRunningToken: docSnap.currentToken,
      status: pos.queueEntry.status,
      doctorId: pos.queueEntry.doctorId,
      department: pos.queueEntry.department ?? 'general',
      appointmentTime: pos.queueEntry.appointmentTime
        ? pos.queueEntry.appointmentTime.toISOString()
        : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Status failed' });
  }
}

export async function nextPatient(req, res) {
  try {
    const io = getIo();
    const out = await queueService.advanceQueue(io, doctorIdFromRequest(req), {
      department: departmentFromRequest(req),
    });
    return res.json(out);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'next failed' });
  }
}

export async function skipPatient(req, res) {
  try {
    const io = getIo();
    const out = await queueService.skipCurrent(io, doctorIdFromRequest(req), {
      department: departmentFromRequest(req),
    });
    return res.json(out);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'skip failed' });
  }
}

export async function updatePriority(req, res) {
  try {
    const { queueEntryId, priority, doctorId } = req.body || {};
    const io = getIo();
    const out = await queueService.updateWaitingPriority(io, {
      queueEntryId,
      doctorId,
      priority,
    });
    return res.json(out);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Priority update failed' });
  }
}

export async function cancelQueue(req, res) {
  try {
    const io = getIo();
    const { phone, doctorId } = req.body || {};
    const out = await queueService.cancelQueueByPhone(io, { phone, doctorId });
    return res.json(out);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Cancel failed' });
  }
}

export async function rescheduleQueue(req, res) {
  try {
    const io = getIo();
    const { phone, doctorId, appointmentTime } = req.body || {};
    const out = await queueService.rescheduleQueueByPhone(io, { phone, doctorId, appointmentTime });
    return res.json(out);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 403) return res.status(403).json({ error: e.message });
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Reschedule failed' });
  }
}

export async function addToQueue(req, res) {
  try {
    const { name, phone, priority, doctorId, type, appointmentTime, language, department } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }
    const result = await queueService.addToQueue({
      name: String(name).trim(),
      phone: normalizePhoneForStorage(String(phone)),
      symptoms: req.body?.symptoms != null ? String(req.body.symptoms) : undefined,
      doctorId,
      priority,
      type,
      appointmentTime,
      language,
      department: department != null ? String(department).trim() : undefined,
    });
    const io = getIo();
    if (io) await queueService.broadcastQueue(io);
    return res.status(201).json({
      ...queueService.queueEntryToResponse(result.queueEntry),
      estimatedWaitMinutes: result.estimatedWaitMinutes,
      ahead: result.ahead,
      patientId: result.patient.id,
      phone: result.patient.phone,
      department: result.department,
      needsDepartmentClarification: result.needsDepartmentClarification,
      symptomsUrgentCare: result.symptomsUrgentCare,
      ...(result.symptomsUrgentCare && {
        urgentCareMessage: translateMessage('chatbotUrgentCare', result.patient.language, {}),
      }),
    });
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 409) {
      return res.status(409).json({
        error: e.message,
        ...(e.existing && { existing: e.existing }),
      });
    }
    console.error(e);
    return res.status(500).json({ error: 'Add to queue failed' });
  }
}
