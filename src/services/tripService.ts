import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { isLiveBackend } from '../config/env';
import { Trip } from '../types/trip';
import {
  AnalyticsSummary,
  Complaint,
  ComplianceRecord,
  DriverRanking,
  FleetBus,
  SafetyEvent,
  SafetyEventStatus,
  Student,
  ViolationRecord,
} from '../types/fleet';
import {
  buildDemoHistory,
  demoAnalytics,
  demoComplaints,
  demoCompliance,
  demoFleet,
  demoRankings,
  demoStudents,
  demoViolations,
} from './demo/demoData';
import { createId } from '../utils/id';
import { ALL_ROUTES } from '../constants/demoRoute';

const HISTORY_KEY = '@raasta_trip_history';
const COMPLAINTS_KEY = '@raasta_complaints';
const STUDENTS_KEY = '@raasta_students';
const FLEET_KEY = '@raasta_fleet';
const SAFETY_EVENTS_KEY = '@raasta_safety_events';

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Try the live backend first; if it is unreachable (wrong IP, server down,
 * phone off Wi-Fi) fall back to demo data so no screen is ever stuck on a
 * skeleton. Demo mode skips the network entirely.
 */
const liveOrDemo = async <T>(live: () => Promise<T>, demo: () => Promise<T>): Promise<T> => {
  if (!isLiveBackend) return demo();
  try {
    return await live();
  } catch {
    return demo();
  }
};

const saveLocalTrip = async (trip: Trip): Promise<void> => {
  const stored = await readJson<Trip[]>(HISTORY_KEY, []);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify([trip, ...stored].slice(0, 50)));
};

