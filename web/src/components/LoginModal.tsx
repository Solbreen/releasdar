import { useState } from 'react';
import { Modal } from './Modal.js';
import { firstNameSchema, lastNameSchema } from '../../../shared/schemas.js';

interface LoginModalProps {
  busy: boolean;
  /** Ошибка от сервера; ошибки формата проверяются на клиенте. */
  serverError: string | null;
  onSubmit: (firstName: string, lastName: string) => void;
}

export function LoginModal({ busy, serverError, onSubmit }: LoginModalProps): JSX.Element {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});

  // Кнопка неактивна, пока не заполнены оба поля.
  const filled = firstName.trim().length > 0 && lastName.trim().length > 0;

  const submit = (): void => {
    const first = firstNameSchema.safeParse(firstName);
    const last = lastNameSchema.safeParse(lastName);
    if (!first.success || !last.success) {
      setErrors({
        firstName: first.success ? undefined : first.error.issues[0]?.message,
        lastName: last.success ? undefined : last.error.issues[0]?.message,
      });
      return;
    }
    setErrors({});
    onSubmit(first.data, last.data);
  };

  return (
    <Modal
      title="Вход"
      footer={
        <button
          type="submit"
          form="login-form"
          className="button button--primary"
          disabled={busy || !filled}
        >
          {busy ? 'Входим…' : 'Войти'}
        </button>
      }
    >
      <form
        id="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="login-first-name">Имя</label>
        <input
          id="login-first-name"
          className={`input ${errors.firstName ? 'input--invalid' : ''}`}
          style={{ marginTop: 6 }}
          value={firstName}
          maxLength={60}
          autoComplete="off"
          aria-invalid={errors.firstName ? true : undefined}
          aria-describedby={errors.firstName ? 'login-first-name-error' : undefined}
          onChange={(event) => {
            setFirstName(event.target.value);
            setErrors((current) => ({ ...current, firstName: undefined }));
          }}
        />
        {errors.firstName ? (
          <p className="fieldError" id="login-first-name-error" role="alert">
            {errors.firstName}
          </p>
        ) : null}

        <label htmlFor="login-last-name" style={{ display: 'block', marginTop: 12 }}>
          Фамилия
        </label>
        <input
          id="login-last-name"
          className={`input ${errors.lastName ? 'input--invalid' : ''}`}
          style={{ marginTop: 6 }}
          value={lastName}
          maxLength={60}
          autoComplete="off"
          aria-invalid={errors.lastName ? true : undefined}
          aria-describedby={errors.lastName ? 'login-last-name-error' : undefined}
          onChange={(event) => {
            setLastName(event.target.value);
            setErrors((current) => ({ ...current, lastName: undefined }));
          }}
        />
        {errors.lastName ? (
          <p className="fieldError" id="login-last-name-error" role="alert">
            {errors.lastName}
          </p>
        ) : null}

        {serverError ? (
          <p className="fieldError" role="alert">
            {serverError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
