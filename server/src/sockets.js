/**
 * Realtime tracking: driver phones publish state/events, watchers (parents,
 * schools, RTO) join per-bus rooms and receive them instantly.
 */
export function registerSockets(io, store) {
  io.on('connection', (socket) => {
    socket.on('bus:watch', ({ busNo } = {}) => {
      if (!busNo) return;
      socket.join(`bus:${busNo}`);
      const live = store.liveBuses.get(busNo);
      if (live) socket.emit('bus:state', live);
    });

    socket.on('bus:unwatch', ({ busNo } = {}) => {
      if (busNo) socket.leave(`bus:${busNo}`);
    });

    socket.on('driver:state', (state) => {
      if (!state?.busNo) return;
      store.liveBuses.set(state.busNo, state);
      io.to(`bus:${state.busNo}`).emit('bus:state', state);
    });

    socket.on('driver:event', (event) => {
      if (!event?.busNo) return;
      io.to(`bus:${event.busNo}`).emit('bus:event', event);
      if (event.type === 'sos') {
        // SOS is broadcast to every connected dashboard, not just watchers.
        io.emit('bus:event', event);
      }
    });
  });
}
