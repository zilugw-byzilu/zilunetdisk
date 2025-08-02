import React from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ selected, onSelect, onAppDownload, isAdmin }) => {
  const navigate = useNavigate();
  
  const menuItems = [
    { id: 'upload', label: '上传文件', icon: '📤' },
    { id: 'download', label: '下载管理', icon: '📥' },
    { id: 'files', label: '文件列表', icon: '📁' }
  ];

  const handleSponsor = () => {
    window.location.href = '/zanzhu.html';
  };

  return (
    <div>
      <aside className="sidebar">
        <div className="sidebar-title">zilu的网盘</div>
        <ul className="sidebar-list">
          {menuItems.map(item => (
            <li
              key={item.id}
              className={`sidebar-item ${selected === item.id ? 'active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
            </li>
          ))}
          {isAdmin && (
            <li
              className={`sidebar-item ${selected === 'admin' ? 'active' : ''}`}
              onClick={() => onSelect('admin')}
            >
              <span className="sidebar-icon">⚙️</span>
              管理面板
            </li>
          )}
        </ul>
        <div className="sidebar-sponsor">
          <button className="btn btn-secondary" onClick={handleSponsor}>
            💝 赞助作者
          </button>
          <button className="btn btn-secondary" onClick={onAppDownload}>
            📱 客户端下载
          </button>
        </div>
      </aside>
    </div>
  );
};

export default Sidebar; 