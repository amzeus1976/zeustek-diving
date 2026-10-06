import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CalendarViewTabs} from '../components/planning/calendar-view-tabs';

describe('Calendar view keyboard navigation', () => {
  it('keeps only the selected view in the Tab sequence', () => {
    const html = renderToStaticMarkup(<CalendarViewTabs value="list" onChange={() => {}}/>);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
    expect(html).toContain('aria-selected="true" tabindex="0">List');
  });

  it.each([
    [0, 'ArrowLeft', 2, 'bookings'], [2, 'ArrowRight', 0, 'calendar'],
    [1, 'Home', 0, 'calendar'], [0, 'End', 2, 'bookings'],
    [0, 'ArrowRight', 1, 'list'],
  ])('moves selection and focus together from %s using %s', (index, key, next, view) => {
    const onChange = vi.fn(), preventDefault = vi.fn();
    const buttons = [0, 1, 2].map(() => ({focus: vi.fn()}));
    const tree = CalendarViewTabs({value: 'calendar', onChange});
    tree.props.children[index].props.onKeyDown({key, preventDefault,
      currentTarget: {parentElement: {querySelectorAll: () => buttons}}});
    expect(onChange).toHaveBeenCalledWith(view);
    expect(buttons[next]!.focus).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('leaves ordinary typing and Tab untouched', () => {
    const onChange = vi.fn(), preventDefault = vi.fn();
    const tree = CalendarViewTabs({value: 'calendar', onChange});
    for (const key of ['Tab', 'Enter', 'a']) tree.props.children[0].props.onKeyDown({key, preventDefault});
    expect(onChange).not.toHaveBeenCalled(); expect(preventDefault).not.toHaveBeenCalled();
  });
});
