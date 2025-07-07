# ArtiMeow AI Writer

🖋️ 一个基于 Electron 的 AI 集成小说写作桌面应用程序

## 项目简介

ArtiMeow AI Writer 是一款专业的小说创作工具，集成了多种 AI 服务，支持手动编辑和 AI 辅助写作。它为作家提供了一个现代化、美观且功能丰富的写作环境。

## 主要特性

### ✨ 核心功能
- **双重编辑模式**: 支持手动编辑和 AI 辅助写作
- **多 AI 支持**: 集成 OpenAI、Claude、本地模型(llama.cpp)、Ollama 等
- **AI Agent 模式**: 自动章节生成，一键停止控制
- **项目管理**: 每个小说以独立项目文件夹存储
- **版本控制**: 内置 Git 支持，多设备协作
- **自定义 AI**: 可编辑系统提示词，一键恢复默认

### 🎨 界面特性
- **美观设计**: 现代化 UI，精美动画效果
- **主题支持**: 明暗主题切换
- **响应式布局**: 适配不同屏幕尺寸
- **实时统计**: 字数、章节、段落统计

### 🔧 技术特性
- **原生技术栈**: Electron + HTML/CSS/JavaScript (无框架依赖)
- **高性能**: 优化的编辑器体验
- **跨平台**: 支持 Windows、macOS、Linux
- **安全通信**: 安全的主进程与渲染进程通信

## 技术架构

```
ArtiMeow-AIWriter/
├── src/
│   ├── main.js              # Electron 主进程
│   ├── preload.js           # 预加载脚本
│   └── renderer/            # 渲染进程
│       ├── index.html       # 主界面
│       ├── css/             # 样式文件
│       │   ├── main.css     # 主样式
│       │   ├── editor.css   # 编辑器样式
│       │   └── animations.css # 动画样式
│       ├── js/              # JavaScript 模块
│       │   ├── app.js       # 主应用逻辑
│       │   ├── editor.js    # 编辑器功能
│       │   ├── ai.js        # AI 集成
│       │   ├── project.js   # 项目管理
│       │   ├── git.js       # Git 集成
│       │   └── settings.js  # 设置管理
│       └── assets/          # 静态资源
├── package.json
└── README.md
```

## 快速开始

### 环境要求
- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器
- Git (用于版本控制功能)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd ArtiMeow-AIWriter
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发模式**
   ```bash
   npm run dev
   ```

4. **构建生产版本**
   ```bash
   npm run build
   ```

### 可用脚本

- `npm start` - 启动应用程序
- `npm run dev` - 开发模式（自动重载）
- `npm run build` - 构建生产版本
- `npm run build:win` - 构建 Windows 版本
- `npm run build:mac` - 构建 macOS 版本
- `npm run build:linux` - 构建 Linux 版本

## 功能详解

### AI 集成

#### 支持的 AI 服务
- **OpenAI**: GPT-3.5, GPT-4 系列
- **Claude**: Claude-3 系列
- **本地模型**: 通过 llama.cpp 运行
- **Ollama**: 本地 AI 模型服务

#### AI 功能
- **文本生成**: 基于提示生成小说内容
- **文本改进**: 优化现有文本
- **续写功能**: 智能续写故事情节
- **Agent 模式**: 自动章节生成

### 项目管理

#### 项目结构
```
小说项目/
├── content.md           # 主要内容
├── metadata.json        # 项目元数据
├── outline.md          # 大纲文件
├── characters.md       # 人物设定
├── settings.md         # 世界观设定
└── .git/              # Git 版本控制
```

#### 功能特性
- 项目创建向导
- 自动保存功能
- 项目导出 (TXT, DOCX, PDF)
- 项目备份与恢复

### Git 版本控制

#### 支持功能
- 仓库初始化
- 文件暂存与提交
- 分支管理
- 远程仓库同步
- 提交历史查看

#### 协作特性
- 多设备同步
- 团队协作
- 冲突解决
- 版本回退

### 编辑器功能

#### 编辑特性
- 语法高亮
- 自动补全
- 查找替换
- 撤销重做
- 实时统计

#### 格式支持
- Markdown 语法
- 富文本格式
- 自定义样式
- 导出格式化

## 配置说明

### AI 配置

#### OpenAI 配置
```json
{
  "provider": "openai",
  "apiKey": "your-api-key",
  "model": "gpt-3.5-turbo",
  "baseUrl": "https://api.openai.com/v1",
  "temperature": 0.7,
  "maxTokens": 2000
}
```

#### 本地模型配置
```json
{
  "provider": "local",
  "modelPath": "/path/to/model",
  "contextLength": 4096,
  "temperature": 0.7
}
```

