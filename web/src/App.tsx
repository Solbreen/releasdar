import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarDto, CalendarUserDto, UserDto } from '../../shared/types.js';
import { ApiRequestError, NetworkError, api } from './api.js';
import { allDatesOfYear, buildYear } from './calendar-model.js';
import { countVacationDays, countVacationDaysByMonth } from '../../shared/holidays.js';
import {
  changeCount,
  createDraft,
  effectiveDays,
  rebaseDraft,
  resetDraft,
  toggleDay,
  toggleRange,
  type Draft,
} from './draft.js';
import {
  clearUserId,
  loadHiddenIds,
  loadUserId,
  saveHiddenIds,
  saveUserId,
} from './storage.js';
import { Calendar } from './components/Calendar.js';
import type { DayMark } from './components/DayCell.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { Header } from './components/Header.js';
import { Legend } from './components/Legend.js';
import { LoginModal } from './components/LoginModal.js';
import { SavePanel } from './components/SavePanel.js';
import { Toasts, type Toast } from './components/Toasts.js';
import { UserList, type UserListEntry } from './components/UserList.js';
import styles from './App.module.css';

const SYNC_INTERVAL_MS = 60_000;
const DEFAULT_YEAR = 2027;

type Phase = 'loading' | 'login' | 'ready';

interface DeleteTarget {
  user: CalendarUserDto;
  dayCount: number;
}

