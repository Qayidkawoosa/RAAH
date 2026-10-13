import { apiClient } from '../api/client';
import { isLiveBackend } from '../config/env';
import { Trip, TripEvent } from '../types/trip';
import {
  ComplaintAnalysis,
  ComplaintCategory,
  RiskLevel,
  SafetyReport,
  TripSummary,
  WeeklyInsight,
} from '../types/ai';
import { formatDuration } from '../utils/format';

const gradeFor = (score: number): SafetyReport['grade'] => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  return 'D';
};

const countEvents = (events: TripEvent[], type: TripEvent['type']): number =>
  events.filter((event) => event.type === type).length;

/**
 * AI Safety Copilot. With a live backend it calls Gemini through the server;
 * in demo mode it produces deterministic, professional analyses from the
 * same trip telemetry so every screen works without a key.
 */
export const aiService = {
  async getSafetyReport(trip: Trip): Promise<SafetyReport> {
    if (isLiveBackend) {
      try {
        const { data } = await apiClient.post<SafetyReport>('/api/ai/safety-report', trip);
        return data;
      } catch {
        // Backend unreachable — fall through to the on-device generator.
      }
    }
    const overspeeds = countEvents(trip.events, 'overspeed');
    const stops = countEvents(trip.events, 'long_stop');
    const deviations = countEvents(trip.events, 'route_deviation');
    const strengths: string[] = [];
    const risks: string[] = [];
    const recommendations: string[] = [];

    if (overspeeds === 0) strengths.push('Speed stayed within the 50 km/h school-zone limit for the entire trip.');
    else {
      risks.push(`${overspeeds} overspeeding event${overspeeds > 1 ? 's' : ''} recorded (max ${Math.round(trip.maxSpeedKmh)} km/h).`);
      recommendations.push('Ease off before Boulevard Road; speed peaks cluster there.');
    }
    if (stops === 0) strengths.push('No unscheduled long stops — pickups ran on time.');
    else {
      risks.push(`${stops} unscheduled long stop${stops > 1 ? 's' : ''} detected.`);
      recommendations.push('Report unavoidable halts in the app so parents are notified automatically.');
    }
    if (deviations === 0) strengths.push('Bus stayed on the approved route throughout.');
    else {
      risks.push(`${deviations} route deviation${deviations > 1 ? 's' : ''} beyond 250 m.`);
      recommendations.push('Request a route revision if the deviation was due to roadworks.');
    }
    if (recommendations.length === 0) recommendations.push('Maintain current driving pattern — it is in the top band of the fleet.');

    return {
      score: trip.safetyScore,
      grade: gradeFor(trip.safetyScore),
      headline:
        trip.safetyScore >= 90
          ? 'Excellent, consistently safe driving.'
          : trip.safetyScore >= 80
            ? 'Good trip with minor safety flags.'
            : 'Trip needs attention — repeated safety flags.',
      strengths,
      risks,
      recommendations,
    };
  },

  async getTripSummary(trip: Trip): Promise<TripSummary> {
    if (isLiveBackend) {
      try {
        const { data } = await apiClient.post<TripSummary>('/api/ai/trip-summary', trip);
        return data;
      } catch {
        // Backend unreachable — fall through to the on-device generator.
      }
    }
    const duration = formatDuration((trip.endedAt ?? Date.now()) - trip.startedAt);
    const eventCount = trip.events.filter((e) => e.type !== 'trip_started' && e.type !== 'trip_ended').length;
    const riskLevel: RiskLevel = eventCount === 0 ? 'low' : eventCount <= 2 ? 'medium' : 'high';
    return {
      headline: eventCount === 0 ? 'Smooth and safe trip' : `Trip completed with ${eventCount} safety flag${eventCount > 1 ? 's' : ''}`,
      summary: `${trip.routeName} completed in ${duration}, covering ${trip.distanceKm.toFixed(1)} km at an average of ${Math.round(trip.avgSpeedKmh)} km/h. ${
        eventCount === 0
          ? 'Telemetry shows steady speed, no route deviations and on-schedule stops.'
          : 'Telemetry flagged the events below; each has been logged for the school dashboard.'
      }`,
      riskLevel,
      highlights: trip.events.slice(0, 4).map((event) => event.message),
    };
  },

  async analyzeComplaint(text: string): Promise<ComplaintAnalysis> {
    if (isLiveBackend) {
      try {
        const { data } = await apiClient.post<ComplaintAnalysis>('/api/ai/complaint', { text });
        return data;
      } catch {
        // Backend unreachable — fall through to the on-device generator.
      }
    }
    const lower = text.toLowerCase();
    const match = (words: string[]): boolean => words.some((word) => lower.includes(word));
    let category: ComplaintCategory = 'Other';
    let severity: RiskLevel = 'low';
    if (match(['fast', 'speed', 'overtook', 'overtak', 'rash'])) {
      category = match(['rash', 'overtook', 'overtak']) ? 'Rash Driving' : 'Overspeeding';
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
    const actions: Record<ComplaintCategory, string> = {
      'Rash Driving': 'Escalate to transport in-charge and review the trip telemetry for the reported window.',
      Overspeeding: 'Cross-check speed logs for the reported time and counsel the driver.',
      'Route Issue': 'Verify GPS trail against the approved route and confirm stop list with the parent.',
      Delay: 'Compare scheduled vs actual stop times and notify parents of any revised timing.',
      'Vehicle Condition': 'Schedule a maintenance inspection before the next school day.',
      Behaviour: 'Arrange a meeting with the driver and record a formal note.',
      Other: 'Review with the transport coordinator and respond to the parent within 48 hours.',
    };
    return {
      category,
      severity,
      summary: `Parent reports a ${category.toLowerCase()} concern${severity === 'high' ? ' that needs urgent review' : ''}.`,
      suggestedAction: actions[category],
    };
  },

  async getWeeklyInsights(): Promise<WeeklyInsight[]> {
    if (isLiveBackend) {
      try {
        const { data } = await apiClient.get<WeeklyInsight[]>('/api/ai/weekly-insights');
        if (Array.isArray(data) && data.length > 0) return data;
      } catch {
        // Backend unreachable — fall through to the on-device generator.
      }
    }
    return [
      { title: 'Fleet safety improved 4% this week', detail: 'Average safety score rose to 86 after targeted counselling of two drivers.', trend: 'up' },
      { title: 'Overspeeding clusters on Boulevard Road', detail: '70% of overspeed events occur on the Boulevard stretch between 7:40–7:55 AM.', trend: 'flat' },
      { title: 'Bus JK-01-D-2296 needs intervention', detail: 'Three high-severity violations in 7 days; fitness certificate also expired.', trend: 'down' },
    ];
  },
};
