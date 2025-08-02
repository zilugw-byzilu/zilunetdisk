import React, { useState } from 'react';
import axios from 'axios';

const FileList = ({ files, onDelete, formatBytes }) => {
  const [shareCode, setShareCode] = useState({});
  const [loading, setLoading] = useState({});
  const [showShareModal, setShowShareModal] = useState({});
  const [sharePassword, setSharePassword] = useState({});
  const [showPreviewModal, setShowPreviewModal] = useState({});
  const [previewUrl, setPreviewUrl] = useState({});

  const handleDownload = async (fileId) => {
    try {
      const response = await axios.get(`/api/files/${fileId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.headers['content-disposition']?.split('filename=')[1] || 'file');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('下载失败');
    }
  };

  const handleShare = async (fileId) => {
    const password = sharePassword[fileId] || '';
    setLoading(prev => ({ ...prev, [fileId]: true }));
    try {
      const response = await axios.post(`/api/files/${fileId}/share`, {
        password: password
      });
      setShareCode(prev => ({ ...prev, [fileId]: response.data.share_code }));
      setShowShareModal(prev => ({ ...prev, [fileId]: false }));
      setSharePassword(prev => ({ ...prev, [fileId]: '' }));
    } catch (error) {
      alert('生成分享码失败');
    } finally {
      setLoading(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const openShareModal = (fileId) => {
    setShowShareModal(prev => ({ ...prev, [fileId]: true }));
  };

  const handlePreview = async (fileId) => {
    try {
      const response = await axios.get(`/api/files/${fileId}/preview`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(response.data);
      setPreviewUrl(prev => ({ ...prev, [fileId]: url }));
      setShowPreviewModal(prev => ({ ...prev, [fileId]: true }));
    } catch (error) {
      alert('预览失败');
    }
  };

  const closePreview = (fileId) => {
    if (previewUrl[fileId]) {
      window.URL.revokeObjectURL(previewUrl[fileId]);
    }
    setShowPreviewModal(prev => ({ ...prev, [fileId]: false }));
    setPreviewUrl(prev => ({ ...prev, [fileId]: null }));
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
    const textExts = ['txt', 'md', 'js', 'py', 'html', 'css', 'json', 'xml', 'csv'];
    
    if (videoExts.includes(ext)) return 'video';
    if (textExts.includes(ext)) return 'text';
    return 'other';
  };

  const handleDelete = async (fileId, fileSize) => {
    if (!window.confirm('确定要删除这个文件吗？')) {
      return;
    }

    try {
      await axios.delete(`/api/files/${fileId}`);
      onDelete(fileId, fileSize);
    } catch (error) {
      alert('删除失败');
    }
  };

  const copyShareLink = (shareCode) => {
    const shareUrl = `${window.location.origin}/share/${shareCode}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('分享链接已复制到剪贴板');
    });
  };

  if (files.length === 0) {
    return <p>暂无文件</p>;
  }

  return (
    <div>
      {files.map(file => (
        <div key={file.id} className="file-item">
          <div className="file-info">
            <h4>{file.filename}</h4>
            <p>大小: {formatBytes(file.original_size || file.file_size)}</p>
            <p>上传时间: {new Date(file.created_at).toLocaleString()}</p>
            {shareCode[file.id] && (
              <div style={{ marginTop: '10px' }}>
                <p>分享码: <strong>{shareCode[file.id]}</strong></p>
                <button 
                  className="btn btn-success" 
                  style={{ fontSize: '12px', padding: '5px 10px' }}
                  onClick={() => copyShareLink(shareCode[file.id])}
                >
                  复制分享链接
                </button>
              </div>
            )}
          </div>
          <div className="file-actions">
            {getFileType(file.filename) === 'video' && (
              <button 
                className="btn btn-info" 
                onClick={() => handlePreview(file.id)}
              >
                预览
              </button>
            )}
            {getFileType(file.filename) === 'text' && (
              <button 
                className="btn btn-info" 
                onClick={() => handlePreview(file.id)}
              >
                预览
              </button>
            )}
            <button 
              className="btn btn-primary" 
              onClick={() => handleDownload(file.id)}
            >
              下载
            </button>
            <button 
              className="btn btn-success" 
              onClick={() => openShareModal(file.id)}
              disabled={loading[file.id]}
            >
              分享
            </button>
            <button 
              className="btn btn-danger" 
              onClick={() => handleDelete(file.id, file.file_size)}
            >
              删除
            </button>
          </div>
          
          {/* 分享密码模态框 */}
          {showShareModal[file.id] && (
            <div className="share-modal">
              <div className="share-modal-content">
                <h3>设置分享</h3>
                <div className="form-group">
                  <label>分享密码（可选）:</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="留空表示无密码"
                    value={sharePassword[file.id] || ''}
                    onChange={(e) => setSharePassword(prev => ({ ...prev, [file.id]: e.target.value }))}
                  />
                </div>
                <div className="share-modal-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleShare(file.id)}
                    disabled={loading[file.id]}
                  >
                    {loading[file.id] ? '生成中...' : '生成分享码'}
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setShowShareModal(prev => ({ ...prev, [file.id]: false }))}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 文件预览模态框 */}
          {showPreviewModal[file.id] && (
            <div className="preview-modal">
              <div className="preview-modal-content">
                <div className="preview-header">
                  <h3>预览: {file.filename}</h3>
                  <button 
                    className="close-btn"
                    onClick={() => closePreview(file.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="preview-body">
                  {getFileType(file.filename) === 'video' && (
                    <video 
                      controls 
                      style={{ width: '100%', maxHeight: '70vh' }}
                      src={previewUrl[file.id]}
                    >
                      您的浏览器不支持视频播放
                    </video>
                  )}
                  {getFileType(file.filename) === 'text' && (
                    <iframe
                      src={previewUrl[file.id]}
                      style={{ width: '100%', height: '70vh', border: 'none' }}
                      title="文本预览"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FileList; 