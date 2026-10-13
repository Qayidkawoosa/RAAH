import { BusStop, LatLng } from '../types/trip';
import { ROUTE_POINTS, STOP_INDICES } from './routeData';

export const DEMO_BUS_NO = 'JK-01-A-1234';
export const DEMO_ROUTE_NAME = 'Lal Chowk → Kashmir Valley School';
export const DEMO_DRIVER_NAME = 'Jehangir Dar';

/**
 * Morning pickup route through Srinagar's old city to Hazratbal. The
 * polyline comes from real OSRM driving directions (see routeData.ts), so
 * it follows actual roads and never crosses the lake.
 */
export const DEMO_ROUTE_PATH_A: LatLng[] = ROUTE_POINTS;

// Create Route B by applying an offset to the middle coordinates to simulate a detour (deviation)
export const DEMO_ROUTE_PATH_B: LatLng[] = ROUTE_POINTS.map((pt, idx) => {
  if (idx >= 25 && idx <= 90) {
    return {
      latitude: pt.latitude + 0.008,
      longitude: pt.longitude + 0.008,
    };
  }
  return pt;
});

export const DEMO_ROUTE_PATH: LatLng[] = DEMO_ROUTE_PATH_A;

export const DEMO_STOPS: BusStop[] = STOP_INDICES.map((stop) => ({
  name: stop.name,
  location: ROUTE_POINTS[stop.index],
}));

export const SCHOOL_LOCATION: LatLng = DEMO_ROUTE_PATH_A[DEMO_ROUTE_PATH_A.length - 1];

export const DEMO_REGION = {
  latitude: 34.101,
  longitude: 74.8265,
  latitudeDelta: 0.075,
  longitudeDelta: 0.075,
};

// --- Multi-Route Generation and Definitions ---

export interface RouteConfig {
  busNo: string;
  driverName: string;
  routeName: string;
  path: LatLng[];
  stops: BusStop[];
}

function interpolatePoints(a: LatLng, b: LatLng, count: number): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    points.push({
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    });
  }
  return points;
}

function generatePath(waypoints: LatLng[], pointsPerSegment: number = 12): LatLng[] {
  const path: LatLng[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    path.push(...interpolatePoints(waypoints[i], waypoints[i + 1], pointsPerSegment));
  }
  path.push(waypoints[waypoints.length - 1]);
  return path;
}

// 1. Rajbagh -> Kashmir Valley School
const RAJBAGH_WAYPOINTS: LatLng[] = [
  { latitude: 34.0561, longitude: 74.8210 }, // Rajbagh
  { latitude: 34.0660, longitude: 74.8214 }, // Radio Kashmir
  { latitude: 34.0725, longitude: 74.8210 }, // Dalgate
  { latitude: 34.0880, longitude: 74.8420 }, // Boulevard / Nehru Park
  { latitude: 34.1120, longitude: 74.8480 }, // Nishat
  { latitude: 34.1280, longitude: 74.8520 }, // Duck Park / Foreshore Rd
  { latitude: 34.13011, longitude: 74.84315 }, // Hazratbal / School
];
const RAJBAGH_PATH = generatePath(RAJBAGH_WAYPOINTS, 12);
const RAJBAGH_STOPS: BusStop[] = [
  { name: 'Rajbagh', location: RAJBAGH_PATH[0] },
  { name: 'Dalgate', location: RAJBAGH_PATH[24] },
  { name: 'Nehru Park', location: RAJBAGH_PATH[36] },
  { name: 'Nishat', location: RAJBAGH_PATH[48] },
  { name: 'Kashmir Valley School', location: RAJBAGH_PATH[72] },
];

