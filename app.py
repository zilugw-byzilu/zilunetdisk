import os
import uuid
import jwt
import bcrypt
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_file, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from functools import wraps
from flask_cors import CORS
from werkzeug.utils import secure_filename
import json
import smtplib
from email.mime.text import MIMEText
from email.header import Header
import random
import subprocess
import time
import threading
import asyncio
import requests
import tempfile
import hashlib
import re
from urllib.parse import urlparse, parse_qs

# 添加torrent-parser支持
try:
    import torrent_parser
    TORRENT_PARSER_AVAILABLE = True
except ImportError:
    TORRENT_PARSER_AVAILABLE = False
    print("警告: torrent-parser未安装，种子下载功能将不可用")

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///cloud_drive.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'
# app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size (已移除单文件限制)

# 确保上传目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
CORS(app)

# 下载管理器
class DownloadManager:
    def __init__(self):
        self.downloads = {}
        self.lock = threading.Lock()
    
    def add_download(self, download_id, download_type, filename, user_id):
        with self.lock:
            self.downloads[download_id] = {
                'id': download_id,
                'type': download_type,
                'filename': filename,
                'user_id': user_id,
                'progress': 0,
                'status': 'starting',
                'start_time': datetime.now(),
                'file_path': None,
                'error': None
            }
    
    def update_progress(self, download_id, progress, status=None, file_path=None, error=None):
        with self.lock:
            if download_id in self.downloads:
                self.downloads[download_id]['progress'] = progress
                if status:
                    self.downloads[download_id]['status'] = status
                if file_path:
                    self.downloads[download_id]['file_path'] = file_path
                if error:
                    self.downloads[download_id]['error'] = error
    
    def get_download(self, download_id):
        with self.lock:
            return self.downloads.get(download_id)
    
    def get_user_downloads(self, user_id):
        with self.lock:
            return [d for d in self.downloads.values() if d['user_id'] == user_id]
    
    def remove_download(self, download_id):
        with self.lock:
            if download_id in self.downloads:
                del self.downloads[download_id]

download_manager = DownloadManager()

# 数据模型
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    storage_used = db.Column(db.BigInteger, default=0)  # 已使用存储空间（字节）
    storage_limit = db.Column(db.BigInteger, default=10 * 1024 * 1024 * 1024)  # 10GB
    is_admin = db.Column(db.Boolean, default=False)  # 管理员标记
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    compressed_filename = db.Column(db.String(255), nullable=True) # 压缩后的文件名
    compressed_path = db.Column(db.String(500), nullable=True) # 压缩文件的完整路径
    file_size = db.Column(db.BigInteger, nullable=False)
    original_size = db.Column(db.BigInteger, nullable=True)  # 原始大小
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    share_code = db.Column(db.String(6), unique=True)
    share_password = db.Column(db.String(255), nullable=True)  # 分享密码
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Token格式错误'}), 401
        
        if not token:
            return jsonify({'error': 'Token缺失'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'error': '用户不存在'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token已过期'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token无效'}), 401
        
        return f(current_user, *args, **kwargs)
    return decorated

def generate_share_code():
    """生成6位分享码"""
    return ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6))

def get_storage_used(user_id):
    """获取用户已使用的存储空间"""
    try:
        files = File.query.filter_by(user_id=user_id).all()
        total_size = sum(file.file_size for file in files if file.file_size is not None)
        return total_size or 0
    except Exception as e:
        print(f"获取存储使用量失败: {e}")
        return 0

def check_storage_limit(user_id, file_size):
    """检查存储空间限制（10GB = 10 * 1024 * 1024 * 1024 字节）"""
    user = User.query.get(user_id)
    if not user:
        return False
    return user.storage_used + file_size <= user.storage_limit

# 临时存储验证码（生产建议用redis等）
reset_codes = {}
login_codes = {}

