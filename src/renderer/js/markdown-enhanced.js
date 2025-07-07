/**
 * Markdown 编辑器增强模块 - 选区保持版本
 * 通过保存选区状态来解决焦点转移问题
 */

class MarkdownEnhancedEditor {
    constructor(editorElement, previewElement) {
        this.editor = editorElement || document.getElementById('editor-textarea');
        this.preview = previewElement || document.getElementById('preview-content');
        this.isPreviewMode = false;
        
        // 选区保存机制
        this.savedSelection = {
            start: 0,
            end: 0,
            text: '',
            timestamp: 0
        };
        
        this.init();
    }

    init() {
        if (this.editor) {
            this.setupEditor();
            this.setupEventListeners();
            // 使用新的选区保持方案绑定工具栏
            this.bindToolbarWithSelectionPreservation();
            // 设置选区监听和保存机制
            this.setupSelectionPreservation();
            console.log('Markdown增强编辑器初始化完成 - 选区保持版本');
        }
    }

    setupEditor() {
        // 增强编辑器功能
        this.editor.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.editor.addEventListener('input', (e) => this.handleInput(e));
        this.editor.addEventListener('scroll', (e) => this.syncScroll(e));
        
        // 初始化字数统计
        this.updateWordCount();
    }

    // 新的选区保存机制
    setupSelectionPreservation() {
        // 监听选区变化，实时保存
        this.editor.addEventListener('selectionchange', () => {
            this.saveCurrentSelection();
        });
        
        // 监听鼠标和键盘事件，保存选区
        this.editor.addEventListener('mouseup', () => {
            this.saveCurrentSelection();
        });
        
        this.editor.addEventListener('keyup', () => {
            this.saveCurrentSelection();
        });
        
        // 监听焦点变化，保存选区
        this.editor.addEventListener('blur', () => {
            console.log('编辑器失去焦点，保存当前选区');
            this.saveCurrentSelection();
        });
        
        this.editor.addEventListener('focus', () => {
            console.log('编辑器获得焦点');
            // 可以选择在获得焦点时恢复选区
            // this.restoreSelection();
        });
        
        // 全局选区变化监听
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === this.editor) {
                this.saveCurrentSelection();
            }
        });
    }
    
    // 保存当前选区状态
    saveCurrentSelection() {
        if (!this.editor) return;
        
        try {
            const start = this.editor.selectionStart;
            const end = this.editor.selectionEnd;
            const text = this.editor.value.substring(start, end);
            
            this.savedSelection = {
                start: start,
                end: end,
                text: text,
                timestamp: Date.now()
            };
            
            // 只在有实际选区时才记录日志
            if (start !== end) {
                console.log('保存选区:', this.savedSelection);
            }
        } catch (error) {
            console.warn('保存选区失败:', error);
        }
    }
    
    // 恢复选区状态
    restoreSelection() {
        if (!this.editor || !this.savedSelection) return;
        
        try {
            this.editor.focus();
            this.editor.setSelectionRange(this.savedSelection.start, this.savedSelection.end);
            console.log('恢复选区:', this.savedSelection);
        } catch (error) {
            console.warn('恢复选区失败:', error);
        }
    }
    
    // 获取有效的选区（当前选区或保存的选区）
    getEffectiveSelection() {
        // 如果编辑器有焦点，使用当前选区
        if (document.activeElement === this.editor) {
            return {
                start: this.editor.selectionStart,
                end: this.editor.selectionEnd,
                text: this.editor.value.substring(this.editor.selectionStart, this.editor.selectionEnd)
            };
        }
        
        // 否则使用保存的选区
        return this.savedSelection;
    }

    setupToolbar() {
        // 工具栏已在HTML中定义，不需要动态创建
        // 这个方法保留为兼容性，但不执行任何操作
        console.log('使用现有的HTML工具栏');
    }

    createToolbarStyles() {
        // 样式已在主CSS文件中定义，不需要动态创建
        // 这个方法保留为兼容性，但不执行任何操作
        console.log('使用现有的CSS样式');
    }

    setupEventListeners() {
        // 快捷键
        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        this.handleToolbarAction('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.handleToolbarAction('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.handleToolbarAction('strikethrough');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.handleToolbarAction('link');
                        break;
                }
            }
        });

        // 实时预览
        this.editor.addEventListener('input', () => {
            if (this.isPreviewMode) {
                this.updatePreview();
            }
            // 更新字数统计
            this.updateWordCount();
        });
    }

    // 简化的工具栏绑定方法 - 基于历史版本的正确逻辑
    bindToolbarWithSelectionPreservation() {
        const toolbarButtons = document.querySelectorAll('.markdown-toolbar .toolbar-btn');
        
        console.log('找到工具栏按钮:', toolbarButtons.length);
        
        toolbarButtons.forEach(btn => {
            // 清理之前的事件监听器
            this.cleanupButtonEvents(btn);
            
            // 使用简单的点击事件处理
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('工具栏按钮点击:', btn.id);
                
                // 直接处理工具栏动作，不使用复杂的选区保存机制
                const action = btn.id.replace('md-', '').replace('-btn', '');
                this.handleToolbarAction(action);
                
                // 确保编辑器保持焦点
                this.editor.focus();
            });
            
            console.log('绑定简化按钮事件:', btn.id);
        });
        
        console.log('已绑定', toolbarButtons.length, '个工具栏按钮 - 简化版本');
    }
    
    // 清理按钮事件
    cleanupButtonEvents(btn) {
        // 移除所有可能的事件监听器
        const events = ['click', 'mousedown', 'focus', 'focusin'];
        events.forEach(eventType => {
            if (btn[`_${eventType}Handler`]) {
                btn.removeEventListener(eventType, btn[`_${eventType}Handler`]);
            }
        });
        
        // 重置事件处理器
        btn.onclick = null;
        btn.onmousedown = null;
        btn.onfocus = null;
        btn.onfocusin = null;
    }
    
    // 基于选区的工具栏动作处理 - 已移除，使用简化版本
    
    // 恢复编辑器焦点
    restoreEditorFocus() {
        if (this.editor && document.activeElement !== this.editor) {
            this.editor.focus();
            
            // 如果有保存的选区，恢复它
            if (this.savedSelection && this.savedSelection.start !== undefined) {
                try {
                    this.editor.setSelectionRange(this.savedSelection.start, this.savedSelection.end);
                } catch (error) {
                    console.warn('恢复焦点后恢复选区失败:', error);
                }
            }
        }
    }
    
    setupGlobalFocusGuard() {
        // 全局焦点监听器 - 最强防护
        document.addEventListener('focusin', (e) => {
            const target = e.target;
            if (target && (
                target.dataset.toolbarBtn ||
                target.classList.contains('toolbar-btn') ||
                target.closest('.toolbar-btn') ||
                target.closest('.markdown-toolbar')
            )) {
                console.log('全局焦点监听器: 阻止工具栏按钮获得焦点', target);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                target.blur();
                
                // 强制编辑器获得焦点
                if (this.editor) {
                    this.editor.focus();
                }
                return false;
            }
        }, true);

        // 全局 mousedown 监听器 - 优先级最高
        document.addEventListener('mousedown', (e) => {
            const target = e.target;
            if (target && (
                target.dataset.toolbarBtn ||
                target.classList.contains('toolbar-btn') ||
                target.closest('.toolbar-btn')
            )) {
                console.log('全局 mousedown 监听器: 拦截工具栏按钮', target);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // 立即让按钮失去焦点
                target.blur();
                
                // 保存编辑器状态
                if (this.editor) {
                    const currentSelection = {
                        start: this.editor.selectionStart,
                        end: this.editor.selectionEnd
                    };
                    
                    // 确保编辑器获得焦点
                    this.editor.focus();
                    
                    // 处理工具栏动作
                    const button = target.closest('.toolbar-btn');
                    if (button && button.id) {
                        const action = button.id.replace('md-', '').replace('-btn', '');
                        this.handleToolbarAction(action);
                    }
                    
                    // 多重恢复焦点
                    setTimeout(() => {
                        this.editor.focus();
                        if (currentSelection.start !== currentSelection.end) {
                            this.editor.setSelectionRange(currentSelection.start, currentSelection.end);
                        }
                    }, 0);
                }
                
                return false;
            }
        }, true);

        // 全局点击监听器 - 最后防线
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target && (
                target.dataset.toolbarBtn ||
                target.classList.contains('toolbar-btn') ||
                target.closest('.toolbar-btn')
            )) {
                console.log('全局点击监听器: 拦截工具栏按钮点击', target);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // 强制编辑器获得焦点
                if (this.editor) {
                    this.editor.focus();
                }
                return false;
            }
        }, true);

        // 键盘事件监听 - 防止 Tab 键导致的焦点切换
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const activeElement = document.activeElement;
                if (activeElement && (
                    activeElement.dataset.toolbarBtn ||
                    activeElement.classList.contains('toolbar-btn') ||
                    activeElement.closest('.toolbar-btn')
                )) {
                    console.log('键盘事件: 阻止 Tab 键切换到工具栏按钮');
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.editor) {
                        this.editor.focus();
                    }
                    return false;
                }
            }
        }, true);
    }
    
    // 析构函数，清理定时器
    destroy() {
        if (this.focusCheckInterval) {
            clearInterval(this.focusCheckInterval);
        }
    }

    handleToolbarAction(action) {
        console.log('处理工具栏动作:', action);
        
        switch (action) {
            case 'bold':
                this.insertMarkdown('**', '**', '粗体文本');
                break;
            case 'italic':
                this.insertMarkdown('*', '*', '斜体文本');
                break;
            case 'strikethrough':
                this.insertMarkdown('~~', '~~', '删除线文本');
                break;
            case 'heading':
                this.insertHeading(2);
                break;
            case 'quote':
                this.insertQuote();
                break;
            case 'code':
                this.insertMarkdown('`', '`', '代码');
                break;
            case 'list-ul':
                this.insertList('unordered');
                break;
            case 'list-ol':
                this.insertList('ordered');
                break;
            case 'task-list':
                this.insertTaskList();
                break;
            case 'link':
                this.insertLink();
                break;
            case 'image':
                this.insertImage();
                break;
            case 'table':
                this.insertTable();
                break;
            case 'hr':
                this.insertHorizontalRule();
                break;
            case 'preview':
                this.togglePreview();
                break;
            case 'undo':
                this.undo();
                break;
            case 'redo':
                this.redo();
                break;
            case 'find':
                this.showFindReplace();
                break;
            default:
                console.warn('未知的工具栏动作:', action);
        }
    }

    /**
     * 插入Markdown格式 - 基于历史版本的简单有效逻辑
     * @param {string} prefix - 前缀标记
     * @param {string} suffix - 后缀标记
     * @param {string} placeholder - 占位符文本
     */
    insertMarkdown(prefix, suffix, placeholder) {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end);

        if (selectedText.length === 0) {
            // 没有选中文本，插入格式标记和占位符
            const marker = prefix + placeholder + suffix;
            const beforeText = this.editor.value.substring(0, start);
            const afterText = this.editor.value.substring(end);
            this.editor.value = beforeText + marker + afterText;
            // 选中占位符文本
            this.editor.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length);
        } else {
            // 有选中文本，添加或移除格式
            let formattedText;
            if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
                // 移除格式
                formattedText = selectedText.slice(prefix.length, -suffix.length);
            } else {
                // 添加格式
                formattedText = prefix + selectedText + suffix;
            }

            const beforeText = this.editor.value.substring(0, start);
            const afterText = this.editor.value.substring(end);
            this.editor.value = beforeText + formattedText + afterText;
            
            // 重新选中文本
            this.editor.setSelectionRange(start, start + formattedText.length);
        }

        this.editor.focus();
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * 插入任务列表 - 支持保存的选区
     */
    insertTaskList() {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end) || '任务项';
        
        // 确保在行首插入
        const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
        const replacement = '- [ ] ' + selectedText;
        
        const beforeText = this.editor.value.substring(0, lineStart);
        const afterText = this.editor.value.substring(end);
        this.editor.value = beforeText + replacement + afterText;
        
        // 设置光标位置
        this.editor.setSelectionRange(lineStart + replacement.length, lineStart + replacement.length);
        this.editor.focus();
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertHeading(level = 1) {
        const prefix = '#'.repeat(level) + ' ';
        const selection = this.getEffectiveSelection();
        let start, end, selectedText;
        
        if (selection && selection.start !== undefined && selection.end !== undefined) {
            start = selection.start;
            end = selection.end;
            selectedText = selection.text || this.editor.value.substring(start, end);
        } else {
            start = this.editor.selectionStart;
            end = this.editor.selectionEnd;
            selectedText = this.editor.value.substring(start, end);
        }
        
        selectedText = selectedText || '标题文本';
        
        // 确保在行首插入
        const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
        const replacement = prefix + selectedText;
        
        this.replaceSelectionWithRange(replacement, lineStart, end);
        this.editor.focus();
        
        // 触发输入事件以更新预览
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertQuote() {
        const selection = this.getEffectiveSelection();
        let start, end, selectedText;
        
        if (selection && selection.start !== undefined && selection.end !== undefined) {
            start = selection.start;
            end = selection.end;
            selectedText = selection.text || this.editor.value.substring(start, end);
        } else {
            start = this.editor.selectionStart;
            end = this.editor.selectionEnd;
            selectedText = this.editor.value.substring(start, end);
        }
        
        selectedText = selectedText || '引用文本';
        
        // 确保在行首插入
        const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
        const replacement = '> ' + selectedText;
        
        this.replaceSelectionWithRange(replacement, lineStart, end);
        this.editor.focus();
        
        // 触发输入事件以更新预览
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertList(type) {
        const selection = this.getEffectiveSelection();
        let start, end, selectedText;
        
        if (selection && selection.start !== undefined && selection.end !== undefined) {
            start = selection.start;
            end = selection.end;
            selectedText = selection.text || this.editor.value.substring(start, end);
        } else {
            start = this.editor.selectionStart;
            end = this.editor.selectionEnd;
            selectedText = this.editor.value.substring(start, end);
        }
        
        let replacement;
        if (type === 'ordered') {
            replacement = selectedText || '列表项目';
            replacement = '1. ' + replacement;
        } else {
            replacement = selectedText || '列表项目';
            replacement = '- ' + replacement;
        }
        
        // 确保在行首插入
        const lineStart = this.editor.value.lastIndexOf('\n', start - 1) + 1;
        this.replaceSelectionWithRange(replacement, lineStart, end);
        this.editor.focus();
        
        // 触发输入事件以更新预览
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertLink() {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end) || '链接文本';
        
        const replacement = `[${selectedText}](网址)`;
        const beforeText = this.editor.value.substring(0, start);
        const afterText = this.editor.value.substring(end);
        this.editor.value = beforeText + replacement + afterText;
        
        // 选中 "网址" 部分以便用户输入
        const urlStart = start + selectedText.length + 3;
        const urlEnd = urlStart + 2;
        this.editor.setSelectionRange(urlStart, urlEnd);
        this.editor.focus();
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertImage() {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end) || '图片描述';
        
        const replacement = `![${selectedText}](图片网址)`;
        const beforeText = this.editor.value.substring(0, start);
        const afterText = this.editor.value.substring(end);
        this.editor.value = beforeText + replacement + afterText;
        
        // 选中 "图片网址" 部分以便用户输入
        const urlStart = start + selectedText.length + 4;
        const urlEnd = urlStart + 4;
        this.editor.setSelectionRange(urlStart, urlEnd);
        this.editor.focus();
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertTable() {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const replacement = `| 标题1 | 标题2 | 标题3 |
|-------|-------|-------|
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |`;
        
        const beforeText = this.editor.value.substring(0, start);
        const afterText = this.editor.value.substring(end);
        this.editor.value = beforeText + replacement + afterText;
        
        this.editor.setSelectionRange(start + replacement.length, start + replacement.length);
        this.editor.focus();
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    insertHorizontalRule() {
        if (!this.editor) return;

        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const replacement = '\n---\n';
        
        const beforeText = this.editor.value.substring(0, start);
        const afterText = this.editor.value.substring(end);
        this.editor.value = beforeText + replacement + afterText;
        
        this.editor.setSelectionRange(start + replacement.length, start + replacement.length);
        this.editor.focus();
        this.editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    replaceSelection(text) {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const value = this.editor.value;
        
        this.editor.value = value.substring(0, start) + text + value.substring(end);
        this.editor.setSelectionRange(start + text.length, start + text.length);
    }

    replaceSelectionWithRange(text, start, end) {
        const value = this.editor.value;
        
        this.editor.value = value.substring(0, start) + text + value.substring(end);
        this.editor.setSelectionRange(start + text.length, start + text.length);
    }

    handleKeyDown(e) {
        // 处理特殊按键
        if (e.key === 'Tab') {
            e.preventDefault();
            this.insertMarkdown('    ', '', '');
        }
    }

    handleInput(e) {
        // 自动更新预览
        if (this.isPreviewMode) {
            this.updatePreview();
        }
        
        // 触发字数统计更新
        if (window.appManager && window.appManager.updateWordCount) {
            window.appManager.updateWordCount();
        }
    }

    syncScroll(e) {
        // 同步滚动（如果预览面板可见）
        if (this.isPreviewMode && this.preview) {
            const scrollRatio = this.editor.scrollTop / (this.editor.scrollHeight - this.editor.clientHeight);
            this.preview.scrollTop = scrollRatio * (this.preview.scrollHeight - this.preview.clientHeight);
        }
    }

    togglePreview() {
        this.isPreviewMode = !this.isPreviewMode;
        const previewBtn = document.querySelector('[data-action="preview"]');
        
        if (this.isPreviewMode) {
            this.showPreview();
            if (previewBtn) previewBtn.classList.add('active');
        } else {
            this.hidePreview();
            if (previewBtn) previewBtn.classList.remove('active');
        }
    }

    showPreview() {
        if (!this.preview) {
            this.createPreviewPanel();
        }
        
        this.preview.style.display = 'block';
        this.updatePreview();
    }

    hidePreview() {
        if (this.preview) {
            this.preview.style.display = 'none';
        }
    }

    createPreviewPanel() {
        // 预览面板应该已经在HTML中存在
        this.preview = document.getElementById('preview-content');
        if (!this.preview) {
            console.warn('预览面板不存在');
        }
    }

    updatePreview() {
        if (!this.preview) return;
        
        const content = this.editor.value;
        const html = this.markdownToHtml(content);
        this.preview.innerHTML = html;
    }

    refreshPreview() {
        if (this.isPreviewMode) {
            this.updatePreview();
        }
    }

    markdownToHtml(markdown) {
        if (!markdown) return '';
        
        let html = markdown;

        // 标题
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

        // 粗体和斜体
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // 删除线
        html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // 行内代码
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 代码块
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // 链接
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

        // 图片
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

        // 引用
        html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');

        // 无序列表
        html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

        // 有序列表
        html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');

        // 任务列表
        html = html.replace(/^- \[ \] (.*$)/gm, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>');
        html = html.replace(/^- \[x\] (.*$)/gm, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>');

        // 分隔线
        html = html.replace(/^---$/gm, '<hr>');

        // 段落
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';

        // 清理空段落
        html = html.replace(/<p><\/p>/g, '');

        return html;
    }

    /**
     * 更新字数统计
     */
    updateWordCount() {
        if (!this.editor) return;
        
        const text = this.editor.value;
        const wordCountElement = document.getElementById('word-count');
        
        if (!wordCountElement) return;
        
        // 计算字数（中文字符和英文单词）
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').match(/\b\w+\b/g) || [];
        const totalWords = chineseChars + englishWords.length;
        
        wordCountElement.textContent = totalWords;
    }

    /**
     * 撤销操作
     */
    undo() {
        if (window.editorManager && window.editorManager.undo) {
            window.editorManager.undo();
        } else if (this.editor && document.execCommand) {
            document.execCommand('undo');
        }
    }

    /**
     * 重做操作
     */
    redo() {
        if (window.editorManager && window.editorManager.redo) {
            window.editorManager.redo();
        } else if (this.editor && document.execCommand) {
            document.execCommand('redo');
        }
    }

    /**
     * 显示查找替换对话框
     */
    showFindReplace() {
        if (window.editorManager && window.editorManager.showFindReplace) {
            window.editorManager.showFindReplace();
        } else {
            // 创建自定义查找替换界面
            this.createFindReplaceModal();
        }
    }

    /**
     * 创建查找替换模态框
     */
    createFindReplaceModal() {
        // 移除已存在的模态框
        const existingModal = document.getElementById('find-replace-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建模态框HTML
        const modal = document.createElement('div');
        modal.id = 'find-replace-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content find-replace-content">
                    <div class="modal-header">
                        <h3>查找和替换</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').parentElement.remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="find-replace-group">
                            <label>查找:</label>
                            <input type="text" id="find-input" placeholder="输入要查找的文本">
                            <div class="find-controls">
                                <button id="find-prev-btn" title="查找上一个">
                                    <i class="fas fa-chevron-up"></i>
                                </button>
                                <button id="find-next-btn" title="查找下一个">
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                        <div class="find-replace-group">
                            <label>替换:</label>
                            <input type="text" id="replace-input" placeholder="输入替换文本">
                            <div class="replace-controls">
                                <button id="replace-btn">替换</button>
                                <button id="replace-all-btn">全部替换</button>
                            </div>
                        </div>
                        <div class="find-options">
                            <label>
                                <input type="checkbox" id="case-sensitive"> 区分大小写
                            </label>
                            <label>
                                <input type="checkbox" id="whole-word"> 全词匹配
                            </label>
                        </div>
                        <div class="find-status" id="find-status"></div>
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        this.addFindReplaceStyles();

        // 添加到页面
        document.body.appendChild(modal);

        // 绑定事件
        this.bindFindReplaceEvents();

        // 聚焦到查找输入框
        const findInput = document.getElementById('find-input');
        if (findInput) {
            findInput.focus();
        }
    }

    /**
     * 添加查找替换样式
     */
    addFindReplaceStyles() {
        if (document.getElementById('find-replace-styles')) return;

        const style = document.createElement('style');
        style.id = 'find-replace-styles';
        style.textContent = `
            .find-replace-content {
                width: 450px;
                max-width: 90vw;
            }

            .find-replace-group {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
                gap: 8px;
            }

            .find-replace-group label {
                min-width: 60px;
                font-weight: 500;
                color: var(--text-primary);
            }

            .find-replace-group input[type="text"] {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                background: var(--bg-tertiary);
                color: var(--text-primary);
                font-size: 14px;
            }

            .find-replace-group input[type="text"]:focus {
                outline: none;
                border-color: var(--primary-color);
                box-shadow: 0 0 0 2px rgba(108, 92, 231, 0.2);
            }

            .find-controls, .replace-controls {
                display: flex;
                gap: 4px;
            }

            .find-controls button, .replace-controls button {
                padding: 8px 12px;
                border: none;
                border-radius: 4px;
                background: var(--primary-color);
                color: white;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.2s;
            }

            .find-controls button:hover, .replace-controls button:hover {
                background: var(--primary-hover);
            }

            .find-options {
                display: flex;
                gap: 16px;
                margin-bottom: 12px;
            }

            .find-options label {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 13px;
                color: var(--text-primary);
                cursor: pointer;
            }

            .find-status {
                font-size: 12px;
                color: var(--text-secondary);
                min-height: 16px;
            }

            .find-highlight {
                background-color: yellow;
                color: black;
            }

            .find-current {
                background-color: orange;
                color: black;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 绑定查找替换事件
     */
    bindFindReplaceEvents() {
        const findInput = document.getElementById('find-input');
        const replaceInput = document.getElementById('replace-input');
        const findPrevBtn = document.getElementById('find-prev-btn');
        const findNextBtn = document.getElementById('find-next-btn');
        const replaceBtn = document.getElementById('replace-btn');
        const replaceAllBtn = document.getElementById('replace-all-btn');

        this.findMatches = [];
        this.currentMatchIndex = -1;

        // 查找输入变化时实时搜索
        if (findInput) {
            findInput.addEventListener('input', () => {
                this.performFind();
            });

            findInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (e.shiftKey) {
                        this.findPrevious();
                    } else {
                        this.findNext();
                    }
                    e.preventDefault();
                }
                if (e.key === 'Escape') {
                    document.getElementById('find-replace-modal').remove();
                }
            });
        }

        // 按钮事件
        if (findPrevBtn) {
            findPrevBtn.addEventListener('click', () => this.findPrevious());
        }

        if (findNextBtn) {
            findNextBtn.addEventListener('click', () => this.findNext());
        }

        if (replaceBtn) {
            replaceBtn.addEventListener('click', () => this.replaceCurrent());
        }

        if (replaceAllBtn) {
            replaceAllBtn.addEventListener('click', () => this.replaceAll());
        }

        // 选项变化时重新搜索
        const caseSensitive = document.getElementById('case-sensitive');
        const wholeWord = document.getElementById('whole-word');

        if (caseSensitive) {
            caseSensitive.addEventListener('change', () => this.performFind());
        }

        if (wholeWord) {
            wholeWord.addEventListener('change', () => this.performFind());
        }
    }

    /**
     * 执行查找
     */
    performFind() {
        const findInput = document.getElementById('find-input');
        const caseSensitive = document.getElementById('case-sensitive');
        const wholeWord = document.getElementById('whole-word');
        const status = document.getElementById('find-status');

        if (!findInput || !this.editor) return;

        const searchText = findInput.value;
        if (!searchText) {
            this.clearHighlights();
            status.textContent = '';
            return;
        }

        // 清除之前的高亮
        this.clearHighlights();

        // 构建正则表达式
        let flags = 'g';
        if (!caseSensitive.checked) flags += 'i';

        let pattern = searchText;
        if (wholeWord.checked) {
            pattern = `\\b${pattern}\\b`;
        }

        try {
            const regex = new RegExp(pattern, flags);
            const text = this.editor.value;
            
            this.findMatches = [];
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                this.findMatches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0]
                });
            }

            // 更新状态
            if (this.findMatches.length > 0) {
                this.currentMatchIndex = 0;
                this.highlightMatches();
                status.textContent = `找到 ${this.findMatches.length} 个匹配项`;
            } else {
                status.textContent = '未找到匹配项';
                this.currentMatchIndex = -1;
            }
        } catch (error) {
            status.textContent = '正则表达式错误';
        }
    }

    /**
     * 高亮匹配项
     */
    highlightMatches() {
        // 这里由于textarea的限制，我们只能跳转到匹配位置
        // 在富文本编辑器中可以实现真正的高亮
        if (this.findMatches.length > 0 && this.currentMatchIndex >= 0) {
            const match = this.findMatches[this.currentMatchIndex];
            this.editor.focus();
            this.editor.setSelectionRange(match.start, match.end);
            
            const status = document.getElementById('find-status');
            if (status) {
                status.textContent = `第 ${this.currentMatchIndex + 1} 个，共 ${this.findMatches.length} 个匹配项`;
            }
        }
    }

    /**
     * 清除高亮
     */
    clearHighlights() {
        // 在textarea中我们只需要清除选择
        if (this.editor) {
            this.editor.setSelectionRange(0, 0);
        }
    }

    /**
     * 查找下一个
     */
    findNext() {
        if (this.findMatches.length === 0) return;
        
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.findMatches.length;
        this.highlightMatches();
    }

    /**
     * 查找上一个
     */
    findPrevious() {
        if (this.findMatches.length === 0) return;
        
        this.currentMatchIndex = this.currentMatchIndex <= 0 
            ? this.findMatches.length - 1 
            : this.currentMatchIndex - 1;
        this.highlightMatches();
    }

    /**
     * 替换当前
     */
    replaceCurrent() {
        const replaceInput = document.getElementById('replace-input');
        if (!replaceInput || this.findMatches.length === 0 || this.currentMatchIndex < 0) return;

        const replaceText = replaceInput.value;
        const match = this.findMatches[this.currentMatchIndex];
        
        // 执行替换
        const text = this.editor.value;
        const newText = text.substring(0, match.start) + replaceText + text.substring(match.end);
        this.editor.value = newText;
        
        // 触发输入事件以更新字数统计等
        this.editor.dispatchEvent(new Event('input'));
        
        // 重新查找以更新匹配项
        this.performFind();
    }

    /**
     * 全部替换
     */
    replaceAll() {
        const replaceInput = document.getElementById('replace-input');
        if (!replaceInput || this.findMatches.length === 0) return;

        const replaceText = replaceInput.value;
        const count = this.findMatches.length;
        
        // 从后往前替换以避免位置偏移问题
        for (let i = this.findMatches.length - 1; i >= 0; i--) {
            const match = this.findMatches[i];
            const text = this.editor.value;
            const newText = text.substring(0, match.start) + replaceText + text.substring(match.end);
            this.editor.value = newText;
        }
        
        // 触发输入事件
        this.editor.dispatchEvent(new Event('input'));
        
        // 更新状态
        const status = document.getElementById('find-status');
        if (status) {
            status.textContent = `已替换 ${count} 个匹配项`;
        }
        
        // 重新查找
        this.performFind();
    }

    toggleFullscreen() {
        const editorContainer = this.editor.closest('.editor-container');
        if (editorContainer) {
            editorContainer.classList.toggle('fullscreen');
        }
    }

    setupGlobalFocusProtection() {
        console.log('设置全局焦点保护...');
        
        // 全局焦点监听，确保工具栏按钮永远不会获得焦点
        document.addEventListener('focusin', (e) => {
            const target = e.target;
            if (target && target.hasAttribute && target.hasAttribute('data-toolbar-btn')) {
                console.log('检测到工具栏按钮获得焦点，立即转移到编辑器');
                e.preventDefault();
                e.stopImmediatePropagation();
                target.blur();
                if (this.editor) {
                    this.editor.focus();
                }
            }
        }, true);
        
        // 监听所有可能的焦点事件
        document.addEventListener('focus', (e) => {
            const target = e.target;
            if (target && target.hasAttribute && target.hasAttribute('data-toolbar-btn')) {
                console.log('检测到工具栏按钮focus事件，立即转移到编辑器');
                e.preventDefault();
                e.stopImmediatePropagation();
                target.blur();
                if (this.editor) {
                    this.editor.focus();
                }
            }
        }, true);
        
        // 更温和的定期检查：每500ms检查一次而不是100ms
        this.focusCheckInterval = setInterval(() => {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.hasAttribute && activeElement.hasAttribute('data-toolbar-btn')) {
                console.log('定期检查发现工具栏按钮有焦点，立即转移');
                activeElement.blur();
                if (this.editor) {
                    this.editor.focus();
                }
            }
        }, 500);
        
        console.log('全局焦点保护设置完成');
    }
}

// 导出到全局作用域
window.MarkdownEnhancedEditor = MarkdownEnhancedEditor;

// 初始化 Markdown 增强编辑器
document.addEventListener('DOMContentLoaded', () => {
    // 等待一下确保 DOM 完全加载
    setTimeout(() => {
        const editorElement = document.getElementById('editor-textarea');
        const previewElement = document.getElementById('preview-content');
        
        if (editorElement) {
            window.markdownEnhancedEditor = new MarkdownEnhancedEditor(editorElement, previewElement);
            console.log('全局 Markdown 增强编辑器已初始化');
        } else {
            console.warn('编辑器元素不存在，无法初始化 Markdown 增强编辑器');
        }
    }, 100);
});