#### Ollama 配置
```json
{
  "provider": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "llama2",
  "temperature": 0.7
}
```

### 编辑器配置

```json
{
  "fontSize": 16,
  "fontFamily": "Microsoft YaHei",
  "lineHeight": 1.6,
  "theme": "light",
  "wordWrap": true,
  "autoSave": true,
  "autoSaveInterval": 30000
}
```

## 使用指南

### 创建新项目

1. 点击"新建项目"按钮
2. 填写项目信息（标题、描述、类型等）
3. 选择保存位置
4. 设置初始大纲（可选）
5. 点击"创建"完成

### AI 辅助写作

1. 在编辑器中输入初始内容
2. 选择文本或定位光标
3. 点击"AI 续写"或使用快捷键
4. 选择生成模式（续写、改进、重写）
5. 等待 AI 生成内容并插入

### 使用 Agent 模式

1. 准备好小说大纲
2. 点击"启动 Agent"按钮
3. 设置生成间隔（可选）
4. AI 将自动生成章节内容
5. 随时点击"停止 Agent"结束

### Git 版本控制

1. 在项目中初始化 Git
2. 配置用户信息（用户名、邮箱）
3. 添加远程仓库（可选）
4. 定期提交更改
5. 推送到远程仓库进行备份

## 常见问题

### Q: 如何配置 AI 服务？
A: 进入设置 → AI 配置，选择服务商并填写相应的 API 密钥或配置信息。

### Q: 项目文件存储在哪里？
A: 项目默认存储在用户文档目录下的 "ArtiMeow Projects" 文件夹中，可在设置中自定义。

### Q: 如何备份项目？
A: 使用内置的 Git 功能推送到远程仓库，或使用项目导出功能创建备份文件。

### Q: AI 生成速度很慢怎么办？
A: 检查网络连接，确认 API 密钥正确，或尝试使用本地模型。

### Q: 如何自定义 AI 写作风格？
A: 在设置中编辑系统提示词，可以指定写作风格、文体要求等。

## 开发指南

### 项目结构说明
- `src/main.js`: Electron 主进程，处理窗口管理、文件操作、AI 调用等
- `src/preload.js`: 安全地暴露主进程 API 给渲染进程
- `src/renderer/`: 前端界面和逻辑
- `src/renderer/js/`: JavaScript 模块，采用模块化设计

### 开发环境设置
1. 安装 Node.js 和 npm
2. 克隆项目并安装依赖
3. 使用 `npm run dev` 启动开发模式
4. 代码会自动重载，便于调试

### 打包构建

#### 开发环境准备
```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 生产模式启动
npm run start:prod
```

#### 构建发布版本

**Windows 用户：**
```bash
# 构建 Windows 版本
npm run build:win

# 或者运行批处理文件
.\build-windows.bat
```

**macOS 用户：**
```bash
# 构建 macOS 版本
npm run build:mac
```

**Linux 用户：**
```bash
# 构建 Linux 版本
npm run build:linux
```

**构建所有平台：**
```bash
# 构建所有平台版本
npm run build:all
```

#### 打包前检查
```bash
# 运行检查脚本（Windows）
.\check-build.bat

# 或者手动检查
npm list --depth=0
```

#### 打包配置说明

- **图标文件**: `src/icon/icon.ico` (Windows)
- **教程文件**: `tutorial/` 目录会被打包到 `resources/` 中
- **构建输出**: `dist/` 目录
- **平台特定配置**: 在 `package.json` 的 `build` 字段中

#### 构建输出说明

- **Windows**: `dist/ArtiMeow AI Writer Setup.exe` (安装程序)
- **macOS**: `dist/ArtiMeow AI Writer.dmg` (磁盘映像)
- **Linux**: `dist/ArtiMeow AI Writer.AppImage` (便携应用)

### 环境变量配置

项目支持以下环境变量：
- `NODE_ENV`: 环境模式 (development/production)
- 开发模式：启用开发者工具，关闭 webSecurity
- 生产模式：禁用开发者工具，启用 webSecurity

### 贡献指南
1. Fork 项目
2. 创建功能分支
3. 提交代码并创建 Pull Request
4. 等待代码审查和合并

## 支持与反馈

- 🐛 [问题反馈](https://github.com/B5-Software/ArtiMeow-AIWriter/issues)
- 💡 [功能建议](https://github.com/ArtiMeow-AIWriter/discussions)
- 📧 [联系邮箱](mailto:b5-software@autistici.org)

---

**ArtiMeow AI Writer** - 让 AI 成为您的创作伙伴 🐱✨