# 路由
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if User.query.filter_by(username=username).first():
        return jsonify({'error': '用户名已存在'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': '邮箱已存在'}), 400
    
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    user = User(username=username, email=email, password_hash=password_hash.decode('utf-8'))
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'message': '注册成功'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    if user and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        login_user(user)
        token = jwt.encode(
            {'user_id': user.id, 'exp': datetime.utcnow() + timedelta(days=7)},
            app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        return jsonify({
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'storage_used': get_storage_used(user.id),
                'storage_limit': user.storage_limit
            }
        })
    
    return jsonify({'error': '用户名或密码错误'}), 401

@app.route('/api/upload', methods=['POST'])
@token_required
def upload_file(current_user):
    try:
        if 'file' in request.files:
            # 普通文件上传
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': '没有选择文件'}), 400
            
            filename = secure_filename(file.filename)
            original_size = 0
            
            # 保存临时文件
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f'temp_{filename}')
            file.save(temp_path)
            
            # 获取原始文件大小
            original_size = os.path.getsize(temp_path)
            
            # 检查存储限制
            if not check_storage_limit(current_user.id, original_size):
                os.remove(temp_path)
                return jsonify({'error': '存储空间不足'}), 400
            
            # 压缩文件
            compressed_filename = f"{os.path.splitext(filename)[0]}_{int(time.time())}.7z"
            compressed_path = os.path.join(app.config['UPLOAD_FOLDER'], compressed_filename)
            
            # 使用7z压缩
            result = subprocess.run([
                '7z', 'a', '-t7z', '-mx=9', compressed_path, temp_path
            ], capture_output=True, text=True)
            
            if result.returncode != 0:
                os.remove(temp_path)
                return jsonify({'error': '文件压缩失败'}), 500
            
            # 获取压缩后大小
            compressed_size = os.path.getsize(compressed_path)
            
            # 删除临时文件
            os.remove(temp_path)
            
            # 保存到数据库
            new_file = File(
                filename=filename,
                original_filename=filename,
                file_path=compressed_path,
                compressed_filename=compressed_filename,
                compressed_path=compressed_path,
                file_size=compressed_size,
                original_size=original_size,
                user_id=current_user.id
            )
            db.session.add(new_file)
            
            # 更新用户存储使用量
            current_user.storage_used += compressed_size
            db.session.commit()
            
            return jsonify({
                'message': '文件上传成功',
                'filename': filename,
                'original_size': original_size,
                'compressed_size': compressed_size
            })
            
        elif 'torrent_file' in request.files:
            # 种子文件上传
            torrent_file = request.files['torrent_file']
            if torrent_file.filename == '':
                return jsonify({'error': '没有选择种子文件'}), 400
            
            # 保存种子文件
            torrent_filename = secure_filename(torrent_file.filename)
            torrent_path = os.path.join(app.config['UPLOAD_FOLDER'], f'temp_{torrent_filename}')
            torrent_file.save(torrent_path)
            
            # 创建下载任务
            download_id = str(uuid.uuid4())
            download_manager.add_download(download_id, 'torrent', torrent_filename, current_user.id)
            
            # 启动下载线程
            thread = threading.Thread(
                target=handle_torrent_download,
                args=(download_id, torrent_path, current_user.id)
            )
            thread.daemon = True
            thread.start()
            
            return jsonify({
                'message': '种子文件上传成功，开始下载',
                'download_id': download_id,
                'filename': torrent_filename
            })
            
        elif 'ed2k_link' in request.form:
            # ed2k链接下载
            ed2k_link = request.form['ed2k_link']
            if not ed2k_link.startswith('ed2k://'):
                return jsonify({'error': '无效的ed2k链接'}), 400
            
            # 创建下载任务
            download_id = str(uuid.uuid4())
            download_manager.add_download(download_id, 'ed2k', 'ed2k_download', current_user.id)
            
            # 启动下载线程
            thread = threading.Thread(
                target=handle_ed2k_download,
                args=(download_id, ed2k_link, current_user.id)
            )
            thread.daemon = True
            thread.start()
            
            return jsonify({
                'message': 'ed2k链接已接收，开始下载',
                'download_id': download_id,
                'link': ed2k_link
            })
            
        else:
            return jsonify({'error': '没有文件或链接'}), 400
            
    except Exception as e:
        return jsonify({'error': f'上传失败: {str(e)}'}), 500

@app.route('/api/files', methods=['GET'])
@token_required
def get_files(current_user):
    files = File.query.filter_by(user_id=current_user.id).order_by(File.created_at.desc()).all()
    file_list = []
    for file in files:
        file_list.append({
            'id': file.id,
            'filename': file.original_filename,
            'file_size': file.file_size,
            'share_code': file.share_code,
            'is_public': file.is_public,
            'created_at': file.created_at.isoformat()
        })
    
    return jsonify({
        'files': file_list,
        'storage_used': get_storage_used(current_user.id),
        'storage_limit': current_user.storage_limit
    })

@app.route('/api/files/<int:file_id>/download', methods=['GET'])
@token_required
def download_file(current_user, file_id):
    file = File.query.filter_by(id=file_id, user_id=current_user.id).first()
    if not file:
        return jsonify({'error': '文件不存在'}), 404
    
    return send_file(file.file_path, as_attachment=True, download_name=file.original_filename)

@app.route('/api/files/<int:file_id>/share', methods=['POST'])
@token_required
def share_file(current_user, file_id):
    data = request.get_json() or {}
    password = data.get('password', '')
    
    file = File.query.filter_by(id=file_id, user_id=current_user.id).first()
    if not file:
        return jsonify({'error': '文件不存在'}), 404
    
    if not file.share_code:
        file.share_code = generate_share_code()
    
    # 设置分享密码
    if password:
        file.share_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    else:
        file.share_password = None
    
    db.session.commit()
    
    return jsonify({
        'share_code': file.share_code,
        'has_password': bool(file.share_password)
    })

@app.route('/api/share/<share_code>', methods=['GET'])
def access_shared_file(share_code):
    file = File.query.filter_by(share_code=share_code).first()
    if not file:
        return jsonify({'error': '分享码无效'}), 404
    user = User.query.get(file.user_id)
    return jsonify({
        'filename': file.original_filename,
        'file_size': file.file_size,
        'created_at': file.created_at.isoformat(),
        'has_password': bool(file.share_password),
        'username': user.username if user else ''
    })

@app.route('/api/share/<share_code>/download', methods=['POST'])
def download_shared_file(share_code):
    data = request.get_json() or {}
    password = data.get('password', '')
    
    file = File.query.filter_by(share_code=share_code).first()
    if not file:
        return jsonify({'error': '分享码无效'}), 404
    
    # 检查密码
    if file.share_password:
        if not password:
            return jsonify({'error': '需要密码'}), 401
        
        if not bcrypt.checkpw(password.encode('utf-8'), file.share_password.encode('utf-8')):
            return jsonify({'error': '密码错误'}), 401
    
    return send_file(file.file_path, as_attachment=True, download_name=file.original_filename)

@app.route('/api/files/<int:file_id>/preview', methods=['GET'])
@token_required
def preview_file(current_user, file_id):
    file = File.query.filter_by(id=file_id, user_id=current_user.id).first()
    if not file:
        return jsonify({'error': '文件不存在'}), 404
    
    return send_file(file.file_path)

@app.route('/api/share/<share_code>/preview', methods=['POST'])
def preview_shared_file(share_code):
    data = request.get_json() or {}
    password = data.get('password', '')
    
    file = File.query.filter_by(share_code=share_code).first()
    if not file:
        return jsonify({'error': '分享码无效'}), 404
    
    # 检查密码
    if file.share_password:
        if not password:
            return jsonify({'error': '需要密码'}), 401
        
        if not bcrypt.checkpw(password.encode('utf-8'), file.share_password.encode('utf-8')):
            return jsonify({'error': '密码错误'}), 401
    
    return send_file(file.file_path)

@app.route('/api/files/<int:file_id>', methods=['DELETE'])
@token_required
def delete_file(current_user, file_id):
    file = File.query.filter_by(id=file_id, user_id=current_user.id).first()
    if not file:
        return jsonify({'error': '文件不存在'}), 404
    
    # 删除物理文件
    if os.path.exists(file.file_path):
        os.remove(file.file_path)
    
    db.session.delete(file)
    db.session.commit()
    
    return jsonify({'message': '文件删除成功'})

@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    return jsonify({
        'id': current_user.id,
        'username': current_user.username,
        'email': current_user.email,
        'storage_used': get_storage_used(current_user.id),
        'storage_limit': current_user.storage_limit
    })

@app.route('/api/change_password', methods=['POST'])
@token_required
def change_password(current_user):
    data = request.get_json()
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    if not old_password or not new_password:
        return jsonify({'error': '参数不完整'}), 400
    if not bcrypt.checkpw(old_password.encode('utf-8'), current_user.password_hash.encode('utf-8')):
        return jsonify({'error': '原密码错误'}), 400
    current_user.password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.session.commit()
    return jsonify({'message': '密码修改成功'})

@app.route('/api/request_reset_code', methods=['POST'])
def request_reset_code():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return jsonify({'error': '邮箱不能为空'}), 400
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    code = str(random.randint(100000, 999999))
    reset_codes[email] = code
    # 发送邮件
    try:
        send_email(email, 'zilu的网盘-找回密码验证码', f'您的验证码是：{code}，5分钟内有效。')
    except Exception as e:
        return jsonify({'error': '邮件发送失败', 'detail': str(e)}), 500
    return jsonify({'message': '验证码已发送'})

@app.route('/api/reset_password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email')
    code = data.get('code')
    new_password = data.get('new_password')
    if not email or not code or not new_password:
        return jsonify({'error': '参数不完整'}), 400
    if reset_codes.get(email) != code:
        return jsonify({'error': '验证码错误'}), 400
    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    user.password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    db.session.commit()
    reset_codes.pop(email, None)
    return jsonify({'message': '密码重置成功'})

@app.route('/api/delete_account', methods=['POST'])
@token_required
def delete_account(current_user):
    data = request.get_json()
    password = data.get('password')
    if not password:
        return jsonify({'error': '请输入密码'}), 400
    if not bcrypt.checkpw(password.encode('utf-8'), current_user.password_hash.encode('utf-8')):
        return jsonify({'error': '密码错误'}), 400
    # 删除用户所有文件
    files = File.query.filter_by(user_id=current_user.id).all()
    for file in files:
        if os.path.exists(file.file_path):
            os.remove(file.file_path)
        db.session.delete(file)
    db.session.delete(current_user)
    db.session.commit()
    return jsonify({'message': '账户已注销'})

@app.route('/api/login_request_code', methods=['POST'])
def login_request_code():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': '参数不完整'}), 400
    user = User.query.filter_by(username=username).first()
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({'error': '用户名或密码错误'}), 401
    code = str(random.randint(100000, 999999))
    login_codes[username] = code
    try:
        send_email(user.email, 'zilu的网盘-登录验证码', f'您的登录验证码是：{code}，5分钟内有效。')
    except Exception as e:
        return jsonify({'error': '邮件发送失败', 'detail': str(e)}), 500
    return jsonify({'message': '验证码已发送'})

@app.route('/api/login_verify_code', methods=['POST'])
def login_verify_code():
    data = request.get_json()
    username = data.get('username')
    code = data.get('code')
    if not username or not code:
        return jsonify({'error': '参数不完整'}), 400
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    if login_codes.get(username) != code:
        return jsonify({'error': '验证码错误'}), 401
    # 登录成功，生成token
    token = jwt.encode(
        {'user_id': user.id, 'exp': datetime.utcnow() + timedelta(days=7)},
        app.config['SECRET_KEY'],
        algorithm='HS256'
    )
    login_codes.pop(username, None)
    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'storage_used': get_storage_used(user.id),
            'storage_limit': current_user.storage_limit
        }
    })

