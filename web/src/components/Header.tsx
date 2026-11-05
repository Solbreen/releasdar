import styles from './Header.module.css';

interface HeaderProps {
  year: number;
  userName: string | null;
  onSwitchUser: () => void;
}

export function Header({ year, userName, onSwitchUser }: HeaderProps): JSX.Element {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Отпуска команды · {year}</h1>
      {userName ? (
        <div className={styles.user}>
          <span className={styles.name} title={userName}>
            {userName}
          </span>
          <button type="button" className="button" onClick={onSwitchUser}>
            Сменить пользователя
          </button>
        </div>
      ) : null}
    </header>
  );
}
