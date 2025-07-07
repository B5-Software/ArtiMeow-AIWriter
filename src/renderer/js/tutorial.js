/**
 * 教程管理器
 * 负责加载和显示教程内容
 */
class TutorialManager {
    constructor() {
        this.tutorials = [];
        this.currentTutorial = null;
        this.tutorialModal = null;
        this.tutorialList = null;
        this.tutorialViewer = null;
        this.tutorialSearch = null;
        this.tutorialBreadcrumb = null;
        this.searchTimeout = null;
        
        this.init();
    }

    async init() {
        this.initElements();
        this.initEventListeners();
        await this.loadTutorials();
    }

    initElements() {
        this.tutorialModal = document.getElementById('tutorial-modal');
        this.tutorialList = document.getElementById('tutorial-list');
        this.tutorialViewer = document.getElementById('tutorial-viewer-content');
        this.tutorialSearch = document.getElementById('tutorial-search');
        this.tutorialBreadcrumb = document.getElementById('tutorial-breadcrumb');
        
        // 检查关键元素是否存在
        if (!this.tutorialModal) {
            console.error('教程模态框元素未找到');
            return;
        }
        
        if (!this.tutorialList) {
            console.error('教程列表元素未找到');
            return;
        }
        
        if (!this.tutorialViewer) {
            console.error('教程查看器元素未找到');
            return;
        }
    }