// 2. Bemina -> Kashmir Valley School
const BEMINA_WAYPOINTS: LatLng[] = [
  { latitude: 34.0740, longitude: 74.7730 }, // Bemina (JVC)
  { latitude: 34.0715, longitude: 74.7930 }, // Batamaloo
  { latitude: 34.07151, longitude: 74.80896 }, // Lal Chowk (merges here)
  { latitude: 34.08062, longitude: 74.81973 }, // Khanyar / Nowhatta
  { latitude: 34.09684, longitude: 74.82186 }, // Hawal
  { latitude: 34.1186, longitude: 74.83561 }, // Naseem Bagh
  { latitude: 34.13011, longitude: 74.84315 }, // School
];
const BEMINA_PATH = generatePath(BEMINA_WAYPOINTS, 12);
const BEMINA_STOPS: BusStop[] = [
  { name: 'Bemina', location: BEMINA_PATH[0] },
  { name: 'Batamaloo', location: BEMINA_PATH[12] },
  { name: 'Lal Chowk', location: BEMINA_PATH[24] },
  { name: 'Nowhatta', location: BEMINA_PATH[36] },
  { name: 'Naseem Bagh', location: BEMINA_PATH[60] },
  { name: 'Kashmir Valley School', location: BEMINA_PATH[72] },
];

// 3. Soura -> Kashmir Valley School
const SOURA_WAYPOINTS: LatLng[] = [
  { latitude: 34.1350, longitude: 74.8030 }, // Soura (SKIMS)
  { latitude: 34.1360, longitude: 74.8150 }, // Buchpora
  { latitude: 34.1310, longitude: 74.8250 }, // Illahi Bagh
  { latitude: 34.12654, longitude: 74.83869 }, // Hazratbal road
  { latitude: 34.13011, longitude: 74.84315 }, // School
];
const SOURA_PATH = generatePath(SOURA_WAYPOINTS, 12);
const SOURA_STOPS: BusStop[] = [
  { name: 'Soura', location: SOURA_PATH[0] },
  { name: 'Buchpora', location: SOURA_PATH[12] },
  { name: 'Illahi Bagh', location: SOURA_PATH[24] },
  { name: 'Kashmir Valley School', location: SOURA_PATH[48] },
];

// 4. HMT -> Kashmir Valley School
const HMT_WAYPOINTS: LatLng[] = [
  { latitude: 34.1030, longitude: 74.7390 }, // HMT
  { latitude: 34.0880, longitude: 74.7610 }, // Parimpora
  { latitude: 34.0950, longitude: 74.7750 }, // Qamarwari
  { latitude: 34.0990, longitude: 74.8010 }, // Eidgah
  { latitude: 34.09613, longitude: 74.82143 }, // Hawal area
  { latitude: 34.12029, longitude: 74.83536 }, // Naseem Bagh area
  { latitude: 34.13011, longitude: 74.84315 }, // School
];
const HMT_PATH = generatePath(HMT_WAYPOINTS, 12);
const HMT_STOPS: BusStop[] = [
  { name: 'HMT', location: HMT_PATH[0] },
  { name: 'Parimpora', location: HMT_PATH[12] },
  { name: 'Qamarwari', location: HMT_PATH[24] },
  { name: 'Eidgah', location: HMT_PATH[36] },
  { name: 'Naseem Bagh', location: HMT_PATH[60] },
  { name: 'Kashmir Valley School', location: HMT_PATH[72] },
];

export const ALL_ROUTES: RouteConfig[] = [
  {
    busNo: DEMO_BUS_NO,
    driverName: DEMO_DRIVER_NAME,
    routeName: DEMO_ROUTE_NAME,
    path: DEMO_ROUTE_PATH_A,
    stops: DEMO_STOPS,
  },
  {
    busNo: 'JK-01-B-4472',
    driverName: 'Bashir Ahmad',
    routeName: 'Rajbagh → Kashmir Valley School',
    path: RAJBAGH_PATH,
    stops: RAJBAGH_STOPS,
  },
  {
    busNo: 'JK-01-C-8810',
    driverName: 'Mohd. Yousuf',
    routeName: 'Bemina → Kashmir Valley School',
    path: BEMINA_PATH,
    stops: BEMINA_STOPS,
  },
  {
    busNo: 'JK-01-D-2296',
    driverName: 'Farooq Lone',
    routeName: 'Soura → Kashmir Valley School',
    path: SOURA_PATH,
    stops: SOURA_STOPS,
  },
  {
    busNo: 'JK-01-E-6634',
    driverName: 'Abdul Majid',
    routeName: 'HMT → Kashmir Valley School',
    path: HMT_PATH,
    stops: HMT_STOPS,
  },
];


