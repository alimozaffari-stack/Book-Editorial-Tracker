export interface ActivityViewEvent { id: string; actorEmail: string; action: string; summary: string; chapterId?: string; chapterIds?: string[]; clientAt?: string; }
export interface ActivityFilters { person: string; chapter: string; action: string; }

export function filterActivityEvents(events: ActivityViewEvent[], filters: ActivityFilters, projectStartedAt?: string): ActivityViewEvent[] {
  const person = filters.person.trim().toLowerCase(); const chapter = filters.chapter.trim().toLowerCase(); const action = filters.action.trim().toLowerCase();
  const cutoff = projectStartedAt?.trim();
  return events.filter(event => {
    const affectedChapters = [event.chapterId, ...(event.chapterIds ?? [])].filter((value): value is string => Boolean(value));
    if (cutoff && event.clientAt && event.clientAt < cutoff) return false;
    return (!person || event.actorEmail.toLowerCase().includes(person))
      && (!chapter || affectedChapters.some(id => id.toLowerCase().includes(chapter)))
      && (!action || event.action.toLowerCase().includes(action));
  });
}

function escapeCsv(value: unknown): string { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export function activityEventsToCsv(events: ActivityViewEvent[]): string {
  return ['timestamp,actor,action,chapter,summary', ...events.map(event => [event.clientAt ?? '', event.actorEmail, event.action, event.chapterId ?? event.chapterIds?.join('; ') ?? '', event.summary].map(escapeCsv).join(','))].join('\r\n');
}
