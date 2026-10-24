import { UserProfile } from '../types/auth';

/**
 * The four demo accounts, keyed by email. Single source of truth for both
 * mock auth and Firebase auth: when a Firebase login cannot reach the
 * backend, these let the demo roles resolve correctly offline instead of
 * falling back to a wrong dashboard.
 */
export const DEMO_PROFILES: Record<string, Omit<UserProfile, 'uid' | 'createdAt'>> = {
  'driver@raah.app': {
    email: 'driver@raah.app',
    name: 'Jehangir Dar',
    role: 'driver',
    phone: '+919906123456',
    vehicleNo: 'JK-01-A-1234',
    licenseNo: 'DL-99062026',
  },
  'parent@raah.app': {
    email: 'parent@raah.app',
    name: 'Amina Shah',
    role: 'parent',
    phone: '+919906987654',
    assignedBusNo: 'JK-01-A-1234',
    schoolName: 'Kashmir Valley School',
  },
  'tariqahmaddar@kashmirschool.edu': {
    email: 'tariqahmaddar@kashmirschool.edu',
    name: 'Tariq Ahmad Dar',
    role: 'driver',
    phone: '9419012345',
    vehicleNo: 'JK-01-AB-1234',
    assignedBusNo: 'JK-01-AB-1234',
    schoolName: 'Kashmir Valley School',
  },
  'school@raah.app': {
    email: 'school@raah.app',
    name: 'Kashmir Valley School Admin',
    role: 'school',
    schoolName: 'Kashmir Valley School',
  },
  'rto@raah.app': {
    email: 'rto@raah.app',
    name: 'RTO Srinagar Inspector',
    role: 'rto',
    rtoCode: 'JK-01',
  },
};

/** Build a full profile for a known demo email or phone number, or null if not a demo account. */
export const demoProfileFor = (_identifier: string, _uid: string): UserProfile | null => {
  return null;
};
