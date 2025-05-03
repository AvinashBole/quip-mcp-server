[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/avinashbole-quip-mcp-server-badge.png)](https://mseep.ai/app/avinashbole-quip-mcp-server)

# Quip MCP Server

A Model Context Protocol (MCP) server for Quip document operations that enables direct interaction with Quip documents from AI assistants like Claude.

## Features

- **Read Documents**: Fetch and display Quip document content by ID
- **Append Content**: Add content to the end of existing documents
- **Prepend Content**: Add content to the beginning of documents
- **Replace Content**: Update document content
- **Create Documents**: Intended support for creating new documents (currently redirects to web interface)

## How It Works

This MCP server acts as a bridge between Claude and Quip documents. It works by:

1. Receiving requests from Claude through the MCP protocol
2. Executing a Python script (`quip_edit_fixed.py`) with the appropriate parameters
3. Returning the results back to Claude

## Prerequisites

- Node.js v18 or higher
- TypeScript
- Python with `quip` library installed
- A valid Quip access token

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/AvinashBole/quip-mcp-server.git
   cd quip-mcp-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the project:
   ```
   npm run build
   ```

4. Configure your MCP settings:
   ```json
   {
     "mcpServers": {
       "quip": {
         "command": "node",
         "args": ["path/to/quip-server/build/index.js"],
         "env": {
           "QUIP_ACCESS_TOKEN": "your-quip-access-token",
           "QUIP_BASE_URL": "https://platform.quip.com"
         },
         "disabled": false,
         "autoApprove": []
       }
     }
   }
   ```

## Usage

Once connected, the following MCP tools become available to Claude:

- `quip_read_document`: Read a Quip document by its thread ID
- `quip_append_content`: Append content to a document
- `quip_prepend_content`: Add content to the beginning of a document
- `quip_replace_content`: Replace document content
- `quip_create_document`: Create a new document (currently unsupported)

Example usage in Claude:

```
<use_mcp_tool>
<server_name>quip</server_name>
<tool_name>quip_read_document</tool_name>
<arguments>
{
  "threadId": "YOUR_DOCUMENT_ID"
}
</arguments>
</use_mcp_tool>
```

## Python Script Integration

The server expects a Python script called `quip_edit_fixed.py` in the path specified by the `PYTHON_SCRIPT_PATH` constant. This script should support the following operations:

- `read`: Read document content
- `append`: Add content to the end of a document
- `prepend`: Add content to the beginning of a document 
- `replace`: Update document content

## License

ISC License

## Author

AvinashBole
