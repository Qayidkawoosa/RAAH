import { Request, Response } from 'express';
import { tripDatabase } from './tripController';

export type DmsViolationType =
  | 'MICROSLEEP_DETECTED'
  | 'DRIVER_DISTRACTION'
  | 'FATIGUE_INDICATOR'
  | 'PHONE_USE'
  | 'SEATBELT_VIOLATION'
  | 'CAMERA_OBSTRUCTED'
  | 'DRIVER_OUT_OF_POSITION'
  | 'OVERSPEEDING';

export type DmsSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface DmsIncidentRecord {
  id: string;
  tripId: string;
  busNo?: string;
  driverId?: string;
  violationType: DmsViolationType | string;
  severity: DmsSeverity;
  confidence: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// In-memory DMS Incident Store (Swappable to Prisma when migrations land)
export const dmsIncidents: DmsIncidentRecord[] = [];

/**
 * POST /api/dms/incident
 * Ingests live AI Driver Monitoring System (DMS) safety events
 * Body: { tripId, violationType, severity, confidence, timestamp, metadata }
 */
export async function logIncident(req: Request, res: Response): Promise<void> {
  try {
    const { tripId, violationType, severity = 'WARNING', confidence = 1.0, timestamp, metadata } = req.body;

    // 1. Validation
    if (!tripId || !violationType) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'tripId and violationType are required to log a DMS safety incident',
      });
      return;
    }

    if (typeof confidence === 'number' && (confidence < 0 || confidence > 1)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'confidence must be a decimal value between 0.0 and 1.0',
      });
      return;
    }

    const validSeverities: DmsSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];
    const normalizedSeverity: DmsSeverity = validSeverities.includes(severity?.toUpperCase())
      ? (severity.toUpperCase() as DmsSeverity)
      : 'WARNING';

    // 2. Fetch associated trip
    const trip = tripDatabase.get(tripId);

    // 3. Create incident record
    const incidentId = `dms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newIncident: DmsIncidentRecord = {
      id: incidentId,
      tripId: tripId.trim(),
      busNo: trip?.busNo,
      driverId: trip?.driverId || req.user?.userId,
      violationType: violationType.trim(),
      severity: normalizedSeverity,
      confidence: Number(confidence) || 1.0,
      timestamp: Number(timestamp) || Date.now(),
      metadata: metadata || {},
      createdAt: new Date(),
    };

    dmsIncidents.push(newIncident);

    // 4. Dynamically adjust trip safety score based on incident severity
    if (trip) {
      let penalty = 0;
      if (normalizedSeverity === 'CRITICAL') penalty = 15;
      else if (normalizedSeverity === 'WARNING') penalty = 5;
      else if (normalizedSeverity === 'INFO') penalty = 1;

      trip.safetyScore = Math.max(0, trip.safetyScore - penalty);
    }

    res.status(201).json({
      status: 'success',
      message: 'DMS safety incident ingested successfully',
      incident: newIncident,
      currentTripSafetyScore: trip?.safetyScore,
    });
  } catch (error: any) {
    console.error('logIncident error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to record DMS incident',
    });
  }
}

/**
 * GET /api/dms/incidents/:tripId
 * Retrieves all DMS incidents for a specific trip
 */
export async function getTripIncidents(req: Request, res: Response): Promise<void> {
  try {
    const { tripId } = req.params;
    if (!tripId) {
      res.status(400).json({ error: 'BadRequest', message: 'tripId is required' });
      return;
    }

    const filtered = dmsIncidents.filter((i) => i.tripId === tripId);
    res.status(200).json({
      status: 'success',
      count: filtered.length,
      incidents: filtered,
    });
  } catch (error: any) {
    console.error('getTripIncidents error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch trip incidents',
    });
  }
}

/**
 * GET /api/dms/incidents
 * Retrieves recent incidents fleet-wide (for school/RTO dashboards)
 */
export async function getAllIncidents(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const recent = dmsIncidents.slice(-limit).reverse();
    res.status(200).json({
      status: 'success',
      count: recent.length,
      incidents: recent,
    });
  } catch (error: any) {
    console.error('getAllIncidents error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch DMS incidents',
    });
  }
}
