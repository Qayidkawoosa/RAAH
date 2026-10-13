// Creates the four demo accounts in Firebase Auth (via the Identity Toolkit
// REST API) and stores their role profiles in MongoDB, so the classic demo
// logins work in live Firebase mode.
//
// Requires in root .env: EXPO_PUBLIC_FIREBASE_API_KEY, MONGODB_URI, and
// Email/Password sign-in enabled in the Firebase console.
//
// Run from server/:  npm run seed:users

import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const PASSWORD = 'password123';

const demoUsers = [
  { email: 'driver@raasta.com', name: 'Jehangir Dar', role: 'driver', phone: '+919906123456', vehicleNo: 'JK-01-A-1234', licenseNo: 'DL-99062026' },
  { email: 'parent@raasta.com', name: 'Amina Shah', role: 'parent', phone: '+919906987654', assignedBusNo: 'JK-01-A-1234', schoolName: 'Kashmir Valley School' },
  { email: 'school@raasta.com', name: 'Kashmir Valley School Admin', role: 'school', schoolName: 'Kashmir Valley School' },
  { email: 'rto@raasta.com', name: 'RTO Srinagar Inspector', role: 'rto', rtoCode: 'JK-01' },
];

const identityToolkit = async (endpoint, body) => {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? `HTTP ${response.status}`);
  return data;
};

/** Create the Firebase account, or sign in if it already exists. */
async function ensureFirebaseUser(email) {
  try {
    const created = await identityToolkit('signUp', {
      email,
      password: PASSWORD,
      returnSecureToken: true,
    });
    return { uid: created.localId, created: true };
  } catch (error) {
    if (error.message.includes('EMAIL_EXISTS')) {
      const signedIn = await identityToolkit('signInWithPassword', {
        email,
        password: PASSWORD,
        returnSecureToken: true,
      });
      return { uid: signedIn.localId, created: false };
    }
    throw error;
  }
}

async function main() {
  if (!API_KEY) throw new Error('EXPO_PUBLIC_FIREBASE_API_KEY missing from .env');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing from .env');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const User = mongoose.model(
    'User',
    new mongoose.Schema({ uid: String, email: String }, { strict: false, collection: 'users', id: false })
  );

  for (const user of demoUsers) {
    const { uid, created } = await ensureFirebaseUser(user.email);
    const profile = { uid, createdAt: new Date().toISOString(), ...user };
    await User.updateOne({ uid }, { $set: profile }, { upsert: true });
    console.log(`${created ? 'created' : 'exists '} ${user.email} → role ${user.role} (uid ${uid.slice(0, 8)}…)`);
  }

  console.log(`\nDemo logins ready (password: ${PASSWORD}) — Firebase + Mongo profiles in sync.`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Seeding users failed:', error.message);
  if (error.message.includes('OPERATION_NOT_ALLOWED') || error.message.includes('PASSWORD_LOGIN_DISABLED')) {
    console.error('→ Enable Email/Password in Firebase console: Authentication → Sign-in method.');
  }
  process.exit(1);
});
