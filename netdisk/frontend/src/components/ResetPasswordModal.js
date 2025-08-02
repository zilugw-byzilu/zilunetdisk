import React, { useState } from 'react';
import axios from 'axios';

const ResetPasswordModal = ({ show, onClose }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await axios.post('/api/request_reset_code', { email });
      setSuccess('验证码已发送，请查收邮箱');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await axios.post('/api/reset_password', { email, code, new_password: newPwd });
      setSuccess('密码重置成功');
      setStep(1); setEmail(''); setCode(''); setNewPwd('');
    } catch (err) {
      setError(err.response?.data?.error || '重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-menu-bg">
      <div className="profile-menu-modal">
        <div className="profile-menu-header">
          <h2>找回密码</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        {step === 1 && (
          <form className="profile-menu-body" onSubmit={handleSendCode}>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            <div className="form-group">
              <input type="email" className="form-control" placeholder="注册邮箱" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button className="btn btn-info" type="submit" style={{ width: '100%' }} disabled={loading}>{loading ? '发送中...' : '发送验证码'}</button>
          </form>
        )}
        {step === 2 && (
          <form className="profile-menu-body" onSubmit={handleReset}>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            <div className="form-group">
              <input type="text" className="form-control" placeholder="邮箱验证码" value={code} onChange={e => setCode(e.target.value)} required />
            </div>
            <div className="form-group">
              <input type="password" className="form-control" placeholder="新密码" value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>{loading ? '提交中...' : '重置密码'}</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal; 