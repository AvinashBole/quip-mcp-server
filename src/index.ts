#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

class QuipServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'quip-document-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'quip_read_document',
          description: 'Read the content of a Quip document by its thread ID',
          inputSchema: {
            type: 'object',
            properties: {
              threadId: {
                type: 'string',
                description: 'The Quip document thread ID'
              }
            },
            required: ['threadId'],
          },
        },
        {
          name: 'quip_append_content',
          description: 'Append content to an existing Quip document',
          inputSchema: {
            type: 'object',
            properties: {
              threadId: {
                type: 'string',
                description: 'The Quip document thread ID'
              },
              content: {
                type: 'string',
                description: 'Markdown content to append to the document'
              }
            },
            required: ['threadId', 'content'],
          },
        },
        {
          name: 'quip_prepend_content',
          description: 'Add content to the beginning of an existing Quip document',
          inputSchema: {
            type: 'object',
            properties: {
              threadId: {
                type: 'string',
                description: 'The Quip document thread ID'
              },
              content: {
                type: 'string',
                description: 'Markdown content to prepend to the document'
              }
            },
            required: ['threadId', 'content'],
          },
        },
        {
          name: 'quip_replace_content',
          description: 'Replace content in an existing Quip document',
          inputSchema: {
            type: 'object',
            properties: {
              threadId: {
                type: 'string',
                description: 'The Quip document thread ID'
              },
              content: {
                type: 'string',
                description: 'New markdown content to replace the document content'
              }
            },
            required: ['threadId', 'content'],
          },
        },
        {
          name: 'quip_create_document',
          description: 'Create a new Quip document',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Title of the new document'
              },
              content: {
                type: 'string',
                description: 'Initial markdown content for the document'
              }
            },
            required: ['title', 'content'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (!args) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Arguments are required'
          );
        }

        switch (name) {
          case 'quip_read_document': {
            const typedArgs = args as any;
            if (!typedArgs.threadId) {
              throw new McpError(ErrorCode.InvalidParams, 'threadId is required');
            }
            return await this.readDocument(String(typedArgs.threadId));
          }
          case 'quip_append_content': {
            const typedArgs = args as any;
            if (!typedArgs.threadId || !typedArgs.content) {
              throw new McpError(ErrorCode.InvalidParams, 'threadId and content are required');
            }
            return await this.editDocument(String(typedArgs.threadId), String(typedArgs.content), 'APPEND');
          }
          case 'quip_prepend_content': {
            const typedArgs = args as any;
            if (!typedArgs.threadId || !typedArgs.content) {
              throw new McpError(ErrorCode.InvalidParams, 'threadId and content are required');
            }
            return await this.editDocument(String(typedArgs.threadId), String(typedArgs.content), 'PREPEND');
          }
          case 'quip_replace_content': {
            const typedArgs = args as any;
            if (!typedArgs.threadId || !typedArgs.content) {
              throw new McpError(ErrorCode.InvalidParams, 'threadId and content are required');
            }
            return await this.editDocument(String(typedArgs.threadId), String(typedArgs.content), 'REPLACE');
          }
          case 'quip_create_document': {
            const typedArgs = args as any;
            if (!typedArgs.title || !typedArgs.content) {
              throw new McpError(ErrorCode.InvalidParams, 'title and content are required');
            }
            return await this.createDocument(String(typedArgs.title), String(typedArgs.content));
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.error('Error:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async readDocument(threadId: string) {
    try {
      console.log(`Reading document ${threadId}...`);
      
      // Execute the Python script to read the document
      const command = `python -u ${path.join(SCRIPTS_DIR, 'quip_edit.py')} ${threadId} read`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error(`Error reading document: ${stderr}`);
        throw new Error(stderr);
      }

      return {
        content: [
          {
            type: 'text',
            text: stdout || 'Document read successfully, but no content was returned',
          },
        ],
      };
    } catch (error) {
      console.error('Error reading document:', error);
      throw error;
    }
  }

  private async editDocument(threadId: string, content: string, operation: string) {
    try {
      console.log(`Editing document ${threadId} with operation ${operation}...`);
      
      // Create a temporary file to store the content
      const tempFilePath = `/tmp/quip_content_${Date.now()}.md`;
      const writeCommand = `echo "${content.replace(/"/g, '\\"')}" > ${tempFilePath}`;
      await execAsync(writeCommand);
      
      // Execute the Python script to edit the document
      const command = `python -u ${path.join(SCRIPTS_DIR, 'quip_edit.py')} ${threadId} ${operation.toLowerCase()} ${tempFilePath}`;
      const { stdout, stderr } = await execAsync(command);
      
      // Clean up the temporary file
      await execAsync(`rm ${tempFilePath}`);
      
      if (stderr) {
        console.error(`Error editing document: ${stderr}`);
        throw new Error(stderr);
      }

      return {
        content: [
          {
            type: 'text',
            text: stdout || `Successfully ${operation.toLowerCase()}ed content to document ${threadId}`,
          },
        ],
      };
    } catch (error) {
      console.error(`Error ${operation.toLowerCase()}ing document:`, error);
      throw error;
    }
  }

  private async createDocument(title: string, content: string) {
    try {
      console.log(`Creating document "${title}"...`);
      
      // Not implemented in the Python script yet
      return {
        content: [
          {
            type: 'text',
            text: `Document creation is not implemented in the current Python script. Please use the Quip web interface to create new documents.`,
          },
        ],
      };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Quip MCP server running on stdio');
  }
}

const server = new QuipServer();
server.run().catch(console.error);
