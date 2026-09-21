/** Planning intent, not a claim that a runtime or repository has been provisioned. */
export const PROJECT_TEMPLATES = [
  { id: "standard", label: "Standard", description: "A flexible starting point for any project.", guidance: "Define the outcome, who it helps, and the smallest useful first step.", goal: "What will change when this project succeeds?" },
  { id: "react", label: "React app", description: "A web application built with React.", guidance: "Describe your users, their main journey, and the data the app needs. Note any hosting or sign-in requirements.", goal: "What should people be able to do in this app?" },
  { id: "mobile", label: "Mobile app", description: "An experience for phones and tablets.", guidance: "Name the target devices and platforms. Consider offline use, notifications, and access to device features.", goal: "What task should this app make easier on the go?" },
  { id: "agent", label: "Agent", description: "An assistant that helps get work done.", guidance: "Describe the agent’s job, the knowledge and tools it needs, and which actions require a person’s approval.", goal: "What outcome should the agent help someone achieve?" },
  { id: "lwc-apex", label: "LWC & Apex", description: "Salesforce components and business logic.", guidance: "Describe the user workflow, affected objects, and permissions. Include the org and how you will validate the change.", goal: "What Salesforce workflow should this project improve?" },
  { id: "analytics", label: "Analytics", description: "Metrics, datasets, and actionable insights.", guidance: "Name the decisions this will support, the metrics that matter, and the available data sources and refresh needs.", goal: "What question should your analysis answer?" },
  { id: "tableau", label: "Tableau", description: "Visual analysis and interactive dashboards.", guidance: "Describe the dashboard’s audience, the decisions they make, and how they should explore the data.", goal: "What should your audience understand or act on?" },
  { id: "mulesoft", label: "MuleSoft", description: "APIs and integrations between systems.", guidance: "Name the systems, the data moving between them, and the triggers. Include authentication, error handling, and volume expectations.", goal: "What process should this integration connect or automate?" },
] as const;

export type ProjectType = typeof PROJECT_TEMPLATES[number]["id"];
export type ProjectIntent = { projectType?: ProjectType; context?: string };
export const PROJECT_CONTEXT_LIMIT = 6000;
export function isProjectType(value: unknown): value is ProjectType {
  return PROJECT_TEMPLATES.some(template => template.id === value);
}
export function projectTemplate(value: unknown) {
  return PROJECT_TEMPLATES.find(template => template.id === value) ?? PROJECT_TEMPLATES[0];
}
