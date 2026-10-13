// Seed/reference data mirrored from the app's demo dataset so the live
// backend serves the same fleet the hackathon demo shows.

export const DEMO_BUS_NO = 'JK-01-A-1234';

export const fleet = [
  { busNo: DEMO_BUS_NO, driverName: 'Jehangir Dar', routeName: 'Lal Chowk → Kashmir Valley School', status: 'idle', studentsOnBoard: 32, safetyScore: 92 },
  { busNo: 'JK-01-B-4472', driverName: 'Bashir Ahmad', routeName: 'Rajbagh → Kashmir Valley School', status: 'idle', studentsOnBoard: 28, safetyScore: 88 },
  { busNo: 'JK-01-C-8810', driverName: 'Mohd. Yousuf', routeName: 'Bemina → Kashmir Valley School', status: 'idle', studentsOnBoard: 0, safetyScore: 95 },
  { busNo: 'JK-01-D-2296', driverName: 'Farooq Lone', routeName: 'Soura → Kashmir Valley School', status: 'idle', studentsOnBoard: 35, safetyScore: 71 },
  { busNo: 'JK-01-E-6634', driverName: 'Abdul Majid', routeName: 'HMT → Kashmir Valley School', status: 'idle', studentsOnBoard: 0, safetyScore: 84 },
];

export const rankings = [
  { driverId: 'drv_yousuf', driverName: 'Mohd. Yousuf', busNo: 'JK-01-C-8810', safetyScore: 95, tripsCompleted: 148, violations: 1, trend: 'up' },
  { driverId: 'drv_jehangir', driverName: 'Jehangir Dar', busNo: DEMO_BUS_NO, safetyScore: 92, tripsCompleted: 132, violations: 3, trend: 'up' },
  { driverId: 'drv_bashir', driverName: 'Bashir Ahmad', busNo: 'JK-01-B-4472', safetyScore: 88, tripsCompleted: 126, violations: 4, trend: 'flat' },
  { driverId: 'drv_majid', driverName: 'Abdul Majid', busNo: 'JK-01-E-6634', safetyScore: 84, tripsCompleted: 117, violations: 6, trend: 'down' },
  { driverId: 'drv_farooq', driverName: 'Farooq Lone', busNo: 'JK-01-D-2296', safetyScore: 71, tripsCompleted: 121, violations: 12, trend: 'down' },
];

export const compliance = [
  { busNo: DEMO_BUS_NO, schoolName: 'Kashmir Valley School', routeName: 'Lal Chowk → Kashmir Valley School', insuranceValidTill: '30 Nov 2026', lastInspection: '02 Jun 2026', isCompliant: true },
  { busNo: 'JK-01-B-4472', schoolName: 'Kashmir Valley School', routeName: 'Rajbagh → Kashmir Valley School', insuranceValidTill: '15 Oct 2026', lastInspection: '14 May 2026', isCompliant: true },
  { busNo: 'JK-01-C-8810', schoolName: 'Kashmir Valley School', routeName: 'Bemina → Kashmir Valley School', insuranceValidTill: '09 Dec 2026', lastInspection: '21 Jun 2026', isCompliant: true },
  { busNo: 'JK-01-D-2296', schoolName: 'Kashmir Valley School', routeName: 'Soura → Kashmir Valley School', insuranceValidTill: '28 Feb 2027', lastInspection: '03 Feb 2026', isCompliant: false },
  { busNo: 'JK-01-E-6634', schoolName: 'Green Meadows School', routeName: 'HMT → Green Meadows School', insuranceValidTill: '07 Jan 2027', lastInspection: '11 Apr 2026', isCompliant: true },
];

export const students = [
  { id: 'stu_1', name: 'Ayaan Bhat', className: 'Class 5-A', busNo: DEMO_BUS_NO, parentName: 'Amina Shah', pickupStop: 'Lal Chowk' },
  { id: 'stu_2', name: 'Zoya Mir', className: 'Class 3-B', busNo: DEMO_BUS_NO, parentName: 'Shabnam Mir', pickupStop: 'Khanyar' },
  { id: 'stu_3', name: 'Rehan Wani', className: 'Class 7-A', busNo: 'JK-01-B-4472', parentName: 'Rafiq Wani', pickupStop: 'Hawal' },
  { id: 'stu_4', name: 'Mehak Lone', className: 'Class 4-C', busNo: 'JK-01-B-4472', parentName: 'Sajad Lone', pickupStop: 'Nowhatta' },
  { id: 'stu_5', name: 'Ibrahim Dar', className: 'Class 6-B', busNo: 'JK-01-D-2296', parentName: 'Imran Bhat', pickupStop: 'Naseem Bagh' },
  { id: 'stu_arman', name: 'Arman', className: 'Class 4-A', busNo: DEMO_BUS_NO, parentName: 'Amina Shah', pickupStop: 'Nowhatta' },
];

export const violations = [
  { id: 'vio_1', busNo: 'JK-01-D-2296', driverName: 'Farooq Lone', type: 'Overspeeding', detail: '67 km/h in a 50 km/h zone near Soura', date: '13 Jul 2026', severity: 'high' },
  { id: 'vio_2', busNo: DEMO_BUS_NO, driverName: 'Jehangir Dar', type: 'Overspeeding', detail: '58 km/h near Khanyar', date: '12 Jul 2026', severity: 'medium' },
  { id: 'vio_3', busNo: 'JK-01-D-2296', driverName: 'Farooq Lone', type: 'Route Deviation', detail: '600 m off route near Anchar', date: '11 Jul 2026', severity: 'high' },
  { id: 'vio_4', busNo: 'JK-01-B-4472', driverName: 'Bashir Ahmad', type: 'Long Stop', detail: 'Unscheduled 9 minute stop at Dalgate', date: '10 Jul 2026', severity: 'low' },
  { id: 'vio_5', busNo: 'JK-01-E-6634', driverName: 'Abdul Majid', type: 'Overspeeding', detail: '55 km/h near HMT crossing', date: '09 Jul 2026', severity: 'low' },
  { id: 'vio_6', busNo: 'JK-01-D-2296', driverName: 'Farooq Lone', type: 'Overdue Inspection', detail: 'Last inspected 03 Feb 2026 — past the 6-month limit', date: '08 Jul 2026', severity: 'high' },
];
