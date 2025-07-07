/**
 * 右键菜单管理模块
 * 处理各种右键菜单的显示和操作
 */

class ContextMenuManager {
    constructor() {
        this.activeMenu = null;
        this.cachedProjectItem = null; // 缓存当前项目信息
        this.init();
    }

    init() {
        // 绑定全局点击事件来隐藏菜单
        document.addEventListener('click', (e) => {
            // 检查点击的元素是否在菜单内
            const clickedMenu = e.target.closest('.context-menu');
            const clickedMenuItem = e.target.closest('.context-menu-item');
            
            console.log('全局点击事件:', {
                target: e.target,
                clickedMenu: !!clickedMenu,
                clickedMenuItem: !!clickedMenuItem,
                activeMenu: !!this.activeMenu
            });
            
            // 如果点击的是菜单项，不要立即隐藏菜单，让菜单项处理完成后再隐藏
            if (clickedMenuItem) {
                console.log('点击了菜单项，延迟隐藏菜单');
                return;
            }
            
            // 如果点击的不是菜单区域，隐藏所有菜单
            if (!clickedMenu) {
                console.log('点击菜单外部，隐藏所有菜单');
                this.hideAllMenus();
            }
        });

        // 绑定右键菜单事件
        this.bindContextMenus();
        
        console.log('右键菜单管理器初始化完成');
    }

    bindContextMenus() {
        // 立即尝试绑定
        this.bindEditorContextMenu();
        this.bindProjectContextMenu();
        this.bindChapterContextMenu();
        
        // 延迟绑定，确保DOM已加载
        setTimeout(() => {
            this.bindEditorContextMenu();
            this.bindProjectContextMenu();
            this.bindChapterContextMenu();
        }, 100);
        
        // 再次延迟绑定，确保动态内容已加载
        setTimeout(() => {
            this.bindProjectContextMenu();
            this.bindChapterContextMenu();
        }, 1000);
    }

