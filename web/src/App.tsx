import { useEffect, useState, type FormEvent } from 'react';
import { buildYear, WEEKDAY_NAMES_RU, formatHumanDate } from './calendar-model.js';
import { Modal } from './components/Modal.js';
import { Accounts } from './components/Accounts.js';
import layout from './App.module.css';
import cal from './components/Calendar.module.css';
import side from './components/UserList.module.css';
import header from './components/Header.module.css';
import './release.css';
import { findHolidayName } from '../../shared/holidays.js';

type Product = { id: number; name: string; manager: string; managerId: number | null; description: string; color: string; status: 'active' | 'archived' };
type ReleaseStatus = 'planned' | 'rejected' | 'in_progress' | 'completed';
type Release = { id: number; productId: number; date: string; description: string; status: ReleaseStatus; environment: 'Dev' | 'Test' | 'Prod'; releaseType: string };
type ProductForm = Omit<Product, 'id'> & { id?: number };
type ReleaseForm = { id?: number; productId: string; date: string; description: string; environment: '' | 'Dev' | 'Test' | 'Prod'; releaseType: string };
const blankRelease = (date = ''): ReleaseForm => ({ productId: '', date, description: '', environment: '', releaseType: '' });
const colors = ['#3a86ff', '#e76f51', '#2a9d8f', '#9b5de5', '#c77e16', '#d64987'];

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
  if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || 'Не удалось сохранить или загрузить данные.'); }
  return response.json() as Promise<T>;
}

