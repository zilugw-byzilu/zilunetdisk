import React, { useEffect, useState } from 'react';
import axios from 'axios';

const AdminPanel = () => {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quotaEdit, setQuotaEdit] = useState({});

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/users');
      setUsers(res.data.users);
    } catch (err) {
      setError('获取用户失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/files');
      setFiles(res.data.files);
    } catch (err) {
      setError('获取文件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    if (tab === 'files') fetchFiles();
    // eslint-disable-next-line
  }, [tab]);

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('确定要删除该用户？')) return;
    try {
      await axios.post('/api/admin/delete_user', { user_id: userId });
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleSetQuota = async (userId) => {
    const quota = quotaEdit[userId];
    if (!quota || isNaN(quota)) return alert('请输入有效数字');
    try {
      await axios.post('/api/admin/set_user_quota', { user_id: userId, quota: Number(quota) * 1024 * 1024 * 1024 });
      alert('空间已设置');
      setQuotaEdit({ ...quotaEdit, [userId]: '' });
      fetchUsers();
    } catch (err) {
      alert('设置失败');
    }
  };

  return (
    <div className="container">
      <h1>管理面板</h1>
      <div className="admin-tabs mb-3">
        <button className={tab === 'users' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('users')}>用户管理</button>
        <button className={tab === 'files' ? 'btn btn-primary' : 'btn'} onClick={() => setTab('files')}>文件管理</button>
      </div>
      {error && <div className="error-message">{error}</div>}
      {tab === 'users' && (
        <div className="admin-users">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>邮箱</th>
                <th>管理员</th>
                <th>已用空间</th>
                <th>注册时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.is_admin ? '是' : '否'}</td>
                  <td>{(u.storage_used / (1024 * 1024 * 1024)).toFixed(2)} GB</td>
                  <td>{new Date(u.created_at).toLocaleString()}</td>
                  <td>
                    {!u.is_admin && <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}>删除</button>}
                    <input
                      type="number"
                      min="1"
                      placeholder="空间(GB)"
                      value={quotaEdit[u.id] || ''}
                      onChange={e => setQuotaEdit({ ...quotaEdit, [u.id]: e.target.value })}
                      style={{ width: 70, marginLeft: 8 }}
                    />
                    <button className="btn btn-info btn-sm" style={{ marginLeft: 4 }} onClick={() => handleSetQuota(u.id)}>设置空间</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'files' && (
        <div className="admin-files">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>文件名</th>
                <th>大小</th>
                <th>用户ID</th>
                <th>分享码</th>
                <th>上传时间</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td>{f.id}</td>
                  <td>{f.filename}</td>
                  <td>{(f.file_size / (1024 * 1024)).toFixed(2)} MB</td>
                  <td>{f.user_id}</td>
                  <td>{f.share_code || '-'}</td>
                  <td>{new Date(f.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPanel; 