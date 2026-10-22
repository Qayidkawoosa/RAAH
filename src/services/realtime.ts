import { io, Socket } from 'socket.io-client';
import { env } from '../config/env';
import { BusLiveState, TripEvent } from '../types/trip';

type StateListener = (state: BusLiveState) => void;
type EventListener = (event: TripEvent) => void;

/**
 * Realtime transport with two interchangeable backends:
 *  - live:  Socket.IO connection to the Express server
 *  - demo:  in-app bus simulator (no server required)
 */
class RealtimeService {
  private socket: Socket | null = null;

  ensureSocket(): Socket {
    if (!this.socket) {
      this.socket = io(env.socketUrl, { transports: ['websocket'] });
    }
    return this.socket;
  }

  /**
   * Watch a bus (parent/school/RTO side). Returns an unsubscribe fn.
   * Only real Socket.IO telemetry is accepted — the simulator is disabled.
   */
  subscribeToBus(
    busNo: string,
    onState: StateListener,
    onEvent?: EventListener
  ): () => void {
    if (!env.socketUrl) return () => {};
    const socket = this.ensureSocket();

    const stateHandler = (state: BusLiveState): void => {
      if (state.busNo !== busNo) return;
      onState(state);
    };
    const eventHandler = (event: TripEvent & { busNo?: string }): void => {
      if (onEvent && (!event.busNo || event.busNo === busNo)) onEvent(event);
    };
    socket.emit('bus:watch', { busNo });
    socket.on('bus:state', stateHandler);
    socket.on('bus:event', eventHandler);

    return () => {
      socket.emit('bus:unwatch', { busNo });
      socket.off('bus:state', stateHandler);
      socket.off('bus:event', eventHandler);
    };
  }

  /** Publish the driver's live state (driver side). */
  publishDriverState(state: BusLiveState): void {
    this.ensureSocket().emit('driver:state', state);
  }

  /** Publish a safety event raised on the driver's phone. */
  publishEvent(busNo: string, event: TripEvent): void {
    this.ensureSocket().emit('driver:event', { ...event, busNo });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const realtimeService = new RealtimeService();
