/**
 * dmsTelemetryBus.ts
 *
 * Real-Time Telemetry Bus for Driver Monitoring System (DMS) Anomalies.
 *
 * ============================================================================
 * ARCHITECTURE NOTICE (FUTURE BACKEND MIGRATION):
 * This module currently provides real-time cross-tab and cross-screen synchronization
 * for demonstration & standalone operation using the HTML5 BroadcastChannel API,
 * window storage events, and AsyncStorage.
 *
 * When migrating to a dedicated backend in the future:
 *  - Replace the transport methods inside this file with your WebSocket, Socket.IO,
 *    or Server-Sent Events (SSE) client.
 *  - NO UI components or dashboard screens will need to be refactored because they
 *    depend solely on the abstract publish/subscribe interface provided here.
 * ============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafetyEvent, SafetyEventType, SafetyEventSeverity } from '../../types/fleet';
import { tripService } from '../tripService';

const DMS_BROADCAST_CHANNEL_NAME = 'raasta_dms_anomalies_channel';
const DMS_STORAGE_TRIGGER_KEY = '@raasta_dms_live_anomaly_trigger';
const DMS_PERSISTED_INCIDENTS_KEY = '@raasta_safety_events';

export interface DMSAnomalyNotification {
  event: SafetyEvent;
  broadcastTimestamp: number;
}

class DMSTelemetryBus {
  private channel: BroadcastChannel | null = null;
  private subscribers: Set<(event: SafetyEvent) => void> = new Set();
  private isStorageListenerAttached: boolean = false;

  constructor() {
    this.initTransport();
  }

  private initTransport(): void {
    // 1. Initialize BroadcastChannel if available in environment (Browsers / Web)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(DMS_BROADCAST_CHANNEL_NAME);
        this.channel.onmessage = (messageEvent) => {
          if (messageEvent?.data?.event) {
            this.notifyLocalSubscribers(messageEvent.data.event);
          }
        };
      } catch (err) {
        console.warn('[DMSTelemetryBus] BroadcastChannel not supported or restricted:', err);
      }
    }

    // 2. Cross-Tab Storage Event Listener (Fallback & multi-tab support)
    if (typeof window !== 'undefined' && !this.isStorageListenerAttached) {
      this.isStorageListenerAttached = true;
      window.addEventListener('storage', (event) => {
        if (event.key === DMS_STORAGE_TRIGGER_KEY && event.newValue) {
          try {
            const parsed: DMSAnomalyNotification = JSON.parse(event.newValue);
            if (parsed?.event) {
              this.notifyLocalSubscribers(parsed.event);
            }
          } catch {
            // Ignore malformed storage payload
          }
        }
      });
    }
  }

  /**
   * Broadcast an anomaly / safety event detected by the DMS engine.
   * Dispatches via BroadcastChannel, localStorage triggers, and persists to AsyncStorage.
   */
  public async broadcastSafetyEvent(event: SafetyEvent): Promise<void> {
    const payload: DMSAnomalyNotification = {
      event,
      broadcastTimestamp: Date.now(),
    };

    // 1. Notify any subscribers within the current window/tab
    this.notifyLocalSubscribers(event);

    // 2. Broadcast to other open tabs/windows via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (err) {
        console.warn('[DMSTelemetryBus] BroadcastChannel postMessage error:', err);
      }
    }

    // 3. Trigger cross-tab storage event via localStorage (Web)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(DMS_STORAGE_TRIGGER_KEY, JSON.stringify(payload));
      } catch {
        // Ignore quota errors
      }
    }

    // 4. Persist to storage through tripService for historical incident review
    try {
      await tripService.recordSafetyEvent(event);
    } catch (err) {
      console.warn('[DMSTelemetryBus] Failed to persist safety event:', err);
    }
  }

  /**
   * Subscribe to real-time anomalies (used by Admin Dashboard & Incident Review).
   * Returns an unsubscribe callback.
   */
  public subscribeToSafetyEvents(callback: (event: SafetyEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Retrieve all recent persisted anomalies for the admin dashboard.
   */
  public async getRecentAnomalies(): Promise<SafetyEvent[]> {
    try {
      return await tripService.getSafetyEvents();
    } catch {
      return [];
    }
  }

  /**
   * Internal dispatcher for registered listeners
   */
  private notifyLocalSubscribers(event: SafetyEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.error('[DMSTelemetryBus] Error executing subscriber callback:', err);
      }
    });
  }

  /**
   * Clean up transport resources if needed
   */
  public destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.subscribers.clear();
  }
}

// Singleton Telemetry Bus Instance
export const dmsTelemetryBus = new DMSTelemetryBus();
