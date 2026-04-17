import { calculatorTool } from './calculator';
import { fileInfoTool } from './fileInfo';
import { listFilesTool } from './listFiles';
import { webSearchTool } from './webSearch';
import { fetchUrlTool } from './fetchUrl';
import { findFilesTool } from './findFiles';
import { writeFileTool } from './writeFile';
import { readFileTool } from './readFile';
import { editFileTool } from './editFile';
import { createDirTool } from './createDir';

export interface Tool {
  name: string;
  description: string;
  args: Record<string, string>;
  execute(args: Record<string, string>): Promise<string> | string;
}

const tools: Tool[] = [calculatorTool, fileInfoTool, listFilesTool, findFilesTool, readFileTool, writeFileTool, editFileTool, createDirTool, webSearchTool, fetchUrlTool];

const toolMap = new Map<string, Tool>(tools.map((t) => [t.name, t]));

export function getToolByName(name: string): Tool | undefined {
  return toolMap.get(name);
}

export function getToolNames(): string {
  return tools.map((t) => t.name).join(', ');
}

export function buildToolsDescription(): string {
  return tools
    .map((t) => {
      const argsStr = Object.entries(t.args).map(([k, v]) => `${k}(${v})`).join(', ');
      return `${t.name}: ${t.description} | args: ${argsStr}`;
    })
    .join('\n');
}
