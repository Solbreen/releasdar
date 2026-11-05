import styles from './Legend.module.css';

interface LegendProps {
  /** Цвет текущего пользователя для образца «Мой отпуск». */
  ownColor: string;
}

export function Legend({ ownColor }: LegendProps): JSX.Element {
  return (
    <div className={styles.legend}>
      <span className={styles.item}>
        <span className={styles.weekend} aria-hidden="true" />
        Выходной
      </span>
      <span className={styles.item}>
        <span className={styles.holiday} aria-hidden="true" />
        Праздник
      </span>
      <span className={styles.item}>
        <span className={styles.own} style={{ background: ownColor }} aria-hidden="true" />
        Мой отпуск
      </span>
      <span className={styles.item}>
        <span
          className={styles.unsaved}
          style={{ ['--own-color' as string]: ownColor }}
          aria-hidden="true"
        />
        Не сохранено
      </span>
    </div>
  );
}
