const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs-extra')
const fsSync = require('fs')
const { exec, spawn } = require('child_process')
const { promisify } = require('util')
const Store = require('electron-store')
const axios = require('axios')
const archiver = require('archiver')
const extractZip = require('extract-zip')
const os = require('os')

// Web服务器
const ArtiMeowWebServer = require('./webserver/server')

const store = new Store.default ? new Store.default() : new Store()
const execAsync = promisify(exec)
let aiProcess = null
let mainWindow = null
let splashWindow = null
let webServer = null  // Web服务器实例

// 环境变量
const isDev = process.env.NODE_ENV === 'development'
const isPackaged = app.isPackaged

// 资源路径处理函数
function getResourcePath(relativePath) {
  if (isPackaged) {
    // 打包后的应用，资源在app.asar/src/内
    return path.join(__dirname, relativePath)
  } else {
    // 开发环境，资源在src/内
    return path.join(__dirname, relativePath)
  }
}

// 获取应用根目录路径
function getAppRootPath() {
  if (isPackaged) {
    // 打包后的应用
    return path.dirname(app.getPath('exe'))
  } else {
    // 开发环境
    return path.join(__dirname, '..')
  }
}

// 日志系统
const logger = {
  info: (message, ...args) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, ...args)
    }
  },
  warn: (message, ...args) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args)
    }
  },
  error: (message, ...args) => {
    console.error(`[ERROR] ${message}`, ...args)
  }
}

// 启用GPU加速
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')

// 默认设置
const defaultSettings = {
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
        baseURL: 'https://api.example.com/v1',
        model: 'custom-model',
        name: '自定义 AI'
      }
    },
    selectedEngine: 'openai',
    systemPrompt: '你是一位专业的小说家，擅长创作各种类型的小说。请根据用户提供的上下文和要求，续写精彩的故事内容。保持故事的连贯性和风格一致性，每次生成约500-1000字的内容。',
    agentMode: false,
    agentPrompt: '请根据故事的发展，自动续写下一章节的内容。',
    temperature: 0.7,
    maxTokens: 2000
  },
  git: {
    userName: '',
    userEmail: '',
    defaultRemote: 'origin',
    defaultBranch: 'main'
  },
  editor: {
    fontSize: 16,
    fontFamily: 'Georgia, serif',
    theme: 'dark',
    autoSave: true,
    autoSaveInterval: 30000,
    customFonts: []
  },
  general: {
    language: 'zh-CN',
    projectsDir: path.join(app.getPath('documents'), 'ArtiMeowProjects'),
    backupEnabled: true,
    backupInterval: 300000, // 5分钟
    theme: 'dark', // 'light', 'dark', 'auto'
    autoSave: true,
    autoSaveInterval: 30000
  }
}