@app.route('/api/adminzilu/login', methods=['POST'])
def adminzilu_login():
    data = request.get_json()
    password = data.get('password')
    
    if password != 'zhangziluadmin888':
        return jsonify({'error': '密码错误'}), 401
    
    # 创建或获取管理员用户
    admin_user = User.query.filter_by(username='adminzilu').first()
    if not admin_user:
        # 创建管理员用户
        password_hash = bcrypt.hashpw('zhangziluadmin888'.encode('utf-8'), bcrypt.gensalt())
        admin_user = User(
            username='adminzilu',
            email='admin@zilu.com',
            password_hash=password_hash.decode('utf-8'),
            is_admin=True
        )
        db.session.add(admin_user)
        db.session.commit()
    
    # 生成token
    token = jwt.encode(
        {'user_id': admin_user.id, 'exp': datetime.utcnow() + timedelta(days=7)},
        app.config['SECRET_KEY'],
        algorithm='HS256'
    )
    
    return jsonify({
        'token': token,
        'user': {
            'id': admin_user.id,
            'username': admin_user.username,
            'email': admin_user.email,
            'is_admin': True,
            'storage_used': get_storage_used(admin_user.id),
            'storage_limit': 10 * 1024 * 1024 * 1024
        }
    })

# 管理员API
@app.route('/api/admin/users', methods=['GET'])
@token_required
def admin_get_users(current_user):
    if not current_user.is_admin:
        return jsonify({'error': '无权限'}), 403
    users = User.query.all()
    return jsonify({'users': [
        {
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'is_admin': u.is_admin,
            'storage_used': get_storage_used(u.id),
            'created_at': u.created_at.isoformat()
        } for u in users
    ]})

