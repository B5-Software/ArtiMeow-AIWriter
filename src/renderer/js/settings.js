/**
 * 设置管理模块
 * 处理应用程序设置、AI 配置、主题等
 */

class SettingsManager {
    constructor() {
        this.settings = {};
        this.defaultSettings = {
            // AI 设置
            ai: {
                engines: {
                    openai: {
                        apiKey: '',
                        baseURL: 'https://api.openai.com/v1',
                        model: 'gpt-4'
                    },
                    ollama: {
                        baseURL: 'http://localhost:11434',
                        model: 'llama2'
                    },
                    llamacpp: {
                        baseURL: 'http://localhost:8080',
                        model: 'llama2'
                    },
                    custom: {
                        apiKey: '',
                        baseURL: '',
                        model: '',
                        temperature: 0.7,
                        maxTokens: 1000
                    }
                },
                selectedEngine: 'openai',
                systemPrompt: '你是一位专业的小说家，擅长创作各种类型的小说。请根据用户提供的上下文和要求，续写精彩的故事内容。保持故事的连贯性和风格一致性，每次生成约500-1000字的内容。',
                agentMode: false,
                agentPrompt: '请根据故事的发展，自动续写下一章节的内容。',
                temperature: 0.7,
                maxTokens: 2000
            },
            
            // Git 设置
            git: {
                userName: '',
                userEmail: '',
                defaultRemote: 'origin',
                defaultBranch: 'main'
            },
            
            // 编辑器设置
            editor: {
                fontSize: 16,
                fontFamily: 'Georgia, serif',
                theme: 'dark',
                autoSave: true,
                autoSaveInterval: 30000
            },
            
            // 通用设置
            general: {
                language: 'zh-CN',
                projectsDir: '',
                backupEnabled: true,
                backupInterval: 300000 // 5分钟
            }
        };
        
        // 不在构造函数中初始化，等待DOM完全加载
    }