    bindEditorContextMenu() {
        const editor = document.getElementById('editor-textarea');
        if (!editor) {
            console.warn('编辑器元素不存在，无法绑定右键菜单');
            return;
        }

        editor.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showEditorContextMenu(e);
        });

        console.log('编辑器右键菜单绑定完成');
    }

    bindProjectContextMenu() {
        // 尝试多个可能的项目列表容器
        const projectContainers = [
            document.getElementById('recent-projects'),
            document.getElementById('project-list'),
            document.querySelector('.project-list'),
            document.querySelector('[data-panel="projects"]')
        ].filter(container => container !== null);
        
        if (projectContainers.length === 0) {
            console.warn('项目列表元素不存在，无法绑定右键菜单');
            // 延迟重试绑定
            setTimeout(() => {
                this.bindProjectContextMenu();
            }, 1000);
            return;
        }

        projectContainers.forEach(projectList => {
            console.log('找到项目列表容器，绑定右键菜单:', projectList.id || projectList.className);

            // 移除之前的事件监听器（如果存在）
            if (this.projectContextMenuHandler) {
                projectList.removeEventListener('contextmenu', this.projectContextMenuHandler);
            }
            
            // 创建绑定的事件处理器
            this.projectContextMenuHandler = (e) => {
                // 检查是否点击在项目项上
                const projectItem = e.target.closest('.project-item');
                if (projectItem) {
                    e.preventDefault();
                    // 获取项目名称，支持两种不同的结构
                    const projectName = projectItem.dataset.projectName ||
                                       projectItem.querySelector('.project-name')?.textContent?.trim() ||
                                       projectItem.querySelector('h3')?.textContent?.trim() ||
                                       '未知项目';
                    console.log('项目右键菜单触发:', projectName);
                    this.showProjectContextMenu(e, projectItem);
                }
            };

            projectList.addEventListener('contextmenu', this.projectContextMenuHandler);
        });

        console.log('项目右键菜单绑定完成，绑定容器数量:', projectContainers.length);
    }

    bindChapterContextMenu() {
        const chapterList = document.getElementById('chapters-list');
        if (!chapterList) {
            console.warn('章节列表元素不存在，无法绑定右键菜单');
            return;
        }

        chapterList.addEventListener('contextmenu', (e) => {
            // 检查是否点击在章节项上
            const chapterItem = e.target.closest('.chapter-item');
            if (chapterItem) {
                e.preventDefault();
                this.showChapterContextMenu(e, chapterItem);
            }
        });

        console.log('章节右键菜单绑定完成');
    }

    showEditorContextMenu(e) {
        const menu = document.getElementById('editor-context-menu');
        if (!menu) {
            console.warn('编辑器右键菜单元素不存在');
            return;
        }

        this.hideAllMenus();
        this.showMenu(menu, e.pageX, e.pageY);
        this.activeMenu = menu;

        // 绑定菜单项事件
        this.bindEditorMenuItems(menu);
    }

    showProjectContextMenu(e, projectItem) {
        console.log('=== 显示项目右键菜单 ===');
        console.log('鼠标位置:', { x: e.pageX, y: e.pageY });
        console.log('项目元素:', projectItem);
        console.log('项目元素的 dataset:', projectItem ? projectItem.dataset : null);
        
        // 检查项目元素是否有效
        if (!projectItem || !projectItem.dataset) {
            console.error('项目元素无效或没有 dataset 属性');
            this.showNotification('项目信息获取失败', 'error');
            return;
        }
        
        // 获取项目路径和名称，支持两种不同的 dataset 结构
        const projectPath = projectItem.dataset.projectPath || projectItem.dataset.path;
        const projectName = projectItem.dataset.projectName || 
                           projectItem.querySelector('.project-name')?.textContent?.trim() ||
                           projectItem.querySelector('h3')?.textContent?.trim() ||
                           '未知项目';
        
        console.log('项目名称:', projectName);
        console.log('项目路径:', projectPath);
        
        // 检查项目路径是否有效
        if (!projectPath || 
            projectPath === 'undefined' || 
            projectPath === 'null' || 
            projectPath.trim() === '') {
            console.error('项目路径无效:', projectPath);
            this.showNotification('项目路径无效', 'error');
            return;
        }
        
        // 缓存当前项目信息
        this.cachedProjectItem = {
            path: projectPath,
            name: projectName,
            element: projectItem
        };
        
        console.log('缓存的项目信息:', this.cachedProjectItem);
        
        const menu = document.getElementById('project-context-menu');
        if (!menu) {
            console.warn('项目右键菜单元素不存在');
            return;
        }

        console.log('菜单元素找到:', menu);
        console.log('菜单当前display:', getComputedStyle(menu).display);
        
        this.hideAllMenus();
        this.showMenu(menu, e.pageX, e.pageY);
        this.activeMenu = menu;

        // 绑定菜单项事件
        this.bindProjectMenuItems(menu, projectItem);
        
        console.log('菜单显示后display:', getComputedStyle(menu).display);
        console.log('菜单position:', {
            left: menu.style.left,
            top: menu.style.top
        });
        
        // 检查菜单项状态
        const menuItems = menu.querySelectorAll('.context-menu-item');
        menuItems.forEach((item, index) => {
            const computedStyle = getComputedStyle(item);
            console.log(`菜单项 ${index + 1}:`, {
                action: item.dataset.action,
                display: computedStyle.display,
                pointerEvents: computedStyle.pointerEvents,
                cursor: computedStyle.cursor,
                zIndex: computedStyle.zIndex
            });
        });
        
        console.log('=== 项目右键菜单显示完成 ===');
    }

    showChapterContextMenu(e, chapterItem) {
        const menu = document.getElementById('chapter-context-menu');
        if (!menu) {
            console.warn('章节右键菜单元素不存在');
            return;
        }

        this.hideAllMenus();
        this.showMenu(menu, e.pageX, e.pageY);
        this.activeMenu = menu;

        // 绑定菜单项事件
        this.bindChapterMenuItems(menu, chapterItem);
    }

    showMenu(menu, x, y) {
        console.log('显示菜单:', { x, y });
        
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.zIndex = '10000';

        // 确保菜单在屏幕内
        const rect = menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (rect.right > windowWidth) {
            const newLeft = windowWidth - rect.width - 10;
            menu.style.left = Math.max(0, newLeft) + 'px';
        }
        if (rect.bottom > windowHeight) {
            const newTop = windowHeight - rect.height - 10;
            menu.style.top = Math.max(0, newTop) + 'px';
        }
        
        console.log('菜单最终位置:', {
            left: menu.style.left,
            top: menu.style.top,
            width: rect.width,
            height: rect.height
        });
    }

    hideAllMenus() {
        const menus = document.querySelectorAll('.context-menu');
        menus.forEach(menu => {
            menu.style.display = 'none';
        });
        this.activeMenu = null;
        // 延迟清空缓存的项目信息，确保菜单项处理完成
        setTimeout(() => {
            this.cachedProjectItem = null;
            console.log('已清空缓存的项目信息');
        }, 100);
    }

    bindEditorMenuItems(menu) {
        const items = menu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            // 移除之前的事件监听器
            item.removeEventListener('click', item._contextHandler);
            
            item._contextHandler = (e) => {
                e.preventDefault();
                const action = item.dataset.action;
                this.handleEditorAction(action);
                this.hideAllMenus();
            };
            
            item.addEventListener('click', item._contextHandler);
        });
    }

    bindProjectMenuItems(menu, projectItem) {
        console.log('绑定项目菜单项事件:', menu, projectItem);
        console.log('当前缓存的项目信息:', this.cachedProjectItem);
        
        const items = menu.querySelectorAll('.context-menu-item');
        console.log('找到菜单项数量:', items.length);
        
        items.forEach((item, index) => {
            const action = item.dataset.action;
            console.log(`菜单项 ${index + 1}: action="${action}", text="${item.textContent.trim()}"`);
            
            // 移除之前的事件监听器
            if (item._contextHandler) {
                item.removeEventListener('click', item._contextHandler);
            }
            
            item._contextHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('菜单项被点击:', action);
                console.log('点击时的缓存项目信息:', this.cachedProjectItem);
                
                // 保存当前缓存的项目信息，防止在 hideAllMenus 中被清空
                const cachedInfo = this.cachedProjectItem;
                
                // 先隐藏菜单
                this.hideAllMenus();
                
                // 恢复缓存的项目信息
                this.cachedProjectItem = cachedInfo;
                
                // 处理项目操作
                this.handleProjectAction(action, projectItem);
            };
            
            item.addEventListener('click', item._contextHandler);
            console.log(`菜单项 ${index + 1} 事件绑定完成`);
        });
        
        console.log('所有项目菜单项事件绑定完成');
    }

    bindChapterMenuItems(menu, chapterItem) {
        const items = menu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            // 移除之前的事件监听器
            item.removeEventListener('click', item._contextHandler);
            
            item._contextHandler = (e) => {
                e.preventDefault();
                const action = item.dataset.action;
                this.handleChapterAction(action, chapterItem);
                this.hideAllMenus();
            };
            
            item.addEventListener('click', item._contextHandler);
        });
    }

    handleEditorAction(action) {
        const editor = document.getElementById('editor-textarea');
        if (!editor) return;

        console.log('处理编辑器右键菜单动作:', action);

        // 保存当前选区
        const selectionStart = editor.selectionStart;
        const selectionEnd = editor.selectionEnd;

        switch (action) {
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
                editor.select();
                break;
            case 'bold':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertMarkdown('**', '**', '粗体文本');
                }
                break;
            case 'italic':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertMarkdown('*', '*', '斜体文本');
                }
                break;
            case 'underline':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertMarkdown('<u>', '</u>', '下划线文本');
                }
                break;
            case 'heading':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertHeading(2);
                }
                break;
            case 'bullet-list':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertList('unordered');
                }
                break;
            case 'numbered-list':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertList('ordered');
                }
                break;
            case 'quote':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertQuote();
                }
                break;
            case 'code':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertMarkdown('`', '`', '代码');
                }
                break;
            case 'code-block':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertMarkdown('```\n', '\n```', '代码块');
                }
                break;
            case 'link':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertLink();
                }
                break;
            case 'image':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertImage();
                }
                break;
            case 'table':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertTable();
                }
                break;
            case 'horizontal-rule':
                if (window.markdownEnhancedEditor) {
                    window.markdownEnhancedEditor.insertHorizontalRule();
                }
                break;
            case 'ai-continue':
                this.handleAIAction('continue');
                break;
            case 'ai-rewrite':
                this.handleAIAction('rewrite');
                break;
            case 'ai-optimize':
                this.handleAIAction('optimize');
                break;
            default:
                console.warn('未知的编辑器动作:', action);
        }

        // 恢复编辑器焦点
        setTimeout(() => {
            editor.focus();
            if (selectionStart !== selectionEnd) {
                editor.setSelectionRange(selectionStart, selectionEnd);
            }
        }, 0);
    }

    handleProjectAction(action, projectItem) {
        console.log('=== 处理项目右键菜单动作 ===');
        console.log('动作:', action);
        console.log('项目元素:', projectItem);
        console.log('项目元素的 dataset:', projectItem ? projectItem.dataset : null);
        console.log('缓存的项目信息:', this.cachedProjectItem);
        
        // 优先使用缓存的项目信息
        let projectName, projectPath;
        if (this.cachedProjectItem) {
            projectName = this.cachedProjectItem.name;
            projectPath = this.cachedProjectItem.path;
            console.log('使用缓存的项目信息');
        } else if (projectItem && projectItem.dataset) {
            // 支持两种不同的 dataset 结构
            projectPath = projectItem.dataset.projectPath || projectItem.dataset.path;
            projectName = projectItem.dataset.projectName || 
                         projectItem.querySelector('.project-name')?.textContent?.trim() ||
                         projectItem.querySelector('h3')?.textContent?.trim() ||
                         projectItem.textContent.trim();
            console.log('使用传入的项目元素信息');
        } else {
            console.error('项目元素不存在或没有 dataset 属性');
            this.showNotification('项目信息获取失败', 'error');
            return;
        }
        
        console.log('最终使用的项目信息:', {
            projectName: projectName,
            projectPath: projectPath,
            projectNameType: typeof projectName,
            projectPathType: typeof projectPath,
            projectNameLength: projectName ? projectName.length : 0,
            projectPathLength: projectPath ? projectPath.length : 0
        });
        
        // 检查项目路径是否有效
        if (!projectPath || projectPath === 'undefined' || projectPath === 'null' || projectPath.trim() === '') {
            console.error('项目路径无效:', {
                projectPath: projectPath,
                type: typeof projectPath,
                length: projectPath ? projectPath.length : 0
            });
            this.showNotification('项目路径无效或为空', 'error');
            return;
        }
        
        console.log('项目名称:', projectName);
        console.log('项目路径:', projectPath);
        console.log('项目管理器存在:', !!window.projectManager);

        switch (action) {
            case 'open-project':
                console.log('执行打开项目操作');
                if (window.projectManager) {
                    try {
                        window.projectManager.openProject(projectPath);
                        this.showNotification(`正在打开项目: ${projectName}`, 'info');
                    } catch (error) {
                        console.error('打开项目失败:', error);
                        this.showNotification('打开项目失败', 'error');
                    }
                } else {
                    console.error('项目管理器不存在');
                    this.showNotification('项目管理器不可用', 'error');
                }
                break;
                
            case 'export-project':
                console.log('执行导出项目操作');
                if (window.projectManager) {
                    try {
                        window.projectManager.exportProject(projectPath);
                        this.showNotification(`正在导出项目: ${projectName}`, 'info');
                    } catch (error) {
                        console.error('导出项目失败:', error);
                        this.showNotification('导出项目失败', 'error');
                    }
                } else {
                    console.error('项目管理器不存在');
                    this.showNotification('项目管理器不可用', 'error');
                }
                break;
                
            case 'delete-project':
                console.log('执行删除项目操作');
                if (window.projectManager) {
                    if (confirm(`确定要删除项目 "${projectName}" 吗？\n\n路径: ${projectPath}\n\n此操作不可恢复！`)) {
                        try {
                            window.projectManager.deleteProject(projectPath);
                            this.showNotification(`正在删除项目: ${projectName}`, 'info');
                        } catch (error) {
                            console.error('删除项目失败:', error);
                            this.showNotification('删除项目失败', 'error');
                        }
                    } else {
                        console.log('用户取消删除操作');
                    }
                } else {
                    console.error('项目管理器不存在');
                    this.showNotification('项目管理器不可用', 'error');
                }
                break;
                
            default:
                console.warn('未知的项目动作:', action);
                this.showNotification(`未知操作: ${action}`, 'warning');
        }
        
        console.log('=== 项目动作处理完成 ===');
    }

    handleChapterAction(action, chapterItem) {
        const chapterId = chapterItem.dataset.chapterId || chapterItem.dataset.id;
        const chapterName = chapterItem.querySelector('.chapter-title')?.textContent?.trim() || chapterItem.textContent.trim();
        
        // 提取纯章节标题（去掉序号和字数统计）
        const titleMatch = chapterName.match(/^\d+\.\s*(.+?)\s*\(\d+\s*字\)$/) || chapterName.match(/^\d+\.\s*(.+)$/);
        const cleanTitle = titleMatch ? titleMatch[1] : chapterName;
        
        console.log('处理章节右键菜单动作:', action, '章节ID:', chapterId, '章节名:', cleanTitle);

        switch (action) {
            case 'open-chapter':
                // 使用 app.js 的方法加载章节
                if (window.appManager && window.appManager.loadChapter) {
                    window.appManager.loadChapter(chapterId);
                } else {
                    console.warn('无法找到 appManager.loadChapter 方法');
                    this.showNotification('无法打开章节', 'error');
                }
                break;
                
            case 'rename-chapter':
                // 使用 app.js 的方法重命名章节
                if (window.appManager && window.appManager.renameChapter) {
                    window.appManager.renameChapter(chapterId, cleanTitle);
                } else {
                    console.warn('无法找到 appManager.renameChapter 方法');
                    this.showNotification('无法重命名章节', 'error');
                }
                break;
                
            case 'delete-chapter':
                // 使用 app.js 的方法删除章节
                if (window.appManager && window.appManager.deleteChapter) {
                    window.appManager.deleteChapter(chapterId);
                } else {
                    console.warn('无法找到 appManager.deleteChapter 方法');
                    this.showNotification('无法删除章节', 'error');
                }
                break;
                
            default:
                console.warn('未知的章节动作:', action);
        }
    }

    /**
     * 处理AI操作
     * @param {string} action - AI操作类型 (continue, rewrite, optimize)
     */
    handleAIAction(action) {
        const editor = document.getElementById('editor-textarea');
        if (!editor) return;

        // 获取选中的文本或光标位置
        const selectionStart = editor.selectionStart;
        const selectionEnd = editor.selectionEnd;
        const selectedText = editor.value.substring(selectionStart, selectionEnd);

        console.log('AI操作:', action, '选中文本长度:', selectedText.length);

        // 缓存选中的文本信息到AI管理器
        if (window.aiManager && selectedText) {
            window.aiManager.selectionStart = selectionStart;
            window.aiManager.selectionEnd = selectionEnd;
            window.aiManager.selectedTextCache = selectedText;
            window.aiManager.lastSelectionTime = Date.now();
        }

        // 切换到AI助手面板并执行相应操作
        if (window.appManager) {
            // 先切换到AI助手面板
            const aiPanel = document.querySelector('[data-panel="ai"]');
            if (aiPanel) {
                aiPanel.click();
            }

            // 根据操作类型执行相应的AI功能
            setTimeout(() => {
                switch (action) {
                    case 'continue':
                        this.triggerAIContinue(selectedText);
                        break;
                    case 'rewrite':
                        this.triggerAIRewrite(selectedText);
                        break;
                    case 'optimize':
                        this.triggerAIOptimize(selectedText);
                        break;
                }
            }, 100);
        } else {
            this.showNotification('AI助手不可用', 'error');
        }
    }

    /**
     * 触发AI续写
     */
    triggerAIContinue(context) {
        const prompt = context ? 
            `请基于以下内容继续创作:\n\n${context}` : 
            '请继续创作当前章节的内容';
        
        // 设置操作类型
        if (window.aiManager) {
            window.aiManager.lastOperation = 'continue';
        }
        
        this.setAIPromptAndGenerate(prompt);
        this.showNotification('AI续写已启动', 'info');
    }

    /**
     * 触发AI重写
     */
    triggerAIRewrite(selectedText) {
        if (!selectedText) {
            this.showNotification('请先选择要重写的文本', 'warning');
            return;
        }

        const prompt = `请重写以下文本，保持原意但改善表达:\n\n${selectedText}`;
        
        // 设置操作类型
        if (window.aiManager) {
            window.aiManager.lastOperation = 'rewrite';
        }
        
        this.setAIPromptAndGenerate(prompt);
        this.showNotification('AI重写已启动', 'info');
    }

    /**
     * 触发AI优化
     */
    triggerAIOptimize(selectedText) {
        if (!selectedText) {
            this.showNotification('请先选择要优化的文本', 'warning');
            return;
        }

        const prompt = `请优化以下文本的语言表达、逻辑结构和可读性:\n\n${selectedText}`;
        
        // 设置操作类型
        if (window.aiManager) {
            window.aiManager.lastOperation = 'optimize';
        }
        
        this.setAIPromptAndGenerate(prompt);
        this.showNotification('AI优化已启动', 'info');
    }

    /**
     * 设置AI提示并开始生成
     */
    setAIPromptAndGenerate(prompt) {
        console.log('设置AI提示:', prompt);
        
        // 先切换到 AI 助手标签页（正确的ID是ai）
        const aiTab = document.querySelector('[data-tab="ai"]');
        if (aiTab) {
            aiTab.click();
            console.log('切换到AI助手标签页');
        } else {
            console.error('找不到AI助手标签页');
            this.showNotification('找不到AI助手标签页', 'error');
            return;
        }
        
        // 延迟设置内容，确保标签页已切换
        setTimeout(() => {
            const aiPromptTextarea = document.getElementById('ai-prompt-input');
            if (aiPromptTextarea) {
                aiPromptTextarea.value = prompt;
                aiPromptTextarea.focus();
                console.log('设置AI提示内容成功');
                
                // 触发生成按钮点击
                const generateBtn = document.getElementById('ai-generate-btn');
                if (generateBtn && !generateBtn.disabled) {
                    generateBtn.click();
                    console.log('触发AI生成');
                } else {
                    console.warn('生成按钮不可用');
                    this.showNotification('AI生成功能当前不可用', 'warning');
                }
            } else {
                console.error('找不到AI提示输入框');
                this.showNotification('AI助手界面未找到', 'error');
            }
        }, 200);
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
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
        
        // 3秒后自动消失
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // 公共方法：重新绑定项目右键菜单
    rebindProjectContextMenu() {
        console.log('重新绑定项目右键菜单');
        this.bindProjectContextMenu();
    }

    // 公共方法：重新绑定所有右键菜单
    rebindAllContextMenus() {
        console.log('重新绑定所有右键菜单');
        this.bindContextMenus();
    }

    // 测试方法：手动触发项目菜单项点击
    testProjectMenuClick(action) {
        console.log('测试项目菜单点击:', action);
        
        // 模拟项目元素
        const mockProjectItem = {
            dataset: {
                projectName: '测试项目',
                projectPath: 'C:\\Users\\32109\\Documents\\ArtiMeowProjects\\测试项目'
            }
        };
        
        this.handleProjectAction(action, mockProjectItem);
    }
}

// 创建全局右键菜单管理器实例
window.contextMenuManager = new ContextMenuManager();
