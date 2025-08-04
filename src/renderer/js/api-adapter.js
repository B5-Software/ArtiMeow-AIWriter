/**
 * API适配器 - 统一Electron和Web模式的API调用
 * 提供一致的接口，无论在Electron还是Web环境中
 */

class APIAdapter {
    constructor() {
        // 改进Web模式检测逻辑 - 多重检查
        this.isWebMode = this.detectWebMode();
        this.isElectron = !this.isWebMode && !!window.electronAPI;
        
        console.log('API适配器初始化:', {
            isWebMode: this.isWebMode,
            isElectron: this.isElectron,
            hasElectronAPI: !!window.electronAPI,
            protocol: location.protocol,
            userAgent: navigator.userAgent.includes('Electron'),
            windowIsWebMode: window.isWebMode
        });
        
        // 在Web模式下设置fetch拦截器
        if (this.isWebMode) {
            this.setupWebModeFetch();
        }
    }

    /**
     * 检测Web模式
     */
    detectWebMode() {
        // 1. 检查显式设置的标识
        if (window.isWebMode === true) {
            return true;
        }
        
        // 2. 检查协议和Electron环境
        if (typeof window !== 'undefined' && 
            (location.protocol === 'http:' || location.protocol === 'https:') &&
            !navigator.userAgent.includes('Electron')) {
            return true;
        }
        
        // 3. 检查是否没有electronAPI（但排除开发环境）
        if (!window.electronAPI && 
            typeof require === 'undefined' && 
            typeof process === 'undefined') {
            return true;
        }
        
        return false;
    }

    /**
     * 设置Web模式下的fetch拦截器
     */
    setupWebModeFetch() {
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            // 为API请求自动添加认证token
            const token = localStorage.getItem('artimeow_token');
            if (token && url.startsWith('/api/') && url !== '/api/login' && url !== '/api/status') {
                options.headers = options.headers || {};
                options.headers['Authorization'] = 'Bearer ' + token;
                console.log('API请求添加token:', url, 'Token前20字符:', token.substring(0, 20) + '...');
            }
            
            return originalFetch(url, options).then(response => {
                // 如果token过期，清除token并显示登录界面
                if ((response.status === 403 || response.status === 401) && 
                    url !== '/api/login' && url !== '/api/status') {
                    console.log('Token过期或无效，清除token并显示登录界面:', url, response.status);
                    localStorage.removeItem('artimeow_token');
                    const loginOverlay = document.getElementById('web-login-overlay');
                    if (loginOverlay) {
                        loginOverlay.style.display = 'flex';
                    }
                }
                return response;
            }).catch(error => {
                console.warn(`API请求失败: ${url}`, error);
                throw error;
            });
        };
        
