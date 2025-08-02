import React, { useState } from 'react';
import axios from 'axios';

const DeleteAccountModal = ({ show, onClose, onLogout }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleDelete = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await axios.post('/api/delete_account', { password });
      setSuccess('账户已注销，正在退出...');
      setTimeout(() => {
        onLogout && onLogout();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || '注销失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-menu-bg">
      <div className="profile-menu-modal">
        <div className="profile-menu-header">
          <h2>注销账户</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form className="profile-menu-body" onSubmit={handleDelete}>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <div className="form-group">
            <input type="password" className="form-control" placeholder="请输入密码确认" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-danger" type="submit" style={{ width: '100%' }} disabled={loading}>{loading ? '正在注销...' : '确认注销'}</button>
        </form>
      </div>
    </div>
  );
};

export default DeleteAccountModal; 