    /**
     * 初始化设置管理器
     */
    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateSettingsUI();
        this.applySettings();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 设置标签切换
        const settingsTabs = document.querySelectorAll('.settings-tab');
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchSettingsTab(e.target.dataset.tab);
            });
        });

        // AI 引擎切换
        const aiEngineSelect = document.getElementById('ai-engine');
        if (aiEngineSelect) {
            aiEngineSelect.addEventListener('change', (e) => {
                this.switchAIEngine(e.target.value);
            });
        }

        // 重置提示词按钮
        const resetPromptBtn = document.getElementById('reset-prompt-btn');
        if (resetPromptBtn) {
            resetPromptBtn.addEventListener('click', () => {
                this.resetSystemPrompt();
            });
        }

        // 主题切换
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', () => {
                this.toggleTheme();
            });
        }

        // 字体大小滑块
        const fontSizeSlider = document.getElementById('editor-font-size');
        if (fontSizeSlider) {
            fontSizeSlider.addEventListener('input', (e) => {
                this.updateFontSize(parseInt(e.target.value));
                const fontSizeValue = document.getElementById('font-size-value');
                if (fontSizeValue) {
                    fontSizeValue.textContent = `${e.target.value}px`;
                }
            });
        }

        // 字体族选择
        const fontFamilySelect = document.getElementById('editor-font-family');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', (e) => {
                this.updateFontFamily(e.target.value);
            });
        }

        // 自动保存切换
        const autoSaveCheckbox = document.getElementById('auto-save');
        if (autoSaveCheckbox) {
            autoSaveCheckbox.addEventListener('change', (e) => {
                this.set('editorSettings.autoSave', e.target.checked);
            });
        }

        // 保存设置按钮
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                this.saveAllSettings();
            });
        }

        // 选择项目目录按钮
        const chooseProjectsDirBtn = document.getElementById('choose-projects-dir');
        if (chooseProjectsDirBtn) {
            chooseProjectsDirBtn.addEventListener('click', () => {
                this.chooseProjectsDirectory();
            });
        }

        // 测试AI连接按钮
        const testAIBtn = document.getElementById('test-ai-connection');
        if (testAIBtn) {
            testAIBtn.addEventListener('click', () => {
                this.testAIConnection();
            });
        }

        // 导出/导入设置按钮现在由 app.js 处理，避免重复绑定

        // 其他按钮保持原有功能
    }

    /**
     * 切换设置标签
     * @param {string} tabName - 标签名
     */
    switchSettingsTab(tabName) {
        // 移除所有活动状态
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        // 激活选中的标签和面板
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        const activePanel = document.getElementById(`${tabName}-settings`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activePanel) activePanel.classList.add('active');
    }

    /**
     * 切换AI引擎
     * @param {string} engine - 引擎名称
     */
    switchAIEngine(engine) {
        // 隐藏所有引擎设置
        document.querySelectorAll('.engine-settings').forEach(setting => {
            setting.classList.add('hidden');
        });

        // 显示选中的引擎设置
        const engineSettings = document.getElementById(`${engine}-settings`);
        if (engineSettings) {
            engineSettings.classList.remove('hidden');
        }

        // 更新设置
        this.set('aiSettings.provider', engine);
    }

    /**
     * 重置系统提示词
     */
    resetSystemPrompt() {
        const defaultPrompt = this.getDefaultSystemPrompt();
        const systemPromptTextarea = document.getElementById('system-prompt');
        
        if (systemPromptTextarea) {
            systemPromptTextarea.value = defaultPrompt;
        }
        
        this.set('aiSettings.systemPrompt', defaultPrompt);
        
        if (window.appManager) {
            window.appManager.showNotification('系统提示词已重置为默认值', 'success');
        }
    }

    /**
     * 获取默认系统提示词
     * @returns {string} 默认提示词
     */
    getDefaultSystemPrompt() {
        return `你是一名专业的小说写作助手，擅长创作各种类型的小说。请根据用户的要求，创作出优质、引人入胜的小说内容。

写作要求：
1. 保持语言流畅自然，文笔优美
2. 注重情节的连贯性和合理性
3. 人物性格要鲜明，对话要符合人物特点
4. 适当增加细节描写，增强画面感
5. 保持适当的节奏感，张弛有度

请根据上述要求，为用户创作小说内容。`;
    }

    /**
     * 保存所有设置
     */
    async saveAllSettings() {
        try {
            // 收集所有表单数据
            await this.collectFormSettings();
            await this.saveSettings();
            
            if (window.appManager) {
                window.appManager.showNotification('设置保存成功', 'success');
                window.appManager.closeModal('settings-modal');
            }
        } catch (error) {
            console.error('Save settings error:', error);
            if (window.appManager) {
                window.appManager.showNotification('设置保存失败', 'error');
            }
        }
    }

    /**
     * 收集表单设置
     */
    async collectFormSettings() {
        // 收集AI设置
        const aiEngine = document.getElementById('ai-engine')?.value;
        if (aiEngine) {
            await this.set('ai.selectedEngine', aiEngine);
        }

        const systemPrompt = document.getElementById('system-prompt')?.value;
        if (systemPrompt !== undefined) {
            await this.set('ai.systemPrompt', systemPrompt);
        }

        // 根据选择的引擎收集对应设置
        if (aiEngine === 'openai') {
            const apiKey = document.getElementById('openai-api-key')?.value;
            const model = document.getElementById('openai-model')?.value;
            if (apiKey !== undefined) await this.set('ai.engines.openai.apiKey', apiKey);
            if (model) await this.set('ai.engines.openai.model', model);
        } else if (aiEngine === 'ollama') {
            const url = document.getElementById('ollama-url')?.value;
            const model = document.getElementById('ollama-model')?.value;
            if (url) await this.set('ai.engines.ollama.baseURL', url);
            if (model) await this.set('ai.engines.ollama.model', model);
        } else if (aiEngine === 'llamacpp') {
            const url = document.getElementById('llamacpp-url')?.value;
            const model = document.getElementById('llamacpp-model')?.value;
            if (url) await this.set('ai.engines.llamacpp.baseURL', url);
            if (model) await this.set('ai.engines.llamacpp.model', model);
        } else if (aiEngine === 'custom') {
            // 收集自定义 API 设置
            const apiKey = document.getElementById('custom-api-key')?.value || '';
            const baseURL = document.getElementById('custom-base-url')?.value || '';
            const model = document.getElementById('custom-model')?.value || '';
            const temperature = document.getElementById('custom-temperature')?.value;
            const maxTokens = document.getElementById('custom-max-tokens')?.value;
            
            // 确保 custom 引擎设置对象存在
            if (!this.settings.ai.engines.custom) {
                this.settings.ai.engines.custom = {};
            }
            
            console.log('Collecting custom API settings:', {
                apiKey: apiKey ? '***' : 'empty',
                baseURL: baseURL || 'empty',
                model: model || 'empty',
                temperature: temperature || 'empty',
                maxTokens: maxTokens || 'empty'
            });
            
            // 保存设置，确保数据完整
            await this.set('ai.engines.custom.apiKey', apiKey);
            await this.set('ai.engines.custom.baseURL', baseURL);
            await this.set('ai.engines.custom.model', model);
            await this.set('ai.engines.custom.temperature', temperature ? parseFloat(temperature) : 0.7);
            await this.set('ai.engines.custom.maxTokens', maxTokens ? parseInt(maxTokens) : 1000);
            
            console.log('Custom API settings saved:', {
                apiKey: this.settings.ai.engines.custom.apiKey ? '***' : 'empty',
                baseURL: this.settings.ai.engines.custom.baseURL,
                model: this.settings.ai.engines.custom.model,
                temperature: this.settings.ai.engines.custom.temperature,
                maxTokens: this.settings.ai.engines.custom.maxTokens
            });
        }

        // 收集编辑器设置
        const fontSize = document.getElementById('editor-font-size')?.value;
        if (fontSize) await this.set('editor.fontSize', parseInt(fontSize));

        const fontFamily = document.getElementById('editor-font-family')?.value;
        if (fontFamily) await this.set('editor.fontFamily', fontFamily);

        const editorTheme = document.getElementById('editor-theme')?.value;
        if (editorTheme) await this.set('editor.theme', editorTheme);

        const autoSave = document.getElementById('auto-save')?.checked;
        if (autoSave !== undefined) await this.set('editor.autoSave', autoSave);

        // 收集Git设置
        const gitUsername = document.getElementById('git-username')?.value;
        const gitEmail = document.getElementById('git-email')?.value;
        if (gitUsername !== undefined) await this.set('git.userName', gitUsername);
        if (gitEmail !== undefined) await this.set('git.userEmail', gitEmail);

        // 收集通用设置
        const backupEnabled = document.getElementById('backup-enabled')?.checked;
        if (backupEnabled !== undefined) await this.set('general.backupEnabled', backupEnabled);
    }

    /**
     * 选择项目目录
     */
    async chooseProjectsDirectory() {
        try {
            if (window.electronAPI && window.electronAPI.chooseDirectory) {
                const result = await window.electronAPI.chooseDirectory();
                if (result && !result.canceled && result.filePaths.length > 0) {
                    const projectsDir = result.filePaths[0];
                    await this.set('projectSettings.defaultProjectsPath', projectsDir);
                    
                    const projectsDirInput = document.getElementById('projects-dir');
                    if (projectsDirInput) {
                        projectsDirInput.value = projectsDir;
                    }
                    
                    if (window.appManager) {
                        window.appManager.showNotification('项目目录设置成功', 'success');
                    }
                }
            }
        } catch (error) {
            console.error('Choose projects directory error:', error);
            if (window.appManager) {
                window.appManager.showNotification('选择目录失败', 'error');
            }
        }
    }

    /**
     * 初始化设置
     */
    async loadSettings() {
        try {
            const response = await window.electronAPI.getSettings();
            this.settings = this.mergeSettings(this.defaultSettings, response);
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.settings = { ...this.defaultSettings };
        }
    }

    /**
     * 保存设置
     */
    async saveSettings() {
        try {
            await window.electronAPI.updateSettings(this.settings);
            console.log('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings:', error);
            throw error;
        }
    }

    /**
     * 合并设置对象
     * @param {Object} defaultObj - 默认设置
     * @param {Object} userObj - 用户设置
     * @returns {Object} 合并后的设置
     */
    mergeSettings(defaultObj, userObj) {
        const result = { ...defaultObj };
        
        for (const key in userObj) {
            if (userObj.hasOwnProperty(key)) {
                if (typeof userObj[key] === 'object' && userObj[key] !== null && !Array.isArray(userObj[key])) {
                    result[key] = this.mergeSettings(defaultObj[key] || {}, userObj[key]);
                } else {
                    result[key] = userObj[key];
                }
            }
        }
        
        return result;
    }

    /**
     * 应用设置到界面
     */
    applySettings() {
        this.applyTheme();
        this.applyEditorSettings();
        this.applyUISettings();
    }

    /**
     * 应用主题设置
     */
    applyTheme() {
        const theme = this.settings.editor?.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        
        // 更新主题切换按钮状态
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.checked = theme === 'dark';
        }
    }

    /**
     * 应用编辑器设置
     */
    applyEditorSettings() {
        const editorElement = document.getElementById('editor-textarea');
        if (editorElement) {
            const settings = this.settings.editor || {};
            
            editorElement.style.fontSize = `${settings.fontSize || 16}px`;
            editorElement.style.fontFamily = settings.fontFamily || 'Georgia, serif';
            
            if (settings.wordWrap !== false) {
                editorElement.style.whiteSpace = 'pre-wrap';
            } else {
                editorElement.style.whiteSpace = 'pre';
            }
        }

        // 更新编辑器相关的 UI 控件
        this.updateEditorUI();
    }

    /**
     * 应用 UI 设置
     */
    applyUISettings() {
        const settings = this.settings.uiSettings;
        
        // 设置侧边栏显示状态
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.style.display = settings.showSidebar ? 'block' : 'none';
            sidebar.style.width = `${settings.sidebarWidth}px`;
        }

        // 设置状态栏显示状态
        const statusBar = document.getElementById('status-bar');
        if (statusBar) {
            statusBar.style.display = settings.showStatusBar ? 'flex' : 'none';
        }
    }

    /**
     * 更新编辑器 UI 控件
     */
    updateEditorUI() {
        const settings = this.settings.editorSettings;
        
        // 更新字体大小控件
        const fontSizeInput = document.getElementById('font-size-input');
        if (fontSizeInput) {
            fontSizeInput.value = settings.fontSize;
        }

        // 更新字体家族选择器
        const fontFamilySelect = document.getElementById('font-family-select');
        if (fontFamilySelect) {
            fontFamilySelect.value = settings.fontFamily;
        }

        // 更新其他编辑器选项
        const wordWrapToggle = document.getElementById('word-wrap-toggle');
        if (wordWrapToggle) {
            wordWrapToggle.checked = settings.wordWrap;
        }

        const lineNumbersToggle = document.getElementById('line-numbers-toggle');
        if (lineNumbersToggle) {
            lineNumbersToggle.checked = settings.showLineNumbers;
        }
    }

    /**
     * 获取设置值
     * @param {string} path - 设置路径，如 'aiSettings.provider'
     * @returns {*} 设置值
     */
    get(path) {
        const keys = path.split('.');
        let value = this.settings;
        
        for (const key of keys) {
            if (value && value.hasOwnProperty(key)) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * 设置值
     * @param {string} path - 设置路径
     * @param {*} value - 设置值
     */
    async set(path, value) {
        const keys = path.split('.');
        let obj = this.settings;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!obj[key] || typeof obj[key] !== 'object') {
                obj[key] = {};
            }
            obj = obj[key];
        }
        
        obj[keys[keys.length - 1]] = value;
        await this.saveSettings();
        this.applySettings();
    }

    /**
     * 批量更新设置
     * @param {Object} updates - 更新的设置
     */
    async updateSettings(updates) {
        this.settings = this.mergeSettings(this.settings, updates);
        await this.saveSettings();
        this.applySettings();
    }

    /**
     * 重置设置到默认值
     * @param {string} section - 要重置的设置部分，不指定则重置全部
     */
    async resetSettings(section = null) {
        if (section) {
            this.settings[section] = { ...this.defaultSettings[section] };
        } else {
            this.settings = { ...this.defaultSettings };
        }
        
        await this.saveSettings();
        this.applySettings();
        this.updateSettingsUI();
        
        if (window.appManager) {
            window.appManager.showNotification('设置已重置', 'success');
        }
    }

    /**
     * 切换主题
     */
    async toggleTheme() {
        const currentTheme = this.settings.uiSettings.theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        await this.set('uiSettings.theme', newTheme);
    }

    /**
     * 更新字体大小
     * @param {number} size - 字体大小
     */
    async updateFontSize(size) {
        if (size >= 12 && size <= 24) {
            await this.set('editorSettings.fontSize', size);
        }
    }

    /**
     * 更新字体家族
     * @param {string} fontFamily - 字体家族
     */
    async updateFontFamily(fontFamily) {
        await this.set('editorSettings.fontFamily', fontFamily);
    }

    /**
     * 切换自动换行
     */
    async toggleWordWrap() {
        const currentWrap = this.settings.editorSettings.wordWrap;
        await this.set('editorSettings.wordWrap', !currentWrap);
    }

    /**
     * 切换行号显示
     */
    async toggleLineNumbers() {
        const currentShow = this.settings.editorSettings.showLineNumbers;
        await this.set('editorSettings.showLineNumbers', !currentShow);
    }

    /**
     * 更新 AI 设置
     * @param {Object} aiSettings - AI 设置对象
     */
    async updateAISettings(aiSettings) {
        await this.updateSettings({ aiSettings });
        
        // 更新 AI 管理器
        if (window.aiManager) {
            await window.aiManager.updateAISettings(aiSettings);
        }
    }

    /**
     * 更新设置 UI
     */
    updateSettingsUI() {
        // 更新 AI 设置表单
        this.updateAISettingsForm();
        
        // 更新编辑器设置表单
        this.updateEditorSettingsForm();
        
        // 更新界面设置表单
        this.updateUISettingsForm();
        
        // 更新 Git 设置表单
        this.updateGitSettingsForm();
        
        // 更新通用设置表单
        this.updateGeneralSettingsForm();
    }

    /**
     * 更新 AI 设置表单
     */
    updateAISettingsForm() {
        const settings = this.settings.ai || {};
        
        const aiEngineSelect = document.getElementById('ai-engine');
        if (aiEngineSelect) {
            aiEngineSelect.value = settings.selectedEngine || 'openai';
            this.switchAIEngine(settings.selectedEngine || 'openai');
        }
        
        const systemPromptTextarea = document.getElementById('system-prompt');
        if (systemPromptTextarea) {
            systemPromptTextarea.value = settings.systemPrompt || this.getDefaultSystemPrompt();
        }
        
        // OpenAI 设置
        const openaiSettings = settings.engines?.openai || {};
        const openaiApiKeyInput = document.getElementById('openai-api-key');
        if (openaiApiKeyInput) openaiApiKeyInput.value = openaiSettings.apiKey || '';
        
        const openaiModelSelect = document.getElementById('openai-model');
        if (openaiModelSelect) openaiModelSelect.value = openaiSettings.model || 'gpt-4';
        
        // Ollama 设置
        const ollamaSettings = settings.engines?.ollama || {};
        const ollamaUrlInput = document.getElementById('ollama-url');
        if (ollamaUrlInput) ollamaUrlInput.value = ollamaSettings.baseURL || 'http://localhost:11434';
        
        const ollamaModelInput = document.getElementById('ollama-model');
        if (ollamaModelInput) ollamaModelInput.value = ollamaSettings.model || 'llama2';
        
        // Llama.cpp 设置
        const llamacppSettings = settings.engines?.llamacpp || {};
        const llamacppUrlInput = document.getElementById('llamacpp-url');
        if (llamacppUrlInput) llamacppUrlInput.value = llamacppSettings.baseURL || 'http://localhost:8080';
        
        const llamacppModelInput = document.getElementById('llamacpp-model');
        if (llamacppModelInput) llamacppModelInput.value = llamacppSettings.model || 'llama2';
        
        // Custom 设置
        const customSettings = settings.engines?.custom || {};
        const customApiKeyInput = document.getElementById('custom-api-key');
        if (customApiKeyInput) customApiKeyInput.value = customSettings.apiKey || '';
        
        const customBaseUrlInput = document.getElementById('custom-base-url');
        if (customBaseUrlInput) customBaseUrlInput.value = customSettings.baseURL || '';
        
        const customModelInput = document.getElementById('custom-model');
        if (customModelInput) customModelInput.value = customSettings.model || '';
        
        const customTemperatureInput = document.getElementById('custom-temperature');
        if (customTemperatureInput) customTemperatureInput.value = customSettings.temperature || 0.7;
        
        const customMaxTokensInput = document.getElementById('custom-max-tokens');
        if (customMaxTokensInput) customMaxTokensInput.value = customSettings.maxTokens || 1000;
    }

    /**
     * 更新编辑器设置表单
     */
    updateEditorSettingsForm() {
        const settings = this.settings.editor || {};
        
        const fontSizeSlider = document.getElementById('editor-font-size');
        if (fontSizeSlider) {
            fontSizeSlider.value = settings.fontSize || 16;
            const fontSizeValue = document.getElementById('font-size-value');
            if (fontSizeValue) fontSizeValue.textContent = `${settings.fontSize || 16}px`;
        }
        
        const fontFamilySelect = document.getElementById('editor-font-family');
        if (fontFamilySelect) fontFamilySelect.value = settings.fontFamily || 'Georgia, serif';
        
        const editorThemeSelect = document.getElementById('editor-theme');
        if (editorThemeSelect) editorThemeSelect.value = settings.theme || 'dark';
        
        const autoSaveCheckbox = document.getElementById('auto-save');
        if (autoSaveCheckbox) autoSaveCheckbox.checked = settings.autoSave;
    }

    /**
     * 更新界面设置表单
     */
    updateUISettingsForm() {
        const settings = this.settings.editor || {}; // 主题等设置通常在editor部分
        
        const themeSelect = document.getElementById('ui-theme-select');
        if (themeSelect) themeSelect.value = settings.theme || 'dark';
        
        const languageSelect = document.getElementById('ui-language-select');
        if (languageSelect) languageSelect.value = this.settings.general?.language || 'zh-CN';
        
        const showStatusBarCheckbox = document.getElementById('ui-show-status-bar-checkbox');
        if (showStatusBarCheckbox) showStatusBarCheckbox.checked = true; // 默认显示状态栏
        
        const showSidebarCheckbox = document.getElementById('ui-show-sidebar-checkbox');
        if (showSidebarCheckbox) showSidebarCheckbox.checked = true; // 默认显示侧边栏
    }

    /**
     * 更新 Git 设置表单
     */
    updateGitSettingsForm() {
        const settings = this.settings.git || {};
        
        const userNameInput = document.getElementById('git-username');
        if (userNameInput) userNameInput.value = settings.userName || '';
        
        const userEmailInput = document.getElementById('git-email');
        if (userEmailInput) userEmailInput.value = settings.userEmail || '';
    }

    /**
     * 更新通用设置表单
     */
    updateGeneralSettingsForm() {
        const settings = this.settings.general || {};
        
        const projectsDirInput = document.getElementById('projects-dir');
        if (projectsDirInput) {
            projectsDirInput.value = settings.projectsDir || '';
        }
        
        const backupEnabledCheckbox = document.getElementById('backup-enabled');
        if (backupEnabledCheckbox) {
            backupEnabledCheckbox.checked = settings.backupEnabled || false;
        }
    }

    /**
     * 导出设置
     * @returns {Object} 设置对象
     */
    exportSettings() {
        return JSON.parse(JSON.stringify(this.settings));
    }

    /**
     * 导入设置
     * @param {Object} settings - 设置对象
     */
    async importSettings(settings) {
        try {
            this.settings = this.mergeSettings(this.defaultSettings, settings);
            await this.saveSettings();
            this.applySettings();
            this.updateSettingsUI();
            
            if (window.appManager) {
                window.appManager.showNotification('设置导入成功', 'success');
            }
        } catch (error) {
            console.error('Import settings error:', error);
            if (window.appManager) {
                window.appManager.showNotification('设置导入失败', 'error');
            }
        }
    }

    /**
     * 导出设置到文件
     */
    async exportSettingsToFile() {
        try {
            const settings = this.exportSettings();
            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `artimeow-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            if (window.appManager) {
                window.appManager.showNotification('设置导出成功', 'success');
            }
        } catch (error) {
            console.error('Export settings error:', error);
            if (window.appManager) {
                window.appManager.showNotification('设置导出失败', 'error');
            }
        }
    }

    /**
     * 从文件导入设置
     */
    async importSettingsFromFile() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const settings = JSON.parse(e.target.result);
                        await this.importSettings(settings);
                    } catch (error) {
                        console.error('Import settings error:', error);
                        if (window.appManager) {
                            window.appManager.showNotification('设置文件格式错误', 'error');
                        }
                    }
                };
                reader.readAsText(file);
            };
            
            input.click();
        } catch (error) {
            console.error('Import settings from file error:', error);
            if (window.appManager) {
                window.appManager.showNotification('导入设置失败', 'error');
            }
        }
    }

    /**
     * 获取所有设置
     * @returns {Object} 所有设置
     */
    getAllSettings() {
        return this.settings;
    }

    /**
     * 获取默认设置
     * @returns {Object} 默认设置
     */
    getDefaultSettings() {
        return this.defaultSettings;
    }

    /**
     * 检查设置是否有效
     * @param {Object} settings - 要检查的设置
     * @returns {boolean} 是否有效
     */
    validateSettings(settings) {
        // 基本验证逻辑
        if (!settings || typeof settings !== 'object') {
            return false;
        }

        // 验证 AI 设置
        if (settings.aiSettings) {
            const ai = settings.aiSettings;
            if (ai.temperature && (ai.temperature < 0 || ai.temperature > 2)) {
                return false;
            }
            if (ai.maxTokens && (ai.maxTokens < 1 || ai.maxTokens > 8000)) {
                return false;
            }
        }

        // 验证编辑器设置
        if (settings.editorSettings) {
            const editor = settings.editorSettings;
            if (editor.fontSize && (editor.fontSize < 12 || editor.fontSize > 24)) {
                return false;
            }
            if (editor.lineHeight && (editor.lineHeight < 1 || editor.lineHeight > 3)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 添加最近项目
     * @param {Object} project - 项目信息
     */
    async addRecentProject(project) {
        const recentProjects = this.settings.projectSettings.recentProjects || [];
        const maxRecent = this.settings.projectSettings.maxRecentProjects || 10;
        
        // 移除已存在的项目（如果有）
        const filteredProjects = recentProjects.filter(p => p.path !== project.path);
        
        // 添加到开头
        filteredProjects.unshift({
            path: project.path,
            title: project.metadata.title,
            lastOpened: new Date().toISOString()
        });
        
        // 限制数量
        const updatedProjects = filteredProjects.slice(0, maxRecent);
        
        await this.set('projectSettings.recentProjects', updatedProjects);
    }

    /**
     * 获取最近项目
     * @returns {Array} 最近项目列表
     */
    getRecentProjects() {
        return this.settings.projectSettings.recentProjects || [];
    }

    /**
     * 测试AI连接
     */
    async testAIConnection() {
        try {
            const testBtn = document.getElementById('test-ai-connection');
            if (testBtn) {
                testBtn.disabled = true;
                testBtn.textContent = '测试中...';
            }

            // 获取当前选择的AI引擎
            const aiEngine = document.getElementById('ai-engine');
            const provider = aiEngine ? aiEngine.value : 'openai';
            
            // 优先使用已保存的设置，如果没有则从表单读取
            let engineSettings = {};
            const savedSettings = this.settings.ai?.engines || {};
            
            switch (provider) {
                case 'openai':
                    engineSettings = {
                        apiKey: savedSettings.openai?.apiKey || document.getElementById('openai-api-key')?.value || '',
                        model: savedSettings.openai?.model || document.getElementById('openai-model')?.value || 'gpt-4',
                        baseURL: savedSettings.openai?.baseURL || 'https://api.openai.com/v1'
                    };
                    break;
                case 'ollama':
                    engineSettings = {
                        baseURL: savedSettings.ollama?.baseURL || document.getElementById('ollama-url')?.value || 'http://localhost:11434',
                        model: savedSettings.ollama?.model || document.getElementById('ollama-model')?.value || 'llama2'
                    };
                    break;
                case 'llamacpp':
                    engineSettings = {
                        baseURL: savedSettings.llamacpp?.baseURL || document.getElementById('llamacpp-url')?.value || 'http://localhost:8080',
                        model: savedSettings.llamacpp?.model || document.getElementById('llamacpp-model')?.value || 'llama2'
                    };
                    break;
                case 'custom':
                    const customApiKey = savedSettings.custom?.apiKey || document.getElementById('custom-api-key')?.value || '';
                    const customBaseURL = savedSettings.custom?.baseURL || document.getElementById('custom-base-url')?.value || '';
                    const customModel = savedSettings.custom?.model || document.getElementById('custom-model')?.value || '';
                    const customTemperature = savedSettings.custom?.temperature || parseFloat(document.getElementById('custom-temperature')?.value) || 0.7;
                    const customMaxTokens = savedSettings.custom?.maxTokens || parseInt(document.getElementById('custom-max-tokens')?.value) || 1000;
                    
                    // 验证必需字段
                    if (!customBaseURL.trim()) {
                        if (window.appManager) {
                            window.appManager.showNotification('请输入自定义API的Base URL', 'error');
                        }
                        return;
                    }
                    if (!customModel.trim()) {
                        if (window.appManager) {
                            window.appManager.showNotification('请输入自定义API的模型名称', 'error');
                        }
                        return;
                    }
                    
                    engineSettings = {
                        apiKey: customApiKey,
                        baseURL: customBaseURL.trim(),
                        model: customModel.trim(),
                        temperature: customTemperature,
                        maxTokens: customMaxTokens
                    };
                    break;
            }

            console.log('Testing AI connection with settings:', {
                provider,
                engineSettings: {
                    ...engineSettings,
                    apiKey: engineSettings.apiKey ? '***' : 'empty'
                }
            });

            const result = await window.electronAPI.testAIConnection(provider, engineSettings);
            
            if (window.appManager) {
                if (result.success) {
                    window.appManager.showNotification('AI连接测试成功', 'success');
                } else {
                    window.appManager.showNotification(`AI连接测试失败: ${result.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Test AI connection error:', error);
            if (window.appManager) {
                window.appManager.showNotification('AI连接测试失败', 'error');
            }
        } finally {
            const testBtn = document.getElementById('test-ai-connection');
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.textContent = '测试连接';
            }
        }
    }
}

// 导出到全局
window.settingsManager = new SettingsManager();

// 在DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.settingsManager.init();
    });
} else {
    window.settingsManager.init();
}
