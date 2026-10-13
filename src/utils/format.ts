export const formatClockTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export const formatDuration = (ms: number): string => {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
};

export const formatKm = (km: number): string => `${km.toFixed(1)} km`;

export const formatSpeed = (kmh: number): string => `${Math.round(kmh)} km/h`;

export const timeAgo = (timestamp: number): string => {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
