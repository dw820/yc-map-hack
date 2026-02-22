interface ActiveSessions {
  cashBrowserUrl: string | null;
  awardBrowserUrl: string | null;
}

let sessions: ActiveSessions = { cashBrowserUrl: null, awardBrowserUrl: null };

export function setCashBrowserUrl(url: string | null): void {
  sessions.cashBrowserUrl = url;
}

export function setAwardBrowserUrl(url: string | null): void {
  sessions.awardBrowserUrl = url;
}

export function getActiveSessions(): ActiveSessions {
  return { ...sessions };
}

export function clearActiveSessions(): void {
  sessions = { cashBrowserUrl: null, awardBrowserUrl: null };
}
