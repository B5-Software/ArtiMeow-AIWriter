/**
 * ArtiMeow Web服务器
 * 提供远程访问功能，与本地应用共用前端界面
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const os = require('os');

class ArtiMeowWebServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.isRunning = false;
        this.port = 3000;
        this.password = '';
        this.secretKey = this.generateSecretKey();
        this.connectedClients = new Map();
        this.dataAccessor = null; // 数据访问接口
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    /**
     * 生成密钥
     */
    generateSecretKey() {
        return require('crypto').randomBytes(64).toString('hex');
    }

    /**
     * 设置数据访问接口
     */
    setDataAccessor(accessor) {
        this.dataAccessor = accessor;
    }

    /**
     * 设置中间件
     */
    setupMiddleware() {
        // CORS配置
        this.app.use(cors());
        
        // JSON解析
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // 静态文件服务 - 直接使用renderer目录
        this.app.use('/assets', express.static(path.join(__dirname, '../renderer/assets')));
        this.app.use('/css', express.static(path.join(__dirname, '../renderer/css')));
        this.app.use('/js', express.static(path.join(__dirname, '../renderer/js')));
        this.app.use('/fonts', express.static(path.join(__dirname, '../renderer/assets/fonts')));
        
        // 身份验证中间件
        this.app.use('/api', this.authenticateToken.bind(this));
    }

    /**
     * JWT身份验证中间件
     */
    authenticateToken(req, res, next) {
        // 登录端点不需要验证
        if (req.path === '/login' || req.path === '/status') {
            return next();
        }

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: '未提供访问令牌' });
        }

        jwt.verify(token, this.secretKey, (err, user) => {
            if (err) {
                return res.status(403).json({ error: '访问令牌无效' });
            }
            req.user = user;
            next();
        });
    }

    /**
     * 设置路由
     */
    setupRoutes() {
        // 主页面 - 使用与本地相同的HTML界面
        this.app.get('/', (req, res) => {
            res.send(this.generateWebInterface());
        });

        // 状态检查
        this.app.get('/api/status', (req, res) => {
            res.json({ 
                status: 'running',
                version: require('../../package.json').version,
                connectedClients: this.connectedClients.size
            });
        });

        // 登录
        this.app.post('/api/login', async (req, res) => {
            try {
                const { password } = req.body;
                
                if (!password) {
                    return res.status(400).json({ error: '请输入密码' });
                }

                const isValid = await bcrypt.compare(password, this.password);
                if (!isValid) {
                    return res.status(401).json({ error: '密码错误' });
                }

                const token = jwt.sign(
                    { user: 'remote_user', timestamp: Date.now() },
                    this.secretKey,
                    { expiresIn: '24h' }
                );

                res.json({ success: true, token, message: '登录成功' });
            } catch (error) {
                console.error('Login error:', error);
                res.status(500).json({ error: '登录失败' });
            }
        });

        // 项目管理API
        this.app.get('/api/projects', async (req, res) => {
            try {
                if (!this.dataAccessor) {
                    return res.status(500).json({ error: '数据访问接口未初始化' });
                }
                const projects = await this.dataAccessor.getProjects();
                res.json(projects);
            } catch (error) {
                console.error('Get projects error:', error);
                res.status(500).json({ error: '获取项目列表失败' });
            }
        });

        // 获取项目详情
        this.app.get('/api/projects/:projectId', async (req, res) => {
            try {
                const project = await this.dataAccessor.getProject(req.params.projectId);
                res.json(project);
            } catch (error) {
                console.error('Get project error:', error);
                res.status(500).json({ error: '获取项目详情失败' });
            }
        });

        // 获取章节内容
        this.app.get('/api/projects/:projectId/chapters/:chapterId', async (req, res) => {
            try {
                const content = await this.dataAccessor.getChapterContent(req.params.projectId, req.params.chapterId);
                res.json(content);
            } catch (error) {
                console.error('Get chapter error:', error);
                res.status(500).json({ error: '获取章节内容失败' });
            }
        });

        // 保存章节内容
        this.app.put('/api/projects/:projectId/chapters/:chapterId', async (req, res) => {
            try {
                const { content } = req.body;
                await this.dataAccessor.saveChapterContent(req.params.projectId, req.params.chapterId, content);
                res.json({ success: true, message: '保存成功' });
            } catch (error) {
                console.error('Save chapter error:', error);
                res.status(500).json({ error: '保存章节失败' });
            }
        });

        // 设置管理
        this.app.get('/api/settings', async (req, res) => {
            try {
                const settings = await this.dataAccessor.getSettings();
                res.json(settings);
            } catch (error) {
                console.error('Get settings error:', error);
                res.status(500).json({ error: '获取设置失败' });
            }
        });

        this.app.post('/api/settings', async (req, res) => {
            try {
                await this.dataAccessor.saveSettings(req.body);
                res.json({ success: true, message: '设置保存成功' });
            } catch (error) {
                console.error('Save settings error:', error);
                res.status(500).json({ error: '保存设置失败' });
            }
        });
    }

    /**
     * 设置Socket处理器
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('客户端连接:', socket.id);
            this.connectedClients.set(socket.id, {
                socket: socket,
                connectedAt: new Date()
            });

            socket.on('authenticate', (token) => {
                jwt.verify(token, this.secretKey, (err, user) => {
                    if (err) {
                        socket.emit('auth_error', '身份验证失败');
                        socket.disconnect();
                    } else {
                        socket.authenticated = true;
                        socket.emit('authenticated', '身份验证成功');
                    }
                });
            });

            socket.on('disconnect', () => {
                console.log('客户端断开连接:', socket.id);
                this.connectedClients.delete(socket.id);
            });
        });
    }

    /**
     * 生成Web界面HTML - 与本地应用完全相同的界面
     */
    generateWebInterface() {
        try {
            // 读取本地的index.html文件
            const indexPath = path.join(__dirname, '../renderer/index.html');
            let htmlContent = fs.readFileSync(indexPath, 'utf8');
            
            // 修改标题
            htmlContent = htmlContent.replace(
                /<title>.*?<\/title>/,
                '<title>ArtiMeow - 远程访问</title>'
            );
            
            // 添加Web模式专用样式
            const webStyles = `
    <style>
        /* Web模式专用样式覆盖 */
        .titlebar { display: none !important; }
        .app { padding-top: 0 !important; }
        body { 
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        
        /* 登录界面样式 */
        .web-login-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--bg-primary);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .web-login {
            max-width: 400px;
            width: 90%;
            background: var(--sidebar-bg);
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            text-align: center;
        }
        .web-login h2 {
            color: var(--text-primary);
            margin-bottom: 20px;
            font-size: 1.5rem;
        }
        .web-login .form-group {
            margin-bottom: 20px;
            text-align: left;
        }
        .web-login label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-primary);
            font-weight: 500;
        }
        .web-login input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 1rem;
            box-sizing: border-box;
        }
        .web-login input:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
        }
        .web-login .btn {
            width: 100%;
            padding: 12px;
            background: var(--accent-color);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.3s;
        }
        .web-login .btn:hover {
            background: var(--accent-hover);
        }
        .web-login .btn:disabled {
            background: var(--text-muted);
            cursor: not-allowed;
        }
        .web-login .error {
            color: #ff6b6b;
            font-size: 0.9rem;
            margin-top: 10px;
            padding: 10px;
            background: rgba(255, 107, 107, 0.1);
            border-radius: 4px;
            text-align: center;
        }
        
        /* Web模式指示器 */
        .web-mode-indicator {
            position: fixed;
            top: 10px;
            right: 10px;
            background: var(--accent-color);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.8rem;
            z-index: 1000;
        }
        
        /* 隐藏不适用于Web模式的功能 */
        #minimize-btn, #maximize-btn, #close-btn { display: none !important; }
        
        /* 确保响应式设计 */
        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                max-width: 300px;
            }
            .editor-container {
                margin-left: 0;
            }
            .main-content {
                flex-direction: column;
            }
        }
    </style>
    `;
            
            // 在head标签结束前插入Web模式样式
            htmlContent = htmlContent.replace(
                '</head>',
                webStyles + '</head>'
            );
            
            // 在body开始后添加登录界面和Web模式指示器
            const webElements = `
    
    <!-- Web登录界面 -->
    <div id="web-login-overlay" class="web-login-overlay">
        <div class="web-login">
            <h2><i class="fas fa-lock"></i> 身份验证</h2>
            <form id="web-login-form">
                <div class="form-group">
                    <label for="web-password">访问密码:</label>
                    <input type="password" id="web-password" name="password" required>
                </div>
                <button type="submit" class="btn">登录</button>
                <div id="web-login-error" class="error" style="display: none;"></div>
            </form>
        </div>
    </div>
    `;
            
            htmlContent = htmlContent.replace(
                '<body>',
                '<body>' + webElements
            );
            
            // 在body结束前添加Web模式专用脚本
            const webScript = `
    <script>
        // Web模式全局标识
        window.isWebMode = true;
        
        // Web模式登录处理
        document.addEventListener('DOMContentLoaded', function() {
            const loginForm = document.getElementById('web-login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const password = document.getElementById('web-password').value;
                    const errorDiv = document.getElementById('web-login-error');
                    
                    try {
                        const response = await fetch('/api/login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ password })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            // 保存token
                            localStorage.setItem('artimeow_token', result.token);
                            // 隐藏登录界面
                            document.getElementById('web-login-overlay').style.display = 'none';
                            // 初始化应用
                            if (window.appManager) {
                                window.appManager.init();
                            }
                        } else {
                            errorDiv.textContent = result.error || '登录失败';
                            errorDiv.style.display = 'block';
                        }
                    } catch (error) {
                        errorDiv.textContent = '连接失败，请检查网络';
                        errorDiv.style.display = 'block';
                    }
                });
            }
            
            // 检查是否已经登录
            const token = localStorage.getItem('artimeow_token');
            if (token) {
                // 验证token是否有效
                fetch('/api/status', {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                }).then(response => {
                    if (response.ok) {
                        document.getElementById('web-login-overlay').style.display = 'none';
                    } else {
                        localStorage.removeItem('artimeow_token');
                    }
                }).catch(() => {
                    localStorage.removeItem('artimeow_token');
                });
            }
        });
        
        // 修改所有的fetch请求以包含token
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            const token = localStorage.getItem('artimeow_token');
            if (token && url.startsWith('/api/') && url !== '/api/login') {
                options.headers = options.headers || {};
                options.headers['Authorization'] = 'Bearer ' + token;
            }
            return originalFetch(url, options);
        };
        
        // Web模式下的electronAPI模拟
        if (!window.electronAPI) {
            window.electronAPI = {
                // 模拟electronAPI调用，转发到Web API
                getSettings: () => fetch('/api/settings').then(r => r.json()),
                updateSettings: (settings) => fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings)
                }).then(r => r.json()),
                getProjects: () => fetch('/api/projects').then(r => r.json()),
                createProject: (project) => fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(project)
                }).then(r => r.json()),
                getProject: (id) => fetch(\`/api/projects/\${id}\`).then(r => r.json()),
                updateProject: (id, project) => fetch(\`/api/projects/\${id}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(project)
                }).then(r => r.json()),
                deleteProject: (id) => fetch(\`/api/projects/\${id}\`, {
                    method: 'DELETE'
                }).then(r => r.json()),
                getChapter: (projectId, chapterId) => fetch(\`/api/projects/\${projectId}/chapters/\${chapterId}\`).then(r => r.json()),
                updateChapter: (projectId, chapterId, chapter) => fetch(\`/api/projects/\${projectId}/chapters/\${chapterId}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chapter)
                }).then(r => r.json()),
                createChapter: (projectId, chapter) => fetch(\`/api/projects/\${projectId}/chapters\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chapter)
                }).then(r => r.json()),
                deleteChapter: (projectId, chapterId) => fetch(\`/api/projects/\${projectId}/chapters/\${chapterId}\`, {
                    method: 'DELETE'
                }).then(r => r.json())
            };
        }
    </script>
    `;
            
            htmlContent = htmlContent.replace(
                '</body>',
                webScript + '</body>'
            );
            
            return htmlContent;
            
        } catch (error) {
            console.error('生成Web界面失败:', error);
            // 返回简单的错误页面
            return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ArtiMeow - 错误</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #1a1a1a;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        .error-container {
            text-align: center;
            background: #2a2a2a;
            padding: 30px;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>服务器错误</h1>
        <p>无法生成Web界面，请检查服务器配置</p>
        <p>错误信息: ${error.message}</p>
    </div>
</body>
</html>`;
        }
    }

    /**
     * 启动服务器
     */
    async start(port = 3000, password = '') {
        try {
            this.port = port;
            
            // 如果提供了密码，进行加密存储
            if (password) {
                this.password = await bcrypt.hash(password, 10);
            }
            
            await new Promise((resolve, reject) => {
                this.server.listen(port, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.isRunning = true;
                        console.log(`ArtiMeow Web服务器已启动，端口: ${port}`);
                        resolve();
                    }
                });
            });
            
            return {
                success: true,
                port: this.port,
                ips: this.getLocalIPs()
            };
        } catch (error) {
            console.error('启动Web服务器失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 停止服务器
     */
    async stop() {
        try {
            if (this.server && this.isRunning) {
                await new Promise((resolve) => {
                    this.server.close(() => {
                        this.isRunning = false;
                        console.log('Web服务器已停止');
                        resolve();
                    });
                });
            }
            return { success: true };
        } catch (error) {
            console.error('停止Web服务器失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取服务器状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            connectedClients: this.connectedClients.size,
            ips: this.getLocalIPs()
        };
    }

    /**
     * 获取本地IP地址
     */
    getLocalIPs() {
        const interfaces = os.networkInterfaces();
        const ips = { ipv4: [], ipv6: [] };

        Object.keys(interfaces).forEach(name => {
            interfaces[name].forEach(iface => {
                if (!iface.internal) {
                    if (iface.family === 'IPv4') {
                        ips.ipv4.push(iface.address);
                    } else if (iface.family === 'IPv6') {
                        ips.ipv6.push(iface.address);
                    }
                }
            });
        });

        return ips;
    }

    /**
     * 设置服务器配置
     */
    async setConfig(config) {
        this.port = config.port || 3000;
        
        if (config.password) {
            this.password = await bcrypt.hash(config.password, 10);
        }
    }
}

module.exports = ArtiMeowWebServer;
