/**
 * Register Page
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './AuthPages.css';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, error, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    department: '',
    position: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setLocalError('');
    clearError();
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.name) {
      setLocalError('이메일, 비밀번호, 이름은 필수 항목입니다.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    if (formData.password.length < 8) {
      setLocalError('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setLocalError('유효한 이메일 주소를 입력해주세요.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!validateForm()) return;

    setLoading(true);
    const result = await register({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      department: formData.department || undefined,
      position: formData.position || undefined,
      phone: formData.phone || undefined
    });
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } else {
      setLocalError(result.error);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-success">
            <h2>회원가입 완료!</h2>
            <p>회원가입이 성공적으로 완료되었습니다.</p>
            <p>로그인 페이지로 이동합니다...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container register-container">
        <div className="auth-header">
          <h1>회원가입</h1>
          <p>Digital Twin Portal 서비스에 가입하세요</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {(localError || error) && (
            <div className="auth-error">
              {localError || error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">이메일 *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@company.com"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">이름 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="홍길동"
                autoComplete="name"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">비밀번호 *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="8자 이상, 영문+숫자"
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">비밀번호 확인 *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="비밀번호를 다시 입력"
                autoComplete="new-password"
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="department">부서</label>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="예: 기술연구소"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="position">직책</label>
              <input
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="예: 선임연구원"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone">연락처</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="010-1234-5678"
              autoComplete="tel"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            이미 계정이 있으신가요?{' '}
            <Link to="/login">로그인</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
