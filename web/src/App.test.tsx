import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from './App.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('создаёт релиз для выбранного дня и показывает его в карточке продукта', async () => {
  const products = [{ id: 1, name: 'Портал', manager: 'Иван Иванов', managerId: 1, description: '', color: '#3a86ff', status: 'active' }];
  const releases: { id: number; productId: number; date: string; description: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/auth/me') return { ok: true, json: async () => ({ role: 'admin' }) };
    if (url === '/api/products') return { ok: true, json: async () => products };
    if (url === '/api/project-managers') return { ok: true, json: async () => [{ id: 1, fullName: 'Иван Иванов' }] };
    if (options?.method === 'POST') {
      releases.push({ id: 1, ...JSON.parse(options.body as string) });
      return { ok: true, json: async () => ({ id: 1 }) };
    }
    return { ok: true, json: async () => releases };
  }));
  render(<App />);
  await screen.findByRole('button', { name: 'Портал' });
  expect(screen.getByRole('button', { name: 'Релизы' })).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Год'), { target: { value: '2028' } });
  fireEvent.click(screen.getByRole('button', { name: /2028-02-29/ }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Создать релиз' }));
  const dialog = screen.getByRole('dialog');
  expect((within(dialog).getByLabelText('Дата') as HTMLInputElement).value).toBe('2028-02-29');
  fireEvent.change(within(dialog).getByLabelText('Продукт'), { target: { value: '1' } });
  fireEvent.change(within(dialog).getByLabelText('Описание'), { target: { value: 'Версия 1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Портал' }));
  expect(within(screen.getByRole('dialog')).getByText('Версия 1')).toBeTruthy();
});

it('показывает DevOps общую очередь без отклонённых релизов и переводит релиз в работу', async () => {
  const releases = [
    { id: 1, productId: 1, date: '2026-01-01', description: 'Ранний', status: 'planned' },
    { id: 2, productId: 1, date: '2030-01-01', description: 'Поздний', status: 'planned' },
    { id: 3, productId: 1, date: '2027-01-01', description: 'Отклонённый', status: 'rejected' },
    { id: 4, productId: 1, date: '2027-02-01', description: 'Завершённый', status: 'completed' },
  ];
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/auth/me') return { ok: true, json: async () => ({ role: 'devops' }) };
    if (url === '/api/products') return { ok: true, json: async () => [{ id: 1, name: 'Архивный', status: 'archived' }] };
    if (url === '/api/project-managers') return { ok: true, json: async () => [] };
    if (options?.method === 'PATCH') { releases[0]!.status = 'in_progress'; return { ok: true, json: async () => ({ ok: true }) }; }
    return { ok: true, json: async () => releases };
  }));
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Релизы' }));
  const dialog = screen.getByRole('dialog', { name: 'Релизы' });
  await within(dialog).findByText('Ранний');
  expect(within(dialog).queryByText('Отклонённый')).toBeNull();
  expect(within(dialog).queryByText('Завершённый')).toBeNull();
  const plannedSection = within(dialog).getByText('Запланированы', { exact: false }).closest('details')!;
  const progressSection = within(dialog).getByText('В работе', { exact: false }).closest('details')!;
  expect(plannedSection.open).toBe(true);
  expect(progressSection.open).toBe(false);
  fireEvent.click(within(progressSection).getByText('В работе', { exact: false }));
  expect(progressSection.open).toBe(true);
  expect(within(dialog).getByText('Ранний').compareDocumentPosition(within(dialog).getByText('Поздний')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(dialog).getByText('Ранний').closest('.releaseItem')?.textContent).toContain('Архивный');
  fireEvent.click(within(within(dialog).getByText('Ранний').closest('.releaseItem') as HTMLElement).getByRole('button', { name: 'В работу' }));
  await waitFor(() => expect(within(within(dialog).getByText('Ранний').closest('.releaseItem') as HTMLElement).getByText('В работе')).toBeTruthy());
});
