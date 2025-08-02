import React from 'react';

const SponsorModal = ({ show, onClose }) => {
  if (!show) return null;
  return (
    <div className="sponsor-modal-bg">
      <div className="sponsor-modal">
        <div className="sponsor-modal-header">
          <h2>支持与赞助</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="sponsor-modal-body">
          <p>感谢您的支持！可通过以下方式赞助：</p>
          <div className="sponsor-qrcodes">
            {/* 你可以替换下方图片为你的收款码 */}
            <div>
              <img src="/wechat_qr.png" alt="微信收款码" style={{ width: 150, height: 150 }} />
              <div style={{ textAlign: 'center', marginTop: 8 }}>微信</div>
            </div>
            <div>
              <img src="/alipay_qr.png" alt="支付宝收款码" style={{ width: 150, height: 150 }} />
              <div style={{ textAlign: 'center', marginTop: 8 }}>支付宝</div>
            </div>
          </div>
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div>银行卡：6222 0000 0000 0000</div>
            <div>收款人：张子路</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SponsorModal; 