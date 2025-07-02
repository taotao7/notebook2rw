# MCP 配置指南 - 在 AI 应用中使用 Notebook 服务器

本指南将帮助你在 Claude Desktop、Cursor 等 AI 应用中配置 notebook 读写 MCP 服务器。

## 📋 前提条件

1. 确保项目已构建：

   ```bash
   pnpm build
   ```

2. 验证服务器可以正常运行：
   ```bash
   node dist/main.mjs
   ```

## 🔧 Claude Desktop 配置

### macOS 配置

1. **找到 Claude Desktop 配置文件**：

   ```bash
   # 配置文件路径
   ~/Library/Application Support/Claude/claude_desktop_config.json
   ```

2. **编辑配置文件**：

   ```json
   {
     "mcpServers": {
       "notebook-rw": {
         "command": "node",
         "args": ["dist/main.mjs"],
         "cwd": "/Users/tao/workspace/notebook2rw",
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

3. **重启 Claude Desktop**以加载配置。

### Windows 配置

1. **配置文件路径**：

   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

2. **配置内容**（注意路径格式）：
   ```json
   {
     "mcpServers": {
       "notebook-rw": {
         "command": "node",
         "args": ["dist/main.mjs"],
         "cwd": "C:\\Users\\YourName\\workspace\\notebook2rw",
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

### Linux 配置

1. **配置文件路径**：

   ```bash
   ~/.config/Claude/claude_desktop_config.json
   ```

2. **配置内容**：
   ```json
   {
     "mcpServers": {
       "notebook-rw": {
         "command": "node",
         "args": ["dist/main.mjs"],
         "cwd": "/home/username/workspace/notebook2rw",
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

## 🎯 其他 AI 应用配置

### Cursor 配置

如果 Cursor 支持 MCP（检查最新版本），配置方法类似：

1. **在 Cursor 设置中找到 MCP 配置选项**
2. **添加服务器配置**：
   ```json
   {
     "name": "notebook-rw",
     "command": "node",
     "args": ["dist/main.mjs"],
     "cwd": "/path/to/your/notebook2rw"
   }
   ```

### 通用 MCP 客户端配置

对于任何支持 MCP 的应用：

```json
{
  "servers": {
    "notebook-rw": {
      "command": "node",
      "args": ["dist/main.mjs"],
      "cwd": "/path/to/notebook2rw",
      "capabilities": ["tools"]
    }
  }
}
```

## 🚀 启动脚本配置

为了更好的管理，你可以创建启动脚本：

### macOS/Linux 启动脚本

创建 `start-mcp.sh`：

```bash
#!/bin/bash
cd /Users/tao/workspace/notebook2rw
node dist/main.mjs
```

然后在 MCP 配置中使用：

```json
{
  "mcpServers": {
    "notebook-rw": {
      "command": "/Users/tao/workspace/notebook2rw/start-mcp.sh",
      "args": []
    }
  }
}
```

### Windows 启动脚本

创建 `start-mcp.bat`：

```batch
@echo off
cd /d C:\Users\YourName\workspace\notebook2rw
node dist/main.mjs
```

配置：

```json
{
  "mcpServers": {
    "notebook-rw": {
      "command": "C:\\Users\\YourName\\workspace\\notebook2rw\\start-mcp.bat",
      "args": []
    }
  }
}
```

## 🔍 验证配置

### 1. 检查 MCP 服务器状态

在 AI 应用中，你应该能看到以下可用工具：

- `read_notebook`
- `write_notebook`
- `get_notebook_cells`
- `update_notebook_cell`
- `add_notebook_cell`
- `delete_notebook_cell`

### 2. 测试基本功能

尝试在 AI 应用中执行：

```
请使用read_notebook工具读取test-notebook.ipynb文件
```

### 3. 检查工具列表

询问 AI：

```
显示当前可用的MCP工具
```

## 🛠️ 故障排查

### 常见问题及解决方案

#### 1. 服务器无法启动

**问题**：AI 应用报告无法连接到 MCP 服务器

**解决方案**：

- 检查 Node.js 是否已安装：`node --version`
- 确认项目已构建：`pnpm build`
- 检查路径是否正确
- 查看错误日志

#### 2. 权限问题

**问题**：无法访问 notebook 文件

**解决方案**：

- 确保 MCP 服务器对目标文件夹有读写权限
- 检查文件路径是否正确
- 在 macOS 上可能需要授予应用文件访问权限

#### 3. 配置文件格式错误

**问题**：配置文件解析失败

**解决方案**：

- 验证 JSON 格式是否正确
- 检查路径中的反斜杠转义（Windows）
- 确保没有尾随逗号

#### 4. 环境变量问题

**问题**：Node.js 找不到模块

**解决方案**：

```json
{
  "mcpServers": {
    "notebook-rw": {
      "command": "node",
      "args": ["dist/main.mjs"],
      "cwd": "/path/to/notebook2rw",
      "env": {
        "NODE_ENV": "production",
        "PATH": "/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

### 调试技巧

1. **启用详细日志**：

   ```json
   {
     "env": {
       "DEBUG": "mcp:*"
     }
   }
   ```

2. **手动测试服务器**：

   ```bash
   cd /path/to/notebook2rw
   node dist/main.mjs
   # 应该看到 "Notebook R/W MCP服务器已启动"
   ```

3. **检查配置文件语法**：
   ```bash
   # 使用jq验证JSON格式
   jq . claude_desktop_config.json
   ```

## 📝 使用示例

配置完成后，你可以在 AI 对话中使用以下命令：

```
# 读取notebook
请读取我的test-notebook.ipynb文件内容

# 获取cells信息
显示test-notebook.ipynb中所有cells的概览

# 添加新cell
在test-notebook.ipynb末尾添加一个新的代码cell，内容是打印当前时间

# 更新cell
更新test-notebook.ipynb的第一个cell，改为更详细的说明

# 创建新notebook
创建一个名为data-analysis.ipynb的新notebook，包含数据分析的基本结构
```

## 🔄 更新和维护

### 更新 MCP 服务器

1. 拉取最新代码
2. 重新构建：`pnpm build`
3. 重启 AI 应用

### 添加新功能

1. 修改 `main.ts`
2. 更新工具定义
3. 重新构建和部署

## 💡 高级配置

### 多个 notebook 目录

如果你有多个 notebook 项目，可以配置多个 MCP 服务器实例：

```json
{
  "mcpServers": {
    "notebook-project1": {
      "command": "node",
      "args": ["dist/main.mjs"],
      "cwd": "/path/to/project1"
    },
    "notebook-project2": {
      "command": "node",
      "args": ["dist/main.mjs"],
      "cwd": "/path/to/project2"
    }
  }
}
```

### 自定义环境变量

```json
{
  "mcpServers": {
    "notebook-rw": {
      "command": "node",
      "args": ["dist/main.mjs"],
      "cwd": "/path/to/notebook2rw",
      "env": {
        "NODE_ENV": "production",
        "NOTEBOOK_BASE_PATH": "/path/to/notebooks",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

通过以上配置，你就可以在支持 MCP 的 AI 应用中使用这个强大的 notebook 读写服务器了！🎉
