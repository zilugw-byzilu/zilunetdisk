import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
import FileList from './FileList';
import StorageInfo from './StorageInfo';
import Sidebar from './Sidebar';
import ProfileMenu from './ProfileMenu';
import ChangePasswordModal from './ChangePasswordModal';
import ResetPasswordModal from './ResetPasswordModal';
import DeleteAccountModal from './DeleteAccountModal';
import AppDownloadModal from './AppDownloadModal';
import AdminPanel from './AdminPanel';

const Dashboard = ({ user, onLogout }) => {
  const [files, setFiles] = useState([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, limit: 10 * 1024 * 1024 * 1024 });
  const [selected, setSelected] = useState('files');
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showAppDownload, setShowAppDownload] = useState(false);
  const [downloads, setDownloads] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [activeDownloads, setActiveDownloads] = useState(new Set());

  useEffect(() => {
    fetchFiles();
    fetchStorageInfo();
    fetchDownloads();
  }, []);

  // 轮询下载进度
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeDownloads.size > 0) {
        fetchDownloads();
      }
    }, 2000); // 每2秒更新一次

    return () => clearInterval(interval);
  }, [activeDownloads]);

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/files', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFiles(response.data.files);
    } catch (error) {
      console.error('获取文件列表失败:', error);
    }
  };

  const fetchStorageInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 确保数据有效
      const storageUsed = response.data.storage_used || 0;
      const storageLimit = response.data.storage_limit || (10 * 1024 * 1024 * 1024);
      
      setStorageInfo({
        used: storageUsed,
        limit: storageLimit
      });
    } catch (error) {
      console.error('获取存储信息失败:', error);
      // 设置默认值
      setStorageInfo({
        used: 0,
        limit: 10 * 1024 * 1024 * 1024
      });
    }
  };

  const fetchDownloads = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/downloads', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDownloads(response.data.downloads);
      
      // 更新活跃下载任务
      const active = new Set();
      response.data.downloads.forEach(download => {
        if (download.status === 'downloading' || download.status === 'starting') {
          active.add(download.id);
        }
      });
      setActiveDownloads(active);
    } catch (error) {
      console.error('获取下载列表失败:', error);
    }
  };

  const handleFileUpload = async (file, type = 'local') => {
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      
      if (type === 'local') {
        formData.append('file', file);
      } else if (type === 'torrent') {
        formData.append('torrent_file', file);
        formData.append('type', 'torrent');
      } else if (type === 'ed2k') {
        formData.append('ed2k_link', file);
        formData.append('type', 'ed2k');
      }

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // 添加到上传历史
      setUploadHistory(prev => [{
        id: Date.now(),
        filename: response.data.filename || file.name || file,
        status: 'success',
        timestamp: new Date().toLocaleString(),
        download_id: response.data.download_id
      }, ...prev]);

      // 如果是种子或ed2k下载，添加到活跃下载
      if (response.data.download_id) {
        setActiveDownloads(prev => new Set(prev).add(response.data.download_id));
      }

      fetchFiles();
      fetchStorageInfo();
    } catch (error) {
      console.error('上传失败:', error);
      setUploadHistory(prev => [{
        id: Date.now(),
        filename: file.name || file,
        status: 'error',
        timestamp: new Date().toLocaleString(),
        error: error.response?.data?.error || '上传失败'
      }, ...prev]);
    }
  };

  const handleTorrentUpload = async (file) => {
    const confirmed = window.confirm('检测到种子文件，是否上传并解析下载文件？');
    if (confirmed) {
      await handleFileUpload(file, 'torrent');
    }
  };

  const handleEd2kUpload = async (link) => {
    const confirmed = window.confirm('检测到ed2k链接，是否开始下载？');
    if (confirmed) {
      await handleFileUpload(link, 'ed2k');
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'starting': return '准备中';
      case 'downloading': return '下载中';
      case 'completed': return '已完成';
      case 'error': return '失败';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'starting': return '#ffc107';
      case 'downloading': return '#007bff';
      case 'completed': return '#28a745';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const renderContent = () => {
    switch (selected) {
      case 'upload':
        return (
          <div className="upload-section">
            <h2>上传文件</h2>
            <div className="upload-methods">
              <div className="upload-method">
                <h3>本地文件上传</h3>
                <FileUpload onUpload={handleFileUpload} />
              </div>
              <div className="upload-method">
                <h3>种子文件上传</h3>
                <input
                  type="file"
                  accept=".torrent"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      handleTorrentUpload(e.target.files[0]);
                    }
                  }}
                />
                <p>支持.torrent文件，上传后自动解析下载</p>
              </div>
              <div className="upload-method">
                <h3>ed2k链接下载</h3>
                <input
                  type="text"
                  placeholder="输入ed2k链接"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && e.target.value) {
                      handleEd2kUpload(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
                <p>输入ed2k链接后按回车开始下载</p>
              </div>
            </div>
            <div className="upload-history">
              <h3>上传历史</h3>
              <div className="history-list">
                {uploadHistory.map(item => (
                  <div key={item.id} className={`history-item ${item.status}`}>
                    <span>{item.filename}</span>
                    <span>{item.timestamp}</span>
                    <span className={`status ${item.status}`}>
                      {item.status === 'success' ? '✅' : '❌'}
                    </span>
                    {item.error && <span className="error-text">{item.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'download':
        return (
          <div className="download-section">
            <h2>下载管理</h2>
            <div className="download-list">
              {downloads.length === 0 ? (
                <p>暂无下载任务</p>
              ) : (
                downloads.map(download => (
                  <div key={download.id} className="download-item">
                    <div className="download-info">
                      <div className="download-filename">{download.filename}</div>
                      <div className="download-type">{download.type === 'torrent' ? '种子下载' : 'ed2k下载'}</div>
                    </div>
                    <div className="download-progress">
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${download.progress}%`,
                            backgroundColor: getStatusColor(download.status)
                          }}
                        ></div>
                      </div>
                      <span className="progress-text">{download.progress}%</span>
                    </div>
                    <div className="download-status">
                      <span style={{ color: getStatusColor(download.status) }}>
                        {getStatusText(download.status)}
                      </span>
                      {download.error && (
                        <div className="error-message">{download.error}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'files':
        return (
          <div className="files-section">
            <h2>文件列表</h2>
            <FileList files={files} onDelete={fetchFiles} />
          </div>
        );
      case 'admin':
        return <AdminPanel />;
      default:
        return (
          <div className="files-section">
            <h2>文件列表</h2>
            <FileList files={files} onDelete={fetchFiles} />
          </div>
        );
    }
  };

  return (
    <div className="dashboard-layout">
      <Sidebar
        selected={selected}
        onSelect={setSelected}
        onAppDownload={() => setShowAppDownload(true)}
        isAdmin={user?.is_admin}
      />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <h1>欢迎，{user?.username}！</h1>
            <StorageInfo storageInfo={storageInfo} />
          </div>
          <div className="header-right">
            <button className="btn btn-secondary" onClick={() => setShowProfile(true)}>
              个人中心
            </button>
            <button className="btn btn-primary" onClick={onLogout}>
              退出登录
            </button>
          </div>
        </header>
        <div className="dashboard-content">
          {renderContent()}
        </div>
      </main>

      {showProfile && (
        <ProfileMenu
          onClose={() => setShowProfile(false)}
          onChangePassword={() => {
            setShowProfile(false);
            setShowChangePwd(true);
          }}
          onResetPassword={() => {
            setShowProfile(false);
            setShowResetPwd(true);
          }}
          onDeleteAccount={() => {
            setShowProfile(false);
            setShowDelete(true);
          }}
        />
      )}
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
      {showResetPwd && <ResetPasswordModal onClose={() => setShowResetPwd(false)} />}
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} onLogout={onLogout} />}
      {showAppDownload && <AppDownloadModal onClose={() => setShowAppDownload(false)} />}
    </div>
  );
};

export default Dashboard; 