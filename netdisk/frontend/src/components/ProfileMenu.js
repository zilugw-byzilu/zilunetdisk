import React, { useState } from 'react';

const ProfileMenu = ({ show, onClose, onChangePwd, onResetPwd, onDelete }) => {
  if (!show) return null;
  return (
    <div className="profile-menu-bg">
      <div className="profile-menu-modal">
        <div className="profile-menu-header">
          <h2>个人中心</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="profile-menu-body">
          <button className="btn btn-primary mb-3" onClick={onChangePwd} style={{ width: '100%' }}>修改密码</button>
          <button className="btn btn-info mb-3" onClick={onResetPwd} style={{ width: '100%' }}>找回密码</button>
          <button className="btn btn-danger" onClick={onDelete} style={{ width: '100%' }}>注销账户</button>
        </div>
      </div>
    </div>
  );
};

export default ProfileMenu; 