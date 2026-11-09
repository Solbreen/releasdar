import { useEffect, useState, type FormEvent } from 'react';
import { buildYear, WEEKDAY_NAMES_RU, formatHumanDate } from './calendar-model.js';
import { Modal } from './components/Modal.js';
import { Accounts } from './components/Accounts.js';
import layout from './App.module.css';
import cal from './components/Calendar.module.css';
import side from './components/UserList.module.css';
import header from './components/Header.module.css';
import './release.css';

type Product = { id: number; name: string; manager: string; description: string; color: string };
type Release = { id: number; productId: number; date: string; description: string };
type ProductForm = Omit<Product, 'id'> & { id?: number };
type ReleaseForm = { productId: string; date: string; description: string };
const colors = ['#3a86ff', '#e76f51', '#2a9d8f', '#9b5de5', '#c77e16', '#d64987'];

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
  if (!response.ok) throw new Error('Не удалось сохранить или загрузить данные. Попробуйте ещё раз.');
  return response.json() as Promise<T>;
}

function CalendarApp({ onLogout, role }: { onLogout: () => void; role: 'admin' | 'rp' | 'devops' }): JSX.Element {
  const [year, setYear] = useState(Math.max(2026, Math.min(2036, new Date().getFullYear())));
  const [products, setProducts] = useState<Product[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [hidden, setHidden] = useState<number[]>([]);
  const [product, setProduct] = useState<ProductForm | null>(null);
  const [release, setRelease] = useState<ReleaseForm | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const canCreate = role !== 'devops';

  const refresh = async (): Promise<void> => {
    try {
      const [p, r] = await Promise.all([request<Product[]>('/api/products'), request<Release[]>('/api/releases')]);
      setProducts(p); setReleases(r); setError('');
    } catch { setError('Не удалось загрузить данные. Проверьте соединение.'); }
  };
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
      await request('/api/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...release, productId: Number(release.productId) }) });
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
        {canCreate && <button className="button button--primary" onClick={() => setRelease({ productId: '', date: '', description: '' })}>Создать релиз</button>}
        {role === 'admin' && <button className="button" onClick={() => setShowAccounts(true)}>Пользователи</button>}
        <button className="button" onClick={onLogout}>Выйти</button>
      </div>
    </header>
    {error && <div className="releaseError" role="alert">{error} <button className="button" onClick={() => void refresh()}>Обновить</button></div>}
    <div className={layout.layout}>
      <main className={layout.calendarColumn}>
        <div className={cal.year}>
          {buildYear(year).map(month => <section className={cal.month} key={month.month}>
            <h3 className={cal.monthTitle}>{month.title}</h3>
            <div className={cal.weekdays}>{WEEKDAY_NAMES_RU.map((name, i) => <span className={i >= 5 ? cal.weekdayWeekend : cal.weekday} key={name}>{name}</span>)}</div>
            <div className={cal.grid}>{month.weeks.flat().map((cell, i) => cell ?
              <button key={cell.date} className={`${cal.day} ${cell.weekend ? cal.dayWeekend : ''}`} onClick={() => setDay(cell.date)} aria-label={`${cell.date}, релизов: ${releases.filter(r => r.date === cell.date).length}`}>
                <span>{cell.day}</span>
                <span className={cal.marks}>{products.filter(p => !hidden.includes(p.id) && releases.some(r => r.productId === p.id && r.date === cell.date)).map(p => <span className={cal.mark} style={{ background: p.color }} key={p.id} />)}</span>
              </button> : <span className={cal.empty} key={i} />)}</div>
          </section>)}
        </div>
      </main>
      <aside className={side.panel}>
        {canCreate && <button className="button button--primary productCreate" onClick={() => setProduct({ name: '', manager: '', description: '', color: colors[products.length % colors.length]! })}>Создать продукт</button>}
        <h2 className={side.heading}>Продукты</h2>
        {products.length === 0 && <p className={side.emptyHint}>Пока нет продуктов</p>}
        {products.map(p => <div className={side.row} key={p.id}>
          <button className="productIndicator" aria-label={`${hidden.includes(p.id) ? 'Показать' : 'Скрыть'} ${p.name} на календаре`} aria-pressed={!hidden.includes(p.id)} style={{ background: p.color, opacity: hidden.includes(p.id) ? .35 : 1 }} onClick={() => setHidden(hidden.includes(p.id) ? hidden.filter(id => id !== p.id) : [...hidden, p.id])} />
          <button className={side.main} onClick={() => setProduct(p)}>{p.name}</button>
        </div>)}
      </aside>
    </div>
    {day && !release && <Modal title={`Релизы · ${formatHumanDate(day)} ${day.slice(0, 4)}`} onClose={() => setDay(null)}>
      <div className="releaseFeed">{releases.filter(r => r.date === day).map(r => <div className="releaseItem" key={r.id}><strong>{products.find(p => p.id === r.productId)?.name}</strong><p>{r.description || 'Без описания'}</p></div>)}
        {!releases.some(r => r.date === day) && <p>На этот день релизов нет.</p>}
        {canCreate && <button className="button button--primary" onClick={() => setRelease({ productId: '', date: day, description: '' })}>Создать релиз</button>}
      </div>
    </Modal>}
    {product && <Modal title={product.id ? 'Карточка продукта' : 'Новый продукт'} onClose={() => setProduct(null)}>
      <form className="releaseForm" onSubmit={event => void saveProduct(event)}>
        <label>Название продукта <input className="input" disabled={!canCreate} required maxLength={200} value={product.name} onChange={event => setProduct({ ...product, name: event.target.value })} /></label>
        <label>ФИО руководителя проекта <input className="input" disabled={!canCreate} required maxLength={200} value={product.manager} onChange={event => setProduct({ ...product, manager: event.target.value })} /></label>
        <label>Описание <textarea className="input" disabled={!canCreate} maxLength={10000} value={product.description} onChange={event => setProduct({ ...product, description: event.target.value })} /></label>
        <h3>Релизы</h3>
        <div className="releaseFeed">{releases.filter(r => r.productId === product.id).map(r => <div className="releaseItem" key={r.id}><strong>{r.date}</strong><p>{r.description || 'Без описания'}</p></div>)}</div>
        {error && <p className="fieldError" role="alert">{error}</p>}
        <div className="releaseActions"><button type="button" className="button" onClick={() => setProduct(null)}>Закрыть</button>{canCreate && <button className="button button--primary" disabled={saving || !product.name.trim() || !product.manager.trim()}>Сохранить</button>}</div>
      </form>
    </Modal>}
    {release && <Modal title="Новый релиз" onClose={() => setRelease(null)}>
      <form className="releaseForm" onSubmit={event => void saveRelease(event)}>
        <label>Продукт <select className="input" required value={release.productId} onChange={event => setRelease({ ...release, productId: event.target.value })}><option value="">Выберите продукт</option>{products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
        {products.length === 0 && <p>Сначала создайте продукт.</p>}
        <label>Дата <input className="input" type="date" min="2026-01-01" max="2036-12-31" required value={release.date} onChange={event => setRelease({ ...release, date: event.target.value })} /></label>
        <label>Описание <textarea className="input" maxLength={10000} value={release.description} onChange={event => setRelease({ ...release, description: event.target.value })} /></label>
        {error && <p className="fieldError" role="alert">{error}</p>}
        <div className="releaseActions"><button type="button" className="button" onClick={() => setRelease(null)}>Закрыть</button><button className="button button--primary" disabled={saving || !release.productId || !release.date}>Сохранить</button></div>
      </form>
    </Modal>}
    {showAccounts && <Accounts onClose={() => setShowAccounts(false)} />}
  </div>;
}

export function App(): JSX.Element {
  const [authenticated, setAuthenticated] = useState<'admin' | 'rp' | 'devops' | false | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const expired = (): void => { setAuthenticated(false); setError('Сессия завершилась. Войдите снова.'); };
    window.addEventListener('session-expired', expired);
    fetch('/api/auth/me').then(async response => setAuthenticated(response.ok ? (await response.json() as { role: 'admin' | 'rp' | 'devops' }).role : false)).catch(() => { setError('Не удалось подключиться к серверу'); setAuthenticated(false); });
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault(); setError('');
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
      if (!response.ok) { setError(response.status === 429 ? 'Слишком много попыток. Попробуйте позже.' : 'Неверный логин или пароль'); return; }
      const user = await response.json() as { role: 'admin' | 'rp' | 'devops' }; setPassword(''); setAuthenticated(user.role);
    } catch { setError('Не удалось подключиться к серверу'); }
  };
  if (authenticated === null) return <p>Загрузка…</p>;
  if (authenticated) return <CalendarApp role={authenticated} onLogout={() => { void fetch('/api/auth/logout', { method: 'POST' }).finally(() => setAuthenticated(false)); }} />;
  return <Modal title="Вход"><form className="releaseForm" onSubmit={event => void submit(event)}>
    <label>Логин <input className="input" autoComplete="username" required value={login} onChange={event => setLogin(event.target.value)} /></label>
    <label>Пароль <input className="input" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
    {error && <p className="fieldError" role="alert">{error}</p>}
    <button className="button button--primary">Войти</button>
  </form></Modal>;
}
