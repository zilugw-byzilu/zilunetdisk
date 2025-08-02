import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const FileUpload = ({ onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback(async (acceptedFiles) => {
    setError('');
    setUploading(true);

    for (const file of acceptedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post('/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        onUpload(response.data.file);
      } catch (error) {
        setError(error.response?.data?.error || '文件上传失败');
        break;
      }
    }

    setUploading(false);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: uploading
  });

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dragover' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p>上传中...</p>
        ) : isDragActive ? (
          <p>将文件拖放到这里...</p>
        ) : (
          <div>
            <p>拖拽文件到这里，或点击选择文件</p>
            {/* <p style={{ fontSize: '12px', color: '#666' }}>
              支持任意文件类型，单个文件最大100MB
            </p> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload; 