export function App(): JSX.Element {
  const [phase, setPhase] = useState<Phase>('loading');
  const [me, setMe] = useState<UserDto | null>(null);
  const [calendar, setCalendar] = useState<CalendarDto | null>(null);
  const [draft, setDraft] = useState<Draft>(() => createDraft([]));
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => new Set(loadHiddenIds()));
  const [anchor, setAnchor] = useState<string | null>(null);

  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const [conflictUser, setConflictUser] = useState<UserDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [switchConfirm, setSwitchConfirm] = useState(false);
  const [renameError, setRenameError] = useState<{ id: number; message: string } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toastSeq = useRef(0);
  // Актуальные значения для таймеров и обработчиков событий.
  const meRef = useRef<UserDto | null>(null);
  const changesRef = useRef(0);
  meRef.current = me;
  changesRef.current = changeCount(draft);

  const year = calendar?.year ?? DEFAULT_YEAR;
  const months = useMemo(() => buildYear(year), [year]);
  const allDates = useMemo(() => allDatesOfYear(year), [year]);
  const changes = changeCount(draft);

  /** Свои дни с учётом черновика — основа живых счётчиков. */
  const myDraftDays = useMemo(() => effectiveDays(draft), [draft]);

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'info'): void => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((current) => [...current, { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /** Пользователь перестал существовать: выходим и просим войти заново. */
  const handleSelfGone = useCallback(
    (message = 'Ваш пользователь был удалён'): void => {
      clearUserId();
      setMe(null);
      setDraft(createDraft([]));
      setAnchor(null);
      setPhase('login');
      setLoginError(null);
      pushToast(message, 'error');
    },
    [pushToast],
  );

  /**
   * Перезапрашивает календарь. Свой черновик не теряется: база черновика
   * заменяется на свежие серверные дни, а локальная разница сохраняется.
   */
  const refreshCalendar = useCallback(async (): Promise<void> => {
    try {
      const data = await api.getCalendar();
      setCalendar(data);

      const current = meRef.current;
      if (!current) return;

      const mine = data.users.find((user) => user.id === current.id);
      if (!mine) {
        // Нас удалил кто-то другой, пока мы работали.
        handleSelfGone();
        return;
      }
      setMe({
        id: mine.id,
        firstName: mine.firstName,
        lastName: mine.lastName,
        displayName: mine.displayName,
        color: mine.color,
        version: mine.version,
        days: mine.days,
      });
      setDraft((currentDraft) => rebaseDraft(currentDraft, mine.days));
    } catch (error) {
      if (error instanceof NetworkError) {
        pushToast('Не удалось обновить данные: нет связи с сервером', 'error');
        return;
      }
      pushToast(error instanceof Error ? error.message : 'Не удалось обновить данные', 'error');
    }
  }, [handleSelfGone, pushToast]);

  // Первый запуск: пробуем войти по сохранённому id.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async (): Promise<void> => {
      const storedId = loadUserId();
      if (storedId === null) {
        if (!cancelled) setPhase('login');
        await refreshCalendar();
        return;
      }
      try {
        const { user } = await api.getUser(storedId);
        if (cancelled) return;
        setMe(user);
        meRef.current = user;
        setDraft(createDraft(user.days));
        setPhase('ready');
        pushToast(`С возвращением, ${user.displayName}`);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.code === 'USER_NOT_FOUND') {
          clearUserId();
          setPhase('login');
        } else if (error instanceof NetworkError) {
          setPhase('login');
          pushToast('Нет связи с сервером', 'error');
        } else {
          setPhase('login');
          pushToast(error instanceof Error ? error.message : 'Ошибка входа', 'error');
        }
      }
      await refreshCalendar();
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [pushToast, refreshCalendar]);

  // Периодическое обновление и обновление при возврате фокуса на вкладку.
  useEffect(() => {
    const timer = window.setInterval(() => void refreshCalendar(), SYNC_INTERVAL_MS);
    const onFocus = (): void => void refreshCalendar();
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void refreshCalendar();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshCalendar]);

  // Предупреждение браузера о несохранённых изменениях.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (changesRef.current > 0) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const handleLogin = async (firstName: string, lastName: string): Promise<void> => {
    setLoginBusy(true);
    setLoginError(null);
    try {
      const { user, created } = await api.login(firstName, lastName);
      saveUserId(user.id);
      setMe(user);
      meRef.current = user;
      setDraft(createDraft(user.days));
      setAnchor(null);
      setPhase('ready');
      pushToast(
        created ? `Создан новый пользователь ${user.displayName}` : `С возвращением, ${user.displayName}`,
      );
      await refreshCalendar();
    } catch (error) {
      if (error instanceof NetworkError) {
        setLoginError('Нет связи с сервером, попробуйте ещё раз');
      } else if (error instanceof ApiRequestError) {
        setLoginError(error.message);
      } else {
        setLoginError('Не удалось войти');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleDayClick = (date: string, shiftKey: boolean): void => {
    if (!me) return;
    if (shiftKey && anchor) {
      setDraft((current) => toggleRange(current, anchor, date, allDates));
      return;
    }
    setDraft((current) => toggleDay(current, date));
    setAnchor(date);
  };

  const handleSave = async (): Promise<void> => {
    if (!me || changes === 0) return;
    setSaving(true);
    try {
      const { user } = await api.saveDays(me.id, myDraftDays, me.version);
      setMe(user);
      meRef.current = user;
      setDraft(createDraft(user.days));
      pushToast('Изменения сохранены');
      await refreshCalendar();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === 'VERSION_CONFLICT' && error.user) {
          setConflictUser(error.user);
        } else if (error.code === 'USER_NOT_FOUND') {
          handleSelfGone();
        } else {
          pushToast(error.message, 'error');
        }
      } else if (error instanceof NetworkError) {
        pushToast('Не удалось сохранить: нет связи с сервером. Изменения сохранены локально', 'error');
      } else {
        pushToast('Не удалось сохранить изменения', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHidden = (id: number): void => {
    if (me && id === me.id) return;
    setHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveHiddenIds(next);
      return next;
    });
  };

  const handleRename = async (
    id: number,
    firstName: string,
    lastName: string,
  ): Promise<void> => {
    setBusyUserId(id);
    setRenameError(null);
    try {
      const { user } = await api.rename(id, firstName, lastName);
      if (me && id === me.id) {
        setMe(user);
        meRef.current = user;
      }
      pushToast(`Имя изменено на ${user.displayName}`);
      await refreshCalendar();
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.code === 'NAME_TAKEN' || error.code === 'VALIDATION_ERROR') {
          setRenameError({ id, message: error.message });
        } else if (error.code === 'USER_NOT_FOUND') {
          if (me && id === me.id) handleSelfGone();
          else {
            pushToast('Пользователь уже удалён', 'error');
            await refreshCalendar();
          }
        } else {
          pushToast(error.message, 'error');
        }
      } else {
        pushToast('Не удалось переименовать пользователя', 'error');
      }
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    const { user } = deleteTarget;
    setBusyUserId(user.id);
    try {
      await api.remove(user.id);
      setDeleteTarget(null);
      if (me && user.id === me.id) {
        clearUserId();
        setMe(null);
        meRef.current = null;
        setDraft(createDraft([]));
        setAnchor(null);
        setPhase('login');
        pushToast('Ваш пользователь удалён, войдите снова');
      } else {
        pushToast(`${user.displayName} удалён`);
      }
      await refreshCalendar();
    } catch (error) {
      setDeleteTarget(null);
      if (error instanceof ApiRequestError && error.code === 'USER_NOT_FOUND') {
        if (me && user.id === me.id) handleSelfGone();
        else {
          pushToast('Пользователь уже удалён', 'error');
          await refreshCalendar();
        }
      } else {
        pushToast('Не удалось удалить пользователя', 'error');
      }
    } finally {
      setBusyUserId(null);
    }
  };

  const doSwitchUser = (): void => {
    clearUserId();
    setMe(null);
    meRef.current = null;
    setDraft(createDraft([]));
    setAnchor(null);
    setSwitchConfirm(false);
    setLoginError(null);
    setPhase('login');
  };

  const handleSwitchUserClick = (): void => {
    if (changes > 0) {
      setSwitchConfirm(true);
      return;
    }
    doSwitchUser();
  };

  /** Отметки коллег по датам: без себя и без скрытых пользователей. */
  const marksByDate = useMemo(() => {
    const result = new Map<string, DayMark[]>();
    if (!calendar) return result;
    for (const user of calendar.users) {
      if (me && user.id === me.id) continue;
      if (hiddenIds.has(user.id)) continue;
      for (const date of user.days) {
        const marks = result.get(date);
        const mark: DayMark = { id: user.id, displayName: user.displayName, color: user.color };
        if (marks) marks.push(mark);
        else result.set(date, [mark]);
      }
    }
    return result;
  }, [calendar, hiddenIds, me]);

  /** Текущий пользователь закреплён сверху, остальные — в порядке с сервера. */
  const entries = useMemo<UserListEntry[]>(() => {
    if (!calendar) return [];
    const mine: UserListEntry[] = [];
    const others: UserListEntry[] = [];
    for (const user of calendar.users) {
      const isSelf = me !== null && user.id === me.id;
      const entry: UserListEntry = {
        user,
        isSelf,
        hidden: hiddenIds.has(user.id) && !isSelf,
        // У себя счётчик и разбивка учитывают несохранённые изменения.
        dayCount: isSelf ? countVacationDays(myDraftDays) : user.dayCount,
        byMonth: countVacationDaysByMonth(isSelf ? myDraftDays : user.days),
      };
      (isSelf ? mine : others).push(entry);
    }
    return [...mine, ...others];
  }, [calendar, hiddenIds, me, myDraftDays]);

  return (
    <div className={styles.app}>
      <Header year={year} userName={me?.displayName ?? null} onSwitchUser={handleSwitchUserClick} />

      <main className={styles.layout}>
        <div className={styles.calendarColumn}>
          <SavePanel
            changes={changes}
            saving={saving}
            onSave={() => void handleSave()}
            onReset={() => setDraft((current) => resetDraft(current))}
          />
          {calendar === null ? (
            <p className={styles.loading}>Загружаем календарь…</p>
          ) : (
            <>
              <Calendar
                months={months}
                draft={draft}
                ownColor={me?.color ?? 'var(--accent)'}
                marksByDate={marksByDate}
                editable={me !== null}
                onDayClick={handleDayClick}
              />
              <Legend ownColor={me?.color ?? 'var(--accent)'} />
            </>
          )}
        </div>

        <UserList
          entries={entries}
          renameError={renameError}
          busyId={busyUserId}
          onToggleHidden={handleToggleHidden}
          onRename={(id, firstName, lastName) => void handleRename(id, firstName, lastName)}
          onDelete={(user, dayCount) => setDeleteTarget({ user, dayCount })}
          onDismissRenameError={() => setRenameError(null)}
        />
      </main>

      {phase === 'login' ? (
        <LoginModal
          busy={loginBusy}
          serverError={loginError}
          onSubmit={(firstName, lastName) => void handleLogin(firstName, lastName)}
        />
      ) : null}

      {conflictUser ? (
        <ConfirmDialog
          title="Данные изменились"
          message="Ваши даты изменились в другой вкладке. Загрузить актуальные (ваши несохранённые изменения пропадут)?"
          confirmLabel="Загрузить актуальные"
          cancelLabel="Оставить черновик"
          onConfirm={() => {
            setMe(conflictUser);
            meRef.current = conflictUser;
            setDraft(createDraft(conflictUser.days));
            setConflictUser(null);
            void refreshCalendar();
          }}
          onCancel={() => setConflictUser(null)}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Удаление пользователя"
          message={`Удалить ${deleteTarget.user.displayName} и его ${deleteTarget.dayCount} дн. отпуска? Это нельзя отменить.`}
          confirmLabel="Удалить"
          danger
          busy={busyUserId === deleteTarget.user.id}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      ) : null}

      {switchConfirm ? (
        <ConfirmDialog
          title="Несохранённые изменения"
          message={`У вас ${changes} несохранённых изменений. Сменить пользователя и потерять их?`}
          confirmLabel="Сменить пользователя"
          danger
          onConfirm={doSwitchUser}
          onCancel={() => setSwitchConfirm(false)}
        />
      ) : null}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
