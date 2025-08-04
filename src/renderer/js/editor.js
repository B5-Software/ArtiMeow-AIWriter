// 编辑器功能模块
class EditorManager {
  constructor() {
    this.editor = null;
    this.isFullscreen = false;
    this.isFocusMode = false;
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 50;
    
    this.init();
  }

  init() {
    this.editor = document.getElementById('editor-textarea');
    if (!this.editor) return;

    this.initToolbar();
    this.initUndoRedo();
    this.initFindReplace();
    this.initFormatting();
    this.initKeyboardShortcuts();
  }

  initToolbar() {
    // 格式化按钮
    const boldBtn = document.querySelector('[title="加粗"]');
    const italicBtn = document.querySelector('[title="斜体"]');
    const underlineBtn = document.querySelector('[title="下划线"]');
    const undoBtn = document.querySelector('[title="撤销"]');
    const redoBtn = document.querySelector('[title="重做"]');
    const findBtn = document.getElementById('md-find-btn'); // 修复按钮选择器

    if (boldBtn) {
      boldBtn.addEventListener('click', () => this.toggleFormat('bold'));
    }
    if (italicBtn) {
      italicBtn.addEventListener('click', () => this.toggleFormat('italic'));
    }
    if (underlineBtn) {
      underlineBtn.addEventListener('click', () => this.toggleFormat('underline'));
    }
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
    }
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
    }
    if (findBtn) {
      findBtn.addEventListener('click', () => this.showFindReplace());
    }
  }

  initUndoRedo() {
    if (!this.editor) return;

    let lastValue = this.editor.value;
    let timeout = null;

    this.editor.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (this.editor.value !== lastValue) {
          this.pushToUndoStack(lastValue);
          lastValue = this.editor.value;
        }
      }, 500); // 500ms 延迟，避免频繁保存
    });

    // 键盘快捷键
    this.editor.addEventListener('keydown', (e) => {
      if (e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.undo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          this.redo();
        } else if (e.key === 'f') {
          e.preventDefault();
          this.showFindReplace();
        } else if (e.key === 'b') {
          e.preventDefault();
          this.toggleFormat('bold');
        } else if (e.key === 'i') {
          e.preventDefault();
          this.toggleFormat('italic');
        } else if (e.key === 'u') {
          e.preventDefault();
          this.toggleFormat('underline');
        }
      }
    });
  }

  pushToUndoStack(value) {
    this.undoStack.push(value);
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }
    this.redoStack = []; // 清空重做栈
  }

  undo() {
    if (this.undoStack.length === 0) return;

    const currentValue = this.editor.value;
    const previousValue = this.undoStack.pop();
    
    this.redoStack.push(currentValue);
    this.editor.value = previousValue;
    
    // 触发输入事件以更新字数等
    this.editor.dispatchEvent(new Event('input'));
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const currentValue = this.editor.value;
    const nextValue = this.redoStack.pop();
    
    this.undoStack.push(currentValue);
    this.editor.value = nextValue;
    
    // 触发输入事件以更新字数等
    this.editor.dispatchEvent(new Event('input'));
  }

  toggleFormat(format) {
    if (!this.editor) return;

    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const selectedText = this.editor.value.substring(start, end);

    if (selectedText.length === 0) {
      // 没有选中文本，插入格式标记
      let markers = { bold: '****', italic: '**', underline: '____' };
      const marker = markers[format];
      if (marker) {
        const beforeText = this.editor.value.substring(0, start);
        const afterText = this.editor.value.substring(end);
        this.editor.value = beforeText + marker + afterText;
        this.editor.setSelectionRange(start + marker.length / 2, start + marker.length / 2);
      }
    } else {
      // 有选中文本，添加或移除格式
      let formattedText;
      switch (format) {
        case 'bold':
          formattedText = selectedText.startsWith('**') && selectedText.endsWith('**')
            ? selectedText.slice(2, -2)
            : `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = selectedText.startsWith('*') && selectedText.endsWith('*')
            ? selectedText.slice(1, -1)
            : `*${selectedText}*`;
          break;
        case 'underline':
          formattedText = selectedText.startsWith('__') && selectedText.endsWith('__')
            ? selectedText.slice(2, -2)
            : `__${selectedText}__`;
          break;
        default:
          formattedText = selectedText;
      }

      const beforeText = this.editor.value.substring(0, start);
      const afterText = this.editor.value.substring(end);
      this.editor.value = beforeText + formattedText + afterText;
      
      // 重新选中文本
      this.editor.setSelectionRange(start, start + formattedText.length);
    }

    this.editor.focus();
    this.editor.dispatchEvent(new Event('input'));
  }

  initFindReplace() {
    // 创建查找替换面板
    this.createFindReplacePanel();
  }

  createFindReplacePanel() {
    // 检查是否已经存在面板
    if (document.getElementById('find-replace-panel')) {
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'find-replace-panel';
    panel.className = 'find-replace hidden';
    panel.innerHTML = `
      <button class="find-replace-close" onclick="window.editorManager.hideFindReplace()">
        <i class="fas fa-times"></i>
      </button>
      <div class="find-replace-row">
        <input type="text" class="find-replace-input" id="find-input" placeholder="查找...">
        <button class="find-replace-btn" onclick="window.editorManager.findNext()">查找下一个</button>
        <button class="find-replace-btn" onclick="window.editorManager.findPrevious()">查找上一个</button>
      </div>
      <div class="find-replace-row">
        <input type="text" class="find-replace-input" id="replace-input" placeholder="替换为...">
        <button class="find-replace-btn" onclick="window.editorManager.replaceNext()">替换</button>
        <button class="find-replace-btn" onclick="window.editorManager.replaceAll()">全部替换</button>
      </div>
    `;

    // 找到正确的父元素
    const editorContent = document.querySelector('.editor-content');
    if (editorContent) {
      editorContent.appendChild(panel);
    } else {
      // 如果没有找到 .editor-content，尝试其他容器
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.appendChild(panel);
      } else {
        document.body.appendChild(panel);
      }
    }

    // 绑定回车键事件
    const findInput = panel.querySelector('#find-input');
    const replaceInput = panel.querySelector('#replace-input');

    if (findInput) {
      findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.findNext();
        } else if (e.key === 'Escape') {
          this.hideFindReplace();
        }
      });
    }

    if (replaceInput) {
      replaceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.replaceNext();
        } else if (e.key === 'Escape') {
          this.hideFindReplace();
        }
      });
    }
  }

  showFindReplace() {
    const panel = document.getElementById('find-replace-panel');
    if (panel) {
      panel.classList.remove('hidden');
      const findInput = panel.querySelector('#find-input');
      if (findInput) {
        findInput.focus();
        findInput.select();
      }
    }
  }

  hideFindReplace() {
    const panel = document.getElementById('find-replace-panel');
    if (panel) {
      panel.classList.add('hidden');
      this.editor.focus();
    }
  }

  findNext() {
    const findInput = document.getElementById('find-input');
    if (!findInput || !this.editor) return;

    const searchText = findInput.value;
    if (!searchText) return;

    const content = this.editor.value;
    const currentPos = this.editor.selectionEnd;
    const nextPos = content.indexOf(searchText, currentPos);

    if (nextPos !== -1) {
      this.editor.setSelectionRange(nextPos, nextPos + searchText.length);
      this.editor.focus();
    } else {
      // 从头开始搜索
      const firstPos = content.indexOf(searchText);
      if (firstPos !== -1) {
        this.editor.setSelectionRange(firstPos, firstPos + searchText.length);
        this.editor.focus();
      } else {
        window.ArtiMeowApp?.showError('未找到匹配内容');
      }
    }
  }

  findPrevious() {
    const findInput = document.getElementById('find-input');
    if (!findInput || !this.editor) return;

    const searchText = findInput.value;
    if (!searchText) return;

    const content = this.editor.value;
    const currentPos = this.editor.selectionStart;
    const beforeContent = content.substring(0, currentPos);
    const prevPos = beforeContent.lastIndexOf(searchText);

    if (prevPos !== -1) {
      this.editor.setSelectionRange(prevPos, prevPos + searchText.length);
      this.editor.focus();
    } else {
      // 从末尾开始搜索
      const lastPos = content.lastIndexOf(searchText);
      if (lastPos !== -1) {
        this.editor.setSelectionRange(lastPos, lastPos + searchText.length);
        this.editor.focus();
      } else {
        window.ArtiMeowApp?.showError('未找到匹配内容');
      }
    }
  }

  replaceNext() {
    const findInput = document.getElementById('find-input');
    const replaceInput = document.getElementById('replace-input');
    if (!findInput || !replaceInput || !this.editor) return;

    const searchText = findInput.value;
    const replaceText = replaceInput.value;
    if (!searchText) return;

    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const selectedText = this.editor.value.substring(start, end);

    if (selectedText === searchText) {
      // 替换当前选中的文本
      const beforeText = this.editor.value.substring(0, start);
      const afterText = this.editor.value.substring(end);
      this.editor.value = beforeText + replaceText + afterText;
      
      // 选中替换后的文本
      this.editor.setSelectionRange(start, start + replaceText.length);
      this.editor.dispatchEvent(new Event('input'));
    }

    // 查找下一个
    this.findNext();
  }

  replaceAll() {
    const findInput = document.getElementById('find-input');
    const replaceInput = document.getElementById('replace-input');
    if (!findInput || !replaceInput || !this.editor) return;

    const searchText = findInput.value;
    const replaceText = replaceInput.value;
    if (!searchText) return;

    const originalContent = this.editor.value;
    const newContent = originalContent.split(searchText).join(replaceText);
    
    if (newContent !== originalContent) {
      this.pushToUndoStack(originalContent);
      this.editor.value = newContent;
      this.editor.dispatchEvent(new Event('input'));
      
      const count = originalContent.split(searchText).length - 1;
      window.ArtiMeowApp?.showSuccess(`已替换 ${count} 处`);
    } else {
      window.ArtiMeowApp?.showError('未找到匹配内容');
    }
  }

  initFormatting() {
    if (!this.editor) return;

    // 自动配对括号
    this.editor.addEventListener('keydown', (e) => {
      const pairs = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'"
      };

      if (pairs[e.key]) {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end);

        if (selectedText.length > 0) {
          // 有选中文本，包围它
          e.preventDefault();
          const beforeText = this.editor.value.substring(0, start);
          const afterText = this.editor.value.substring(end);
          this.editor.value = beforeText + e.key + selectedText + pairs[e.key] + afterText;
          this.editor.setSelectionRange(start + 1, start + 1 + selectedText.length);
        } else {
          // 没有选中文本，插入配对字符
          e.preventDefault();
          const beforeText = this.editor.value.substring(0, start);
          const afterText = this.editor.value.substring(start);
          this.editor.value = beforeText + e.key + pairs[e.key] + afterText;
          this.editor.setSelectionRange(start + 1, start + 1);
        }
        
        this.editor.dispatchEvent(new Event('input'));
      }
    });

    // Tab 键缩进
    this.editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const beforeText = this.editor.value.substring(0, start);
        const afterText = this.editor.value.substring(end);
        
        if (e.shiftKey) {
          // Shift+Tab 取消缩进
          const lines = this.editor.value.substring(0, start).split('\n');
          const currentLine = lines[lines.length - 1];
          if (currentLine.startsWith('  ')) {
            const newStart = start - 2;
            this.editor.value = this.editor.value.substring(0, newStart) + 
                              this.editor.value.substring(start);
            this.editor.setSelectionRange(newStart, newStart);
          }
        } else {
          // Tab 缩进
          this.editor.value = beforeText + '  ' + afterText;
          this.editor.setSelectionRange(start + 2, start + 2);
        }
        
        this.editor.dispatchEvent(new Event('input'));
      }
    });
  }

  toggleFullscreen() {
    const editorContainer = document.querySelector('.editor-container');
    const fullscreenBtn = document.querySelector('[title="全屏"]');
    
    if (!editorContainer) return;

    this.isFullscreen = !this.isFullscreen;
    
    if (this.isFullscreen) {
      editorContainer.classList.add('fullscreen-editor');
      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        fullscreenBtn.title = '退出全屏';
      }
    } else {
      editorContainer.classList.remove('fullscreen-editor');
      if (fullscreenBtn) {
        fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        fullscreenBtn.title = '全屏';
      }
    }
  }

  toggleFocusMode() {
    const app = document.getElementById('app');
    
    if (!app) return;

    this.isFocusMode = !this.isFocusMode;
    
    if (this.isFocusMode) {
      app.classList.add('focus-mode');
    } else {
      app.classList.remove('focus-mode');
    }
  }

  insertTemplate(template) {
    if (!this.editor) return;

    const templates = {
      chapter: '\n\n# 第X章 章节标题\n\n',
      dialogue: '\n"对话内容。"主角说道。\n',
      scene: '\n## 场景描述\n\n时间：\n地点：\n人物：\n\n',
      action: '\n**动作描述**\n\n'
    };

    const text = templates[template] || '';
    const start = this.editor.selectionStart;
    const beforeText = this.editor.value.substring(0, start);
    const afterText = this.editor.value.substring(start);
    
    this.editor.value = beforeText + text + afterText;
    this.editor.setSelectionRange(start + text.length, start + text.length);
    this.editor.focus();
    this.editor.dispatchEvent(new Event('input'));
  }

  exportContent(format = 'txt') {
    if (!this.editor || !window.electronAPI) return;

    const content = this.editor.value;
    const fileName = `chapter_${Date.now()}.${format}`;

    // 根据格式处理内容
    let processedContent = content;
    if (format === 'html') {
      processedContent = this.convertToHTML(content);
    } else if (format === 'markdown') {
      // 已经是 Markdown 格式
    }

    // 使用 Electron 的保存对话框
    window.electronAPI.showSaveDialog({
      defaultPath: fileName,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'HTML Files', extensions: ['html'] }
      ]
    }).then(result => {
      if (!result.canceled && result.filePath) {
        return window.electronAPI.writeFile(result.filePath, processedContent);
      }
    }).then(result => {
      if (result && result.success) {
        window.ArtiMeowApp?.showSuccess('导出成功！');
      } else if (result && !result.success) {
        window.ArtiMeowApp?.showError('导出失败：' + result.error);
      }
    }).catch(error => {
      console.error('导出失败:', error);
      window.ArtiMeowApp?.showError('导出失败，请重试');
    });
  }

  convertToHTML(markdown) {
    return markdown
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  }

  getStatistics() {
    if (!this.editor) return {};

    const content = this.editor.value;
    const lines = content.split('\n');
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    
    // 字数统计
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = content.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(w => w.length > 0).length;
    const totalWords = chineseChars + englishWords;
    
    // 字符统计
    const totalChars = content.length;
    const charsNoSpaces = content.replace(/\s/g, '').length;
    
    return {
      words: totalWords,
      chineseChars,
      englishWords,
      totalChars,
      charsNoSpaces,
      lines: lines.length,
      paragraphs: paragraphs.length
    };
  }

  showStatistics() {
    const stats = this.getStatistics();
    const message = `
      字数统计：
      总字数：${stats.words}
      中文字符：${stats.chineseChars}
      英文单词：${stats.englishWords}
      总字符数：${stats.totalChars}
      字符数（不含空格）：${stats.charsNoSpaces}
      行数：${stats.lines}
      段落数：${stats.paragraphs}
    `;
    
    window.ArtiMeowApp?.showNotification(message, 'info');
  }

  /**
   * 更新预览内容
   */
  updatePreview() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent || !this.editor) return;

    const markdownText = this.editor.value;
    
    // 使用marked渲染Markdown
    if (window.marked) {
      const htmlContent = window.marked.parse(markdownText);
      previewContent.innerHTML = htmlContent;
    } else {
      // 简单的文本预览作为备用
      previewContent.innerHTML = `<pre>${markdownText}</pre>`;
    }
  }

  // 增强的Markdown格式化方法
  insertMarkdownFormat(before, after = '', placeholder = '') {
    if (!this.editor) return;

    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const selectedText = this.editor.value.substring(start, end);
    
    let newText;
    if (selectedText.length === 0) {
      // 没有选中文本，插入占位符
      newText = before + (placeholder || '文本') + after;
      const newStart = start + before.length;
      const newEnd = newStart + (placeholder || '文本').length;
      
      const beforeText = this.editor.value.substring(0, start);
      const afterText = this.editor.value.substring(end);
      this.editor.value = beforeText + newText + afterText;
      this.editor.setSelectionRange(newStart, newEnd);
    } else {
      // 有选中文本，检查是否已经有相同的标记
      const beforeStart = Math.max(0, start - before.length);
      const afterEnd = Math.min(this.editor.value.length, end + after.length);
      const beforeCheck = this.editor.value.substring(beforeStart, start);
      const afterCheck = this.editor.value.substring(end, afterEnd);
      
      if (beforeCheck === before && afterCheck === after) {
        // 已经有标记，移除标记
        const beforeText = this.editor.value.substring(0, beforeStart);
        const afterText = this.editor.value.substring(afterEnd);
        this.editor.value = beforeText + selectedText + afterText;
        this.editor.setSelectionRange(beforeStart, beforeStart + selectedText.length);
      } else {
        // 没有标记，添加标记
        newText = before + selectedText + after;
        const beforeText = this.editor.value.substring(0, start);
        const afterText = this.editor.value.substring(end);
        this.editor.value = beforeText + newText + afterText;
        this.editor.setSelectionRange(start + before.length, start + before.length + selectedText.length);
      }
    }

    this.editor.focus();
    this.editor.dispatchEvent(new Event('input'));
  }

  // 插入标题
  insertHeading(level = 1) {
    const prefix = '#'.repeat(level) + ' ';
    this.insertAtLineStart(prefix, '标题');
  }

  // 插入列表
  insertList(ordered = false) {
    const prefix = ordered ? '1. ' : '- ';
    this.insertAtLineStart(prefix, '列表项');
  }

  // 插入引用
  insertQuote() {
    this.insertAtLineStart('> ', '引用内容');
  }

  // 插入代码块
  insertCodeBlock(language = '') {
    const start = this.editor.selectionStart;
    const selectedText = this.editor.value.substring(this.editor.selectionStart, this.editor.selectionEnd);
    
    const codeBlock = `\`\`\`${language}\n${selectedText || '代码内容'}\n\`\`\`\n`;
    
    const beforeText = this.editor.value.substring(0, start);
    const afterText = this.editor.value.substring(this.editor.selectionEnd);
    
    this.editor.value = beforeText + codeBlock + afterText;
    
    if (!selectedText) {
      // 如果没有选中文本，将光标定位到代码内容位置
      const newPos = start + `\`\`\`${language}\n`.length;
      this.editor.setSelectionRange(newPos, newPos + '代码内容'.length);
    }
    
    this.editor.focus();
    this.editor.dispatchEvent(new Event('input'));
  }

  // 插入表格
  insertTable(rows = 3, cols = 3) {
    let table = '';
    
    // 表头
    table += '|';
    for (let i = 0; i < cols; i++) {
      table += ` 表头${i + 1} |`;
    }
    table += '\n';
    
    // 分隔线
    table += '|';
    for (let i = 0; i < cols; i++) {
      table += ' --- |';
    }
    table += '\n';
    
    // 数据行
    for (let r = 1; r < rows; r++) {
      table += '|';
      for (let c = 0; c < cols; c++) {
        table += ` 数据${r}-${c + 1} |`;
      }
      table += '\n';
    }
    
    this.insertAtCursor(table);
  }

  // 插入链接
  insertLink() {
    const selectedText = this.getSelectedText();
    if (selectedText) {
      this.insertMarkdownFormat('[', '](URL)', selectedText);
    } else {
      this.insertMarkdownFormat('[', '](URL)', '链接文本');
    }
  }

  // 插入图片
  insertImage() {
    this.insertMarkdownFormat('![', '](图片URL)', '图片描述');
  }

  // 插入分隔线
  insertHorizontalRule() {
    this.insertAtLineStart('---\n', '');
  }

  // 在行首插入内容
  insertAtLineStart(prefix, placeholder = '') {
    if (!this.editor) return;

    const start = this.editor.selectionStart;
    const value = this.editor.value;
    
    // 找到当前行的开始位置
    let lineStart = start;
    while (lineStart > 0 && value[lineStart - 1] !== '\n') {
      lineStart--;
    }
    
    // 检查当前行是否已经有相同的前缀
    const currentLine = value.substring(lineStart, value.indexOf('\n', lineStart));
    if (currentLine.startsWith(prefix.trim())) {
      // 移除前缀
      const beforeText = value.substring(0, lineStart);
      const afterText = value.substring(lineStart + prefix.length);
      this.editor.value = beforeText + afterText;
      this.editor.setSelectionRange(start - prefix.length, start - prefix.length);
    } else {
      // 添加前缀
      const beforeText = value.substring(0, lineStart);
      const afterText = value.substring(lineStart);
      this.editor.value = beforeText + prefix + afterText;
      
      if (placeholder && currentLine.trim() === '') {
        // 如果当前行为空且有占位符，选中占位符
        const newStart = lineStart + prefix.length;
        this.editor.value = beforeText + prefix + placeholder + value.substring(lineStart);
        this.editor.setSelectionRange(newStart, newStart + placeholder.length);
      } else {
        this.editor.setSelectionRange(start + prefix.length, start + prefix.length);
      }
    }

    this.editor.focus();
    this.editor.dispatchEvent(new Event('input'));
  }

  // 在光标位置插入内容
  insertAtCursor(text) {
    if (!this.editor) return;

    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const beforeText = this.editor.value.substring(0, start);
    const afterText = this.editor.value.substring(end);
    
    this.editor.value = beforeText + text + afterText;
    this.editor.setSelectionRange(start + text.length, start + text.length);
    this.editor.focus();
    this.editor.dispatchEvent(new Event('input'));
  }

  // 获取选中的文本
  getSelectedText() {
    if (!this.editor) return '';
    return this.editor.value.substring(this.editor.selectionStart, this.editor.selectionEnd);
  }

  // 初始化快捷键
  initKeyboardShortcuts() {
    if (!this.editor) return;

    this.editor.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + 快捷键
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            this.insertMarkdownFormat('**', '**', '加粗文本');
            break;
          case 'i':
            e.preventDefault();
            this.insertMarkdownFormat('*', '*', '斜体文本');
            break;
          case 'u':
            e.preventDefault();
            this.insertMarkdownFormat('<u>', '</u>', '下划线文本');
            break;
          case 'k':
            e.preventDefault();
            this.insertLink();
            break;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
            e.preventDefault();
            this.insertHeading(parseInt(e.key));
            break;
        }
      }
      
      // Tab 键处理
      if (e.key === 'Tab') {
        e.preventDefault();
        this.insertAtCursor('    '); // 插入4个空格
      }
    });
  }

  /**
   * 清空编辑器内容
   */
  clear() {
    if (this.editor) {
      this.editor.value = '';
      this.undoStack = [];
      this.redoStack = [];
      
      // 触发 input 事件以更新字数统计等
      const event = new Event('input', { bubbles: true });
      this.editor.dispatchEvent(event);
    }
  }
}

// 初始化编辑器管理器
document.addEventListener('DOMContentLoaded', () => {
  const editorManager = new EditorManager();
  window.editorManager = editorManager;
});

// 导出供全局使用
window.EditorManager = EditorManager;
