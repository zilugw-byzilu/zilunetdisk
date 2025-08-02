import React from 'react';
import axios from 'axios';

const AppDownloadModal = ({ show, onClose }) => {
  const handleDownload = async () => {
    try {
      const response = await axios.get('/api/download-app', {
        responseType: 'blob'
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'zilu网盘客户端.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      onClose();
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请稍后重试');
    }
  };

  if (!show) return null;
  return (
    <div className="sponsor-modal-bg">
      <div className="sponsor-modal">
        <div className="sponsor-modal-header">
          <h2>客户端下载</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sponsor-modal-body">
          <p>点击下方按钮下载客户端：</p>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button 
              onClick={handleDownload}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#5a6fd8'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#667eea'}
            >
              📥 下载客户端 (app.zip)
            </button>
          </div>
          <div style={{ marginTop: 20, textAlign: 'center', color: '#888', fontSize: 14 }}>
            <div>包含Windows和Android客户端</div>
            <div>如无法下载，请联系作者获取最新安装包</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppDownloadModal; 