@app.route('/api/admin/delete_user', methods=['POST'])
@token_required
def admin_delete_user(current_user):
    if not current_user.is_admin:
        return jsonify({'error': '无权限'}), 403
    data = request.get_json()
    user_id = data.get('user_id')
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    if user.is_admin:
        return jsonify({'error': '不能删除管理员'}), 400
    files = File.query.filter_by(user_id=user.id).all()
    for file in files:
        if os.path.exists(file.file_path):
            os.remove(file.file_path)
        db.session.delete(file)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': '用户已删除'})

@app.route('/api/admin/set_user_quota', methods=['POST'])
@token_required
def admin_set_user_quota(current_user):
    if not current_user.is_admin:
        return jsonify({'error': '无权限'}), 403
    data = request.get_json()
    user_id = data.get('user_id')
    quota = data.get('quota')
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': '用户不存在'}), 404
    user.storage_limit = quota
    db.session.commit()
    return jsonify({'message': '空间已设置'})

@app.route('/api/admin/files', methods=['GET'])
@token_required
def admin_get_files(current_user):
    if not current_user.is_admin:
        return jsonify({'error': '无权限'}), 403
    files = File.query.all()
    return jsonify({'files': [
        {
            'id': f.id,
            'filename': f.original_filename,
            'file_size': f.file_size,
            'user_id': f.user_id,
            'share_code': f.share_code,
            'created_at': f.created_at.isoformat()
        } for f in files
    ]})