// 创建主窗口
function createWindow() {
  // 设置窗口图标路径
  let iconPath
  if (process.platform === 'win32') {
    iconPath = isPackaged ? 
      path.join(process.resourcesPath, 'icon', 'icon.ico') :
      path.join(__dirname, '..', 'src', 'icon', 'icon.ico')
  } else if (process.platform === 'darwin') {
    iconPath = getResourcePath('renderer/assets/icons/icon.icns')
  } else {
    iconPath = getResourcePath('renderer/assets/icons/icon.png')
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: getResourcePath('preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      hardwareAcceleration: true, // 启用硬件加速
      webSecurity: !isDev // 开发时允许跨域，生产环境开启安全限制
    },
    frame: false, // 禁用原生窗口框架
    show: false, // 初始不显示，等加载完成后显示
    icon: iconPath
  })

  // 加载应用页面
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))

  // 开发模式下打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools()
    logger.info('开发者工具已打开')
  }

  logger.info('应用窗口已创建', {
    platform: process.platform,
    isPackaged: isPackaged,
    iconPath: iconPath
  })

  mainWindow.once('ready-to-show', () => {
    // 窗口准备好后，关闭启动画面并显示主窗口
    if (splashWindow) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow.show()
    logger.info('应用窗口已显示')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createSplashWindow() {
  // 设置窗口图标路径
  let iconPath
  if (process.platform === 'win32') {
    iconPath = isPackaged ? 
      path.join(process.resourcesPath, 'icon', 'icon.ico') :
      path.join(__dirname, '..', 'src', 'icon', 'icon.ico')
  } else if (process.platform === 'darwin') {
    iconPath = getResourcePath('renderer/assets/icons/icon.icns')
  } else {
    iconPath = getResourcePath('renderer/assets/icons/icon.png')
  }

  splashWindow = new BrowserWindow({
    width: 800,
    height: 450,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    resizable: false,
    movable: false,
    center: true,
    webPreferences: {
      preload: getResourcePath('preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: iconPath
  })

  // 加载启动画面
  splashWindow.loadFile(path.join(__dirname, 'renderer/splash.html'))

  splashWindow.on('closed', () => {
    splashWindow = null
  })

  logger.info('启动画面窗口已创建')
}

// 应用就绪时创建窗口
app.whenReady().then(() => {
  // 首先创建启动画面
  createSplashWindow()
  
  // 不再自动创建主窗口，等待启动画面准备就绪的信号

  // macOS 特定处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow()
    }
  })
})

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 初始化设置
function initializeSettings() {
  const settings = store.get('settings', defaultSettings)
  store.set('settings', { ...defaultSettings, ...settings })
  return store.get('settings')
}

// IPC 处理程序

// 启动画面相关
ipcMain.handle('splash-ready', () => {
  // 启动画面准备就绪，可以开始创建主窗口
  logger.info('启动画面准备就绪')
  if (!mainWindow) {
    createWindow()
  }
})

// 设置相关
ipcMain.handle('get-settings', () => {
  return store.get('settings', defaultSettings)
})

ipcMain.handle('save-settings', (event, settings) => {
  // 合并默认设置，防止 custom/AI 配置丢失
  const merged = Object.assign({}, defaultSettings, settings)
  // 深合并 AI engines
  if (defaultSettings.ai && settings.ai) {
    merged.ai = Object.assign({}, defaultSettings.ai, settings.ai)
    if (defaultSettings.ai.engines && settings.ai.engines) {
      merged.ai.engines = Object.assign({}, defaultSettings.ai.engines, settings.ai.engines)
    }
  }
  if (defaultSettings.editor && settings.editor) {
    merged.editor = Object.assign({}, defaultSettings.editor, settings.editor)
  }
  if (defaultSettings.git && settings.git) {
    merged.git = Object.assign({}, defaultSettings.git, settings.git)
  }
  if (defaultSettings.general && settings.general) {
    merged.general = Object.assign({}, defaultSettings.general, settings.general)
  }
  store.set('settings', merged)
  return true
})

ipcMain.handle('reset-settings', () => {
  store.set('settings', defaultSettings)
  return defaultSettings
})

// 窗口控制
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

// 终端操作
ipcMain.handle('open-terminal', async (event, command = '', workingDirectory = '') => {
  try {
    const isWindows = process.platform === 'win32'
    const isMac = process.platform === 'darwin'
    const isLinux = process.platform === 'linux'

    let terminalCommand
    let args = []

    if (isWindows) {
      // Windows: 打开PowerShell或CMD
      terminalCommand = 'cmd'
      args = ['/c', 'start', 'powershell']
      if (workingDirectory) {
        args.push('-NoExit', '-Command', `Set-Location '${workingDirectory}'`)
      }
      if (command) {
        args.push(';', command)
      }
    } else if (isMac) {
      // macOS: 打开Terminal
      terminalCommand = 'open'
      args = ['-a', 'Terminal']
      if (workingDirectory) {
        args.push(workingDirectory)
      }
    } else if (isLinux) {
      // Linux: 尝试常见的终端
      const terminals = ['gnome-terminal', 'konsole', 'xterm', 'terminator']
      for (const terminal of terminals) {
        try {
          await new Promise((resolve, reject) => {
            exec(`which ${terminal}`, (error) => {
              if (error) reject(error)
              else resolve()
            })
          })
          terminalCommand = terminal
          if (workingDirectory) {
            args.push('--working-directory', workingDirectory)
          }
          break
        } catch (e) {
          continue
        }
      }
      if (!terminalCommand) {
        throw new Error('未找到可用的终端应用')
      }
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(terminalCommand, args, {
        cwd: workingDirectory || process.cwd(),
        detached: true,
        stdio: 'ignore'
      })

      proc.on('error', (error) => {
        reject({ success: false, error: error.message })
      })

      proc.on('spawn', () => {
        proc.unref() // 允许父进程退出而不等待子进程
        resolve({ success: true, message: '终端已打开' })
      })
    })
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 项目管理 - 新的基于目录扫描的方式
ipcMain.handle('get-project-list', async () => {
  try {
    const settings = store.get('settings', defaultSettings)
    const projectsDir = settings.general.projectsDir
    
    // 确保项目目录存在
    await fs.mkdir(projectsDir, { recursive: true })
    
    // 读取项目目录
    const entries = await fs.readdir(projectsDir, { withFileTypes: true })
    const projects = []
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(projectsDir, entry.name)
        const projectFilePath = path.join(projectPath, 'project.json')
        
        try {
          // 检查项目配置文件是否存在
          await fs.access(projectFilePath)
          
          // 读取项目元数据
          const projectData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
          const stats = await fs.stat(projectFilePath)
          
          // 计算字数（如果有章节的话）
          let wordCount = 0
          const chaptersDir = path.join(projectPath, 'chapters')
          try {
            const chapterFiles = await fs.readdir(chaptersDir)
            for (const chapterFile of chapterFiles) {
              if (chapterFile.endsWith('.md')) {
                const chapterPath = path.join(chaptersDir, chapterFile)
                const content = await fs.readFile(chapterPath, 'utf-8')
                wordCount += content.length // 简单字符计数，可以后续优化为更准确的字数统计
              }
            }
          } catch (error) {
            // 章节目录不存在或无法读取，wordCount保持为0
          }
          
          const projectInfo = {
            id: entry.name,
            path: projectPath,
            metadata: {
              title: projectData.name || entry.name,
              description: projectData.description || '',
              author: projectData.author || '',
              genre: projectData.genre || '',
              created: projectData.createTime || stats.birthtime.getTime(),
              lastModified: projectData.updateTime || stats.mtime.getTime(),
              wordCount: wordCount,
              useGit: projectData.useGit || false,
              version: projectData.version || '1.0.0'
            }
          }
          
          projects.push(projectInfo)
        } catch (error) {
          console.warn(`跳过无效项目目录 ${entry.name}:`, error.message)
        }
      }
    }
    
    // 按最后修改时间排序（最新的在前）
    projects.sort((a, b) => b.metadata.lastModified - a.metadata.lastModified)
    
    console.log(`扫描到 ${projects.length} 个有效项目`)
    return { success: true, projects }
  } catch (error) {
    console.error('获取项目列表失败:', error)
    return { success: false, error: error.message }
  }
})

// 导入项目
ipcMain.handle('import-project', async (event, options = {}) => {
  try {
    // 显示文件选择对话框
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择要导入的项目zip文件',
      filters: [
        { name: '项目压缩包', extensions: ['zip'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    
    if (result.canceled) {
      return { success: false, canceled: true }
    }
    
    const zipPath = result.filePaths[0]
    const settings = store.get('settings', defaultSettings)
    const projectsDir = settings.general.projectsDir
    
    // 确保项目目录存在
    await fs.mkdir(projectsDir, { recursive: true })
    
    // 创建临时解压目录
    const tempDir = path.join(os.tmpdir(), `artimeow-import-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })
    
    try {
      // 解压文件
      await extractZip(zipPath, { dir: tempDir })
      
      // 查找项目配置文件
      let projectConfigPath = null
      let projectName = null
      let extractedProjectPath = null
      
      // 检查临时目录中的内容
      const tempContents = await fs.readdir(tempDir, { withFileTypes: true })
      
      // 查找项目配置文件的位置
      for (const entry of tempContents) {
        if (entry.isDirectory()) {
          const possibleConfigPath = path.join(tempDir, entry.name, 'project.json')
          try {
            await fs.access(possibleConfigPath)
            projectConfigPath = possibleConfigPath
            extractedProjectPath = path.join(tempDir, entry.name)
            break
          } catch (error) {
            // 继续查找
          }
        }
      }
      
      // 如果在子目录中没找到，检查根目录
      if (!projectConfigPath) {
        const rootConfigPath = path.join(tempDir, 'project.json')
        try {
          await fs.access(rootConfigPath)
          projectConfigPath = rootConfigPath
          extractedProjectPath = tempDir
        } catch (error) {
          throw new Error('未找到有效的项目配置文件 (project.json)')
        }
      }
      
      // 读取项目配置
      const projectData = JSON.parse(await fs.readFile(projectConfigPath, 'utf-8'))
      projectName = projectData.name || 'imported-project'
      
      // 检查项目名称是否已存在，如果存在则添加后缀
      let finalProjectName = projectName
      let counter = 1
      while (true) {
        const targetPath = path.join(projectsDir, finalProjectName)
        try {
          await fs.access(targetPath)
          finalProjectName = `${projectName}_${counter}`
          counter++
        } catch (error) {
          // 目录不存在，可以使用这个名称
          break
        }
      }
      
      // 移动项目到目标位置
      const finalProjectPath = path.join(projectsDir, finalProjectName)
      await fs.mkdir(finalProjectPath, { recursive: true })
      
      // 复制所有文件
      const copyRecursively = async (src, dest) => {
        const entries = await fs.readdir(src, { withFileTypes: true })
        await fs.mkdir(dest, { recursive: true })
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name)
          const destPath = path.join(dest, entry.name)
          
          if (entry.isDirectory()) {
            await copyRecursively(srcPath, destPath)
          } else {
            await fs.copyFile(srcPath, destPath)
          }
        }
      }
      
      await copyRecursively(extractedProjectPath, finalProjectPath)
      
      // 更新项目配置中的名称和时间戳
      const finalConfigPath = path.join(finalProjectPath, 'project.json')
      const finalProjectData = JSON.parse(await fs.readFile(finalConfigPath, 'utf-8'))
      finalProjectData.name = finalProjectName
      finalProjectData.updateTime = Date.now()
      if (!finalProjectData.createTime) {
        finalProjectData.createTime = Date.now()
      }
      await fs.writeFile(finalConfigPath, JSON.stringify(finalProjectData, null, 2), 'utf-8')
      
      // 清理临时目录
      await fs.rm(tempDir, { recursive: true, force: true })
      
      return {
        success: true,
        projectPath: finalProjectPath,
        projectName: finalProjectName,
        message: `项目 "${finalProjectName}" 导入成功`
      }
      
    } catch (extractError) {
      // 清理临时目录
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.warn('清理临时目录失败:', cleanupError)
      }
      throw extractError
    }
    
  } catch (error) {
    console.error('导入项目失败:', error)
    return { 
      success: false, 
      error: error.message,
      details: '请确保选择的是有效的ArtiMeow项目压缩包'
    }
  }
})

ipcMain.handle('create-project', async (event, projectData) => {
  try {
    const settings = store.get('settings', defaultSettings)
    const projectDir = path.join(settings.general.projectsDir, projectData.name)
    
    // 创建项目目录
    await fs.mkdir(projectDir, { recursive: true })
    
    // 创建项目文件
    const projectFile = {
      name: projectData.name,
      description: projectData.description || '',
      author: projectData.author || '',
      genre: projectData.genre || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters: [],
      characters: [],
      settings: {
        wordGoal: projectData.wordGoal || 0,
        style: projectData.style || 'default'
      }
    }
    
    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(projectFile, null, 2)
    )
    
    // 创建章节目录
    await fs.mkdir(path.join(projectDir, 'chapters'), { recursive: true })
    
    // 创建资源目录
    await fs.mkdir(path.join(projectDir, 'assets'), { recursive: true })
    
    // 初始化 Git 仓库
    if (projectData.useGit) {
      await initGitRepo(projectDir)
    }
    
    return { success: true, projectDir }
  } catch (error) {
    console.error('创建项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('load-project', async (event, projectPath) => {
  try {
    const projectFilePath = path.join(projectPath, 'project.json')
    const projectData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
    
    // 加载章节列表
    const chaptersDir = path.join(projectPath, 'chapters')
    const chapterDirs = await fs.readdir(chaptersDir, { withFileTypes: true }).catch(() => [])
    
    const chapters = await Promise.all(
      chapterDirs
        .filter(dirent => dirent.isDirectory())
        .map(async (dirent) => {
          try {
            const chapterDir = path.join(chaptersDir, dirent.name)
            
            // 读取元数据
            const metadataPath = path.join(chapterDir, 'metadata.json')
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
            
            // 读取内容（可选，用于显示预览）
            const contentPath = path.join(chapterDir, 'content.md')
            const content = await fs.readFile(contentPath, 'utf-8').catch(() => '')
            
            return {
              ...metadata,
              content: content // 只在加载时包含内容，用于显示
            }
          } catch (error) {
            console.error(`加载章节 ${dirent.name} 失败:`, error)
            return null
          }
        })
    )
    
    // 过滤掉加载失败的章节
    const validChapters = chapters.filter(chapter => chapter !== null)
    
    // 将章节数据存储在项目对象中
    projectData.chapters = validChapters
    projectData.path = projectPath
    
    return { success: true, project: projectData }
  } catch (error) {
    console.error('加载项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-recent-projects', async () => {
  try {
    // 复用get-project-list的逻辑，但只返回项目列表
    const result = await ipcMain.handle('get-project-list', null)();
    if (result.success && result.projects) {
      // 转换为旧格式以保持兼容性
      const recentProjects = result.projects.map(project => ({
        name: project.metadata.title,
        path: project.path,
        description: project.metadata.description,
        author: project.metadata.author,
        lastModified: project.metadata.lastModified
      }));
      return recentProjects;
    }
    return [];
  } catch (error) {
    console.error('获取最近项目失败:', error);
    return [];
  }
})

ipcMain.handle('add-recent-project', async (event, projectPath) => {
  try {
    // 基于新的目录扫描模式，我们不需要维护单独的最近项目列表
    // 只需要更新项目的最后修改时间
    const configPath = path.join(projectPath, 'project.json');
    
    // 检查项目是否存在
    await fs.access(configPath);
    
    // 更新项目配置的updateTime
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    config.updateTime = Date.now();
    
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    return { success: true };
  } catch (error) {
    console.error('更新项目时间失败:', error);
    return { success: false, error: error.message };
  }
})

// AI 集成
ipcMain.handle('call-ai-api', async (event, options) => {
  try {
    const settings = store.get('settings', defaultSettings)
    const engine = settings.ai.engines[settings.ai.selectedEngine]
    
    let response
    
    switch (settings.ai.selectedEngine) {
      case 'openai':
        response = await callOpenAI(engine, options)
        break
      case 'ollama':
        response = await callOllama(engine, options)
        break
      case 'llamacpp':
        response = await callLlamaCpp(engine, options)
        break
      default:
        throw new Error('未知的 AI 引擎')
    }
    
    return { success: true, response }
  } catch (error) {
    console.error('AI API 调用失败:', error)
    return { success: false, error: error.message }
  }
})

// OpenAI API 调用
async function callOpenAI(engine, options) {
  const requestData = {
    model: engine.model,
    messages: options.messages
  }
  
  // 添加可选参数
  if (options.temperature !== undefined) {
    requestData.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    requestData.max_tokens = options.maxTokens
  }
  
  console.log('OpenAI API Request:', JSON.stringify(requestData, null, 2))
  
  const response = await axios.post(
    `${engine.baseURL}/chat/completions`,
    requestData,
    {
      headers: {
        'Authorization': `Bearer ${engine.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  )
  
  return filterThinkTags(response.data.choices[0].message.content)
}

// Ollama API 调用
async function callOllama(engine, options) {
  const requestData = {
    model: engine.model,
    messages: options.messages,
    stream: false,
    options: {}
  }
  
  // 添加可选参数到options对象中
  if (options.temperature !== undefined) {
    requestData.options.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    requestData.options.max_tokens = options.maxTokens
  }
  
  console.log('Ollama API Request:', JSON.stringify(requestData, null, 2))
  
  const response = await axios.post(
    `${engine.baseURL}/api/chat`,
    requestData
  )
  
  return filterThinkTags(response.data.message.content)
}

// Llama.cpp API 调用
async function callLlamaCpp(engine, options) {
  const requestData = {
    prompt: options.prompt
  }
  
  // 添加可选参数
  if (options.temperature !== undefined) {
    requestData.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    requestData.n_predict = options.maxTokens
  }
  
  console.log('Llama.cpp API Request:', JSON.stringify(requestData, null, 2))
  
  const response = await axios.post(
    `${engine.baseURL}/completion`,
    requestData
  )
  
  return filterThinkTags(response.data.content)
}

// 自定义 AI API 调用
async function callCustomAI(engine, options) {
  const requestData = {
    model: engine.model,
    messages: options.messages
  }
  
  // 添加可选参数
  if (options.temperature !== undefined) {
    requestData.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    requestData.max_tokens = options.maxTokens
  }
  
  console.log('Custom AI API Request:', JSON.stringify(requestData, null, 2))
  
  const response = await axios.post(
    `${engine.baseURL}/chat/completions`,
    requestData,
    {
      headers: {
        'Authorization': `Bearer ${engine.apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  )
  
  return filterThinkTags(response.data.choices[0].message.content)
}

// Git 操作
async function initGitRepo(projectDir) {
  return new Promise((resolve, reject) => {
    exec('git init', { 
      cwd: projectDir,
      shell: true 
    }, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

ipcMain.handle('git-status', async (event, projectPath) => {
  return new Promise((resolve, reject) => {
    // 首先检查是否是Git仓库
    exec('git rev-parse --is-inside-work-tree', { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ 
          success: false, 
          error: '不是Git仓库',
          status: {
            isRepository: false,
            files: [],
            current: null
          }
        })
        return
      }

      // 获取当前分支
      exec('git branch --show-current', { 
        cwd: projectPath,
        shell: true 
      }, (branchError, branchOutput) => {
        const currentBranch = branchError ? 'main' : branchOutput.trim()

        // 获取状态
        exec('git status --porcelain', { 
          cwd: projectPath,
          shell: true 
        }, (statusError, statusOutput) => {
          if (statusError) {
            resolve({ 
              success: false, 
              error: statusError.message,
              status: {
                isRepository: true,
                files: [],
                current: currentBranch
              }
            })
          } else {
            const files = statusOutput.trim() ? statusOutput.trim().split('\n') : []
            resolve({ 
              success: true, 
              status: {
                isRepository: true,
                files: files,
                current: currentBranch,
                raw: statusOutput
              }
            })
          }
        })
      })
    })
  })
})

ipcMain.handle('git-commit', async (event, projectPath, message) => {
  return new Promise((resolve, reject) => {
    exec(`git add . && git commit -m "${message}"`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true })
      }
    })
  })
})

// 文件操作
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    // 确保目录存在
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    
    await fs.writeFile(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 创建目录
ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})

// 选择目录
ipcMain.handle('choose-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择项目目录'
    });
    return result;
  } catch (error) {
    console.error('Choose directory error:', error);
    throw error;
  }
});

// 应用退出时清理
app.on('before-quit', () => {
  if (aiProcess) {
    aiProcess.kill()
  }
})

// 初始化应用
app.whenReady().then(() => {
  initializeSettings()
})

ipcMain.handle('save-project', async (event, saveData) => {
  try {
    const { path: projectPath, content, metadata } = saveData
    const projectFilePath = path.join(projectPath, 'project.json')
    
    // 读取现有项目数据
    const existingData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
    
    // 更新项目数据
    const updatedData = {
      ...existingData,
      ...metadata,
      updatedAt: new Date().toISOString()
    }
    
    // 保存项目文件
    await fs.writeFile(projectFilePath, JSON.stringify(updatedData, null, 2))
    
    // 保存内容到主文件
    const contentPath = path.join(projectPath, 'content.md')
    await fs.writeFile(contentPath, content)
    
    return { success: true }
  } catch (error) {
    console.error('保存项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('delete-project', async (event, projectPath) => {
  try {
    // 递归删除项目目录
    await fs.rm(projectPath, { recursive: true, force: true })
    return { success: true }
  } catch (error) {
    console.error('删除项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('export-project', async (event, exportData) => {
  try {
    const { projectPath, content, format, metadata } = exportData
    const projectName = metadata.title || path.basename(projectPath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `${projectName}-${timestamp}.${format}`
    
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: fileName,
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    if (!result.canceled) {
      await fs.writeFile(result.filePath, content)
      return { success: true, filePath: result.filePath }
    }
    
    return { success: false, error: '用户取消保存' }
  } catch (error) {
    console.error('导出项目失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-project', async (event, projectPath) => {
  try {
    const fs = require('fs').promises
    const path = require('path')
    
    console.log('尝试打开项目:', projectPath)
    
    // 确保路径是绝对路径
    const absoluteProjectPath = path.resolve(projectPath)
    console.log('解析后的绝对路径:', absoluteProjectPath)
    
    // 检查项目路径是否存在
    const projectJsonPath = path.join(absoluteProjectPath, 'project.json')
    console.log('项目文件路径:', projectJsonPath)
    
    try {
      await fs.access(projectJsonPath)
      console.log('项目文件存在')
    } catch (error) {
      console.error('项目文件不存在:', projectJsonPath)
      throw new Error(`项目文件不存在: ${projectJsonPath}`)
    }
    
    // 读取项目文件
    const projectData = await fs.readFile(projectJsonPath, 'utf8')
    const project = JSON.parse(projectData)
    
    // 确保项目对象有必要的属性
    if (!project.metadata) {
      project.metadata = {}
    }
    
    if (!project.chapters) {
      project.chapters = []
    }
    
    if (!project.settings) {
      project.settings = {}
    }
    
    // 设置项目路径
    project.path = absoluteProjectPath
    
    console.log('项目打开成功:', project.metadata.title)
    
    return { 
      success: true, 
      project: project
    }
  } catch (error) {
    console.error('打开项目失败:', error)
    return { 
      success: false, 
      error: error.message 
    }
  }
})

// AI 相关 API
ipcMain.handle('call-ai', async (event, options) => {
  try {
    const settings = store.get('settings', defaultSettings)
    const { provider, model, prompt, systemPrompt, context, temperature, maxTokens } = options
    
    console.log('AI call options:', options)
    
    const engine = settings.ai.engines[provider] || settings.ai.engines[settings.ai.selectedEngine]
    
    let response
    
    // 构建消息数组，严格按照OpenAI官方文档格式
    const messages = []
    
    // 添加系统提示（如果存在）
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({
        role: 'system',
        content: systemPrompt.trim()
      })
    }
    
    // 构建用户消息
    let userContent = prompt
    if (context && context.trim()) {
      userContent = `${prompt}\n\n需要处理的文本：\n${context.trim()}`
    }
    
    messages.push({
      role: 'user',
      content: userContent
    })
    
    console.log('Constructed messages:', JSON.stringify(messages, null, 2))
    
    // 构建请求参数
    const requestOptions = {
      messages: messages
    }
    
    // 添加可选参数（只有在明确设置时才包含）
    if (temperature !== undefined) {
      requestOptions.temperature = temperature
    } else if (settings.ai.temperature !== undefined) {
      requestOptions.temperature = settings.ai.temperature
    }
    
    if (maxTokens !== undefined) {
      requestOptions.maxTokens = maxTokens
    } else if (settings.ai.maxTokens !== undefined) {
      requestOptions.maxTokens = settings.ai.maxTokens
    }
    
    // 对于llama.cpp，构建单一prompt
    if (provider === 'llamacpp') {
      let llamaPrompt = ''
      if (systemPrompt && systemPrompt.trim()) {
        llamaPrompt += systemPrompt.trim() + '\n\n'
      }
      llamaPrompt += userContent
      requestOptions.prompt = llamaPrompt
    }
    
    console.log('Final request options:', JSON.stringify(requestOptions, null, 2))
    
    switch (provider) {
      case 'openai':
        response = await callOpenAI(engine, requestOptions)
        break
      case 'ollama':
        response = await callOllama(engine, requestOptions)
        break
      case 'llamacpp':
        response = await callLlamaCpp(engine, requestOptions)
        break
      case 'custom':
        response = await callCustomAI(engine, requestOptions)
        break
      default:
        throw new Error(`未知的 AI 提供商: ${provider}`)
    }
    
    return { success: true, content: response }
  } catch (error) {
    console.error('AI 调用失败:', error)
    return { success: false, error: error.message }
  }
})

// 更新设置 API
ipcMain.handle('update-settings', async (event, settings) => {
  try {
    const currentSettings = store.get('settings', defaultSettings)
    
    // 深合并函数
    function deepMerge(target, source) {
      const result = { ...target }
      
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key])
          } else {
            result[key] = source[key]
          }
        }
      }
      
      return result
    }
    
    const mergedSettings = deepMerge(currentSettings, settings)
    store.set('settings', mergedSettings)
    
    console.log('Settings updated successfully, merged AI engines:', JSON.stringify(mergedSettings.ai?.engines || {}, null, 2))
    
    return { success: true }
  } catch (error) {
    console.error('更新设置失败:', error)
    return { success: false, error: error.message }
  }
})

// Git 相关 API
ipcMain.handle('git-init', async (event, projectPath) => {
  return new Promise((resolve) => {
    exec('git init', { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true })
      }
    })
  })
})

ipcMain.handle('git-add', async (event, projectPath, files) => {
  return new Promise((resolve) => {
    const fileList = Array.isArray(files) ? files.join(' ') : files
    exec(`git add ${fileList}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true })
      }
    })
  })
})

ipcMain.handle('git-push', async (event, projectPath, remote = 'origin', branch = null) => {
  return new Promise((resolve) => {
    // 首先检查是否有提交
    exec('git log --oneline -1', { 
      cwd: projectPath,
      shell: true 
    }, (logError, logOutput) => {
      if (logError) {
        resolve({ success: false, error: '没有可推送的提交，请先提交一些内容' })
        return
      }

      // 获取当前分支
      exec('git branch --show-current', { 
        cwd: projectPath,
        shell: true 
      }, (branchError, branchOutput) => {
        const currentBranch = branch || (branchError ? 'main' : branchOutput.trim())
        
        if (!currentBranch) {
          resolve({ success: false, error: '无法确定当前分支' })
          return
        }
        
        // 检查远程仓库是否存在
        exec('git remote -v', { 
          cwd: projectPath,
          shell: true 
        }, (remoteError, remoteOutput) => {
          if (remoteError || !remoteOutput.includes(remote)) {
            resolve({ success: false, error: `远程仓库 '${remote}' 不存在，请先添加远程仓库` })
            return
          }
          
          // 执行推送
          exec(`git push ${remote} ${currentBranch}`, { 
            cwd: projectPath,
            shell: true 
          }, (error, stdout, stderr) => {
            if (error) {
              // 如果是首次推送，尝试设置上游分支
              if (error.message.includes('does not match any') || error.message.includes('no upstream') || stderr.includes('does not match any')) {
                exec(`git push -u ${remote} ${currentBranch}`, { 
                  cwd: projectPath,
                  shell: true 
                }, (retryError, retryStdout) => {
                  if (retryError) {
                    resolve({ success: false, error: `推送失败: ${retryError.message}` })
                  } else {
                    resolve({ success: true, message: `推送成功并设置上游分支 (${currentBranch})` })
                  }
                })
              } else {
                resolve({ success: false, error: `推送失败: ${error.message}` })
              }
            } else {
              resolve({ success: true, message: '推送成功' })
            }
          })
        })
      })
    })
  })
})

ipcMain.handle('git-pull', async (event, projectPath, remote, branch) => {
  return new Promise((resolve) => {
    exec(`git pull ${remote} ${branch}`, { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        const hasChanges = stdout.includes('files changed') || stdout.includes('file changed')
        resolve({ success: true, hasChanges })
      }
    })
  })
})

ipcMain.handle('git-add-remote', async (event, projectPath, name, url) => {
  return new Promise((resolve) => {
    exec(`git remote add ${name} ${url}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true })
      }
    })
  })
})

ipcMain.handle('git-clone', async (event, url, localPath) => {
  return new Promise((resolve) => {
    exec(`git clone ${url} "${localPath}"`, {
      shell: true
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true })
      }
    })
  })
})

ipcMain.handle('git-log', async (event, projectPath, limit) => {
  return new Promise((resolve) => {
    const cmd = `git log --oneline -${limit || 20} --format="%H|%s|%an|%ad" --date=short`
    exec(cmd, { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        const commits = stdout.trim().split('\n').map(line => {
          const [hash, subject, author, date] = line.split('|')
          return { hash, subject, author, date }
        })
        resolve({ success: true, commits })
      }
    })
  })
})

// Git 分支操作
ipcMain.handle('git-create-branch', async (event, projectPath, branchName) => {
  return new Promise((resolve) => {
    exec(`git checkout -b ${branchName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, message: `分支 ${branchName} 创建成功` })
      }
    })
  })
})

