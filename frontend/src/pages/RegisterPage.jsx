import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle, Building } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const RegisterContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0066CC 0%, #003399 100%);
  padding: 2rem;
`;

const RegisterBox = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
`;

const RegisterHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;

  svg {
    color: #0066CC;
  }
`;

const Title = styled.h1`
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
`;

const Subtitle = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
`;

const RegisterForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const InputIcon = styled.div`
  position: absolute;
  left: 1rem;
  color: #9ca3af;
  display: flex;
  align-items: center;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #0066CC;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #dc2626;
  font-size: 0.875rem;

  svg {
    flex-shrink: 0;
  }
`;

const RegisterButton = styled.button`
  background: linear-gradient(135deg, #0066CC 0%, #003399 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(0, 102, 204, 0.3);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const LoginLink = styled.div`
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;

  a {
    color: #0066CC;
    font-weight: 600;
    text-decoration: none;
    margin-left: 0.25rem;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const SuccessContainer = styled.div`
  text-align: center;
  padding: 2rem;

  svg {
    color: #16a34a;
    margin-bottom: 1rem;
  }

  h2 {
    color: #1f2937;
    margin: 0 0 0.5rem 0;
  }

  p {
    color: #6b7280;
    margin: 0.25rem 0;
  }
`;

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, isAuthenticated, clearError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    department: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    if (clearError) clearError();
  };

  const validateForm = () => {
    if (!formData.email.trim() || !formData.name.trim() || !formData.password.trim()) {
      setError('모든 필드를 입력해주세요.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('유효한 이메일 주소를 입력해주세요.');
      return false;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (clearError) clearError();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const result = await register({
        email: formData.email,
        name: formData.name,
        department: formData.department,
        password: formData.password
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(result.error || '회원가입에 실패했습니다.');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <RegisterContainer>
        <RegisterBox>
          <SuccessContainer>
            <CheckCircle size={64} />
            <h2>회원가입 완료!</h2>
            <p>회원가입이 성공적으로 완료되었습니다.</p>
            <p>로그인 페이지로 이동합니다...</p>
          </SuccessContainer>
        </RegisterBox>
      </RegisterContainer>
    );
  }

  return (
    <RegisterContainer>
      <RegisterBox>
        <RegisterHeader>
          <Logo>
            <UserPlus size={32} />
          </Logo>
          <Title>회원가입</Title>
          <Subtitle>디지털 트윈 포털에 가입하세요</Subtitle>
        </RegisterHeader>

        <RegisterForm onSubmit={handleSubmit}>
          <InputGroup>
            <Label htmlFor="email">이메일 (아이디)</Label>
            <InputWrapper>
              <InputIcon>
                <Mail size={18} />
              </InputIcon>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="example@company.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="email"
              />
            </InputWrapper>
          </InputGroup>

          <InputGroup>
            <Label htmlFor="name">이름</Label>
            <InputWrapper>
              <InputIcon>
                <User size={18} />
              </InputIcon>
              <Input
                id="name"
                type="text"
                name="name"
                placeholder="홍길동"
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="name"
              />
            </InputWrapper>
          </InputGroup>

          <InputGroup>
            <Label htmlFor="department">부서명 (선택)</Label>
            <InputWrapper>
              <InputIcon>
                <Building size={18} />
              </InputIcon>
              <Input
                id="department"
                type="text"
                name="department"
                placeholder="예: 조직도 상의 그룹 명을 입력하세요. 속하는 그룹이 없을 경우, 팀을 입력하세요"
                value={formData.department}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="organization"
              />
            </InputWrapper>
          </InputGroup>

          <InputGroup>
            <Label htmlFor="password">비밀번호</Label>
            <InputWrapper>
              <InputIcon>
                <Lock size={18} />
              </InputIcon>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="8자 이상 입력하세요"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </InputWrapper>
          </InputGroup>

          <InputGroup>
            <Label htmlFor="confirmPassword">비밀번호 확인</Label>
            <InputWrapper>
              <InputIcon>
                <Lock size={18} />
              </InputIcon>
              <Input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="비밀번호를 다시 입력하세요"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={isLoading}
                autoComplete="new-password"
              />
            </InputWrapper>
          </InputGroup>

          {error && (
            <ErrorMessage>
              <AlertCircle size={16} />
              <span>{error}</span>
            </ErrorMessage>
          )}

          <RegisterButton type="submit" disabled={isLoading}>
            <UserPlus size={18} />
            {isLoading ? '가입 중...' : '회원가입'}
          </RegisterButton>
        </RegisterForm>

        <LoginLink>
          이미 계정이 있으신가요?
          <Link to="/login">로그인</Link>
        </LoginLink>
      </RegisterBox>
    </RegisterContainer>
  );
};

export default RegisterPage;
