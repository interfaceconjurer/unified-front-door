import { resourceKey, type OrgResource, type ResourceIdentity, type ResourceReference, type ResourceType } from "./model";

// Captured demo metadata only. Org membership is explicit, independent of the
// selected project, and never implies access to a live Salesforce connection.
const SALES_ORGS = ["prod", "uat", "sit", "scratch-lead"];
const ALL_ORGS = [...SALES_ORGS, "acme-devhub"];
type Template = Omit<OrgResource, "orgId"> & { orgIds: readonly string[] };
type Details = Partial<Pick<Template, "status" | "facts" | "section" | "code" | "related" | "orgIds">>;
const ref = (resourceType: ResourceType, apiName: string): ResourceReference => ({ resourceType, apiName });
const facts = (...pairs: [string, string][]) => pairs.map(([label, value]) => ({ label, value }));
const fields = (rows: string[][]) => ({ title: "Fields", columns: ["Field", "API name", "Type"], rows });
function resource(resourceType: ResourceType, apiName: string, label: string, summary: string, details: Details = {}): Template {
  return { resourceType, apiName, label, summary, status: "Available", facts: [], related: [], orgIds: SALES_ORGS, ...details };
}

const CATALOG: readonly Template[] = [
  resource("org-feature", "ExperienceCloud", "Experience Cloud", "Review the configuration for customer and partner experiences in this org.", {
    status: "Not enabled", facts: facts(["Scope", "Org-wide"], ["Configuration", "Not started"]),
    section: { title: "Configuration review", columns: ["Step", "What to review"], rows: [["Define the experience", "Audience, access, and the site you want to create"], ["Check availability", "Confirm availability and requirements in the connected org"], ["Review enablement", "Org-wide configuration needs an explicit review before changes are applied"]] },
  }),
  resource("org-feature", "EnhancedNotes", "Enhanced Notes", "Review the notes experience available to teams working with customer records.", {
    status: "Enabled", facts: facts(["Scope", "Org-wide"], ["Configuration", "Enabled in this demo snapshot"]), related: [ref("standard-object", "Account")],
  }),
  resource("org-feature", "DuplicateManagement", "Duplicate Management", "Review how this org identifies and handles duplicate customer records.", {
    status: "Enabled", facts: facts(["Scope", "Org-wide"], ["Configuration", "Enabled in this demo snapshot"]), related: [ref("standard-object", "Account"), ref("standard-object", "Contact")],
  }),
  resource("standard-object", "Account", "Account", "Companies and organizations your teams do business with.", {
    facts: facts(["Record name", "Account Name"], ["Sharing model", "Public Read Only"], ["Track activities", "Enabled"]),
    section: fields([["Account name", "Name", "Text"], ["Industry", "Industry", "Picklist"], ["Annual revenue", "AnnualRevenue", "Currency"], ["Customer tier", "Customer_Tier__c", "Picklist"], ["Account owner", "OwnerId", "Lookup · User"]]),
    related: [ref("custom-field", "Account.Customer_Tier__c"), ref("page-layout", "Account.Account_Layout"), ref("standard-object", "Contact")],
  }),
  resource("standard-object", "Contact", "Contact", "People associated with your customer and partner accounts.", {
    orgIds: ALL_ORGS, facts: facts(["Record name", "Full Name"], ["Sharing model", "Controlled by Parent"]),
    section: fields([["First name", "FirstName", "Text"], ["Last name", "LastName", "Text"], ["Email", "Email", "Email"], ["Account", "AccountId", "Lookup · Account"]]), related: [ref("standard-object", "Account")],
  }),
  resource("standard-object", "Lead", "Lead", "Prospective customers, qualification details, and routing ownership.", {
    facts: facts(["Record name", "Full Name"], ["Sharing model", "Private"]),
    section: fields([["Full name", "Name", "Name"], ["Company", "Company", "Text"], ["Status", "Status", "Picklist"], ["Lead source", "LeadSource", "Picklist"], ["Owner", "OwnerId", "Lookup · User or Queue"]]),
    related: [ref("flow", "Lead_Routing"), ref("queue", "Inbound_Leads"), ref("apex-class", "LeadRoutingService")],
  }),
  resource("standard-object", "Opportunity", "Opportunity", "Sales opportunities, stages, amounts, and close dates.", {
    facts: facts(["Sharing model", "Private"], ["Track history", "Enabled"]),
    section: fields([["Opportunity name", "Name", "Text"], ["Stage", "StageName", "Picklist"], ["Amount", "Amount", "Currency"], ["Close date", "CloseDate", "Date"], ["Account", "AccountId", "Lookup · Account"]]),
    related: [ref("validation-rule", "Opportunity.Require_Close_Reason"), ref("record-type", "Opportunity.Enterprise"), ref("apex-trigger", "OpportunityTrigger")],
  }),
  resource("standard-object", "Case", "Case", "Customer support requests, priority, ownership, and resolution.", {
    facts: facts(["Record name", "Case Number"], ["Sharing model", "Private"]),
    section: fields([["Case number", "CaseNumber", "Auto Number"], ["Subject", "Subject", "Text"], ["Status", "Status", "Picklist"], ["Priority", "Priority", "Picklist"]]), related: [ref("flow", "Case_Escalation")],
  }),
  resource("custom-object", "Project__c", "Project", "Track customer delivery projects and their account relationships.", {
    facts: facts(["Record name", "Project Name"], ["Deployment status", "Deployed"], ["Sharing model", "Private"]),
    section: fields([["Project name", "Name", "Text"], ["Account", "Account__c", "Lookup · Account"], ["Status", "Status__c", "Picklist"], ["Target date", "Target_Date__c", "Date"]]), related: [ref("standard-object", "Account"), ref("permission-set", "Project_Manager")],
  }),
  resource("custom-object", "Release_Checklist__c", "Release Checklist", "Sandbox release checks and deployment sign-off.", {
    orgIds: ["uat", "sit"], status: "In development", facts: facts(["Deployment status", "In Development"], ["Record name", "Checklist Number"]),
    section: fields([["Checklist number", "Name", "Auto Number"], ["Approved", "Approved__c", "Checkbox"], ["Release date", "Release_Date__c", "Date"]]), related: [ref("permission-set", "Release_Manager")],
  }),
  resource("custom-field", "Account.Customer_Tier__c", "Customer Tier", "Segment accounts by service tier and customer value.", {
    facts: facts(["Object", "Account"], ["Field type", "Picklist"], ["Required", "No"]), section: { title: "Picklist values", columns: ["Label", "API value", "Default"], rows: [["Standard", "Standard", "Yes"], ["Growth", "Growth", "No"], ["Enterprise", "Enterprise", "No"]] }, related: [ref("standard-object", "Account")],
  }),
  resource("flow", "Lead_Routing", "Lead Routing", "Assign incoming leads by region and territory, with a queue fallback.", {
    status: "Active", facts: facts(["Flow type", "Record-triggered flow"], ["Trigger", "Lead · created or updated"], ["Version", "3"]),
    section: { title: "Flow steps", columns: ["Step", "Element", "Purpose"], rows: [["1", "Start", "A lead is created or its region changes"], ["2", "Get territory", "Find an active territory assignment"], ["3", "Decision", "Check whether an owner is available"], ["4", "Update records", "Assign the lead to its owner or fallback queue"]] },
    related: [ref("standard-object", "Lead"), ref("queue", "Inbound_Leads"), ref("custom-metadata", "Territory_Routing__mdt")],
  }),
  resource("flow", "Case_Escalation", "Case Escalation", "Escalate high-priority support cases that need attention.", {
    status: "Active", facts: facts(["Flow type", "Record-triggered flow"], ["Trigger", "Case · updated"], ["Version", "2"]), related: [ref("standard-object", "Case")],
  }),
  resource("flow", "New_Customer_Onboarding", "New Customer Onboarding", "Guide account teams through welcoming a new customer.", {
    status: "Draft", orgIds: ["uat", "sit", "scratch-lead"], facts: facts(["Flow type", "Screen flow"], ["Version", "1"]), related: [ref("standard-object", "Account"), ref("standard-object", "Contact")],
  }),
  resource("permission-set", "Sales_Operations", "Sales Operations", "Access to sales objects, lead routing, and operational reports.", {
    facts: facts(["License", "Salesforce"], ["Assigned users", "18"]),
    section: { title: "Object permissions", columns: ["Object", "Read", "Create", "Edit", "Delete"], rows: [["Account", "Yes", "Yes", "Yes", "No"], ["Lead", "Yes", "Yes", "Yes", "No"], ["Opportunity", "Yes", "Yes", "Yes", "No"]] },
    related: [ref("standard-object", "Lead"), ref("standard-object", "Opportunity"), ref("permission-set-group", "Sales_Team")],
  }),
  resource("permission-set", "Project_Manager", "Project Manager", "Manage delivery projects and view their customer accounts.", { facts: facts(["License", "Salesforce"], ["Assigned users", "8"]), related: [ref("custom-object", "Project__c")] }),
  resource("permission-set", "Release_Manager", "Release Manager", "Review release checklists and approve changes in a sandbox.", { orgIds: ["uat", "sit"], facts: facts(["Assigned users", "4"]), related: [ref("custom-object", "Release_Checklist__c")] }),
  resource("permission-set-group", "Service_Reps", "Service Reps", "Case access for the service team, including each user's additional permissions.", {
    facts: facts(["Members", "6"], ["Baseline Case access", "Read, Create, Edit"], ["Profile", "Minimum Access"], ["Role policy", "Service representatives do not delete Cases"]),
    related: [ref("permission-set", "Case_Management"), ref("permission-set", "Case_Delete")],
  }),
  resource("permission-set", "Case_Management", "Case Management", "Read, create and edit Cases for the service team.", { facts: facts(["Object", "Case"], ["Permissions", "Read, Create, Edit"]), related: [ref("permission-set-group", "Service_Reps")] }),
  resource("permission-set", "Case_Delete", "Case Delete", "Additional Case deletion access assigned directly to individual users.", { facts: facts(["Object", "Case"], ["Permissions", "Read, Delete"], ["Direct assignments", "6"]), related: [ref("permission-set-group", "Service_Reps")] }),
  resource("permission-set-group", "Sales_Team", "Sales Team", "A reusable collection of access for sales representatives.", { facts: facts(["Permission sets", "Sales Operations"], ["Status", "Updated"]), related: [ref("permission-set", "Sales_Operations")] }),
  resource("custom-permission", "Bypass_Lead_Routing", "Bypass Lead Routing", "Allow authorized operators to bypass automatic lead assignment.", { facts: facts(["Used by", "Lead Routing"]), related: [ref("flow", "Lead_Routing")] }),
  resource("profile", "Sales_User", "Sales User", "Baseline login, app, and object access for the sales team.", { facts: facts(["User license", "Salesforce"], ["Profile type", "Custom"], ["Default app", "Sales"]), related: [ref("permission-set-group", "Sales_Team")] }),
  resource("role", "Regional_Sales_Manager", "Regional Sales Manager", "Role hierarchy access for regional sales leadership.", { facts: facts(["Reports to", "VP of Sales"], ["Opportunity access", "Edit"]), related: [ref("sharing-rule", "Account.Regional_Account_Access")] }),
  resource("queue", "Inbound_Leads", "Inbound Leads", "Fallback ownership for leads awaiting territory assignment.", { facts: facts(["Supported object", "Lead"], ["Queue members", "Sales Operations team"]), related: [ref("standard-object", "Lead"), ref("flow", "Lead_Routing")] }),
  resource("validation-rule", "Opportunity.Require_Close_Reason", "Require Close Reason", "Require a reason when an opportunity is marked Closed Lost.", { status: "Active", facts: facts(["Object", "Opportunity"], ["Error location", "Close Reason"]), code: 'AND(\n  ISPICKVAL(StageName, "Closed Lost"),\n  ISBLANK(Close_Reason__c)\n)', related: [ref("standard-object", "Opportunity")] }),
  resource("record-type", "Opportunity.Enterprise", "Enterprise Opportunity", "Sales stages and layouts for enterprise opportunities.", { status: "Active", facts: facts(["Object", "Opportunity"], ["Sales process", "Enterprise Sales"]), related: [ref("standard-object", "Opportunity")] }),
  resource("page-layout", "Account.Account_Layout", "Account Layout", "Arrange account details, contacts, and related opportunities.", { facts: facts(["Object", "Account"], ["Sections", "Account details, Address, Related records"]), related: [ref("standard-object", "Account"), ref("lightning-page", "Account_Record_Page")] }),
  resource("lightning-page", "Account_Record_Page", "Account Record Page", "The Lightning record experience for customer accounts.", { facts: facts(["Page type", "Record page"], ["Object", "Account"], ["Template", "Header and right sidebar"]), related: [ref("page-layout", "Account.Account_Layout"), ref("lightning-component", "accountHealth")] }),
  resource("custom-metadata", "Territory_Routing__mdt", "Territory Routing", "Configuration used to assign incoming leads to territories.", { facts: facts(["Visibility", "Public"]), section: fields([["Region", "Region__c", "Text"], ["Queue developer name", "Queue_Name__c", "Text"], ["Enabled", "Enabled__c", "Checkbox"]]), related: [ref("flow", "Lead_Routing")] }),
  resource("custom-label", "Customer_Welcome_Message", "Customer Welcome Message", "Reusable welcome copy for customer-facing experiences.", { facts: facts(["Language", "English"], ["Value", "Welcome to your customer workspace."]) }),
  resource("static-resource", "Brand_Assets", "Brand Assets", "Shared logos and icons for custom Lightning experiences.", { facts: facts(["Content type", "application/zip"], ["Cache control", "Public"]), related: [ref("lightning-component", "accountHealth")] }),
  resource("named-credential", "ERP_Integration", "ERP Integration", "Connection settings for the account synchronization service.", { facts: facts(["Endpoint", "https://erp.example.com"], ["Authentication", "External credential"], ["Credentials", "Not included in demo metadata"]) }),
  resource("connected-app", "Data_Warehouse_Sync", "Data Warehouse Sync", "OAuth application used by the reporting data integration.", { facts: facts(["OAuth scopes", "Access and manage your data"], ["Permitted users", "Admin approved users"]), related: [ref("permission-set", "Sales_Operations")] }),
  resource("apex-class", "LeadRoutingService", "Lead Routing Service", "Apex service for resolving territory ownership for leads.", { facts: facts(["API version", "66.0"], ["Sharing", "With sharing"]), code: 'public with sharing class LeadRoutingService {\n    public static Id resolveOwner(Lead prospect) {\n        // Demo excerpt: territory lookup belongs here.\n        return prospect.OwnerId;\n    }\n}', related: [ref("standard-object", "Lead"), ref("custom-metadata", "Territory_Routing__mdt")] }),
  resource("apex-class", "OpportunityTriggerHandler", "Opportunity Trigger Handler", "Centralize opportunity validation and lifecycle behavior.", { facts: facts(["API version", "66.0"], ["Sharing", "With sharing"]), related: [ref("apex-trigger", "OpportunityTrigger"), ref("standard-object", "Opportunity")] }),
  resource("apex-trigger", "OpportunityTrigger", "Opportunity Trigger", "Run opportunity lifecycle logic before records are saved.", { status: "Active", facts: facts(["Object", "Opportunity"], ["Events", "Before insert, Before update"]), related: [ref("apex-class", "OpportunityTriggerHandler"), ref("standard-object", "Opportunity")] }),
  resource("lightning-component", "accountHealth", "Account Health", "Lightning web component displaying customer health and service tier.", { facts: facts(["Exposed", "Yes"], ["Targets", "Record page, App page"]), related: [ref("standard-object", "Account"), ref("lightning-page", "Account_Record_Page")] }),
  resource("sharing-rule", "Account.Regional_Account_Access", "Regional Account Access", "Share regional accounts with their sales managers.", { facts: facts(["Object", "Account"], ["Rule type", "Criteria-based"], ["Access level", "Read/Write"]), related: [ref("standard-object", "Account"), ref("role", "Regional_Sales_Manager")] }),
  resource("report", "Sales_Pipeline", "Sales Pipeline", "Open opportunities grouped by stage and owner.", { facts: facts(["Report type", "Opportunities"], ["Format", "Summary"], ["Folder", "Sales Operations"]), related: [ref("standard-object", "Opportunity"), ref("dashboard", "Sales_Overview")] }),
  resource("dashboard", "Sales_Overview", "Sales Overview", "A view of pipeline health and sales performance.", { facts: facts(["Folder", "Sales Operations"], ["Components", "Pipeline by stage, Open opportunities"]), related: [ref("report", "Sales_Pipeline")] }),
  resource("standard-object", "Account", "Account", "Companies and organizations your teams do business with.", {
    orgIds: ["acme-devhub"], facts: facts(["Record name", "Account Name"], ["Sharing model", "Public Read Only"]),
    section: fields([["Account name", "Name", "Text"], ["Industry", "Industry", "Picklist"], ["Account owner", "OwnerId", "Lookup · User"]]), related: [ref("standard-object", "Contact")],
  }),
];

export function resourcesForOrg(orgId: string): OrgResource[] {
  return CATALOG.filter(resource => resource.orgIds.includes(orgId)).map(({ resourceType, apiName, label, summary, status, facts, section, code, related }) => ({ orgId, resourceType, apiName, label, summary, status, facts, section, code, related }));
}
export function findResource(identity: ResourceIdentity): OrgResource | undefined {
  return resourcesForOrg(identity.orgId).find(resource => resourceKey(resource) === resourceKey(identity));
}
