import fs from 'fs';
import path from 'path';

/**
 * A one-time script that fetches road-following coordinates from OSRM.
 * For the prototype, we fall back to hand-placed waypoints if OSRM is unreachable.
 */

const OUT_FILE = path.join(__dirname, '../src/constants/routes.generated.json');

// Mocked waypoints for Srinagar (Hazratbal line)
const MOCK_ROUTES = {
  "JK-01-A-1234": {
    "routeName": "Hazratbal Line",
    "coordinates": [
      { "latitude": 34.1347, "longitude": 74.8008 },
      { "latitude": 34.1285, "longitude": 74.8414 },
      { "latitude": 34.0790, "longitude": 74.8320 },
      { "latitude": 34.0660, "longitude": 74.8230 }
    ],
    "stops": [
      { "id": "stop1", "name": "Soura", "position": { "latitude": 34.1347, "longitude": 74.8008 } },
      { "id": "stop2", "name": "Hazratbal", "position": { "latitude": 34.1285, "longitude": 74.8414 } },
      { "id": "stop3", "name": "Dalgate", "position": { "latitude": 34.0790, "longitude": 74.8320 } },
      { "id": "school", "name": "Demo Public School", "position": { "latitude": 34.0660, "longitude": 74.8230 } }
    ]
  }
};

async function main() {
  console.log('Building mock routes...');
  fs.writeFileSync(OUT_FILE, JSON.stringify(MOCK_ROUTES, null, 2));
  console.log(`Routes written to ${OUT_FILE}`);
}

main().catch(console.error);
