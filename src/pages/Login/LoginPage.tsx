import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { LogIn } from 'lucide-react';
import { login } from '../../shared/api/authApi';
import { AppShell } from '../../shared/components/AppShell';
import { useAuthStore } from '../../shared/store/authStore';

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return error.response?.data?.message ?? '서버와 통신하지 못했습니다.';
  }

  return '로그인 처리 중 오류가 발생했습니다.';
}

export function LoginPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((state) => state.registerUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
      registerUser(user);
      navigate('/map', { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="auth-page">
        <form className="auth-panel panel" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <span className="eyebrow">OASIS 로그인</span>
              <h2>계정으로 접속</h2>
            </div>
            <LogIn size={20} aria-hidden="true" />
          </div>
          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
          <div className="form-grid">
            <label className="full">
              이메일
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="full">
              비밀번호
              <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          </div>
          <div className="signup-actions">
            <Link className="command-link" to="/signup">
              회원가입
            </Link>
            <button className="command-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '로그인 중' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
