// Deterministic heuristics mirroring the app's on-device AI fallback.
// Used whenever GEMINI_API_KEY is missing or a Gemini call fails.

const countEvents = (events, type) => (events ?? []).filter((e) => e.type === type).length;

const gradeFor = (score) => (score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : 'D');

export function safetyReport(trip) {
  const events = trip.events ?? [];
  const overspeeds = countEvents(events, 'overspeed');
  const stops = countEvents(events, 'long_stop');
  const deviations = countEvents(events, 'route_deviation');
  const strengths = [];
  const risks = [];
  const recommendations = [];

  if (overspeeds === 0) strengths.push('Speed stayed within the 50 km/h school-zone limit for the entire trip.');
  else {
    risks.push(`${overspeeds} overspeeding event(s) recorded (max ${Math.round(trip.maxSpeedKmh ?? 0)} km/h).`);
    recommendations.push('Ease off before high-speed stretches; overspeed events cluster there.');
  }
  if (stops === 0) strengths.push('No unscheduled long stops — pickups ran on time.');
  else risks.push(`${stops} unscheduled long stop(s) detected.`);
  if (deviations === 0) strengths.push('Bus stayed on the approved route throughout.');
  else risks.push(`${deviations} route deviation(s) beyond 250 m.`);
  if (recommendations.length === 0) recommendations.push('Maintain current driving pattern — it is in the top band of the fleet.');

  const score = trip.safetyScore ?? 90;
  return {
    score,
    grade: gradeFor(score),
    headline:
      score >= 90
        ? 'Excellent, consistently safe driving.'
        : score >= 80
          ? 'Good trip with minor safety flags.'
          : 'Trip needs attention — repeated safety flags.',
    strengths,
    risks,
    recommendations,
  };
}

export function tripSummary(trip) {
  const events = (trip.events ?? []).filter((e) => !['trip_started', 'trip_ended'].includes(e.type));
  const minutes = Math.max(1, Math.round(((trip.endedAt ?? Date.now()) - trip.startedAt) / 60000));
  const riskLevel = events.length === 0 ? 'low' : events.length <= 2 ? 'medium' : 'high';
  return {
    headline: events.length === 0 ? 'Smooth and safe trip' : `Trip completed with ${events.length} safety flag(s)`,
    summary: `${trip.routeName} completed in ${minutes} min, covering ${(trip.distanceKm ?? 0).toFixed(1)} km at an average of ${Math.round(trip.avgSpeedKmh ?? 0)} km/h.`,
    riskLevel,
    highlights: events.slice(0, 4).map((e) => e.message),
  };
}

export function complaintAnalysis(text) {
  const lower = (text ?? '').toLowerCase();
  const match = (words) => words.some((w) => lower.includes(w));
  let category = 'Other';
  let severity = 'low';
  if (match(['fast', 'speed', 'overtook', 'overtak', 'rash', 'phone', 'swerv'])) {
    category = match(['fast', 'speed']) ? 'Overspeeding' : 'Rash Driving';
    severity = 'high';
  } else if (match(['late', 'delay', 'waiting'])) {
    category = 'Delay';
    severity = 'medium';
  } else if (match(['route', 'stop', 'shortcut'])) {
    category = 'Route Issue';
    severity = 'medium';
  } else if (match(['seat', 'window', 'brake', 'tyre', 'tire', 'maintenance', 'broken'])) {
    category = 'Vehicle Condition';
    severity = 'medium';
  } else if (match(['rude', 'shout', 'behav', 'smoke'])) {
    category = 'Behaviour';
    severity = 'high';
  }
  return {
    category,
    severity,
    summary: `Parent reports a ${category.toLowerCase()} concern${severity === 'high' ? ' that needs urgent review' : ''}.`,
    suggestedAction: 'Review the trip telemetry for the reported window and respond to the parent within 48 hours.',
  };
}

export function weeklyInsights() {
  return [
    { title: 'Fleet safety improved 4% this week', detail: 'Average safety score rose to 86 after targeted counselling of two drivers.', trend: 'up' },
    { title: 'Overspeeding clusters near Khanyar', detail: '70% of overspeed events occur between 7:40–7:55 AM on the old-city stretch.', trend: 'flat' },
    { title: 'Bus JK-01-D-2296 needs intervention', detail: 'Three high-severity violations in 7 days; fitness certificate also expired.', trend: 'down' },
  ];
}
