#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
import path from "path";

interface NotebookCell {
  cell_type: "code" | "markdown" | "raw";
  source: string[];
  metadata?: Record<string, any>;
  execution_count?: number | null;
  outputs?: any[];
}

interface NotebookContent {
  cells: NotebookCell[];
  metadata: Record<string, any>;
  nbformat: number;
  nbformat_minor: number;
}

class NotebookServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "notebook-rw",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "read_notebook",
          description: "读取Jupyter notebook文件内容",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook文件路径",
              },
            },
            required: ["file_path"],
          },
        },
        {
          name: "write_notebook",
          description: "写入Jupyter notebook文件",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook文件路径",
              },
              content: {
                type: "object",
                description: "notebook内容（JSON格式）",
              },
            },
            required: ["file_path", "content"],
          },
        },
        {
          name: "get_notebook_cells",
          description: "获取notebook中的所有cells",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook文件路径",
              },
            },
            required: ["file_path"],
          },
        },
        {
          name: "update_notebook_cell",
          description: "更新notebook中指定的cell",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook文件路径",
              },
              cell_index: {
                type: "number",
                description: "cell索引（从0开始）",
              },
              cell_content: {
                type: "object",
                description: "新的cell内容",
              },
            },
            required: ["file_path", "cell_index", "cell_content"],
          },
        },
        {
          name: "add_notebook_cell",
          description: "向notebook添加新的cell",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook文件路径",
              },
              cell: {
                type: "object",
                description: "要添加的cell内容",
              },
              index: {
                type: "number",
                description: "插入位置（可选，默认添加到末尾）",
              },
            },
            required: ["file_path", "cell"],
          },
        },
        {
          name: "delete_notebook_cell",
          description: "删除notebook中指定的cell",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook文件路径",
              },
              cell_index: {
                type: "number",
                description: "要删除的cell索引（从0开始）",
              },
            },
            required: ["file_path", "cell_index"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        throw new McpError(ErrorCode.InvalidRequest, "缺少必需参数");
      }

      try {
        switch (name) {
          case "read_notebook":
            return await this.readNotebook(args.file_path as string);

          case "write_notebook":
            return await this.writeNotebook(args.file_path as string, args.content as NotebookContent);

          case "get_notebook_cells":
            return await this.getNotebookCells(args.file_path as string);

          case "update_notebook_cell":
            return await this.updateNotebookCell(
              args.file_path as string,
              args.cell_index as number,
              args.cell_content as NotebookCell
            );

          case "add_notebook_cell":
            return await this.addNotebookCell(
              args.file_path as string,
              args.cell as NotebookCell,
              args.index as number | undefined
            );

          case "delete_notebook_cell":
            return await this.deleteNotebookCell(
              args.file_path as string,
              args.cell_index as number
            );

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `未知工具: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `工具执行失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async readNotebook(filePath: string) {
    try {
      if (!(await this.fileExists(filePath))) {
        throw new McpError(ErrorCode.InvalidRequest, `文件不存在: ${filePath}`);
      }

      const content = await readFile(filePath, "utf-8");
      const notebook: NotebookContent = JSON.parse(content);

      return {
        content: [
          {
            type: "text",
            text: `成功读取notebook: ${filePath}\n` +
                  `格式版本: ${notebook.nbformat}.${notebook.nbformat_minor}\n` +
                  `cells数量: ${notebook.cells.length}\n` +
                  `内容:\n${JSON.stringify(notebook, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `读取notebook失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async writeNotebook(filePath: string, content: NotebookContent) {
    try {
      // 验证notebook格式
      if (!content.cells || !Array.isArray(content.cells)) {
        throw new McpError(ErrorCode.InvalidRequest, "无效的notebook格式：缺少cells数组");
      }

      if (!content.nbformat || !content.nbformat_minor) {
        // 设置默认格式版本
        content.nbformat = 4;
        content.nbformat_minor = 5;
      }

      if (!content.metadata) {
        content.metadata = {};
      }

      const jsonContent = JSON.stringify(content, null, 2);
      await writeFile(filePath, jsonContent, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: `成功写入notebook: ${filePath}\n` +
                  `cells数量: ${content.cells.length}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `写入notebook失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getNotebookCells(filePath: string) {
    try {
      if (!(await this.fileExists(filePath))) {
        throw new McpError(ErrorCode.InvalidRequest, `文件不存在: ${filePath}`);
      }

      const content = await readFile(filePath, "utf-8");
      const notebook: NotebookContent = JSON.parse(content);

      const cellsInfo = notebook.cells.map((cell, index) => ({
        index,
        type: cell.cell_type,
        source_length: cell.source.length,
        source_preview: cell.source.slice(0, 3).join("").substring(0, 100),
        has_outputs: cell.outputs && cell.outputs.length > 0,
        execution_count: cell.execution_count,
      }));

      return {
        content: [
          {
            type: "text",
            text: `notebook ${filePath} 的cells信息:\n` +
                  `总计 ${notebook.cells.length} 个cells\n\n` +
                  cellsInfo.map(cell => 
                    `Cell ${cell.index}: ${cell.type}\n` +
                    `  预览: ${cell.source_preview}${cell.source_preview.length >= 100 ? '...' : ''}\n` +
                    `  源码行数: ${cell.source_length}\n` +
                    `  执行次数: ${cell.execution_count || 'N/A'}\n` +
                    `  有输出: ${cell.has_outputs ? '是' : '否'}\n`
                  ).join('\n'),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `获取cells失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async updateNotebookCell(filePath: string, cellIndex: number, cellContent: NotebookCell) {
    try {
      if (!(await this.fileExists(filePath))) {
        throw new McpError(ErrorCode.InvalidRequest, `文件不存在: ${filePath}`);
      }

      const content = await readFile(filePath, "utf-8");
      const notebook: NotebookContent = JSON.parse(content);

      if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
        throw new McpError(ErrorCode.InvalidRequest, `cell索引超出范围: ${cellIndex}`);
      }

      notebook.cells[cellIndex] = cellContent;
      
      const jsonContent = JSON.stringify(notebook, null, 2);
      await writeFile(filePath, jsonContent, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: `成功更新cell ${cellIndex} in ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `更新cell失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async addNotebookCell(filePath: string, cell: NotebookCell, index?: number) {
    try {
      if (!(await this.fileExists(filePath))) {
        throw new McpError(ErrorCode.InvalidRequest, `文件不存在: ${filePath}`);
      }

      const content = await readFile(filePath, "utf-8");
      const notebook: NotebookContent = JSON.parse(content);

      const insertIndex = index !== undefined ? index : notebook.cells.length;
      
      if (insertIndex < 0 || insertIndex > notebook.cells.length) {
        throw new McpError(ErrorCode.InvalidRequest, `插入位置超出范围: ${insertIndex}`);
      }

      notebook.cells.splice(insertIndex, 0, cell);
      
      const jsonContent = JSON.stringify(notebook, null, 2);
      await writeFile(filePath, jsonContent, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: `成功在位置 ${insertIndex} 添加新cell到 ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `添加cell失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async deleteNotebookCell(filePath: string, cellIndex: number) {
    try {
      if (!(await this.fileExists(filePath))) {
        throw new McpError(ErrorCode.InvalidRequest, `文件不存在: ${filePath}`);
      }

      const content = await readFile(filePath, "utf-8");
      const notebook: NotebookContent = JSON.parse(content);

      if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
        throw new McpError(ErrorCode.InvalidRequest, `cell索引超出范围: ${cellIndex}`);
      }

      const deletedCell = notebook.cells.splice(cellIndex, 1)[0];
      
      const jsonContent = JSON.stringify(notebook, null, 2);
      await writeFile(filePath, jsonContent, "utf-8");

      return {
        content: [
          {
            type: "text",
            text: `成功删除cell ${cellIndex} (${deletedCell.cell_type}) from ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `删除cell失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Notebook R/W MCP服务器已启动");
  }
}

const server = new NotebookServer();
server.run().catch(console.error);
