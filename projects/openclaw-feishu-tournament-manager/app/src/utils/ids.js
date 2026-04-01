export function createLogId() {
  return `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