    initEventListeners() {
        // 教程按钮点击事件
        const tutorialBtn = document.getElementById('tutorial-btn');
        if (tutorialBtn) {
            tutorialBtn.addEventListener('click', () => {
                this.openTutorial();
            });
        } else {
            console.error('教程按钮元素未找到');
        }

        // 模态框关闭事件
        if (this.tutorialModal) {
            const modalClose = this.tutorialModal.querySelector('.modal-close');
            if (modalClose) {
                modalClose.addEventListener('click', () => {
                    this.closeTutorial();
                });
            }

            // 点击模态框外部关闭
            this.tutorialModal.addEventListener('click', (e) => {
                if (e.target === this.tutorialModal) {
                    this.closeTutorial();
                }
            });
        }

        // 搜索功能
        if (this.tutorialSearch) {
            this.tutorialSearch.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchTutorials(e.target.value);
                }, 300);
            });
        }

        // ESC 键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.tutorialModal && this.tutorialModal.classList.contains('show')) {
                this.closeTutorial();
            }
        });
    }

    async loadTutorials() {
        try {
            // 获取教程目录
            const tutorialDir = await window.electronAPI.getTutorialDirectory();
            
            // 读取所有教程文件
            const files = await window.electronAPI.readTutorialFiles();
            
            this.tutorials = files.map(file => ({
                filename: file.filename,
                title: this.extractTitle(file.content),
                content: file.content,
                order: this.extractOrder(file.filename)
            }));

            // 按顺序排序
            this.tutorials.sort((a, b) => a.order - b.order);
            
            console.log('加载的教程文件:');
            this.tutorials.forEach(tutorial => {
                console.log(`- ${tutorial.filename}: ${tutorial.title}`);
            });
            
            this.renderTutorialList();
        } catch (error) {
            console.error('加载教程失败:', error);
            this.showError('加载教程失败，请检查教程文件是否存在。');
        }
    }

    extractTitle(content) {
        // 提取 Markdown 文件的第一个标题
        const lines = content.split('\n');
        for (let line of lines) {
            if (line.startsWith('# ')) {
                return line.substring(2).trim();
            }
        }
        return '未知标题';
    }

    extractOrder(filename) {
        // 从文件名中提取顺序号
        const match = filename.match(/^(\d+)-/);
        return match ? parseInt(match[1]) : 999;
    }

    renderTutorialList() {
        if (!this.tutorialList) return;

        this.tutorialList.innerHTML = '';

        this.tutorials.forEach(tutorial => {
            const item = document.createElement('div');
            item.className = 'tutorial-item';
            
            // 特殊处理目录文件
            if (tutorial.filename.startsWith('00-')) {
                item.classList.add('directory');
            }
            
            item.innerHTML = `
                <div class="tutorial-item-title">${tutorial.title}</div>
                <div class="tutorial-item-number">${tutorial.filename}</div>
            `;
            
            item.addEventListener('click', () => {
                this.selectTutorial(tutorial);
            });
            
            this.tutorialList.appendChild(item);
        });
    }

    selectTutorial(tutorial) {
        // 更新当前教程
        this.currentTutorial = tutorial;
        
        // 更新列表选中状态
        this.tutorialList.querySelectorAll('.tutorial-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const selectedItem = Array.from(this.tutorialList.querySelectorAll('.tutorial-item'))
            .find(item => item.querySelector('.tutorial-item-number').textContent === tutorial.filename);
        
        if (selectedItem) {
            selectedItem.classList.add('active');
        }
        
        // 渲染教程内容
        this.renderTutorialContent(tutorial);
        
        // 更新面包屑
        this.updateBreadcrumb(tutorial);
    }

    renderTutorialContent(tutorial) {
        if (!this.tutorialViewer) return;

        try {
            // 处理交叉引用
            const processedContent = this.processContent(tutorial.content);
            
            // 使用 marked 渲染 Markdown
            const htmlContent = marked.parse(processedContent);
            
            this.tutorialViewer.innerHTML = htmlContent;
            
            // 处理交叉引用链接
            this.processLinks();
            
            // 滚动到顶部
            this.tutorialViewer.scrollTop = 0;
            
            console.log('教程内容渲染完成:', tutorial.title);
            
        } catch (error) {
            console.error('渲染教程内容失败:', error);
            this.showError('渲染教程内容失败。');
        }
    }

    processContent(content) {
        // 处理 Markdown 链接中的交叉引用
        // 确保所有 .md 文件链接都被正确处理
        const processed = content.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (match, text, filename) => {
            // 清理文件名，只保留基本名称
            const cleanFilename = filename.replace(/^.*[\\\/]/, ''); // 移除路径
            console.log(`发现链接: [${text}](${filename}) -> [${text}](${cleanFilename})`);
            return `[${text}](${cleanFilename})`;
        });
        
        return processed;
    }

    processLinks() {
        // 处理所有链接，不仅仅是 .md 文件
        const links = this.tutorialViewer.querySelectorAll('a');
        console.log(`处理 ${links.length} 个链接`);
        
        links.forEach((link, index) => {
            const href = link.getAttribute('href');
            console.log(`链接 ${index + 1}: "${href}"`);
            
            // 如果是 .md 文件链接，进行交叉引用处理
            if (href && href.endsWith('.md')) {
                // 清理文件名，只保留基本名称
                const cleanHref = href.replace(/^.*[\\\/]/, '');
                console.log(`清理后的链接: "${cleanHref}"`);
                
                // 严格验证链接有效性
                if (this.isInvalidLink(cleanHref)) {
                    console.warn('跳过无效链接:', cleanHref);
                    this.setInvalidLink(link, href);
                    return;
                }
                
                // 查找对应的教程 - 使用多种匹配策略
                const targetTutorial = this.findMatchingTutorial(cleanHref);
                
                if (targetTutorial) {
                    this.setCrossReferenceLink(link, targetTutorial);
                } else {
                    console.warn(`未找到教程文件: "${cleanHref}"`);
                    this.setNotFoundLink(link, href);
                }
            } else if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                // 外部链接在新窗口打开
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                console.log('设置外部链接:', href);
            } else if (href && href.startsWith('#')) {
                // 锚点链接保持原样
                console.log('保持锚点链接:', href);
            } else if (href && !href.startsWith('javascript:')) {
                // 其他链接阻止默认行为
                link.href = 'javascript:void(0)';
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('链接被阻止:', href);
                });
                console.log('阻止其他链接:', href);
            }
        });
    }

    // 检查链接是否无效
    isInvalidLink(cleanHref) {
        // 检查是否包含通配符
        if (cleanHref.includes('*')) {
            return true;
        }
        
        // 检查是否为空或过短
        if (!cleanHref || cleanHref.length <= 3 || cleanHref === '.md') {
            return true;
        }
        
        // 检查是否包含非法字符（但允许URL编码的%符号）
        if (/[<>:"|?*\\]/.test(cleanHref) && !cleanHref.includes('%')) {
            return true;
        }
        
        // 检查是否是有效的文件名格式（支持URL编码）
        if (!/^[\w\u4e00-\u9fff\-\.%]+\.md$/i.test(cleanHref)) {
            return true;
        }
        
        return false;
    }

    // 查找匹配的教程
    findMatchingTutorial(cleanHref) {
        return this.tutorials.find(t => {
            // 完全匹配
            if (t.filename === cleanHref) {
                console.log(`完全匹配找到: ${t.filename}`);
                return true;
            }
            
            // 处理 URL 编码的文件名
            try {
                const decodedHref = decodeURIComponent(cleanHref);
                if (t.filename === decodedHref) {
                    console.log(`URL 解码匹配找到: ${t.filename} <- ${cleanHref}`);
                    return true;
                }
            } catch (e) {
                // 如果解码失败，忽略错误继续其他匹配
                console.log(`URL 解码失败: ${cleanHref}`);
            }
            
            // 部分匹配（去掉数字前缀）
            const baseHref = cleanHref.replace(/^\d+-/, '');
            const baseFilename = t.filename.replace(/^\d+-/, '');
            if (baseFilename === baseHref && baseHref.length > 0) {
                console.log(`部分匹配找到: ${t.filename} -> ${baseFilename}`);
                return true;
            }
            
            // URL 编码的部分匹配
            try {
                const decodedBaseHref = decodeURIComponent(baseHref);
                if (baseFilename === decodedBaseHref && decodedBaseHref.length > 0) {
                    console.log(`URL 解码部分匹配找到: ${t.filename} -> ${decodedBaseHref}`);
                    return true;
                }
            } catch (e) {
                // 解码失败，忽略
            }
            
            // 模糊标题匹配（更严格）
            const hrefTitle = cleanHref.replace(/^\d+-/, '').replace('.md', '').replace(/-/g, '');
            const tutorialTitle = t.title.replace(/\s+/g, '').replace(/[^\w\u4e00-\u9fff]/g, '');
            if (hrefTitle.length > 2 && tutorialTitle.toLowerCase().includes(hrefTitle.toLowerCase())) {
                console.log(`标题匹配找到: ${t.title} -> ${hrefTitle}`);
                return true;
            }
            
            // URL 编码的标题匹配
            try {
                const decodedHrefTitle = decodeURIComponent(hrefTitle);
                const normalizedDecodedTitle = decodedHrefTitle.replace(/\s+/g, '').replace(/[^\w\u4e00-\u9fff]/g, '');
                if (normalizedDecodedTitle.length > 2 && tutorialTitle.toLowerCase().includes(normalizedDecodedTitle.toLowerCase())) {
                    console.log(`URL 解码标题匹配找到: ${t.title} -> ${decodedHrefTitle}`);
                    return true;
                }
            } catch (e) {
                // 解码失败，忽略
            }
            
            return false;
        });
    }

    // 设置交叉引用链接
    setCrossReferenceLink(link, targetTutorial) {
        link.classList.add('cross-reference');
        link.href = 'javascript:void(0)';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('点击交叉引用链接:', targetTutorial.title);
            this.selectTutorial(targetTutorial);
        });
        link.style.cursor = 'pointer';
        link.title = `点击查看: ${targetTutorial.title}`;
        console.log(`成功设置交叉引用: ${targetTutorial.filename} -> ${targetTutorial.title}`);
    }

    // 设置无效链接
    setInvalidLink(link, href) {
        link.href = 'javascript:void(0)';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            console.warn('无效链接被点击:', href);
        });
        link.style.cursor = 'not-allowed';
        link.style.opacity = '0.5';
        link.title = `无效链接: ${href}`;
    }

    // 设置未找到的链接
    setNotFoundLink(link, href) {
        link.href = 'javascript:void(0)';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // 不再输出错误，只是静默处理
        });
        link.style.cursor = 'not-allowed';
        link.style.opacity = '0.6';
        link.title = `教程文件不存在: ${href}`;
    }

    updateBreadcrumb(tutorial) {
        if (!this.tutorialBreadcrumb) return;
        
        this.tutorialBreadcrumb.innerHTML = `
            <i class="fas fa-book"></i>
            <span>教程</span>
            <i class="fas fa-chevron-right"></i>
            <span>${tutorial.title}</span>
        `;
    }

    searchTutorials(query) {
        if (!query.trim()) {
            // 清除搜索结果，显示所有教程
            this.renderTutorialList();
            return;
        }

        query = query.toLowerCase();
        
        // 过滤教程
        const filteredTutorials = this.tutorials.filter(tutorial => 
            tutorial.title.toLowerCase().includes(query) ||
            tutorial.filename.toLowerCase().includes(query) ||
            tutorial.content.toLowerCase().includes(query)
        );

        // 渲染搜索结果
        this.renderSearchResults(filteredTutorials, query);
    }

    renderSearchResults(tutorials, query) {
        if (!this.tutorialList) return;

        this.tutorialList.innerHTML = '';

        if (tutorials.length === 0) {
            this.tutorialList.innerHTML = `
                <div class="tutorial-error">
                    <p>没有找到匹配的教程</p>
                </div>
            `;
            return;
        }

        tutorials.forEach(tutorial => {
            const item = document.createElement('div');
            item.className = 'tutorial-item search-match';
            
            if (tutorial.filename.startsWith('00-')) {
                item.classList.add('directory');
            }
            
            item.innerHTML = `
                <div class="tutorial-item-title">${this.highlightText(tutorial.title, query)}</div>
                <div class="tutorial-item-number">${tutorial.filename}</div>
            `;
            
            item.addEventListener('click', () => {
                this.selectTutorial(tutorial);
            });
            
            this.tutorialList.appendChild(item);
        });
    }

    highlightText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }

    showError(message) {
        if (this.tutorialViewer) {
            this.tutorialViewer.innerHTML = `
                <div class="tutorial-error">
                    <h3>错误</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    showLoading() {
        if (this.tutorialViewer) {
            this.tutorialViewer.innerHTML = `
                <div class="tutorial-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>加载中...</span>
                </div>
            `;
        }
    }

    openTutorial() {
        console.log('尝试打开教程模态框');
        
        if (!this.tutorialModal) {
            console.error('教程模态框元素不存在，重新初始化');
            this.initElements();
            if (!this.tutorialModal) {
                console.error('重新初始化后仍然无法找到教程模态框');
                return;
            }
        }
        
        // 检查是否已经显示
        if (this.tutorialModal.classList.contains('show')) {
            console.log('教程模态框已经显示');
            return;
        }
        
        // 强制显示模态框
        this.tutorialModal.style.display = 'flex';
        this.tutorialModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // 如果还没有选择教程，默认选择第一个
        if (!this.currentTutorial && this.tutorials.length > 0) {
            this.selectTutorial(this.tutorials[0]);
        }
        
        console.log('教程模态框已打开');
    }

    closeTutorial() {
        console.log('尝试关闭教程模态框');
        
        if (!this.tutorialModal) {
            console.error('教程模态框元素不存在，无法关闭');
            return;
        }
        
        this.tutorialModal.classList.remove('show');
        document.body.style.overflow = '';
        
        // 延迟隐藏，等待动画完成
        setTimeout(() => {
            if (this.tutorialModal && !this.tutorialModal.classList.contains('show')) {
                this.tutorialModal.style.display = 'none';
            }
        }, 300);
        
        console.log('教程模态框已关闭');
    }
}

// 扩展 window.electronAPI 的教程相关方法
if (window.electronAPI) {
    // 获取教程目录
    window.electronAPI.getTutorialDirectory = async () => {
        return await window.electronAPI.invoke('get-tutorial-directory');
    };

    // 读取教程文件
    window.electronAPI.readTutorialFiles = async () => {
        return await window.electronAPI.invoke('read-tutorial-files');
    };
}

// 创建全局教程管理器实例
let tutorialManager = null;

// 确保在所有内容加载完成后初始化
function initializeTutorialManager() {
    try {
        console.log('开始初始化教程管理器');
        
        // 检查必要的元素是否存在
        const tutorialBtn = document.getElementById('tutorial-btn');
        const tutorialModal = document.getElementById('tutorial-modal');
        
        if (!tutorialBtn) {
            console.error('教程按钮元素未找到');
            return;
        }
        
        if (!tutorialModal) {
            console.error('教程模态框元素未找到');
            return;
        }
        
        tutorialManager = new TutorialManager();
        console.log('教程管理器初始化完成');
        
        // 全局导出
        window.tutorialManager = tutorialManager;
        
    } catch (error) {
        console.error('教程管理器初始化失败:', error);
    }
}

// 在 DOM 内容加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 内容加载完成');
    
    // 延迟初始化以确保所有元素都已加载
    setTimeout(() => {
        initializeTutorialManager();
    }, 500);
});

// 如果 DOM 已经加载完成，立即初始化
if (document.readyState === 'loading') {
    // DOM 还在加载，等待 DOMContentLoaded 事件
} else {
    // DOM 已经加载完成，立即初始化
    setTimeout(() => {
        initializeTutorialManager();
    }, 100);
}

// 导出给其他模块使用
window.TutorialManager = TutorialManager;
