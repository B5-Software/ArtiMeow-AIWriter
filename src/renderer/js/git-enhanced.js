/**
 * Git功能增强模块 - 重写版本
 * 提供完整的Git操作功能，包括推送、分支管理等
 */

class GitEnhancedManager {
    constructor() {
        this.currentProjectPath = null;
        this.gitStatus = null;
        this.branches = [];
        this.remotes = [];
        this.currentBranch = null;
        this.currentRemote = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.createGitStyles();
        console.log('Git 增强管理器初始化完成');
    }

    setupEventListeners() {
        // Git 推送按钮 - 重写逻辑
        const pushBtn = document.getElementById('git-push-btn');
        if (pushBtn) {
            pushBtn.addEventListener('click', () => this.handlePushWithDialog());
        }

        // Git 拉取按钮 - 重写逻辑
        const pullBtn = document.getElementById('git-pull-btn');
        if (pullBtn) {
            pullBtn.addEventListener('click', () => this.handlePullWithDialog());
        }

        // 提交按钮 - 增强逻辑
        const commitBtn = document.getElementById('git-commit-btn');
        if (commitBtn) {
            commitBtn.addEventListener('click', () => this.handleCommitWithDialog());
        }

        // 刷新状态按钮
        const refreshStatusBtn = document.getElementById('git-refresh-status-btn');
        if (refreshStatusBtn) {
            refreshStatusBtn.addEventListener('click', () => this.refreshGitStatus());
        }

        // 分支相关 - 只读操作
        const refreshBranchesBtn = document.getElementById('git-refresh-branches-btn');
        if (refreshBranchesBtn) {
            refreshBranchesBtn.addEventListener('click', () => this.refreshBranches());
        }

        // 分支教程按钮现在由app.js处理，使用浮窗教程

        const branchTerminalBtn = document.getElementById('git-branches-terminal-btn');
        if (branchTerminalBtn) {
            branchTerminalBtn.addEventListener('click', () => this.openTerminalForBranches());
        }

        // 远程相关 - 只读操作
        const refreshRemotesBtn = document.getElementById('git-refresh-remotes-btn');
        if (refreshRemotesBtn) {
            refreshRemotesBtn.addEventListener('click', () => this.refreshRemotes());
        }

        // 远程教程按钮现在由app.js处理，使用浮窗教程

        const remoteTerminalBtn = document.getElementById('git-remotes-terminal-btn');
        if (remoteTerminalBtn) {
            remoteTerminalBtn.addEventListener('click', () => this.openTerminalForRemotes());
        }

        // 刷新历史按钮
        const refreshHistoryBtn = document.getElementById('git-refresh-history-btn');
        if (refreshHistoryBtn) {
            refreshHistoryBtn.addEventListener('click', () => this.refreshHistory());
        }
    }

    // 推送操作 - 重写版本
    async handlePushWithDialog() {
        if (!this.currentProjectPath) {
            this.showNotification('请先选择一个项目', 'error');
            return;
        }

        try {
            // 检查是否有远程仓库
            const remotes = await this.getRemotes();
            if (remotes.length === 0) {
                this.showAddRemoteDialog();
                return;
            }

            // 检查是否有未提交的更改
            const status = await this.getGitStatus();
            if (status.hasChanges) {
                this.showCommitFirstDialog();
                return;
            }

            // 显示推送选择对话框
            this.showPushDialog(remotes);
        } catch (error) {
            console.error('推送检查失败:', error);
            this.showNotification('推送检查失败: ' + error.message, 'error');
        }
    }

    // 拉取操作 - 重写版本
    async handlePullWithDialog() {
        if (!this.currentProjectPath) {
            this.showNotification('请先选择一个项目', 'error');
            return;
        }

        try {
            const remotes = await this.getRemotes();
            if (remotes.length === 0) {
                this.showAddRemoteDialog();
                return;
            }

            this.showPullDialog(remotes);
        } catch (error) {
            console.error('拉取检查失败:', error);
            this.showNotification('拉取检查失败: ' + error.message, 'error');
        }
    }

