import styles from './SavePanel.module.css';

interface SavePanelProps {
  changes: number;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function SavePanel({ changes, saving, onSave, onReset }: SavePanelProps): JSX.Element {
  const disabled = changes === 0 || saving;

  return (
    <div className={styles.panel}>
      <span className={changes > 0 ? styles.counterActive : styles.counter}>
        {changes > 0 ? `Несохранённых изменений: ${changes}` : 'Все изменения сохранены'}
      </span>
      <div className={styles.actions}>
        <button type="button" className="button" onClick={onReset} disabled={disabled}>
          Отменить
        </button>
        <button type="button" className="button button--primary" onClick={onSave} disabled={disabled}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
