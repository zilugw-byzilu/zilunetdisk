import React, { useState } from 'react';
import axios from 'axios';

const AdminziluLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/adminzilu/login', { password });
      onLogin(response.data.user, response.data.token);
    } catch (error) {
      setError(error.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">管理员登录</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="password"
              name="password"
              className="form-control"
              placeholder="管理员密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '管理员登录'}
          </button>
        </form>
        <div className="auth-link">
          <p><a href="/">返回普通登录</a></p>
        </div>
      </div>
    </div>
  );
};

export default AdminziluLogin; 