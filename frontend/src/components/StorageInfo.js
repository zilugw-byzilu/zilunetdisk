import React from 'react';

const StorageInfo = ({ used = 0, limit = 10 * 1024 * 1024 * 1024 }) => {
  // 确保数值有效
  const usedBytes = Number(used) || 0;
  const limitBytes = Number(limit) || (10 * 1024 * 1024 * 1024);
  
  const percentage = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0;
  const usedGB = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const limitGB = (limitBytes / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <div className="card">
      <h3>存储空间</h3>
      <div className="storage-bar">
        <div 
          className="storage-fill" 
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      <div className="d-flex justify-between">
        <span>已使用: {usedGB} GB</span>
        <span>总空间: {limitGB} GB</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      {percentage > 90 && (
        <p style={{ color: '#dc3545', marginTop: '10px' }}>
          存储空间即将用完，请及时清理文件
        </p>
      )}
    </div>
  );
};

export default StorageInfo; 