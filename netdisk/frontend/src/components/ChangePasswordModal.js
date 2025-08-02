import React, { useState } from 'react';
import axios from 'axios';

const ChangePasswordModal = ({ show, onClose }) => {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPwd !== confirmPwd) {
      setError('两次输入的新密码不一致');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/change_password', {
        old_password: oldPwd,
        new_password: newPwd
      });
      setSuccess('密码修改成功');
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      setError(err.response?.data?.error || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-menu-bg">
      <div className="profile-menu-modal">
        <div className="profile-menu-header">
          <h2>修改密码</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form className="profile-menu-body" onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <div className="form-group">
            <input type="password" className="form-control" placeholder="原密码" value={oldPwd} onChange={e => setOldPwd(e.target.value)} required />
          </div>
          <div className="form-group">
            <input type="password" className="form-control" placeholder="新密码" value={newPwd} onChange={e => setNewPwd(e.target.value)} required />
          </div>
          <div className="form-group">
            <input type="password" className="form-control" placeholder="确认新密码" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>{loading ? '提交中...' : '提交'}</button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal; 