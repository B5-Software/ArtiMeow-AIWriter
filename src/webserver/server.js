/**
 * ArtiMeow Web服务器
 * 提供远程访问功能，与本地应用共用前端界面
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const os = require('os');
const multer = require('multer');

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
        
        // 配置multer用于文件上传
        this.upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 100 * 1024 * 1024 // 100MB
            }
        });
        
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
        
        // 为Web服务器实例添加必要的数据访问方法
        this.getProjects = accessor.getProjects?.bind(accessor);
        this.getProject = accessor.getProject?.bind(accessor);
        this.getChapterContent = accessor.getChapterContent?.bind(accessor);
        this.saveChapterContent = accessor.saveChapterContent?.bind(accessor);
        this.getSettings = accessor.getSettings?.bind(accessor);
        this.saveSettings = accessor.saveSettings?.bind(accessor);
        this.getRecentProjects = accessor.getRecentProjects?.bind(accessor);
        this.addRecentProject = accessor.addRecentProject?.bind(accessor);
        this.getTutorialFiles = accessor.getTutorialFiles?.bind(accessor);
        this.getSyncData = accessor.getSyncData?.bind(accessor);
        
        // 项目管理方法
        this.createProject = accessor.createProject?.bind(accessor);
        this.loadProject = accessor.loadProject?.bind(accessor);
        this.saveProject = accessor.saveProject?.bind(accessor);
        this.deleteProject = accessor.deleteProject?.bind(accessor);
        this.importProject = accessor.importProject?.bind(accessor);
        
        // AI相关方法
        this.testAIConnection = accessor.testAIConnection?.bind(accessor);
        this.callAI = accessor.callAI?.bind(accessor);
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
        this.app.use('/icon', express.static(path.join(__dirname, '../icon')));
        
        // Node modules 静态文件服务（用于marked等库）
        this.app.use('/node_modules', express.static(path.join(__dirname, '../../node_modules')));
        
        // 身份验证中间件
        this.app.use('/api', this.authenticateToken.bind(this));
    }

    /**
     * JWT身份验证中间件
     */
    authenticateToken(req, res, next) {
        // 不需要验证的端点
        const openEndpoints = ['/login', '/status'];
        if (openEndpoints.includes(req.path)) {
            return next();
        }

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.log('API请求缺少token:', req.path, req.headers);
            return res.status(401).json({ error: '未提供访问令牌' });
        }

        jwt.verify(token, this.secretKey, (err, user) => {
            if (err) {
                console.log('Token验证失败:', err.message, 'Token:', token.substring(0, 20) + '...');
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
        // 提供登录CSS文件
        this.app.get('/login.css', (req, res) => {
            res.sendFile(path.join(__dirname, 'login.css'));
        });
        
        // 主页面 - 使用与本地相同的HTML界面
        this.app.get('/', (req, res) => {
            res.send(this.generateWebInterface());
        });
        
        // Favicon处理
        this.app.get('/favicon.ico', (req, res) => {
            const faviconPath = path.join(__dirname, '../renderer/assets/icons/icon.png');
            res.sendFile(faviconPath);
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

                // 如果服务器没有设置密码，任何密码都可以登录（开发模式）
                let isValid = false;
                if (!this.password || this.password === '') {
                    // 开发模式，任何非空密码都可以登录
                    isValid = true;
                    console.log('开发模式：跳过密码验证，输入密码:', password);
                } else {
                    console.log('生产模式：验证密码');
                    isValid = await bcrypt.compare(password, this.password);
                    console.log('密码验证结果:', isValid, '输入:', password);
                }

                if (!isValid) {
                    console.log('密码验证失败');
                    return res.status(401).json({ error: '密码错误' });
                }

                const token = jwt.sign(
                    { user: 'remote_user', timestamp: Date.now() },
                    this.secretKey,
                    { expiresIn: '24h' }
                );

                console.log('用户登录成功，生成token');
                res.json({ success: true, token, message: '登录成功' });
            } catch (error) {
                console.error('Login error:', error);
                res.status(500).json({ error: '登录失败' });
            }
        });

        // 项目管理API
        this.app.get('/api/projects', async (req, res) => {
            try {
                if (!this.dataAccessor || !this.getProjects) {
                    return res.status(500).json({ success: false, error: '数据访问接口未初始化' });
                }
                const projects = await this.getProjects();
                // 确保返回统一格式
                res.json({ success: true, projects: projects || [] });
            } catch (error) {
                console.error('Get projects error:', error);
                res.status(500).json({ success: false, error: '获取项目列表失败' });
            }
        });

        // 获取项目详情
        this.app.get('/api/projects/:projectId', async (req, res) => {
            try {
                const project = await this.getProject(req.params.projectId);
                res.json(project);
            } catch (error) {
                console.error('Get project error:', error);
                res.status(500).json({ error: '获取项目详情失败' });
            }
        });

        // 获取章节内容
        this.app.get('/api/projects/:projectId/chapters/:chapterId', async (req, res) => {
            try {
                console.log('获取章节请求:', {
                    projectId: req.params.projectId,
                    chapterId: req.params.chapterId,
                    decodedProjectId: decodeURIComponent(req.params.projectId)
                });
                
                if (!this.getChapterContent) {
                    console.error('getChapterContent方法未绑定');
                    return res.status(500).json({ error: 'getChapterContent方法未绑定' });
                }
                
                const content = await this.getChapterContent(req.params.projectId, req.params.chapterId);
                console.log('章节内容获取成功:', { chapterId: req.params.chapterId, hasContent: !!content });
                res.json(content);
            } catch (error) {
                console.error('Get chapter error:', error);
                res.status(500).json({ error: '获取章节内容失败', details: error.message });
            }
        });

        // 保存章节内容
        this.app.put('/api/projects/:projectId/chapters/:chapterId', async (req, res) => {
            try {
                const { content } = req.body;
                await this.saveChapterContent(req.params.projectId, req.params.chapterId, content);
                res.json({ success: true, message: '保存成功' });
            } catch (error) {
                console.error('Save chapter error:', error);
                res.status(500).json({ error: '保存章节失败' });
            }
        });

        // 设置管理
        this.app.get('/api/settings', async (req, res) => {
            try {
                const settings = await this.getSettings();
                res.json(settings);
            } catch (error) {
                console.error('Get settings error:', error);
                res.status(500).json({ error: '获取设置失败' });
            }
        });

        this.app.post('/api/settings', async (req, res) => {
            try {
                await this.saveSettings(req.body);
                res.json({ success: true, message: '设置保存成功' });
            } catch (error) {
                console.error('Save settings error:', error);
                res.status(500).json({ error: '保存设置失败' });
            }
        });
        
        // 最近项目
        this.app.get('/api/recent-projects', async (req, res) => {
            try {
                const projects = await this.getRecentProjects();
                res.json(projects);
            } catch (error) {
                console.error('Get recent projects error:', error);
                res.status(500).json({ error: '获取最近项目失败' });
            }
        });

        // 添加最近项目
        this.app.post('/api/recent-projects', async (req, res) => {
            try {
                const { projectPath } = req.body;
                await this.addRecentProject(projectPath);
                res.json({ success: true });
            } catch (error) {
                console.error('Add recent project error:', error);
                res.status(500).json({ error: '添加最近项目失败' });
            }
        });

        // 创建项目
        this.app.post('/api/projects', async (req, res) => {
            try {
                const result = await this.createProject(req.body);
                res.json(result);
            } catch (error) {
                console.error('Create project error:', error);
                res.status(500).json({ error: '创建项目失败', details: error.message });
            }
        });

        // 加载项目
        this.app.post('/api/projects/load', async (req, res) => {
            try {
                const { projectPath } = req.body;
                const result = await this.loadProject(projectPath);
                res.json(result);
            } catch (error) {
                console.error('Load project error:', error);
                res.status(500).json({ error: '加载项目失败', details: error.message });
            }
        });

        // 保存项目
        this.app.post('/api/projects/save', async (req, res) => {
            try {
                const result = await this.saveProject(req.body);
                res.json(result);
            } catch (error) {
                console.error('Save project error:', error);
                res.status(500).json({ error: '保存项目失败', details: error.message });
            }
        });

        // 导入项目
        this.app.post('/api/projects/import', this.upload.single('projectZip'), async (req, res) => {
            try {
                if (!req.file) {
                    return res.status(400).json({ error: '未上传文件' });
                }
                
                const originalName = req.body.originalName || req.file.originalname.replace('.zip', '');
                const result = await this.importProject(req.file.buffer, originalName);
                
                if (result.success) {
                    res.json(result);
                } else {
                    res.status(400).json(result);
                }
            } catch (error) {
                console.error('Import project error:', error);
                res.status(500).json({ error: '导入项目失败', details: error.message });
            }
        });

        // 删除项目
        this.app.delete('/api/projects/delete', async (req, res) => {
            try {
                const { projectPath } = req.body;
                const result = await this.deleteProject(projectPath);
                res.json(result);
            } catch (error) {
                console.error('Delete project error:', error);
                res.status(500).json({ error: '删除项目失败', details: error.message });
            }
        });
        
        // 教程文件
        this.app.get('/api/tutorial', async (req, res) => {
            try {
                const tutorials = await this.getTutorialFiles();
                res.json(tutorials);
            } catch (error) {
                console.error('Get tutorial files error:', error);
                res.status(500).json({ error: '获取教程文件失败' });
            }
        });

        // AI相关API
        this.app.post('/api/ai/test', async (req, res) => {
            try {
                const { engine, settings } = req.body;
                
                if (this.testAIConnection) {
                    const result = await this.testAIConnection(engine, settings);
                    res.json(result);
                } else {
                    // 模拟AI连接测试
                    if (!settings || !settings.apiKey) {
                        return res.json({ success: false, error: 'API Key is required' });
                    }
                    
                    res.json({ 
                        success: true, 
                        message: `${engine} 连接测试成功 (模拟)`,
                        engine: engine,
                        model: settings.model || 'default'
                    });
                }
            } catch (error) {
                console.error('AI connection test error:', error);
                res.status(500).json({ success: false, error: 'AI连接测试失败', details: error.message });
            }
        });

        this.app.post('/api/ai/call', async (req, res) => {
            try {
                const options = req.body;
                
                if (this.callAI) {
                    const result = await this.callAI(options);
                    res.json(result);
                } else {
                    // 模拟AI调用
                    if (!options.messages || !options.messages.length) {
                        return res.json({ success: false, error: '消息内容不能为空' });
                    }
                    
                    res.json({ 
                        success: true,
                        content: '这是AI的模拟回复。在生产环境中，这里会调用真实的AI API。',
                        usage: {
                            prompt_tokens: 10,
                            completion_tokens: 20,
                            total_tokens: 30
                        }
                    });
                }
            } catch (error) {
                console.error('AI call error:', error);
                res.status(500).json({ success: false, error: 'AI调用失败', details: error.message });
            }
        });

        // 文件操作API
        this.app.post('/api/files/read', async (req, res) => {
            try {
                const { filePath } = req.body;
                if (!filePath) {
                    return res.status(400).json({ success: false, error: '文件路径不能为空' });
                }
                
                const fullPath = path.resolve(filePath);
                
                // 安全检查：允许访问用户文档目录中的ArtiMeow项目
                const userHome = os.homedir();
                const documentsPath = path.join(userHome, 'Documents');
                const allowedPaths = [
                    path.resolve('./'),  // 当前工作目录
                    documentsPath,       // 用户文档目录
                    userHome             // 用户主目录
                ];
                
                const isAllowed = allowedPaths.some(allowedPath => 
                    fullPath.startsWith(allowedPath)
                );
                
                if (!isAllowed) {
                    console.log('文件访问被拒绝:', fullPath, '允许的路径:', allowedPaths);
                    return res.status(403).json({ success: false, error: 'Access denied' });
                }
                
                if (await fs.pathExists(fullPath)) {
                    const content = await fs.readFile(fullPath, 'utf8');
                    res.json({ success: true, content });
                } else {
                    res.status(404).json({ success: false, error: 'File not found' });
                }
            } catch (error) {
                console.error('读取文件失败:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/files/write', async (req, res) => {
            try {
                const { filePath, content } = req.body;
                if (!filePath) {
                    return res.status(400).json({ success: false, error: '文件路径不能为空' });
                }
                
                const fullPath = path.resolve(filePath);
                
                // 安全检查：允许访问用户文档目录中的ArtiMeow项目
                const userHome = os.homedir();
                const documentsPath = path.join(userHome, 'Documents');
                const allowedPaths = [
                    path.resolve('./'),  // 当前工作目录
                    documentsPath,       // 用户文档目录
                    userHome             // 用户主目录
                ];
                
                const isAllowed = allowedPaths.some(allowedPath => 
                    fullPath.startsWith(allowedPath)
                );
                
                if (!isAllowed) {
                    console.log('文件写入被拒绝:', fullPath, '允许的路径:', allowedPaths);
                    return res.status(403).json({ success: false, error: 'Access denied' });
                }
                
                await fs.ensureDir(path.dirname(fullPath));
                await fs.writeFile(fullPath, content || '', 'utf8');
                res.json({ success: true });
            } catch (error) {
                console.error('写入文件失败:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/files/create-directory', async (req, res) => {
            try {
                const { dirPath } = req.body;
                if (!dirPath) {
                    return res.status(400).json({ success: false, error: '目录路径不能为空' });
                }
                
                const fullPath = path.resolve(dirPath);
                
                // 安全检查：允许访问用户文档目录中的ArtiMeow项目
                const userHome = os.homedir();
                const documentsPath = path.join(userHome, 'Documents');
                const allowedPaths = [
                    path.resolve('./'),  // 当前工作目录
                    documentsPath,       // 用户文档目录
                    userHome             // 用户主目录
                ];
                
                const isAllowed = allowedPaths.some(allowedPath => 
                    fullPath.startsWith(allowedPath)
                );
                
                if (!isAllowed) {
                    console.log('目录创建被拒绝:', fullPath, '允许的路径:', allowedPaths);
                    return res.status(403).json({ success: false, error: 'Access denied' });
                }
                
                await fs.ensureDir(fullPath);
                res.json({ success: true });
            } catch (error) {
                console.error('创建目录失败:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/api/files/exists', async (req, res) => {
            try {
                const { path: checkPath } = req.body;
                if (!checkPath) {
                    return res.status(400).json({ success: false, error: '路径不能为空' });
                }
                
                const fullPath = path.resolve(checkPath);
                
                // 安全检查：允许访问用户文档目录中的ArtiMeow项目
                const userHome = os.homedir();
                const documentsPath = path.join(userHome, 'Documents');
                const allowedPaths = [
                    path.resolve('./'),  // 当前工作目录
                    documentsPath,       // 用户文档目录
                    userHome             // 用户主目录
                ];
                
                const isAllowed = allowedPaths.some(allowedPath => 
                    fullPath.startsWith(allowedPath)
                );
                
                if (!isAllowed) {
                    console.log('路径检查被拒绝:', fullPath, '允许的路径:', allowedPaths);
                    return res.status(403).json({ success: false, error: 'Access denied' });
                }
                
                const exists = await fs.pathExists(fullPath);
                res.json({ success: true, exists });
            } catch (error) {
                console.error('检查路径失败:', error);
                res.status(500).json({ success: false, error: error.message });
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
            
            // 添加登录CSS链接和favicon到head中
            htmlContent = htmlContent.replace(
                '</head>',
                '    <link rel="stylesheet" href="/login.css">\n    <link rel="icon" type="image/png" href="/assets/icons/icon.png">\n</head>'
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
        
        /* Web模式标题栏 */
        .web-titlebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 32px;
            background: linear-gradient(135deg, #2d2d2d, #1e1e1e);
            border-bottom: 1px solid #404040;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            z-index: 1000;
            font-size: 14px;
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .web-titlebar-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .web-titlebar-icon {
            width: 16px;
            height: 16px;
            background-image: url('/assets/icons/icon.png');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
        }
        
        .web-titlebar-title {
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        
        .web-titlebar-right {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #cccccc;
        }
        
        .web-mode-badge {
            background: linear-gradient(135deg, #4086ff, #3366cc);
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        /* 调整主界面以适应标题栏 */
        .app {
            padding-top: 32px !important;
        }
        
        /* 移除旧的登录样式，使用外部CSS */
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
        
        /* 复选框样式修复 - 仅在Web模式下应用 */
        .web-mode-indicator ~ * input[type="checkbox"],
        body.web-mode input[type="checkbox"] {
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
            width: 18px !important;
            height: 18px !important;
            min-width: 18px !important;
            min-height: 18px !important;
            max-width: 18px !important;
            max-height: 18px !important;
            display: inline-block !important;
            opacity: 1 !important;
            visibility: visible !important;
            position: relative !important;
            transform: none !important;
            margin: 0 10px 0 0 !important;
            padding: 0 !important;
            cursor: pointer !important;
            border: 2px solid #666 !important;
            border-radius: 4px !important;
            background: #fff !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
        }
        
        html[data-theme="dark"] .web-mode-indicator ~ * input[type="checkbox"],
        html[data-theme="dark"] body.web-mode input[type="checkbox"] {
            border-color: #888 !important;
            background: #333 !important;
        }
        
        .web-mode-indicator ~ * input[type="checkbox"]:focus,
        body.web-mode input[type="checkbox"]:focus {
            outline: 2px solid #0066cc !important;
            outline-offset: 2px !important;
        }
        
        .web-mode-indicator ~ * input[type="checkbox"]:checked,
        body.web-mode input[type="checkbox"]:checked {
            background: #0066cc !important;
            border-color: #0066cc !important;
        }
        
        html[data-theme="dark"] .web-mode-indicator ~ * input[type="checkbox"]:checked,
        html[data-theme="dark"] body.web-mode input[type="checkbox"]:checked {
            background: #4A9EFF !important;
            border-color: #4A9EFF !important;
        }
        
        .web-mode-indicator ~ * input[type="checkbox"]:checked::before,
        body.web-mode input[type="checkbox"]:checked::before {
            content: '✓' !important;
            position: absolute !important;
            top: -1px !important;
            left: 2px !important;
            color: white !important;
            font-size: 16px !important;
            font-weight: bold !important;
            line-height: 1 !important;
            pointer-events: none !important;
            z-index: 1 !important;
        }
        
        /* 使用data属性显示对勾 - 仅Web模式 */
        .web-mode-indicator ~ * input[type="checkbox"][data-checked="true"]::after,
        body.web-mode input[type="checkbox"][data-checked="true"]::after {
            content: '✓' !important;
            position: absolute !important;
            top: -1px !important;
            left: 2px !important;
            color: white !important;
            font-size: 16px !important;
            font-weight: bold !important;
            line-height: 1 !important;
            pointer-events: none !important;
            z-index: 1 !important;
        }
        
        /* 强制覆盖所有可能的标签布局 - 仅Web模式 */
        .web-mode-indicator ~ * label,
        body.web-mode label {
            display: flex !important;
            align-items: center !important;
            cursor: pointer !important;
            color: inherit !important;
            font-size: inherit !important;
            margin: 0 !important;
            line-height: 1.4 !important;
            gap: 8px !important;
        }
        
        .web-mode-indicator ~ * label input[type="checkbox"],
        body.web-mode label input[type="checkbox"] {
            order: -1 !important;
            flex-shrink: 0 !important;
            margin: 0 !important;
        }
        
        /* 专门针对设置页面的样式 - 仅Web模式 */
        .web-mode-indicator ~ .settings-panel * input[type="checkbox"],
        .web-mode-indicator ~ .setting-item * input[type="checkbox"],
        .web-mode-indicator ~ .form-group * input[type="checkbox"],
        .web-mode-indicator ~ .checkbox-group * input[type="checkbox"],
        body.web-mode .settings-panel * input[type="checkbox"],
        body.web-mode .setting-item * input[type="checkbox"],
        body.web-mode .form-group * input[type="checkbox"],
        body.web-mode .checkbox-group * input[type="checkbox"] {
            width: 18px !important;
            height: 18px !important;
            margin-right: 10px !important;
        }
        
        /* 强制显示复选框，不允许任何隐藏 - 仅Web模式 */
        .web-mode-indicator ~ * input[type="checkbox"]:not([style*="display: none"]):not([style*="visibility: hidden"]),
        body.web-mode input[type="checkbox"]:not([style*="display: none"]):not([style*="visibility: hidden"]) {
            display: inline-block !important;
            visibility: visible !important;
        }
        
        /* 确保在深色主题下可见 - 仅Web模式 */
        [data-theme="dark"] .web-mode-indicator ~ * input[type="checkbox"],
        [data-theme="dark"] body.web-mode input[type="checkbox"] {
            border-color: #666 !important;
            background: #2a2a2a !important;
        }
        
        [data-theme="dark"] .web-mode-indicator ~ * input[type="checkbox"]:checked,
        [data-theme="dark"] body.web-mode input[type="checkbox"]:checked {
            background: #4A9EFF !important;
            border-color: #4A9EFF !important;
        }
        
        /* Web模式下的表单样式调整 */
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
        
        /* 网络设置样式修复 */
        .network-setting-item {
            margin-bottom: 20px;
        }
        
        .network-setting-item .setting-label {
            display: block;
            margin-bottom: 8px;
            color: var(--text-primary);
            font-weight: 500;
        }
        
        .network-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .network-toggle .switch {
            position: relative;
            width: 44px;
            height: 24px;
            background: var(--bg-secondary);
            border-radius: 12px;
            border: 1px solid var(--border-color);
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .network-toggle .switch.active {
            background: var(--accent-color);
        }
        
        .network-toggle .switch::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 18px;
            height: 18px;
            background: white;
            border-radius: 50%;
            transition: all 0.3s;
        }
        
        .network-toggle .switch.active::after {
            left: 22px;
        }
        
        .network-toggle label {
            color: var(--text-primary);
            cursor: pointer;
            user-select: none;
        }
        
        .network-input-group {
            margin-bottom: 15px;
        }
        
        .network-input-group input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--bg-secondary);
            color: var(--text-primary);
        }
        
        .network-status {
            margin-top: 15px;
            padding: 10px;
            border-radius: 4px;
            background: var(--bg-secondary);
        }
        
        .ip-list {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .ip-item {
            padding: 5px 10px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9rem;
        }
        
        /* Web模式下隐藏网络控制，因为已经在使用中 */
        .web-mode-indicator + * .network-toggle {
            opacity: 0.6;
            pointer-events: none;
        }
        
        .web-mode-indicator + * .network-toggle::after {
            content: '(Web模式中)';
            position: absolute;
            right: -80px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.8rem;
            color: var(--text-muted);
        }
        
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
            
            // 在body开始后添加Web标题栏、登录界面和Web模式指示器
            const webElements = `
    
    <!-- Web模式标题栏 -->
    <div class="web-titlebar">
        <div class="web-titlebar-left">
            <div class="web-titlebar-icon"></div>
            <span class="web-titlebar-title">ArtiMeow AI Writer</span>
        </div>
        <div class="web-titlebar-right">
            <span class="web-mode-badge">Web模式</span>
            <span>远程访问</span>
        </div>
    </div>
    
    <!-- Web登录界面 -->
    <div id="web-login-overlay" class="web-login-overlay">
        <div class="web-login">
            <h2>
                <img src="/assets/icons/icon.png" alt="ArtiMeow" style="width: 24px; height: 24px; vertical-align: middle; margin-right: 8px;">
                ArtiMeow AI Writer
            </h2>
            <p class="subtitle">AI 集成小说写作应用 - 远程访问</p>
            <form id="web-login-form">
                <div class="form-group">
                    <label for="web-password">访问密码</label>
                    <input type="password" id="web-password" name="password" required placeholder="请输入访问密码">
                </div>
                <button type="submit" class="btn">
                    <i class="fas fa-sign-in-alt"></i>
                    登录
                </button>
                <div id="web-login-error" class="error" style="display: none;"></div>
            </form>
            <div class="brand">
                <div class="brand-name">ArtiMeow</div>
                <div class="brand-desc">让创作更智能</div>
            </div>
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
        
        // 添加Web模式CSS类到body
        document.addEventListener('DOMContentLoaded', function() {
            document.body.classList.add('web-mode');
        });
        
        // 只在真正的Web环境中设置Web模式标识
        // API适配器会处理具体的API调用
        if (!window.electronAPI) {
            console.log('Web模式：使用API适配器处理API调用');
        }        // 强制修复复选框显示问题 - 仅在Web模式下执行
        function forceFixCheckboxes() {
            // 确保只在Web模式下执行
            if (!window.isWebMode) return;
            
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                // 强制设置样式 - 分别设置每个属性
                checkbox.style.webkitAppearance = 'none';
                checkbox.style.mozAppearance = 'none';
                checkbox.style.appearance = 'none';
                checkbox.style.width = '18px';
                checkbox.style.height = '18px';
                checkbox.style.display = 'inline-block';
                checkbox.style.opacity = '1';
                checkbox.style.visibility = 'visible';
                checkbox.style.position = 'relative';
                checkbox.style.margin = '0 10px 0 0';
                checkbox.style.padding = '0';
                checkbox.style.cursor = 'pointer';
                checkbox.style.border = '2px solid #666';
                checkbox.style.borderRadius = '4px';
                checkbox.style.background = document.documentElement.getAttribute('data-theme') === 'dark' ? '#333' : '#fff';
                checkbox.style.verticalAlign = 'middle';
                checkbox.style.flexShrink = '0';
                checkbox.style.boxSizing = 'border-box';
                
                // 添加选中状态处理
                const updateCheckboxStyle = () => {
                    if (checkbox.checked) {
                        checkbox.style.background = '#0066cc';
                        checkbox.style.borderColor = '#0066cc';
                        // 添加对勾
                        if (!checkbox.querySelector('::before')) {
                            checkbox.setAttribute('data-checked', 'true');
                        }
                    } else {
                        checkbox.style.background = document.documentElement.getAttribute('data-theme') === 'dark' ? '#333' : '#fff';
                        checkbox.style.borderColor = '#666';
                        checkbox.removeAttribute('data-checked');
                    }
                };
                
                checkbox.addEventListener('change', updateCheckboxStyle);
                updateCheckboxStyle(); // 初始化状态
                
                // 确保标签布局正确
                const label = checkbox.closest('label');
                if (label) {
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.cursor = 'pointer';
                    label.style.gap = '8px';
                }
            });
        }
        
        // 页面加载完成后修复复选框
        document.addEventListener('DOMContentLoaded', forceFixCheckboxes);
        
        // 监听DOM变化，确保动态添加的复选框也被修复
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            const checkboxes = node.querySelectorAll ? node.querySelectorAll('input[type="checkbox"]') : [];
                            if (checkboxes.length > 0) {
                                setTimeout(forceFixCheckboxes, 10);
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Web模式登录处理
        document.addEventListener('DOMContentLoaded', function() {
            const loginForm = document.getElementById('web-login-form');
            const loginOverlay = document.getElementById('web-login-overlay');
            const errorDiv = document.getElementById('web-login-error');
            
            // 检查是否已经登录
            const token = localStorage.getItem('artimeow_token');
            if (token) {
                // 验证token是否有效
                fetch('/api/settings', {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                })
                .then(response => {
                    if (response.ok) {
                        // Token有效，隐藏登录界面
                        loginOverlay.style.display = 'none';
                        // 不在这里显示错误信息
                    } else {
                        // Token无效，清除并显示登录界面
                        localStorage.removeItem('artimeow_token');
                        loginOverlay.style.display = 'flex';
                    }
                })
                .catch(() => {
                    // 网络错误，清除token
                    localStorage.removeItem('artimeow_token');
                    loginOverlay.style.display = 'flex';
                });
            } else {
                // 没有token，显示登录界面
                loginOverlay.style.display = 'flex';
            }
            
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const password = document.getElementById('web-password').value;
                    const submitBtn = loginForm.querySelector('.btn');
                    
                    // 禁用提交按钮，显示加载状态
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
                    
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
                            
                            // 显示成功状态
                            submitBtn.innerHTML = '<i class="fas fa-check"></i> 登录成功';
                            submitBtn.style.background = 'linear-gradient(135deg, #00c851, #007e33)';
                            
                            // 延迟1秒后刷新页面
                            setTimeout(() => {
                                window.location.reload();
                            }, 1000);
                        } else {
                            throw new Error(result.error || '登录失败');
                        }
                    } catch (error) {
                        // 显示错误信息
                        errorDiv.textContent = error.message || '连接失败，请检查网络';
                        errorDiv.style.display = 'block';
                        
                        // 恢复提交按钮
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
                        submitBtn.style.background = '';
                        
                        // 5秒后自动隐藏错误信息
                        setTimeout(() => {
                            errorDiv.style.display = 'none';
                        }, 5000);
                    }
                });
            }
        });
        
        // 修改所有的fetch请求以包含token - 仅在Web模式下执行
        if (window.isWebMode) {
            const originalFetch = window.fetch;
            window.fetch = function(url, options = {}) {
                const token = localStorage.getItem('artimeow_token');
                const isLoggedIn = !!token;
                
                if (token && url.startsWith('/api/') && url !== '/api/login' && url !== '/api/status') {
                    options.headers = options.headers || {};
                    options.headers['Authorization'] = 'Bearer ' + token;
                }
                
                return originalFetch(url, options).then(response => {
                    // 如果token过期，清除token但不重新加载页面，而是显示登录界面
                    if ((response.status === 403 || response.status === 401) && 
                        url !== '/api/login' && url !== '/api/status') {
                        
                        // 如果用户已登录但token失效，才清除token并显示登录界面
                        if (isLoggedIn) {
                            localStorage.removeItem('artimeow_token');
                            const loginOverlay = document.getElementById('web-login-overlay');
                            if (loginOverlay) {
                                loginOverlay.style.display = 'flex';
                            }
                        }
                        
                        // 对于未登录状态下的401/403错误，静默处理，不抛出异常
                        if (!isLoggedIn) {
                            // 创建一个包装的response，标记为认证错误但不会触发错误显示
                            const wrappedResponse = new Proxy(response, {
                                get(target, prop) {
                                    if (prop === 'isAuthError') {
                                        return true;
                                    }
                                    return target[prop];
                                }
                            });
                            return wrappedResponse;
                        }
                    }
                    return response;
                }).catch(error => {
                    // 对于网络错误，如果用户未登录，也要静默处理
                    if (!isLoggedIn && (url.startsWith('/api/') && url !== '/api/login' && url !== '/api/status')) {
                        // 返回一个模拟的失败响应，但标记为认证错误
                        return Promise.resolve({
                            ok: false,
                            status: 401,
                            statusText: 'Unauthorized',
                            isAuthError: true,
                            json: () => Promise.resolve({ error: 'Not authenticated' }),
                            text: () => Promise.resolve('Not authenticated')
                        });
                    }
                    throw error;
                });
            };
            
            // 覆盖全局错误处理，过滤认证错误
            const originalShowError = window.ArtiMeowApp?.prototype?.showError;
            if (originalShowError) {
                window.ArtiMeowApp.prototype.showError = function(message) {
                    const token = localStorage.getItem('artimeow_token');
                    const isLoggedIn = !!token;
                    
                    // 如果用户未登录，且错误消息包含认证相关关键词，则不显示
                    if (!isLoggedIn) {
                        const authErrorPatterns = [
                            '401', '403', 'unauthorized', 'forbidden', 
                            'token', 'authentication', '身份验证', '访问令牌',
                            'Not authenticated', 'Access denied', '操作失败，请重试'
                        ];
                        
                        const messageStr = String(message).toLowerCase();
                        const isAuthError = authErrorPatterns.some(pattern => 
                            messageStr.includes(pattern.toLowerCase())
                        );
                        
                        if (isAuthError) {
                            console.log('Web模式：过滤认证错误，用户未登录:', message);
                            return;
                        }
                    }
                    
                    // 调用原始的showError方法
                    originalShowError.call(this, message);
                };
            }
            
            // 在DOMContentLoaded时也设置错误过滤
            document.addEventListener('DOMContentLoaded', function() {
                // 查找并覆盖app实例的showError方法
                setTimeout(() => {
                    if (window.app && typeof window.app.showError === 'function') {
                        const originalShowError = window.app.showError.bind(window.app);
                        window.app.showError = function(message) {
                            const token = localStorage.getItem('artimeow_token');
                            const isLoggedIn = !!token;
                            
                            // 如果用户未登录，且错误消息包含认证相关关键词，则不显示
                            if (!isLoggedIn) {
                                const authErrorPatterns = [
                                    '401', '403', 'unauthorized', 'forbidden', 
                                    'token', 'authentication', '身份验证', '访问令牌',
                                    'not authenticated', 'access denied', '连接失败',
                                    'failed to fetch', 'network error', '操作失败，请重试'
                                ];
                                
                                const messageStr = String(message).toLowerCase();
                                const isAuthError = authErrorPatterns.some(pattern => 
                                    messageStr.includes(pattern.toLowerCase())
                                );
                                
                                if (isAuthError) {
                                    console.log('Web模式：过滤认证错误，用户未登录:', message);
                                    return;
                                }
                            }
                            
                            // 调用原始的showError方法
                            originalShowError(message);
                        };
                    }
                }, 1000);
            });
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

    /**
     * 获取服务器版本信息
     */
    getServerVersions() {
        try {
            const versions = {};
            
            // 安全地获取版本信息
            try {
                versions.express = require('express/package.json').version;
            } catch (e) {
                versions.express = 'Unknown';
            }
            
            try {
                // Socket.io 使用不同的方式获取版本
                const socketIo = require('socket.io');
                versions['socket.io'] = socketIo.version || 'Unknown';
            } catch (e) {
                versions['socket.io'] = 'Unknown';
            }
            
            try {
                versions.bcrypt = require('bcrypt/package.json').version;
            } catch (e) {
                versions.bcrypt = 'Unknown';
            }
            
            try {
                versions.jsonwebtoken = require('jsonwebtoken/package.json').version;
            } catch (e) {
                versions.jsonwebtoken = 'Unknown';
            }
            
            try {
                versions.cors = require('cors/package.json').version;
            } catch (e) {
                versions.cors = 'Unknown';
            }
            
            versions.node = process.version;
            
            return versions;
        } catch (error) {
            console.warn('无法获取版本信息:', error);
            return {
                express: 'Unknown',
                'socket.io': 'Unknown',
                bcrypt: 'Unknown',
                jsonwebtoken: 'Unknown',
                cors: 'Unknown',
                node: process.version
            };
        }
    }
}

module.exports = ArtiMeowWebServer;
