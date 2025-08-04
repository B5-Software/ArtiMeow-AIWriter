/**
 * AI 功能模块
 * 处理 AI 相关的功能，包括文本生成、AI Agent 模式等
 */

class AIManager {
    constructor() {
        this.isAgentMode = false;
        this.agentTimer = null;
        this.currentProvider = 'openai';
        this.currentModel = 'gpt-3.5-turbo';
        this.systemPrompt = '';
        this.settings = {}; // 初始化设置对象
        this.lastOperation = 'generate'; // 记录最后操作类型
        
        // 文本选择缓存
        this.selectedTextCache = '';
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.lastSelectionTime = 0;
        this.cacheTimeout = 30000; // 30秒缓存超时
        
        this.defaultSystemPrompt = `你是一个专业的小说写作助手。请根据用户的要求，创作高质量的小说内容。
要求：
1. 保持文风一致，情节连贯
2. 人物性格鲜明，对话自然
3. 描写生动，富有画面感
4. 章节结构清晰，节奏把控得当
5. 语言流畅，避免重复表达`;
        
        this.init();
    }

    /**
     * 初始化 AI 管理器
     */
    async init() {
        try {
            // 加载系统提示词
            const settings = await window.electronAPI.getSettings();
            this.settings = settings; // 保存设置到实例变量
            this.systemPrompt = settings.ai?.systemPrompt || this.defaultSystemPrompt;
            this.currentProvider = settings.ai?.selectedEngine || 'openai';
            this.currentModel = settings.ai?.engines?.[this.currentProvider]?.model || 'gpt-4';
            
            // 设置事件监听器
            this.setupEventListeners();
            
            // 只有在有有效配置时才测试连接
            if (this.shouldTestConnection()) {
                await this.testConnection();
            } else {
                console.log('Skipping AI connection test - insufficient configuration');
                this.updateConnectionStatus('disconnected', 'Configuration required');
            }
            
            console.log('AI Manager initialized');
        } catch (error) {
            console.error('Failed to initialize AI Manager:', error);
            this.systemPrompt = this.defaultSystemPrompt;
            this.updateConnectionStatus('error', error.message);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // AI生成按钮
        const generateBtn = document.getElementById('ai-generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.handleGenerate());
        }

        // AI继续写作按钮
        const continueBtn = document.getElementById('ai-continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => this.handleContinue());
        }

        // AI重写按钮
        const rewriteBtn = document.getElementById('ai-rewrite-btn');
        if (rewriteBtn) {
            rewriteBtn.addEventListener('click', () => this.handleRewrite());
        }

        // AI优化按钮
        const optimizeBtn = document.getElementById('ai-optimize-btn');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', () => this.handleOptimize());
        }

        // AI代理模式开关
        const agentModeSwitch = document.getElementById('ai-agent-mode');
        if (agentModeSwitch) {
            agentModeSwitch.addEventListener('change', (e) => {
                this.toggleAgentMode(e.target.checked);
            });
        }

        // AI结果接受按钮
        const acceptBtn = document.getElementById('ai-accept-btn');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => this.acceptResult());
        }

        // AI结果拒绝按钮
        const rejectBtn = document.getElementById('ai-reject-btn');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => this.rejectResult());
        }

        // 监听编辑器文本选择
        const editorTextarea = document.getElementById('editor-textarea');
        if (editorTextarea) {
            // 监听选择变化
            editorTextarea.addEventListener('select', () => this.cacheSelectedText());
            editorTextarea.addEventListener('mouseup', () => this.cacheSelectedText());
            editorTextarea.addEventListener('keyup', () => this.cacheSelectedText());
            
            // 监听标签页切换，防止选择丢失
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    // 页面重新激活时，恢复选择
                    this.restoreSelection();
                }
            });
        }

        // 在启动时清除缓存
        this.clearSelectionCache();
    }

    /**
     * 生成文本
     * @param {string} prompt - 用户提示
     * @param {string} context - 上下文
     * @returns {Promise<string>} 生成的文本
     */
    async generateText(prompt, context = '') {
        try {
            const fullPrompt = this.buildPrompt(prompt, context);
            
            const response = await window.electronAPI.callAI({
                provider: this.currentProvider,
                model: this.currentModel,
                prompt: fullPrompt,
                systemPrompt: this.systemPrompt
            });

            if (response.success) {
                return response.content;
            } else {
                throw new Error(response.error || 'AI 调用失败');
            }
        } catch (error) {
            console.error('Generate text error:', error);
            throw error;
        }
    }

    /**
     * 构建完整的提示词
     * @param {string} prompt - 用户提示
     * @param {string} context - 上下文
     * @returns {string} 完整提示词
     */
    buildPrompt(prompt, context) {
        let fullPrompt = '';
        
        if (context) {
            fullPrompt += `上下文：\n${context}\n\n`;
        }
        
        fullPrompt += `请求：\n${prompt}`;
        
        return fullPrompt;
    }

    /**
     * 启动 AI Agent 模式
     * @param {string} outline - 小说大纲
     * @param {number} interval - 生成间隔（毫秒）
     */
    async startAgentMode(outline, interval = 30000) {
        if (this.isAgentMode) {
            console.log('Agent mode is already running');
            return;
        }

        this.isAgentMode = true;
        console.log('Starting AI Agent mode...');

        // 显示 Agent 模式状态
        this.showAgentStatus(true);

        try {
            await this.runAgentLoop(outline, interval);
        } catch (error) {
            console.error('Agent mode error:', error);
            this.stopAgentMode();
            throw error;
        }
    }

    /**
     * 停止 AI Agent 模式
     */
    stopAgentMode() {
        if (!this.isAgentMode) {
            return;
        }

        this.isAgentMode = false;
        
        if (this.agentTimer) {
            clearTimeout(this.agentTimer);
            this.agentTimer = null;
        }

        this.showAgentStatus(false);
        console.log('AI Agent mode stopped');
    }

    /**
     * 运行 Agent 循环
     * @param {string} outline - 小说大纲
     * @param {number} interval - 生成间隔
     */
    async runAgentLoop(outline, interval) {
        if (!this.isAgentMode) {
            return;
        }

        try {
            // 获取当前章节信息
            const currentChapter = await this.getCurrentChapterInfo();
            
            // 生成下一章节
            const chapterContent = await this.generateNextChapter(outline, currentChapter);
            
            // 添加到编辑器
            if (window.editorManager) {
                window.editorManager.insertText(chapterContent);
            }

            // 保存文档
            if (window.appManager) {
                await window.appManager.saveCurrentProject();
            }

            // 设置下一次生成的定时器
            this.agentTimer = setTimeout(() => {
                this.runAgentLoop(outline, interval);
            }, interval);

        } catch (error) {
            console.error('Agent loop error:', error);
            this.stopAgentMode();
            throw error;
        }
    }

    /**
     * 获取当前章节信息
     * @returns {Object} 章节信息
     */
    async getCurrentChapterInfo() {
        const content = window.editorManager ? window.editorManager.getContent() : '';
        const chapters = this.parseChapters(content);
        
        return {
            totalChapters: chapters.length,
            lastChapter: chapters[chapters.length - 1] || null,
            wordCount: content.length
        };
    }

    /**
     * 解析章节
     * @param {string} content - 文本内容
     * @returns {Array} 章节数组
     */
    parseChapters(content) {
        const chapterRegex = /第[一二三四五六七八九十百千万\d]+章|Chapter\s*\d+|第\d+章/gi;
        const matches = content.match(chapterRegex) || [];
        return matches;
    }

    /**
     * 生成下一章节
     * @param {string} outline - 小说大纲
     * @param {Object} currentChapter - 当前章节信息
     * @returns {Promise<string>} 章节内容
     */
    async generateNextChapter(outline, currentChapter) {
        const chapterNumber = currentChapter.totalChapters + 1;
        const context = currentChapter.lastChapter ? 
            `前一章内容：${currentChapter.lastChapter}` : 
            '这是小说的第一章';

        const prompt = `根据以下大纲，写第${chapterNumber}章的内容：

大纲：
${outline}

${context}

要求：
1. 写一个完整的章节，约2000-3000字
2. 章节标题格式：第${chapterNumber}章 [章节标题]
3. 保持与前文的连贯性
4. 推进剧情发展
5. 包含对话、描写、心理活动等元素`;

        return await this.generateText(prompt, context);
    }

    /**
     * 显示 Agent 状态
     * @param {boolean} isActive - 是否激活
     */
    showAgentStatus(isActive) {
        const statusElement = document.getElementById('agent-status');
        if (statusElement) {
            statusElement.style.display = isActive ? 'block' : 'none';
            statusElement.innerHTML = isActive ? 
                '<i class="fas fa-robot"></i> AI Agent 模式运行中...' : 
                '';
        }

        // 更新按钮状态
        const startBtn = document.getElementById('start-agent');
        const stopBtn = document.getElementById('stop-agent');
        
        if (startBtn) startBtn.disabled = isActive;
        if (stopBtn) stopBtn.disabled = !isActive;
    }

    /**
     * 改进文本
     * @param {string} text - 原始文本
     * @param {string} instruction - 改进指令
     * @returns {Promise<string>} 改进后的文本
     */
    async improveText(text, instruction = '请改进这段文本，使其更加生动和引人入胜') {
        const prompt = `${instruction}

原文：
${text}

请提供改进后的版本：`;

        return await this.generateText(prompt);
    }

    /**
     * 续写文本
     * @param {string} context - 上下文
     * @param {number} length - 续写长度（字数）
     * @returns {Promise<string>} 续写内容
     */
    async continueText(context, length = 500) {
        const prompt = `请基于以下内容进行续写，续写约${length}字：

${context}

续写要求：
1. 保持文风一致
2. 情节自然发展
3. 人物性格保持一致
4. 语言流畅生动`;

        return await this.generateText(prompt, context);
    }

    /**
     * 更新系统提示词
     * @param {string} prompt - 新的系统提示词
     */
    async updateSystemPrompt(prompt) {
        this.systemPrompt = prompt;
        
        // 保存到设置
        const settings = await window.electronAPI.getSettings();
        settings.ai = settings.ai || {};
        settings.ai.systemPrompt = prompt;
        
        await window.electronAPI.updateSettings(settings);
    }

    /**
     * 恢复默认系统提示词
     */
    async resetSystemPrompt() {
        await this.updateSystemPrompt(this.defaultSystemPrompt);
    }

    /**
     * 获取当前系统提示词
     * @returns {string} 系统提示词
     */
    getSystemPrompt() {
        return this.systemPrompt;
    }

    /**
     * 获取默认系统提示词
     * @returns {string} 默认系统提示词
     */
    getDefaultSystemPrompt() {
        return this.defaultSystemPrompt;
    }

    /**
     * 更新 AI 设置
     * @param {Object} settings - AI 设置
     */
    async updateAISettings(settings) {
        this.currentProvider = settings.provider || this.currentProvider;
        this.currentModel = settings.model || this.currentModel;
        
        if (settings.systemPrompt !== undefined) {
            this.systemPrompt = settings.systemPrompt;
        }

        // 保存设置
        const appSettings = await window.electronAPI.getSettings();
        appSettings.ai = {
            ...appSettings.ai,
            ...settings
        };
        
        await window.electronAPI.updateSettings(appSettings);
    }

    /**
     * 获取可用的 AI 提供商
     * @returns {Array} 提供商列表
     */
    getAvailableProviders() {
        return [
            { id: 'openai', name: 'OpenAI', models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'] },
            { id: 'claude', name: 'Claude', models: ['claude-3-sonnet', 'claude-3-haiku'] },
            { id: 'ollama', name: 'Ollama', models: ['llama2', 'mistral', 'codellama'] },
            { id: 'llamacpp', name: 'Llama.cpp', models: ['llama2', 'mistral', 'custom'] },
            { id: 'custom', name: '自定义 AI', models: ['custom-model'] }
        ];
    }

    /**
     * 更新 AI 连接状态
     * @param {string} status - 状态: 'connected', 'disconnected', 'connecting', 'error'
     * @param {string} message - 状态消息
     */
    updateConnectionStatus(status, message = '') {
        const statusElement = document.getElementById('ai-status');
        if (!statusElement) return;

        let icon = '';
        let className = 'ai-status';
        let text = '';

        switch (status) {
            case 'connected':
                icon = 'fas fa-robot';
                className += ' connected';
                text = `已连接 (${this.currentProvider})`;
                break;
            case 'connecting':
                icon = 'fas fa-spinner fa-spin';
                className += ' connecting';
                text = '连接中...';
                break;
            case 'disconnected':
                icon = 'fas fa-robot';
                className += ' disconnected';
                text = '未连接';
                break;
            case 'error':
                icon = 'fas fa-exclamation-triangle';
                className += ' error';
                text = message || '连接错误';
                break;
            default:
                icon = 'fas fa-robot';
                className += ' disconnected';
                text = '离线';
        }

        statusElement.className = className;
        statusElement.innerHTML = `<i class="${icon}"></i> ${text}`;
    }

    /**
     * 测试 AI 连接
     */
    async testConnection() {
        try {
            this.updateConnectionStatus('connecting');
            
            // 构造引擎设置对象
            const engineSettings = this.getEngineSettings(this.currentProvider);
            
            const result = await window.electronAPI.testAIConnection(this.currentProvider, engineSettings);
            
            if (result.success) {
                this.updateConnectionStatus('connected');
                this.updateAIButtonsState(true);
                return true;
            } else {
                this.updateConnectionStatus('error', result.error);
                this.updateAIButtonsState(false);
                return false;
            }
        } catch (error) {
            console.error('Test AI connection error:', error);
            this.updateConnectionStatus('error', error.message);
            this.updateAIButtonsState(false);
            return false;
        }
    }

    /**
     * 检查是否应该测试连接
     * @returns {boolean} 是否应该测试连接
     */
    shouldTestConnection() {
        const engineSettings = this.getEngineSettings(this.currentProvider);
        
        switch (this.currentProvider) {
            case 'openai':
                return !!(engineSettings.apiKey && engineSettings.apiKey.trim());
            case 'ollama':
            case 'llamacpp':
                return !!(engineSettings.baseURL && engineSettings.baseURL.trim());
            case 'custom':
                return !!(engineSettings.baseURL && engineSettings.baseURL.trim() && 
                         engineSettings.model && engineSettings.model.trim());
            default:
                return false;
        }
    }

    /**
     * 获取指定引擎的设置
     * @param {string} provider - AI提供商
     * @returns {object} 引擎设置对象
     */
    getEngineSettings(provider) {
        const settings = this.settings?.ai?.engines?.[provider] || {};
        
        switch (provider) {
            case 'openai':
                return {
                    apiKey: settings.apiKey || '',
                    model: this.currentModel || settings.model || 'gpt-4',
                    baseURL: settings.baseURL || 'https://api.openai.com/v1'
                };
            case 'ollama':
                return {
                    baseURL: settings.baseURL || 'http://localhost:11434',
                    model: this.currentModel || settings.model || 'llama2'
                };
            case 'llamacpp':
                return {
                    baseURL: settings.baseURL || 'http://localhost:8080',
                    model: this.currentModel || settings.model || 'llama2'
                };
            case 'custom':
                return {
                    apiKey: settings.apiKey || '',
                    baseURL: settings.baseURL || '',
                    model: this.currentModel || settings.model || '',
                    temperature: settings.temperature || 0.7,
                    maxTokens: settings.maxTokens || 1000
                };
            default:
                return {};
        }
    }

    /**
     * 更新 AI 按钮状态
     * @param {boolean} enabled - 是否启用
     */
    updateAIButtonsState(enabled) {
        const buttons = [
            'ai-generate-btn',
            'ai-continue-btn',
            'ai-rewrite-btn',
            'ai-optimize-btn'
        ];

        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = !enabled;
                if (enabled) {
                    button.classList.remove('disabled');
                } else {
                    button.classList.add('disabled');
                }
            }
        });
    }

    /**
     * 处理AI生成按钮点击
     */
    async handleGenerate() {
        const promptInput = document.getElementById('ai-prompt-input');
        const prompt = promptInput.value.trim();
        
        if (!prompt) {
            this.showError('请输入AI提示词');
            return;
        }

        this.lastOperation = 'generate'; // 记录操作类型
        await this.generateContent(prompt);
    }

    /**
     * 处理AI继续写作按钮点击
     */
    async handleContinue() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) return;

        const currentContent = editorTextarea.value;
        const prompt = '请继续这个故事的内容：';
        
        this.lastOperation = 'continue'; // 记录操作类型
        await this.generateContent(prompt, currentContent);
    }

    /**
     * 处理AI重写按钮点击
     */
    async handleRewrite() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) {
            this.showError('找不到编辑器');
            return;
        }

        // 先检查选区，再获取文本
        const hasSelection = this.hasSelectedText(editorTextarea);
        const selectedText = this.getSelectedText(editorTextarea);
        
        console.log('Rewrite check:', { hasSelection, selectedText, length: selectedText.length });
        
        if (!hasSelection || !selectedText.trim()) {
            this.showError('请先选择要重写的文本');
            return;
        }

        // 缓存当前选择
        this.cacheCurrentSelection();

        const prompt = '请重写以下文本，保持原意但改进表达：';
        this.lastOperation = 'rewrite'; // 记录操作类型
        await this.generateContent(prompt, selectedText);
    }

    /**
     * 处理AI优化按钮点击
     */
    async handleOptimize() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) {
            this.showError('找不到编辑器');
            return;
        }

        // 先检查选区，再获取文本
        const hasSelection = this.hasSelectedText(editorTextarea);
        const selectedText = this.getSelectedText(editorTextarea);
        
        console.log('Optimize check:', { hasSelection, selectedText, length: selectedText.length });
        
        if (!hasSelection || !selectedText.trim()) {
            this.showError('请先选择要优化的文本');
            return;
        }

        // 缓存当前选择
        this.cacheCurrentSelection();

        console.log('Selected text for optimize:', selectedText);
        
        const prompt = '请优化以下文本，改进语言表达、结构和流畅度：';
        this.lastOperation = 'optimize'; // 记录操作类型
        await this.generateContent(prompt, selectedText);
    }

    /**
     * 生成内容的通用方法
     */
    async generateContent(prompt, context = '') {
        try {
            console.log('AI generateContent called with:', { prompt, context, contextLength: context.length });
            
            // 显示加载状态并禁用所有AI按钮
            this.showLoading();
            this.disableAllAIButtons();
            
            const callData = {
                provider: this.currentProvider,
                model: this.currentModel,
                prompt: prompt,
                systemPrompt: this.systemPrompt,
                context: context
            };
            
            console.log('Calling AI with data:', callData);
            
            const result = await window.electronAPI.callAI(callData);

            if (result.success) {
                // 过滤<think>标签
                const filteredContent = this.filterThinkTags(result.content);
                this.showResult(filteredContent);
            } else {
                this.showError('AI生成失败: ' + result.error);
            }
        } catch (error) {
            console.error('AI generation error:', error);
            this.showError('AI生成失败，请重试');
        } finally {
            this.hideLoading();
            this.enableAllAIButtons();
        }
    }

    /**
     * 过滤<think>标签及其内容
     */
    filterThinkTags(content) {
        if (!content || typeof content !== 'string') {
            return content;
        }
        
        // 移除<think>标签及其内容（支持多行）
        return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    }

    /**
     * 禁用所有AI按钮
     */
    disableAllAIButtons() {
        const buttons = [
            'ai-generate-btn',
            'ai-continue-btn',
            'ai-rewrite-btn',
            'ai-optimize-btn',
            'ai-accept-btn',
            'ai-reject-btn'
        ];

        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = true;
                button.classList.add('disabled');
            }
        });
    }

    /**
     * 启用所有AI按钮
     */
    enableAllAIButtons() {
        const buttons = [
            'ai-generate-btn',
            'ai-continue-btn',
            'ai-rewrite-btn',
            'ai-optimize-btn'
        ];

        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
                button.classList.remove('disabled');
            }
        });
    }

    /**
     * 显示AI生成结果
     */
    showResult(content) {
        const resultContent = document.getElementById('ai-result-content');
        const acceptBtn = document.getElementById('ai-accept-btn');
        const rejectBtn = document.getElementById('ai-reject-btn');

        if (resultContent) {
            resultContent.textContent = content;
            this.lastGeneratedContent = content;
        }

        if (acceptBtn) acceptBtn.disabled = false;
        if (rejectBtn) rejectBtn.disabled = false;
    }

    /**
     * 接受AI生成结果
     */
    acceptResult() {
        if (!this.lastGeneratedContent) return;

        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) return;

        try {
            // 根据操作类型决定插入方式
            if (this.lastOperation === 'continue') {
                // 续写：在光标位置插入（通常是文档末尾）
                this.insertAtCursor(editorTextarea, this.lastGeneratedContent);
            } else if (this.lastOperation === 'rewrite' || this.lastOperation === 'optimize') {
                // 重写/优化：替换选中的文本
                if (this.hasValidCachedSelection()) {
                    // 使用缓存的选择替换
                    const selection = this.getCachedSelection();
                    const value = editorTextarea.value;
                    editorTextarea.value = value.substring(0, selection.start) + this.lastGeneratedContent + value.substring(selection.end);
                    editorTextarea.setSelectionRange(selection.start, selection.start + this.lastGeneratedContent.length);
                } else {
                    // 没有缓存选择，检查当前是否有选中文本
                    const currentStart = editorTextarea.selectionStart;
                    const currentEnd = editorTextarea.selectionEnd;
                    
                    if (currentStart !== currentEnd) {
                        // 有选中文本，替换它
                        const value = editorTextarea.value;
                        editorTextarea.value = value.substring(0, currentStart) + this.lastGeneratedContent + value.substring(currentEnd);
                        editorTextarea.setSelectionRange(currentStart, currentStart + this.lastGeneratedContent.length);
                    } else {
                        // 没有选中文本，在光标位置插入
                        this.insertAtCursor(editorTextarea, this.lastGeneratedContent);
                    }
                }
            } else {
                // 默认：在光标位置插入
                this.insertAtCursor(editorTextarea, this.lastGeneratedContent);
            }

            // 确保编辑器获得焦点
            editorTextarea.focus();

            // 触发输入事件以更新字数统计和预览
            editorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 标记文档为未保存
            if (window.appManager) {
                window.appManager.markUnsaved();
            }

        } catch (error) {
            console.error('插入AI生成内容失败:', error);
            this.showError('插入内容失败，请重试');
        }

        this.clearResult();
    }

    /**
     * 拒绝AI生成结果
     */
    rejectResult() {
        this.clearResult();
    }

    /**
     * 清除AI生成结果
     */
    clearResult() {
        const resultContent = document.getElementById('ai-result-content');
        const acceptBtn = document.getElementById('ai-accept-btn');
        const rejectBtn = document.getElementById('ai-reject-btn');

        if (resultContent) resultContent.textContent = '';
        if (acceptBtn) acceptBtn.disabled = true;
        if (rejectBtn) rejectBtn.disabled = true;
        
        this.lastGeneratedContent = null;
    }

    /**
     * 在光标位置插入文本
     */
    insertAtCursor(textarea, text) {
        if (!textarea || !text) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = textarea.value;
        
        // 插入文本
        textarea.value = currentValue.substring(0, start) + text + currentValue.substring(end);
        
        // 设置光标位置到插入文本的末尾
        const newCursorPos = start + text.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // 确保编辑器获得焦点
        textarea.focus();
    }

    /**
     * 缓存选中的文本
     */
    cacheSelectedText() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) return;

        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        
        if (start !== end) {
            this.selectedTextCache = editorTextarea.value.substring(start, end);
            this.selectionStart = start;
            this.selectionEnd = end;
            this.lastSelectionTime = Date.now();
            
            console.log('已缓存选中文本:', this.selectedTextCache.substring(0, 50) + '...');
        }
    }

    /**
     * 获取缓存的选中文本
     */
    getCachedSelectedText() {
        // 检查缓存是否过期
        if (Date.now() - this.lastSelectionTime > this.cacheTimeout) {
            this.clearSelectionCache();
            return '';
        }
        
        return this.selectedTextCache;
    }

    /**
     * 清除选择缓存
     */
    clearSelectionCache() {
        this.selectedTextCache = '';
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.lastSelectionTime = 0;
    }

    /**
     * 恢复选择
     */
    restoreSelection() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea || !this.selectedTextCache) return;

        // 检查缓存是否过期
        if (Date.now() - this.lastSelectionTime > this.cacheTimeout) {
            this.clearSelectionCache();
            return;
        }

        try {
            editorTextarea.focus();
            editorTextarea.setSelectionRange(this.selectionStart, this.selectionEnd);
            console.log('已恢复文本选择');
        } catch (error) {
            console.warn('恢复选择失败:', error);
        }
    }

    /**
     * 获取选中文本（优先使用缓存）
     */
    getSelectedText(textarea) {
        if (!textarea) {
            textarea = document.getElementById('editor-textarea');
        }
        
        if (!textarea) {
            console.warn('无法找到编辑器元素');
            return '';
        }
        
        // 首先尝试获取当前选择
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        if (start !== end) {
            const selectedText = textarea.value.substring(start, end);
            console.log('获取当前选中文本:', selectedText);
            return selectedText;
        }
        
        // 如果没有当前选择，尝试使用缓存
        const cachedText = this.getCachedSelectedText();
        if (cachedText) {
            console.log('使用缓存的选中文本:', cachedText);
            return cachedText;
        }
        
        console.log('没有选中文本');
        return '';
    }

    /**
     * 检查是否有选中文本（包括缓存）
     */
    hasSelectedText(textarea) {
        if (!textarea) {
            textarea = document.getElementById('editor-textarea');
        }
        
        if (!textarea) return false;
        
        // 检查当前选择
        const hasCurrentSelection = textarea.selectionStart !== textarea.selectionEnd;
        
        // 检查缓存
        const hasCachedSelection = this.getCachedSelectedText().length > 0;
        
        const hasSelection = hasCurrentSelection || hasCachedSelection;
        console.log('是否有选中文本:', hasSelection, {
            current: hasCurrentSelection,
            cached: hasCachedSelection
        });
        
        return hasSelection;
    }

    /**
     * 检查是否有有效的缓存选择
     */
    hasValidCachedSelection() {
        return this.selectionStart !== undefined && 
               this.selectionEnd !== undefined && 
               this.selectionStart !== this.selectionEnd &&
               Date.now() - this.lastSelectionTime < this.cacheTimeout;
    }

    /**
     * 获取缓存的选择信息
     */
    getCachedSelection() {
        return {
            start: this.selectionStart,
            end: this.selectionEnd,
            text: this.selectedTextCache
        };
    }

    /**
     * 缓存当前选择
     */
    cacheCurrentSelection() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) return;

        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        
        if (start !== end) {
            this.selectedTextCache = editorTextarea.value.substring(start, end);
            this.selectionStart = start;
            this.selectionEnd = end;
            this.lastSelectionTime = Date.now();
            
            console.log('已缓存选中文本:', this.selectedTextCache.substring(0, 50) + '...');
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const generateBtn = document.getElementById('ai-generate-btn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const generateBtn = document.getElementById('ai-generate-btn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 生成';
        }
    }

    /**
     * 显示错误消息
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
     */
    showSuccess(message) {
        if (window.appManager) {
            window.appManager.showSuccess(message);
        } else {
            console.log(message);
        }
    }

    /**
     * 切换AI代理模式
     * @param {boolean} enabled - 是否启用代理模式
     */
    async toggleAgentMode(enabled) {
        this.isAgentMode = enabled;
        
        if (enabled) {
            await this.startAgentMode();
        } else {
            this.stopAgentMode();
        }
        
        // 更新UI状态
        this.updateAgentModeUI(enabled);
    }

    /**
     * 启动AI代理模式
     */
    async startAgentMode() {
        // 检查是否有当前项目
        if (!window.appManager || !window.appManager.currentProject) {
            this.showError('请先打开一个项目才能启用AI代理模式');
            this.isAgentMode = false;
            const agentModeSwitch = document.getElementById('ai-agent-mode');
            if (agentModeSwitch) agentModeSwitch.checked = false;
            return;
        }

        const project = window.appManager.currentProject;
        
        this.showSuccess('AI代理模式已启用，将根据项目描述自动续写章节');
        console.log('AI Agent mode started for project:', project.name);
        
        // 添加调试信息
        console.log('Current provider:', this.currentProvider);
        console.log('Current model:', this.currentModel);
        console.log('Project chapters:', project.chapters ? project.chapters.length : 0);
        
        // 启动代理循环
        this.runAgentCycle();
    }

    /**
     * 停止AI代理模式
     */
    stopAgentMode() {
        if (this.agentTimer) {
            clearTimeout(this.agentTimer);
            this.agentTimer = null;
        }
        
        this.showSuccess('AI代理模式已关闭');
        console.log('AI Agent mode stopped');
    }

    /**
     * 运行代理循环
     */
    async runAgentCycle() {
        if (!this.isAgentMode) return;

        try {
            const project = window.appManager.currentProject;
            if (!project) {
                this.stopAgentMode();
                return;
            }

            console.log('AI Agent: Starting generation cycle...');
            
            // 显示正在生成的状态
            this.updateAgentModeUI(true, '正在生成章节...');

            // 生成下一章节
            const result = await this.generateNextChapterForProject(project);
            
            if (result.success) {
                console.log(`AI Agent generated chapter: ${result.title}`);
                this.showSuccess(`AI Agent 已生成章节：${result.title}`);
                
                // 更新状态
                this.updateAgentModeUI(true, `已生成：${result.title}`);
                
                // 设置下一次生成的定时器（30秒后）
                this.agentTimer = setTimeout(() => {
                    console.log('AI Agent: Starting next cycle...');
                    this.runAgentCycle();
                }, 30000);
            } else {
                console.error('AI Agent failed to generate chapter:', result.error);
                this.showError(`AI Agent 生成章节失败：${result.error}`);
                
                // 更新状态
                this.updateAgentModeUI(true, `生成失败，将重试`);
                
                // 如果失败，1分钟后重试
                this.agentTimer = setTimeout(() => {
                    console.log('AI Agent: Retrying after error...');
                    this.runAgentCycle();
                }, 60000);
            }

        } catch (error) {
            console.error('AI Agent cycle error:', error);
            this.showError(`AI代理模式遇到错误：${error.message}`);
            
            // 发生错误时，停止代理模式
            this.stopAgentMode();
        }
    }

    /**
     * 为项目生成下一章节
     * @param {Object} project - 项目对象
     */
    async generateNextChapterForProject(project) {
        try {
            console.log('AI Agent: Generating next chapter for project:', project.name);
            
            // 构建章节生成提示词
            const prompt = this.buildChapterGenerationPrompt(project);
            console.log('AI Agent: Built prompt, length:', prompt.length);
            
            // 调用AI生成章节
            const response = await window.electronAPI.callAI({
                provider: this.currentProvider,
                model: this.currentModel,
                prompt: prompt,
                systemPrompt: this.getChapterGenerationSystemPrompt()
            });

            console.log('AI Agent: Received response, success:', response.success);
            
            if (!response.success) {
                return { success: false, error: response.error };
            }

            // 解析AI返回的JSON格式章节
            const chapterData = this.parseChapterResponse(response.content);
            if (!chapterData) {
                return { success: false, error: '无法解析AI生成的章节格式' };
            }

            console.log('AI Agent: Parsed chapter data:', chapterData.title);

            // 创建新章节
            const newChapter = {
                id: Date.now().toString(),
                title: chapterData.title,
                content: chapterData.content,
                wordCount: this.getWordCount(chapterData.content)
            };

            // 添加到项目
            project.chapters.push(newChapter);
            
            // 保存章节
            await window.electronAPI.saveChapter({
                projectPath: project.path,
                chapterId: newChapter.id,
                title: newChapter.title,
                content: newChapter.content
            });

            console.log('AI Agent: Chapter saved successfully');

            // 更新UI
            if (window.appManager && window.appManager.renderChaptersList) {
                window.appManager.renderChaptersList();
            }
            
            // 自动切换到新章节
            if (window.appManager && window.appManager.loadChapter) {
                await window.appManager.loadChapter(newChapter);
            }

            return { 
                success: true, 
                title: chapterData.title,
                content: chapterData.content
            };

        } catch (error) {
            console.error('AI Agent: Error generating chapter:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 构建章节生成提示词
     * @param {Object} project - 项目对象
     */
    buildChapterGenerationPrompt(project) {
        const existingChapters = project.chapters || [];
        const nextChapterNumber = existingChapters.length + 1;
        
        let prompt = `请为小说《${project.name}》生成第${nextChapterNumber}章。

项目信息：
- 小说标题：${project.name}
- 作者：${project.author || '未知'}
- 类型：${project.genre || '未分类'}
- 描述：${project.description || '无描述'}

`;

        // 添加已有章节信息
        if (existingChapters.length > 0) {
            prompt += `已有章节概要：\n`;
            existingChapters.forEach((chapter, index) => {
                prompt += `第${index + 1}章：${chapter.title}\n`;
            });
            prompt += '\n';
            
            // 添加最近章节内容作为上下文
            const lastChapter = existingChapters[existingChapters.length - 1];
            if (lastChapter && lastChapter.content) {
                const lastContent = lastChapter.content.substring(0, 500);
                prompt += `上一章节末尾内容：\n${lastContent}...\n\n`;
            }
        }

        prompt += `要求：
1. 生成约2000-3000字的完整章节内容
2. 保持与上一章节末尾的连贯性和风格一致性
3. 推进故事情节发展，项目描述是对于整本书的描述，整本书（不是单个章节）的剧情总走向应符合项目描述，在适当的条件下把情节推进到下一阶段，不要一直停留在某个事件上
4. 包含生动的对话、细致的描写和心理活动
5. 返回格式必须是JSON，包含title和content字段

请严格按照以下JSON格式返回：
{
  "title": "第${nextChapterNumber}章 章节标题",
  "content": "章节的完整内容..."
}`;

        return prompt;
    }

    /**
     * 获取章节生成的系统提示词
     */
    getChapterGenerationSystemPrompt() {
        return `你是一位专业的小说家，擅长创作连贯、引人入胜的故事章节。你需要：

1. 根据给定的项目信息和已有章节，创作下一章的内容
2. 保持故事的连贯性和角色的一致性
3. 使用生动的语言和丰富的描写
4. 创造有趣的情节发展和人物互动
5. 确保每章都有明确的开始、发展和结尾
6. 严格按照JSON格式返回结果

重要：你的回答必须是有效的JSON格式，包含title和content两个字段。不要添加任何其他文本或解释。`;
    }

    /**
     * 解析AI返回的章节响应
     * @param {string} response - AI响应内容
     */
    parseChapterResponse(response) {
        try {
            // 过滤<think>标签
            const filteredResponse = this.filterThinkTags(response);
            
            // 尝试提取JSON
            const jsonMatch = filteredResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('No JSON found in response:', filteredResponse);
                return null;
            }

            const chapterData = JSON.parse(jsonMatch[0]);
            
            // 验证必要字段
            if (!chapterData.title || !chapterData.content) {
                console.error('Invalid chapter data structure:', chapterData);
                return null;
            }

            return {
                title: chapterData.title.trim(),
                content: chapterData.content.trim()
            };

        } catch (error) {
            console.error('Failed to parse chapter response:', error);
            console.error('Response was:', response);
            return null;
        }
    }

    /**
     * 更新代理模式UI状态
     * @param {boolean} enabled - 是否启用
     * @param {string} message - 状态消息
     */
    updateAgentModeUI(enabled, message = '') {
        const statusElement = document.getElementById('agent-status');
        if (statusElement) {
            statusElement.style.display = enabled ? 'block' : 'none';
            
            if (enabled) {
                const displayMessage = message || 'AI Agent 模式运行中...';
                statusElement.innerHTML = `<i class="fas fa-robot"></i> ${displayMessage}`;
            } else {
                statusElement.innerHTML = '';
            }
        }
        
        // 更新开关状态
        const agentModeSwitch = document.getElementById('ai-agent-mode');
        if (agentModeSwitch && agentModeSwitch.checked !== enabled) {
            agentModeSwitch.checked = enabled;
        }
    }

    /**
     * 获取文本字数
     * @param {string} text - 文本内容
     * @returns {number} 字数
     */
    getWordCount(text) {
        if (!text) return 0;
        
        // 中文字符计数
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        
        // 英文单词计数
        const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').match(/\b\w+\b/g) || [];
        
        return chineseChars + englishWords.length;
    }

    /**
     * 缓存选中的文本
     */
    cacheSelectedText() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) return;

        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        
        if (start !== end) {
            this.selectedTextCache = editorTextarea.value.substring(start, end);
            this.selectionStart = start;
            this.selectionEnd = end;
            this.lastSelectionTime = Date.now();
            
            console.log('已缓存选中文本:', this.selectedTextCache.substring(0, 50) + '...');
        }
    }

    /**
     * 获取缓存的选中文本
     */
    getCachedSelectedText() {
        // 检查缓存是否过期
        if (Date.now() - this.lastSelectionTime > this.cacheTimeout) {
            this.clearSelectionCache();
            return '';
        }
        
        return this.selectedTextCache;
    }

    /**
     * 清除选择缓存
     */
    clearSelectionCache() {
        this.selectedTextCache = '';
        this.selectionStart = 0;
        this.selectionEnd = 0;
        this.lastSelectionTime = 0;
    }

    /**
     * 恢复选择
     */
    restoreSelection() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea || !this.selectedTextCache) return;

        // 检查缓存是否过期
        if (Date.now() - this.lastSelectionTime > this.cacheTimeout) {
            this.clearSelectionCache();
            return;
        }

        try {
            editorTextarea.focus();
            editorTextarea.setSelectionRange(this.selectionStart, this.selectionEnd);
            console.log('已恢复文本选择');
        } catch (error) {
            console.warn('恢复选择失败:', error);
        }
    }

    /**
     * 获取选中文本（优先使用缓存）
     */
    getSelectedText(textarea) {
        if (!textarea) {
            textarea = document.getElementById('editor-textarea');
        }
        
        if (!textarea) {
            console.warn('无法找到编辑器元素');
            return '';
        }
        
        // 首先尝试获取当前选择
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        if (start !== end) {
            const selectedText = textarea.value.substring(start, end);
            console.log('获取当前选中文本:', selectedText);
            return selectedText;
        }
        
        // 如果没有当前选择，尝试使用缓存
        const cachedText = this.getCachedSelectedText();
        if (cachedText) {
            console.log('使用缓存的选中文本:', cachedText);
            return cachedText;
        }
        
        console.log('没有选中文本');
        return '';
    }

    /**
     * 检查是否有选中文本（包括缓存）
     */
    hasSelectedText(textarea) {
        if (!textarea) {
            textarea = document.getElementById('editor-textarea');
        }
        
        if (!textarea) return false;
        
        // 检查当前选择
        const hasCurrentSelection = textarea.selectionStart !== textarea.selectionEnd;
        
        // 检查缓存
        const hasCachedSelection = this.getCachedSelectedText().length > 0;
        
        const hasSelection = hasCurrentSelection || hasCachedSelection;
        console.log('是否有选中文本:', hasSelection, {
            current: hasCurrentSelection,
            cached: hasCachedSelection
        });
        
        return hasSelection;
    }

    /**
     * 检查是否有有效的缓存选择
     */
    hasValidCachedSelection() {
        return this.selectionStart !== undefined && 
               this.selectionEnd !== undefined && 
               this.selectionStart !== this.selectionEnd &&
               Date.now() - this.lastSelectionTime < this.cacheTimeout;
    }

    /**
     * 获取缓存的选择信息
     */
    getCachedSelection() {
        return {
            start: this.selectionStart,
            end: this.selectionEnd,
            text: this.selectedTextCache
        };
    }

    /**
     * 缓存当前选择
     */
    cacheCurrentSelection() {
        const editorTextarea = document.getElementById('editor-textarea');
        if (!editorTextarea) return;

        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        
        if (start !== end) {
            this.selectedTextCache = editorTextarea.value.substring(start, end);
            this.selectionStart = start;
            this.selectionEnd = end;
            this.lastSelectionTime = Date.now();
            
            console.log('已缓存选中文本:', this.selectedTextCache.substring(0, 50) + '...');
        }
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const generateBtn = document.getElementById('ai-generate-btn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const generateBtn = document.getElementById('ai-generate-btn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 生成';
        }
    }

    /**
     * 显示错误消息
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
     */
    showSuccess(message) {
        if (window.appManager) {
            window.appManager.showSuccess(message);
        } else {
            console.log(message);
        }
    }

    /**
     * 切换AI代理模式
     * @param {boolean} enabled - 是否启用代理模式
     */
    async toggleAgentMode(enabled) {
        this.isAgentMode = enabled;
        
        if (enabled) {
            await this.startAgentMode();
        } else {
            this.stopAgentMode();
        }
        
        // 更新UI状态
        this.updateAgentModeUI(enabled);
    }

    /**
     * 启动AI代理模式
     */
    async startAgentMode() {
        // 检查是否有当前项目
        if (!window.appManager || !window.appManager.currentProject) {
            this.showError('请先打开一个项目才能启用AI代理模式');
            this.isAgentMode = false;
            const agentModeSwitch = document.getElementById('ai-agent-mode');
            if (agentModeSwitch) agentModeSwitch.checked = false;
            return;
        }

        const project = window.appManager.currentProject;
        
        this.showSuccess('AI代理模式已启用，将根据项目描述自动续写章节');
        console.log('AI Agent mode started for project:', project.name);
        
        // 添加调试信息
        console.log('Current provider:', this.currentProvider);
        console.log('Current model:', this.currentModel);
        console.log('Project chapters:', project.chapters ? project.chapters.length : 0);
        
        // 启动代理循环
        this.runAgentCycle();
    }

    /**
     * 停止AI代理模式
     */
    stopAgentMode() {
        if (this.agentTimer) {
            clearTimeout(this.agentTimer);
            this.agentTimer = null;
        }
        
        this.showSuccess('AI代理模式已关闭');
        console.log('AI Agent mode stopped');
    }

    /**
     * 运行代理循环
     */
    async runAgentCycle() {
        if (!this.isAgentMode) return;

        try {
            const project = window.appManager.currentProject;
            if (!project) {
                this.stopAgentMode();
                return;
            }

            console.log('AI Agent: Starting generation cycle...');
            
            // 显示正在生成的状态
            this.updateAgentModeUI(true, '正在生成章节...');

            // 生成下一章节
            const result = await this.generateNextChapterForProject(project);
            
            if (result.success) {
                console.log(`AI Agent generated chapter: ${result.title}`);
                this.showSuccess(`AI Agent 已生成章节：${result.title}`);
                
                // 更新状态
                this.updateAgentModeUI(true, `已生成：${result.title}`);
                
                // 设置下一次生成的定时器（30秒后）
                this.agentTimer = setTimeout(() => {
                    console.log('AI Agent: Starting next cycle...');
                    this.runAgentCycle();
                }, 30000);
            } else {
                console.error('AI Agent failed to generate chapter:', result.error);
                this.showError(`AI Agent 生成章节失败：${result.error}`);
                
                // 更新状态
                this.updateAgentModeUI(true, `生成失败，将重试`);
                
                // 如果失败，1分钟后重试
                this.agentTimer = setTimeout(() => {
                    console.log('AI Agent: Retrying after error...');
                    this.runAgentCycle();
                }, 60000);
            }

        } catch (error) {
            console.error('AI Agent cycle error:', error);
            this.showError(`AI代理模式遇到错误：${error.message}`);
            
            // 发生错误时，停止代理模式
            this.stopAgentMode();
        }
    }

    /**
     * 为项目生成下一章节
     * @param {Object} project - 项目对象
     */
    async generateNextChapterForProject(project) {
        try {
            console.log('AI Agent: Generating next chapter for project:', project.name);
            
            // 构建章节生成提示词
            const prompt = this.buildChapterGenerationPrompt(project);
            console.log('AI Agent: Built prompt, length:', prompt.length);
            
            // 调用AI生成章节
            const response = await window.electronAPI.callAI({
                provider: this.currentProvider,
                model: this.currentModel,
                prompt: prompt,
                systemPrompt: this.getChapterGenerationSystemPrompt()
            });

            console.log('AI Agent: Received response, success:', response.success);
            
            if (!response.success) {
                return { success: false, error: response.error };
            }

            // 解析AI返回的JSON格式章节
            const chapterData = this.parseChapterResponse(response.content);
            if (!chapterData) {
                return { success: false, error: '无法解析AI生成的章节格式' };
            }

            console.log('AI Agent: Parsed chapter data:', chapterData.title);

            // 创建新章节
            const newChapter = {
                id: Date.now().toString(),
                title: chapterData.title,
                content: chapterData.content,
                wordCount: this.getWordCount(chapterData.content)
            };

            // 添加到项目
            project.chapters.push(newChapter);
            
            // 保存章节
            await window.electronAPI.saveChapter({
                projectPath: project.path,
                chapterId: newChapter.id,
                title: newChapter.title,
                content: newChapter.content
            });

            console.log('AI Agent: Chapter saved successfully');

            // 更新UI
            if (window.appManager && window.appManager.renderChaptersList) {
                window.appManager.renderChaptersList();
            }
            
            // 自动切换到新章节
            if (window.appManager && window.appManager.loadChapter) {
                await window.appManager.loadChapter(newChapter);
            }

            return { 
                success: true, 
                title: chapterData.title,
                content: chapterData.content
            };

        } catch (error) {
            console.error('AI Agent: Error generating chapter:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 构建章节生成提示词
     * @param {Object} project - 项目对象
     */
    buildChapterGenerationPrompt(project) {
        const existingChapters = project.chapters || [];
        const nextChapterNumber = existingChapters.length + 1;
        
        let prompt = `请为小说《${project.name}》生成第${nextChapterNumber}章。

项目信息：
- 小说标题：${project.name}
- 作者：${project.author || '未知'}
- 类型：${project.genre || '未分类'}
- 描述：${project.description || '无描述'}

`;

        // 添加已有章节信息
        if (existingChapters.length > 0) {
            prompt += `已有章节概要：\n`;
            existingChapters.forEach((chapter, index) => {
                prompt += `第${index + 1}章：${chapter.title}\n`;
            });
            prompt += '\n';
            
            // 添加最近章节内容作为上下文
            const lastChapter = existingChapters[existingChapters.length - 1];
            if (lastChapter && lastChapter.content) {
                const lastContent = lastChapter.content.substring(0, 500);
                prompt += `上一章节末尾内容：\n${lastContent}...\n\n`;
            }
        }

        prompt += `要求：
1. 生成约2000-3000字的完整章节内容
2. 保持与上一章节末尾的连贯性和风格一致性
3. 推进故事情节发展，项目描述是对于整本书的描述，整本书（不是单个章节）的剧情总走向应符合项目描述，在适当的条件下把情节推进到下一阶段，不要一直停留在某个事件上
4. 包含生动的对话、细致的描写和心理活动
5. 返回格式必须是JSON，包含title和content字段

请严格按照以下JSON格式返回：
{
  "title": "第${nextChapterNumber}章 章节标题",
  "content": "章节的完整内容..."
}`;

        return prompt;
    }

    /**
     * 获取章节生成的系统提示词
     */
    getChapterGenerationSystemPrompt() {
        return `你是一位专业的小说家，擅长创作连贯、引人入胜的故事章节。你需要：

1. 根据给定的项目信息和已有章节，创作下一章的内容
2. 保持故事的连贯性和角色的一致性
3. 使用生动的语言和丰富的描写
4. 创造有趣的情节发展和人物互动
5. 确保每章都有明确的开始、发展和结尾
6. 严格按照JSON格式返回结果

重要：你的回答必须是有效的JSON格式，包含title和content两个字段。不要添加任何其他文本或解释。`;
    }

    /**
     * 解析AI返回的章节响应
     * @param {string} response - AI响应内容
     */
    parseChapterResponse(response) {
        try {
            // 过滤<think>标签
            const filteredResponse = this.filterThinkTags(response);
            
            // 尝试提取JSON
            const jsonMatch = filteredResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('No JSON found in response:', filteredResponse);
                return null;
            }

            const chapterData = JSON.parse(jsonMatch[0]);
            
            // 验证必要字段
            if (!chapterData.title || !chapterData.content) {
                console.error('Invalid chapter data structure:', chapterData);
                return null;
            }

            return {
                title: chapterData.title.trim(),
                content: chapterData.content.trim()
            };

        } catch (error) {
            console.error('Failed to parse chapter response:', error);
            console.error('Response was:', response);
            return null;
        }
    }

    /**
     * 更新代理模式UI状态
     * @param {boolean} enabled - 是否启用
     * @param {string} message - 状态消息
     */
    updateAgentModeUI(enabled, message = '') {
        const statusElement = document.getElementById('agent-status');
        if (statusElement) {
            statusElement.style.display = enabled ? 'block' : 'none';
            
            if (enabled) {
                const displayMessage = message || 'AI Agent 模式运行中...';
                statusElement.innerHTML = `<i class="fas fa-robot"></i> ${displayMessage}`;
            } else {
                statusElement.innerHTML = '';
            }
        }
        
        // 更新开关状态
        const agentModeSwitch = document.getElementById('ai-agent-mode');
        if (agentModeSwitch && agentModeSwitch.checked !== enabled) {
            agentModeSwitch.checked = enabled;
        }
    }

    /**
     * 获取文本字数
     * @param {string} text - 文本内容
     * @returns {number} 字数
     */
    getWordCount(text) {
        if (!text) return 0;
        
        // 中文字符计数
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        
        // 英文单词计数
        const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').match(/\b\w+\b/g) || [];
        
        return chineseChars + englishWords.length;
    }
}

// 导出到全局
window.aiManager = new AIManager();