function CalendarApp({ onLogout, user, themeButton }: { onLogout: () => void; user: { role: 'admin' | 'rp' | 'devops'; id?: number }; themeButton: JSX.Element }): JSX.Element {
  const { role } = user;
  const [year, setYear] = useState(Math.max(2026, Math.min(2036, new Date().getFullYear())));
  const [view, setView] = useState<'year' | 'month'>('year');
  const [month, setMonth] = useState(new Date().getMonth());
  const [products, setProducts] = useState<Product[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [product, setProduct] = useState<ProductForm | null>(null);
  const [release, setRelease] = useState<ReleaseForm | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showReleaseQueue, setShowReleaseQueue] = useState(false);
  const [managers, setManagers] = useState<{ id: number; fullName: string }[]>([]);
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active');
  const visibleProducts = products.filter(p => filter === 'all' || p.status === filter);
  const visibleReleases = releases.filter(r => r.status !== 'rejected' && r.status !== 'completed' && visibleProducts.some(p => p.id === r.productId && !hidden.includes(p.id)));
  const canCreate = role !== 'devops';
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (today.getDay() + 6) % 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });

  const refresh = async (): Promise<void> => {
    try {
      const [p, r, m] = await Promise.all([request<Product[]>('/api/products'), request<Release[]>('/api/releases'), request<{ id: number; fullName: string }[]>('/api/project-managers')]);
      setProducts(p); setReleases(r); setManagers(m); setError('');
    } catch { setError('Не удалось загрузить данные. Проверьте соединение.'); }
  };
  const remove = async (kind: 'products' | 'releases', id: number): Promise<void> => {
    if (!window.confirm(kind === 'products' ? 'Удалить проект и все его релизы?' : 'Удалить релиз?')) return;
    try { await request(`/api/${kind}/${id}`, { method: 'DELETE' }); if (kind === 'products') setProduct(null); await refresh(); } catch (err) { setError((err as Error).message); }
  };
  const releaseCard = (r: Release, title: string): JSX.Element => <div className="releaseItem" key={r.id}>
    <div className="releaseHeading"><strong>{title}</strong><button type="button" className="button" aria-label="Открыть релиз" title="Открыть релиз" onClick={() => { setError(''); setRelease({ ...r, productId: String(r.productId) }); }}>✎</button></div>
    <p>{r.environment} {r.releaseType ? `· ${r.releaseType}` : ''}</p><p>{r.description || 'Без описания'}</p><div className="releaseCardActions">
      {role === 'admin' && <button type="button" className="button button--danger" aria-label="Удалить релиз" title="Удалить релиз" onClick={() => void remove('releases', r.id)}>🗑</button>}
    </div></div>;
  useEffect(() => {
    void refresh();
    const onFocus = (): void => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  const saveProduct = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!product || saving) return;
    setSaving(true);
    try {
      await request(product.id ? `/api/products/${product.id}` : '/api/products', {
        method: product.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
      });
      setProduct(null); await refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };
  const saveRelease = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!release || saving) return;
    setSaving(true);
    try {
      await request(release.id ? `/api/releases/${release.id}` : '/api/releases', { method: release.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...release, productId: Number(release.productId) }) });
      setRelease(null); setDay(null); await refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  };

  return <div className={layout.app}>
    <header className={header.header}>
      <h1 className={header.title}>Календарь релизов · <select aria-label="Год" className="input yearSelect" value={year} onChange={event => setYear(Number(event.target.value))}>
        {Array.from({ length: 11 }, (_, i) => <option key={i}>{2026 + i}</option>)}
      </select></h1>
      <div className={header.user}>
        {themeButton}
        <button className="button" onClick={() => { setError(''); setShowReleaseQueue(true); void refresh(); }}>Релизы</button>
        {canCreate && <button className="button button--primary" onClick={() => { setError(''); setRelease(blankRelease()); }}>Создать релиз</button>}
        {role === 'admin' && <button className="button" onClick={() => setShowAccounts(true)}>Пользователи</button>}
        <button className="button" onClick={onLogout}>Выйти</button>
      </div>
    </header>
    {error && <div className="releaseError" role="alert">{error} <button className="button" onClick={() => void refresh()}>Обновить</button></div>}
    <div className={layout.layout}>
      <main className={layout.calendarColumn}>
        <div className="calendarControls"><label>Вид <select className="input" value={view} onChange={e => setView(e.target.value as 'year' | 'month')}><option value="year">Год</option><option value="month">Месяц</option></select></label>{view === 'month' && <label>Месяц <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))}>{buildYear(year).map((m, i) => <option value={i} key={i}>{m.title}</option>)}</select></label>}</div>
        <div className={`${cal.year} ${view === 'month' ? 'singleMonth' : ''}`}>
          {buildYear(year).filter((_, i) => view === 'year' || i === month).map(month => <section className={cal.month} key={month.month}>
            <h3 className={cal.monthTitle}>{month.title}</h3>
            <div className={cal.weekdays}>{WEEKDAY_NAMES_RU.map((name, i) => <span className={i >= 5 ? cal.weekdayWeekend : cal.weekday} key={name}>{name}</span>)}</div>
            <div className={cal.grid}>{month.weeks.flat().map((cell, i) => cell ?
              <button key={cell.date} className={`${cal.day} ${cell.weekend ? cal.dayWeekend : ''} ${findHolidayName(cell.date) ? cal.dayHoliday : ''} ${visibleReleases.some(r => r.date === cell.date) ? 'releaseDay' : ''} ${cell.date === todayIso ? 'todayDay' : ''}`} title={findHolidayName(cell.date) ?? undefined} onClick={() => setDay(cell.date)} aria-label={`${cell.date}, релизов: ${visibleReleases.filter(r => r.date === cell.date).length}`}>
                <span>{cell.day}</span>
              </button> : <span className={cal.empty} key={i} />)}</div>
          </section>)}
        </div>
      </main>
      <aside className={side.panel}>
        <section className="weekly"><h2>Релизы на неделю</h2>{weekDays.map((date, i) => <div className={`weekDay ${date === todayIso ? 'todayDay' : ''}`} key={date}><strong>{WEEKDAY_NAMES_RU[i]} · {formatHumanDate(date)}{date === todayIso ? ' · Сегодня' : ''}</strong>{visibleReleases.filter(r => r.date === date).map(r => releaseCard(r, products.find(p => p.id === r.productId)?.name ?? 'Проект'))}</div>)}</section>
        {canCreate && <button className="button button--primary productCreate" onClick={() => setProduct({ name: '', manager: '', managerId: role === 'rp' ? user.id ?? null : null, description: '', color: colors[products.length % colors.length]!, status: 'active' })}>Создать проект</button>}
        <h2 className={side.heading}>Проекты</h2>
        <label>Статус <select className="input" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="active">Активен</option><option value="archived">Архив</option><option value="all">Все</option></select></label>
        {visibleProducts.length === 0 && <p className={side.emptyHint}>Нет проектов</p>}
        {visibleProducts.map(p => <div className={side.row} key={p.id}>
          <button className="button" aria-label={`${hidden.includes(p.id) ? 'Показать' : 'Скрыть'} ${p.name} на календаре`} aria-pressed={!hidden.includes(p.id)} onClick={() => setHidden(hidden.includes(p.id) ? hidden.filter(id => id !== p.id) : [...hidden, p.id])}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{hidden.includes(p.id) && <path d="M3 3l18 18"/>}</svg></button>
          <button className={side.main} onClick={() => setProduct(p)}>{p.name}</button><span className={`statusBadge ${p.status}`}>{p.status === 'active' ? 'Активен' : 'Архив'}</span>
        </div>)}
      </aside>
    </div>
    {day && !release && <Modal title={`Релизы · ${formatHumanDate(day)} ${day.slice(0, 4)}`} onClose={() => setDay(null)} footer={canCreate && <button className="button button--primary" onClick={() => { setError(''); setRelease(blankRelease(day)); }}>Создать релиз</button>}>
      <div className="releaseFeed">{visibleReleases.filter(r => r.date === day).map(r => releaseCard(r, products.find(p => p.id === r.productId)?.name ?? 'Проект'))}
        {!visibleReleases.some(r => r.date === day) && <p>На этот день релизов нет.</p>}
      </div>
    </Modal>}
    {product && <Modal title={product.id ? 'Карточка проекта' : 'Новый проект'} headerAction={<span className={`statusBadge ${product.status}`}>{product.status === 'active' ? 'Активен' : 'Архив'}</span>} onClose={() => setProduct(null)} footer={<>{role === 'admin' && product.id && <button type="button" className="button button--danger" aria-label="Удалить проект" title="Удалить проект" onClick={() => void remove('products', product.id!)}>🗑</button>}{canCreate && <button form="product-form" className="button button--primary" disabled={saving || !product.name.trim() || !product.managerId}>Сохранить</button>}</>}>
      <form id="product-form" className="releaseForm" onSubmit={event => void saveProduct(event)}>
        <label>Название проекта <input className="input" disabled={!canCreate} required maxLength={200} value={product.name} onChange={event => setProduct({ ...product, name: event.target.value })} /></label>
        <label>Ответственный <select className="input" disabled={!canCreate} required value={product.managerId ?? ''} onChange={event => setProduct({ ...product, managerId: Number(event.target.value) || null })}><option value="">Выберите РП</option>{product.managerId && !managers.some(m => m.id === product.managerId) && <option value={product.managerId}>Недоступный пользователь — {product.manager}</option>}{managers.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}</select></label>
        <label>Описание <textarea className="input" disabled={!canCreate} maxLength={10000} value={product.description} onChange={event => setProduct({ ...product, description: event.target.value })} /></label>
        <label>Статус <select className="input" disabled={!canCreate || !product.id} value={product.status} onChange={event => setProduct({ ...product, status: event.target.value as Product['status'] })}><option value="active">Активен</option><option value="archived">Архив</option></select></label>
        <h3>Релизы</h3>
        <div className="releaseFeed">{releases.filter(r => r.productId === product.id && r.status !== 'rejected' && r.status !== 'completed').map(r => releaseCard(r, r.date))}</div>
        {error && <p className="fieldError" role="alert">{error}</p>}
      </form>
    </Modal>}
    {release && <Modal title={release.id ? 'Карточка релиза' : 'Новый релиз'} onClose={() => setRelease(null)} footer={canCreate && <button form="release-form" className="button button--primary" disabled={saving || !release.productId || !release.date || !release.environment}>Сохранить</button>}>
      <form id="release-form" className="releaseForm" onSubmit={event => void saveRelease(event)}>
        <label>Проект <select className="input" disabled={!canCreate} required value={release.productId} onChange={event => setRelease({ ...release, productId: event.target.value })}><option value="">Выберите проект</option>{products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
        <label>Стенд <select className="input" disabled={!canCreate} required value={release.environment} onChange={event => setRelease({ ...release, environment: event.target.value as ReleaseForm['environment'] })}><option value="">Выберите стенд</option><option>Dev</option><option>Test</option><option>Prod</option></select></label>
        <label>Тип релиза <input className="input" disabled={!canCreate} maxLength={200} value={release.releaseType} onChange={event => setRelease({ ...release, releaseType: event.target.value })} /></label>
        {release.id && <label>Ответственный <input className="input" readOnly value={products.find(p => p.id === Number(release.productId))?.manager ?? ''} /></label>}
        {products.length === 0 && <p>Сначала создайте проект.</p>}
        <label>Дата <input className="input" type="date" disabled={!canCreate} min="2026-01-01" max="2036-12-31" required value={release.date} onChange={event => setRelease({ ...release, date: event.target.value })} /></label>
        <label>Описание <textarea className="input" disabled={!canCreate} maxLength={10000} value={release.description} onChange={event => setRelease({ ...release, description: event.target.value })} /></label>
        {error && <p className="fieldError" role="alert">{error}</p>}
      </form>
    </Modal>}
    {showAccounts && <Accounts onClose={() => setShowAccounts(false)} />}
    {showReleaseQueue && <Modal wide title="Релизы за текущий месяц" onClose={() => setShowReleaseQueue(false)}>
      {error && <p className="fieldError" role="alert">{error}</p>}
      {releases.filter(r => r.date.startsWith(todayIso.slice(0, 7)) && r.status !== 'rejected' && r.status !== 'completed').sort((a, b) => a.date.localeCompare(b.date)).map(r => releaseCard(r, `${products.find(p => p.id === r.productId)?.name ?? 'Проект'} · ${r.date}`))}
    </Modal>}
  </div>;
}

