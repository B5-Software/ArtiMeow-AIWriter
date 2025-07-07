/**
 * 项目管理模块
 * 处理小说项目的创建、打开、保存等操作
 */

class ProjectManager {
    constructor() {
        this.currentProject = null;
        this.projectList = [];
        this.autoSaveTimer = null;
        this.autoSaveInterval = 30000; // 30秒自动保存
        
        this.init();
    }

    /**
     * 初始化项目管理器
     */
    async init() {
        try {
            // 加载项目列表
            await this.loadProjectList();
            
            // 启动自动保存
            this.startAutoSave();
            
            console.log('Project Manager initialized');
        } catch (error) {
            console.error('Failed to initialize Project Manager:', error);
        }
    }

    /**
     * 加载项目列表
     */
    async loadProjectList() {
        try {
            const response = await window.electronAPI.getProjectList();
            console.log('从主进程获取的项目列表响应:', response);
            if (response.success) {
                this.projectList = response.projects || [];
                console.log('加载的项目列表:', this.projectList);
                this.projectList.forEach((project, index) => {
                    console.log(`项目 ${index + 1}:`, {
                        title: project.metadata?.title,
                        path: project.path,
                        pathType: typeof project.path,
                        pathLength: project.path ? project.path.length : 0
                    });
                });
                this.updateProjectListUI();
            } else {
                console.error('获取项目列表失败:', response.error);
            }
        } catch (error) {
            console.error('Failed to load project list:', error);
        }
    }

