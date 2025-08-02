import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const ShareAccess = () => {
  const { shareCode } = useParams();
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
      const fetchFileInfo = async () => {
    try {
      const response = await axios.get(`/api/share/${shareCode}`);
      setFileInfo(response.data);
      if (response.data.has_password) {
        setShowPasswordForm(true);
      }
    } catch (error) {
      setError('分享码无效或文件不存在');
    } finally {
      setLoading(false);
    }
  };

    fetchFileInfo();
  }, [shareCode]);

  const handleDownload = async () => {
    try {
      const response = await axios.post(`/api/share/${shareCode}/download`, {
        password: password
      }, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileInfo.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error.response?.status === 401) {
        alert('密码错误或需要密码');
      } else {
        alert('下载失败');
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      alert('请输入密码');
      return;
    }
    
    try {
      const response = await axios.post(`/api/share/${shareCode}/download`, {
        password: password
      }, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileInfo.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error.response?.status === 401) {
        alert('密码错误');
      } else {
        alert('下载失败');
      }
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
    const textExts = ['txt', 'md', 'js', 'py', 'html', 'css', 'json', 'xml', 'csv'];
    
    if (videoExts.includes(ext)) return 'video';
    if (textExts.includes(ext)) return 'text';
    return 'other';
  };

  const handlePreview = async () => {
    try {
      const response = await axios.post(`/api/share/${shareCode}/preview`, {
        password: password
      }, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(response.data);
      setPreviewUrl(url);
      setShowPreviewModal(true);
    } catch (error) {
      if (error.response?.status === 401) {
        alert('密码错误或需要密码');
      } else {
        alert('预览失败');
      }
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setShowPreviewModal(false);
    setPreviewUrl(null);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card text-center">
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card text-center">
          <h2>访问失败</h2>
          <p className="error-message">{error}</p>
          <Link to="/" className="btn btn-primary">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card text-center">
        <h2>分享文件</h2>
        <div style={{ margin: '20px 0' }}>
          <h3>{fileInfo.filename}</h3>
          <p>文件大小: {formatBytes(fileInfo.file_size)}</p>
          <p>分享时间: {new Date(fileInfo.created_at).toLocaleString()}</p>
          {fileInfo.username && <p>分享用户: {fileInfo.username}</p>}
        </div>
        
        {showPasswordForm ? (
          <div style={{ margin: '20px 0' }}>
            <div className="form-group">
              <label>请输入分享密码:</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                style={{ maxWidth: '300px', margin: '10px auto' }}
              />
            </div>
            <div style={{ margin: '10px 0' }}>
              <button onClick={handlePasswordSubmit} className="btn btn-primary">
                验证密码并下载
              </button>
              {(getFileType(fileInfo.filename) === 'video' || getFileType(fileInfo.filename) === 'text') && (
                <button onClick={handlePreview} className="btn btn-info" style={{ marginLeft: '10px' }}>
                  预览
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ margin: '20px 0' }}>
            <button onClick={handleDownload} className="btn btn-primary">
              下载文件
            </button>
            {(getFileType(fileInfo.filename) === 'video' || getFileType(fileInfo.filename) === 'text') && (
              <button onClick={handlePreview} className="btn btn-info" style={{ marginLeft: '10px' }}>
                预览
              </button>
            )}
          </div>
        )}
        
        <Link to="/" className="btn btn-success">
          返回首页
        </Link>

        {/* 文件预览模态框 */}
        {showPreviewModal && (
          <div className="preview-modal">
            <div className="preview-modal-content">
              <div className="preview-header">
                <h3>预览: {fileInfo.filename}</h3>
                <button 
                  className="close-btn"
                  onClick={closePreview}
                >
                  ×
                </button>
              </div>
              <div className="preview-body">
                {getFileType(fileInfo.filename) === 'video' && (
                  <video 
                    controls 
                    style={{ width: '100%', maxHeight: '70vh' }}
                    src={previewUrl}
                  >
                    您的浏览器不支持视频播放
                  </video>
                )}
                {getFileType(fileInfo.filename) === 'text' && (
                  <iframe
                    src={previewUrl}
                    style={{ width: '100%', height: '70vh', border: 'none' }}
                    title="文本预览"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareAccess; 