export function App(): JSX.Element {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === 'light' ? saved : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; localStorage.setItem('theme', theme); }, [theme]);
  const [authenticated, setAuthenticated] = useState<{ role: 'admin' | 'rp' | 'devops'; id?: number } | false | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const expired = (): void => { setAuthenticated(false); setError('Сессия завершилась. Войдите снова.'); };
    window.addEventListener('session-expired', expired);
    fetch('/api/auth/me').then(async response => setAuthenticated(response.ok ? await response.json() as { role: 'admin' | 'rp' | 'devops'; id?: number } : false)).catch(() => { setError('Не удалось подключиться к серверу'); setAuthenticated(false); });
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault(); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      if (!response.ok) { setError(response.status === 429 ? 'Слишком много попыток. Попробуйте позже.' : 'Неверный логин или пароль'); return; }
      const user = await response.json() as { role: 'admin' | 'rp' | 'devops'; id?: number }; setPassword(''); setAuthenticated(user);
    } catch { setError('Не удалось подключиться к серверу'); }
  };
  if (authenticated === null) return <p>Загрузка…</p>;
  if (authenticated) return <CalendarApp user={authenticated} themeButton={<button type="button" className="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</button>} onLogout={() => { void fetch('/api/auth/logout', { method: 'POST' }).finally(() => setAuthenticated(false)); }} />;
  return <Modal title="Вход" footer={<button form="login-form" className="button button--primary">Войти</button>}><form id="login-form" className="releaseForm" onSubmit={event => void submit(event)}>
    <label>Логин <input className="input" autoComplete="username" required value={login} onChange={event => setLogin(event.target.value)} /></label>
    <label>Пароль <input className="input" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
    {error && <p className="fieldError" role="alert">{error}</p>}
  </form></Modal>;
}
