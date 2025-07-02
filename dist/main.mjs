#!/usr/bin/env node

// main.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, access } from "fs/promises";
import { constants } from "fs";
var NotebookServer = class {
  constructor() {
    this.server = new Server(
      {
        name: "notebook-rw",
        version: "0.1.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    this.setupToolHandlers();
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }
  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "read_notebook",
          description: "\u8BFB\u53D6Jupyter notebook\u6587\u4EF6\u5185\u5BB9",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook\u6587\u4EF6\u8DEF\u5F84"
              }
            },
            required: ["file_path"]
          }
        },
        {
          name: "write_notebook",
          description: "\u5199\u5165Jupyter notebook\u6587\u4EF6",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook\u6587\u4EF6\u8DEF\u5F84"
              },
              content: {
                type: "object",
                description: "notebook\u5185\u5BB9\uFF08JSON\u683C\u5F0F\uFF09"
              }
            },
            required: ["file_path", "content"]
          }
        },
        {
          name: "get_notebook_cells",
          description: "\u83B7\u53D6notebook\u4E2D\u7684\u6240\u6709cells",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook\u6587\u4EF6\u8DEF\u5F84"
              }
            },
            required: ["file_path"]
          }
        },
        {
          name: "update_notebook_cell",
          description: "\u66F4\u65B0notebook\u4E2D\u6307\u5B9A\u7684cell",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook\u6587\u4EF6\u8DEF\u5F84"
              },
              cell_index: {
                type: "number",
                description: "cell\u7D22\u5F15\uFF08\u4ECE0\u5F00\u59CB\uFF09"
              },
              cell_content: {
                type: "object",
                description: "\u65B0\u7684cell\u5185\u5BB9"
              }
            },
            required: ["file_path", "cell_index", "cell_content"]
          }
        },
        {
          name: "add_notebook_cell",
          description: "\u5411notebook\u6DFB\u52A0\u65B0\u7684cell",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook\u6587\u4EF6\u8DEF\u5F84"
              },
              cell: {
                type: "object",
                description: "\u8981\u6DFB\u52A0\u7684cell\u5185\u5BB9"
              },
              index: {
                type: "number",
                description: "\u63D2\u5165\u4F4D\u7F6E\uFF08\u53EF\u9009\uFF0C\u9ED8\u8BA4\u6DFB\u52A0\u5230\u672B\u5C3E\uFF09"
              }
            },
            required: ["file_path", "cell"]
          }
        },
        {
          name: "delete_notebook_cell",
          description: "\u5220\u9664notebook\u4E2D\u6307\u5B9A\u7684cell",
          inputSchema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "notebook\u6587\u4EF6\u8DEF\u5F84"
              },
              cell_index: {
                type: "number",
                description: "\u8981\u5220\u9664\u7684cell\u7D22\u5F15\uFF08\u4ECE0\u5F00\u59CB\uFF09"
              }
            },
            required: ["file_path", "cell_index"]
          }
        }
      ]
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (!args) {
        throw new McpError(ErrorCode.InvalidRequest, "\u7F3A\u5C11\u5FC5\u9700\u53C2\u6570");
      }
      try {
        switch (name) {
          case "read_notebook":
            return await this.readNotebook(args.file_path);
          case "write_notebook":
            return await this.writeNotebook(args.file_path, args.content);
          case "get_notebook_cells":
            return await this.getNotebookCells(args.file_path);
          case "update_notebook_cell":
            return await this.updateNotebookCell(
              args.file_path,
              args.cell_index,
              args.cell_content
            );
          case "add_notebook_cell":
            return await this.addNotebookCell(
              args.file_path,
              args.cell,
              args.index
            );
          case "delete_notebook_cell":
            return await this.deleteNotebookCell(
              args.file_path,
              args.cell_index
            );
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `\u672A\u77E5\u5DE5\u5177: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `\u5DE5\u5177\u6267\u884C\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }
  async fileExists(filePath) {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
  async readNotebook(filePath) {
    try {
      if (!await this.fileExists(filePath)) {
        throw new McpError(ErrorCode.InvalidRequest, `\u6587\u4EF6\u4E0D\u5B58\u5728: ${filePath}`);
      }
      const content = await readFile(filePath, "utf-8");
      const notebook = JSON.parse(content);
      return {
        content: [
          {
            type: "text",
            text: `\u6210\u529F\u8BFB\u53D6notebook: ${filePath}
\u683C\u5F0F\u7248\u672C: ${notebook.nbformat}.${notebook.nbformat_minor}
cells\u6570\u91CF: ${notebook.cells.length}
\u5185\u5BB9:
${JSON.stringify(notebook, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `\u8BFB\u53D6notebook\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async writeNotebook(filePath, content) {
    try {
      if (!content.cells || !Array.isArray(content.cells)) {
        throw new McpError(ErrorCode.InvalidRequest, "\u65E0\u6548\u7684notebook\u683C\u5F0F\uFF1A\u7F3A\u5C11cells\u6570\u7EC4");
      }
      if (!content.nbformat || !content.nbformat_minor) {
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
            text: `\u6210\u529F\u5199\u5165notebook: ${filePath}
cells\u6570\u91CF: ${content.cells.length}`
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `\u5199\u5165notebook\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async getNotebookCells(filePath) {
    try {
      if (!await this.fileExists(filePath)) {
        throw new McpError(ErrorCode.InvalidRequest, `\u6587\u4EF6\u4E0D\u5B58\u5728: ${filePath}`);
      }
      const content = await readFile(filePath, "utf-8");
      const notebook = JSON.parse(content);
      const cellsInfo = notebook.cells.map((cell, index) => ({
        index,
        type: cell.cell_type,
        source_length: cell.source.length,
        source_preview: cell.source.slice(0, 3).join("").substring(0, 100),
        has_outputs: cell.outputs && cell.outputs.length > 0,
        execution_count: cell.execution_count
      }));
      return {
        content: [
          {
            type: "text",
            text: `notebook ${filePath} \u7684cells\u4FE1\u606F:
\u603B\u8BA1 ${notebook.cells.length} \u4E2Acells

` + cellsInfo.map(
              (cell) => `Cell ${cell.index}: ${cell.type}
  \u9884\u89C8: ${cell.source_preview}${cell.source_preview.length >= 100 ? "..." : ""}
  \u6E90\u7801\u884C\u6570: ${cell.source_length}
  \u6267\u884C\u6B21\u6570: ${cell.execution_count || "N/A"}
  \u6709\u8F93\u51FA: ${cell.has_outputs ? "\u662F" : "\u5426"}
`
            ).join("\n")
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `\u83B7\u53D6cells\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async updateNotebookCell(filePath, cellIndex, cellContent) {
    try {
      if (!await this.fileExists(filePath)) {
        throw new McpError(ErrorCode.InvalidRequest, `\u6587\u4EF6\u4E0D\u5B58\u5728: ${filePath}`);
      }
      const content = await readFile(filePath, "utf-8");
      const notebook = JSON.parse(content);
      if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
        throw new McpError(ErrorCode.InvalidRequest, `cell\u7D22\u5F15\u8D85\u51FA\u8303\u56F4: ${cellIndex}`);
      }
      notebook.cells[cellIndex] = cellContent;
      const jsonContent = JSON.stringify(notebook, null, 2);
      await writeFile(filePath, jsonContent, "utf-8");
      return {
        content: [
          {
            type: "text",
            text: `\u6210\u529F\u66F4\u65B0cell ${cellIndex} in ${filePath}`
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `\u66F4\u65B0cell\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async addNotebookCell(filePath, cell, index) {
    try {
      if (!await this.fileExists(filePath)) {
        throw new McpError(ErrorCode.InvalidRequest, `\u6587\u4EF6\u4E0D\u5B58\u5728: ${filePath}`);
      }
      const content = await readFile(filePath, "utf-8");
      const notebook = JSON.parse(content);
      const insertIndex = index !== void 0 ? index : notebook.cells.length;
      if (insertIndex < 0 || insertIndex > notebook.cells.length) {
        throw new McpError(ErrorCode.InvalidRequest, `\u63D2\u5165\u4F4D\u7F6E\u8D85\u51FA\u8303\u56F4: ${insertIndex}`);
      }
      notebook.cells.splice(insertIndex, 0, cell);
      const jsonContent = JSON.stringify(notebook, null, 2);
      await writeFile(filePath, jsonContent, "utf-8");
      return {
        content: [
          {
            type: "text",
            text: `\u6210\u529F\u5728\u4F4D\u7F6E ${insertIndex} \u6DFB\u52A0\u65B0cell\u5230 ${filePath}`
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `\u6DFB\u52A0cell\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async deleteNotebookCell(filePath, cellIndex) {
    try {
      if (!await this.fileExists(filePath)) {
        throw new McpError(ErrorCode.InvalidRequest, `\u6587\u4EF6\u4E0D\u5B58\u5728: ${filePath}`);
      }
      const content = await readFile(filePath, "utf-8");
      const notebook = JSON.parse(content);
      if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
        throw new McpError(ErrorCode.InvalidRequest, `cell\u7D22\u5F15\u8D85\u51FA\u8303\u56F4: ${cellIndex}`);
      }
      const deletedCell = notebook.cells.splice(cellIndex, 1)[0];
      const jsonContent = JSON.stringify(notebook, null, 2);
      await writeFile(filePath, jsonContent, "utf-8");
      return {
        content: [
          {
            type: "text",
            text: `\u6210\u529F\u5220\u9664cell ${cellIndex} (${deletedCell.cell_type}) from ${filePath}`
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `\u5220\u9664cell\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Notebook R/W MCP\u670D\u52A1\u5668\u5DF2\u542F\u52A8");
  }
};
var server = new NotebookServer();
server.run().catch(console.error);
