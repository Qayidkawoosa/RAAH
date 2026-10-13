import mongoose from 'mongoose';
import * as seed from './seed.js';

// `id` must be an explicit path: Mongoose's built-in `id` virtual otherwise
// swallows the field on create and documents come back without it.
const tripSchema = new mongoose.Schema(
  { id: String },
  { strict: false, collection: 'trips', id: false }
);
const complaintSchema = new mongoose.Schema(
  { id: String },
  { strict: false, collection: 'complaints', id: false }
);
const userSchema = new mongoose.Schema(
  { uid: String, email: String },
  { strict: false, collection: 'users', id: false }
);
const studentSchema = new mongoose.Schema(
  { id: String, busNo: String },
  { strict: false, collection: 'students', id: false }
);

/**
 * Data layer with two backends: MongoDB (when MONGODB_URI is set and
 * reachable) or an in-memory fallback so the server always boots.
 */
export async function connectStore(mongoUri) {
  let usingMongo = false;
  let TripModel = null;
  let ComplaintModel = null;
  let UserModel = null;
  let StudentModel = null;

  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 6000 });
      TripModel = mongoose.model('Trip', tripSchema);
      ComplaintModel = mongoose.model('Complaint', complaintSchema);
      UserModel = mongoose.model('User', userSchema);
      StudentModel = mongoose.model('Student', studentSchema);
      usingMongo = true;

      // Auto-seed default students if the collection is empty
      const count = await StudentModel.countDocuments();
      if (count === 0) {
        await StudentModel.insertMany(seed.students);
        console.log(`Auto-seeded ${seed.students.length} default students into MongoDB.`);
      }
    } catch (error) {
      console.warn('MongoDB unreachable, falling back to in-memory store:', error.message);
    }
  }

  const memory = { trips: [], complaints: [], users: [], students: [...seed.students] };
  // Live bus state kept in memory in both modes (ephemeral realtime data).
  const liveBuses = new Map();

  return {
    usingMongo,
    liveBuses,

    async saveTrip(trip) {
      if (usingMongo) {
        await TripModel.create(trip);
        return trip;
      }
      memory.trips.unshift(trip);
      memory.trips = memory.trips.slice(0, 500);
      return trip;
    },

    async getTrips(busNo) {
      if (usingMongo) {
        const query = busNo ? { busNo } : {};
        return TripModel.find(query).sort({ startedAt: -1 }).limit(50).lean();
      }
      return memory.trips.filter((trip) => !busNo || trip.busNo === busNo);
    },

    async saveComplaint(complaint) {
      if (usingMongo) {
        await ComplaintModel.create(complaint);
        return complaint;
      }
      memory.complaints.unshift(complaint);
      return complaint;
    },

    async getComplaints() {
      if (usingMongo) {
        return ComplaintModel.find({}).sort({ createdAt: -1 }).limit(100).lean();
      }
      return memory.complaints;
    },

    /** Upsert a user profile (register / profile update). */
    async saveUser(profile) {
      if (usingMongo) {
        await UserModel.updateOne({ uid: profile.uid }, { $set: profile }, { upsert: true });
        return profile;
      }
      memory.users = memory.users.filter((user) => user.uid !== profile.uid);
      memory.users.push(profile);
      return profile;
    },

    async getUser(uid) {
      if (usingMongo) {
        return UserModel.findOne({ uid }).lean();
      }
      return memory.users.find((user) => user.uid === uid) ?? null;
    },

    async updateComplaint(id, updates) {
      if (usingMongo) {
        await ComplaintModel.updateOne({ id }, { $set: updates });
        return ComplaintModel.findOne({ id }).lean();
      }
      const complaint = memory.complaints.find((item) => item.id === id);
      if (complaint) {
        Object.assign(complaint, updates);
      }
      return complaint ?? null;
    },

    async getStudents() {
      if (usingMongo) {
        const stored = await StudentModel.find({}).sort({ busNo: 1 }).limit(500).lean();
        return stored.length > 0 ? stored : seed.students;
      }
      return memory.students;
    },

    async addStudent(student) {
      if (usingMongo) {
        await StudentModel.create(student);
        return student;
      }
      memory.students.push(student);
      return student;
    },

    async removeStudent(id) {
      if (usingMongo) {
        const { deletedCount } = await StudentModel.deleteOne({ id });
        return deletedCount > 0;
      }
      const before = memory.students.length;
      memory.students = memory.students.filter((student) => student.id !== id);
      return memory.students.length < before;
    },

    async linkParentToStudent(id, parentName) {
      if (usingMongo) {
        await StudentModel.updateOne({ id }, { $set: { parentName } });
        return StudentModel.findOne({ id }).lean();
      }
      const student = memory.students.find((item) => item.id === id);
      if (student) {
        student.parentName = parentName;
      }
      return student ?? null;
    },

    getFleet() {
      return seed.fleet.map((bus) => {
        const live = liveBuses.get(bus.busNo);
        return live ? { ...bus, status: live.status } : bus;
      });
    },

    getRankings: () => seed.rankings,
    getCompliance: () => seed.compliance,
    getViolations: () => seed.violations,

    async getAnalytics() {
      const trips = await this.getTrips();
      const active = [...liveBuses.values()].filter(
        (bus) => bus.status === 'active' || bus.status === 'sos'
      );
      const weekAgo = Date.now() - 7 * 86400000;
      const violationsWeek = trips
        .filter((trip) => trip.startedAt > weekAgo)
        .reduce(
          (sum, trip) =>
            sum +
            (trip.events ?? []).filter(
              (event) => !['trip_started', 'trip_ended'].includes(event.type)
            ).length,
          0
        );
      return {
        totalTripsToday: trips.filter((trip) => trip.startedAt > Date.now() - 86400000).length,
        activeTrips: active.length,
        totalViolationsWeek: violationsWeek + seed.violations.length,
        avgFleetSafetyScore: Math.round(
          seed.fleet.reduce((sum, bus) => sum + bus.safetyScore, 0) / seed.fleet.length
        ),
        complianceRate: Math.round(
          (seed.compliance.filter((record) => record.isCompliant).length / seed.compliance.length) * 100
        ),
        sosCountMonth: trips.filter((trip) =>
          (trip.events ?? []).some((event) => event.type === 'sos')
        ).length,
      };
    },
  };
}
