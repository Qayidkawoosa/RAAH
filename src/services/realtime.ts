import { io, Socket } from 'socket.io-client';
import { env, isLiveBackend } from '../config/env';
import { BusLiveState, TripEvent } from '../types/trip';
import { busSimulator } from './demo/busSimulator';

type StateListener = (state: BusLiveState) => void;
type EventListener = (event: TripEvent) => void;

/**
 * Realtime transport with two interchangeable backends:
 *  - live:  Socket.IO connection to the Express server
 *  - demo:  in-app bus simulator (no server required)
 */
class RealtimeService {
  private socket: Socket | null = null;

  private ensureSocket(): Socket {
    if (!this.socket) {
      this.socket = io(env.socketUrl, { transports: ['websocket'] });
    }
    return this.socket;
  }

  /**
   * Watch a bus (parent/school/RTO side). Returns an unsubscribe fn.
   * In live mode, if the server sends nothing within 8 s (server down,
   * wrong IP), the watch falls back to the in-app simulator so tracking
   * screens are never blank.
   */
  subscribeToBus(
    busNo: string,
    onState: StateListener,
    onEvent?: EventListener
  ): () => void {
    if (!isLiveBackend) {
      return busSimulator.subscribe(busNo, onState, onEvent);
    }
    const socket = this.ensureSocket();
    let receivedLiveState = false;
    let fallbackUnsubscribe: (() => void) | null = null;

    const stateHandler = (state: BusLiveState): void => {
      if (state.busNo !== busNo) return;
      receivedLiveState = true;
      if (fallbackUnsubscribe) {
        fallbackUnsubscribe();
        fallbackUnsubscribe = null;
      }
      onState(state);
    };
    const eventHandler = (event: TripEvent & { busNo?: string }): void => {
      if (onEvent && (!event.busNo || event.busNo === busNo)) onEvent(event);
    };
    socket.emit('bus:watch', { busNo });
    socket.on('bus:state', stateHandler);
    socket.on('bus:event', eventHandler);

    const fallbackTimer = setTimeout(() => {
      if (!receivedLiveState) {
        fallbackUnsubscribe = busSimulator.subscribe(busNo, onState, onEvent);
      }
    }, 8000);

    return () => {
      clearTimeout(fallbackTimer);
      fallbackUnsubscribe?.();
      socket.emit('bus:unwatch', { busNo });
      socket.off('bus:state', stateHandler);
      socket.off('bus:event', eventHandler);
    };
  }

  /** Publish the driver's live state (driver side, live backend only). */
  publishDriverState(state: BusLiveState): void {
    if (!isLiveBackend) return;
    this.ensureSocket().emit('driver:state', state);
  }

  /** Publish a safety event raised on the driver's phone. */
  publishEvent(busNo: string, event: TripEvent): void {
    if (!isLiveBackend) return;
    this.ensureSocket().emit('driver:event', { ...event, busNo });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const realtimeService = new RealtimeService();
