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
