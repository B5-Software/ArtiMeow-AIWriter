/**
 * Git 集成模块
 * 处理版本控制和多设备协作功能
 */

class GitManager {
    constructor() {
        this.isInitialized = false;
        this.currentBranch = 'main';
        this.remoteUrl = '';
        this.status = null;
        
        this.init();
    }

    /**
     * 初始化 Git 管理器
     */
    async init() {
        try {
            console.log('Git Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Git Manager:', error);
        }
    }

    /**
     * 初始化 Git 仓库
     * @param {string} projectPath - 项目路径
     * @returns {Promise<boolean>} 初始化结果
     */
    async initRepository(projectPath) {
        try {
            const response = await window.electronAPI.gitInit(projectPath);
            
            if (response.success) {
                this.isInitialized = true;
                this.updateGitStatus();
                
                if (window.appManager) {
                    window.appManager.showNotification('Git 仓库初始化成功', 'success');
                }
                
                return true;
            } else {
                throw new Error(response.error || 'Git 初始化失败');
            }
        } catch (error) {
            console.error('Git init error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`Git 初始化失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 获取 Git 状态
     * @param {string} projectPath - 项目路径
     * @returns {Promise<Object>} Git 状态
     */
    async getStatus(projectPath) {
        try {
            const response = await window.electronAPI.gitStatus(projectPath);
            
            if (response.success) {
                this.status = response.status;
                this.currentBranch = response.status.current || 'main';
                this.isInitialized = response.status.isRepository;
                
                this.updateGitStatusUI();
                return response.status;
            } else {
                throw new Error(response.error || '获取 Git 状态失败');
            }
        } catch (error) {
            console.error('Git status error:', error);
            return null;
        }
    }

    /**
     * 添加文件到暂存区
     * @param {string} projectPath - 项目路径
     * @param {string|Array} files - 文件路径或文件列表
     * @returns {Promise<boolean>} 添加结果
     */
    async addFiles(projectPath, files = '.') {
        try {
            const response = await window.electronAPI.gitAdd(projectPath, files);
            
            if (response.success) {
                await this.getStatus(projectPath);
                
                if (window.appManager) {
                    window.appManager.showNotification('文件已添加到暂存区', 'success');
                }
                
                return true;
            } else {
                throw new Error(response.error || '添加文件失败');
            }
        } catch (error) {
            console.error('Git add error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`添加文件失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 提交更改
     * @param {string} projectPath - 项目路径
     * @param {string} message - 提交信息
     * @returns {Promise<boolean>} 提交结果
     */
    async commit(projectPath, message) {
        try {
            if (!message || !message.trim()) {
                throw new Error('提交信息不能为空');
            }

            const response = await window.electronAPI.gitCommit(projectPath, message);
            
            if (response.success) {
                await this.getStatus(projectPath);
                
                if (window.appManager) {
                    window.appManager.showNotification('提交成功', 'success');
                }
                
                return true;
            } else {
                throw new Error(response.error || '提交失败');
            }
        } catch (error) {
            console.error('Git commit error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`提交失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 推送到远程仓库
     * @param {string} projectPath - 项目路径
     * @param {string} remote - 远程仓库名
     * @param {string} branch - 分支名
     * @returns {Promise<boolean>} 推送结果
     */
    async push(projectPath, remote = 'origin', branch = null) {
        try {
            const targetBranch = branch || this.currentBranch;
            const response = await window.electronAPI.gitPush(projectPath, remote, targetBranch);
            
            if (response.success) {
                await this.getStatus(projectPath);
                
                if (window.appManager) {
                    window.appManager.showNotification('推送成功', 'success');
                }
                
                return true;
            } else {
                throw new Error(response.error || '推送失败');
            }
        } catch (error) {
            console.error('Git push error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`推送失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 从远程仓库拉取
     * @param {string} projectPath - 项目路径
     * @param {string} remote - 远程仓库名
     * @param {string} branch - 分支名
     * @returns {Promise<boolean>} 拉取结果
     */
    async pull(projectPath, remote = 'origin', branch = null) {
        try {
            const targetBranch = branch || this.currentBranch;
            const response = await window.electronAPI.gitPull(projectPath, remote, targetBranch);
            
            if (response.success) {
                await this.getStatus(projectPath);
                
                // 如果有更新，重新加载项目内容
                if (response.hasChanges && window.projectManager) {
                    await window.projectManager.openProject(projectPath);
                }
                
                if (window.appManager) {
                    window.appManager.showNotification('拉取成功', 'success');
                }
                
                return true;
            } else {
                throw new Error(response.error || '拉取失败');
            }
        } catch (error) {
            console.error('Git pull error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`拉取失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     */
    showError(message) {
        if (window.appManager) {
            window.appManager.showError(message);
        } else {
            console.error(message);
        }
    }

    /**
     * 显示成功消息
     * @param {string} message - 成功消息
     */
    showSuccess(message) {
        if (window.appManager) {
            window.appManager.showSuccess(message);
        } else {
            console.log(message);
        }
    }

    /**
     * 获取所有分支
     * @param {string} projectPath - 项目路径
     * @param {boolean} includeRemote - 是否包含远程分支
     * @returns {Promise<Array>} 分支列表
     */
    async getBranches(projectPath, includeRemote = true) {
        try {
            const response = await window.electronAPI.gitListBranches(projectPath, includeRemote);
            
            if (response.success) {
                return response.branches || [];
            } else {
                throw new Error(response.error || '获取分支失败');
            }
        } catch (error) {
            console.error('Get branches error:', error);
            return [];
        }
    }

    /**
     * 创建新分支
     * @param {string} projectPath - 项目路径
     * @param {string} branchName - 分支名称
     * @param {boolean} checkout - 是否切换到新分支
     * @returns {Promise<boolean>} 创建结果
     */
    async createBranch(projectPath, branchName, checkout = true) {
        try {
            const response = await window.electronAPI.gitCreateBranch(projectPath, branchName);
            
            if (response.success) {
                if (checkout) {
                    await this.checkoutBranch(projectPath, branchName);
                }
                
                this.showSuccess(`分支 "${branchName}" 创建成功`);
                return true;
            } else {
                throw new Error(response.error || '创建分支失败');
            }
        } catch (error) {
            console.error('Create branch error:', error);
            this.showError('创建分支失败: ' + error.message);
            return false;
        }
    }

    /**
     * 切换分支
     * @param {string} projectPath - 项目路径
     * @param {string} branchName - 分支名称
     * @returns {Promise<boolean>} 切换结果
     */
    async checkoutBranch(projectPath, branchName) {
        try {
            const response = await window.electronAPI.gitCheckout(projectPath, branchName);
            
            if (response.success) {
                this.currentBranch = branchName;
                this.showSuccess(`已切换到分支 "${branchName}"`);
                this.updateGitStatus();
                return true;
            } else {
                throw new Error(response.error || '切换分支失败');
            }
        } catch (error) {
            console.error('Checkout branch error:', error);
            this.showError('切换分支失败: ' + error.message);
            return false;
        }
    }

    /**
     * 获取所有远程仓库
     * @param {string} projectPath - 项目路径
     * @returns {Promise<Array>} 远程仓库列表
     */
    async getRemotes(projectPath) {
        try {
            const response = await window.electronAPI.gitListRemotes(projectPath);
            
            if (response.success) {
                return response.remotes || [];
            } else {
                throw new Error(response.error || '获取远程仓库失败');
            }
        } catch (error) {
            console.error('Get remotes error:', error);
            return [];
        }
    }

    /**
     * 删除远程仓库
     * @param {string} projectPath - 项目路径
     * @param {string} remoteName - 远程仓库名称
     * @returns {Promise<boolean>} 删除结果
     */
    async removeRemote(projectPath, remoteName) {
        try {
            const response = await window.electronAPI.gitRemoveRemote(projectPath, remoteName);
            
            if (response.success) {
                this.showSuccess(`远程仓库 "${remoteName}" 删除成功`);
                return true;
            } else {
                throw new Error(response.error || '删除远程仓库失败');
            }
        } catch (error) {
            console.error('Remove remote error:', error);
            this.showError('删除远程仓库失败: ' + error.message);
            return false;
        }
    }

    /**
     * 渲染分支列表
     * @param {string} projectPath - 项目路径
     */
    async renderBranchesList(projectPath) {
        const branchesContent = document.getElementById('git-branches-content');
        if (!branchesContent) return;

        try {
            branchesContent.innerHTML = '<p>加载中...</p>';
            
            const branches = await this.getBranches(projectPath);
            const currentBranch = await window.electronAPI.gitCurrentBranch(projectPath);
            
            if (branches.length === 0) {
                branchesContent.innerHTML = '<p class="empty-state">没有分支</p>';
                return;
            }

            const branchesHTML = branches.map(branch => {
                const isCurrent = branch.name === currentBranch.branch;
                const isRemote = branch.type === 'remote';
                
                return `
                    <div class="git-item branch-item ${isCurrent ? 'current' : ''}" data-branch="${branch.name}" data-type="${branch.type}">
                        <div class="git-item-info">
                            <i class="fas ${isRemote ? 'fa-cloud' : 'fa-code-branch'}"></i>
                            <span class="git-item-name">${branch.name}</span>
                            ${isCurrent ? '<span class="current-badge">当前</span>' : ''}
                        </div>
                        <div class="git-item-actions">
                            ${!isCurrent && !isRemote ? `
                                <button class="btn-icon" onclick="gitManager.checkoutBranch('${projectPath}', '${branch.name}')" title="切换到此分支">
                                    <i class="fas fa-arrow-right"></i>
                                </button>
                            ` : ''}
                            ${!isCurrent && !isRemote ? `
                                <button class="btn-icon btn-danger" onclick="gitManager.deleteBranch('${projectPath}', '${branch.name}')" title="删除分支">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            branchesContent.innerHTML = branchesHTML;
        } catch (error) {
            console.error('Render branches error:', error);
            branchesContent.innerHTML = '<p class="error-state">加载分支失败</p>';
        }
    }

    /**
     * 渲染远程仓库列表
     * @param {string} projectPath - 项目路径
     */
    async renderRemotesList(projectPath) {
        const remotesContent = document.getElementById('git-remotes-content');
        if (!remotesContent) return;

        try {
            remotesContent.innerHTML = '<p>加载中...</p>';
            
            const remotes = await this.getRemotes(projectPath);
            
            if (remotes.length === 0) {
                remotesContent.innerHTML = '<p class="empty-state">没有远程仓库</p>';
                return;
            }

            const remotesHTML = remotes.map(remote => `
                <div class="git-item remote-item" data-remote="${remote.name}">
                    <div class="git-item-info">
                        <i class="fas fa-server"></i>
                        <div class="git-item-details">
                            <span class="git-item-name">${remote.name}</span>
                            <span class="git-item-url">${remote.url}</span>
                        </div>
                    </div>
                    <div class="git-item-actions">
                        <button class="btn-icon" onclick="gitManager.fetchRemote('${projectPath}', '${remote.name}')" title="拉取">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-icon btn-danger" onclick="gitManager.deleteRemote('${projectPath}', '${remote.name}')" title="删除远程仓库">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            remotesContent.innerHTML = remotesHTML;
        } catch (error) {
            console.error('Render remotes error:', error);
            remotesContent.innerHTML = '<p class="error-state">加载远程仓库失败</p>';
        }
    }

    /**
     * 删除分支
     * @param {string} projectPath - 项目路径
     * @param {string} branchName - 分支名称
     */
    async deleteBranch(projectPath, branchName) {
        if (!confirm(`确定要删除分支 "${branchName}" 吗？`)) {
            return;
        }

        try {
            const result = await window.electronAPI.gitDeleteBranch(projectPath, branchName);
            
            if (result.success) {
                this.showSuccess(`分支 "${branchName}" 删除成功`);
                this.renderBranchesList(projectPath);
            } else {
                this.showError('删除分支失败: ' + result.error);
            }
        } catch (error) {
            console.error('Delete branch error:', error);
            this.showError('删除分支失败: ' + error.message);
        }
    }

    /**
     * 删除远程仓库
     * @param {string} projectPath - 项目路径
     * @param {string} remoteName - 远程仓库名称
     */
    async deleteRemote(projectPath, remoteName) {
        if (!confirm(`确定要删除远程仓库 "${remoteName}" 吗？`)) {
            return;
        }

        const success = await this.removeRemote(projectPath, remoteName);
        if (success) {
            this.renderRemotesList(projectPath);
        }
    }

    /**
     * 拉取远程仓库
     * @param {string} projectPath - 项目路径
     * @param {string} remoteName - 远程仓库名称
     */
    async fetchRemote(projectPath, remoteName) {
        try {
            const response = await window.electronAPI.gitFetch(projectPath, remoteName);
            
            if (response.success) {
                this.showSuccess(`从 "${remoteName}" 拉取成功`);
            } else {
                throw new Error(response.error || '拉取失败');
            }
        } catch (error) {
            console.error('Fetch remote error:', error);
            this.showError('拉取失败: ' + error.message);
        }
    }

    /**
     * 更新 Git 状态显示
     * @param {string} status - 状态: 'connected', 'disconnected', 'syncing', 'error'
     * @param {string} message - 状态消息
     */
    updateGitStatus(status = 'disconnected', message = '') {
        const statusElement = document.getElementById('git-status');
        if (!statusElement) return;

        let icon = '';
        let className = 'git-status';
        let text = '';

        switch (status) {
            case 'connected':
                icon = 'fas fa-code-branch';
                className += ' connected';
                text = message || `已连接 (${this.currentBranch})`;
                break;
            case 'syncing':
                icon = 'fas fa-spinner fa-spin';
                className += ' syncing';
                text = message || '同步中...';
                break;
            case 'changes':
                icon = 'fas fa-edit';
                className += ' changes';
                text = message;
                break;
            case 'clean':
                icon = 'fas fa-check';
                className += ' clean';
                text = message || `${this.currentBranch} (干净)`;
                break;
            case 'error':
                icon = 'fas fa-exclamation-triangle';
                className += ' error';
                text = message || '错误';
                break;
            case 'not-repo':
                icon = 'fas fa-folder';
                className += ' not-repo';
                text = '非 Git 项目';
                break;
            default:
                icon = 'fas fa-code-branch';
                className += ' disconnected';
                text = '未初始化';
        }

        statusElement.className = className;
        statusElement.innerHTML = `<i class="${icon}"></i> ${text}`;
    }

    /**
     * 更新 Git 状态 UI
     */
    updateGitStatusUI() {
        if (!this.isInitialized) {
            this.updateGitStatus('not-repo', '非 Git 项目');
            return;
        }

        if (this.status && this.status.files && this.status.files.length > 0) {
            const changeCount = this.status.files.length;
            const changeText = changeCount === 1 ? '1 个更改' : `${changeCount} 个更改`;
            this.updateGitStatus('changes', `${this.currentBranch} (${changeText})`);
        } else {
            this.updateGitStatus('clean', `${this.currentBranch} (干净)`);
        }
    }

    /**
     * 更新 Git 面板
     */
    updateGitPanel() {
        const gitPanelElement = document.getElementById('git-panel-content');
        if (!gitPanelElement) return;

        if (!this.isInitialized) {
            gitPanelElement.innerHTML = `
                <div class="git-empty-state">
                    <i class="fas fa-git-alt"></i>
                    <h3>Git 未初始化</h3>
                    <p>初始化 Git 仓库以开始版本控制</p>
                    <button class="btn btn-primary" onclick="gitManager.initCurrentProject()">
                        <i class="fas fa-plus"></i> 初始化 Git
                    </button>
                </div>
            `;
            return;
        }

        let content = `
            <div class="git-controls">
                <div class="git-branch-info">
                    <i class="fas fa-code-branch"></i>
                    <span>当前分支: ${this.currentBranch}</span>
                </div>
                
                <div class="git-actions">
                    <button class="btn btn-sm btn-success" onclick="gitManager.quickCommit()">
                        <i class="fas fa-check"></i> 快速提交
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="gitManager.pushCurrent()">
                        <i class="fas fa-upload"></i> 推送
                    </button>
                    <button class="btn btn-sm btn-info" onclick="gitManager.pullCurrent()">
                        <i class="fas fa-download"></i> 拉取
                    </button>
                </div>
            </div>
        `;

        if (this.status) {
            content += '<div class="git-file-changes">';
            
            // 显示暂存的文件
            if (this.status.staged && this.status.staged.length > 0) {
                content += `
                    <div class="file-group">
                        <h4>已暂存的更改</h4>
                        ${this.status.staged.map(file => `
                            <div class="file-item staged">
                                <i class="fas fa-plus-circle"></i>
                                <span>${file}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            // 显示修改的文件
            if (this.status.modified && this.status.modified.length > 0) {
                content += `
                    <div class="file-group">
                        <h4>未暂存的更改</h4>
                        ${this.status.modified.map(file => `
                            <div class="file-item modified">
                                <i class="fas fa-edit"></i>
                                <span>${file}</span>
                                <button class="btn btn-xs btn-primary" onclick="gitManager.stageFile('${file}')">
                                    暂存
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            // 显示未跟踪的文件
            if (this.status.untracked && this.status.untracked.length > 0) {
                content += `
                    <div class="file-group">
                        <h4>未跟踪的文件</h4>
                        ${this.status.untracked.map(file => `
                            <div class="file-item untracked">
                                <i class="fas fa-question-circle"></i>
                                <span>${file}</span>
                                <button class="btn btn-xs btn-primary" onclick="gitManager.stageFile('${file}')">
                                    添加
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            content += '</div>';
        }

        gitPanelElement.innerHTML = content;
    }

    /**
     * 更新当前项目的 Git 状态
     */
    async updateGitStatus() {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (currentProject) {
            await this.getStatus(currentProject.path);
        }
    }

    /**
     * 初始化当前项目的 Git
     */
    async initCurrentProject() {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (currentProject) {
            await this.initRepository(currentProject.path);
        } else {
            if (window.appManager) {
                window.appManager.showNotification('请先打开一个项目', 'warning');
            }
        }
    }

    /**
     * 暂存文件
     * @param {string} file - 文件路径
     */
    async stageFile(file) {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (currentProject) {
            await this.addFiles(currentProject.path, file);
        }
    }

    /**
     * 快速提交
     */
    async quickCommit() {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (!currentProject) {
            if (window.appManager) {
                window.appManager.showNotification('请先打开一个项目', 'warning');
            }
            return;
        }

        const message = prompt('请输入提交信息:', `更新小说内容 - ${new Date().toLocaleString('zh-CN')}`);
        if (message) {
            await this.addFiles(currentProject.path, '.');
            await this.commit(currentProject.path, message);
        }
    }

    /**
     * 推送当前分支
     */
    async pushCurrent() {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (currentProject) {
            await this.push(currentProject.path);
        }
    }

    /**
     * 拉取当前分支
     */
    async pullCurrent() {
        const currentProject = window.projectManager ? window.projectManager.getCurrentProject() : null;
        if (currentProject) {
            await this.pull(currentProject.path);
        }
    }
}

// 导出到全局
window.gitManager = new GitManager();
