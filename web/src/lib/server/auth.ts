// ── Auth helper: extract session from Bearer token ──
import { getWorldState } from './world-state';

export function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  return getWorldState().getSessionByToken(token);
}
