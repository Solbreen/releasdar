import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal.js';

type Account = { id: number; login: string; role: 'rp' | 'devops' };
export function Accounts({ onClose }: { onClose: () => void }): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('');
  const [role, setRole] = useState<Account['role']>('rp');
  const [edit, setEdit] = useState<Account | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = async (): Promise<void> => { const r = await fetch('/api/accounts'); if (!r.ok) throw new Error('Не удалось загрузить пользователей'); setAccounts(await r.json() as Account[]); };
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, []);
  const save = async (event: FormEvent): Promise<void> => { event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const response = await fetch(edit ? `/api/accounts/${edit.id}` : '/api/accounts', { method: edit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit ? { role, ...(password ? { password } : {}) } : { login, password, role }) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || 'Ошибка сохранения'); }
      setLogin(''); setPassword(''); setRole('rp'); setEdit(null); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (account: Account): Promise<void> => {
    if (busy || !window.confirm(`Удалить пользователя «${account.login}»?`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Не удалось удалить пользователя');
      if (edit?.id === account.id) { setEdit(null); setPassword(''); setRole('rp'); }
      await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <Modal title="Управление пользователями" onClose={onClose}><div className="releaseForm">
    <div className="releaseFeed">{accounts.map(account => <div className="releaseItem" key={account.id}><strong>{account.login}</strong> · {account.role === 'rp' ? 'РП' : 'DevOps'} <button type="button" className="button" onClick={() => { setEdit(account); setRole(account.role); setPassword(''); setError(''); }}>Изменить</button> <button type="button" className="button button--danger" disabled={busy} onClick={() => void remove(account)}>Удалить</button></div>)}{accounts.length === 0 && <p>Пользователи пока не созданы.</p>}</div>
    <form className="releaseForm" onSubmit={event => void save(event)}><h3>{edit ? `Изменить: ${edit.login}` : 'Новый пользователь'}</h3>
      {!edit && <label>Логин <input className="input" maxLength={100} required value={login} onChange={event => setLogin(event.target.value)} /></label>}
      <label>{edit ? 'Новый пароль (необязательно)' : 'Пароль'} <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={256} required={!edit} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label>Роль <select className="input" value={role} onChange={event => setRole(event.target.value as Account['role'])}><option value="rp">РП</option><option value="devops">DevOps</option></select></label>
      {error && <p className="fieldError" role="alert">{error}</p>}
      <div className="releaseActions">{edit && <button type="button" className="button" onClick={() => { setEdit(null); setPassword(''); setRole('rp'); }}>Отмена</button>}<button className="button button--primary" disabled={busy || (!edit && (!login.trim() || password.length < 8))}>Сохранить</button></div>
    </form></div></Modal>;
}