export const tripService = {
  /** Persist a finished trip (backend when live, AsyncStorage as fallback). */
  async saveTrip(trip: Trip): Promise<void> {
    await liveOrDemo(
      async () => {
        await apiClient.post('/api/trips', trip);
      },
      () => saveLocalTrip(trip)
    );
  },

  async getTripHistory(driverId: string, driverName: string, busNo: string): Promise<Trip[]> {
    const demo = async (): Promise<Trip[]> => {
      const stored = await readJson<Trip[]>(HISTORY_KEY, []);
      return [...stored, ...buildDemoHistory(driverId, driverName, busNo)];
    };
    return liveOrDemo(async () => {
      const { data } = await apiClient.get<Trip[]>('/api/trips', { params: { busNo } });
      return data.length > 0 ? data : demo();
    }, demo);
  },

  async getFleet(): Promise<FleetBus[]> {
    return liveOrDemo(
      async () => {
        const res = await apiClient.get<any>('/api/fleet');
        const list = Array.isArray(res.data) ? res.data : (res.data?.buses || []);
        return list;
      },
      async () => {
        const stored = await readJson<FleetBus[]>(FLEET_KEY, demoFleet);
        return stored;
      }
    );
  },

  async addFleetBus(busNo: string, driverName: string, routeName: string): Promise<FleetBus> {
    const newBus: FleetBus = {
      busNo,
      driverName,
      routeName,
      status: 'idle',
      studentsOnBoard: 0,
      safetyScore: 100,
    };
    return liveOrDemo(
      async () => (await apiClient.post<FleetBus>('/api/fleet', newBus)).data,
      async () => {
        const stored = await readJson<FleetBus[]>(FLEET_KEY, demoFleet);
        const updated = [...stored, newBus];
        await AsyncStorage.setItem(FLEET_KEY, JSON.stringify(updated));
        return newBus;
      }
    );
  },

  async enrollDriver(payload: {
    driverName: string;
    phone: string;
    busNo: string;
    routeId: string;
    password: string;
    schoolId?: string;
  }): Promise<{ status: string; driverEmail: string; busNo: string; routeId: string }> {
    const matchedRoute = ALL_ROUTES.find((r) => r.id === payload.routeId) || ALL_ROUTES[0];
    const routeName = matchedRoute?.routeName || 'Assigned Planned Route';

    return liveOrDemo(
      async () => {
        const res = await apiClient.post<{ status: string; driverEmail: string; busNo: string; routeId: string }>(
          '/api/fleet/enroll-driver',
          payload
        );
        // Also cache locally for offline demo resilience
        const driverEmail = res.data.driverEmail;
        const mockDriver = {
          uid: `driver_${payload.phone}`,
          email: driverEmail,
          name: payload.driverName,
          phone: payload.phone,
          role: 'driver' as const,
          vehicleNo: payload.busNo,
          assignedBusNo: payload.busNo,
          schoolName: 'Kashmir Valley School',
        };
        const usersRaw = await AsyncStorage.getItem('@raasta_mock_users');
        const users = usersRaw ? JSON.parse(usersRaw) : [];
        await AsyncStorage.setItem('@raasta_mock_users', JSON.stringify([...users.filter((u: any) => u.phone !== payload.phone && u.email !== driverEmail), mockDriver]));

        return res.data;
      },
      async () => {
        const driverEmail = payload.driverName.toLowerCase().replace(/\s+/g, '') + '@kashmirschool.edu';
        const newBus: FleetBus = {
          busNo: payload.busNo,
          driverName: payload.driverName,
          routeName: routeName,
          status: 'idle',
          studentsOnBoard: 0,
          safetyScore: 100,
        };
        const stored = await readJson<FleetBus[]>(FLEET_KEY, demoFleet);
        const updated = [...stored.filter((b) => b.busNo !== payload.busNo), newBus];
        await AsyncStorage.setItem(FLEET_KEY, JSON.stringify(updated));

        // Save mock driver user with phone number for phone-based login
        const mockDriver = {
          uid: `driver_${payload.phone}`,
          email: driverEmail,
          name: payload.driverName,
          phone: payload.phone,
          role: 'driver' as const,
          vehicleNo: payload.busNo,
          assignedBusNo: payload.busNo,
          schoolName: 'Kashmir Valley School',
        };
        const usersRaw = await AsyncStorage.getItem('@raasta_mock_users');
        const users = usersRaw ? JSON.parse(usersRaw) : [];
        await AsyncStorage.setItem('@raasta_mock_users', JSON.stringify([...users.filter((u: any) => u.phone !== payload.phone && u.email !== driverEmail), mockDriver]));

        return {
          status: 'success',
          driverEmail,
          busNo: payload.busNo,
          routeId: payload.routeId,
        };
      }
    );
  },

  async getRoutes(): Promise<any[]> {
    return liveOrDemo(
      async () => {
        const res = await apiClient.get<any>('/api/fleet/routes');
        const list = res.data?.routes || [];
        return list.length > 0 ? list : ALL_ROUTES.map((r, i) => ({
          id: r.id || `route_${i + 1}`,
          name: r.routeName,
          description: `${r.stops.length} stops in Srinagar`,
          stops: r.stops.map((s, idx) => ({
            name: s.name,
            latitude: s.location.latitude,
            longitude: s.location.longitude,
            stopOrder: idx + 1,
          })),
        }));
      },
      async () => {
        return ALL_ROUTES.map((r, i) => ({
          id: r.id || `route_${i + 1}`,
          name: r.routeName,
          description: `${r.stops.length} stops in Srinagar`,
          stops: r.stops.map((s, idx) => ({
            name: s.name,
            latitude: s.location.latitude,
            longitude: s.location.longitude,
            stopOrder: idx + 1,
          })),
        }));
      }
    );
  },

  async getDriverAssignedRoute(busNo: string): Promise<any> {
    return liveOrDemo(
      async () => {
        const res = await apiClient.get<any>('/api/fleet/driver-route', { params: { busNo } });
        return res.data;
      },
      async () => {
        const matched = ALL_ROUTES.find((r) => r.busNo === busNo) || ALL_ROUTES[0];
        return {
          status: 'success',
          busNo,
          routeId: 'demo_route',
          routeName: matched.routeName,
          route: {
            id: 'demo_route',
            name: matched.routeName,
            stops: matched.stops.map((s, i) => ({
              name: s.name,
              latitude: s.location.latitude,
              longitude: s.location.longitude,
              stopOrder: i + 1,
            })),
          },
          path: matched.path,
        };
      }
    );
  },

  async removeFleetBus(busNo: string): Promise<void> {
    await liveOrDemo(
      async () => {
        await apiClient.delete(`/api/fleet/${encodeURIComponent(busNo)}`);
        // Clean local cache as well
        const stored = await readJson<FleetBus[]>(FLEET_KEY, demoFleet);
        const updated = stored.filter((b) => b.busNo.toUpperCase() !== busNo.toUpperCase());
        await AsyncStorage.setItem(FLEET_KEY, JSON.stringify(updated));

        const usersRaw = await AsyncStorage.getItem('@raasta_mock_users');
        if (usersRaw) {
          const users = JSON.parse(usersRaw);
          const filteredUsers = users.filter((u: any) => u.assignedBusNo?.toUpperCase() !== busNo.toUpperCase() && u.vehicleNo?.toUpperCase() !== busNo.toUpperCase());
          await AsyncStorage.setItem('@raasta_mock_users', JSON.stringify(filteredUsers));
        }
      },
      async () => {
        const stored = await readJson<FleetBus[]>(FLEET_KEY, demoFleet);
        const updated = stored.filter((b) => b.busNo.toUpperCase() !== busNo.toUpperCase());
        await AsyncStorage.setItem(FLEET_KEY, JSON.stringify(updated));

        const usersRaw = await AsyncStorage.getItem('@raasta_mock_users');
        if (usersRaw) {
          const users = JSON.parse(usersRaw);
          const filteredUsers = users.filter((u: any) => u.assignedBusNo?.toUpperCase() !== busNo.toUpperCase() && u.vehicleNo?.toUpperCase() !== busNo.toUpperCase());
          await AsyncStorage.setItem('@raasta_mock_users', JSON.stringify(filteredUsers));
        }
      }
    );
  },

  async getRankings(): Promise<DriverRanking[]> {
    return liveOrDemo(
      async () => (await apiClient.get<DriverRanking[]>('/api/rankings')).data,
      async () => demoRankings
    );
  },

  async getComplaints(): Promise<Complaint[]> {
    const demo = async (): Promise<Complaint[]> => {
      const stored = await readJson<Complaint[]>(COMPLAINTS_KEY, []);
      return [...stored, ...demoComplaints];
    };
    return liveOrDemo(async () => {
      const { data } = await apiClient.get<Complaint[]>('/api/complaints');
      if (data.length === 0) return demo();
      // Older documents may lack an id; assign one locally so list keys and
      // status updates always target exactly one complaint.
      return data.map((item) => (item.id ? item : { ...item, id: createId('cmp') }));
    }, demo);
  },

  async submitComplaint(
    busNo: string,
    parentName: string,
    text: string,
    analysis?: Complaint['analysis']
  ): Promise<Complaint> {
    const complaint: Complaint = {
      id: createId('cmp'),
      busNo,
      parentName,
      text,
      createdAt: Date.now(),
      status: 'open',
      analysis,
    };
    return liveOrDemo(
      async () =>
        (await apiClient.post<Complaint>('/api/complaints', { busNo, parentName, text, analysis })).data,
      async () => {
        const stored = await readJson<Complaint[]>(COMPLAINTS_KEY, []);
        await AsyncStorage.setItem(COMPLAINTS_KEY, JSON.stringify([complaint, ...stored]));
        return complaint;
      }
    );
  },

  async getStudents(): Promise<Student[]> {
    return liveOrDemo(
      async () => (await apiClient.get<Student[]>('/api/students')).data,
      async () => {
        const stored = await readJson<Student[]>(STUDENTS_KEY, []);
        const merged = [...stored];
        for (const defaultStu of demoStudents) {
          if (!merged.some((s) => s.id === defaultStu.id)) {
            merged.push(defaultStu);
          }
        }
        await AsyncStorage.setItem(STUDENTS_KEY, JSON.stringify(merged));
        return merged;
      }
    );
  },

  async addStudent(
    name: string,
    className: string,
    busNo: string,
    pickupStop?: string
  ): Promise<Student> {
    const student: Student = { id: createId('stu'), name, className, busNo, pickupStop };
    return liveOrDemo(
      async () =>
        (await apiClient.post<Student>('/api/students', { name, className, busNo, pickupStop }))
          .data,
      async () => {
        const stored = await readJson<Student[]>(STUDENTS_KEY, demoStudents);
        await AsyncStorage.setItem(STUDENTS_KEY, JSON.stringify([...stored, student]));
        return student;
      }
    );
  },

  async removeStudent(id: string): Promise<void> {
    await liveOrDemo(
      async () => {
        await apiClient.delete(`/api/students/${id}`);
      },
      async () => {
        const stored = await readJson<Student[]>(STUDENTS_KEY, demoStudents);
        await AsyncStorage.setItem(
          STUDENTS_KEY,
          JSON.stringify(stored.filter((student) => student.id !== id))
        );
      }
    );
  },

  async updateComplaintStatus(id: string, status: Complaint['status']): Promise<void> {
    await liveOrDemo(
      async () => {
        await apiClient.patch(`/api/complaints/${id}`, { status });
      },
      async () => {
        const stored = await readJson<Complaint[]>(COMPLAINTS_KEY, []);
        const updated = stored.map((item) => (item.id === id ? { ...item, status } : item));
        await AsyncStorage.setItem(COMPLAINTS_KEY, JSON.stringify(updated));
      }
    );
  },

  async updateComplaintAnalysis(id: string, analysis: Complaint['analysis']): Promise<void> {
    await liveOrDemo(
      async () => {
        await apiClient.patch(`/api/complaints/${id}`, { analysis });
      },
      async () => {
        const stored = await readJson<Complaint[]>(COMPLAINTS_KEY, []);
        const updated = stored.map((item) => (item.id === id ? { ...item, analysis } : item));
        await AsyncStorage.setItem(COMPLAINTS_KEY, JSON.stringify(updated));
      }
    );
  },

  async getCompliance(): Promise<ComplianceRecord[]> {
    return liveOrDemo(
      async () => (await apiClient.get<ComplianceRecord[]>('/api/compliance')).data,
      async () => demoCompliance
    );
  },

  async getViolations(): Promise<ViolationRecord[]> {
    return liveOrDemo(
      async () => (await apiClient.get<ViolationRecord[]>('/api/violations')).data,
      async () => demoViolations
    );
  },

  async getAnalytics(): Promise<AnalyticsSummary> {
    return liveOrDemo(
      async () => (await apiClient.get<AnalyticsSummary>('/api/analytics')).data,
      async () => demoAnalytics
    );
  },

  async linkParentToStudent(studentIdOrCode: string, parentName: string): Promise<Student | null> {
    const rawId = studentIdOrCode.trim().toLowerCase().replace('stu-', 'stu_');
    const id = rawId.startsWith('stu_') ? rawId : `stu_${rawId}`;
    return liveOrDemo(
      async () => (await apiClient.patch<Student>(`/api/students/${id}/link`, { parentName })).data,
      async () => {
        const stored = await readJson<Student[]>(STUDENTS_KEY, demoStudents);
        const index = stored.findIndex((s) => s.id.toLowerCase() === id);
        if (index !== -1) {
          stored[index].parentName = parentName;
          await AsyncStorage.setItem(STUDENTS_KEY, JSON.stringify(stored));
          return stored[index];
        }
        return null;
      }
    );
  },

  async getSafetyEvents(): Promise<SafetyEvent[]> {
    return liveOrDemo(
      async () => (await apiClient.get<SafetyEvent[]>('/api/safety-events')).data,
      async () => {
        return await readJson<SafetyEvent[]>(SAFETY_EVENTS_KEY, []);
      }
    );
  },

  async recordSafetyEvent(event: SafetyEvent): Promise<void> {
    await liveOrDemo(
      async () => {
        await apiClient.post('/api/safety-events', event);
      },
      async () => {
        const stored = await readJson<SafetyEvent[]>(SAFETY_EVENTS_KEY, []);
        const updated = [event, ...stored.filter(e => e.event_id !== event.event_id)].slice(0, 100);
        await AsyncStorage.setItem(SAFETY_EVENTS_KEY, JSON.stringify(updated));
      }
    );
  },

  async updateSafetyEventStatus(
    eventId: string,
    status: SafetyEventStatus,
    reviewNote?: string
  ): Promise<void> {
    await liveOrDemo(
      async () => {
        await apiClient.patch(`/api/safety-events/${eventId}`, { status, reviewNote });
      },
      async () => {
        const stored = await readJson<SafetyEvent[]>(SAFETY_EVENTS_KEY, []);
        const updated = stored.map((item) =>
          item.event_id === eventId
            ? {
                ...item,
                status,
                reviewed_at: new Date().toISOString(),
                review_note: reviewNote || item.review_note,
              }
            : item
        );
        await AsyncStorage.setItem(SAFETY_EVENTS_KEY, JSON.stringify(updated));
      }
    );
  },
};
