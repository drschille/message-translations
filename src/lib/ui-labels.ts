import type { TFunction } from 'i18next';

export function statusLabel(status: string, t: TFunction): string {
  if (status === 'approved') return t('status.approved');
  if (status === 'needs_review') return t('status.needsReview');
  if (status === 'drafting') return t('status.drafting');
  return t('status.draft');
}

export function formatRelativeTime(timestamp: number, t: TFunction): string {
  const deltaMs = Date.now() - timestamp;
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });
  return t('time.daysAgo', { count: Math.floor(hours / 24) });
}
