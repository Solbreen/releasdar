import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from './Modal.js';

type Account = { id: number; login: string; fullName: string; role: 'rp' | 'devops' };
export function Accounts({ onClose }: { onClose: () => void }): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [login, setLogin] = useState(''); const [fullName, setFullName] = useState(''); const [password, setPassword] = useState('');
  const [role, setRole] = useState<Account['role']>('rp');
  const [edit, setEdit] = useState<Account | null>(null); const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = async (): Promise<void> => { const r = await fetch('/api/accounts'); if (!r.ok) throw new Error('Не удалось загрузить пользователей'); setAccounts(await r.json() as Account[]); };
  useEffect(() => { void load().catch((e: Error) => setError(e.message)); }, []);
  const open = (account: Account | null): void => { setEdit(account); setLogin(account?.login ?? ''); setFullName(account?.fullName ?? ''); setPassword(''); setRole(account?.role ?? 'rp'); setError(''); setFormOpen(true); };
  const save = async (event: FormEvent): Promise<void> => { event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const response = await fetch(edit ? `/api/accounts/${edit.id}` : '/api/accounts', { method: edit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit ? { fullName, role, ...(password ? { password } : {}) } : { login, fullName, password, role }) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || 'Ошибка сохранения'); }
      setFormOpen(false); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (account: Account): Promise<void> => { if (busy || !window.confirm(`Удалить пользователя «${account.login}»?`)) return; setBusy(true); setError('');
    try { const response = await fetch(`/api/accounts/${account.id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Не удалось удалить пользователя'); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <>
    <Modal title="Управление пользователями" onClose={onClose} footer={<><button type="button" className="button" onClick={onClose}>Закрыть</button><button type="button" className="button button--primary" onClick={() => open(null)}>Создать</button></>}>
      <div className="releaseFeed">{accounts.map(account => <div className="releaseItem accountRow" key={account.id}><div><strong>{account.fullName || account.login}</strong><div>{account.login} · {account.role === 'rp' ? 'РП' : 'DevOps'}</div></div><div className="accountActions"><button type="button" className="button" onClick={() => open(account)}>Изменить</button><button type="button" className="button button--danger" disabled={busy} onClick={() => void remove(account)}>Удалить</button></div></div>)}{accounts.length === 0 && <p>Пользователи пока не созданы.</p>}</div>
      {!formOpen && error && <p className="fieldError" role="alert">{error}</p>}
    </Modal>
    {formOpen && <Modal title={edit ? 'Изменить пользователя' : 'Новый пользователь'} onClose={() => setFormOpen(false)} footer={<><button type="button" className="button" onClick={() => setFormOpen(false)}>Закрыть</button><button form="account-form" className="button button--primary" disabled={busy || !fullName.trim() || (!edit && (!login.trim() || password.length < 8))}>Сохранить</button></>}><form id="account-form" className="releaseForm" onSubmit={event => void save(event)}>
      <label>ФИО <input className="input" maxLength={200} required value={fullName} onChange={event => setFullName(event.target.value)} /></label>
      <label>Логин <input className="input" maxLength={100} required disabled={!!edit} value={login} onChange={event => setLogin(event.target.value)} /></label>
      <label>{edit ? 'Новый пароль (необязательно)' : 'Пароль'} <input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={256} required={!edit} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label>Роль <select className="input" value={role} onChange={event => setRole(event.target.value as Account['role'])}><option value="rp">РП</option><option value="devops">DevOps</option></select></label>
      {error && <p className="fieldError" role="alert">{error}</p>}
    </form></Modal>}
  </>;
}