        console.log('Web模式fetch拦截器已设置');
    }

    /**
     * 设置相关API
     */
    async getSettings() {
        if (this.isElectron) {
            return await window.electronAPI.getSettings();
        } else {
            // Web模式
            const response = await fetch('/api/settings');
            if (!response.ok) {
                throw new Error('Failed to fetch settings');
            }
            return await response.json();
        }
    }

    async updateSettings(settings) {
        if (this.isElectron) {
            return await window.electronAPI.updateSettings(settings);
        } else {
            // Web模式
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (!response.ok) {
                throw new Error('Failed to save settings');
            }
            return await response.json();
        }
    }

    /**
     * 网络相关API
     */
    async getLocalIPs() {
        if (this.isElectron) {
            return await window.electronAPI.getLocalIPs();
        } else {
            // Web模式 - 返回模拟数据
            return {
                success: true,
                ips: { ipv4: ['127.0.0.1'], ipv6: ['::1'] }
            };
        }
    }

    async startWebServer(config) {
        if (this.isElectron) {
            return await window.electronAPI.startWebServer(config);
        } else {
            // Web模式下不能启动服务器
            return {
                success: false,
                error: 'Web模式下无法启动新的服务器实例'
            };
        }
    }

    async stopWebServer() {
        if (this.isElectron) {
            return await window.electronAPI.stopWebServer();
        } else {
            // Web模式下不能停止服务器
            return {
                success: false,
                error: 'Web模式下无法控制服务器'
            };
        }
    }

    async getWebServerStatus() {
        if (this.isElectron) {
            return await window.electronAPI.getWebServerStatus();
        } else {
            // Web模式 - 当前就在运行中
            return {
                success: true,
                status: { 
                    isRunning: true, 
                    port: location.port || 3000, 
                    connectedClients: 1 
                }
            };
        }
    }

    /**
     * 项目相关API
     */
    async getProjects() {
        if (this.isElectron) {
            return await window.electronAPI.getProjectList();
        } else {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }
            return await response.json();
        }
    }

    async createProject(projectData) {
        if (this.isElectron) {
            return await window.electronAPI.createProject(projectData);
        } else {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(projectData)
            });
            if (!response.ok) {
                throw new Error('Failed to create project');
            }
            return await response.json();
        }
    }

    async loadProject(projectPath) {
        if (this.isElectron) {
            return await window.electronAPI.loadProject(projectPath);
        } else {
            const response = await fetch('/api/projects/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath })
            });
            if (!response.ok) {
                throw new Error('Failed to load project');
            }
            return await response.json();
        }
    }

    async saveProject(saveData) {
        if (this.isElectron) {
            return await window.electronAPI.saveProject(saveData);
        } else {
            const response = await fetch('/api/projects/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });
            if (!response.ok) {
                throw new Error('Failed to save project');
            }
            return await response.json();
        }
    }

    async deleteProject(projectPath) {
        if (this.isElectron) {
            return await window.electronAPI.deleteProject(projectPath);
        } else {
            const response = await fetch('/api/projects/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath })
            });
            if (!response.ok) {
                throw new Error('Failed to delete project');
            }
            return await response.json();
        }
    }

    async addRecentProject(projectPath) {
        if (this.isElectron) {
            return await window.electronAPI.addRecentProject(projectPath);
        } else {
            const response = await fetch('/api/recent-projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath })
            });
            if (!response.ok) {
                throw new Error('Failed to add recent project');
            }
            return await response.json();
        }
    }

    async importProject(file) {
        if (this.isElectron) {
            // Electron模式下使用本地对话框
            return await window.electronAPI.importProject();
        } else {
            // Web模式下使用文件上传
            const formData = new FormData();
            formData.append('projectZip', file);
            formData.append('originalName', file.name.replace('.zip', ''));
            
            const response = await fetch('/api/projects/import', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to import project');
            }
            
            return await response.json();
        }
    }

    async loadChapter(params) {
        if (this.isElectron) {
            return await window.electronAPI.loadChapter(params);
        } else {
            const response = await fetch(`/api/projects/${encodeURIComponent(params.projectPath)}/chapters/${params.chapterId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    return { success: false, error: 'Chapter not found' };
                }
                throw new Error('Failed to load chapter');
            }
            return await response.json();
        }
    }

    async saveChapter(params) {
        if (this.isElectron) {
            return await window.electronAPI.saveChapter(params);
        } else {
            const response = await fetch(`/api/projects/${encodeURIComponent(params.projectPath)}/chapters/${params.chapterId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: params.title,
                    content: params.content
                })
            });
            if (!response.ok) {
                throw new Error('Failed to save chapter');
            }
            return await response.json();
        }
    }

    async getRecentProjects() {
        if (this.isElectron) {
            return await window.electronAPI.getRecentProjects();
        } else {
            const response = await fetch('/api/recent-projects');
            if (!response.ok) {
                throw new Error('Failed to fetch recent projects');
            }
            const data = await response.json();
            // 确保返回数组格式
            if (data && data.projects && Array.isArray(data.projects)) {
                return data.projects;
            } else if (Array.isArray(data)) {
                return data;
            }
            return [];
        }
    }

    /**
     * 教程相关API
     */
    async getTutorialDirectory() {
        if (this.isElectron) {
            return await window.electronAPI.getTutorialDirectory();
        } else {
            return '/tutorial';
        }
    }

    async readTutorialFiles() {
        if (this.isElectron) {
            return await window.electronAPI.readTutorialFiles();
        } else {
            const response = await fetch('/api/tutorial');
            if (!response.ok) {
                throw new Error('Failed to fetch tutorial files');
            }
            const data = await response.json();
            
            // 确保返回正确格式，并且data是数组
            if (Array.isArray(data)) {
                return data;
            } else if (data && data.files && Array.isArray(data.files)) {
                return data.files;
            } else if (data && Array.isArray(data.tutorials)) {
                return data.tutorials;
            }
            
            console.warn('教程数据格式不正确:', data);
            return [];
        }
    }

    /**
     * AI相关API
     */
    async testAIConnection(engine, settings) {
        if (this.isElectron) {
            return await window.electronAPI.testAIConnection(engine, settings);
        } else {
            try {
                const response = await fetch('/api/ai/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ engine, settings })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'AI连接测试失败');
                }
                
                return await response.json();
            } catch (error) {
                console.error('AI连接测试失败:', error);
                return { success: false, error: error.message };
            }
        }
    }

    async callAI(options) {
        if (this.isElectron) {
            return await window.electronAPI.callAI(options);
        } else {
            try {
                const response = await fetch('/api/ai/call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(options)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'AI调用失败');
                }
                
                return await response.json();
            } catch (error) {
                console.error('AI调用失败:', error);
                return { success: false, error: error.message };
            }
        }
    }

    /**
     * 版本信息API
     */
    async getAppVersionInfo() {
        if (this.isElectron) {
            return await window.electronAPI.getAppVersionInfo();
        } else {
            return {
                app: { name: 'ArtiMeow AI Writer', version: '1.1.0', description: 'AI 集成小说写作桌面应用' },
                system: { platform: 'web', arch: 'web', node: 'N/A', electron: 'N/A' },
                dependencies: {
                    'marked': 'Web版本',
                    'axios': 'Web版本',
                    'highlight.js': 'Web版本',
                    'electron-store': 'N/A',
                    'archiver': 'N/A',
                    'diff': 'Web版本',
                    'extract-zip': 'N/A',
                    'express': 'Web服务器',
                    'socket.io': 'Web服务器',
                    'bcrypt': 'Web服务器',
                    'jsonwebtoken': 'Web服务器',
                    'cors': 'Web服务器'
                },
                buildInfo: { isPackaged: false, resourcesPath: 'Web模式', execPath: 'Web浏览器' }
            };
        }
    }

    /**
     * 窗口控制API
     */
    async windowMinimize() {
        if (this.isElectron && window.electronAPI.windowMinimize) {
            return await window.electronAPI.windowMinimize();
        } else {
            // Web模式下无法最小化窗口
            return { success: false, error: 'Web模式下无法控制窗口' };
        }
    }

    async windowMaximize() {
        if (this.isElectron && window.electronAPI.windowMaximize) {
            return await window.electronAPI.windowMaximize();
        } else {
            // Web模式下无法最大化窗口
            return { success: false, error: 'Web模式下无法控制窗口' };
        }
    }

    async windowClose() {
        if (this.isElectron && window.electronAPI.windowClose) {
            return await window.electronAPI.windowClose();
        } else {
            // Web模式下关闭标签页
            window.close();
            return { success: true };
        }
    }

    /**
     * 文件操作API
     */
    async chooseDirectory() {
        if (this.isElectron) {
            return await window.electronAPI.chooseDirectory();
        } else {
            return { canceled: true };
        }
    }

    async showSaveDialog(options) {
        if (this.isElectron) {
            return await window.electronAPI.showSaveDialog(options);
        } else {
            return { canceled: true };
        }
    }

    async showOpenDialog(options) {
        if (this.isElectron) {
            return await window.electronAPI.showOpenDialog(options);
        } else {
            return { canceled: true };
        }
    }

    /**
     * 工具方法
     */
    async showMessageBox(options) {
        if (this.isElectron && window.electronAPI.showMessageBox) {
            return await window.electronAPI.showMessageBox(options);
        } else {
            // Web模式或Electron没有此方法时的备用实现
            return new Promise((resolve) => {
                const result = confirm(options.message || '确认操作？');
                resolve({
                    response: result ? 0 : 1,
                    checkboxChecked: false
                });
            });
        }
    }

    /**
     * Shell操作
     */
    openExternal(url) {
        if (this.isElectron && window.electronAPI.shell) {
            window.electronAPI.shell.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    }

    /**
     * 设置导入导出
     */
    async exportSettings(filePath) {
        if (this.isElectron) {
            return await window.electronAPI.exportSettings(filePath);
        } else {
            // Web模式下不支持文件系统操作
            return { success: false, error: 'Web模式下不支持导出设置到文件' };
        }
    }

    async importSettings(filePath) {
        if (this.isElectron) {
            return await window.electronAPI.importSettings(filePath);
        } else {
            // Web模式下不支持文件系统操作
            return { success: false, error: 'Web模式下不支持从文件导入设置' };
        }
    }

    /**
     * 通用方法包装器
     */
    async invoke(method, ...args) {
        if (this.isElectron && window.electronAPI[method]) {
            return await window.electronAPI[method](...args);
        } else {
            // Web模式下的特殊处理
            switch(method) {
                case 'get-tutorial-directory':
                    return await this.getTutorialDirectory();
                case 'read-tutorial-files':
                    return await this.readTutorialFiles();
                default:
                    console.warn(`方法 ${method} 在当前环境中不可用`);
                    return { success: false, error: `方法 ${method} 在当前环境中不可用` };
            }
        }
    }

    /**
     * 设置管理扩展
     */
    async resetSettings() {
        if (this.isElectron) {
            return await window.electronAPI.resetSettings();
        } else {
            try {
                const defaultSettings = {
                    ai: { currentEngine: 'openai', engines: { openai: { apiKey: '', model: 'gpt-3.5-turbo', baseURL: 'https://api.openai.com/v1', temperature: 0.7, maxTokens: 2000 } } },
                    editor: { fontSize: 16, fontFamily: 'Microsoft YaHei', theme: 'default', wordWrap: true, lineNumbers: false },
                    network: { enabled: false, port: 3000, password: '', allowedIPs: ['127.0.0.1'] }
                };
                await this.updateSettings(defaultSettings);
                return { success: true };
            } catch (error) {
                console.error('重置设置失败:', error);
                return { success: false, error: error.message };
            }
        }
    }

    async saveSettings(settings) {
        return await this.updateSettings(settings);
    }

    /**
     * 主题相关
     */
    async setTheme(theme) {
        if (this.isElectron) {
            return await window.electronAPI.setTheme(theme);
        } else {
            document.documentElement.setAttribute('data-theme', theme);
            return { success: true };
        }
    }

    async getTheme() {
        if (this.isElectron) {
            return await window.electronAPI.getTheme();
        } else {
            return { theme: document.documentElement.getAttribute('data-theme') || 'default' };
        }
    }

    /**
     * 备份相关
     */
    async createBackup(projectPath) {
        if (this.isElectron) {
            return await window.electronAPI.createBackup(projectPath);
        } else {
            return { success: false, error: 'Web模式暂不支持备份功能' };
        }
    }

    async openBackupFolder() {
        if (this.isElectron) {
            return await window.electronAPI.openBackupFolder();
        } else {
            return { success: false, error: 'Web模式无法打开文件夹' };
        }
    }

    /**
     * 终端相关
     */
    async openTerminal(command = '', projectPath = '') {
        if (this.isElectron) {
            return await window.electronAPI.openTerminal(command, projectPath);
        } else {
            console.log('Web模式下无法打开终端');
            return { success: false, error: 'Web模式无法打开终端' };
        }
    }

    /**
     * 章节管理
     */
    async renameChapter(params) {
        if (this.isElectron) {
            return await window.electronAPI.renameChapter(params);
        } else {
            try {
                const response = await fetch('/api/projects/chapter/rename', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                if (!response.ok) throw new Error('Failed to rename chapter');
                return await response.json();
            } catch (error) {
                console.error('重命名章节失败:', error);
                throw new Error('Failed to rename chapter');
            }
        }
    }

    async deleteChapter(params) {
        if (this.isElectron) {
            return await window.electronAPI.deleteChapter(params);
        } else {
            try {
                const response = await fetch('/api/projects/chapter/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params)
                });
                if (!response.ok) throw new Error('Failed to delete chapter');
                return await response.json();
            } catch (error) {
                console.error('删除章节失败:', error);
                throw new Error('Failed to delete chapter');
            }
        }
    }

    /**
     * Git 相关API
     */
    async gitInit(projectPath) {
        if (this.isElectron) {
            return await window.electronAPI.gitInit(projectPath);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitStatus(projectPath) {
        if (this.isElectron) {
            return await window.electronAPI.gitStatus(projectPath);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async getGitStatus(projectPath) {
        return await this.gitStatus(projectPath);
    }

    async gitAdd(projectPath, files) {
        if (this.isElectron) {
            return await window.electronAPI.gitAdd(projectPath, files);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitCommit(projectPath, message) {
        if (this.isElectron) {
            return await window.electronAPI.gitCommit(projectPath, message);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitPush(projectPath, remote, branch) {
        if (this.isElectron) {
            return await window.electronAPI.gitPush(projectPath, remote, branch);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitPull(projectPath, remote, branch) {
        if (this.isElectron) {
            return await window.electronAPI.gitPull(projectPath, remote, branch);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitLog(projectPath, limit) {
        if (this.isElectron) {
            return await window.electronAPI.gitLog(projectPath, limit);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitAddRemote(projectPath, remoteName, remoteUrl) {
        if (this.isElectron) {
            return await window.electronAPI.gitAddRemote(projectPath, remoteName, remoteUrl);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitListBranches(projectPath, includeRemote) {
        if (this.isElectron) {
            return await window.electronAPI.gitListBranches(projectPath, includeRemote);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitCreateBranch(projectPath, branchName) {
        if (this.isElectron) {
            return await window.electronAPI.gitCreateBranch(projectPath, branchName);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitListRemotes(projectPath) {
        if (this.isElectron) {
            return await window.electronAPI.gitListRemotes(projectPath);
        } else {
            return { success: false, error: 'Web模式暂不支持Git操作' };
        }
    }

    async gitGetRemotes(projectPath) {
        return await this.gitListRemotes(projectPath);
    }

    async gitGetBranches(projectPath) {
        return await this.gitListBranches(projectPath, true);
    }

    /**
     * 文件操作API
     */
    async readFile(filePath) {
        if (this.isElectron) {
            return await window.electronAPI.readFile(filePath);
        } else {
            try {
                const response = await fetch('/api/files/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath })
                });
                if (!response.ok) throw new Error('Failed to read file');
                return await response.json();
            } catch (error) {
                console.error('读取文件失败:', error);
                return { success: false, error: error.message };
            }
        }
    }

    async writeFile(filePath, content) {
        if (this.isElectron) {
            return await window.electronAPI.writeFile(filePath, content);
        } else {
            try {
                const response = await fetch('/api/files/write', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath, content })
                });
                if (!response.ok) throw new Error('Failed to write file');
                return await response.json();
            } catch (error) {
                console.error('写入文件失败:', error);
                return { success: false, error: error.message };
            }
        }
    }

    async createDirectory(dirPath) {
        if (this.isElectron) {
            return await window.electronAPI.createDirectory(dirPath);
        } else {
            try {
                const response = await fetch('/api/files/create-directory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dirPath })
                });
                if (!response.ok) throw new Error('Failed to create directory');
                return await response.json();
            } catch (error) {
                console.error('创建目录失败:', error);
                return { success: false, error: error.message };
            }
        }
    }

    async pathExists(path) {
        if (this.isElectron) {
            return await window.electronAPI.pathExists(path);
        } else {
            try {
                const response = await fetch('/api/files/exists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                });
                if (!response.ok) throw new Error('Failed to check path');
                return await response.json();
            } catch (error) {
                console.error('检查路径失败:', error);
                return { success: false, exists: false };
            }
        }
    }

    /**
     * 字体管理API
     */
    async getSystemFonts() {
        if (this.isElectron) {
            return await window.electronAPI.getSystemFonts();
        } else {
            return {
                success: true,
                fonts: [
                    'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
                    'Verdana', 'Georgia', 'Palatino', 'Garamond',
                    'Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi',
                    'Microsoft JhengHei', 'PingFang SC', 'Hiragino Sans GB'
                ]
            };
        }
    }

    async addCustomFont(fontPath) {
        if (this.isElectron) {
            return await window.electronAPI.addCustomFont(fontPath);
        } else {
            return { success: false, error: 'Web模式不支持添加自定义字体' };
        }
    }

    async removeCustomFont(fontPath) {
        if (this.isElectron) {
            return await window.electronAPI.removeCustomFont(fontPath);
        } else {
            return { success: false, error: 'Web模式不支持移除自定义字体' };
        }
    }

    /**
     * 自动保存和备份API
     */
    async enableAutoSave(projectPath, interval) {
        if (this.isElectron) {
            return await window.electronAPI.enableAutoSave(projectPath, interval);
        } else {
            return { success: true, message: 'Web模式自动保存已启用' };
        }
    }

    async disableAutoSave() {
        if (this.isElectron) {
            return await window.electronAPI.disableAutoSave();
        } else {
            return { success: true, message: 'Web模式自动保存已禁用' };
        }
    }

}

// 创建全局API适配器实例
window.apiAdapter = new APIAdapter();

// 兼容性：为现有代码提供electronAPI的备用
if (!window.electronAPI) {
    window.electronAPI = {
        // 基础API
        getSettings: () => window.apiAdapter.getSettings(),
        updateSettings: (settings) => window.apiAdapter.updateSettings(settings),
        saveSettings: (settings) => window.apiAdapter.saveSettings(settings),
        resetSettings: () => window.apiAdapter.resetSettings(),
        
        // 网络相关
        getLocalIPs: () => window.apiAdapter.getLocalIPs(),
        startWebServer: (config) => window.apiAdapter.startWebServer(config),
        stopWebServer: () => window.apiAdapter.stopWebServer(),
        getWebServerStatus: () => window.apiAdapter.getWebServerStatus(),
        
        // 项目管理
        getProjectList: () => window.apiAdapter.getProjects(),
        createProject: (projectData) => window.apiAdapter.createProject(projectData),
        loadProject: (projectPath) => window.apiAdapter.loadProject(projectPath),
        openProject: (projectPath) => window.apiAdapter.loadProject(projectPath),
        saveProject: (saveData) => window.apiAdapter.saveProject(saveData),
        deleteProject: (projectPath) => window.apiAdapter.deleteProject(projectPath),
        addRecentProject: (projectPath) => window.apiAdapter.addRecentProject(projectPath),
        importProject: (file) => window.apiAdapter.importProject(file),
        getRecentProjects: () => window.apiAdapter.getRecentProjects(),
        
        // 章节管理
        loadChapter: (params) => window.apiAdapter.loadChapter(params),
        saveChapter: (params) => window.apiAdapter.saveChapter(params),
        renameChapter: (params) => window.apiAdapter.renameChapter(params),
        deleteChapter: (params) => window.apiAdapter.deleteChapter(params),
        
        // 教程相关
        getTutorialDirectory: () => window.apiAdapter.getTutorialDirectory(),
        readTutorialFiles: () => window.apiAdapter.readTutorialFiles(),
        
        // AI相关
        testAIConnection: (engine, settings) => window.apiAdapter.testAIConnection(engine, settings),
        callAI: (options) => window.apiAdapter.callAI(options),
        
        // 应用信息
        getAppVersionInfo: () => window.apiAdapter.getAppVersionInfo(),
        
        // 窗口控制
        windowMinimize: () => window.apiAdapter.windowMinimize(),
        windowMaximize: () => window.apiAdapter.windowMaximize(),
        windowClose: () => window.apiAdapter.windowClose(),
        
        // 对话框
        chooseDirectory: () => window.apiAdapter.chooseDirectory(),
        showSaveDialog: (options) => window.apiAdapter.showSaveDialog(options),
        showOpenDialog: (options) => window.apiAdapter.showOpenDialog(options),
        showMessageBox: (options) => window.apiAdapter.showMessageBox(options),
        
        // 设置导入导出
        exportSettings: (filePath) => window.apiAdapter.exportSettings(filePath),
        importSettings: (filePath) => window.apiAdapter.importSettings(filePath),
        
        // 主题相关
        setTheme: (theme) => window.apiAdapter.setTheme(theme),
        getTheme: () => window.apiAdapter.getTheme(),
        
        // 备份相关
        createBackup: (projectPath) => window.apiAdapter.createBackup(projectPath),
        openBackupFolder: () => window.apiAdapter.openBackupFolder(),
        
        // 终端相关
        openTerminal: (command, projectPath) => window.apiAdapter.openTerminal(command, projectPath),
        
        // Git相关
        gitInit: (projectPath) => window.apiAdapter.gitInit(projectPath),
        gitStatus: (projectPath) => window.apiAdapter.gitStatus(projectPath),
        getGitStatus: (projectPath) => window.apiAdapter.getGitStatus(projectPath),
        gitAdd: (projectPath, files) => window.apiAdapter.gitAdd(projectPath, files),
        gitCommit: (projectPath, message) => window.apiAdapter.gitCommit(projectPath, message),
        gitPush: (projectPath, remote, branch) => window.apiAdapter.gitPush(projectPath, remote, branch),
        gitPull: (projectPath, remote, branch) => window.apiAdapter.gitPull(projectPath, remote, branch),
        gitLog: (projectPath, limit) => window.apiAdapter.gitLog(projectPath, limit),
        gitAddRemote: (projectPath, remoteName, remoteUrl) => window.apiAdapter.gitAddRemote(projectPath, remoteName, remoteUrl),
        gitListBranches: (projectPath, includeRemote) => window.apiAdapter.gitListBranches(projectPath, includeRemote),
        gitCreateBranch: (projectPath, branchName) => window.apiAdapter.gitCreateBranch(projectPath, branchName),
        gitListRemotes: (projectPath) => window.apiAdapter.gitListRemotes(projectPath),
        gitGetRemotes: (projectPath) => window.apiAdapter.gitGetRemotes(projectPath),
        gitGetBranches: (projectPath) => window.apiAdapter.gitGetBranches(projectPath),
        
        // 文件操作
        readFile: (filePath) => window.apiAdapter.readFile(filePath),
        writeFile: (filePath, content) => window.apiAdapter.writeFile(filePath, content),
        createDirectory: (dirPath) => window.apiAdapter.createDirectory(dirPath),
        pathExists: (path) => window.apiAdapter.pathExists(path),
        
        // 字体管理
        getSystemFonts: () => window.apiAdapter.getSystemFonts(),
        addCustomFont: (fontPath) => window.apiAdapter.addCustomFont(fontPath),
        removeCustomFont: (fontPath) => window.apiAdapter.removeCustomFont(fontPath),
        
        // 自动保存
        enableAutoSave: (projectPath, interval) => window.apiAdapter.enableAutoSave(projectPath, interval),
        disableAutoSave: () => window.apiAdapter.disableAutoSave(),
        
        // 通用方法
        invoke: (method, ...args) => window.apiAdapter.invoke(method, ...args),
        
        // Shell相关
        shell: {
            openExternal: (url) => window.apiAdapter.openExternal(url)
        }
    };
    
    console.log('为Web模式创建了electronAPI兼容层');
}
