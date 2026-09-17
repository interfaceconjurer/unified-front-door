export const STARTER_PROMPTS = [
  "Help me start my first project. Walk me through defining its goal, creating and prioritizing work items, and choosing the first task to work on.",
  "Help me build an agent that qualifies and routes leads. Walk me through defining its instructions, connecting data, and trying it out.",
  "Help me build a React app for browsing and searching Salesforce accounts. Walk me through the app structure, connecting Salesforce data, and adding tests.",
  "Help me set up my first release pipeline. Walk me through connecting a repository, validating changes in a sandbox, and adding a production approval step.",
] as const;
export const EXISTING_PROJECT_PROMPT = "Help me get started with an existing Salesforce source project. Walk me through connecting my repository and a development org, then exploring the codebase.";
export function isStarterPrompt(value: string): boolean { return STARTER_PROMPTS.some(prompt => prompt === value) || value === EXISTING_PROJECT_PROMPT; }
