import type { MouseEvent } from 'react';
import type { DayModel } from '../calendar-model.js';
import { formatHumanDate } from '../calendar-model.js';
import type { DayDraftState } from '../draft.js';
import styles from './Calendar.module.css';

/** Коллега, у которого этот день тоже отпуск. */
export interface DayMark {
  id: number;
  displayName: string;
  color: string;
}

interface DayCellProps {
  day: DayModel;
  state: DayDraftState;
  /** Цвет текущего пользователя — им заливается своя отметка. */
  ownColor: string;
  marks: DayMark[];
  /** false, если пользователь ещё не вошёл. */
  editable: boolean;
  onClick: (date: string, shiftKey: boolean) => void;
}

const MAX_VISIBLE_MARKS = 4;

function buildTitle(day: DayModel, selected: boolean, marks: DayMark[]): string {
  const names = [...(selected ? ['вы'] : []), ...marks.map((mark) => mark.displayName)];
  const header = formatHumanDate(day.date);
  const vacations = names.length === 0 ? `${header} — отпусков нет` : `${header}: ${names.join(', ')}`;
  // У праздничного дня первой строкой идёт название праздника.
  return day.holiday ? `${day.holiday}\n${vacations}` : vacations;
}

export function DayCell({
  day,
  state,
  ownColor,
  marks,
  editable,
  onClick,
}: DayCellProps): JSX.Element {
  const selected = state === 'saved' || state === 'added';
  const visible = marks.length > MAX_VISIBLE_MARKS ? marks.slice(0, 3) : marks;
  const hiddenCount = marks.length - visible.length;

  const classNames = [styles.day, styles[`day_${state}`]];
  // Праздник важнее выходного: если они совпали, ячейка выглядит как праздник.
  if (day.holiday) classNames.push(styles.dayHoliday);
  else if (day.weekend) classNames.push(styles.dayWeekend);
  if (!editable) classNames.push(styles.dayReadonly);

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick(day.date, event.shiftKey);
  };

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      style={selected ? { ['--own-color' as string]: ownColor } : undefined}
      title={buildTitle(day, selected, marks)}
      aria-pressed={editable ? selected : undefined}
      disabled={!editable}
      onClick={handleClick}
    >
      <span className={styles.dayNumber}>{day.day}</span>
      {marks.length > 0 ? (
        <span className={styles.marks}>
          {visible.map((mark) => (
            <span
              key={mark.id}
              className={styles.mark}
              style={{ background: mark.color }}
              aria-hidden="true"
            />
          ))}
          {hiddenCount > 0 ? <span className={styles.markMore}>+{hiddenCount}</span> : null}
        </span>
      ) : null}
    </button>
  );
}