ipcMain.handle('git-switch-branch', async (event, projectPath, branchName) => {
  return new Promise((resolve) => {
    exec(`git checkout ${branchName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, message: `切换到分支 ${branchName}` })
      }
    })
  })
})

ipcMain.handle('git-delete-branch', async (event, projectPath, branchName, force = false) => {
  return new Promise((resolve) => {
    // 检查是否为当前分支
    exec('git branch --show-current', { 
      cwd: projectPath,
      shell: true 
    }, (branchError, branchOutput) => {
      const currentBranch = branchError ? '' : branchOutput.trim()
      
      if (currentBranch === branchName) {
        resolve({ success: false, error: '不能删除当前分支，请先切换到其他分支' })
        return
      }
      
      const deleteCmd = force ? `git branch -D ${branchName}` : `git branch -d ${branchName}`
      
      exec(deleteCmd, { 
        cwd: projectPath,
        shell: true 
      }, (error) => {
        if (error) {
          if (error.message.includes('not fully merged')) {
            resolve({ 
              success: false, 
              error: '分支未完全合并，使用强制删除或先合并分支',
              needsForce: true 
            })
          } else {
            resolve({ success: false, error: error.message })
          }
        } else {
          resolve({ success: true, message: `分支 ${branchName} 删除成功` })
        }
      })
    })
  })
})

ipcMain.handle('git-push-branch', async (event, projectPath, branchName, remote = 'origin') => {
  return new Promise((resolve) => {
    exec(`git push -u ${remote} ${branchName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, message: `分支 ${branchName} 推送成功` })
      }
    })
  })
})

ipcMain.handle('git-get-branches', async (event, projectPath) => {
  return new Promise((resolve) => {
    exec('git branch -a', { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        const branches = stdout.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('*'))
          .map(line => {
            const current = line.startsWith('*')
            const name = line.replace(/^\*\s*/, '').replace(/^remotes\/[^\/]+\//, '')
            const isRemote = line.includes('remotes/')
            return {
              name,
              current,
              isRemote,
              fullName: line.replace(/^\*\s*/, '')
            }
          })
        
        const currentBranch = stdout.split('\n')
          .find(line => line.startsWith('*'))
          ?.replace(/^\*\s*/, '') || 'main'
        
        resolve({ 
          success: true, 
          branches,
          currentBranch: currentBranch.replace(/^remotes\/[^\/]+\//, '')
        })
      }
    })
  })
})

// Git 远程仓库操作
ipcMain.handle('git-remove-remote', async (event, projectPath, remoteName) => {
  return new Promise((resolve) => {
    exec(`git remote remove ${remoteName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, message: `远程仓库 ${remoteName} 删除成功` })
      }
    })
  })
})

ipcMain.handle('git-rename-remote', async (event, projectPath, oldName, newName) => {
  return new Promise((resolve) => {
    exec(`git remote rename ${oldName} ${newName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, message: `远程仓库 ${oldName} 重命名为 ${newName}` })
      }
    })
  })
})

