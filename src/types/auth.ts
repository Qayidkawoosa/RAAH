export type UserRole = 'driver' | 'parent' | 'school' | 'rto';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  // Role-specific fields
  vehicleNo?: string;        // For drivers
  licenseNo?: string;        // For drivers
  assignedBusNo?: string;    // For parents
  schoolName?: string;       // For school / parents
  rtoCode?: string;          // For RTO
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}
