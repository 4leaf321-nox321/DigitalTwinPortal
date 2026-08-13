/**
 * Profile Page
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './AuthPages.css';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateProfile, changePassword, logout, error, clearError } = useAuth();

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    department: user?.department || '',
    position: user?.position || '',
    phone: user?.phone || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
    setProfileError('');
    setProfileSuccess('');
    clearError();
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    setPasswordError('');
    setPasswordSuccess('');
    clearError();
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!profileData.name.trim()) {
      setProfileError('이름은 필수 항목입니다.');
      return;
    }

    setProfileLoading(true);
    const result = await updateProfile(profileData);
    setProfileLoading(false);

    if (result.success) {
      setProfileSuccess('프로필이 업데이트되었습니다.');
    } else {
      setProfileError(result.error);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!passwordData.currentPassword || !passwordData.newPassword) {
      setPasswordError('모든 필드를 입력해주세요.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    setPasswordLoading(true);
    const result = await changePassword(
      passwordData.currentPassword,
      passwordData.newPassword
    );
    setPasswordLoading(false);

    if (result.success) {
      setPasswordSuccess('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } else {
      setPasswordError(result.error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <p>로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {getInitials(user.name)}
        </div>
        <div className="profile-info">
          <h1>{user.name}</h1>
          <p>{user.email}</p>
          {user.department && <p>{user.department} {user.position && `/ ${user.position}`}</p>}
        </div>
      </div>

      {/* Profile Edit Section */}
      <div className="profile-section">
        <h2>프로필 정보</h2>
        <form className="profile-form" onSubmit={handleProfileSubmit}>
          {profileError && <div className="auth-error">{profileError}</div>}
          {profileSuccess && (
            <div className="auth-error" style={{ background: '#e8f5e9', borderColor: '#c8e6c9', color: '#2e7d32' }}>
              {profileSuccess}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">이름 *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={profileData.name}
                onChange={handleProfileChange}
                disabled={profileLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">연락처</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={profileData.phone}
                onChange={handleProfileChange}
                disabled={profileLoading}
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
                value={profileData.department}
                onChange={handleProfileChange}
                disabled={profileLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="position">직책</label>
              <input
                type="text"
                id="position"
                name="position"
                value={profileData.position}
                onChange={handleProfileChange}
                disabled={profileLoading}
              />
            </div>
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={profileLoading}>
              {profileLoading ? '저장 중...' : '프로필 저장'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Section */}
      <div className="profile-section">
        <h2>비밀번호 변경</h2>
        <form className="profile-form" onSubmit={handlePasswordSubmit}>
          {passwordError && <div className="auth-error">{passwordError}</div>}
          {passwordSuccess && (
            <div className="auth-error" style={{ background: '#e8f5e9', borderColor: '#c8e6c9', color: '#2e7d32' }}>
              {passwordSuccess}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="currentPassword">현재 비밀번호</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={passwordData.currentPassword}
              onChange={handlePasswordChange}
              disabled={passwordLoading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="newPassword">새 비밀번호</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="8자 이상"
                disabled={passwordLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">새 비밀번호 확인</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                disabled={passwordLoading}
              />
            </div>
          </div>

          <div className="profile-actions">
            <button type="submit" className="btn-primary" disabled={passwordLoading}>
              {passwordLoading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </div>

      {/* Logout Section */}
      <div className="profile-section">
        <h2>계정</h2>
        <div className="profile-actions">
          <button type="button" className="btn-danger" onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