    // 提交操作 - 增强版本
    async handleCommitWithDialog() {
        if (!this.currentProjectPath) {
            this.showNotification('请先选择一个项目', 'error');
            return;
        }

        try {
            const status = await this.getGitStatus();
            if (!status.hasChanges) {
                this.showNotification('没有需要提交的更改', 'info');
                return;
            }

            this.showCommitDialog(status);
        } catch (error) {
            console.error('提交检查失败:', error);
            this.showNotification('提交检查失败: ' + error.message, 'error');
        }
    }

    createGitStyles() {
        if (document.getElementById('git-enhanced-styles')) return;

        const style = document.createElement('style');
        style.id = 'git-enhanced-styles';
        style.textContent = `
            .git-panel-enhanced {
                background: var(--bg-secondary);
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                border: 1px solid var(--border-color);
            }

            .git-section {
                margin-bottom: 24px;
            }

            .git-section-title {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .git-section-title i {
                color: var(--primary-color);
            }

            .git-status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 16px;
            }

            .git-status-card {
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                padding: 16px;
                text-align: center;
            }

            .git-status-value {
                font-size: 24px;
                font-weight: 700;
                color: var(--primary-color);
                margin-bottom: 4px;
            }

            .git-status-label {
                font-size: 12px;
                color: var(--text-secondary);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .git-branch-info {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--bg-tertiary);
                border-radius: 8px;
                margin-bottom: 16px;
            }

            .git-branch-icon {
                width: 32px;
                height: 32px;
                background: var(--primary-color);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }

            .git-branch-details h4 {
                margin: 0;
                color: var(--text-primary);
                font-size: 14px;
            }

            .git-branch-details p {
                margin: 4px 0 0 0;
                color: var(--text-secondary);
                font-size: 12px;
            }

            .git-file-list {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
                border-radius: 8px;
                margin-bottom: 16px;
            }

            .git-file-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid var(--border-color);
                transition: background-color 0.2s ease;
            }

            .git-file-item:last-child {
                border-bottom: none;
            }

            .git-file-item:hover {
                background: var(--bg-hover);
            }

            .git-file-status {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
                font-size: 10px;
                font-weight: 600;
                color: white;
            }

            .git-file-status.modified { background: #f39c12; }
            .git-file-status.added { background: #27ae60; }
            .git-file-status.deleted { background: #e74c3c; }
            .git-file-status.untracked { background: #9b59b6; }

            .git-file-name {
                flex: 1;
                color: var(--text-primary);
                font-size: 13px;
            }

            .git-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .git-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .git-btn-primary {
                background: var(--primary-color);
                color: white;
            }

            .git-btn-primary:hover {
                background: var(--primary-hover);
                transform: translateY(-1px);
            }

            .git-btn-secondary {
                background: var(--bg-tertiary);
                color: var(--text-primary);
                border: 1px solid var(--border-color);
            }

            .git-btn-secondary:hover {
                background: var(--bg-hover);
            }

            .git-btn-danger {
                background: #e74c3c;
                color: white;
            }

            .git-btn-danger:hover {
                background: #c0392b;
            }

            .git-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none !important;
            }

            .git-input-group {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }

            .git-input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                font-size: 13px;
            }

            .git-input:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.2);
            }

            .git-select {
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                font-size: 13px;
                cursor: pointer;
            }

            .git-loading {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: var(--text-secondary);
                font-size: 13px;
            }

            .git-loading i {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    async setProjectPath(projectPath) {
        this.currentProjectPath = projectPath;
        await this.refreshGitInfo();
    }

    /**
     * 设置当前项目路径
     * @param {string} projectPath - 项目路径
     */
    setCurrentProject(projectPath) {
        this.currentProjectPath = projectPath;
        console.log('Git管理器设置项目路径:', projectPath);
    }

    async refreshGitInfo() {
        if (!this.currentProjectPath) return;

        try {
            // 获取Git状态
            const status = await window.electronAPI.gitStatus(this.currentProjectPath);
            this.gitStatus = status;

            // 获取分支列表
            const branches = await window.electronAPI.gitListBranches(this.currentProjectPath, true);
            this.branches = branches;

            // 获取远程列表
            const remotes = await window.electronAPI.gitListRemotes(this.currentProjectPath);
            this.remotes = remotes;

            // 更新UI
            this.updateGitUI();
        } catch (error) {
            console.error('刷新Git信息失败:', error);
            this.showGitMessage('刷新Git信息失败: ' + error.message, 'error');
        }
    }

    updateGitUI() {
        this.updateGitStatus();
        this.updateBranchInfo();
        this.updateFileList();
        this.updateBranchSelect();
        this.updateRemoteSelect();
    }

    updateGitStatus() {
        const statusGrid = document.getElementById('git-status-grid');
        if (!statusGrid || !this.gitStatus) return;

        const { staged = [], modified = [], untracked = [] } = this.gitStatus;
        
        statusGrid.innerHTML = `
            <div class="git-status-card">
                <div class="git-status-value">${staged.length}</div>
                <div class="git-status-label">已暂存</div>
            </div>
            <div class="git-status-card">
                <div class="git-status-value">${modified.length}</div>
                <div class="git-status-label">已修改</div>
            </div>
            <div class="git-status-card">
                <div class="git-status-value">${untracked.length}</div>
                <div class="git-status-label">未跟踪</div>
            </div>
        `;
    }

    updateBranchInfo() {
        const branchInfo = document.getElementById('git-branch-info');
        if (!branchInfo || !this.gitStatus) return;

        const currentBranch = this.gitStatus.currentBranch || 'unknown';
        const ahead = this.gitStatus.ahead || 0;
        const behind = this.gitStatus.behind || 0;

        branchInfo.innerHTML = `
            <div class="git-branch-icon">
                <i class="fas fa-code-branch"></i>
            </div>
            <div class="git-branch-details">
                <h4>当前分支: ${currentBranch}</h4>
                <p>领先 ${ahead} 个提交, 落后 ${behind} 个提交</p>
            </div>
        `;
    }

    updateFileList() {
        const fileList = document.getElementById('git-file-list');
        if (!fileList || !this.gitStatus) return;

        const { staged = [], modified = [], untracked = [] } = this.gitStatus;
        const allFiles = [
            ...staged.map(f => ({ ...f, status: 'staged' })),
            ...modified.map(f => ({ ...f, status: 'modified' })),
            ...untracked.map(f => ({ ...f, status: 'untracked' }))
        ];

        if (allFiles.length === 0) {
            fileList.innerHTML = '<div class="git-file-item">工作目录干净</div>';
            return;
        }

        fileList.innerHTML = allFiles.map(file => `
            <div class="git-file-item">
                <div class="git-file-status ${file.status}">
                    ${this.getStatusIcon(file.status)}
                </div>
                <div class="git-file-name">${file.path || file}</div>
            </div>
        `).join('');
    }

    getStatusIcon(status) {
        const icons = {
            staged: 'S',
            modified: 'M',
            untracked: 'U',
            added: 'A',
            deleted: 'D'
        };
        return icons[status] || '?';
    }

    updateBranchSelect() {
        const branchSelect = document.getElementById('git-branch-select');
        if (!branchSelect) return;

        const currentBranch = this.gitStatus?.currentBranch || '';
        
        // 确保 branches 是数组
        const branches = Array.isArray(this.branches) ? this.branches : [];
        
        branchSelect.innerHTML = branches.map(branch => 
            `<option value="${branch}" ${branch === currentBranch ? 'selected' : ''}>${branch}</option>`
        ).join('');
    }

    updateRemoteSelect() {
        const remoteSelect = document.getElementById('git-remote-select');
        if (!remoteSelect) return;

        // 确保 remotes 是数组
        const remotes = Array.isArray(this.remotes) ? this.remotes : [];

        remoteSelect.innerHTML = [
            '<option value="">选择远程仓库</option>',
            ...remotes.map(remote => 
                `<option value="${remote.name}">${remote.name} (${remote.url})</option>`
            )
        ].join('');
    }

    async handlePush() {
        if (!this.currentProjectPath) return;

        const remote = document.getElementById('git-remote-select')?.value || 'origin';
        const branch = this.gitStatus?.currentBranch || 'main';

        if (!remote) {
            this.showGitMessage('请选择远程仓库', 'warning');
            return;
        }

        try {
            this.showGitLoading('正在推送...');
            const result = await window.electronAPI.gitPush(this.currentProjectPath, remote, branch);
            
            if (result.success) {
                this.showGitMessage('推送成功', 'success');
                await this.refreshGitInfo();
            } else {
                this.showGitMessage('推送失败: ' + result.error, 'error');
            }
        } catch (error) {
            this.showGitMessage('推送失败: ' + error.message, 'error');
        } finally {
            this.hideGitLoading();
        }
    }

    async handlePull() {
        if (!this.currentProjectPath) return;

        const remote = document.getElementById('git-remote-select')?.value || 'origin';
        const branch = this.gitStatus?.currentBranch || 'main';

        if (!remote) {
            this.showGitMessage('请选择远程仓库', 'warning');
            return;
        }

        try {
            this.showGitLoading('正在拉取...');
            const result = await window.electronAPI.gitPull(this.currentProjectPath, remote, branch);
            
            if (result.success) {
                this.showGitMessage('拉取成功', 'success');
                await this.refreshGitInfo();
            } else {
                this.showGitMessage('拉取失败: ' + result.error, 'error');
            }
        } catch (error) {
            this.showGitMessage('拉取失败: ' + error.message, 'error');
        } finally {
            this.hideGitLoading();
        }
    }

    /**
     * 刷新Git状态
     */
    refreshGitStatus() {
        if (window.appManager) {
            window.appManager.loadGitStatus();
        }
    }

    /**
     * 刷新Git历史
     */
    refreshHistory() {
        if (window.appManager) {
            window.appManager.loadGitHistory();
        }
    }

    // 这些方法已移除，改为只读模式和命令教程
    // 分支操作由用户在终端中手动执行
    // 远程仓库操作由用户在终端中手动执行

    async handleDeleteBranch(branchName) {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (!currentProject) {
            this.showError('请先选择项目');
            return;
        }
        try {
            const response = await window.electronAPI.gitDeleteBranch(currentProject.path, branchName);
            if (response.success) {
                this.showSuccess(`分支 "${branchName}" 删除成功`);
                this.refreshBranches();
            } else {
                this.showError(`删除分支失败: ${response.error}`);
            }
        } catch (error) {
            this.showError(`删除分支失败: ${error.message}`);
        }
    }

    async handlePushBranch() {
        // 这里可根据实际需求实现推送分支逻辑
        this.showNotification('推送分支功能待实现', 'info');
    }

    async handleAddRemote(remoteName, remoteUrl) {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (!currentProject) {
            this.showError('请先选择项目');
            return;
        }
        try {
            const response = await window.electronAPI.gitAddRemote(currentProject.path, remoteName, remoteUrl);
            if (response.success) {
                this.showNotification('远程仓库添加成功', 'success');
                this.updateRemotesList();
            } else {
                this.showError(`添加远程仓库失败: ${response.error}`);
            }
        } catch (error) {
            console.error('添加远程仓库失败:', error);
            this.showError(`添加远程仓库失败: ${error.message}`);
        }
    }

    /**
     * 更新远程仓库列表
     */
    async updateRemotesList() {
        try {
            await this.refreshRemotes();
        } catch (error) {
            console.error('更新远程仓库列表失败:', error);
            this.showError(`更新远程仓库列表失败: ${error.message}`);
        }
    }

    /**
     * 显示成功通知
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    /**
     * 显示错误通知
     */
    showError(message) {
        this.showNotification(message, 'error');
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            padding: 12px 20px;
            border-radius: 4px;
            border-left: 4px solid var(--primary-color);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // 动画显示
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // 持续时间后自动消失
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    /**
     * 刷新分支信息
     */
    async refreshBranches() {
        if (!this.currentProjectPath) {
            this.showError('请先选择项目');
            return;
        }

        try {
            const result = await window.electronAPI.gitListBranches(this.currentProjectPath, true);
            // 确保 result 是数组
            if (result && result.success && Array.isArray(result.branches)) {
                this.branches = result.branches;
            } else if (Array.isArray(result)) {
                this.branches = result;
            } else {
                this.branches = [];
            }
            
            this.updateBranchSelect();
            this.renderBranchesReadOnlyView();
            console.log('分支信息刷新成功:', this.branches);
        } catch (error) {
            console.error('刷新分支信息失败:', error);
            this.branches = []; // 确保是数组
            this.showError(`刷新分支信息失败: ${error.message}`);
        }
    }

    /**
     * 刷新远程仓库信息
     */
    async refreshRemotes() {
        if (!this.currentProjectPath) {
            this.showError('请先选择项目');
            return;
        }

        try {
            const result = await window.electronAPI.gitListRemotes(this.currentProjectPath);
            // 确保 result 是数组
            if (result && result.success && Array.isArray(result.remotes)) {
                this.remotes = result.remotes;
            } else if (Array.isArray(result)) {
                this.remotes = result;
            } else {
                this.remotes = [];
            }
            
            this.updateRemoteSelect();
            this.renderRemotesReadOnlyView();
            console.log('远程仓库信息刷新成功:', this.remotes);
        } catch (error) {
            console.error('刷新远程仓库信息失败:', error);
            this.remotes = []; // 确保是数组
            this.showError(`刷新远程仓库信息失败: ${error.message}`);
        }
    }

    /**
     * 渲染只读的分支视图
     */
    renderBranchesReadOnlyView() {
        const branchesContent = document.getElementById('git-branches-content');
        if (!branchesContent) return;

        const branches = Array.isArray(this.branches) ? this.branches : [];
        const currentBranch = this.gitStatus?.currentBranch || '';

        branchesContent.innerHTML = `
            <div class="git-readonly-section">
                <h4>当前分支</h4>
                <div class="current-branch">
                    <i class="fas fa-code-branch"></i>
                    <span>${currentBranch || '未知'}</span>
                </div>
                
                <h4>所有分支</h4>
                <div class="branches-list">
                    ${branches.map(branch => `
                        <div class="branch-item ${branch === currentBranch ? 'active' : ''}">
                            <i class="fas fa-code-branch"></i>
                            <span>${branch}</span>
                            ${branch === currentBranch ? '<span class="badge">当前</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                
                <div class="git-operations-guide">
                    <h4>分支操作说明</h4>
                    <p>要进行分支操作，请在终端中使用以下命令：</p>
                    <ul>
                        <li><code>git branch &lt;分支名&gt;</code> - 创建新分支</li>
                        <li><code>git checkout &lt;分支名&gt;</code> - 切换分支</li>
                        <li><code>git branch -d &lt;分支名&gt;</code> - 删除分支</li>
                        <li><code>git push origin &lt;分支名&gt;</code> - 推送分支</li>
                    </ul>
                    <button class="btn-secondary" onclick="window.electronAPI.openTerminal('${this.currentProjectPath || ''}')">
                        <i class="fas fa-terminal"></i> 在项目目录打开终端
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 渲染只读的远程仓库视图
     */
    renderRemotesReadOnlyView() {
        const remotesContent = document.getElementById('git-remotes-content');
        if (!remotesContent) return;

        const remotes = Array.isArray(this.remotes) ? this.remotes : [];

        remotesContent.innerHTML = `
            <div class="git-readonly-section">
                <h4>远程仓库列表</h4>
                <div class="remotes-list">
                    ${remotes.length > 0 ? remotes.map(remote => `
                        <div class="remote-item">
                            <div class="remote-name">
                                <i class="fas fa-cloud"></i>
                                <strong>${remote.name}</strong>
                            </div>
                            <div class="remote-url">${remote.url}</div>
                        </div>
                    `).join('') : '<div class="empty-state">暂无远程仓库</div>'}
                </div>
                
                <div class="git-operations-guide">
                    <h4>远程仓库操作说明</h4>
                    <p>要进行远程仓库操作，请在终端中使用以下命令：</p>
                    <ul>
                        <li><code>git remote add &lt;名称&gt; &lt;URL&gt;</code> - 添加远程仓库</li>
                        <li><code>git remote remove &lt;名称&gt;</code> - 删除远程仓库</li>
                        <li><code>git remote rename &lt;旧名称&gt; &lt;新名称&gt;</code> - 重命名远程仓库</li>
                        <li><code>git fetch &lt;远程名称&gt;</code> - 获取远程更新</li>
                    </ul>
                    <button class="btn-secondary" onclick="window.electronAPI.openTerminal('${this.currentProjectPath || ''}')">
                        <i class="fas fa-terminal"></i> 在项目目录打开终端
                    </button>
                </div>
            </div>
        `;
    }

    // 渲染远程仓库列表
    renderRemotesList() {
        const container = document.getElementById('git-remotes-content');
        if (!container) return;

        // 确保 this.remotes 是数组
        if (!Array.isArray(this.remotes)) {
            this.remotes = [];
        }

        if (this.remotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-info-circle"></i>
                    <p>没有配置远程仓库</p>
                    <p class="text-muted">使用 git remote add 命令添加远程仓库</p>
                </div>
            `;
            return;
        }

        const remotesList = this.remotes.map(remote => `
            <div class="remote-item">
                <div class="remote-info">
                    <span class="remote-name">${remote.name || '未知'}</span>
                    <span class="remote-url">${remote.url || '未知'}</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="remotes-list">
                ${remotesList}
            </div>
        `;
    }

    // 分支教程显示
    showBranchTutorial() {
        const tutorial = `
<div class="git-tutorial-content">
    <h3>Git 分支操作命令</h3>
    <div class="git-command-group">
        <h4>查看分支</h4>
        <code>git branch</code> - 查看本地分支<br>
        <code>git branch -r</code> - 查看远程分支<br>
        <code>git branch -a</code> - 查看所有分支<br>
    </div>
    <div class="git-command-group">
        <h4>创建分支</h4>
        <code>git branch &lt;分支名&gt;</code> - 创建新分支<br>
        <code>git checkout -b &lt;分支名&gt;</code> - 创建并切换到新分支<br>
    </div>
    <div class="git-command-group">
        <h4>切换分支</h4>
        <code>git checkout &lt;分支名&gt;</code> - 切换到指定分支<br>
        <code>git switch &lt;分支名&gt;</code> - 切换到指定分支(新语法)<br>
    </div>
    <div class="git-command-group">
        <h4>删除分支</h4>
        <code>git branch -d &lt;分支名&gt;</code> - 删除已合并的分支<br>
        <code>git branch -D &lt;分支名&gt;</code> - 强制删除分支<br>
    </div>
    <div class="git-command-group">
        <h4>推送分支</h4>
        <code>git push origin &lt;分支名&gt;</code> - 推送分支到远程<br>
        <code>git push --set-upstream origin &lt;分支名&gt;</code> - 推送并设置上游分支<br>
    </div>
</div>
        `;
        this.showNotification(tutorial, 'info', 0);
    }

    // 远程教程显示
    showRemoteTutorial() {
        const tutorial = `
<div class="git-tutorial-content">
    <h3>Git 远程仓库操作命令</h3>
    <div class="git-command-group">
        <h4>查看远程仓库</h4>
        <code>git remote</code> - 查看远程仓库名称<br>
        <code>git remote -v</code> - 查看远程仓库详细信息<br>
        <code>git remote show &lt;远程名&gt;</code> - 查看远程仓库详情<br>
    </div>
    <div class="git-command-group">
        <h4>添加远程仓库</h4>
        <code>git remote add &lt;远程名&gt; &lt;URL&gt;</code> - 添加远程仓库<br>
        <code>git remote add origin https://github.com/user/repo.git</code> - 添加origin远程仓库<br>
    </div>
    <div class="git-command-group">
        <h4>删除/重命名远程仓库</h4>
        <code>git remote remove &lt;远程名&gt;</code> - 删除远程仓库<br>
        <code>git remote rename &lt;旧名&gt; &lt;新名&gt;</code> - 重命名远程仓库<br>
    </div>
    <div class="git-command-group">
        <h4>获取远程分支</h4>
        <code>git fetch &lt;远程名&gt;</code> - 获取远程分支<br>
        <code>git fetch --all</code> - 获取所有远程分支<br>
    </div>
    <div class="git-command-group">
        <h4>推送拉取</h4>
        <code>git push &lt;远程名&gt; &lt;分支名&gt;</code> - 推送到远程<br>
        <code>git pull &lt;远程名&gt; &lt;分支名&gt;</code> - 从远程拉取<br>
    </div>
</div>
        `;
        this.showNotification(tutorial, 'info', 0);
    }

    // 打开终端 - 分支相关
    openTerminalForBranches() {
        if (!this.currentProjectPath) {
            this.showNotification('请先选择一个项目', 'error');
            return;
        }
        if (window.electronAPI && window.electronAPI.openTerminal) {
            let shellCmd = '';
            if (window.platform === 'win32') {
                shellCmd = 'powershell.exe';
            } else if (window.platform === 'darwin') {
                shellCmd = 'bash';
            } else {
                shellCmd = 'bash';
            }
            window.electronAPI.openTerminal(shellCmd, this.currentProjectPath);
            this.showNotification('已打开终端，当前目录：' + this.currentProjectPath, 'success');
        } else {
            this.showNotification('终端功能暂时不可用', 'error');
        }
    }

    // 打开终端 - 远程相关
    openTerminalForRemotes() {
        if (!this.currentProjectPath) {
            this.showNotification('请先选择一个项目', 'error');
            return;
        }
        if (window.electronAPI && window.electronAPI.openTerminal) {
            let shellCmd = '';
            if (window.platform === 'win32') {
                shellCmd = 'powershell.exe';
            } else if (window.platform === 'darwin') {
                shellCmd = 'bash';
            } else {
                shellCmd = 'bash';
            }
            window.electronAPI.openTerminal(shellCmd, this.currentProjectPath);
            this.showNotification('已打开终端，当前目录：' + this.currentProjectPath, 'success');
        } else {
            this.showNotification('终端功能暂时不可用', 'error');
        }
    }

    /**
     * 获取Git状态
     * @returns {Promise<Object>} Git状态对象
     */
    async getGitStatus() {
        if (!this.currentProjectPath) {
            throw new Error('没有设置项目路径');
        }

        try {
            const result = await window.electronAPI.gitStatus(this.currentProjectPath);
            if (result.success) {
                const status = result.status;
                return {
                    hasChanges: status.files && status.files.length > 0,
                    files: status.files || [],
                    staged: status.staged || [],
                    unstaged: status.unstaged || [],
                    untracked: status.untracked || []
                };
            } else {
                throw new Error(result.error || 'Git状态检查失败');
            }
        } catch (error) {
            console.error('获取Git状态失败:', error);
            throw error;
        }
    }

    /**
     * 显示提交对话框
     */
    showCommitDialog(status) {
        // 创建提交对话框

    }

    /**
     * 执行提交
     */
    async executeCommit() {
        const messageInput = document.getElementById('commit-message');
        const commitAllCheckbox = document.getElementById('commit-all');
        
        if (!messageInput) return;

        const message = messageInput.value.trim();
        if (!message) {
            this.showNotification('请输入提交消息', 'error');
            return;
        }

        const commitAll = commitAllCheckbox && commitAllCheckbox.checked;

        try {
            // 如果选择了提交所有更改，先执行 git add
            if (commitAll) {
                await window.electronAPI.gitAdd(this.currentProjectPath, '.');
            }

            // 执行提交
            const result = await window.electronAPI.gitCommit(this.currentProjectPath, message);
            
            if (result.success) {
                this.showNotification('提交成功', 'success');
                // 关闭对话框
                const dialog = document.querySelector('.commit-dialog-overlay');
                if (dialog) {
                    dialog.remove();
                }
                // 刷新Git信息
                await this.refreshGitInfo();
            } else {
                this.showNotification('提交失败: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('提交失败:', error);
            this.showNotification('提交失败: ' + error.message, 'error');
        }
    }
}

// 创建全局Git增强管理器实例
window.gitEnhancedManager = new GitEnhancedManager();
window.gitManager = window.gitEnhancedManager; // 保持向后兼容
