# Notebook R/W MCP 服务器

一个用于读写 Jupyter notebook 文件的 MCP (Model Context Protocol) 服务器。

## 功能特性

- 📖 **读取 notebook**: 完整读取 Jupyter notebook 文件内容
- ✏️ **写入 notebook**: 创建或覆盖 notebook 文件
- 📋 **获取 cells 信息**: 查看 notebook 中所有 cells 的概览信息
- 🔄 **更新 cell**: 修改指定位置的 cell 内容
- ➕ **添加 cell**: 在指定位置插入新的 cell
- 🗑️ **删除 cell**: 删除指定位置的 cell

## 安装依赖

```bash
pnpm install
```

## 构建

```bash
pnpm build
```

## 运行

````bash
# 开发模式
pnpm dev

# 生产模式
node dist/main.mjs

## 使用

```bash
npx notebook2rw
````

```json
{
  "mcpServers": {
    "notebook-rw": {
      "command": "npx",
      "args": ["-y", "@taotao7/notebook2rw"]
    }
  }
}
```

## 支持的工具

### 1. read_notebook

读取完整的 notebook 文件内容

**参数:**

- `file_path` (string): notebook 文件路径

### 2. write_notebook

写入 notebook 文件

**参数:**

- `file_path` (string): notebook 文件路径
- `content` (object): notebook 内容（标准 Jupyter 格式）

### 3. get_notebook_cells

获取 notebook 中所有 cells 的信息概览

**参数:**

- `file_path` (string): notebook 文件路径

### 4. update_notebook_cell

更新指定 cell 的内容

**参数:**

- `file_path` (string): notebook 文件路径
- `cell_index` (number): cell 索引（从 0 开始）
- `cell_content` (object): 新的 cell 内容

### 5. add_notebook_cell

向 notebook 添加新的 cell

**参数:**

- `file_path` (string): notebook 文件路径
- `cell` (object): 要添加的 cell 内容
- `index` (number, 可选): 插入位置，默认添加到末尾

### 6. delete_notebook_cell

删除指定的 cell

**参数:**

- `file_path` (string): notebook 文件路径
- `cell_index` (number): 要删除的 cell 索引（从 0 开始）

## Cell 格式示例

### Code Cell

```json
{
  "cell_type": "code",
  "source": ["print('Hello, World!')", "x = 42"],
  "metadata": {},
  "execution_count": null,
  "outputs": []
}
```

### Markdown Cell

```json
{
  "cell_type": "markdown",
  "source": ["# 标题", "这是markdown内容"],
  "metadata": {}
}
```

### Raw Cell

```json
{
  "cell_type": "raw",
  "source": ["原始文本内容"],
  "metadata": {}
}
```

## Notebook 格式示例

```json
{
  "cells": [
    {
      "cell_type": "markdown",
      "source": ["# 我的Notebook"],
      "metadata": {}
    },
    {
      "cell_type": "code",
      "source": ["print('Hello!')"],
      "metadata": {},
      "execution_count": null,
      "outputs": []
    }
  ],
  "metadata": {
    "kernelspec": {
      "display_name": "Python 3",
      "language": "python",
      "name": "python3"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 5
}
```

## 使用注意事项

1. 确保 notebook 文件路径正确且可访问
2. 写入操作会覆盖现有文件，请谨慎使用
3. cell 索引从 0 开始计算
4. 建议在修改前先备份重要的 notebook 文件

## 错误处理

服务器会返回详细的错误信息，包括：

- 文件不存在
- 无效的 notebook 格式
- 索引超出范围
- 权限问题等

## 技术栈

- **TypeScript**: 主要编程语言
- **@modelcontextprotocol/sdk**: MCP 协议实现
- **Node.js**: 运行时环境
- **tsup**: 构建工具
