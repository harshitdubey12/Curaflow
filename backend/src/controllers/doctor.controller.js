import * as doctorService from '../services/doctor.service.js';

export async function list(req, res) {
  try {
    const doctors = await doctorService.listDoctors();
    return res.json({ doctors });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to list doctors' });
  }
}

export async function create(req, res) {
  try {
    const { name, specialization } = req.body || {};
    const doctor = await doctorService.createDoctor({ name, specialization });
    return res.status(201).json({ doctor });
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Failed to create doctor' });
  }
}

export async function update(req, res) {
  try {
    const id = req.params.id;
    const { name, specialization } = req.body || {};
    const doctor = await doctorService.updateDoctor(id, { name, specialization });
    return res.json({ doctor });
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Failed to update doctor' });
  }
}

export async function remove(req, res) {
  try {
    const id = req.params.id;
    const out = await doctorService.deleteDoctor(id);
    return res.json(out);
  } catch (e) {
    if (e.statusCode === 400) return res.status(400).json({ error: e.message });
    if (e.statusCode === 404) return res.status(404).json({ error: e.message });
    if (e.statusCode === 409) return res.status(409).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'Failed to delete doctor' });
  }
}
