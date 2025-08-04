// 主应用逻辑
class ArtiMeowApp {
  constructor() {
    this.currentProject = null;
    this.currentChapter = null;
    this.isAIAgentMode = false;
    this.autoSaveTimer = null;
    this.settings = null;
    this.currentWordCount = 0; // 全局字数统计变量
    this.isSaved = true; // 保存状态标记
    this.characterManager = null; // 角色管理器
    this.originalContent = ''; // 原始内容，用于比较是否有变化
    this.saveStatusCheckInterval = null; // 保存状态检查定时器
    this.cachedProjectPath = null; // 缓存的项目路径，用于Git终端
    this.initializeSaveStatusChecker(); // 初始化保存状态检查器
    
    this.init();
  }

  async init() {
    console.log('ArtiMeow 正在初始化...');
    
    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  async setup() {
    try {
      // 清除项目路径缓存（应用启动时清除）
      this.cachedProjectPath = null;
      
      // 更新加载屏幕版本信息
      await this.updateLoadingVersionInfo();
      
      // 更新加载状态
      this.updateLoadingStatus('正在初始化应用...', 0);
      
      // 检查 Electron API
      if (!window.electronAPI) {
        console.error('Electron API 不可用');
        this.showError('应用启动失败：缺少必要的系统组件');
        return;
      }
      
      // 检查必要的依赖
      if (typeof marked === 'undefined') {
        console.error('Marked 库未加载');
        this.showError('应用启动失败：缺少必要的组件');
        return;
      }
      
      this.updateLoadingStatus('正在加载设置...', 1);
      
      // 初始化主题
      await this.initTheme();
      // 加载设置
      await this.loadSettings();
      
      this.updateLoadingStatus('正在初始化事件监听器...', 2);
      // 初始化事件监听器
      this.initEventListeners();
      
      // 初始化编辑器管理器
      this.initEditorManager();
      
      this.updateLoadingStatus('正在加载项目...', 3);
      // 加载项目列表
      await this.loadRecentProjects();
      
      this.updateLoadingStatus('正在初始化AI功能...', 4);
      // 初始化 AI 管理器
      if (typeof AIManager !== 'undefined') {
        window.aiManager = new AIManager();
      }
      
      // 初始化增强模块
      this.initEnhancedModules();
      
      this.updateLoadingStatus('启动完成', 5);
      
      console.log('ArtiMeow 初始化完成');
    } catch (error) {
      console.error('应用初始化失败:', error);
      this.showError('应用启动失败：' + error.message);
    }
  }
  
  updateLoadingStatus(message, step) {
    const statusElement = document.getElementById('loading-status');
    const logItems = document.querySelectorAll('.log-item');
    
    if (statusElement) {
      statusElement.textContent = message;
    }
    
    // 更新日志状态
    if (logItems && logItems[step]) {
      logItems[step].classList.add('active');
      
      // 将之前的步骤标记为完成
      for (let i = 0; i < step; i++) {
        if (logItems[i]) {
          logItems[i].classList.remove('active');
          logItems[i].classList.add('completed');
        }
      }
    }
  }

  /**
   * 更新加载屏幕的版本信息
   */
  async updateLoadingVersionInfo() {
    try {
      const versionInfo = await window.electronAPI.getAppVersionInfo();
      const versionElement = document.getElementById('loading-version-info');
      
      if (versionElement && versionInfo && versionInfo.app) {
        const version = versionInfo.app.version || '1.1.0';
        versionElement.textContent = `v${version} - Made by B5-Software`;
      }
    } catch (error) {
      console.warn('无法获取版本信息，使用默认版本:', error);
      // 保持默认版本信息
    }
  }

  async loadSettings() {
    try {
      this.settings = await window.electronAPI.getSettings();
      console.log('设置已加载:', this.settings);
    } catch (error) {
      console.error('加载设置失败:', error);
      this.settings = {}; // 使用默认设置
    }
  }

  initEventListeners() {
    // 标题栏按钮
    this.initTitleBarEvents();
    
    // 项目管理
    this.initProjectEvents();
    
    // 编辑器切换
    this.initEditorTabs();
    
    // 模态框
    this.initModalEvents();
    
    // 快捷键
    this.initKeyboardShortcuts();
    
    // 自动保存
    this.initAutoSave();
    
    // 设置面板
    this.initSettingsEvents();
    
    // Git教程事件
    this.initGitTutorialEvents();
    
    // 章节搜索
    this.initChapterSearch();
    
    // 外部链接处理
    this.initExternalLinkHandling();
  }

  initTitleBarEvents() {
    // 这些按钮在 Electron 中会由主进程处理
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.windowMinimize();
        } catch (error) {
          console.error('最小化窗口失败:', error);
        }
      });
    }

    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.windowMaximize();
        } catch (error) {
          console.error('最大化窗口失败:', error);
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', async () => {
        try {
          await window.electronAPI.windowClose();
        } catch (error) {
          console.error('关闭窗口失败:', error);
        }
      });
    }
  }

  initProjectEvents() {
    // 新建项目按钮
    const newProjectBtn = document.getElementById('new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        this.showModal('new-project-modal');
      });
    }

    // 新建项目表单
    const newProjectForm = document.getElementById('new-project-form');
    if (newProjectForm) {
      newProjectForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateProject(e);
      });
    }

    // 添加章节按钮
    const addChapterBtn = document.getElementById('add-chapter-btn');
    if (addChapterBtn) {
      addChapterBtn.addEventListener('click', () => {
        this.addNewChapter();
      });
    }

    // 保存按钮
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveCurrentChapter();
      });
    }

    // 设置按钮
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.showModal('settings-modal');
      });
    }

    // Git按钮
    const gitBtn = document.getElementById('git-btn');
    if (gitBtn) {
      gitBtn.addEventListener('click', () => {
        this.showModal('git-modal');
        this.initGitPanel();
      });
    }
  }

  initEditorTabs() {
    const tabs = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.editor-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // 移除所有活动状态
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        // 激活当前选项卡
        tab.classList.add('active');
        const targetPanel = document.getElementById(`${targetTab}-panel`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
        
        // 如果切换到预览面板，更新预览内容
        if (targetTab === 'preview') {
          this.updatePreview();
        }
      });
    });
  }

  initModalEvents() {
    // 模态框关闭按钮
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.closeModal(modal.id);
        }
      });
    });

    // 点击模态框背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });

    // ESC 键关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
          this.closeModal(openModal.id);
        }
      }
    });
  }

  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+S: 保存
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveCurrentChapter();
      }
      
      // Ctrl+N: 新建项目
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.showModal('new-project-modal');
      }
      
      // Ctrl+O: 打开项目
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        this.openProject();
      }
      
      // Ctrl+,: 打开设置
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        this.showModal('settings-modal');
      }
      
      // F11: 全屏编辑
      if (e.key === 'F11') {
        e.preventDefault();
        this.toggleFullscreenEditor();
      }
    });
  }

  initAutoSave() {
    const editorTextarea = document.getElementById('editor-textarea');
    if (editorTextarea) {
      editorTextarea.addEventListener('input', () => {
        this.updateWordCount();
        
        // 检查内容是否真的有变化
        const currentContent = editorTextarea.value;
        if (currentContent !== this.originalContent) {
          this.markUnsaved();
        }
        
        // 重置自动保存定时器
        if (this.autoSaveTimer) {
          clearTimeout(this.autoSaveTimer);
        }
        
        if (this.settings?.editor?.autoSave) {
          this.autoSaveTimer = setTimeout(() => {
            this.saveCurrentChapter(true);
          }, this.settings.editor.autoSaveInterval || 30000);
        }
      });
    }
  }

  /**
   * 初始化保存状态检查器
   */
  initializeSaveStatusChecker() {
    // 启动定时检查器，每5秒检查一次保存状态
    this.saveStatusCheckInterval = setInterval(() => {
      this.checkSaveStatus();
    }, 5000);
  }

  /**
   * 检查保存状态
   */
  checkSaveStatus() {
    const editorTextarea = document.getElementById('editor-textarea');
    if (!editorTextarea || !this.currentChapter) {
      return;
    }
    
    const currentContent = editorTextarea.value;
    const hasChanges = currentContent !== this.originalContent;
    
    console.log('检查保存状态:', {
      hasChanges,
      isSaved: this.isSaved,
      currentLength: currentContent.length,
      originalLength: this.originalContent.length
    });
    
    if (hasChanges && this.isSaved) {
      console.log('检测到变化，标记为未保存');
      this.markUnsaved();
    } else if (!hasChanges && !this.isSaved) {
      console.log('内容无变化，标记为已保存');
      this.markSaved();
    }
  }

  /**
   * 初始化设置面板事件监听器
   */
  initSettingsEvents() {
    // 设置面板标签切换
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsPanels = document.querySelectorAll('.settings-panel');
    
    settingsTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // 移除所有活动状态
        settingsTabs.forEach(t => t.classList.remove('active'));
        settingsPanels.forEach(p => p.classList.remove('active'));
        
        // 激活当前选项卡
        tab.classList.add('active');
        const targetPanel = document.getElementById(`${targetTab}-settings`);
        if (targetPanel) {
          targetPanel.classList.add('active');
          
          // 如果切换到关于面板，加载版本信息
          if (targetTab === 'about' && window.settingsManager) {
            console.log('切换到关于面板，开始加载版本信息...');
            window.settingsManager.loadVersionInfo();
          }
        }
      });
    });
    
    // AI引擎选择
    const aiEngineSelect = document.getElementById('ai-engine');
    if (aiEngineSelect) {
      aiEngineSelect.addEventListener('change', (e) => {
        this.toggleEngineSettings(e.target.value);
      });
    }
    
    // 自定义AI参数滑块
    const customTemperature = document.getElementById('custom-temperature');
    const customTemperatureValue = document.getElementById('custom-temperature-value');
    if (customTemperature && customTemperatureValue) {
      customTemperature.addEventListener('input', (e) => {
        customTemperatureValue.textContent = e.target.value;
      });
    }
    
    // 字体大小滑块
    const fontSizeSlider = document.getElementById('editor-font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    if (fontSizeSlider && fontSizeValue) {
      fontSizeSlider.addEventListener('input', (e) => {
        fontSizeValue.textContent = `${e.target.value}px`;
        this.previewFontSize(e.target.value);
      });
    }
    
    // 行高滑块
    const lineHeightSlider = document.getElementById('editor-line-height');
    const lineHeightValue = document.getElementById('line-height-value');
    if (lineHeightSlider && lineHeightValue) {
      lineHeightSlider.addEventListener('input', (e) => {
        lineHeightValue.textContent = e.target.value;
        this.previewLineHeight(e.target.value);
      });
    }
    
    // 字体族选择
    const fontFamilySelect = document.getElementById('editor-font-family');
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', (e) => {
        this.previewFontFamily(e.target.value);
      });
    }
    
    // 主题切换
    const themeSelect = document.getElementById('editor-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.applyTheme(e.target.value);
      });
    }
    
    // 自动保存开关
    const autoSaveCheck = document.getElementById('auto-save');
    const autoSaveSettings = document.getElementById('auto-save-settings');
    if (autoSaveCheck) {
      autoSaveCheck.addEventListener('change', (e) => {
        if (autoSaveSettings) {
          autoSaveSettings.style.display = e.target.checked ? 'block' : 'none';
        }
      });
    }
    
    // 备份开关
    const backupCheck = document.getElementById('backup-enabled');
    const backupSettings = document.getElementById('backup-settings');
    const backupSettings2 = document.getElementById('backup-settings2');
    if (backupCheck) {
      backupCheck.addEventListener('change', (e) => {
        if (backupSettings) {
          backupSettings.style.display = e.target.checked ? 'block' : 'none';
        }
        if (backupSettings2) {
          backupSettings2.style.display = e.target.checked ? 'block' : 'none';
        }
      });
    }
    
    // 自定义字体上传
    const uploadFontBtn = document.getElementById('upload-font-btn');
    const customFontFile = document.getElementById('custom-font-file');
    if (uploadFontBtn && customFontFile) {
      uploadFontBtn.addEventListener('click', () => {
        customFontFile.click();
      });
      
      customFontFile.addEventListener('change', (e) => {
        this.handleFontUpload(e.target.files[0]);
      });
    }
    
    // 保存设置按钮
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
      saveSettingsBtn.addEventListener('click', () => {
        this.saveAllSettings();
      });
    }
    
    // 重置系统提示词
    const resetPromptBtn = document.getElementById('reset-prompt-btn');
    if (resetPromptBtn) {
      resetPromptBtn.addEventListener('click', () => {
        this.resetSystemPrompt();
      });
    }
    
    // 测试AI连接
    const testAIBtn = document.getElementById('test-ai-connection');
    if (testAIBtn) {
      testAIBtn.addEventListener('click', () => {
        this.testAIConnection();
      });
    }
    
    // 选择项目目录
    const chooseDirBtn = document.getElementById('choose-projects-dir');
    if (chooseDirBtn) {
      chooseDirBtn.addEventListener('click', () => {
        this.chooseProjectsDirectory();
      });
    }
    
    // 重置设置
    const resetSettingsBtn = document.getElementById('reset-settings');
    if (resetSettingsBtn) {
      resetSettingsBtn.addEventListener('click', () => {
        this.resetAllSettings();
      });
    }
    
    // 导出设置
    const exportSettingsBtn = document.getElementById('export-settings');
    if (exportSettingsBtn) {
      exportSettingsBtn.addEventListener('click', () => {
        this.exportSettings();
      });
    }
    
    // 导入设置
    const importSettingsBtn = document.getElementById('import-settings');
    if (importSettingsBtn) {
      importSettingsBtn.addEventListener('click', () => {
        this.importSettings();
      });
    }
    
    // 立即创建备份
    const createBackupBtn = document.getElementById('create-manual-backup');
    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', () => {
        this.createManualBackup();
      });
    }
    
    // 打开备份文件夹
    const openBackupBtn = document.getElementById('open-backup-folder');
    if (openBackupBtn) {
      openBackupBtn.addEventListener('click', () => {
        this.openBackupFolder();
      });
    }
    
    // 刷新版本信息按钮
    const refreshVersionBtn = document.getElementById('refresh-version-info');
    if (refreshVersionBtn) {
      refreshVersionBtn.addEventListener('click', () => {
        console.log('刷新版本信息按钮被点击');
        if (window.settingsManager) {
          window.settingsManager.loadVersionInfo();
        }
      });
    }
  }

  async loadRecentProjects() {
    try {
      const recentProjects = await window.electronAPI.getRecentProjects();
      this.renderRecentProjects(recentProjects);
    } catch (error) {
      console.error('加载最近项目失败:', error);
    }
  }

  renderRecentProjects(projects) {
    const container = document.getElementById('recent-projects');
    if (!container) return;

    container.innerHTML = '';

    if (projects.length === 0) {
      container.innerHTML = '<p class="text-muted">暂无最近项目</p>';
      return;
    }

    projects.forEach(project => {
      const projectElement = document.createElement('div');
      projectElement.className = 'project-item hover-lift';
      projectElement.dataset.path = project.path; // 添加数据属性
      projectElement.innerHTML = `
        <div class="project-details">
          <div class="project-name">${project.name}</div>
          <div class="project-path">${project.path}</div>
        </div>
      `;
      
      projectElement.addEventListener('click', () => {
        this.loadProject(project.path);
      });
      
      container.appendChild(projectElement);
    });
  }

  async handleCreateProject(event) {
    const formData = new FormData(event.target);
    const projectData = {
      name: formData.get('name'),
      description: formData.get('description'),
      author: formData.get('author'),
      genre: formData.get('genre'),
      useGit: formData.get('useGit') === 'on'
    };

    try {
      this.updateStatus('正在创建项目...');
      const result = await window.electronAPI.createProject(projectData);
      
      if (result.success) {
        this.closeModal('new-project-modal');
        await this.loadProject(result.projectDir);
        this.showSuccess('项目创建成功！');
        
        // 更新最近项目列表
        await window.electronAPI.addRecentProject(result.projectDir);
        await this.loadRecentProjects();
      } else {
        this.showError('项目创建失败: ' + result.error);
      }
    } catch (error) {
      console.error('创建项目时出错:', error);
      this.showError('项目创建失败，请重试');
    } finally {
      this.updateStatus('就绪');
    }
  }

  async loadProject(projectPath) {
    try {
      this.updateStatus('正在加载项目...');
      const result = await window.electronAPI.loadProject(projectPath);
      
      if (result.success) {
        this.currentProject = result.project;
        // 确保项目包含路径信息
        this.currentProject.path = projectPath;
        this.cachedProjectPath = projectPath; // 缓存项目路径用于Git终端
        
        // 同步项目状态到项目管理器
        if (window.projectManager) {
          window.projectManager.currentProject = this.currentProject;
        }
        
        this.updateProjectUI();
        this.showSuccess('项目加载成功！');
        
        // 检查Git状态
        this.updateGitStatus();
        
        // 添加到最近项目
        await window.electronAPI.addRecentProject(projectPath);
        await this.loadRecentProjects();
      } else {
        this.showError('项目加载失败: ' + result.error);
      }
    } catch (error) {
      console.error('加载项目时出错:', error);
      this.showError('项目加载失败，请重试');
    } finally {
      this.updateStatus('就绪');
    }
  }

  updateProjectUI() {
    if (!this.currentProject) return;

    // 更新项目名称
    const projectNameElement = document.getElementById('current-project-name');
    if (projectNameElement) {
      projectNameElement.textContent = this.currentProject.name;
    }

    // 更新项目信息
    const projectInfoElement = document.getElementById('current-project-info');
    if (projectInfoElement) {
      const description = this.currentProject.description || '暂无描述';
      projectInfoElement.innerHTML = `
        <h5>${this.currentProject.name}</h5>
        <div class="project-description-container">
          <p class="project-description collapsed">${description}</p>
          <button class="description-toggle" type="button">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
        <p><strong>作者:</strong> ${this.currentProject.author || '未设置'}</p>
        <p><strong>类型:</strong> ${this.currentProject.genre || '未设置'}</p>
        <p><strong>章节数:</strong> ${this.currentProject.chapters?.length || 0}</p>
        <div class="project-actions">
          <button id="character-management-btn" class="btn-secondary btn-sm">
            <i class="fas fa-users"></i> 角色和设定
          </button>
        </div>
      `;
      
      // 添加折叠功能事件监听器
      const toggle = projectInfoElement.querySelector('.description-toggle');
      const descriptionElement = projectInfoElement.querySelector('.project-description');
      
      if (toggle && descriptionElement) {
        toggle.addEventListener('click', () => {
          const isCollapsed = descriptionElement.classList.contains('collapsed');
          const icon = toggle.querySelector('i');
          
          if (isCollapsed) {
            descriptionElement.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-up';
          } else {
            descriptionElement.classList.add('collapsed');
            icon.className = 'fas fa-chevron-down';
          }
        });
      }
      
      // 添加角色管理按钮事件监听器
      const characterBtn = projectInfoElement.querySelector('#character-management-btn');
      if (characterBtn) {
        characterBtn.addEventListener('click', () => {
          this.openCharacterManagement();
        });
      }
    }

    // 更新章节列表
    this.renderChaptersList();
    
    // 启用添加章节按钮
    const addChapterBtn = document.getElementById('add-chapter-btn');
    if (addChapterBtn) {
      addChapterBtn.disabled = false;
    }
    
    // 设置Git项目路径
    if (window.gitEnhancedManager && this.currentProject.path) {
      window.gitEnhancedManager.setProjectPath(this.currentProject.path);
    }
  }

  renderChaptersList() {
    const container = document.getElementById('chapters-list');
    if (!container || !this.currentProject?.chapters) return;

    container.innerHTML = '';

    if (this.currentProject.chapters.length === 0) {
      container.innerHTML = '<p class="text-muted">暂无章节</p>';
      return;
    }

    this.currentProject.chapters.forEach((chapter, index) => {
      const chapterElement = document.createElement('div');
      chapterElement.className = 'chapter-item hover-lift';
      chapterElement.dataset.chapterId = chapter.id; // 添加数据属性
      
      // 确保显示正确的字数
      const wordCount = chapter.wordCount || 0;
      
      chapterElement.innerHTML = `
        <div class="chapter-icon">
          ${index + 1}
        </div>
        <div class="chapter-details">
          <div class="chapter-title">${chapter.title}</div>
          <div class="chapter-info">${wordCount} 字</div>
        </div>
      `;
      
      // 如果是当前编辑的章节，添加活跃状态
      if (this.currentChapter && chapter.id === this.currentChapter.id) {
        chapterElement.classList.add('active');
      }
      
      chapterElement.addEventListener('click', () => {
        this.loadChapter(chapter);
      });
      
      container.appendChild(chapterElement);
    });
  }

  async loadChapter(chapterOrId) {
    try {
      let chapter;
      
      // 如果传入的是字符串ID，需要从章节列表中查找对应的章节
      if (typeof chapterOrId === 'string') {
        chapter = this.currentProject?.chapters?.find(ch => ch.id === chapterOrId);
        if (!chapter) {
          console.error('找不到章节:', chapterOrId);
          this.showError('找不到指定的章节');
          return;
        }
      } else {
        chapter = chapterOrId;
      }
      
      // 从文件系统加载章节内容
      const result = await window.electronAPI.loadChapter({
        projectPath: this.currentProject.path,
        chapterId: chapter.id
      });
      
      if (result.success) {
        this.currentChapter = result.chapter;
        
        // 更新编辑器内容
        const editorTextarea = document.getElementById('editor-textarea');
        if (editorTextarea) {
          editorTextarea.value = this.currentChapter.content || '';
          this.updateWordCount();
        }
        
        this.updateStatus(`正在编辑: ${this.currentChapter.title}`);
        // 记录文件的原始内容
        this.originalContent = this.currentChapter.content || '';
        this.markSaved();
      } else {
        // 如果文件不存在，使用项目中的章节信息
        this.currentChapter = { ...chapter }; // 创建副本
        
        const editorTextarea = document.getElementById('editor-textarea');
        if (editorTextarea) {
          editorTextarea.value = chapter.content || '';
          this.updateWordCount();
        }
        
        this.updateStatus(`正在编辑: ${chapter.title}`);
        // 记录文件的原始内容
        this.originalContent = chapter.content || '';
        this.markSaved();
      }
      
      // 更新章节选中状态
      this.renderChaptersList();
      
    } catch (error) {
      console.error('加载章节失败:', error);
      this.showError('加载章节失败，请重试');
    }
  }

  async addNewChapter() {
    if (!this.currentProject) {
      this.showError('请先创建或打开一个项目');
      return;
    }

    const chapterTitle = await this.showInputModal('新建章节', '请输入章节标题:');
    if (!chapterTitle) return;

    const newChapter = {
      id: Date.now().toString(),
      title: chapterTitle,
      content: '',
      wordCount: 0
    };

    this.currentProject.chapters.push(newChapter);
    this.renderChaptersList();
    this.loadChapter(newChapter);
    
    this.showSuccess('章节添加成功！');
  }

  async saveCurrentChapter(isAutoSave = false) {
    if (!this.currentProject || !this.currentChapter) {
      if (!isAutoSave) {
        this.showError('没有可保存的内容');
      }
      return;
    }

    const editorTextarea = document.getElementById('editor-textarea');
    if (!editorTextarea) return;

    try {
      // 获取当前内容
      const content = editorTextarea.value;
      // 使用全局字数统计变量
      const wordCount = this.getCurrentWordCount();
      
      // 调试信息
      console.log('保存章节:', {
        chapterId: this.currentChapter.id,
        title: this.currentChapter.title,
        wordCount: wordCount,
        contentLength: content.length
      });
      
      // 保存章节到文件系统
      const result = await window.electronAPI.saveChapter({
        projectPath: this.currentProject.path,
        chapterId: this.currentChapter.id,
        title: this.currentChapter.title,
        content: content
      });
      
      if (result.success) {
        // 确保 currentChapter 对象存在且有有效的id
        if (this.currentChapter && this.currentChapter.id) {
          console.log('更新当前章节对象...');
          this.currentChapter.content = content;
          this.currentChapter.wordCount = wordCount;
          
          // 更新项目中的章节信息
          if (this.currentProject && this.currentProject.chapters && Array.isArray(this.currentProject.chapters)) {
            const chapterIndex = this.currentProject.chapters.findIndex(ch => ch && ch.id === this.currentChapter.id);
            console.log('查找章节索引:', chapterIndex, '总章节数:', this.currentProject.chapters.length);
            
            if (chapterIndex >= 0) {
              console.log('更新项目章节信息...');
              this.currentProject.chapters[chapterIndex].wordCount = wordCount;
              this.currentProject.chapters[chapterIndex].title = this.currentChapter.title;
            } else {
              console.warn('未找到对应章节，尝试添加新章节...');
              // 如果没找到，可能是新章节，添加到列表中
              this.currentProject.chapters.push({
                id: this.currentChapter.id,
                title: this.currentChapter.title,
                wordCount: wordCount,
                lastModified: new Date().toISOString()
              });
            }
          }
        } else {
          console.error('currentChapter 对象无效:', this.currentChapter);
        }
        
        // 标记为已保存
        this.markSaved();
        
        // 更新原始内容为当前保存的内容
        this.originalContent = content;
        
        if (!isAutoSave) {
          this.showSuccess('保存成功！');
        }
        
        // 更新章节列表中的字数
        this.renderChaptersList();
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      console.error('保存失败:', error);
      console.error('错误详情:', {
        currentProject: !!this.currentProject,
        currentChapter: !!this.currentChapter,
        chapterId: this.currentChapter?.id,
        projectPath: this.currentProject?.path
      });
      if (!isAutoSave) {
        this.showError('保存失败，请重试');
      }
    }
  }

  updateWordCount() {
    const editorTextarea = document.getElementById('editor-textarea');
    const wordCountElement = document.getElementById('word-count');
    
    if (editorTextarea && wordCountElement) {
      this.currentWordCount = this.getWordCount(editorTextarea.value);
      wordCountElement.textContent = this.currentWordCount;
    }
  }

  getWordCount(text) {
    // 中文字符计数
    const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    // 英文单词计数
    const englishCount = text.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(word => word.length > 0).length;
    return chineseCount + englishCount;
  }

  /**
   * 获取当前编辑器的字数统计
   * @returns {number} 当前字数
   */
  getCurrentWordCount() {
    return this.currentWordCount;
  }

  markUnsaved() {
    if (this.isSaved) {
      this.isSaved = false;
      const saveStatus = document.getElementById('save-status');
      if (saveStatus) {
        saveStatus.innerHTML = '<i class="fas fa-circle"></i> 未保存';
        saveStatus.style.color = 'var(--warning-color)';
      }
      console.log('标记为未保存');
    }
  }

  markSaved() {
    this.isSaved = true;
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
      saveStatus.innerHTML = '<i class="fas fa-save"></i> 已保存';
      saveStatus.style.color = 'var(--success-color)';
    }
    console.log('标记为已保存');
  }

  /**
   * 更新预览内容
   */
  updatePreview() {
    if (window.editorManager) {
      window.editorManager.updatePreview();
    }
  }

  renderMarkdown(content) {
    // 简单的 Markdown 渲染，可以后续使用 marked 库替换
    let html = content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="external-link">$1</a>');
    
    return html;
  }

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('show');
      modal.style.display = 'flex';
      
      // 如果是设置模态框，加载当前设置
      if (modalId === 'settings-modal') {
        this.loadSettingsToModal();
      }
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
    }
  }

  loadSettingsToModal() {
    if (!this.settings) return;

    // 加载 AI 设置
    const aiEngine = document.getElementById('ai-engine');
    if (aiEngine) {
      aiEngine.value = this.settings.ai?.selectedEngine || 'openai';
      this.toggleEngineSettings(aiEngine.value);
    }

    // 加载各引擎设置
    if (this.settings.ai?.engines) {
      // OpenAI
      const openaiApiKey = document.getElementById('openai-api-key');
      const openaiModel = document.getElementById('openai-model');
      if (openaiApiKey) openaiApiKey.value = this.settings.ai.engines.openai?.apiKey || '';
      if (openaiModel) openaiModel.value = this.settings.ai.engines.openai?.model || 'gpt-4';

      // Ollama
      const ollamaUrl = document.getElementById('ollama-url');
      const ollamaModel = document.getElementById('ollama-model');
      if (ollamaUrl) ollamaUrl.value = this.settings.ai.engines.ollama?.baseURL || 'http://localhost:11434';
      if (ollamaModel) ollamaModel.value = this.settings.ai.engines.ollama?.model || 'llama2';

      // Llama.cpp
      const llamacppUrl = document.getElementById('llamacpp-url');
      const llamacppModel = document.getElementById('llamacpp-model');
      if (llamacppUrl) llamacppUrl.value = this.settings.ai.engines.llamacpp?.baseURL || 'http://localhost:8080';
      if (llamacppModel) llamacppModel.value = this.settings.ai.engines.llamacpp?.model || 'llama2';
      
      // Custom
      const customApiKey = document.getElementById('custom-api-key');
      const customBaseUrl = document.getElementById('custom-base-url');
      const customModel = document.getElementById('custom-model');
      const customTemperature = document.getElementById('custom-temperature');
      const customTemperatureValue = document.getElementById('custom-temperature-value');
      const customMaxTokens = document.getElementById('custom-max-tokens');
      
      if (customApiKey) customApiKey.value = this.settings.ai.engines.custom?.apiKey || '';
      if (customBaseUrl) customBaseUrl.value = this.settings.ai.engines.custom?.baseURL || '';
      if (customModel) customModel.value = this.settings.ai.engines.custom?.model || '';
      if (customTemperature) {
        customTemperature.value = this.settings.ai.engines.custom?.temperature || 0.7;
        if (customTemperatureValue) customTemperatureValue.textContent = customTemperature.value;
      }
      if (customMaxTokens) customMaxTokens.value = this.settings.ai.engines.custom?.maxTokens || 1000;
    }

    // 系统提示词
    const systemPrompt = document.getElementById('system-prompt');
    if (systemPrompt) {
      systemPrompt.value = this.settings.ai?.systemPrompt || '';
    }

    // 编辑器设置
    const editorFontSize = document.getElementById('editor-font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    if (editorFontSize) {
      editorFontSize.value = this.settings.editor?.fontSize || 16;
      if (fontSizeValue) fontSizeValue.textContent = `${editorFontSize.value}px`;
    }

    const editorFontFamily = document.getElementById('editor-font-family');
    if (editorFontFamily) {
      editorFontFamily.value = this.settings.editor?.fontFamily || 'Georgia, serif';
    }
    
    const editorLineHeight = document.getElementById('editor-line-height');
    const lineHeightValue = document.getElementById('line-height-value');
    if (editorLineHeight) {
      editorLineHeight.value = this.settings.editor?.lineHeight || 1.5;
      if (lineHeightValue) lineHeightValue.textContent = editorLineHeight.value;
    }

    const editorTheme = document.getElementById('editor-theme');
    if (editorTheme) {
      editorTheme.value = this.settings.editor?.theme || 'dark';
    }

    const autoSave = document.getElementById('auto-save');
    const autoSaveSettings = document.getElementById('auto-save-settings');
    if (autoSave) {
      autoSave.checked = this.settings.editor?.autoSave || false;
      if (autoSaveSettings) {
        autoSaveSettings.style.display = autoSave.checked ? 'block' : 'none';
      }
    }
    
    const autoSaveInterval = document.getElementById('auto-save-interval');
    if (autoSaveInterval) {
      autoSaveInterval.value = this.settings.editor?.autoSaveInterval || 30;
    }
    
    // Git设置
    const gitUsername = document.getElementById('git-username');
    const gitEmail = document.getElementById('git-email');
    if (gitUsername) gitUsername.value = this.settings.git?.userName || '';
    if (gitEmail) gitEmail.value = this.settings.git?.userEmail || '';
    
    // 通用设置
    const projectsDir = document.getElementById('projects-dir');
    if (projectsDir) {
      projectsDir.value = this.settings.general?.projectsDir || '';
    }
    
    const backupEnabled = document.getElementById('backup-enabled');
    const backupSettings = document.getElementById('backup-settings');
    const backupSettings2 = document.getElementById('backup-settings2');
    if (backupEnabled) {
      backupEnabled.checked = this.settings.general?.backupEnabled || false;
      if (backupSettings) {
        backupSettings.style.display = backupEnabled.checked ? 'block' : 'none';
      }
      if (backupSettings2) {
        backupSettings2.style.display = backupEnabled.checked ? 'block' : 'none';
      }
    }
    
    const backupInterval = document.getElementById('backup-interval');
    if (backupInterval) {
      backupInterval.value = this.settings.general?.backupInterval || 24;
    }
    
    const backupKeepCount = document.getElementById('backup-keep-count');
    if (backupKeepCount) {
      backupKeepCount.value = this.settings.general?.backupKeepCount || 10;
    }
    
    const checkUpdates = document.getElementById('check-updates');
    if (checkUpdates) {
      // 检查更新功能已移除，但保持代码兼容性
      checkUpdates.checked = false;
    }
    
    // 加载自定义字体
    this.loadCustomFonts();
    
    // 加载版本信息（如果设置管理器可用）
    if (window.settingsManager) {
      console.log('设置模态框打开，开始加载版本信息...');
      window.settingsManager.loadVersionInfo();
    }
  }

  /**
   * 加载自定义字体列表
   */
  loadCustomFonts() {
    // 获取自定义字体列表
    const customFonts = this.settings.editor?.customFonts || [];
    const fontFamilySelect = document.getElementById('editor-font-family');
    
    if (fontFamilySelect && customFonts.length > 0) {
      // 移除之前添加的自定义字体选项
      const existingCustomOptions = fontFamilySelect.querySelectorAll('.custom-font-option');
      existingCustomOptions.forEach(option => option.remove());
      
      // 添加自定义字体选项
      customFonts.forEach(font => {
        const option = document.createElement('option');
        option.value = font.family;
        option.textContent = font.name;
        option.className = 'custom-font-option';
        fontFamilySelect.appendChild(option);
      });
    }
  }
  
  toggleEngineSettings(engine) {
    // 隐藏所有引擎设置
    document.querySelectorAll('.engine-settings').forEach(setting => {
      setting.classList.add('hidden');
    });

    // 显示选中的引擎设置
    const targetSetting = document.getElementById(`${engine}-settings`);
    if (targetSetting) {
      targetSetting.classList.remove('hidden');
    }
  }

  applySettings() {
    if (!this.settings) return;

    // 应用编辑器设置
    const editorTextarea = document.getElementById('editor-textarea');
    if (editorTextarea && this.settings.editor) {
      if (this.settings.editor.fontSize) {
        editorTextarea.style.fontSize = `${this.settings.editor.fontSize}px`;
      }
      if (this.settings.editor.fontFamily) {
        editorTextarea.style.fontFamily = this.settings.editor.fontFamily;
      }
      if (this.settings.editor.lineHeight) {
        editorTextarea.style.lineHeight = this.settings.editor.lineHeight;
      }
    }

    // 应用主题
    if (this.settings.editor?.theme) {
      this.applyTheme(this.settings.editor.theme);
    }
    
    // 应用自动保存
    if (this.settings.editor?.autoSave) {
      this.initAutoSave();
    }
  }

  toggleFullscreenEditor() {
    const editorContainer = document.querySelector('.editor-container');
    if (editorContainer) {
      editorContainer.classList.toggle('fullscreen-editor');
    }
  }

  async openProject() {
    try {
      const result = await window.electronAPI.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择项目文件夹'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        await this.loadProject(result.filePaths[0]);
      }
    } catch (error) {
      console.error('打开项目失败:', error);
      this.showError('打开项目失败，请重试');
    }
  }

  updateStatus(message) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = message;
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 添加样式
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 24px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10000',
      maxWidth: '400px',
      wordWrap: 'break-word',
      animation: 'slideInRight 0.3s ease'
    });

    // 设置背景颜色
    switch (type) {
      case 'success':
        notification.style.background = 'var(--success-color)';
        break;
      case 'error':
        notification.style.background = 'var(--danger-color)';
        break;
      case 'warning':
        notification.style.background = 'var(--warning-color)';
        break;
      default:
        notification.style.background = 'var(--info-color)';
    }

    document.body.appendChild(notification);

    // 自动移除
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  /**
   * 显示自定义输入模态框
   * @param {string} title - 模态框标题
   * @param {string} label - 输入框标签
   * @param {string} placeholder - 输入框占位符
   * @returns {Promise<string|null>} 用户输入的值，如果取消则返回null
   */
  showInputModal(title, label, placeholder = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('input-modal');
      const titleElement = document.getElementById('input-modal-title');
      const labelElement = document.getElementById('input-modal-label');
      const inputElement = document.getElementById('input-modal-field');
      
      titleElement.textContent = title;
      labelElement.textContent = label;
      inputElement.placeholder = placeholder;
      inputElement.value = '';
      
      // 保存resolve函数供关闭时使用
      modal._resolve = resolve;
      
      this.showModal('input-modal');
      
      // 聚焦输入框
      setTimeout(() => {
        inputElement.focus();
      }, 100);
      
      // 支持回车确认
      const handleEnter = (e) => {
        if (e.key === 'Enter') {
          inputElement.removeEventListener('keypress', handleEnter);
          this.closeInputModal(true);
        }
      };
      inputElement.addEventListener('keypress', handleEnter);
    });
  }

  /**
   * 关闭自定义输入模态框
   * @param {boolean} confirmed - 是否确认输入
   */
  closeInputModal(confirmed) {
    const modal = document.getElementById('input-modal');
    const inputElement = document.getElementById('input-modal-field');
    
    if (modal._resolve) {
      const result = confirmed ? inputElement.value.trim() : null;
      modal._resolve(result);
      delete modal._resolve;
    }
    
    this.closeModal('input-modal');
  }

  /**
   * 显示确认对话框
   * @param {string} title - 对话框标题
   * @param {string} message - 确认消息
   * @returns {Promise<boolean>} 用户确认结果
   */
  showConfirmModal(title, message) {
    return new Promise((resolve) => {
      const confirmed = confirm(title + '\n\n' + message);
      resolve(confirmed);
    });
  }

  /**
   * 初始化Git面板
   */
  initGitPanel() {
    if (!this.currentProject) {
      this.showError('请先打开一个项目');
      this.closeModal('git-modal');
      return;
    }

    // 确保Git增强管理器知道当前项目
    if (window.gitEnhancedManager) {
      window.gitEnhancedManager.setCurrentProject(this.currentProject.path);
      // 同时设置项目路径
      window.gitEnhancedManager.currentProjectPath = this.currentProject.path;
    }

    // 初始化Git标签切换
    this.initGitTabs();
    
    // 初始化Git按钮事件
    this.initGitButtons();
    
    // 加载Git状态
    this.loadGitStatus();
    
    // 加载分支和远程仓库
    this.loadGitBranches();
    this.loadGitRemotes();
  }

  /**
   * 初始化Git按钮事件
   */
  initGitButtons() {
    // Git提交按钮
    const commitBtn = document.getElementById('git-commit-btn');
    if (commitBtn) {
      commitBtn.addEventListener('click', () => this.handleGitCommit());
    }

    // Git功能现在由 git-enhanced.js 处理，移除重复的事件绑定

    // 刷新分支按钮
    const refreshBranchesBtn = document.getElementById('git-refresh-branches-btn');
    if (refreshBranchesBtn) {
      refreshBranchesBtn.addEventListener('click', () => this.loadGitBranches());
    }

    // 刷新远程仓库按钮
    // Git功能现在由 git-enhanced.js 处理，移除重复的事件绑定

    // 新建分支表单
    const newBranchForm = document.getElementById('new-branch-form');
    if (newBranchForm) {
      newBranchForm.addEventListener('submit', (e) => this.handleNewBranchSubmit(e));
    }
  }

  /**
   * 初始化Git标签切换
   */
  initGitTabs() {
    const gitTabs = document.querySelectorAll('.git-tab');
    const gitPanels = document.querySelectorAll('.git-panel');

    gitTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        // 移除所有活动状态
        gitTabs.forEach(t => t.classList.remove('active'));
        gitPanels.forEach(p => p.classList.remove('active'));
        
        // 激活当前选项卡
        tab.classList.add('active');
        const targetPanel = document.getElementById(`git-${targetTab}-panel`);
        if (targetPanel) {
          targetPanel.classList.add('active');
          
          // 根据面板类型加载对应数据
          switch (targetTab) {
            case 'status':
              this.loadGitStatus();
              break;
            case 'history':
              this.loadGitHistory();
              break;
            case 'branches':
              this.loadGitBranches();
              break;
            case 'remotes':
              this.loadGitRemotes();
              break;
          }
        }
      });
    });
  }

  /**
   * 加载Git状态
   */
  async loadGitStatus() {
    try {
      const result = await window.electronAPI.gitStatus(this.currentProject.path);
      const content = document.getElementById('git-status-content');
      
      if (result.success) {
        const status = result.status;
        if (!status.files || status.files.length === 0) {
          content.innerHTML = '<p class="text-muted">工作区干净，没有未提交的更改</p>';
        } else {
          const files = status.files.map(line => {
            const statusCode = line.substring(0, 2);
            const file = line.substring(3);
            let statusClass = '';
            let statusText = '';
            
            if (statusCode.includes('M')) {
              statusClass = 'modified';
              statusText = 'M';
            } else if (statusCode.includes('A')) {
              statusClass = 'added';
              statusText = 'A';
            } else if (statusCode.includes('D')) {
              statusClass = 'deleted';
              statusText = 'D';
            } else {
              statusClass = 'modified';
              statusText = '?';
            }
            
            return `
              <div class="git-file-item">
                <span class="git-file-status ${statusClass}">${statusText}</span>
                <span class="git-file-path">${file}</span>
              </div>
            `;
          }).join('');
          
          content.innerHTML = files;
        }
      } else {
        content.innerHTML = `<p class="text-danger">错误: ${result.error}</p>`;
      }
    } catch (error) {
      console.error('加载Git状态失败:', error);
      const content = document.getElementById('git-status-content');
      content.innerHTML = '<p class="text-danger">加载Git状态失败</p>';
    }
  }

  /**
   * 加载Git历史
   */
  async loadGitHistory() {
    try {
      const result = await window.electronAPI.gitLog(this.currentProject.path, 10);
      const content = document.getElementById('git-history-content');
      
      if (result.success && result.commits.length > 0) {
        const commits = result.commits.map(commit => `
          <div class="git-commit-item">
            <div class="git-commit-hash">${commit.hash.substring(0, 7)}</div>
            <div class="git-commit-message">${commit.subject}</div>
            <div class="git-commit-meta">由 ${commit.author} 于 ${commit.date} 提交</div>
          </div>
        `).join('');
        
        content.innerHTML = commits;
      } else {
        content.innerHTML = '<p class="text-muted">暂无提交历史</p>';
      }
    } catch (error) {
      console.error('加载Git历史失败:', error);
      const content = document.getElementById('git-history-content');
      content.innerHTML = '<p class="text-danger">加载Git历史失败</p>';
    }
  }

  /**
   * 加载Git分支
   */
  async loadGitBranches() {
    if (!this.currentProject) return;
    
    try {
      // 使用 git-enhanced 模块的功能
      if (window.gitManager) {
        await window.gitManager.refreshBranches();
      } else {
        console.warn('Git管理器未初始化');
      }
    } catch (error) {
      console.error('加载Git分支失败:', error);
      const content = document.getElementById('git-branches-content');
      if (content) {
        content.innerHTML = '<p class="text-danger">加载Git分支失败</p>';
      }
    }
  }

  /**
   * 加载Git远程仓库
   */
  async loadGitRemotes() {
    if (!this.currentProject) return;
    
    try {
      // 使用 git-enhanced 模块的功能
      if (window.gitManager) {
        await window.gitManager.refreshRemotes();
      } else {
        console.warn('Git管理器未初始化');
      }
    } catch (error) {
      console.error('加载Git远程仓库失败:', error);
      const content = document.getElementById('git-remotes-content');
      if (content) {
        content.innerHTML = '<p class="text-danger">加载Git远程仓库失败</p>';
      }
    }
  }

  async loadGitRemotes() {
    if (!this.currentProject) return;
    
    try {
      await window.gitManager.renderRemotesList(this.currentProject.path);
    } catch (error) {
      console.error('加载Git远程仓库失败:', error);
      const content = document.getElementById('git-remotes-content');
      if (content) {
        content.innerHTML = '<p class="text-danger">加载Git远程仓库失败</p>';
      }
    }
  }

  /**
   * 处理Git提交
   */
  async handleGitCommit() {
    try {
      // 显示提交模态框
      this.showModal('commit-modal');
      
      // 设置表单提交事件处理器
      const form = document.getElementById('commit-form');
      const handleSubmit = async (e) => {
        e.preventDefault();
        
        const message = document.getElementById('commit-message').value.trim();
        
        if (!message) {
          this.showError('请输入提交消息');
          return;
        }
        
        try {
          const result = await window.electronAPI.gitCommit(this.currentProject.path, message);
          
          if (result.success) {
            this.showSuccess('提交成功');
            this.loadGitStatus();
            this.closeModal('commit-modal');
            
            // 重置表单
            document.getElementById('commit-message').value = '';
          } else {
            this.showError('提交失败: ' + result.error);
          }
        } catch (error) {
          console.error('Git提交失败:', error);
          this.showError('提交失败，请重试');
        }
        
        // 移除事件监听器
        form.removeEventListener('submit', handleSubmit);
      };
      
      // 添加事件监听器
      form.addEventListener('submit', handleSubmit);
      
    } catch (error) {
      console.error('Git提交失败:', error);
      this.showError('提交失败，请重试');
    }
  }

  /**
   * 处理Git推送
   */
  async handleGitPush() {
    try {
      const result = await window.electronAPI.gitPush(this.currentProject.path, 'origin', 'main');
      
      if (result.success) {
        this.showSuccess('推送成功');
        this.loadGitStatus();
      } else {
        this.showError('推送失败: ' + result.error);
      }
    } catch (error) {
      console.error('Git推送失败:', error);
      this.showError('推送失败，请重试');
    }
  }

  /**
   * 处理Git拉取
   */
  async handleGitPull() {
    try {
      const result = await window.electronAPI.gitPull(this.currentProject.path, 'origin', 'main');
      
      if (result.success) {
        this.showSuccess('拉取成功');
        this.loadGitStatus();
      } else {
        this.showError('拉取失败: ' + result.error);
      }
    } catch (error) {
      console.error('Git拉取失败:', error);
      this.showError('拉取失败，请重试');
    }
  }

  /**
   * 处理新建分支
   */
  async handleNewBranch() {
    this.showModal('new-branch-modal');
  }

  /**
   * 处理新建分支表单提交
   */
  async handleNewBranchSubmit(e) {
    e.preventDefault();
    
    try {
      const formData = new FormData(e.target);
      const branchName = formData.get('branchName').trim();
      const checkoutNewBranch = document.getElementById('checkout-new-branch').checked;
      
      if (!branchName) {
        this.showError('请输入分支名称');
        return;
      }

      if (!this.currentProject) {
        this.showError('请先打开一个项目');
        return;
      }

      const success = await window.gitManager.createBranch(this.currentProject.path, branchName, checkoutNewBranch);
      
      if (success) {
        this.closeModal('new-branch-modal');
        this.loadGitBranches();
        document.getElementById('new-branch-form').reset();
      }
    } catch (error) {
      console.error('新建分支失败:', error);
      this.showError('分支创建失败，请重试');
    }
  }

  /**
   * 处理添加远程仓库
   */
  async handleAddRemote() {
    try {
      // 显示添加远程仓库模态框
      this.showModal('add-remote-modal');
      
      // 设置表单提交事件处理器
      const form = document.getElementById('add-remote-form');
      const handleSubmit = async (e) => {
        e.preventDefault();
        
        const remoteName = document.getElementById('remote-name').value.trim();
        const remoteUrl = document.getElementById('remote-url').value.trim();
        
        if (!remoteName || !remoteUrl) {
          this.showError('请填写完整的远程仓库信息');
          return;
        }
        
        try {
          const result = await window.electronAPI.gitAddRemote(this.currentProject.path, remoteName, remoteUrl);
          
          if (result.success) {
            this.showSuccess('远程仓库添加成功');
            this.loadGitRemotes();
            this.closeModal('add-remote-modal');
            
            // 重置表单
            document.getElementById('remote-name').value = 'origin';
            document.getElementById('remote-url').value = '';
          } else {
            this.showError('远程仓库添加失败: ' + result.error);
          }
        } catch (error) {
          console.error('添加远程仓库失败:', error);
          this.showError('远程仓库添加失败，请重试');
        }
        
        // 移除事件监听器
        form.removeEventListener('submit', handleSubmit);
      };
      
      // 添加事件监听器
      form.addEventListener('submit', handleSubmit);
      
    } catch (error) {
      console.error('添加远程仓库失败:', error);
      this.showError('远程仓库添加失败，请重试');
    }
  }

  /**
   * 设置当前项目（供Git管理器使用）
   * @param {string} projectPath - 项目路径
   */
  setCurrentProject(projectPath) {
    try {
      this.cachedProjectPath = projectPath;
      if (this.currentProject) {
        this.currentProject.path = projectPath;
      }
      console.log('当前项目路径已设置:', projectPath);
    } catch (error) {
      console.error('设置当前项目失败:', error);
    }
  }

  /**
   * 设置右键菜单
   */
  setupContextMenus() {
    // 这个方法由 context-menu.js 模块处理
    // 在新模块初始化时会自动设置
    console.log('右键菜单将由 ContextMenuManager 处理');
  }

  /**
   * 设置项目右键菜单
   */
  setupProjectContextMenu() {
    const projectsList = document.getElementById('recent-projects');
    if (!projectsList) return;

    projectsList.addEventListener('contextmenu', (e) => {
      const projectItem = e.target.closest('.project-item');
      if (projectItem) {
        e.preventDefault();
        const menu = document.getElementById('project-context-menu');
        if (menu) {
          this.showContextMenu(menu, projectItem, e.clientX, e.clientY);
        }
      }
    });
  }

  /**
   * 设置章节右键菜单
   */
  setupChapterContextMenu() {
    const chaptersList = document.getElementById('chapters-list');
    if (!chaptersList) return;

    chaptersList.addEventListener('contextmenu', (e) => {
      const chapterItem = e.target.closest('.chapter-item');
      if (chapterItem) {
        e.preventDefault();
        const menu = document.getElementById('chapter-context-menu');
        if (menu) {
          this.showContextMenu(menu, chapterItem, e.clientX, e.clientY);
        }
      }
    });
  }

  /**
   * 设置编辑器右键菜单
   */
  setupEditorContextMenu() {
    const editorTextarea = document.getElementById('editor-textarea');
    if (!editorTextarea) return;

    editorTextarea.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const menu = document.getElementById('editor-context-menu');
      if (menu) {
        this.showContextMenu(menu, editorTextarea, e.clientX, e.clientY);
      }
    });
  }

  /**
   * 处理右键菜单动作
   */
  async handleContextMenuAction(action, target) {
    try {
      switch (action) {
        case 'open-project':
          await this.handleProjectContextAction('open', target);
          break;
        case 'export-project':
          await this.handleProjectContextAction('export', target);
          break;
        case 'delete-project':
          await this.handleProjectContextAction('delete', target);
          break;
        case 'open-chapter':
          await this.handleChapterContextAction('open', target);
          break;
        case 'rename-chapter':
          await this.handleChapterContextAction('rename', target);
          break;
        case 'delete-chapter':
          await this.handleChapterContextAction('delete', target);
          break;
        case 'cut':
          document.execCommand('cut');
          break;
        case 'copy':
          document.execCommand('copy');
          break;
        case 'paste':
          document.execCommand('paste');
          break;
        case 'select-all':
          target.select();
          break;
        case 'bold':
          if (window.editorManager) {
            window.editorManager.insertMarkdownFormat('**', '**', '加粗文本');
          }
          break;
        case 'italic':
          if (window.editorManager) {
            window.editorManager.insertMarkdownFormat('*', '*', '斜体文本');
          }
          break;
        case 'underline':
          if (window.editorManager) {
            window.editorManager.insertMarkdownFormat('<u>', '</u>', '下划线文本');
          }
          break;
        case 'heading':
          if (window.editorManager) {
            window.editorManager.insertHeading(2);
          }
          break;
        case 'quote':
          if (window.editorManager) {
            window.editorManager.insertQuote();
          }
          break;
        case 'code':
          if (window.editorManager) {
            window.editorManager.insertMarkdownFormat('`', '`', '代码');
          }
          break;
        default:
          console.warn('未知的右键菜单动作:', action);
      }
    } catch (error) {
      console.error('处理右键菜单动作失败:', error);
    }
  }

  /**
   * 处理项目右键菜单动作
   */
  async handleProjectContextAction(action, target) {
    const projectPath = target.dataset.path;
    if (!projectPath) return;

    switch (action) {
      case 'open':
        await this.openProject(projectPath);
        break;
      case 'export':
        await this.exportProject(projectPath);
        break;
      case 'delete':
        await this.deleteProject(projectPath);
        break;
    }
  }

  /**
   * 处理章节右键菜单动作
   */
  async handleChapterContextAction(action, target) {
    const chapterId = target.dataset.chapterId;
    if (!chapterId) return;

    switch (action) {
      case 'open':
        // 找到对应的章节对象
        const chapter = this.currentProject.chapters.find(ch => ch.id === chapterId);
        if (chapter) {
          await this.loadChapter(chapter);
        }
        break;
      case 'rename':
        await this.renameChapter(chapterId);
        break;
      case 'delete':
        await this.deleteChapter(chapterId);
        break;
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(projectPath) {
    if (!confirm('确定要删除这个项目吗？此操作无法撤销。')) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteProject(projectPath);
      if (result.success) {
        this.showSuccess('项目删除成功');
        
        // 如果删除的是当前项目，清除当前项目状态
        if (this.currentProject && this.currentProject.path === projectPath) {
          this.currentProject = null;
          this.currentChapter = null;
          this.cachedProjectPath = null;
          this.updateProjectUI();
        }
        
        await this.loadRecentProjects();
      } else {
        this.showError('删除项目失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除项目失败:', error);
      this.showError('删除项目失败，请重试');
    }
  }

  /**
   * 重命名章节
   */
  async renameChapter(chapterId, currentTitle = '') {
    const newTitle = await this.showInputModal('重命名章节', '请输入新的章节标题:', currentTitle);
    if (!newTitle || newTitle === currentTitle) return;

    try {
      // 调用后端API重命名章节
      const result = await window.electronAPI.renameChapter({
        projectPath: this.currentProject.path,
        chapterId: chapterId,
        newTitle: newTitle
      });
      
      if (result.success) {
        this.showSuccess('章节重命名成功');
        
        // 更新当前项目的章节列表
        if (this.currentProject && this.currentProject.chapters) {
          const chapter = this.currentProject.chapters.find(ch => ch.id === chapterId);
          if (chapter) {
            chapter.title = newTitle;
          }
        }
        
        // 如果重命名的是当前打开的章节，更新当前章节信息
        if (this.currentChapter && this.currentChapter.id === chapterId) {
          this.currentChapter.title = newTitle;
        }
        
        this.renderChaptersList();
      } else {
        this.showError('重命名章节失败: ' + result.error);
      }
    } catch (error) {
      console.error('重命名章节失败:', error);
      this.showError('重命名章节失败，请重试');
    }
  }

  /**
   * 删除章节
   */
  async deleteChapter(chapterId) {
    if (!confirm('确定要删除这个章节吗？此操作无法撤销。')) {
      return;
    }

    try {
      const result = await window.electronAPI.deleteChapter({
        projectPath: this.currentProject.path,
        chapterId: chapterId
      });
      
      if (result.success) {
        this.showSuccess('章节删除成功');
        
        // 如果删除的是当前章节，清空编辑器
        if (this.currentChapter && this.currentChapter.id === chapterId) {
          this.currentChapter = null;
          const editorTextarea = document.getElementById('editor-textarea');
          if (editorTextarea) {
            editorTextarea.value = '';
          }
        }
        
        // 从项目章节列表中移除
        if (this.currentProject && this.currentProject.chapters) {
          this.currentProject.chapters = this.currentProject.chapters.filter(ch => ch.id !== chapterId);
        }
        
        this.renderChaptersList();
      } else {
        this.showError('删除章节失败: ' + result.error);
      }
    } catch (error) {
      console.error('删除章节失败:', error);
      this.showError('删除章节失败，请重试');
    }
  }

  /**
   * 导出项目为文本文件
   * @param {string} projectPath - 项目路径
   */
  async exportProject(projectPath) {
    try {
      // 加载项目
      const result = await window.electronAPI.loadProject(projectPath);
      if (!result.success) {
        this.showError('无法加载项目: ' + result.error);
        return;
      }

      const project = result.project;
      if (!project.chapters || project.chapters.length === 0) {
        this.showError('项目中没有章节可导出');
        return;
      }

      // 收集所有章节内容
      let exportContent = `${project.name}\n`;
      exportContent += `作者: ${project.author || '未设置'}\n`;
      exportContent += `类型: ${project.genre || '未设置'}\n`;
      exportContent += `描述: ${project.description || '暂无描述'}\n`;
      exportContent += `导出时间: ${new Date().toLocaleString()}\n`;
      exportContent += '\n' + '='.repeat(50) + '\n\n';

      // 逐个加载章节内容
      for (let i = 0; i < project.chapters.length; i++) {
        const chapter = project.chapters[i];
        // 确保章节有标题
        const chapterTitle = chapter.title || chapter.name || `第${i + 1}章`;
        exportContent += `第${i + 1}章 ${chapterTitle}\n`;
        exportContent += '-'.repeat(30) + '\n\n';

        try {
          // 从文件系统加载章节内容
          const chapterResult = await window.electronAPI.loadChapter({
            projectPath: projectPath,
            chapterId: chapter.id
          });

          if (chapterResult.success && chapterResult.chapter.content) {
            exportContent += chapterResult.chapter.content;
          } else {
            // 如果文件不存在，使用项目中保存的内容
            exportContent += chapter.content || '(此章节暂无内容)';
          }
        } catch (error) {
          console.error(`加载章节 ${chapterTitle} 失败:`, error);
          exportContent += chapter.content || '(此章节暂无内容)';
        }

        exportContent += '\n\n';
        if (i < project.chapters.length - 1) {
          exportContent += '\n' + '='.repeat(50) + '\n\n';
        }
      }

      // 创建并下载文件
      const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}_完整版_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccess('项目导出成功！');
    } catch (error) {
      console.error('导出项目失败:', error);
      this.showError('导出项目失败: ' + error.message);
    }
  }

  /**
   * 导出设置
   */
  async exportSettings() {
    try {
      const result = await window.electronAPI.showSaveDialog({
        title: '导出设置',
        defaultPath: `artimeow-settings-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON 文件', extensions: ['json'] }
        ]
      });

      if (!result.canceled && result.filePath) {
        await window.electronAPI.exportSettings(result.filePath);
        this.showSuccess('设置导出成功');
      }
    } catch (error) {
      console.error('Export settings error:', error);
      this.showError('设置导出失败');
    }
  }

  /**
   * 导入设置
   */
  async importSettings() {
    try {
      const result = await window.electronAPI.showOpenDialog({
        title: '导入设置',
        filters: [
          { name: 'JSON 文件', extensions: ['json'] }
        ],
        properties: ['openFile']
      });

      if (!result.canceled && result.filePaths.length > 0) {
        await window.electronAPI.importSettings(result.filePaths[0]);
        this.showSuccess('设置导入成功');
        // 重新加载设置
        await this.loadSettings();
        this.loadSettingsToModal();
      }
    } catch (error) {
      console.error('Import settings error:', error);
      this.showError('设置导入失败');
    }
  }

  /**
   * 重置所有设置
   */
  async resetAllSettings() {
    const confirmed = await this.showConfirmModal('重置设置', '确定要重置所有设置到默认值吗？此操作无法撤销。');
    
    if (confirmed) {
      try {
        await window.electronAPI.resetSettings();
        this.showSuccess('设置已重置');
        // 重新加载设置
        await this.loadSettings();
        this.loadSettingsToModal();
      } catch (error) {
        console.error('Reset settings error:', error);
        this.showError('重置设置失败');
      }
    }
  }

  /**
   * 创建手动备份
   */
  async createManualBackup() {
    if (!this.currentProject) {
      this.showError('请先打开一个项目');
      return;
    }

    try {
      const result = await window.electronAPI.createBackup(this.currentProject.path);
      
      if (result && result.success) {
        this.showSuccess(`备份创建成功！备份位置：${result.backupPath || '默认备份文件夹'}`);
        console.log('备份创建成功:', result);
      } else {
        this.showError('备份创建失败：' + (result?.error || '未知错误'));
        console.error('备份创建失败:', result);
      }
    } catch (error) {
      console.error('Create backup error:', error);
      this.showError('备份创建失败：' + error.message);
    }
  }

  /**
   * 打开备份文件夹
   */
  async openBackupFolder() {
    try {
      await window.electronAPI.openBackupFolder();
    } catch (error) {
      console.error('Open backup folder error:', error);
      this.showError('打开备份文件夹失败');
    }
  }

  /**
   *  * 预览字体大小
   */
  previewFontSize(size) {
    const editorTextarea = document.getElementById('editor-textarea');
    if (editorTextarea) {
      editorTextarea.style.fontSize = `${size}px`;
    }
  }

  /**
   * 预览行高
   */
  previewLineHeight(height) {
    const editorTextarea = document.getElementById('editor-textarea');
    if (editorTextarea) {
      editorTextarea.style.lineHeight = height;
    }
  }

  /**
   * 预览字体族
   */
  previewFontFamily(family) {
    const editorTextarea = document.getElementById('editor-textarea');
    if (editorTextarea) {
      editorTextarea.style.fontFamily = family;
    }
  }

  /**
   * 保持Git终端窗口弹出且可交互
   */
  async openGitTerminal() {
    const projectPath = this.cachedProjectPath || this.currentProject?.path;
    
    if (!projectPath) {
      this.showError('请先选择一个项目');
      return;
    }
    
    try {
      // 通过 Electron API 打开终端，workingDirectory 设为项目路径
      const result = await window.electronAPI.openTerminal('', projectPath);
      if (result && result.success) {
        this.showSuccess('已打开终端，当前目录：' + projectPath);
      } else {
        this.showError('终端打开失败：' + (result?.error || '未知错误'));
      }
    } catch (error) {
      console.error('终端打开失败:', error);
      this.showError('终端打开失败：' + error.message);
    }
  }

  /**
   * 供 Git 面板按钮调用，确保项目路径已设置
   */
  bindGitTerminalButton() {
    const gitTerminalBtns = document.querySelectorAll('.git-terminal-btn');
    gitTerminalBtns.forEach(btn => {
      btn.onclick = () => this.openGitTerminal();
    });
  }

  /**
   * 收集设置面板中的所有设置
   */
  collectSettingsFromModal() {
    const settings = {
      ai: {
        selectedEngine: String(document.getElementById('ai-engine')?.value || 'openai'),
        systemPrompt: document.getElementById('system-prompt')?.value || '',
        engines: {}
      },
      editor: {
        fontSize: parseInt(document.getElementById('editor-font-size')?.value) || 16,
        fontFamily: document.getElementById('editor-font-family')?.value || 'Georgia, serif',
        lineHeight: parseFloat(document.getElementById('editor-line-height')?.value) || 1.5,
        theme: document.getElementById('editor-theme')?.value || 'dark',
        autoSave: document.getElementById('auto-save')?.checked || false,
        autoSaveInterval: parseInt(document.getElementById('auto-save-interval')?.value) || 30
      },
      git: {
        userName: document.getElementById('git-username')?.value || '',
        userEmail: document.getElementById('git-email')?.value || ''
      },
      general: {
        projectsDir: document.getElementById('projects-dir')?.value || '',
        backupEnabled: document.getElementById('backup-enabled')?.checked || false,
        backupInterval: parseInt(document.getElementById('backup-interval')?.value) || 24,
        backupKeepCount: parseInt(document.getElementById('backup-keep-count')?.value) || 10
      }
    };
    // 收集各引擎设置
    settings.ai.engines.openai = {
      apiKey: document.getElementById('openai-api-key')?.value || '',
      model: document.getElementById('openai-model')?.value || 'gpt-4',
      baseURL: 'https://api.openai.com/v1'
    };
    settings.ai.engines.ollama = {
      baseURL: document.getElementById('ollama-url')?.value || 'http://localhost:11434',
      model: document.getElementById('ollama-model')?.value || 'llama2'
    };
    settings.ai.engines.llamacpp = {
      baseURL: document.getElementById('llamacpp-url')?.value || 'http://localhost:8080',
      model: document.getElementById('llamacpp-model')?.value || 'llama2'
    };
    settings.ai.engines.custom = {
      apiKey: document.getElementById('custom-api-key')?.value || '',
      baseURL: document.getElementById('custom-base-url')?.value || '',
      model: document.getElementById('custom-model')?.value || '',
      temperature: parseFloat(document.getElementById('custom-temperature')?.value) || 0.7,
      maxTokens: parseInt(document.getElementById('custom-max-tokens')?.value) || 1000
    };
    return settings;
  }

  /**
   * 保存所有设置
   */
  async saveAllSettings() {
    try {
      const settings = this.collectSettingsFromModal();
      // 调试信息
      console.log('准备保存设置:', JSON.stringify(settings, null, 2));
      // 保存设置
      const result = await window.electronAPI.saveSettings(settings);
      console.log('设置保存结果:', result);
      // 更新本地设置
      this.settings = settings;
      // 应用设置
      this.applySettings();
      // 如果启用了自动保存，重新初始化
      if (settings.editor.autoSave) {
        this.initAutoSave();
      }
      this.showSuccess('设置已保存');
      this.closeModal('settings-modal');
    } catch (error) {
      console.error('Save settings error:', error);
      this.showError('保存设置失败');
    }
  }

  /**
   * 测试AI连接
   */
  async testAIConnection() {
    try {
      // 获取当前AI引擎设置
      const aiEngine = document.getElementById('ai-engine')?.value || 'openai';
      
      const engineSettings = {
        openai: {
          apiKey: document.getElementById('openai-api-key')?.value || '',
          model: document.getElementById('openai-model')?.value || 'gpt-4'
        },
        ollama: {
          baseURL: document.getElementById('ollama-url')?.value || 'http://localhost:11434',
          model: document.getElementById('ollama-model')?.value || 'llama2'
        },
        llamacpp: {
          baseURL: document.getElementById('llamacpp-url')?.value || 'http://localhost:8080',
          model: document.getElementById('llamacpp-model')?.value || 'llama2'
        },
        custom: {
          apiKey: document.getElementById('custom-api-key')?.value || '',
          baseURL: document.getElementById('custom-base-url')?.value || '',
          model: document.getElementById('custom-model')?.value || ''
        }
      };

      console.log('测试AI连接:', aiEngine, engineSettings[aiEngine]);
      
      if (window.electronAPI && window.electronAPI.testAIConnection) {
        const result = await window.electronAPI.testAIConnection(aiEngine, engineSettings[aiEngine]);
        
        if (result.success) {
          this.showSuccess('AI连接测试成功！');
        } else {
          this.showError('AI连接测试失败: ' + result.error);
        }
      } else {
        this.showError('AI连接测试功能不可用');
      }
    } catch (error) {
      console.error('Test AI connection error:', error);
      this.showError('AI连接测试失败: ' + error.message);
    }
  }

  /**
   * 初始化增强模块
   */
  initEnhancedModules() {
    try {
      // 初始化右键菜单
      if (typeof window.ContextMenuManager !== 'undefined') {
        window.contextMenuManager = new window.ContextMenuManager();
        console.log('右键菜单管理器已初始化');
      }
      
      // 初始化Git增强功能（使用已有的全局实例）
      if (window.gitEnhancedManager) {
        console.log('Git增强功能已初始化');
      }
      
      // 初始化Markdown增强编辑器（使用已有的全局实例）
      if (window.markdownEnhancedEditor) {
        console.log('Markdown增强编辑器已初始化');
      }
      
    } catch (error) {
      console.error('初始化增强模块失败:', error);
    }
  }

  /**
   * 刷新预览面板（供外部调用）
   */
  refreshPreview() {
    if (this.markdownEnhancedEditor) {
      this.markdownEnhancedEditor.refreshPreview();
    }
  }

  /**
   * 初始化编辑器管理器
   */
  initEditorManager() {
    try {
      // 初始化编辑器管理器
      if (typeof EditorManager !== 'undefined') {
        window.editorManager = new EditorManager();
        console.log('编辑器管理器已初始化');
      }
    } catch (error) {
      console.error('初始化编辑器管理器失败:', error);
    }
  }

  /**
   * 切换到 AI 助手面板
   */
  switchToAIAssistant() {
    // 找到 AI 助手标签页（正确的ID是ai）
    const aiTab = document.querySelector('[data-tab="ai"]');
    if (aiTab) {
      aiTab.click();
    }
  }

  /**
   * 设置 AI 提示并切换到 AI 助手
   */
  setAIPromptAndSwitchToAI(prompt) {
    // 先切换到 AI 助手
    this.switchToAIAssistant();
    
    // 设置提示内容
    setTimeout(() => {
      const aiPromptTextarea = document.getElementById('ai-prompt-input');
      if (aiPromptTextarea) {
        aiPromptTextarea.value = prompt;
        aiPromptTextarea.focus();
      }
    }, 100);
  }

  /**
   * 应用主题
   * @param {string} theme - 主题名称
   */
  async applyTheme(theme) {
    const body = document.body;
    // 移除所有主题类
    body.classList.remove('light-theme', 'dark-theme', 'auto-theme');
    
    // 应用新主题
    switch (theme) {
      case 'light':
        body.classList.add('light-theme');
        break;
      case 'dark':
        // 深色主题是默认的，不需要添加特殊类
        break;
      case 'auto':
        // 检测系统主题偏好
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (!prefersDark) {
          body.classList.add('light-theme');
        }
        // 监听系统主题变化
        this.watchSystemTheme();
        break;
      default:
        // 默认深色主题，不需要添加类
    }
    
    // 保存设置
    if (window.electronAPI && window.electronAPI.setTheme) {
      await window.electronAPI.setTheme(theme);
    }
  }

  /**
   * 监听系统主题变化
   */
  watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addListener((e) => {
      const body = document.body;
      if (e.matches) {
        body.classList.remove('light-theme');
      } else {
        body.classList.add('light-theme');
      }
    });
  }

  /**
   * 初始化主题
   */
  async initTheme() {
    try {
      const result = await window.electronAPI.getTheme();
      if (result.success) {
        await this.applyTheme(result.theme);
      }
    } catch (error) {
      console.error('Initialize theme error:', error);
      await this.applyTheme('dark'); // 默认深色主题
    }
  }

  /**
   * 初始化自动保存
   * @param {string} projectPath - 项目路径
   */
  async initAutoSave(projectPath) {
    try {
      const settings = await window.electronAPI.getSettings();
      if (settings.editor && settings.editor.autoSave && projectPath) {
        // 清除之前的定时器
        if (this.autoSaveTimer) {
          clearInterval(this.autoSaveTimer);
        }
        
        // 设置定时自动保存
        this.autoSaveTimer = setInterval(() => {
          if (this.currentProject && this.currentChapter) {
            this.saveCurrentChapter(true); // true表示自动保存
          }
        }, (settings.editor.autoSaveInterval || 30) * 1000);
        
        console.log('自动保存已启用，间隔：', settings.editor.autoSaveInterval || 30, '秒');
      }
    } catch (error) {
      console.error('Initialize auto save error:', error);
    }
  }

  /**
   * 创建项目备份
   * @param {string} projectPath - 项目路径
   */
  async createProjectBackup(projectPath) {
    try {
      const result = await window.electronAPI.createBackup(projectPath);
      if (result.success) {
        this.showSuccess(`备份创建成功: ${result.backupPath}`);
      } else {
        this.showError(`备份创建失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Create backup error:', error);
      this.showError('备份创建失败');
    }
  }

  /**
   * 显示自动保存指示器
   */
  showAutoSaveIndicator() {
    // 移除现有指示器
    const existingIndicator = document.querySelector('.auto-save-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    // 创建新指示器
    const indicator = document.createElement('div');
    indicator.className = 'auto-save-indicator';
    indicator.innerHTML = '<i class="fas fa-check-circle"></i> 自动保存完成';
    document.body.appendChild(indicator);
    // 显示动画
    setTimeout(() => {
      indicator.classList.add('show');
    }, 100);
    // 3秒后隐藏
    setTimeout(() => {
      indicator.classList.remove('show');
      setTimeout(() => {
        indicator.remove();
      }, 300);
    }, 3000);
  }

  /**
   * 初始化Git教程事件
   */
  initGitTutorialEvents() {
    try {
      // Git 分支教程按钮
      const branchTutorialBtn = document.getElementById('git-branches-tutorial-btn');
      if (branchTutorialBtn) {
        branchTutorialBtn.addEventListener('click', () => {
          this.showGitTutorial('branches');
        });
      }

      // Git 远程仓库教程按钮
      const remoteTutorialBtn = document.getElementById('git-remotes-tutorial-btn');
      if (remoteTutorialBtn) {
        remoteTutorialBtn.addEventListener('click', () => {
          this.showGitTutorial('remotes');
        });
      }

      // Git 教程浮窗关闭按钮
      const tutorialCloseBtn = document.getElementById('git-tutorial-close');
      if (tutorialCloseBtn) {
        tutorialCloseBtn.addEventListener('click', () => {
          this.hideGitTutorial();
        });
      }

      // 点击浮窗外部关闭
      const tutorialPopup = document.getElementById('git-tutorial-popup');
      if (tutorialPopup) {
        tutorialPopup.addEventListener('click', (e) => {
          if (e.target === tutorialPopup) {
            this.hideGitTutorial();
          }
        });
      }

      console.log('Git教程事件已初始化');
    } catch (error) {
      console.error('初始化Git教程事件失败:', error);
    }
  }

  /**
   * 显示Git教程浮窗
   * @param {string} type - 教程类型：'branches' 或 'remotes'
   */
  showGitTutorial(type) {
    const popup = document.getElementById('git-tutorial-popup');
    const title = document.getElementById('git-tutorial-title');
    const content = document.getElementById('git-tutorial-text');
    
    if (!popup || !title || !content) {
      console.error('Git教程浮窗元素不存在');
      return;
    }

    // 设置教程内容
    const tutorials = {
      branches: {
        title: 'Git 分支管理教程',
        content: `
          <div class="git-tutorial-section">
            <h4>常用分支命令：</h4>
            <div class="git-command">
              <code>git branch</code>
              <span class="git-command-desc">查看本地分支</span>
            </div>
            <div class="git-command">
              <code>git branch -r</code>
              <span class="git-command-desc">查看远程分支</span>
            </div>
            <div class="git-command">
              <code>git branch &lt;branch-name&gt;</code>
              <span class="git-command-desc">创建新分支</span>
            </div>
            <div class="git-command">
              <code>git checkout &lt;branch-name&gt;</code>
              <span class="git-command-desc">切换分支</span>
            </div>
            <div class="git-command">
              <code>git checkout -b &lt;branch-name&gt;</code>
              <span class="git-command-desc">创建并切换到新分支</span>
            </div>
            <div class="git-command">
              <code>git merge &lt;branch-name&gt;</code>
              <span class="git-command-desc">合并分支</span>
            </div>
            <div class="git-command">
              <code>git branch -d &lt;branch-name&gt;</code>
              <span class="git-command-desc">删除本地分支</span>
            </div>
          </div>
        `
      },
      remotes: {
        title: 'Git 远程仓库教程',
        content: `
          <div class="git-tutorial-section">
            <h4>常用远程仓库命令：</h4>
            <div class="git-command">
              <code>git remote -v</code>
              <span class="git-command-desc">查看远程仓库</span>
            </div>
            <div class="git-command">
              <code>git remote add &lt;name&gt; &lt;url&gt;</code>
              <span class="git-command-desc">添加远程仓库</span>
            </div>
            <div class="git-command">
              <code>git push &lt;remote&gt; &lt;branch&gt;</code>
              <span class="git-command-desc">推送到远程仓库</span>
            </div>
            <div class="git-command">
              <code>git pull &lt;remote&gt; &lt;branch&gt;</code>
              <span class="git-command-desc">从远程仓库拉取</span>
            </div>
            <div class="git-command">
              <code>git fetch &lt;remote&gt;</code>
              <span class="git-command-desc">获取远程仓库信息</span>
            </div>
            <div class="git-command">
              <code>git push -u &lt;remote&gt; &lt;branch&gt;</code>
              <span class="git-command-desc">推送并设置上游分支</span>
            </div>
            <div class="git-command">
              <code>git remote rm &lt;name&gt;</code>
              <span class="git-command-desc">删除远程仓库</span>
            </div>
          </div>
        `
      }
    };

    const tutorial = tutorials[type];
    if (!tutorial) {
      console.error('未知的教程类型:', type);
      return;
    }

    // 设置内容
    title.textContent = tutorial.title;
    content.innerHTML = tutorial.content;

    // 显示浮窗
    popup.style.display = 'flex';
    popup.classList.add('show');
  }

  /**
   * 隐藏Git教程浮窗
   */
  hideGitTutorial() {
    const popup = document.getElementById('git-tutorial-popup');
    if (popup) {
      popup.classList.remove('show');
      setTimeout(() => {
        popup.style.display = 'none';
      }, 300);
    }
  }

  /**
   * 更新Git状态
   */
  async updateGitStatus() {
    if (!this.currentProject) {
      const gitStatusElement = document.getElementById('git-status');
      if (gitStatusElement) {
        gitStatusElement.innerHTML = '<i class="fas fa-code-branch"></i> 未连接';
        gitStatusElement.className = 'git-status disconnected';
      }
      return;
    }
    
    try {
      // 通知Git增强管理器刷新状态
      if (window.gitEnhancedManager) {
        window.gitEnhancedManager.setCurrentProject(this.currentProject.path);
        window.gitEnhancedManager.refreshGitStatus();
      }
      
      // 更新状态指示器
      const result = await window.electronAPI.getGitStatus(this.currentProject.path);
      const gitStatusElement = document.getElementById('git-status');
      if (gitStatusElement && result.success) {
        const status = result.status;
        if (status.isRepo) {
          if (status.isClean) {
            gitStatusElement.innerHTML = '<i class="fas fa-code-branch"></i> 已同步';
            gitStatusElement.className = 'git-status connected';
          } else {
            gitStatusElement.innerHTML = `<i class="fas fa-code-branch"></i> ${status.changedFiles}个更改`;
            gitStatusElement.className = 'git-status changes';
          }
        } else {
          gitStatusElement.innerHTML = '<i class="fas fa-code-branch"></i> 非Git仓库';
          gitStatusElement.className = 'git-status disconnected';
        }
      } else {
        gitStatusElement.innerHTML = '<i class="fas fa-code-branch"></i> 错误';
        gitStatusElement.className = 'git-status disconnected';
      }
      console.log('Git状态已更新');
    } catch (error) {
      console.error('更新Git状态失败:', error);
      const gitStatusElement = document.getElementById('git-status');
      if (gitStatusElement) {
        gitStatusElement.innerHTML = '<i class="fas fa-code-branch"></i> 未连接';
        gitStatusElement.className = 'git-status disconnected';
      }
    }
  }

  /**
   * 初始化外部链接处理
   */
  initExternalLinkHandling() {
    // 为所有预览区域添加链接处理
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('external-link')) {
        e.preventDefault();
        const url = e.target.getAttribute('href');
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          // 使用 Electron 的 shell 打开外部浏览器
          if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(url).then(result => {
              if (!result.success) {
                console.error('Failed to open external link:', result.error);
                // 备用方案
                window.open(url, '_blank');
              }
            }).catch(error => {
              console.error('Error opening external link:', error);
              // 备用方案
              window.open(url, '_blank');
            });
          } else {
            // 备用方案
            window.open(url, '_blank');
          }
        }
      }
    });
  }

  /**
   * 初始化章节搜索功能
   */
  initChapterSearch() {
    const searchInput = document.getElementById('chapter-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterChapters(e.target.value);
      });
      
      // 清空搜索按钮
      const clearBtn = document.getElementById('chapter-search-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          searchInput.value = '';
          this.filterChapters('');
        });
      }
    }
  }

  /**
   * 根据关键词过滤章节
   * @param {string} keyword - 搜索关键词
   */
  filterChapters(keyword) {
    if (!this.currentProject || !this.currentProject.chapters) {
      return;
    }

    const chapterItems = document.querySelectorAll('.chapter-item');
    const searchKeyword = keyword.toLowerCase().trim();

    chapterItems.forEach(item => {
      const chapterTitle = item.querySelector('.chapter-title')?.textContent?.toLowerCase() || '';
      const chapterFilename = item.dataset.chapter?.toLowerCase() || '';
      
      if (!searchKeyword || 
          chapterTitle.includes(searchKeyword) || 
          chapterFilename.includes(searchKeyword)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });

    // 更新搜索状态 - 显示清除按钮时隐藏搜索图标
    const clearBtn = document.getElementById('chapter-search-clear');
    const searchIcon = document.querySelector('.chapter-search-icon');
    if (clearBtn && searchIcon) {
      if (searchKeyword) {
        clearBtn.style.display = 'block';
        searchIcon.style.display = 'none';
      } else {
        clearBtn.style.display = 'none';
        searchIcon.style.display = 'block';
      }
    }
  }

  /**
   * 打开角色管理对话框
   */
  openCharacterManagement() {
    if (!this.currentProject) {
      this.showError('请先打开项目');
      return;
    }

    // 初始化角色管理器
    if (!this.characterManager) {
      this.characterManager = new CharacterManager(this.currentProject.path);
    }

    // 显示角色管理模态框
    this.showModal('character-management-modal');
    
    // 加载角色数据
    this.characterManager.loadData();
  }

  // ...existing code...
}

/**
 * 关闭输入模态框（全局函数）
 * @param {boolean} confirmed - 是否确认
 */
window.closeInputModal = function(confirmed) {
  if (window.appManager) {
    window.appManager.closeInputModal(confirmed);
  }
};

/**
 * 关闭模态框（全局函数）
 * @param {string} modalId - 模态框ID
 */
window.closeModal = function(modalId) {
  if (window.appManager) {
    window.appManager.closeModal(modalId);
  }
};

/**
 * 显示模态框（全局函数）
 * @param {string} modalId - 模态框ID
 */
window.showModal = function(modalId) {
  if (window.appManager) {
    window.appManager.showModal(modalId);
  }
};

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  const app = new ArtiMeowApp();
  
  // 导出应用实例供其他模块使用
  window.appManager = app;

  // 全局错误处理
  window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    if (app) {
      app.showError('应用遇到错误，请查看控制台');
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的 Promise 拒绝:', event.reason);
    if (app) {
      app.showError('操作失败，请重试');
    }
  });
});
