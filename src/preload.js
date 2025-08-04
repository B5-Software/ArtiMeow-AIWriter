const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 设置相关
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  
  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  
  // 项目管理
  getProjectList: () => ipcRenderer.invoke('get-project-list'),
  createProject: (projectData) => ipcRenderer.invoke('create-project', projectData),
  openProject: (projectPath) => ipcRenderer.invoke('open-project', projectPath),
  saveProject: (saveData) => ipcRenderer.invoke('save-project', saveData),
  deleteProject: (projectPath) => ipcRenderer.invoke('delete-project', projectPath),
  exportProject: (exportData) => ipcRenderer.invoke('export-project', exportData),
  loadProject: (projectPath) => ipcRenderer.invoke('load-project', projectPath),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (projectPath) => ipcRenderer.invoke('add-recent-project', projectPath),
  
  // AI 集成
  callAI: (options) => ipcRenderer.invoke('call-ai', options),
  testAIConnection: (engine, settings) => ipcRenderer.invoke('test-ai-connection', engine, settings),
  
  // 选择目录
  chooseDirectory: () => ipcRenderer.invoke('choose-directory'),

  // Git 操作
  gitInit: (projectPath) => ipcRenderer.invoke('git-init', projectPath),
  gitStatus: (projectPath) => ipcRenderer.invoke('git-status', projectPath),
  gitAdd: (projectPath, files) => ipcRenderer.invoke('git-add', projectPath, files),
  gitCommit: (projectPath, message) => ipcRenderer.invoke('git-commit', projectPath, message),
  gitPush: (projectPath, remote, branch) => ipcRenderer.invoke('git-push', projectPath, remote, branch),
  gitPull: (projectPath, remote, branch) => ipcRenderer.invoke('git-pull', projectPath, remote, branch),
  gitAddRemote: (projectPath, name, url) => ipcRenderer.invoke('git-add-remote', projectPath, name, url),
  gitClone: (url, localPath) => ipcRenderer.invoke('git-clone', url, localPath),
  gitLog: (projectPath, limit) => ipcRenderer.invoke('git-log', projectPath, limit),
  gitCreateBranch: (projectPath, branchName) => ipcRenderer.invoke('git-create-branch', projectPath, branchName),
  gitCheckout: (projectPath, branchName) => ipcRenderer.invoke('git-checkout', projectPath, branchName),
  gitListRemotes: (projectPath) => ipcRenderer.invoke('git-list-remotes', projectPath),
  gitListBranches: (projectPath, includeRemote) => ipcRenderer.invoke('git-list-branches', projectPath, includeRemote),
  gitCurrentBranch: (projectPath) => ipcRenderer.invoke('git-current-branch', projectPath),
  gitRemoveRemote: (projectPath, name) => ipcRenderer.invoke('git-remove-remote', projectPath, name),
  gitRemoteStatus: (projectPath, remote) => ipcRenderer.invoke('git-remote-status', projectPath, remote),
  gitDiff: (projectPath, commitHash1, commitHash2) => ipcRenderer.invoke('git-diff', projectPath, commitHash1, commitHash2),
  gitFetch: (projectPath, remote) => ipcRenderer.invoke('git-fetch', projectPath, remote),
  gitDeleteBranch: (projectPath, branchName) => ipcRenderer.invoke('git-delete-branch', projectPath, branchName),
  gitDeleteRemote: (projectPath, remoteName) => ipcRenderer.invoke('git-delete-remote', projectPath, remoteName),
  gitRenameRemote: (projectPath, oldName, newName) => ipcRenderer.invoke('git-rename-remote', projectPath, oldName, newName),
  gitGetRemoteBranches: (projectPath, remoteName) => ipcRenderer.invoke('git-get-remote-branches', projectPath, remoteName),
  
  // 新增的 Git 增强功能
  gitSwitchBranch: (projectPath, branchName) => ipcRenderer.invoke('git-switch-branch', projectPath, branchName),
  gitPushBranch: (projectPath, branchName, remote) => ipcRenderer.invoke('git-push-branch', projectPath, branchName, remote),
  gitGetBranches: (projectPath) => ipcRenderer.invoke('git-get-branches', projectPath),
  gitGetRemotes: (projectPath) => ipcRenderer.invoke('git-get-remotes', projectPath),
  gitFetchRemote: (projectPath, remoteName) => ipcRenderer.invoke('git-fetch-remote', projectPath, remoteName),
  
  // 文件操作
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  createDirectory: (dirPath) => ipcRenderer.invoke('create-directory', dirPath),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // 章节操作
  saveChapter: (data) => ipcRenderer.invoke('save-chapter', data),
  loadChapter: (data) => ipcRenderer.invoke('load-chapter', data),
  deleteChapter: (data) => ipcRenderer.invoke('delete-chapter', data),
  renameChapter: (data) => ipcRenderer.invoke('rename-chapter', data),
  
  // 字体管理
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  addCustomFont: (fontPath) => ipcRenderer.invoke('add-custom-font', fontPath),
  removeCustomFont: (fontPath) => ipcRenderer.invoke('remove-custom-font', fontPath),
  
  // 主题管理
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  
  // 自动保存和备份
  enableAutoSave: (projectPath, interval) => ipcRenderer.invoke('enable-auto-save', projectPath, interval),
  disableAutoSave: () => ipcRenderer.invoke('disable-auto-save'),
  createBackup: (projectPath) => ipcRenderer.invoke('create-backup', projectPath),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  
  // 设置导入导出
  exportSettings: (filePath) => ipcRenderer.invoke('export-settings', filePath),
  importSettings: (filePath) => ipcRenderer.invoke('import-settings', filePath),
  
  // Git状态获取
  getGitStatus: (projectPath) => ipcRenderer.invoke('get-git-status', projectPath),
  
  // 终端操作
  openTerminal: (command, workingDirectory) => ipcRenderer.invoke('open-terminal', command, workingDirectory),
  
  // 教程相关
  getTutorialDirectory: () => ipcRenderer.invoke('get-tutorial-directory'),
  readTutorialFiles: () => ipcRenderer.invoke('read-tutorial-files'),
  readTutorialFile: (filename) => ipcRenderer.invoke('read-tutorial-file', filename),
  
  // 版本信息
  getAppVersionInfo: () => ipcRenderer.invoke('get-app-version-info'),
  
  // 通用 IPC 调用
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Shell操作
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell-open-external', url)
  },
  
  // 启动画面相关
  splashReady: () => ipcRenderer.invoke('splash-ready'),
  onSplashUpdate: (callback) => {
    ipcRenderer.on('splash-update', (event, data) => callback(data))
  }
});

// 暴露平台信息，供渲染进程判断
contextBridge.exposeInMainWorld('platform', process.platform);