    /**
     * 创建新项目
     * @param {Object} projectData - 项目数据
     * @returns {Promise<Object>} 创建结果
     */
    async createProject(projectData) {
        try {
            const response = await window.electronAPI.createProject(projectData);
            
            if (response.success) {
                this.currentProject = response.project;
                this.projectList.push(response.project);
                this.updateProjectListUI();
                this.updateCurrentProjectUI();
                
                // 显示成功消息
                if (window.appManager) {
                    window.appManager.showNotification('项目创建成功', 'success');
                }
                
                return response;
            } else {
                throw new Error(response.error || '创建项目失败');
            }
        } catch (error) {
            console.error('Create project error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`创建项目失败: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    /**
     * 打开项目
     * @param {string} projectPath - 项目路径
     * @returns {Promise<Object>} 打开结果
     */
    async openProject(projectPath) {
        try {
            console.log('尝试打开项目:', projectPath);
            console.log('项目路径类型:', typeof projectPath);
            
            // 验证项目路径
            if (!projectPath || typeof projectPath !== 'string') {
                throw new Error('项目路径无效');
            }
            
            // 保存当前项目
            if (this.currentProject) {
                await this.saveCurrentProject();
            }

            const response = await window.electronAPI.openProject(projectPath);
            console.log('项目打开响应:', response);
            
            if (response.success && response.project) {
                this.currentProject = response.project;
                
                // 确保 metadata 对象存在
                if (!this.currentProject.metadata) {
                    this.currentProject.metadata = {};
                }
                
                // 确保其他必要的属性存在
                if (!this.currentProject.chapters) {
                    this.currentProject.chapters = [];
                }
                
                if (!this.currentProject.settings) {
                    this.currentProject.settings = {};
                }
                
                this.updateCurrentProjectUI();
                
                // 加载项目内容到编辑器
                if (window.editorManager && response.project.content) {
                    window.editorManager.setContent(response.project.content);
                }
                
                // 显示成功消息
                if (window.appManager) {
                    window.appManager.showNotification('项目打开成功', 'success');
                }
                
                return response;
            } else {
                throw new Error(response.error || '打开项目失败');
            }
        } catch (error) {
            console.error('Open project error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`打开项目失败: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    /**
     * 保存当前项目
     */
    async saveCurrentProject() {
        if (!this.currentProject) {
            console.log('No current project to save');
            return;
        }

        try {
            // 获取编辑器内容
            const editorTextarea = document.getElementById('editor-textarea');
            const content = editorTextarea ? editorTextarea.value : '';
            
            // 确保 metadata 对象存在
            if (!this.currentProject.metadata) {
                this.currentProject.metadata = {};
            }
            
            const response = await window.electronAPI.saveProject({
                path: this.currentProject.path,
                content: content,
                metadata: {
                    ...this.currentProject.metadata,
                    lastModified: new Date().toISOString(),
                    wordCount: content.length
                }
            });

            if (response.success) {
                // 确保 metadata 对象存在
                if (!this.currentProject.metadata) {
                    this.currentProject.metadata = {};
                }
                this.currentProject.metadata.lastModified = new Date().toISOString();
                this.currentProject.metadata.wordCount = content.length;
                
                // 更新 UI
                this.updateCurrentProjectUI();
                
                // 标记为已保存
                if (window.appManager && window.appManager.markSaved) {
                    window.appManager.markSaved();
                }
                
                console.log('Project saved successfully');
                return response;
            } else {
                throw new Error(response.error || '保存项目失败');
            }
        } catch (error) {
            console.error('Save project error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`保存项目失败: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    /**
     * 删除项目
     * @param {string} projectPath - 项目路径
     * @returns {Promise<boolean>} 删除结果
     */
    async deleteProject(projectPath) {
        try {
            const response = await window.electronAPI.deleteProject(projectPath);
            
            if (response.success) {
                // 从列表中移除
                this.projectList = this.projectList.filter(p => p.path !== projectPath);
                this.updateProjectListUI();
                
                // 如果删除的是当前项目
                if (this.currentProject && this.currentProject.path === projectPath) {
                    this.currentProject = null;
                    this.updateCurrentProjectUI();
                    
                    if (window.editorManager) {
                        window.editorManager.clear();
                    }
                }
                
                if (window.appManager) {
                    window.appManager.showNotification('项目删除成功', 'success');
                }
                
                return true;
            } else {
                throw new Error(response.error || '删除项目失败');
            }
        } catch (error) {
            console.error('Delete project error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`删除项目失败: ${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 导出项目
     * @param {string} projectPath - 项目路径（可选，默认为当前项目）
     * @param {string} format - 导出格式 (txt, docx, pdf)
     * @returns {Promise<string>} 导出文件路径
     */
    async exportProject(projectPath = null, format = 'txt') {
        const targetPath = projectPath || (this.currentProject ? this.currentProject.path : null);
        
        if (!targetPath) {
            throw new Error('没有指定项目路径或当前项目');
        }

        try {
            // 使用app.js中的导出整本书功能
            if (window.appManager) {
                await window.appManager.exportProject(targetPath);
                return true;
            } else {
                throw new Error('应用管理器不可用');
            }
        } catch (error) {
            console.error('Export project error:', error);
            if (window.appManager) {
                window.appManager.showNotification(`导出失败: ${error.message}`, 'error');
            }
            throw error;
        }
    }

    /**
     * 获取项目统计信息
     * @returns {Object} 统计信息
     */
    getProjectStats() {
        if (!this.currentProject) {
            return null;
        }

        const editorTextarea = document.getElementById('editor-textarea');
        const content = editorTextarea ? editorTextarea.value : '';
        const words = content.trim().split(/\s+/).filter(word => word.length > 0);
        const characters = content.length;
        const charactersNoSpaces = content.replace(/\s/g, '').length;
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const chapters = content.match(/第[一二三四五六七八九十百千万\d]+章|Chapter\s*\d+|第\d+章/gi) || [];

        return {
            words: words.length,
            characters: characters,
            charactersNoSpaces: charactersNoSpaces,
            paragraphs: paragraphs.length,
            chapters: chapters.length,
            lastModified: this.currentProject.metadata.lastModified,
            created: this.currentProject.metadata.created
        };
    }

    /**
     * 更新项目列表 UI
     */
    updateProjectListUI() {
        // 尝试多个可能的项目列表容器
        const projectListElement = document.getElementById('project-list') || 
                                   document.getElementById('recent-projects');
        
        if (!projectListElement) {
            console.warn('项目列表容器不存在');
            return;
        }

        console.log('找到项目列表容器:', projectListElement.id);
        projectListElement.innerHTML = '';

        this.projectList.forEach((project, index) => {
            console.log(`渲染项目 ${index + 1}:`, {
                title: project.metadata?.title,
                path: project.path,
                pathType: typeof project.path,
                pathLength: project.path ? project.path.length : 0,
                fullProject: project
            });
            
            // 检查项目数据的完整性
            if (!project.path) {
                console.warn(`项目 ${index + 1} 缺少路径信息:`, project);
                return; // 跳过这个项目
            }
            
            if (!project.metadata?.title) {
                console.warn(`项目 ${index + 1} 缺少标题信息:`, project);
                return; // 跳过这个项目
            }
            
            const projectElement = document.createElement('div');
            projectElement.className = 'project-item';
            
            // 添加项目路径到 dataset 中，供右键菜单使用
            projectElement.dataset.projectPath = project.path;
            projectElement.dataset.projectName = project.metadata.title;
            
            console.log(`设置项目 ${index + 1} 元素 dataset:`, {
                projectPath: projectElement.dataset.projectPath,
                projectName: projectElement.dataset.projectName
            });
            
            projectElement.innerHTML = `
                <div class="project-info">
                    <h3>${project.metadata.title}</h3>
                    <p class="project-description">${project.metadata.description || '暂无描述'}</p>
                    <div class="project-meta">
                        <span class="project-date">${this.formatDate(project.metadata.lastModified)}</span>
                        <span class="project-words">${project.metadata.wordCount || 0} 字</span>
                    </div>
                </div>
                <div class="project-actions">
                    <button class="btn btn-primary" onclick="projectManager.openProject('${project.path}')">
                        <i class="fas fa-folder-open"></i> 打开
                    </button>
                    <button class="btn btn-danger" onclick="projectManager.confirmDeleteProject('${project.path}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            `;
            
            projectListElement.appendChild(projectElement);
        });

        // 如果没有项目，显示空状态
        if (this.projectList.length === 0) {
            projectListElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open"></i>
                    <h3>暂无项目</h3>
                    <p>创建您的第一个小说项目开始写作吧！</p>
                </div>
            `;
        }
        
        // 重新绑定右键菜单
        if (window.contextMenuManager) {
            setTimeout(() => {
                window.contextMenuManager.rebindProjectContextMenu();
            }, 100);
        }
    }

    /**
     * 更新当前项目 UI
     */
    updateCurrentProjectUI() {
        const projectTitleElement = document.getElementById('current-project-title');
        const projectStatsElement = document.getElementById('project-stats');
        const editorTitleElement = document.getElementById('editor-title');

        if (this.currentProject) {
            if (projectTitleElement) {
                projectTitleElement.textContent = this.currentProject.metadata.title;
            }

            if (editorTitleElement) {
                editorTitleElement.textContent = this.currentProject.metadata.title;
            }

            // 更新统计信息
            if (projectStatsElement) {
                const stats = this.getProjectStats();
                if (stats) {
                    projectStatsElement.innerHTML = `
                        <div class="stat-item">
                            <span class="stat-label">字数</span>
                            <span class="stat-value">${stats.words}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">字符</span>
                            <span class="stat-value">${stats.characters}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">段落</span>
                            <span class="stat-value">${stats.paragraphs}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">章节</span>
                            <span class="stat-value">${stats.chapters}</span>
                        </div>
                    `;
                }
            }
        } else {
            if (projectTitleElement) {
                projectTitleElement.textContent = '未打开项目';
            }

            if (editorTitleElement) {
                editorTitleElement.textContent = 'ArtiMeow AI Writer';
            }

            if (projectStatsElement) {
                projectStatsElement.innerHTML = '';
            }
        }
    }

    /**
     * 确认删除项目
     * @param {string} projectPath - 项目路径
     */
    confirmDeleteProject(projectPath) {
        const project = this.projectList.find(p => p.path === projectPath);
        if (!project) return;

        if (confirm(`确定要删除项目 "${project.metadata.title}" 吗？此操作不可撤销。`)) {
            this.deleteProject(projectPath);
        }
    }

    /**
     * 启动自动保存
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            if (this.currentProject) {
                this.saveCurrentProject();
            }
        }, this.autoSaveInterval);
    }

    /**
     * 停止自动保存
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * 格式化日期
     * @param {string} dateString - 日期字符串
     * @returns {string} 格式化后的日期
     */
    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        // 如果是今天
        if (diff < 24 * 60 * 60 * 1000 && now.toDateString() === date.toDateString()) {
            return `今天 ${date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}`;
        }
        
        // 如果是昨天
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `昨天 ${date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })}`;
        }
        
        // 其他情况
        return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
    }

    /**
     * 搜索项目
     * @param {string} keyword - 搜索关键词
     * @returns {Array} 搜索结果
     */
    searchProjects(keyword) {
        if (!keyword.trim()) {
            return this.projectList;
        }

        const lowerKeyword = keyword.toLowerCase();
        return this.projectList.filter(project => {
            const title = project.metadata.title.toLowerCase();
            const description = (project.metadata.description || '').toLowerCase();
            const tags = (project.metadata.tags || []).join(' ').toLowerCase();
            
            return title.includes(lowerKeyword) || 
                   description.includes(lowerKeyword) || 
                   tags.includes(lowerKeyword);
        });
    }

    /**
     * 获取当前项目
     * @returns {Object|null} 当前项目
     */
    getCurrentProject() {
        return this.currentProject;
    }

    /**
     * 检查是否有未保存的更改
     * @returns {boolean} 是否有未保存的更改
     */
    hasUnsavedChanges() {
        if (!this.currentProject || !window.editorManager) {
            return false;
        }

        // 这里可以实现更复杂的检查逻辑
        return window.editorManager.isDirty();
    }

    /**
     * 设置项目元数据
     * @param {Object} metadata - 元数据
     */
    async updateProjectMetadata(metadata) {
        if (!this.currentProject) {
            throw new Error('没有打开的项目');
        }

        this.currentProject.metadata = {
            ...this.currentProject.metadata,
            ...metadata,
            lastModified: new Date().toISOString()
        };

        await this.saveCurrentProject();
        this.updateCurrentProjectUI();
    }
}

// 导出到全局
window.projectManager = new ProjectManager();