ipcMain.handle('git-fetch-remote', async (event, projectPath, remoteName) => {
  return new Promise((resolve) => {
    exec(`git fetch ${remoteName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, message: `远程仓库 ${remoteName} 获取成功` })
      }
    })
  })
})

ipcMain.handle('git-get-remotes', async (event, projectPath) => {
  return new Promise((resolve) => {
    exec('git remote -v', { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        const remotes = {}
        stdout.split('\n')
          .filter(line => line.trim())
          .forEach(line => {
            const [name, url, type] = line.split(/\s+/)
            if (name && url) {
              if (!remotes[name]) {
                remotes[name] = { name, urls: {} }
              }
              remotes[name].urls[type?.replace(/[()]/g, '') || 'fetch'] = url
            }
          })
        
        resolve({ 
          success: true, 
          remotes: Object.values(remotes)
        })
      }
    })
  })
})

// 获取远程仓库列表
ipcMain.handle('git-list-remotes', async (event, projectPath) => {
  return new Promise((resolve) => {
    exec('git remote -v', { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        const lines = stdout.trim().split('\n').filter(line => line.trim())
        const remoteMap = {}
        
        lines.forEach(line => {
          const parts = line.split(/\s+/)
          if (parts.length >= 2) {
            const name = parts[0]
            const url = parts[1]
            if (!remoteMap[name]) {
              remoteMap[name] = { name, url, type: 'fetch' }
            }
          }
        })
        
        const remotes = Object.values(remoteMap)
        resolve({ success: true, remotes })
      }
    })
  })
})

// 获取分支列表
ipcMain.handle('git-list-branches', async (event, projectPath, includeRemote = false) => {
  return new Promise((resolve) => {
    const cmd = includeRemote ? 'git branch -a' : 'git branch'
    exec(cmd, { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        const branches = stdout.trim().split('\n').map(line => {
          const cleanLine = line.replace(/^\*\s*/, '').trim()
          const isCurrent = line.startsWith('*')
          const isRemote = cleanLine.startsWith('remotes/')
          
          return { 
            name: cleanLine, 
            current: isCurrent, 
            type: isRemote ? 'remote' : 'local' 
          }
        }).filter(branch => branch.name && branch.name !== '' && !branch.name.includes('HEAD'))
        
        resolve({ success: true, branches })
      }
    })
  })
})

// 获取当前分支信息
ipcMain.handle('git-current-branch', async (event, projectPath) => {
  return new Promise((resolve) => {
    exec('git branch --show-current', { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, branch: stdout.trim() })
      }
    })
  })
})

// 获取远程仓库状态
ipcMain.handle('git-remote-status', async (event, projectPath, remote = 'origin') => {
  return new Promise((resolve) => {
    exec(`git remote show ${remote}`, { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, status: stdout })
      }
    })
  })
})

// 获取提交差异
ipcMain.handle('git-diff', async (event, projectPath, commitHash1, commitHash2) => {
  return new Promise((resolve) => {
    const cmd = commitHash2 ? `git diff ${commitHash1} ${commitHash2}` : `git diff ${commitHash1}`
    exec(cmd, { cwd: projectPath }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, diff: stdout })
      }
    })
  })
})

// 同步远程仓库（fetch）
ipcMain.handle('git-fetch', async (event, projectPath, remote = 'origin') => {
  return new Promise((resolve) => {
    exec(`git fetch ${remote}`, { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, output: stdout })
      }
    })
  })
})

// 自动保存和备份
let autoSaveTimer = null
let backupTimer = null

ipcMain.handle('enable-auto-save', async (event, projectPath, interval) => {
  try {
    // 清除现有定时器
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
    }
    
    // 设置新的自动保存定时器
    autoSaveTimer = setInterval(async () => {
      // 触发自动保存事件
      if (mainWindow) {
        mainWindow.webContents.send('auto-save-trigger')
      }
    }, interval)
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('disable-auto-save', async () => {
  try {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer)
      autoSaveTimer = null
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('create-backup', async (event, projectPath) => {
  try {
    const settings = store.get('settings', defaultSettings)
    const backupDir = path.join(settings.general.projectsDir, 'backups')
    
    // 确保备份目录存在
    await fs.mkdir(backupDir, { recursive: true })
    
    const projectName = path.basename(projectPath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `${projectName}-${timestamp}.zip`)
    
    // 创建压缩包
    await createZipBackup(projectPath, backupPath)
    
    return { success: true, backupPath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

async function createZipBackup(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    output.on('close', () => resolve())
    archive.on('error', reject)
    
    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

// 字数计算函数
function getWordCount(text) {
  // 中文字符计数
  const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 英文单词计数
  const englishCount = text.replace(/[\u4e00-\u9fa5]/g, '').split(/\s+/).filter(word => word.length > 0).length;
  return chineseCount + englishCount;
}

// 章节操作
ipcMain.handle('save-chapter', async (event, { projectPath, chapterId, title, content }) => {
  try {
    const chaptersDir = path.join(projectPath, 'chapters')
    
    // 确保章节目录存在
    await fs.mkdir(chaptersDir, { recursive: true })
    
    // 创建章节子目录
    const chapterDir = path.join(chaptersDir, chapterId)
    await fs.mkdir(chapterDir, { recursive: true })
    
    // 保存纯Markdown内容
    const contentPath = path.join(chapterDir, 'content.md')
    await fs.writeFile(contentPath, content, 'utf-8')
    
    // 计算字数
    const wordCount = getWordCount(content)
    
    // 检查是否已有元数据文件以获取创建时间
    const metadataPath = path.join(chapterDir, 'metadata.json')
    let createdAt = new Date().toISOString()
    
    try {
      const existingMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
      createdAt = existingMetadata.createdAt || createdAt
    } catch (error) {
      // 文件不存在，使用当前时间
    }
    
    // 保存元数据
    const metadata = {
      id: chapterId,
      title: title,
      wordCount: wordCount,
      lastModified: new Date().toISOString(),
      createdAt: createdAt
    }
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
    
    // 更新项目文件中的章节列表
    const projectFilePath = path.join(projectPath, 'project.json')
    const projectData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
    
    // 确保 chapters 是数组
    if (!Array.isArray(projectData.chapters)) {
      projectData.chapters = []
    }
    
    // 查找或添加章节
    const existingChapterIndex = projectData.chapters.findIndex(ch => ch && ch.id === chapterId)
    const chapterInfo = {
      id: chapterId,
      title: title,
      wordCount: wordCount,
      lastModified: new Date().toISOString(),
      createdAt: createdAt, // 包含创建时间
      directory: chapterId
    }
    
    if (existingChapterIndex >= 0) {
      projectData.chapters[existingChapterIndex] = chapterInfo
    } else {
      projectData.chapters.push(chapterInfo)
    }
    
    // 更新项目修改时间
    projectData.updatedAt = new Date().toISOString()
    
    // 保存项目文件
    await fs.writeFile(projectFilePath, JSON.stringify(projectData, null, 2), 'utf-8')
    
    return { success: true, chapterDir }
  } catch (error) {
    console.error('Save chapter error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('load-chapter', async (event, { projectPath, chapterId }) => {
  try {
    const chapterDir = path.join(projectPath, 'chapters', chapterId)
    
    // 读取内容文件
    const contentPath = path.join(chapterDir, 'content.md')
    const content = await fs.readFile(contentPath, 'utf-8')
    
    // 读取元数据文件
    const metadataPath = path.join(chapterDir, 'metadata.json')
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
    
    // 合并数据
    const chapterData = {
      ...metadata,
      content: content
    }
    
    return { success: true, chapter: chapterData }
  } catch (error) {
    console.error('Load chapter error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('delete-chapter', async (event, { projectPath, chapterId }) => {
  try {
    const chapterDir = path.join(projectPath, 'chapters', chapterId)
    
    // 删除整个章节目录
    await fs.rm(chapterDir, { recursive: true, force: true })
    
    // 更新项目文件
    const projectFilePath = path.join(projectPath, 'project.json')
    const projectData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
    
    // 确保 chapters 是数组
    if (!Array.isArray(projectData.chapters)) {
      projectData.chapters = []
    }
    
    // 从章节列表中移除
    projectData.chapters = projectData.chapters.filter(ch => ch && ch.id !== chapterId)
    
    // 更新项目修改时间
    projectData.updatedAt = new Date().toISOString()
    
    // 保存项目文件
    await fs.writeFile(projectFilePath, JSON.stringify(projectData, null, 2), 'utf-8')
    
    return { success: true }
  } catch (error) {
    console.error('Delete chapter error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('rename-chapter', async (event, { projectPath, chapterId, newTitle }) => {
  try {
    const chapterDir = path.join(projectPath, 'chapters', chapterId)
    
    // 更新章节元数据
    const metadataPath = path.join(chapterDir, 'metadata.json')
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
    
    // 更新标题和修改时间
    metadata.title = newTitle
    metadata.lastModified = new Date().toISOString()
    
    // 保存元数据
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
    
    // 更新项目文件中的章节列表
    const projectFilePath = path.join(projectPath, 'project.json')
    const projectData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
    
    // 确保 chapters 是数组
    if (!Array.isArray(projectData.chapters)) {
      projectData.chapters = []
    }
    
    // 查找并更新章节
    const chapterIndex = projectData.chapters.findIndex(ch => ch && ch.id === chapterId)
    if (chapterIndex >= 0) {
      projectData.chapters[chapterIndex].title = newTitle
      projectData.chapters[chapterIndex].lastModified = new Date().toISOString()
    }
    
    // 更新项目修改时间
    projectData.updatedAt = new Date().toISOString()
    
    // 保存项目文件
    await fs.writeFile(projectFilePath, JSON.stringify(projectData, null, 2), 'utf-8')
    
    return { success: true }
  } catch (error) {
    console.error('Rename chapter error:', error)
    return { success: false, error: error.message }
  }
})

// 字体管理
ipcMain.handle('get-system-fonts', async () => {
  try {
    // 获取系统字体列表
    const systemFonts = [
      'Arial', 'Times New Roman', 'Helvetica', 'Georgia', 'Verdana',
      'Trebuchet MS', 'Arial Black', 'Impact', 'Lucida Console',
      'Tahoma', 'Palatino', 'Garamond', 'Bookman', 'Avant Garde',
      'SimSun', 'SimHei', 'Microsoft YaHei', 'KaiTi', 'FangSong',
      'LiSu', 'YouYuan', 'STXihei', 'STKaiti', 'STSong'
    ]
    
    return { success: true, fonts: systemFonts }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('add-custom-font', async (event, fontPath) => {
  try {
    const fontName = path.basename(fontPath, path.extname(fontPath))
    const settings = store.get('settings', defaultSettings)
    
    if (!settings.editor.customFonts) {
      settings.editor.customFonts = []
    }
    
    // 检查字体是否已存在
    const existingFont = settings.editor.customFonts.find(f => f.path === fontPath)
    if (existingFont) {
      return { success: false, error: '字体已存在' }
    }
    
    // 添加字体
    settings.editor.customFonts.push({
      name: fontName,
      path: fontPath,
      addedAt: new Date().toISOString()
    })
    
    store.set('settings', settings)
    
    return { success: true, font: { name: fontName, path: fontPath } }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('remove-custom-font', async (event, fontPath) => {
  try {
    const settings = store.get('settings', defaultSettings)
    
    if (!settings.editor.customFonts) {
      return { success: true }
    }
    
    settings.editor.customFonts = settings.editor.customFonts.filter(f => f.path !== fontPath)
    store.set('settings', settings)
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 主题管理
ipcMain.handle('set-theme', async (event, theme) => {
  try {
    const settings = store.get('settings', defaultSettings)
    settings.general.theme = theme
    store.set('settings', settings)
    
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-theme', async () => {
  try {
    const settings = store.get('settings', defaultSettings)
    return { success: true, theme: settings.general.theme || 'dark' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 过滤AI回答中的<think>标签
function filterThinkTags(content) {
  if (!content || typeof content !== 'string') {
    return content
  }
  
  // 移除<think>标签及其内容（支持多行）
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

// 备份文件夹操作
ipcMain.handle('open-backup-folder', async () => {
  try {
    const settings = store.get('settings', defaultSettings)
    const backupDir = path.join(settings.general.projectsDir, 'backups')
    
    // 确保备份文件夹存在
    await fs.mkdir(backupDir, { recursive: true })
    
    // 打开文件夹
    shell.openPath(backupDir)
    
    return { success: true }
  } catch (error) {
    console.error('Open backup folder error:', error)
    return { success: false, error: error.message }
  }
})

// 设置导入导出
ipcMain.handle('export-settings', async (event, filePath) => {
  try {
    const settings = store.get('settings', defaultSettings)
    
    // 移除敏感信息（API密钥等）
    const exportSettings = JSON.parse(JSON.stringify(settings))
    if (exportSettings.ai?.engines?.openai?.apiKey) {
      exportSettings.ai.engines.openai.apiKey = '***已隐藏***'
    }
    if (exportSettings.ai?.engines?.custom?.apiKey) {
      exportSettings.ai.engines.custom.apiKey = '***已隐藏***'
    }
    
    await fs.writeFile(filePath, JSON.stringify(exportSettings, null, 2), 'utf-8')
    
    return { success: true }
  } catch (error) {
    console.error('Export settings error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('import-settings', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf-8')
    const importedSettings = JSON.parse(data)
    
    // 合并设置，保留现有的敏感信息
    const currentSettings = store.get('settings', defaultSettings)
    const mergedSettings = {
      ...defaultSettings,
      ...importedSettings
    }
    
    // 保留当前的API密钥（如果导入的设置中包含占位符）
    if (importedSettings.ai?.engines?.openai?.apiKey === '***已隐藏***') {
      mergedSettings.ai.engines.openai.apiKey = currentSettings.ai?.engines?.openai?.apiKey || ''
    }
    if (importedSettings.ai?.engines?.custom?.apiKey === '***已隐藏***') {
      mergedSettings.ai.engines.custom.apiKey = currentSettings.ai?.engines?.custom?.apiKey || ''
    }
    
    store.set('settings', mergedSettings)
    
    return { success: true }
  } catch (error) {
    console.error('Import settings error:', error)
    return { success: false, error: error.message }
  }
})

// AI连接测试
ipcMain.handle('test-ai-connection', async (event, engine, engineSettings) => {
  try {
    console.log('=== AI连接测试开始 ===')
    console.log('引擎参数:', engine, '(类型:', typeof engine, ')')
    console.log('设置参数:', JSON.stringify(engineSettings, null, 2))
    
    // 检查参数有效性
    if (!engine || typeof engine !== 'string') {
      const errorMsg = `无效的引擎参数: ${typeof engine} - ${engine}`
      console.error(errorMsg)
      return { success: false, error: errorMsg }
    }
    
    if (!engineSettings || typeof engineSettings !== 'object') {
      const errorMsg = `无效的引擎设置参数: ${typeof engineSettings}`
      console.error(errorMsg)
      return { success: false, error: errorMsg }
    }
    
    let testResult = false
    let errorMessage = ''
    
    console.log('开始测试引擎:', engine)
    
    switch (engine) {
      case 'openai':
        if (!engineSettings.apiKey) {
          throw new Error('OpenAI API Key is required')
        }
        
        console.log('测试OpenAI连接...')
        try {
          const response = await axios.post(
            `${engineSettings.baseURL || 'https://api.openai.com/v1'}/chat/completions`,
            {
              model: engineSettings.model || 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'Hello' }],
              max_tokens: 5
            },
            {
              headers: {
                'Authorization': `Bearer ${engineSettings.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          )
          
          testResult = response.status === 200
          console.log('OpenAI连接测试结果:', testResult)
        } catch (error) {
          errorMessage = error.response?.data?.error?.message || error.message
          console.error('OpenAI连接测试失败:', errorMessage)
        }
        break
        
      case 'ollama':
        console.log('测试Ollama连接...')
        try {
          const response = await axios.get(
            `${engineSettings.baseURL || 'http://localhost:11434'}/api/tags`,
            { timeout: 5000 }
          )
          
          testResult = response.status === 200
          console.log('Ollama连接测试结果:', testResult)
        } catch (error) {
          errorMessage = 'Cannot connect to Ollama server'
          console.error('Ollama连接测试失败:', error.message)
        }
        break
        
      case 'llamacpp':
        console.log('测试Llama.cpp连接...')
        try {
          const response = await axios.get(
            `${engineSettings.baseURL || 'http://localhost:8080'}/health`,
            { timeout: 5000 }
          )
          
          testResult = response.status === 200
          console.log('Llama.cpp连接测试结果:', testResult)
        } catch (error) {
          errorMessage = 'Cannot connect to Llama.cpp server'
          console.error('Llama.cpp连接测试失败:', error.message)
        }
        break
        
      case 'custom':
        console.log('测试自定义API连接...')
        console.log('Custom API settings:', {
          hasApiKey: !!engineSettings.apiKey,
          baseURL: engineSettings.baseURL,
          model: engineSettings.model,
          temperature: engineSettings.temperature,
          maxTokens: engineSettings.maxTokens
        })
        
        if (!engineSettings.baseURL || engineSettings.baseURL.trim() === '') {
          throw new Error('Custom API Base URL is required')
        }
        if (!engineSettings.model || engineSettings.model.trim() === '') {
          throw new Error('Custom API Model is required')
        }
        
        try {
          const response = await axios.post(
            `${engineSettings.baseURL.trim()}/chat/completions`,
            {
              model: engineSettings.model.trim(),
              messages: [{ role: 'user', content: 'Hello' }],
              max_tokens: 5,
              temperature: engineSettings.temperature || 0.7
            },
            {
              headers: {
                'Authorization': `Bearer ${engineSettings.apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          )
          
          testResult = response.status === 200
          console.log('自定义API连接测试结果:', testResult)
        } catch (error) {
          errorMessage = error.response?.data?.error?.message || error.message
          console.error('自定义API连接测试失败:', errorMessage)
        }
        break
        
      default:
        throw new Error(`Unsupported engine: ${engine}`)
    }
    
    console.log('=== AI连接测试完成 ===')
    return { success: testResult, error: errorMessage }
  } catch (error) {
    console.error('AI连接测试异常:', error)
    return { success: false, error: error.message }
  }
})

// Git状态获取
ipcMain.handle('get-git-status', async (event, projectPath) => {
  try {
    console.log('Getting git status for:', projectPath)
    
    // 检查是否是Git仓库
    try {
      await fs.access(path.join(projectPath, '.git'))
    } catch (error) {
      return {
        success: true,
        status: {
          isRepo: false,
          isClean: true,
          changedFiles: 0,
          message: 'Not a Git repository'
        }
      }
    }
    
    return new Promise((resolve) => {
      exec('git status --porcelain', { cwd: projectPath, shell: true }, (error, stdout) => {
        if (error) {
          console.error('Git status error:', error)
          resolve({
            success: false,
            error: error.message
          })
          return
        }
        
        const files = stdout.trim().split('\n').filter(line => line.length > 0)
        const changedFiles = files.length
        const isClean = changedFiles === 0
        
        resolve({
          success: true,
          status: {
            isRepo: true,
            isClean,
            changedFiles,
            files,
            message: isClean ? 'Working tree clean' : `${changedFiles} file(s) changed`
          }
        })
      })
    })
    
  } catch (error) {
    console.error('Get git status error:', error)
    return { success: false, error: error.message }
  }
})

// Git 删除远程仓库
ipcMain.handle('git-delete-remote', async (event, projectPath, remoteName) => {
  return new Promise((resolve) => {
    exec(`git remote remove ${remoteName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        resolve({ success: true, message: `远程仓库 ${remoteName} 已删除` })
      }
    })
  })
})

// Git 获取远程分支列表
ipcMain.handle('git-get-remote-branches', async (event, projectPath, remoteName = 'origin') => {
  return new Promise((resolve) => {
    exec(`git ls-remote --heads ${remoteName}`, { 
      cwd: projectPath,
      shell: true 
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message })
      } else {
        try {
          const branches = stdout.split('\n')
            .filter(line => line.trim())
            .map(line => {
              const parts = line.split('\t')
              if (parts.length >= 2) {
                return {
                  name: parts[1].replace('refs/heads/', ''),
                  hash: parts[0]
                }
              }
              return null
            })
            .filter(branch => branch !== null)
          
          resolve({ success: true, branches })
        } catch (parseError) {
          resolve({ success: false, error: 'Failed to parse remote branches' })
        }
      }
    })
  })
})

