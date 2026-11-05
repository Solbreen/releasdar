import { useEffect, useRef, useState } from 'react';
import type { CalendarUserDto } from '../../../shared/types.js';
import { firstNameSchema, lastNameSchema } from '../../../shared/schemas.js';
import type { MonthlyVacationCount } from '../../../shared/holidays.js';
import { MONTH_NAMES_RU, pluralizeDays } from '../calendar-model.js';
import styles from './UserList.module.css';

export interface UserListEntry {
  user: CalendarUserDto;
  isSelf: boolean;
  hidden: boolean;
  /** Засчитанные дни; для себя — с учётом несохранённых изменений. */
  dayCount: number;
  /** Разбивка засчитанных дней по месяцам, только непустые месяцы. */
  byMonth: MonthlyVacationCount[];
}

interface UserListProps {
  entries: UserListEntry[];
  renameError: { id: number; message: string } | null;
  busyId: number | null;
  onToggleHidden: (id: number) => void;
  onRename: (id: number, firstName: string, lastName: string) => void;
  onDelete: (user: CalendarUserDto, dayCount: number) => void;
  onDismissRenameError: () => void;
}

export function UserList({
  entries,
  renameError,
  busyId,
  onToggleHidden,
  onRename,
  onDelete,
  onDismissRenameError,
}: UserListProps): JSX.Element {
  const [menuId, setMenuId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);

  const closeRename = (): void => {
    setRenamingId(null);
    onDismissRenameError();
  };

  // Ошибка переименования пришла с сервера — держим поле открытым.
  useEffect(() => {
    if (renameError) setRenamingId(renameError.id);
  }, [renameError]);

  return (
    <aside className={styles.panel}>
      <h2 className={styles.heading}>Команда</h2>
      {entries.length === 0 ? <p className={styles.emptyHint}>Пока никого нет</p> : null}
      <ul className={styles.list}>
        {entries.map((entry) => (
          <li
            key={entry.user.id}
            className={entry.hidden ? styles.rowHidden : styles.row}
            data-self={entry.isSelf || undefined}
          >
            {renamingId === entry.user.id ? (
              <RenameForm
                initialFirstName={entry.user.firstName}
                initialLastName={entry.user.lastName}
                error={renameError?.id === entry.user.id ? renameError.message : null}
                busy={busyId === entry.user.id}
                onCancel={closeRename}
                onSubmit={(firstName, lastName) => onRename(entry.user.id, firstName, lastName)}
              />
            ) : (
              <>
                <button
                  type="button"
                  className={styles.main}
                  onClick={() => onToggleHidden(entry.user.id)}
                  disabled={entry.isSelf}
                  title={
                    entry.isSelf
                      ? 'Свои дни скрыть нельзя'
                      : entry.hidden
                        ? 'Показать дни на календаре'
                        : 'Скрыть дни с календаря'
                  }
                >
                  <span className={styles.marker} style={{ background: entry.user.color }} />
                  <span className={styles.body}>
                    <span className={styles.nameRow}>
                      <span className={styles.name}>
                        {entry.user.displayName}
                        {entry.isSelf ? <span className={styles.selfTag}> (вы)</span> : null}
                      </span>
                      <span className={styles.count}>
                        {entry.dayCount} {pluralizeDays(entry.dayCount)}
                      </span>
                    </span>
                    {entry.byMonth.length > 0 ? (
                      <span className={styles.months}>
                        {entry.byMonth.map(({ month, count }) => (
                          <span className={styles.month} key={month}>
                            {MONTH_NAMES_RU[month - 1]} — {count}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </button>
                <div className={styles.menuWrapper}>
                  <button
                    type="button"
                    className={styles.menuButton}
                    aria-label={`Действия с пользователем ${entry.user.displayName}`}
                    aria-expanded={menuId === entry.user.id}
                    onClick={() => setMenuId(menuId === entry.user.id ? null : entry.user.id)}
                  >
                    ⋯
                  </button>
                  {menuId === entry.user.id ? (
                    <Menu
                      onClose={() => setMenuId(null)}
                      onRename={() => {
                        setMenuId(null);
                        onDismissRenameError();
                        setRenamingId(entry.user.id);
                      }}
                      onDelete={() => {
                        setMenuId(null);
                        onDelete(entry.user, entry.dayCount);
                      }}
                    />
                  ) : null}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        Клик по коллеге скрывает или показывает его дни на календаре. Shift + клик по календарю
        выделяет диапазон.
      </p>
    </aside>
  );
}

interface MenuProps {
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function Menu({ onClose, onRename, onDelete }: MenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocumentMouseDown = (event: globalThis.MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className={styles.menu} ref={ref} role="menu">
      <button type="button" className={styles.menuItem} role="menuitem" onClick={onRename}>
        Переименовать
      </button>
      <button
        type="button"
        className={styles.menuItemDanger}
        role="menuitem"
        onClick={onDelete}
      >
        Удалить
      </button>
    </div>
  );
}

interface RenameFormProps {
  initialFirstName: string;
  initialLastName: string;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (firstName: string, lastName: string) => void;
}

function RenameForm({
  initialFirstName,
  initialLastName,
  error,
  busy,
  onCancel,
  onSubmit,
}: RenameFormProps): JSX.Element {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});

  const filled = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <form
      className={styles.renameForm}
      onSubmit={(event) => {
        event.preventDefault();
        const first = firstNameSchema.safeParse(firstName);
        const last = lastNameSchema.safeParse(lastName);
        if (!first.success || !last.success) {
          setErrors({
            firstName: first.success ? undefined : first.error.issues[0]?.message,
            lastName: last.success ? undefined : last.error.issues[0]?.message,
          });
          return;
        }
        setErrors({});
        onSubmit(first.data, last.data);
      }}
    >
      <input
        className={`input ${errors.firstName ? 'input--invalid' : ''}`}
        value={firstName}
        maxLength={60}
        autoFocus
        aria-label="Имя"
        placeholder="Имя"
        onChange={(event) => {
          setFirstName(event.target.value);
          setErrors((current) => ({ ...current, firstName: undefined }));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
      />
      {errors.firstName ? (
        <p className="fieldError" role="alert">
          {errors.firstName}
        </p>
      ) : null}

      <input
        className={`input ${errors.lastName ? 'input--invalid' : ''}`}
        style={{ marginTop: 6 }}
        value={lastName}
        maxLength={60}
        aria-label="Фамилия"
        placeholder="Фамилия"
        onChange={(event) => {
          setLastName(event.target.value);
          setErrors((current) => ({ ...current, lastName: undefined }));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
      />
      {errors.lastName ? (
        <p className="fieldError" role="alert">
          {errors.lastName}
        </p>
      ) : null}

      {error ? (
        <p className="fieldError" role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.renameActions}>
        <button type="button" className="button" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
        <button type="submit" className="button button--primary" disabled={busy || !filled}>
          Сохранить
        </button>
      </div>
    </form>
  );
}
