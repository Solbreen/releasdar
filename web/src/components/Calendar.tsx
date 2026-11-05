import { WEEKDAY_NAMES_RU, type MonthModel } from '../calendar-model.js';
import type { Draft } from '../draft.js';
import { dayState } from '../draft.js';
import { DayCell, type DayMark } from './DayCell.js';
import styles from './Calendar.module.css';

interface CalendarProps {
  months: MonthModel[];
  draft: Draft;
  ownColor: string;
  /** Отметки коллег по датам. */
  marksByDate: Map<string, DayMark[]>;
  editable: boolean;
  onDayClick: (date: string, shiftKey: boolean) => void;
}

export function Calendar({
  months,
  draft,
  ownColor,
  marksByDate,
  editable,
  onDayClick,
}: CalendarProps): JSX.Element {
  return (
    <div className={styles.year}>
      {months.map((month) => (
        <section className={styles.month} key={month.month}>
          <h3 className={styles.monthTitle}>{month.title}</h3>
          <div className={styles.weekdays}>
            {WEEKDAY_NAMES_RU.map((name, index) => (
              <span key={name} className={index >= 5 ? styles.weekdayWeekend : styles.weekday}>
                {name}
              </span>
            ))}
          </div>
          <div className={styles.grid}>
            {month.weeks.flat().map((cell, index) =>
              cell === null ? (
                <span className={styles.empty} key={`empty-${index}`} />
              ) : (
                <DayCell
                  key={cell.date}
                  day={cell}
                  state={dayState(draft, cell.date)}
                  ownColor={ownColor}
                  marks={marksByDate.get(cell.date) ?? []}
                  editable={editable}
                  onClick={onDayClick}
                />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