// 教程相关 IPC 处理
// 获取教程目录
ipcMain.handle('get-tutorial-directory', async () => {
  try {
    // 处理打包后的路径问题
    let tutorialPath
    if (isPackaged) {
      // 打包后，tutorial目录可能在多个位置
      const possiblePaths = [
        path.join(process.resourcesPath, 'tutorial'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'tutorial'),
        path.join(__dirname, '..', '..', 'tutorial'),
        path.join(__dirname, '..', 'tutorial')
      ]
      
      for (const possiblePath of possiblePaths) {
        try {
          await fs.access(possiblePath)
          tutorialPath = possiblePath
          break
        } catch (e) {
          // 继续尝试下一个路径
        }
      }
      
      if (!tutorialPath) {
        console.error('在打包环境中找不到教程目录，尝试的路径:', possiblePaths)
        throw new Error('找不到教程目录')
      }
    } else {
      tutorialPath = path.join(__dirname, '..', 'tutorial')
    }
    
    return tutorialPath
  } catch (error) {
    console.error('获取教程目录失败:', error)
    throw error
  }
})

// 读取所有教程文件
ipcMain.handle('read-tutorial-files', async () => {
  try {
    // 处理打包后的路径问题
    let tutorialPath
    if (isPackaged) {
      // 打包后，tutorial目录可能在多个位置
      const possiblePaths = [
        path.join(process.resourcesPath, 'tutorial'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'tutorial'),
        path.join(__dirname, '..', '..', 'tutorial'),
        path.join(__dirname, '..', 'tutorial')
      ]
      
      for (const possiblePath of possiblePaths) {
        try {
          await fs.access(possiblePath)
          tutorialPath = possiblePath
          break
        } catch (e) {
          // 继续尝试下一个路径
        }
      }
      
      if (!tutorialPath) {
        console.error('在打包环境中找不到教程目录，尝试的路径:', possiblePaths)
        throw new Error('找不到教程目录')
      }
    } else {
      tutorialPath = path.join(__dirname, '..', 'tutorial')
    }
    
    console.log('读取教程文件，路径:', tutorialPath)
    const files = await fs.readdir(tutorialPath)
    
    const tutorialFiles = []
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const filePath = path.join(tutorialPath, file)
        const content = await fs.readFile(filePath, 'utf8')
        tutorialFiles.push({
          filename: file,
          content: content
        })
      }
    }
    
    return tutorialFiles
  } catch (error) {
    console.error('读取教程文件失败:', error)
    throw error
  }
})

// 读取单个教程文件
ipcMain.handle('read-tutorial-file', async (event, filename) => {
  try {
    // 处理打包后的路径问题
    let tutorialPath
    if (isPackaged) {
      // 打包后，tutorial目录可能在多个位置
      const possiblePaths = [
        path.join(process.resourcesPath, 'tutorial'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'tutorial'),
        path.join(__dirname, '..', '..', 'tutorial'),
        path.join(__dirname, '..', 'tutorial')
      ]
      
      for (const possiblePath of possiblePaths) {
        try {
          await fs.access(possiblePath)
          tutorialPath = possiblePath
          break
        } catch (e) {
          // 继续尝试下一个路径
        }
      }
      
      if (!tutorialPath) {
        console.error('在打包环境中找不到教程目录，尝试的路径:', possiblePaths)
        throw new Error('找不到教程目录')
      }
    } else {
      tutorialPath = path.join(__dirname, '..', 'tutorial')
    }
    
    const filePath = path.join(tutorialPath, filename)
    
    // 检查文件是否存在
    const exists = await fs.access(filePath).then(() => true).catch(() => false)
    if (!exists) {
      throw new Error(`教程文件不存在: ${filename}`)
    }
    
    const content = await fs.readFile(filePath, 'utf8')
    return {
      filename: filename,
      content: content
    }
  } catch (error) {
    console.error('读取教程文件失败:', error)
    throw error
  }
})

