'use client';

export type CalendarView = 'calendar' | 'list' | 'bookings';
const views = [['calendar', 'Calendar'], ['list', 'List'], ['bookings', 'Bookings']] as const;

/** Keep keyboard focus and the selected view together, including wraparound. */
export function CalendarViewTabs({value, onChange, className, activeClassName}: {
  value: CalendarView; onChange: (view: CalendarView) => void;
  className?: string | undefined; activeClassName?: string | undefined;
}) {
  return <div className={className} role="tablist" aria-label="Calendar views">
    {views.map(([view, label], index) => <button key={view} type="button" role="tab"
      aria-selected={value === view} tabIndex={value === view ? 0 : -1}
      className={value === view ? activeClassName : undefined}
      onClick={() => onChange(view)} onKeyDown={event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1
          : event.key === 'ArrowRight' ? (index + 1) % views.length
          : event.key === 'ArrowLeft' ? (index + views.length - 1) % views.length : null;
        if (next === null) return;
        event.preventDefault();
        onChange(views[next]![0]);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}>{label}</button>)}
  </div>;
}
