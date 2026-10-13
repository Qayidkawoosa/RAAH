# RAASTA KASHMIR — Audit & Bug Fix Report

**Date:** September 30, 2026  
**Status:** All TypeScript checks passing (`tsc --noEmit` = 0 errors), Expo bundle validated (3,146 modules bundled successfully).

---

## 1. Executive Summary
This document provides a complete record of the fixes, type alignments, and performance/UX optimizations applied across the **RAASTA KASHMIR** codebase. The adjustments resolve critical TypeScript compilation errors, platform parity mismatches across mobile and web map layers, potential runtime `undefined` index crashes, and nested scroll view gesture conflicts.

---

## 2. Detailed List of Changes

### 2.1 Parent Module Fixes
- **File:** `src/screens/parent/ParentHomeScreen.tsx`
  - **Issue:** TypeScript error `TS2538: Type 'undefined' cannot be used as an index type` occurred when accessing `dropoffStatus[selectedStudent?.id]`.
  - **Fix:** Guarded the check to verify `selectedStudent` existence before indexing:
    ```tsx
    {selectedStudent && (dropoffStatus[selectedStudent.id] === 'dropped' || proximity.phase === 'arrived') ? (
      ...
    ) : null}
    ```
  - **Impact:** Prevents runtime `undefined` evaluation and guarantees strict type safety for student drop-off status checks.

---

### 2.2 Driver Module Fixes
- **File:** `src/screens/driver/DriverHomeScreen.tsx`
  - **Issue:** `TS2322: Type '"default"' is not assignable to type '"danger" | "gradient" | "outline" | undefined'`. The drop-off button passed `variant="default"` which is not a valid `PrimaryButton` variant.
  - **Fix:** Updated the button variant to `"gradient"` when not dropped:
    ```tsx
    <PrimaryButton
      label={droppedNotified ? "Dropped ✓" : "Confirm Drop-off"}
      onPress={handleDriverDropoff}
      disabled={droppedNotified}
      variant={droppedNotified ? "outline" : "gradient"}
      style={{ height: 32, paddingVertical: 0, minWidth: 125 }}
    />
    ```
  - **Impact:** Aligns with design system tokens and resolves component interface violation.

---

### 2.3 Map Components & Shared Platform Typing
- **Files:** 
  - `src/components/LiveMap.d.ts`
  - `src/components/LiveMap.web.tsx`
  - `src/screens/shared/FullMapScreen.tsx`
  - `src/screens/shared/TripDetailScreen.tsx`
  - `src/screens/rto/RtoDashboardScreen.tsx`
- **Issues:**
  - `LiveMap.d.ts` defined `routePath?: string` instead of `LatLng[]`.
  - `LiveMap.d.ts` was missing props `heading`, `pickupLocation`, `idleBuses`, and `isolatedStopName`.
  - Missing `heading` caused `TS2322` on `RtoDashboardScreen.tsx`.
  - Type mismatch on `routePath` caused `TS2322` on `FullMapScreen.tsx` and `TripDetailScreen.tsx`.
- **Fixes:**
  - Updated `LiveMapProps` in `LiveMap.d.ts` and `LiveMap.web.tsx` to match `LiveMap.native.tsx`:
    ```ts
    export interface LiveMapProps {
      busLocation?: LatLng | null;
      heading?: number;
      height?: number;
      followBus?: boolean;
      pickupLocation?: LatLng | null;
      idleBuses?: { busNo: string; location: LatLng }[];
      stopStudentCounts?: Record<string, number>;
      students?: Student[];
      isolatedStopName?: string | null;
      onExpand?: () => void;
      routePath?: LatLng[];
      stops?: BusStop[];
    }
    ```
  - Corrected imports in `LiveMap.d.ts` to reference `LatLng`, `BusStop` from `../types/trip` and `Student` from `../types/fleet`.
- **Impact:** Full cross-platform typing consistency between Native and Web map implementations with zero type discrepancies.

---

### 2.4 State Management & Custom Hooks
- **File:** `src/hooks/useBusLocations.ts`
  - **Issue:** Function inferred a union return type (`{ location } | { locations }`) when `busId` was optional. When calling `const { locations } = useBusLocations()`, `locations` was inferred as potentially `undefined`, triggering `TS2769: No overload matches this call` on `Object.values(locations)` in `RtoLiveFleetScreen.tsx` and `SchoolDashboardScreen.tsx`.
  - **Fix:** Standardized hook return shape so both `locations` and `location` are always defined:
    ```ts
    return {
      locations,
      location: busId ? locations[busId] || null : null,
    };
    ```
  - **Impact:** Eliminates runtime crashes or undefined dictionary errors across fleet overview screens.

---

### 2.5 Data Services
- **File:** `src/services/tripService.ts`
  - **Issue:** `TS2739: Type missing properties from type 'FleetBus': studentsOnBoard, safetyScore` inside `addFleetBus`.
  - **Fix:** Provided default baseline values (`studentsOnBoard: 0`, `safetyScore: 100`) when creating a new bus record:
    ```ts
    const newBus: FleetBus = {
      busNo,
      driverName,
      routeName,
      status: 'idle',
      studentsOnBoard: 0,
      safetyScore: 100,
    };
    ```
  - **Impact:** Guarantees fleet models remain schema-compliant when new buses are registered.

---

### 2.6 Navigation & Screen Definitions
- **File:** `src/navigation/types.ts`
  - **Issue:** `SchoolTabParamList` lacked `Students`, and `RtoTabParamList` lacked `RtoLiveFleet`, which are active tabs configured in `RoleTabs.tsx`.
  - **Fix:** Added missing route keys to the navigation param list:
    ```ts
    export type SchoolTabParamList = {
      SchoolHome: undefined;
      Students: undefined;
      Complaints: undefined;
      Rankings: undefined;
      Profile: undefined;
    };

    export type RtoTabParamList = {
      RtoHome: undefined;
      RtoLiveFleet: undefined;
      Violations: undefined;
      Profile: undefined;
    };
    ```
  - **Impact:** Full type safety when navigating between school and RTO role tabs.

---

### 2.7 UI & Gesture Optimizations
- **File:** `src/screens/school/SchoolIncidentReviewScreen.tsx`
  - Added `onBack={() => navigation.goBack()}` to `ScreenHeader` so users can return to the dashboard from the queue.
  - Removed redundant nested `ScrollView` inside `ScreenContainer` and cleaned up unused `StyleSheet` / `ScrollView` imports.
- **File:** `src/screens/school/SchoolFleetManagementScreen.tsx`
  - Replaced inner vertical `ScrollView` with `<View style={{ paddingBottom: 40 }}>` inside `ScreenContainer`.
  - **Impact:** Prevents React Native "nested VirtualizedLists / ScrollViews with same orientation" warnings and allows pull-to-refresh (`onRefresh={loadData}`) to function smoothly without scroll fight.

---

## 3. Verification & Test Results
| Test Suite | Command | Result |
| :--- | :--- | :--- |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **Pass (0 errors)** |
| **Expo Web Bundle** | `npx expo export --platform web` | **Pass (3,146 modules bundled)** |