// 获取应用版本信息
ipcMain.handle('get-app-version-info', async () => {
  try {
    // 读取主package.json
    const packageJsonPath = isPackaged ?
      path.join(process.resourcesPath, 'app.asar', 'package.json') :
      path.join(__dirname, '..', 'package.json')
    
    logger.info('读取package.json路径:', packageJsonPath)
    
    let packageInfo
    try {
      if (isPackaged) {
        // 在打包环境中，直接使用require读取
        packageInfo = require(path.join(__dirname, '..', 'package.json'))
      } else {
        // 在开发环境中，读取文件
        const packageContent = await fs.readFile(packageJsonPath, 'utf8')
        packageInfo = JSON.parse(packageContent)
      }
    } catch (error) {
      logger.error('无法读取package.json，使用备用方法:', error)
      // 备用方法：直接require当前目录的package.json
      packageInfo = require('../../package.json')
    }

    // 获取Node.js模块路径
    const nodeModulesPath = isPackaged ?
      path.join(process.resourcesPath, 'app.asar', 'node_modules') :
      path.join(__dirname, '..', 'node_modules')

    // 读取关键依赖包的版本信息
    const getDependencyVersion = async (packageName) => {
      try {
        if (isPackaged) {
          // 在打包环境中，尝试从app.asar中读取
          try {
            const depPackage = require(path.join(__dirname, '..', 'node_modules', packageName, 'package.json'))
            return depPackage.version
          } catch (error) {
            // 如果打包环境中读取失败，从主package.json中获取
            const version = packageInfo.dependencies?.[packageName] || packageInfo.devDependencies?.[packageName]
            return version ? version.replace(/[\^~]/, '') : 'Unknown'
          }
        } else {
          // 在开发环境中读取文件
          const depPackagePath = path.join(__dirname, '..', 'node_modules', packageName, 'package.json')
          const depContent = await fs.readFile(depPackagePath, 'utf8')
          const depPackage = JSON.parse(depContent)
          return depPackage.version
        }
      } catch (error) {
        logger.warn(`无法获取 ${packageName} 版本:`, error)
        // 备用方法：从主package.json的dependencies中获取
        const version = packageInfo.dependencies?.[packageName] || packageInfo.devDependencies?.[packageName]
        return version ? version.replace(/[\^~]/, '') : 'Unknown'
      }
    }

    // 获取Electron版本（特殊处理）
    const getElectronVersion = () => {
      try {
        return process.versions.electron || 'Unknown'
      } catch (error) {
        logger.warn('无法获取Electron版本:', error)
        return packageInfo.devDependencies?.electron?.replace(/[\^~]/, '') || 'Unknown'
      }
    }

    // 获取关键包版本
    const [
      markedVersion,
      axiosVersion,
      highlightjsVersion,
      electronStoreVersion,
      archiverVersion,
      diffVersion,
      extractZipVersion,
      // Web服务器依赖
      expressVersion,
      socketIoVersion,
      bcryptVersion,
      jsonwebtokenVersion,
      corsVersion
    ] = await Promise.all([
      getDependencyVersion('marked'),
      getDependencyVersion('axios'),
      getDependencyVersion('highlight.js'),
      getDependencyVersion('electron-store'),
      getDependencyVersion('archiver'),
      getDependencyVersion('diff'),
      getDependencyVersion('extract-zip'),
      // Web服务器依赖
      getDependencyVersion('express'),
      getDependencyVersion('socket.io'),
      getDependencyVersion('bcrypt'),
      getDependencyVersion('jsonwebtoken'),
      getDependencyVersion('cors')
    ])

    const versionInfo = {
      app: {
        name: packageInfo.name || 'artimeow-aiwriter',
        version: packageInfo.version || '1.1.0',
        description: packageInfo.description || 'ArtiMeow - AI 集成小说写作桌面应用'
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        electron: getElectronVersion()
      },
      dependencies: {
        'marked': markedVersion,
        'axios': axiosVersion,
        'highlight.js': highlightjsVersion,
        'electron-store': electronStoreVersion,
        'archiver': archiverVersion,
        'diff': diffVersion,
        'extract-zip': extractZipVersion,
        // Web服务器依赖
        'express': expressVersion,
        'socket.io': socketIoVersion,
        'bcrypt': bcryptVersion,
        'jsonwebtoken': jsonwebtokenVersion,
        'cors': corsVersion
      },
      buildInfo: {
        isPackaged: isPackaged,
        resourcesPath: process.resourcesPath || 'N/A',
        execPath: process.execPath
      }
    }

    logger.info('版本信息收集完成:', versionInfo)
    return versionInfo

  } catch (error) {
    logger.error('获取版本信息失败:', error)
    // 返回基本信息作为备用
    return {
      app: {
        name: 'artimeow-aiwriter',
        version: '1.1.0',
        description: 'ArtiMeow - AI 集成小说写作桌面应用'
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        node: process.version,
        electron: process.versions.electron || 'Unknown'
      },
      dependencies: {
        'marked': 'Unknown',
        'axios': 'Unknown',
        'highlight.js': 'Unknown',
        'electron-store': 'Unknown',
        'archiver': 'Unknown',
        'diff': 'Unknown',
        'extract-zip': 'Unknown',
        // Web服务器依赖
        'express': 'Unknown',
        'socket.io': 'Unknown',
        'bcrypt': 'Unknown',
        'jsonwebtoken': 'Unknown',
        'cors': 'Unknown'
      },
      buildInfo: {
        isPackaged: isPackaged,
        resourcesPath: process.resourcesPath || 'N/A',
        execPath: process.execPath
      },
      error: error.message
    }
  }
})

// Shell操作处理
ipcMain.handle('shell-open-external', async (event, url) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (error) {
    logger.error('打开外部链接失败:', error)
    return { success: false, error: error.message }
  }
})

// ========================================
// Web服务器相关处理器
// ========================================

// 启动Web服务器
ipcMain.handle('start-web-server', async (event, config) => {
  try {
    if (!webServer) {
      webServer = new ArtiMeowWebServer()
    }

    // 为Web服务器设置数据访问方法
    setupWebServerDataAccess(webServer)

    const result = await webServer.start(config.port, config.password)
    logger.info('Web服务器启动成功:', result)
    
    if (result.success) {
      return { 
        success: true, 
        info: {
          port: result.port,
          ips: result.ips,
          connectedClients: 0,
          versions: webServer.getServerVersions()
        }
      }
    } else {
      return { success: false, error: result.error }
    }
  } catch (error) {
    logger.error('启动Web服务器失败:', error)
    return { success: false, error: error.message }
  }
})

