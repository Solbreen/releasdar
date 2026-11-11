import type { ReactNode } from 'react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  headerAction?: ReactNode;
  wide?: boolean;
  /** Если не передан, модалку нельзя закрыть (экран входа). */
  onClose?: () => void;
}

export function Modal({ title, children, footer, headerAction, onClose, wide = false }: ModalProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const startDrag = (event: PointerEvent<HTMLHeadingElement>): void => {
    if (event.button !== 0 || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    setPosition({ x: rect.left, y: rect.top }); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLHeadingElement>): void => {
    if (!drag.current || !ref.current) return;
    const x = drag.current.left + event.clientX - drag.current.x;
    const y = drag.current.top + event.clientY - drag.current.y;
    setPosition({ x: Math.max(0, Math.min(x, window.innerWidth - 50)), y: Math.max(0, Math.min(y, window.innerHeight - 40)) });
  };

  useEffect(() => {
    // Фокус внутрь модалки, чтобы с клавиатуры сразу можно было работать.
    ref.current?.querySelector<HTMLElement>('input, button')?.focus();
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && ref.current?.closest(`.${styles.overlay}`) === Array.from(document.querySelectorAll(`.${styles.overlay}`)).at(-1)) onClose();
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
      <div className={`${styles.dialog} ${wide ? styles.wide : ''}`} style={position ? { position: 'fixed', left: position.x, top: position.y } : undefined} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className={styles.heading}><h2 className={styles.title} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>{title}</h2>{headerAction}{onClose && <button type="button" className={styles.close} aria-label="Закрыть" onClick={onClose}>×</button>}</div>
        <div className={styles.body}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  );
}
