import { SkillArgument, SkillDefinition, SkillScope } from '../core/types.js';

export function parseSkillMarkdown(
  content: string,
  idOrPath: string,
  scope: SkillScope | string = 'built-in',
  pathLocation?: string,
): SkillDefinition {
  let id = idOrPath;
  const location = pathLocation || (idOrPath.includes('/') ? idOrPath : undefined);
  if (id.includes('/')) {
    const parts = id.split('/');
    id = parts[parts.length - 2] || parts[parts.length - 1].replace(/\.md$/, '');
  }
  let name = id;
  let description = '';
  let version: string | undefined;
  let instructions = content;
  const args: SkillArgument[] = [];
  const allowedTools: string[] = [];
  const suggestedPrompts: string[] = [];

  const trimmed = content.trim();
  if (trimmed.startsWith('---')) {
    const secondDelim = trimmed.indexOf('---', 3);
    if (secondDelim !== -1) {
      const frontmatter = trimmed.slice(3, secondDelim).trim();
      instructions = trimmed.slice(secondDelim + 3).trim();

      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
          continue;
        }
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');

        if (key === 'name') {
          name = val;
        } else if (key === 'description') {
          description = val;
        } else if (key === 'version') {
          version = val;
        } else if (key === 'tools' || key === 'allowedtools') {
          val.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => allowedTools.push(t));
        }
      }
    }
  }

  const argMatch = instructions.match(/##\s+Arguments\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (argMatch && argMatch[1]) {
    const argLines = argMatch[1].split('\n');
    for (const line of argLines) {
      const match = line.match(/^[-*]\s*`?([a-zA-Z0-9_-]+)`?\s*:\s*(.*)$/);
      if (match) {
        args.push({
          name: match[1],
          description: match[2].trim(),
          required: match[2].toLowerCase().includes('required'),
        });
      }
    }
  }

  const promptMatch = instructions.match(/##\s+(?:Examples|Prompts|Suggested Prompts)\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (promptMatch && promptMatch[1]) {
    const pLines = promptMatch[1].split('\n');
    for (const line of pLines) {
      const match = line.match(/^[-*]\s*["`]?([^"`\n]+)["`]?$/);
      if (match) {
        suggestedPrompts.push(match[1].trim());
      }
    }
  }

  if (!description) {
    const firstParagraph = instructions.split('\n\n')[0] || '';
    description = firstParagraph.replace(/^#+\s*.*?\n/, '').trim().slice(0, 140);
  }

  const normalizedScope: SkillScope = scope === 'workspace' ? 'project' : (scope as SkillScope);

  return {
    id,
    name,
    description: description || 'Autonomous workflow skill',
    instructions,
    scope: normalizedScope,
    source: String(scope),
    location,
    version,
    path: location,
    arguments: args.length > 0 ? args : undefined,
    allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
    suggestedPrompts: suggestedPrompts.length > 0 ? suggestedPrompts : undefined,
  };
}
