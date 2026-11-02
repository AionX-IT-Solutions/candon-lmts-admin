export const SESSION_EXPIRED_EVENT = 'lis:session-expired'

export function notifySessionExpired(): void {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
