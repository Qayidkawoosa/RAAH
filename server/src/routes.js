import { askGeminiJson } from './gemini.js';
import * as fallback from './aiFallback.js';

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message ?? 'Internal server error' });
  }
};

export function registerRoutes(app, store) {
  // ── Trips ────────────────────────────────────────────────────────────
  app.post('/api/trips', wrap(async (req, res) => {
    res.status(201).json(await store.saveTrip(req.body));
  }));

  app.get('/api/trips', wrap(async (req, res) => {
    res.json(await store.getTrips(req.query.busNo));
  }));

  // ── User profiles (role persistence for Firebase auth) ──────────────
  app.post('/api/users', wrap(async (req, res) => {
    const profile = req.body;
    if (!profile?.uid || !profile?.role) {
      res.status(400).json({ message: 'uid and role are required' });
      return;
    }
    res.status(201).json(await store.saveUser(profile));
  }));

  app.get('/api/users/:uid', wrap(async (req, res) => {
    const user = await store.getUser(req.params.uid);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  }));

  // ── Fleet / dashboards ───────────────────────────────────────────────
  app.get('/api/fleet', wrap(async (_req, res) => res.json(store.getFleet())));
  app.get('/api/rankings', wrap(async (_req, res) => res.json(store.getRankings())));
  app.get('/api/compliance', wrap(async (_req, res) => res.json(store.getCompliance())));
  app.get('/api/violations', wrap(async (_req, res) => res.json(store.getViolations())));
  app.get('/api/analytics', wrap(async (_req, res) => res.json(await store.getAnalytics())));

  // ── Students (school assigns students to buses) ──────────────────────
  app.get('/api/students', wrap(async (_req, res) => res.json(await store.getStudents())));

  app.post('/api/students', wrap(async (req, res) => {
    const { name, className, busNo, parentName, pickupStop } = req.body;
    if (!name || !className || !busNo) {
      res.status(400).json({ message: 'name, className and busNo are required' });
      return;
    }
    const student = {
      id: `stu_${Date.now().toString(36)}`,
      name,
      className,
      busNo,
      parentName: parentName ?? '',
      pickupStop: pickupStop ?? '',
    };
    await store.addStudent(student);
    res.status(201).json(student);
  }));

  app.delete('/api/students/:id', wrap(async (req, res) => {
    const removed = await store.removeStudent(req.params.id);
    if (!removed) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }
    res.json({ ok: true });
  }));

  app.patch('/api/students/:id/link', wrap(async (req, res) => {
    const { parentName } = req.body;
    if (!parentName) {
      res.status(400).json({ message: 'parentName is required' });
      return;
    }
    const student = await store.linkParentToStudent(req.params.id, parentName);
    if (!student) {
      res.status(404).json({ message: 'Student not found' });
      return;
    }
    res.json(student);
  }));

  // ── Complaints ───────────────────────────────────────────────────────
  app.get('/api/complaints', wrap(async (_req, res) => res.json(await store.getComplaints())));

  app.post('/api/complaints', wrap(async (req, res) => {
    const { busNo, parentName, text, analysis } = req.body;
    const complaint = {
      id: `cmp_${Date.now().toString(36)}`,
      busNo,
      parentName,
      text,
      createdAt: Date.now(),
      status: 'open',
      analysis: analysis ?? null,
    };
    await store.saveComplaint(complaint);
    res.status(201).json(complaint);
  }));

  app.patch('/api/complaints/:id', wrap(async (req, res) => {
    const { status, analysis } = req.body;
    const updates = {};
    if (status !== undefined) {
      if (!['open', 'reviewing', 'resolved'].includes(status)) {
        res.status(400).json({ message: 'status must be open, reviewing or resolved' });
        return;
      }
      updates.status = status;
    }
    if (analysis !== undefined) {
      updates.analysis = analysis;
    }
    const updated = await store.updateComplaint(req.params.id, updates);
    if (!updated) {
      res.status(404).json({ message: 'Complaint not found' });
      return;
    }
    res.json(updated);
  }));

  // ── AI Safety Copilot (Gemini with deterministic fallback) ──────────
  app.post('/api/ai/safety-report', wrap(async (req, res) => {
    const trip = req.body;
    const ai = await askGeminiJson(
      'You are an AI Safety Copilot for school bus transport. From this trip telemetry produce: {"score":number 0-100,"grade":"A"|"B"|"C"|"D","headline":string,"strengths":string[],"risks":string[],"recommendations":string[]}. Be concise and professional.',
      trip,
      trip.id ? 'safety:' + trip.id : null
    );
    res.json(ai ?? fallback.safetyReport(trip));
  }));

  app.post('/api/ai/trip-summary', wrap(async (req, res) => {
    const trip = req.body;
    const ai = await askGeminiJson(
      'You are an AI Safety Copilot. Summarize this school bus trip for a parent/school: {"headline":string,"summary":string(2-3 sentences),"riskLevel":"low"|"medium"|"high","highlights":string[]}.',
      trip,
      trip.id ? 'summary:' + trip.id : null
    );
    res.json(ai ?? fallback.tripSummary(trip));
  }));

  app.post('/api/ai/complaint', wrap(async (req, res) => {
    const { text } = req.body;
    const ai = await askGeminiJson(
      'Categorize this parent complaint about a school bus: {"category":"Rash Driving"|"Overspeeding"|"Route Issue"|"Delay"|"Vehicle Condition"|"Behaviour"|"Other","severity":"low"|"medium"|"high","summary":string,"suggestedAction":string}.',
      { text },
      'complaint:' + String(text).slice(0, 80)
    );
    res.json(ai ?? fallback.complaintAnalysis(text));
  }));

  app.get('/api/ai/weekly-insights', wrap(async (_req, res) => {
    const analytics = await store.getAnalytics();
    const ai = await askGeminiJson(
      'You are an AI Safety Copilot. From these fleet analytics produce exactly 3 weekly insights as {"insights":[{"title":string,"detail":string,"trend":"up"|"down"|"flat"}]}.',
      { analytics, violations: store.getViolations(), rankings: store.getRankings() },
      'weekly-insights'
    );
    res.json(ai?.insights ?? fallback.weeklyInsights());
  }));
}
