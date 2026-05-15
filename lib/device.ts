// Esta función genera un ID único para tu máquina si no existe
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return null;

  let id = localStorage.getItem('device_id');
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('device_id', id);
  }
  return id;
}