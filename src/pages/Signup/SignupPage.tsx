import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { ShieldCheck, UserRoundPlus } from 'lucide-react';
import { signup, SignupPayload } from '../../shared/api/authApi';
import { AppShell } from '../../shared/components/AppShell';
import { useAuthStore } from '../../shared/store/authStore';
import { UserRole } from '../../shared/types/domain';

const emptyForm: SignupPayload = {
  role: 'USER',
  name: '',
  email: '',
  phone: '',
  password: '',
  organization: '',
  department: '',
  address: '',
  emergencyContact: '',
  memo: '',
};

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    return error.response?.data?.message ?? '서버와 통신하지 못했습니다.';
  }

  return '회원가입 처리 중 오류가 발생했습니다.';
}

export function SignupPage() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((state) => state.registerUser);
  const [form, setForm] = useState<SignupPayload>(emptyForm);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasConfirmPassword = confirmPassword.length > 0;
  const isPasswordMatched = form.password === confirmPassword;

  const updateField = (field: keyof SignupPayload, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateRole = (role: UserRole) => {
    setForm((current) => ({ ...current, role }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (form.password !== confirmPassword) {
      setErrorMessage('비밀번호가 서로 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await signup(form);
      registerUser(user);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="signup-layout">
        <section className="signup-hero">
          <span className="eyebrow">OASIS 계정 생성</span>
          <h1>운영 권한에 맞는 계정을 등록하세요</h1>
          <p>회원 정보는 Supabase Postgres의 users 테이블에 저장됩니다. 관리자는 전체 관제 메뉴를 사용할 수 있습니다.</p>
        </section>

        <form className="signup-form panel" onSubmit={handleSubmit}>
          <div className="role-selector" role="group" aria-label="회원 유형">
            <button
              className={form.role === 'USER' ? 'role-card active' : 'role-card'}
              type="button"
              onClick={() => updateRole('USER')}
            >
              <UserRoundPlus size={22} aria-hidden="true" />
              <strong>일반 회원가입</strong>
              <span>홈, 통합 지도, 안전 경로 사용</span>
            </button>
            <button
              className={form.role === 'ADMIN' ? 'role-card active' : 'role-card'}
              type="button"
              onClick={() => updateRole('ADMIN')}
            >
              <ShieldCheck size={22} aria-hidden="true" />
              <strong>관리자 회원가입</strong>
              <span>모든 관제 메뉴 사용</span>
            </button>
          </div>

          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

          <div className="form-section-title">기본 정보</div>
          <div className="form-grid">
            <label>
              이름
              <input required value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            </label>
            <label>
              이메일
              <input required type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            </label>
            <label>
              전화번호
              <input required type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </label>
            <label>
              비상 연락처
              <input value={form.emergencyContact} onChange={(event) => updateField('emergencyContact', event.target.value)} />
            </label>
            <label>
              비밀번호
              <input
                required
                minLength={8}
                type="password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
              />
            </label>
            <label>
              비밀번호 확인
              <input
                required
                minLength={8}
                type="password"
                className={hasConfirmPassword ? (isPasswordMatched ? 'input-valid' : 'input-invalid') : ''}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {hasConfirmPassword ? (
                <span className={isPasswordMatched ? 'field-hint valid' : 'field-hint invalid'}>
                  {isPasswordMatched ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
                </span>
              ) : null}
            </label>
          </div>

          <div className="form-section-title">인적사항</div>
          <div className="form-grid">
            <label className="full">
              주소
              <input value={form.address} onChange={(event) => updateField('address', event.target.value)} />
            </label>
          </div>

          <div className="signup-actions">
            <button className="command-button secondary" type="button" onClick={() => navigate('/dashboard')}>
              취소
            </button>
            <button className="command-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? '가입 중' : '가입 완료'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