@app.route('/api/downloads', methods=['GET'])
@token_required
def get_downloads(current_user):
    downloads = download_manager.get_user_downloads(current_user.id)
    return jsonify({'downloads': downloads})

@app.route('/api/downloads/<download_id>', methods=['GET'])
@token_required
def get_download_status(current_user, download_id):
    download = download_manager.get_download(download_id)
    if not download or download['user_id'] != current_user.id:
        return jsonify({'error': '下载任务不存在'}), 404
    
    return jsonify(download)

@app.route('/api/download-app', methods=['GET'])
def download_app():
    """下载客户端应用"""
    app_zip_path = os.path.join(app.config['UPLOAD_FOLDER'], 'app.zip')
    
    if not os.path.exists(app_zip_path):
        return jsonify({'error': '应用文件不存在'}), 404
    
    return send_file(
        app_zip_path,
        as_attachment=True,
        download_name='zilu网盘客户端.zip',
        mimetype='application/zip'
    )

# 种子下载处理函数
def handle_torrent_download(download_id, torrent_file_path, user_id):
    if not TORRENT_PARSER_AVAILABLE:
        download_manager.update_progress(download_id, 0, 'error', error='torrent-parser库未安装，种子下载功能暂时不可用。请安装：pip install torrent-parser')
        return
    
    try:
        # 解析种子文件
        torrent_data = torrent_parser.TorrentParser(torrent_file_path)
        info = torrent_data.data()
        
        download_manager.update_progress(download_id, 10, 'downloading')
        
        # 获取种子信息
        torrent_name = info.get('info', {}).get('name', 'unknown')
        files_info = info.get('info', {}).get('files', [])
        total_size = sum(f.get('length', 0) for f in files_info)
        
        # 检查存储限制
        if not check_storage_limit(user_id, total_size):
            download_manager.update_progress(download_id, 0, 'error', error='存储空间不足')
            return
        
        download_manager.update_progress(download_id, 20, 'downloading')
        
        # 创建下载目录
        download_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'torrent_{download_id}')
        os.makedirs(download_dir, exist_ok=True)
        
        # 模拟下载过程（实际应用中需要实现真实的BT下载）
        downloaded_size = 0
        for i, file_info in enumerate(files_info):
            file_path = file_info.get('path', ['unknown'])[0]
            file_size = file_info.get('length', 0)
            
            # 创建文件路径
            full_path = os.path.join(download_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # 模拟下载文件
            with open(full_path, 'wb') as f:
                chunk_size = 1024 * 1024  # 1MB chunks
                downloaded = 0
                
                while downloaded < file_size:
                    chunk = min(chunk_size, file_size - downloaded)
                    f.write(b'0' * chunk)  # 写入模拟数据
                    downloaded += chunk
                    downloaded_size += chunk
                    
                    progress = int((downloaded_size / total_size) * 70) + 20  # 20-90%
                    download_manager.update_progress(download_id, progress, 'downloading')
                    
                    time.sleep(0.1)  # 模拟网络延迟
        
        download_manager.update_progress(download_id, 90, 'downloading')
        
        # 压缩下载的文件
        compressed_filename = f"{torrent_name}_{int(time.time())}.7z"
        compressed_path = os.path.join(app.config['UPLOAD_FOLDER'], compressed_filename)
        
        result = subprocess.run([
            '7z', 'a', '-t7z', '-mx=9', compressed_path, download_dir
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            compressed_size = os.path.getsize(compressed_path)
            
            # 保存到数据库
            new_file = File(
                filename=torrent_name,
                original_filename=torrent_name,
                file_path=compressed_path,
                compressed_filename=compressed_filename,
                compressed_path=compressed_path,
                file_size=compressed_size,
                original_size=total_size,
                user_id=user_id
            )
            db.session.add(new_file)
            
            # 更新用户存储使用量
            user = User.query.get(user_id)
            if user:
                user.storage_used += compressed_size
            
            db.session.commit()
            
            # 清理下载目录
            import shutil
            shutil.rmtree(download_dir)
            
            download_manager.update_progress(download_id, 100, 'completed', file_path=compressed_path)
        else:
            download_manager.update_progress(download_id, 0, 'error', error='文件压缩失败')
            if os.path.exists(download_dir):
                import shutil
                shutil.rmtree(download_dir)
        
    except Exception as e:
        download_manager.update_progress(download_id, 0, 'error', error=f'种子下载失败: {str(e)}')
    finally:
        # 删除临时种子文件
        if os.path.exists(torrent_file_path):
            os.remove(torrent_file_path)

# ed2k下载处理函数
def handle_ed2k_download(download_id, ed2k_link, user_id):
    try:
        # 解析ed2k链接
        # ed2k://|file|filename|filesize|hash|/
        pattern = r'ed2k://\|file\|([^|]+)\|(\d+)\|([a-fA-F0-9]{32})\|/'
        match = re.match(pattern, ed2k_link)
        
        if not match:
            download_manager.update_progress(download_id, 0, 'error', error='无效的ed2k链接格式')
            return
        
        filename = match.group(1)
        filesize = int(match.group(2))
        filehash = match.group(3)
        
        # 检查存储限制
        if not check_storage_limit(user_id, filesize):
            download_manager.update_progress(download_id, 0, 'error', error='存储空间不足')
            return
        
        download_manager.update_progress(download_id, 0, 'downloading')
        
        # 这里应该实现实际的ed2k下载逻辑
        # 由于ed2k协议比较复杂，这里提供一个简化的实现
        # 实际应用中可能需要使用专门的ed2k客户端库
        
        # 模拟下载过程
        temp_file_path = os.path.join(app.config['UPLOAD_FOLDER'], f'temp_{filename}')
        
        # 创建临时文件（模拟下载）
        with open(temp_file_path, 'wb') as f:
            # 模拟下载进度
            chunk_size = 1024 * 1024  # 1MB chunks
            downloaded = 0
            
            while downloaded < filesize:
                chunk = min(chunk_size, filesize - downloaded)
                f.write(b'0' * chunk)  # 写入模拟数据
                downloaded += chunk
                
                progress = int((downloaded / filesize) * 100)
                download_manager.update_progress(download_id, progress, 'downloading')
                
                time.sleep(0.1)  # 模拟网络延迟
        
        # 压缩文件
        compressed_filename = f"{os.path.splitext(filename)[0]}_{int(time.time())}.7z"
        compressed_path = os.path.join(app.config['UPLOAD_FOLDER'], compressed_filename)
        
        result = subprocess.run([
            '7z', 'a', '-t7z', '-mx=9', compressed_path, temp_file_path
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            compressed_size = os.path.getsize(compressed_path)
            
            # 保存到数据库
            new_file = File(
                filename=filename,
                original_filename=filename,
                file_path=compressed_path,
                compressed_filename=compressed_filename,
                compressed_path=compressed_path,
                file_size=compressed_size,
                original_size=filesize,
                user_id=user_id
            )
            db.session.add(new_file)
            
            # 更新用户存储使用量
            user = User.query.get(user_id)
            if user:
                user.storage_used += compressed_size
            
            db.session.commit()
            
            # 删除临时文件
            os.remove(temp_file_path)
            
            download_manager.update_progress(download_id, 100, 'completed', file_path=compressed_path)
        else:
            download_manager.update_progress(download_id, 0, 'error', error='文件压缩失败')
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
        
    except Exception as e:
        download_manager.update_progress(download_id, 0, 'error', error=str(e))

# 邮件发送函数

def send_email(to_email, subject, content):
    try:
        msg = MIMEMultipart()
        msg['From'] = 'zhangzilu888@outlook.com'
        msg['To'] = to_email
        msg['Subject'] = Header(subject, 'utf-8')
        
        msg.attach(MIMEText(content, 'plain', 'utf-8'))
        
        server = smtplib.SMTP('smtp.office365.com', 587)
        server.starttls()
        server.login('zhangzilu888@outlook.com', 'zhangzilu123')
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"发送邮件失败: {e}")
        return False

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000) 