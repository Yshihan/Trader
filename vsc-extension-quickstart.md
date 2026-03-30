# 潜心学习 - VSCode盯盘插件

这是一个VSCode扩展项目，用于在VSCode中实时查看股票信息。

## 快速开始

### 安装依赖
\`\`\`bash
npm install
\`\`\`

### 编译
\`\`\`bash
npm run compile
\`\`\`

### 调试
1. 在VSCode中打开此项目
2. 按 F5 启动调试模式
3. 会打开一个新的VSCode窗口，插件已加载

### 打包
\`\`\`bash
npm install -g @vscode/vsce
vsce package
\`\`\`

## 项目结构

\`\`\`
.
├── src/                    # 源代码
│   ├── extension.ts        # 插件入口
│   ├── StockPanel.ts       # WebView面板
│   ├── api/
│   │   └── stockApi.ts     # 股票数据API
│   ├── models/
│   │   └── stock.ts        # 数据模型
│   └── utils/
│       ├── storage.ts      # 本地存储
│       └── helper.ts       # 工具函数
├── resources/              # 资源文件
│   └── icon.svg           # 插件图标
├── package.json           # 插件配置
└── tsconfig.json          # TypeScript配置
\`\`\`

## 功能

- [x] 实时查看股票价格
- [x] 添加、删除股票信息
- [x] 模糊搜索添加
- [x] 拖拽排序
- [x] 置顶功能
- [x] 一键清空
- [x] 手动刷新

## API来源

使用新浪财经公开API获取股票数据。
