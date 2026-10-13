// Seeds MongoDB with demo trips and complaints so every dashboard has data
// the moment the backend goes live. Idempotent: clears and re-inserts the
// demo documents (documents created by the app are left alone).
//
// Run from server/:  npm run seed

import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import * as seed from '../src/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DAY = 86400000;
const ROUTE_NAME = 'Lal Chowk → Kashmir Valley School';

const tripSchema = new mongoose.Schema(
  { id: String },
  { strict: false, collection: 'trips', id: false }
);
const complaintSchema = new mongoose.Schema(
  { id: String },
  { strict: false, collection: 'complaints', id: false }
);
const studentSchema = new mongoose.Schema(
  { id: String, busNo: String },
  { strict: false, collection: 'students', id: false }
);

const id = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const eventSets = [
  [],
  [{ id: id('evt'), type: 'overspeed', message: 'Overspeeding: 58 km/h on Boulevard Road', timestamp: Date.now() - DAY, speedKmh: 58 }],
  [],
  [
    { id: id('evt'), type: 'long_stop', message: 'Unscheduled 4 minute stop at Dalgate', timestamp: Date.now() - 3 * DAY },
    { id: id('evt'), type: 'overspeed', message: 'Overspeeding: 55 km/h near Nishat', timestamp: Date.now() - 3 * DAY, speedKmh: 55 },
  ],
  [],
];

const buildTrips = () =>
  eventSets.map((events, index) => {
    const startedAt = Date.now() - (index + 1) * DAY;
    const penalty = events.reduce((sum, e) => sum + (e.type === 'overspeed' ? 8 : e.type === 'long_stop' ? 5 : 0), 0);
    return {
      id: id('trip'),
      seeded: true,
      busNo: seed.DEMO_BUS_NO,
      driverId: 'drv_jehangir',
      driverName: 'Jehangir Dar',
      routeName: ROUTE_NAME,
      status: 'completed',
      startedAt,
      endedAt: startedAt + 34 * 60000 + index * 3 * 60000,
      distanceKm: 11.2,
      maxSpeedKmh: events.some((e) => e.type === 'overspeed') ? 58 : 46,
      avgSpeedKmh: 27 + index,
      safetyScore: Math.max(35, 100 - penalty),
      events,
      path: [],
    };
  });

const buildComplaints = () => [
  { id: id('cmp'), seeded: true, busNo: 'JK-01-D-2296', parentName: 'Rafiq Wani', text: 'The bus was driving very fast near Soura this morning, my son said the driver overtook two cars on a blind turn. Please look into this.', createdAt: Date.now() - 2 * 3600000, status: 'open' },
  { id: id('cmp'), seeded: true, busNo: 'JK-01-B-4472', parentName: 'Shabnam Mir', text: 'Bus reached the stop 25 minutes late two days in a row without any notice. Children were waiting in the cold.', createdAt: Date.now() - DAY, status: 'reviewing' },
  { id: id('cmp'), seeded: true, busNo: seed.DEMO_BUS_NO, parentName: 'Imran Bhat', text: 'One of the rear seats is broken and the window does not close properly. Needs maintenance before winter.', createdAt: Date.now() - 3 * DAY, status: 'resolved' },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in .env — nothing to seed.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const Trip = mongoose.model('Trip', tripSchema);
  const Complaint = mongoose.model('Complaint', complaintSchema);
  const Student = mongoose.model('Student', studentSchema);

  // Remove seeded docs and any legacy documents saved without an id
  // (created before the schema declared `id` explicitly).
  await Trip.deleteMany({ $or: [{ seeded: true }, { id: { $exists: false } }] });
  await Complaint.deleteMany({ $or: [{ seeded: true }, { id: { $exists: false } }] });
  await Student.deleteMany({});

  const trips = await Trip.insertMany(buildTrips());
  const complaints = await Complaint.insertMany(buildComplaints());
  const students = await Student.insertMany(seed.students);

  console.log(`Seeded ${trips.length} trips, ${complaints.length} complaints, and ${students.length} students into MongoDB.`);
  console.log(`Database: ${mongoose.connection.name}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
