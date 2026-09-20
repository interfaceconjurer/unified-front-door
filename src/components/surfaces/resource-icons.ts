import { ChartIcon, CodeIcon, DatabaseIcon, GridIcon, LinkIcon, ShieldIcon, WorkflowIcon, type IconComponent } from "@/components/icons";
import { RESOURCE_TYPES, type ResourceType } from "@/lib/org-resources/model";

export const RESOURCE_ICONS = { Data: DatabaseIcon, Automation: WorkflowIcon, Access: ShieldIcon, Interface: GridIcon, Integration: LinkIcon, Code: CodeIcon, Analytics: ChartIcon } satisfies Record<(typeof RESOURCE_TYPES)[ResourceType]["group"], IconComponent>;
