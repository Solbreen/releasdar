import styles from './Toasts.module.css';

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface ToastsProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function Toasts({ toasts, onDismiss }: ToastsProps): JSX.Element {
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          type="button"
          key={toast.id}
          className={toast.kind === 'error' ? styles.error : styles.info}
          onClick={() => onDismiss(toast.id)}
          title="Скрыть уведомление"
        >
          {toast.text}
        </button>
      ))}
    </div>
  );
}