// 停止Web服务器
ipcMain.handle('stop-web-server', async (event) => {
  try {
    if (webServer) {
      await webServer.stop()
      webServer = null
    }
    
    logger.info('Web服务器已停止')
    return { success: true }
  } catch (error) {
    logger.error('停止Web服务器失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取Web服务器状态
ipcMain.handle('get-web-server-status', async (event) => {
  try {
    if (webServer) {
      return { success: true, status: webServer.getStatus() }
    } else {
      return { 
        success: true, 
        status: { 
          isRunning: false, 
          port: 0, 
          ips: getLocalIPs(), 
          connectedClients: 0 
        } 
      }
    }
  } catch (error) {
    logger.error('获取Web服务器状态失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取本地IP地址
ipcMain.handle('get-local-ips', async (event) => {
  try {
    const ips = getLocalIPs()
    return { success: true, ips }
  } catch (error) {
    logger.error('获取本地IP失败:', error)
    return { success: false, error: error.message, ips: { ipv4: [], ipv6: [] } }
  }
})

/**
 * 获取本地IP地址
 */
function getLocalIPs() {
  const interfaces = os.networkInterfaces()
  const ips = { ipv4: [], ipv6: [] }

  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      if (!iface.internal) {
        if (iface.family === 'IPv4') {
          ips.ipv4.push(iface.address)
        } else if (iface.family === 'IPv6') {
          ips.ipv6.push(iface.address)
        }
      }
    })
  })

  return ips
}

/**
 * 为Web服务器设置数据访问方法
 */
function setupWebServerDataAccess(server) {
  // 创建数据访问器对象
  const dataAccessor = {};

  // 获取项目列表 - 新的基于目录扫描的方式
  dataAccessor.getProjects = async function() {
    try {
      const settings = store.get('settings', {})
      const projectsDir = settings.general?.projectsDir || path.join(os.homedir(), 'ArtiMeowProjects')
      
      // 确保项目目录存在
      await fs.mkdir(projectsDir, { recursive: true })
      
      // 读取项目目录
      const entries = await fs.readdir(projectsDir, { withFileTypes: true })
      const projects = []
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(projectsDir, entry.name)
          const projectFilePath = path.join(projectPath, 'project.json')
          
          try {
            // 检查项目配置文件是否存在
            await fs.access(projectFilePath)
            
            // 读取项目元数据
            const projectData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
            const stats = await fs.stat(projectFilePath)
            
            // 计算字数
            let wordCount = 0
            const chaptersDir = path.join(projectPath, 'chapters')
            try {
              const chapterItems = await fs.readdir(chaptersDir, { withFileTypes: true })
              for (const item of chapterItems) {
                if (item.isDirectory()) {
                  // 目录结构：chapters/chapterID/content.md
                  const contentPath = path.join(chaptersDir, item.name, 'content.md')
                  try {
                    const content = await fs.readFile(contentPath, 'utf-8')
                    wordCount += getWordCount(content)
                  } catch (error) {
                    // 章节内容文件不存在或无法读取
                  }
                }
              }
            } catch (error) {
              // 章节目录不存在或无法读取
            }
            
            const projectInfo = {
              id: entry.name,
              name: projectData.name || entry.name,
              description: projectData.description || '',
              author: projectData.author || '',
              genre: projectData.genre || '',
              path: projectPath,
              created: projectData.createTime || stats.birthtime.getTime(),
              lastModified: projectData.updateTime || stats.mtime.getTime(),
              wordCount: wordCount,
              useGit: projectData.useGit || false,
              version: projectData.version || '1.0.0'
            }
            
            projects.push(projectInfo)
          } catch (error) {
            logger.warn(`跳过无效项目目录 ${entry.name}:`, error.message)
          }
        }
      }
      
      // 按最后修改时间排序（最新的在前）
      projects.sort((a, b) => b.lastModified - a.lastModified)
      
      return projects
    } catch (error) {
      logger.error('Web服务器获取项目列表失败:', error)
      return []
    }
  }

  // 获取项目详情
  dataAccessor.getProject = async function(projectId) {
    try {
      const settings = store.get('settings', {})
      const recentProjects = settings.projectSettings?.recentProjects || []
      
      for (const projectPath of recentProjects) {
        if (path.basename(projectPath) === projectId) {
          const configPath = path.join(projectPath, 'project.json')
          const configData = await fs.readFile(configPath, 'utf8')
          const config = JSON.parse(configData)
          
          // 获取章节列表
          const chaptersPath = path.join(projectPath, 'chapters')
          const chapters = []
          
          try {
            const chapterItems = await fs.readdir(chaptersPath, { withFileTypes: true })
            for (const item of chapterItems) {
              if (item.isDirectory()) {
                // 目录结构：chapters/chapterID/metadata.json + content.md
                const chapterDir = path.join(chaptersPath, item.name)
                const metadataPath = path.join(chapterDir, 'metadata.json')
                const contentPath = path.join(chapterDir, 'content.md')
                
                try {
                  if (await fs.pathExists(metadataPath)) {
                    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))
                    const stats = await fs.stat(contentPath).catch(() => ({ mtime: new Date(), size: 0 }))
                    
                    chapters.push({
                      id: metadata.id || item.name,
                      name: metadata.title || item.name,
                      title: metadata.title || item.name,
                      lastModified: stats.mtime.getTime(),
                      size: stats.size,
                      wordCount: metadata.wordCount || 0
                    })
                  }
                } catch (error) {
                  logger.warn(`获取章节 ${item.name} 信息失败:`, error.message)
                }
              }
            }
          } catch (error) {
            // 章节目录可能不存在
          }
          
          return {
            ...config,
            id: projectId,
            path: projectPath,
            chapters: chapters.sort((a, b) => a.name.localeCompare(b.name))
          }
        }
      }
      
      throw new Error('项目未找到')
    } catch (error) {
      logger.error('Web服务器获取项目详情失败:', error)
      throw error
    }
  }

  // 获取章节内容
  dataAccessor.getChapterContent = async function(projectId, chapterId) {
    try {
      logger.info('获取章节内容请求:', { projectId, chapterId });
      
      // projectId可能是完整路径或项目名称，需要处理两种情况
      let projectPath = projectId;
      
      // 如果是URL编码的路径，需要解码
      if (projectId.includes('%')) {
        projectPath = decodeURIComponent(projectId);
        logger.info('解码后的项目路径:', projectPath);
      }
      
      // 如果projectPath不是绝对路径，则从recent projects中查找
      if (!path.isAbsolute(projectPath)) {
        logger.info('不是绝对路径，从最近项目中查找...');
        const settings = store.get('settings', {})
        const recentProjects = settings.projectSettings?.recentProjects || []
        logger.info('最近项目列表:', recentProjects);
        
        const foundProject = recentProjects.find(p => 
          path.basename(p) === projectId || 
          p.includes(projectId)
        );
        
        if (foundProject) {
          projectPath = foundProject;
          logger.info('找到匹配项目:', projectPath);
        } else {
          logger.error('项目未找到在最近项目中:', projectId);
          throw new Error(`项目未找到: ${projectId}`);
        }
      }
      
      // 使用新的目录结构：chapters/chapterID/content.md
      const chapterDir = path.join(projectPath, 'chapters', chapterId)
      const contentPath = path.join(chapterDir, 'content.md')
      const metadataPath = path.join(chapterDir, 'metadata.json')
      logger.info('章节目录路径:', chapterDir);
      logger.info('章节内容文件路径:', contentPath);
      logger.info('章节元数据文件路径:', metadataPath);
      
      // 检查内容文件是否存在
      const fileExists = await fs.pathExists(contentPath);
      logger.info('章节内容文件是否存在:', fileExists);
      
      if (!fileExists) {
        logger.error('章节内容文件不存在:', contentPath);
        throw new Error(`章节文件不存在: ${chapterId}`);
      }
      
      const content = await fs.readFile(contentPath, 'utf8')
      const stats = await fs.stat(contentPath)
      
      // 尝试读取章节元数据
      let metadata = { id: chapterId, title: chapterId }
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf8')
        metadata = JSON.parse(metadataContent)
      } catch (error) {
        logger.warn('无法读取章节元数据，使用默认值:', error.message)
      }
      
      logger.info('章节内容读取成功:', { 
        chapterId, 
        title: metadata.title,
        contentLength: content.length,
        lastModified: stats.mtime.getTime()
      });
      
      return {
        success: true,
        chapter: {
          id: chapterId,
          title: metadata.title || chapterId,
          content: content,
          lastModified: stats.mtime.getTime(),
          size: stats.size,
          wordCount: metadata.wordCount || 0
        }
      }
    } catch (error) {
      logger.error('Web服务器获取章节内容失败:', error)
      throw error
    }
  }

  // 保存章节内容
  dataAccessor.saveChapterContent = async function(projectId, chapterId, content) {
    try {
      // projectId可能是完整路径或项目名称，需要处理两种情况
      let projectPath = projectId;
      
      // 如果是URL编码的路径，需要解码
      if (projectId.includes('%')) {
        projectPath = decodeURIComponent(projectId);
      }
      
      // 如果projectPath不是绝对路径，则从recent projects中查找
      if (!path.isAbsolute(projectPath)) {
        const settings = store.get('settings', {})
        const recentProjects = settings.projectSettings?.recentProjects || []
        
        const foundProject = recentProjects.find(p => 
          path.basename(p) === projectId || 
          p.includes(projectId)
        );
        
        if (foundProject) {
          projectPath = foundProject;
        } else {
          throw new Error(`项目未找到: ${projectId}`);
        }
      }
      
      // 使用新的目录结构：chapters/chapterID/content.md
      const chapterDir = path.join(projectPath, 'chapters', chapterId)
      const contentPath = path.join(chapterDir, 'content.md')
      
      // 确保章节目录存在
      await fs.ensureDir(chapterDir);
      
      await fs.writeFile(contentPath, content, 'utf8')
      
      logger.info(`Web服务器保存章节成功: ${projectId}/${chapterId}`)
      return { success: true }
    } catch (error) {
      logger.error('Web服务器保存章节内容失败:', error)
      throw error
    }
  }

  // 重命名章节
  dataAccessor.renameChapter = async function(projectPath, chapterId, newTitle) {
    try {
      const chapterDir = path.join(projectPath, 'chapters', chapterId)
      
      // 更新章节元数据
      const metadataPath = path.join(chapterDir, 'metadata.json')
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
      
      // 更新标题和修改时间
      metadata.title = newTitle
      metadata.lastModified = new Date().toISOString()
      
      // 保存元数据
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
      
      // 更新项目文件中的章节列表
      const projectFilePath = path.join(projectPath, 'project.json')
      const projectData = JSON.parse(await fs.readFile(projectFilePath, 'utf-8'))
      
      // 确保 chapters 是数组
      if (!Array.isArray(projectData.chapters)) {
        projectData.chapters = []
      }
      
      // 查找并更新章节
      const chapterIndex = projectData.chapters.findIndex(ch => ch && ch.id === chapterId)
      if (chapterIndex >= 0) {
        projectData.chapters[chapterIndex].title = newTitle
        projectData.chapters[chapterIndex].lastModified = new Date().toISOString()
      }
      
      // 更新项目修改时间
      projectData.updatedAt = new Date().toISOString()
      
      // 保存项目文件
      await fs.writeFile(projectFilePath, JSON.stringify(projectData, null, 2), 'utf-8')
      
      logger.info(`Web服务器重命名章节成功: ${projectPath}/${chapterId} -> ${newTitle}`)
      return { success: true }
    } catch (error) {
      logger.error('Web服务器重命名章节失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 获取设置
  dataAccessor.getSettings = async function() {
    try {
      return store.get('settings', {})
    } catch (error) {
      logger.error('Web服务器获取设置失败:', error)
      return {}
    }
  }

  // 保存设置
  dataAccessor.saveSettings = async function(settings) {
    try {
      store.set('settings', settings)
      logger.info('Web服务器保存设置成功')
      return true
    } catch (error) {
      logger.error('Web服务器保存设置失败:', error)
      throw error
    }
  }
  
  // 获取最近项目 - 基于新的目录扫描方式
  dataAccessor.getRecentProjects = async function() {
    try {
      // 复用getProjects的逻辑
      const projects = await this.getProjects();
      
      // 转换为旧格式以保持兼容性
      const recentProjects = projects.map(project => ({
        id: project.id,
        name: project.name,
        path: project.path,
        description: project.description,
        author: project.author,
        lastModified: project.lastModified,
        createTime: project.created
      }));
      
      return {
        success: true,
        projects: recentProjects
      };
    } catch (error) {
      logger.error('Web服务器获取最近项目失败:', error);
      return {
        success: false,
        projects: [],
        error: error.message
      };
    }
  }
  
  // 获取教程文件
  dataAccessor.getTutorialFiles = async function() {
    try {
      // 处理打包后的路径问题
      let tutorialDir
      if (app.isPackaged) {
        // 打包后，tutorial目录可能在多个位置
        const possiblePaths = [
          path.join(process.resourcesPath, 'tutorial'),
          path.join(process.resourcesPath, 'app.asar.unpacked', 'tutorial'),
          path.join(__dirname, '..', '..', 'tutorial'),
          path.join(__dirname, '..', 'tutorial')
        ]
        
        for (const possiblePath of possiblePaths) {
          if (await fs.pathExists(possiblePath)) {
            tutorialDir = possiblePath
            break
          }
        }
        
        if (!tutorialDir) {
          console.error('在打包环境中找不到教程目录，尝试的路径:', possiblePaths)
          return {
            success: false,
            files: [],
            error: '找不到教程目录'
          }
        }
      } else {
        // 开发环境
        tutorialDir = path.join(__dirname, '..', 'tutorial')
      }
      
      console.log('Web服务器获取教程文件，路径:', tutorialDir)
      
      // 检查目录是否存在
      if (!await fs.pathExists(tutorialDir)) {
        console.error('教程目录不存在:', tutorialDir)
        return {
          success: false,
          files: [],
          error: '教程目录不存在'
        }
      }
      
      const files = await fs.readdir(tutorialDir)
      
      const tutorials = []
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(tutorialDir, file)
          const content = await fs.readFile(filePath, 'utf8')
          const stats = await fs.stat(filePath)
          
          // 提取标题（第一行）
          const lines = content.split('\n')
          const title = lines[0]?.replace(/^#\s*/, '') || file.replace('.md', '')
          
          tutorials.push({
            id: file.replace('.md', ''),
            filename: file,
            title: title,
            content: content,
            size: stats.size,
            lastModified: stats.mtime.getTime()
          })
        }
      }
      
      // 按文件名排序
      tutorials.sort((a, b) => a.filename.localeCompare(b.filename))
      
      // 返回数组格式以与Electron版本兼容
      return tutorials
    } catch (error) {
      logger.error('Web服务器获取教程文件失败:', error)
      return {
        success: false,
        files: [],
        error: error.message
      }
    }
  }

  // 添加最近项目 - 简化逻辑，只更新时间戳
  dataAccessor.addRecentProject = async function(projectPath) {
    try {
      // 基于新的目录扫描模式，我们不需要维护单独的最近项目列表
      // 只需要更新项目的最后修改时间
      const configPath = path.join(projectPath, 'project.json');
      
      // 检查项目是否存在
      await fs.access(configPath);
      
      // 更新项目配置的updateTime
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);
      config.updateTime = Date.now();
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
      
      return { success: true };
    } catch (error) {
      logger.error('Web服务器更新项目时间失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 创建项目
  dataAccessor.createProject = async function(projectData) {
    try {
      // 获取项目目录设置
      const settings = store.get('settings', {})
      const projectsDir = settings.projectsDir || path.join(os.homedir(), 'ArtiMeowProjects')
      
      // 确保项目目录存在
      await fs.mkdir(projectsDir, { recursive: true })
      
      // 创建项目文件夹
      const projectPath = path.join(projectsDir, projectData.name)
      await fs.mkdir(projectPath, { recursive: true })
      
      // 创建项目配置文件
      const projectConfig = {
        name: projectData.name,
        description: projectData.description || '',
        author: projectData.author || '',
        genre: projectData.genre || '',
        createTime: Date.now(),
        updateTime: Date.now(),
        version: '1.0.0',
        useGit: projectData.useGit || false,
        chapters: []
      }
      
      const configPath = path.join(projectPath, 'project.json')
      await fs.writeFile(configPath, JSON.stringify(projectConfig, null, 2), 'utf8')
      
      // 创建chapters目录
      await fs.mkdir(path.join(projectPath, 'chapters'), { recursive: true })
      
      // 如果启用Git，初始化仓库
      if (projectData.useGit) {
        try {
          await execAsync('git init', { cwd: projectPath })
          await execAsync('git add .', { cwd: projectPath })
          await execAsync('git commit -m "Initial commit"', { cwd: projectPath })
        } catch (gitError) {
          logger.warn('Git初始化失败:', gitError.message)
        }
      }
      
      return {
        success: true,
        projectDir: projectPath,
        config: projectConfig
      }
    } catch (error) {
      logger.error('Web服务器创建项目失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 加载项目
  dataAccessor.loadProject = async function(projectPath) {
    try {
      const configPath = path.join(projectPath, 'project.json')
      const configData = await fs.readFile(configPath, 'utf8')
      const config = JSON.parse(configData)
      
      // 读取章节列表 - 支持两种结构：目录结构和文件结构
      const chaptersDir = path.join(projectPath, 'chapters')
      const chapters = []
      
      try {
        const chapterItems = await fs.readdir(chaptersDir, { withFileTypes: true })
        
        for (const item of chapterItems) {
          if (item.isDirectory()) {
            // 目录结构：chapters/chapterID/metadata.json + content.md
            try {
              const chapterDir = path.join(chaptersDir, item.name)
              const metadataPath = path.join(chapterDir, 'metadata.json')
              const contentPath = path.join(chapterDir, 'content.md')
              
              if (await fs.pathExists(metadataPath)) {
                const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))
                const content = await fs.readFile(contentPath, 'utf8').catch(() => '')
                const stats = await fs.stat(contentPath).catch(() => ({ mtime: new Date() }))
                
                chapters.push({
                  ...metadata,
                  content: content,
                  lastModified: stats.mtime.getTime()
                })
              }
            } catch (error) {
              logger.warn(`加载章节目录 ${item.name} 失败:`, error.message)
            }
          }
          // 移除对单文件结构的支持
        }
      } catch (error) {
        logger.warn('读取章节目录失败:', error.message)
      }
      
      // 按创建时间排序章节
      chapters.sort((a, b) => (a.createTime || 0) - (b.createTime || 0))
      
      logger.info(`Web服务器加载项目成功: ${config.title}, 章节数: ${chapters.length}`)
      
      return {
        success: true,
        project: {
          ...config,
          path: projectPath,
          chapters: chapters
        }
      }
    } catch (error) {
      logger.error('Web服务器加载项目失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 保存项目
  dataAccessor.saveProject = async function(saveData) {
    try {
      const { projectPath, config, chapters } = saveData
      
      // 更新项目配置
      if (config) {
        config.updateTime = Date.now()
        const configPath = path.join(projectPath, 'project.json')
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
      }
      
      // 保存章节
      if (chapters && Array.isArray(chapters)) {
        const chaptersDir = path.join(projectPath, 'chapters')
        await fs.mkdir(chaptersDir, { recursive: true })
        
        for (const chapter of chapters) {
          // 使用目录结构：chapters/chapterID/content.md + metadata.json
          const chapterDir = path.join(chaptersDir, chapter.id)
          await fs.mkdir(chapterDir, { recursive: true })
          
          // 保存内容文件
          const contentPath = path.join(chapterDir, 'content.md')
          await fs.writeFile(contentPath, chapter.content || '', 'utf8')
          
          // 保存元数据文件
          const metadata = {
            id: chapter.id,
            title: chapter.title || chapter.name || chapter.id,
            wordCount: getWordCount(chapter.content || ''),
            createdAt: chapter.createdAt || new Date().toISOString(),
            lastModified: new Date().toISOString()
          }
          const metadataPath = path.join(chapterDir, 'metadata.json')
          await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8')
        }
      }
      
      return { success: true }
    } catch (error) {
      logger.error('Web服务器保存项目失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 删除项目
  dataAccessor.deleteProject = async function(projectPath) {
    try {
      await fs.rm(projectPath, { recursive: true, force: true })
      
      // 从最近项目中移除
      const settings = store.get('settings', {})
      if (settings.projectSettings?.recentProjects) {
        const index = settings.projectSettings.recentProjects.indexOf(projectPath)
        if (index > -1) {
          settings.projectSettings.recentProjects.splice(index, 1)
          store.set('settings', settings)
        }
      }
      
      return { success: true }
    } catch (error) {
      logger.error('Web服务器删除项目失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 导入项目
  dataAccessor.importProject = async function(zipBuffer, originalName) {
    try {
      const settings = store.get('settings', {})
      const projectsDir = settings.general?.projectsDir || path.join(os.homedir(), 'ArtiMeowProjects')
      
      // 确保项目目录存在
      await fs.mkdir(projectsDir, { recursive: true })
      
      // 创建临时文件
      const tempZipPath = path.join(os.tmpdir(), `artimeow-web-import-${Date.now()}.zip`)
      await fs.writeFile(tempZipPath, zipBuffer)
      
      // 创建临时解压目录
      const tempDir = path.join(os.tmpdir(), `artimeow-web-extract-${Date.now()}`)
      await fs.mkdir(tempDir, { recursive: true })
      
      try {
        // 解压文件
        await extractZip(tempZipPath, { dir: tempDir })
        
        // 查找项目配置文件
        let projectConfigPath = null
        let extractedProjectPath = null
        
        // 检查临时目录中的内容
        const tempContents = await fs.readdir(tempDir, { withFileTypes: true })
        
        // 查找项目配置文件的位置
        for (const entry of tempContents) {
          if (entry.isDirectory()) {
            const possibleConfigPath = path.join(tempDir, entry.name, 'project.json')
            try {
              await fs.access(possibleConfigPath)
              projectConfigPath = possibleConfigPath
              extractedProjectPath = path.join(tempDir, entry.name)
              break
            } catch (error) {
              // 继续查找
            }
          }
        }
        
        // 如果在子目录中没找到，检查根目录
        if (!projectConfigPath) {
          const rootConfigPath = path.join(tempDir, 'project.json')
          try {
            await fs.access(rootConfigPath)
            projectConfigPath = rootConfigPath
            extractedProjectPath = tempDir
          } catch (error) {
            throw new Error('未找到有效的项目配置文件 (project.json)')
          }
        }
        
        // 读取项目配置
        const projectData = JSON.parse(await fs.readFile(projectConfigPath, 'utf-8'))
        let projectName = projectData.name || originalName || 'imported-project'
        
        // 检查项目名称是否已存在，如果存在则添加后缀
        let finalProjectName = projectName
        let counter = 1
        while (true) {
          const targetPath = path.join(projectsDir, finalProjectName)
          try {
            await fs.access(targetPath)
            finalProjectName = `${projectName}_${counter}`
            counter++
          } catch (error) {
            // 目录不存在，可以使用这个名称
            break
          }
        }
        
        // 移动项目到目标位置
        const finalProjectPath = path.join(projectsDir, finalProjectName)
        await fs.mkdir(finalProjectPath, { recursive: true })
        
        // 复制所有文件
        const copyRecursively = async (src, dest) => {
          const entries = await fs.readdir(src, { withFileTypes: true })
          await fs.mkdir(dest, { recursive: true })
          
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name)
            const destPath = path.join(dest, entry.name)
            
            if (entry.isDirectory()) {
              await copyRecursively(srcPath, destPath)
            } else {
              await fs.copyFile(srcPath, destPath)
            }
          }
        }
        
        await copyRecursively(extractedProjectPath, finalProjectPath)
        
        // 更新项目配置
        const finalConfigPath = path.join(finalProjectPath, 'project.json')
        const finalProjectData = JSON.parse(await fs.readFile(finalConfigPath, 'utf-8'))
        finalProjectData.name = finalProjectName
        finalProjectData.updateTime = Date.now()
        if (!finalProjectData.createTime) {
          finalProjectData.createTime = Date.now()
        }
        await fs.writeFile(finalConfigPath, JSON.stringify(finalProjectData, null, 2), 'utf-8')
        
        // 清理临时文件
        await fs.rm(tempDir, { recursive: true, force: true })
        await fs.rm(tempZipPath, { force: true })
        
        return {
          success: true,
          projectPath: finalProjectPath,
          projectName: finalProjectName
        }
        
      } catch (extractError) {
        // 清理临时文件
        try {
          await fs.rm(tempDir, { recursive: true, force: true })
          await fs.rm(tempZipPath, { force: true })
        } catch (cleanupError) {
          logger.warn('清理临时文件失败:', cleanupError)
        }
        throw extractError
      }
      
    } catch (error) {
      logger.error('Web服务器导入项目失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 获取同步数据
  dataAccessor.getSyncData = async function() {
    try {
      const projects = await this.getProjects()
      const settings = await this.getSettings()
      
      return {
        projects: projects,
        settings: settings,
        timestamp: Date.now()
      }
    } catch (error) {
      logger.error('Web服务器获取同步数据失败:', error)
      throw error
    }
  }

  // AI 调用
  dataAccessor.callAI = async function(options) {
    try {
      const settings = store.get('settings', defaultSettings)
      const { provider, model, prompt, systemPrompt, context, temperature, maxTokens } = options
      
      console.log('Web服务器 AI call options:', options)
      
      const engine = settings.ai.engines[provider] || settings.ai.engines[settings.ai.selectedEngine]
      
      let response
      
      // 构建消息数组，严格按照OpenAI官方文档格式
      const messages = []
      
      // 添加系统提示（如果存在）
      if (systemPrompt && systemPrompt.trim()) {
        messages.push({
          role: 'system',
          content: systemPrompt.trim()
        })
      }
      
      // 构建用户消息
      let userContent = prompt
      if (context && context.trim()) {
        userContent = `${prompt}\n\n需要处理的文本：\n${context.trim()}`
      }
      
      messages.push({
        role: 'user',
        content: userContent
      })
      
      console.log('Web服务器 Constructed messages:', JSON.stringify(messages, null, 2))
      
      // 构建请求参数
      const requestOptions = {
        messages: messages
      }
      
      // 添加可选参数（只有在明确设置时才包含）
      if (temperature !== undefined) {
        requestOptions.temperature = temperature
      } else if (settings.ai.temperature !== undefined) {
        requestOptions.temperature = settings.ai.temperature
      }
      
      if (maxTokens !== undefined) {
        requestOptions.maxTokens = maxTokens
      } else if (settings.ai.maxTokens !== undefined) {
        requestOptions.maxTokens = settings.ai.maxTokens
      }
      
      // 对于llama.cpp，构建单一prompt
      if (provider === 'llamacpp') {
        let llamaPrompt = ''
        if (systemPrompt && systemPrompt.trim()) {
          llamaPrompt += systemPrompt.trim() + '\n\n'
        }
        llamaPrompt += userContent
        requestOptions.prompt = llamaPrompt
      }
      
      console.log('Web服务器 Final request options:', JSON.stringify(requestOptions, null, 2))
      
      switch (provider) {
        case 'openai':
          response = await callOpenAI(engine, requestOptions)
          break
        case 'ollama':
          response = await callOllama(engine, requestOptions)
          break
        case 'llamacpp':
          response = await callLlamaCpp(engine, requestOptions)
          break
        case 'custom':
          response = await callCustomAI(engine, requestOptions)
          break
        default:
          throw new Error(`未知的 AI 提供商: ${provider}`)
      }
      
      logger.info(`Web服务器AI调用成功: ${provider}`)
      return { success: true, content: response }
    } catch (error) {
      logger.error('Web服务器AI调用失败:', error)
      return { success: false, error: error.message }
    }
  }

  // AI 连接测试
  dataAccessor.testAIConnection = async function(engine, settings) {
    try {
      console.log('Web服务器测试AI连接:', engine, settings)
      
      const testOptions = {
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
        maxTokens: 10
      }
      
      let response
      
      switch (engine) {
        case 'openai':
          response = await callOpenAI(settings, testOptions)
          break
        case 'ollama':
          response = await callOllama(settings, testOptions)
          break
        case 'llamacpp':
          testOptions.prompt = 'Hello'
          response = await callLlamaCpp(settings, testOptions)
          break
        case 'custom':
          response = await callCustomAI(settings, testOptions)
          break
        default:
          throw new Error(`未知的 AI 引擎: ${engine}`)
      }
      
      logger.info(`Web服务器AI连接测试成功: ${engine}`)
      return { success: true, response: response }
    } catch (error) {
      logger.error('Web服务器AI连接测试失败:', error)
      return { success: false, error: error.message }
    }
  }

  // 设置数据访问器
  server.setDataAccessor(dataAccessor)
}

// 应用退出时停止Web服务器
app.on('before-quit', async (event) => {
  if (webServer) {
    try {
      await webServer.stop()
    } catch (error) {
      logger.error('应用退出时停止Web服务器失败:', error)
    }
  }
})
