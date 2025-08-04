/**
 * 网络设置管理器
 * 管理Web服务器的启动、停止和配置
 */

class NetworkManager {
    constructor() {
        this.webServer = null;
        this.isServerRunning = false;
        this.settings = {
            enabled: false,
            port: 3000,
            password: '',
            autoStart: false
        };
        
        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        console.log('网络管理器初始化');
        await this.loadSettings();
        this.bindEvents();
        
        // 初始化时就显示IP地址
        await this.updateNetworkIPDisplay();
        
        // 如果设置了自动启动，则启动服务器
        if (this.settings.enabled && this.settings.autoStart) {
            await this.startServer();
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 启用/禁用切换
        const enableToggle = document.getElementById('network-enabled');
        if (enableToggle) {
            enableToggle.addEventListener('change', (e) => {
                this.settings.enabled = e.target.checked;
                this.updateUI();
                if (e.target.checked) {
                    this.showServerSettings();
                } else {
                    this.stopServer();
                    this.hideServerSettings();
                }
            });
        }

        // 端口设置
        const portInput = document.getElementById('network-port');
        if (portInput) {
            portInput.addEventListener('change', (e) => {
                this.settings.port = parseInt(e.target.value) || 3000;
                if (this.isServerRunning) {
                    this.restartServer();
                }
            });
        }

        // 密码设置
        const passwordInput = document.getElementById('network-password');
        if (passwordInput) {
            passwordInput.addEventListener('change', (e) => {
                this.settings.password = e.target.value;
                if (this.isServerRunning) {
                    this.restartServer();
                }
            });
        }

        // 自动启动设置
        const autoStartToggle = document.getElementById('network-auto-start');
        if (autoStartToggle) {
            autoStartToggle.addEventListener('change', (e) => {
                this.settings.autoStart = e.target.checked;
            });
        }

        // 启动/停止按钮
        const startStopBtn = document.getElementById('network-start-stop');
        if (startStopBtn) {
            startStopBtn.addEventListener('click', () => {
                if (this.isServerRunning) {
                    this.stopServer();
                } else {
                    this.startServer();
                }
            });
        }

        // 复制访问链接按钮
        const copyUrlBtn = document.getElementById('copy-access-url');
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => {
                this.copyAccessUrl();
            });
        }
    }

    /**
     * 加载设置
     */
    async loadSettings() {
        try {
            const allSettings = await window.electronAPI.getSettings();
            if (allSettings.network) {
                this.settings = { ...this.settings, ...allSettings.network };
            }
            console.log('网络设置加载完成:', this.settings);
        } catch (error) {
            console.error('加载网络设置失败:', error);
        }
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        try {
            const allSettings = await window.electronAPI.getSettings();
            allSettings.network = this.settings;
            await window.electronAPI.saveSettings(allSettings);
            console.log('网络设置保存成功');
        } catch (error) {
            console.error('保存网络设置失败:', error);
        }
    }

    /**
     * 启动服务器
     */
    async startServer() {
        if (this.isServerRunning) {
            console.log('服务器已在运行');
            return;
        }

        if (!this.settings.password) {
            this.showError('请设置访问密码');
            return;
        }

        try {
            this.showStatus('正在启动服务器...');
            
            const config = {
                port: this.settings.port,
                password: this.settings.password
            };

            const result = await window.electronAPI.startWebServer(config);
            
            if (result.success) {
                this.isServerRunning = true;
                this.serverInfo = result.info;
                this.showSuccess(`服务器启动成功！端口: ${result.info.port}`);
                this.updateUI();
                this.updateServerStatus();
            } else {
                this.showError('启动服务器失败: ' + result.error);
            }
        } catch (error) {
            console.error('启动服务器失败:', error);
            this.showError('启动服务器失败: ' + error.message);
        }
    }

    /**
     * 停止服务器
     */
    async stopServer() {
        if (!this.isServerRunning) {
            console.log('服务器未运行');
            return;
        }

        try {
            this.showStatus('正在停止服务器...');
            
            const result = await window.electronAPI.stopWebServer();
            
            if (result.success) {
                this.isServerRunning = false;
                this.serverInfo = null;
                this.showSuccess('服务器已停止');
                this.updateUI();
                this.updateServerStatus();
            } else {
                this.showError('停止服务器失败: ' + result.error);
            }
        } catch (error) {
            console.error('停止服务器失败:', error);
            this.showError('停止服务器失败: ' + error.message);
        }
    }

    /**
     * 重启服务器
     */
    async restartServer() {
        if (this.isServerRunning) {
            await this.stopServer();
            setTimeout(() => this.startServer(), 1000);
        }
    }

    /**
     * 更新网络IP地址显示
     */
    async updateNetworkIPDisplay() {
        try {
            const result = await window.electronAPI.getLocalIPs();
            
            if (!result.success) {
                console.error('获取IP地址失败:', result.error);
                return;
            }
            
            const ips = result.ips;
            
            // 更新IPv4列表
            const ipv4List = document.getElementById('ipv4-list');
            if (ipv4List) {
                if (ips.ipv4 && ips.ipv4.length > 0) {
                    ipv4List.innerHTML = ips.ipv4.map(ip => 
                        `<div class="ip-item">${ip}</div>`
                    ).join('');
                } else {
                    ipv4List.innerHTML = '<div class="ip-item">无可用的IPv4地址</div>';
                }
            }

            // 更新IPv6列表
            const ipv6List = document.getElementById('ipv6-list');
            if (ipv6List) {
                if (ips.ipv6 && ips.ipv6.length > 0) {
                    ipv6List.innerHTML = ips.ipv6.map(ip => 
                        `<div class="ip-item">${ip}</div>`
                    ).join('');
                } else {
                    ipv6List.innerHTML = '<div class="ip-item">无可用的IPv6地址</div>';
                }
            }
        } catch (error) {
            console.error('更新IP地址显示失败:', error);
        }
    }

    /**
     * 更新UI
     */
    updateUI() {
        // 更新启用状态
        const enableToggle = document.getElementById('network-enabled');
        if (enableToggle) {
            enableToggle.checked = this.settings.enabled;
        }

        // 更新端口
        const portInput = document.getElementById('network-port');
        if (portInput) {
            portInput.value = this.settings.port;
        }

        // 更新密码
        const passwordInput = document.getElementById('network-password');
        if (passwordInput) {
            passwordInput.value = this.settings.password;
        }

        // 更新自动启动
        const autoStartToggle = document.getElementById('network-auto-start');
        if (autoStartToggle) {
            autoStartToggle.checked = this.settings.autoStart;
        }

        // 更新启动/停止按钮
        const startStopBtn = document.getElementById('network-start-stop');
        if (startStopBtn) {
            startStopBtn.textContent = this.isServerRunning ? '停止服务器' : '启动服务器';
            startStopBtn.className = this.isServerRunning ? 'btn btn-danger' : 'btn btn-primary';
            startStopBtn.disabled = !this.settings.enabled || !this.settings.password;
        }

        // 显示/隐藏服务器设置
        if (this.settings.enabled) {
            this.showServerSettings();
        } else {
            this.hideServerSettings();
        }
    }

    /**
     * 更新服务器状态显示
     */
    async updateServerStatus() {
        const statusDiv = document.getElementById('network-server-status');
        if (!statusDiv) return;

        if (this.isServerRunning && this.serverInfo) {
            // 获取IP地址
            let ips = { ipv4: [], ipv6: [] };
            try {
                const result = await window.electronAPI.getLocalIPs();
                if (result.success) {
                    ips = result.ips;
                }
            } catch (error) {
                console.error('获取IP地址失败:', error);
            }
            
            let statusHTML = `
                <div class="server-status running">
                    <h4>✅ 服务器运行中</h4>
                    <p><strong>端口:</strong> ${this.serverInfo.port}</p>
                    
                    <div class="access-urls">
                        <h5>访问地址:</h5>
                        <div class="url-list">
                            <div class="url-item">
                                <span class="url">http://localhost:${this.serverInfo.port}</span>
                                <button class="btn-copy" onclick="navigator.clipboard.writeText('http://localhost:${this.serverInfo.port}')">复制</button>
                            </div>
            `;

            // 添加IPv4地址
            if (ips.ipv4 && ips.ipv4.length > 0) {
                ips.ipv4.forEach(ip => {
                    statusHTML += `
                        <div class="url-item">
                            <span class="url">http://${ip}:${this.serverInfo.port}</span>
                            <button class="btn-copy" onclick="navigator.clipboard.writeText('http://${ip}:${this.serverInfo.port}')">复制</button>
                        </div>
                    `;
                });
            }

            statusHTML += `
                        </div>
                    </div>
                    
                    <div class="qr-code" id="network-qr-code">
                        <!-- 这里可以添加二维码 -->
                    </div>
                </div>
            `;

            statusDiv.innerHTML = statusHTML;
        } else {
            statusDiv.innerHTML = `
                <div class="server-status stopped">
                    <h4>⭕ 服务器未运行</h4>
                    <p>点击"启动服务器"开始提供远程访问</p>
                </div>
            `;
        }
    }

    /**
     * 显示服务器设置
     */
    showServerSettings() {
        const settingsDiv = document.getElementById('network-server-settings');
        if (settingsDiv) {
            settingsDiv.style.display = 'block';
        }
    }

    /**
     * 隐藏服务器设置
     */
    hideServerSettings() {
        const settingsDiv = document.getElementById('network-server-settings');
        if (settingsDiv) {
            settingsDiv.style.display = 'none';
        }
    }

    /**
     * 复制访问链接
     */
    async copyAccessUrl() {
        if (!this.isServerRunning || !this.serverInfo) {
            this.showError('服务器未运行');
            return;
        }

        const result = await window.electronAPI.getLocalIPs();
        const ips = result.success ? result.ips : { ipv4: ['127.0.0.1'], ipv6: [] };
        const mainUrl = ips.ipv4.length > 0 
            ? `http://${ips.ipv4[0]}:${this.serverInfo.port}`
            : `http://localhost:${this.serverInfo.port}`;

        try {
            await navigator.clipboard.writeText(mainUrl);
            this.showSuccess('访问链接已复制到剪贴板');
        } catch (error) {
            console.error('复制失败:', error);
            this.showError('复制失败');
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const statusDiv = document.getElementById('network-status');
        if (statusDiv) {
            statusDiv.innerHTML = `<div class="status-error">${message}</div>`;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 5000);
        }
        console.error('Network Error:', message);
    }

    /**
     * 显示成功信息
     */
    showSuccess(message) {
        const statusDiv = document.getElementById('network-status');
        if (statusDiv) {
            statusDiv.innerHTML = `<div class="status-success">${message}</div>`;
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);
        }
        console.log('Network Success:', message);
    }

    /**
     * 显示状态信息
     */
    showStatus(message) {
        const statusDiv = document.getElementById('network-status');
        if (statusDiv) {
            statusDiv.innerHTML = `<div class="status-info">${message}</div>`;
        }
        console.log('Network Status:', message);
    }

    /**
     * 获取网络状态
     */
    getStatus() {
        return {
            enabled: this.settings.enabled,
            isServerRunning: this.isServerRunning,
            port: this.settings.port,
            hasPassword: !!this.settings.password,
            serverInfo: this.serverInfo
        };
    }

    /**
     * 应用设置（从设置对话框调用）
     */
    async applySettings(networkSettings) {
        this.settings = { ...this.settings, ...networkSettings };
        await this.saveSettings();
        this.updateUI();
        
        // 如果服务器在运行且设置有变化，重启服务器
        if (this.isServerRunning) {
            await this.restartServer();
        }
    }
}

// 创建全局实例
window.networkManager = new NetworkManager();
