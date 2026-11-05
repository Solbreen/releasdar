import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Если не передан, модалку нельзя закрыть (экран входа). */
  onClose?: () => void;
}

export function Modal({ title, children, footer, onClose }: ModalProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Фокус внутрь модалки, чтобы с клавиатуры сразу можно было работать.
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
