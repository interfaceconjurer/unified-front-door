import { demoProfileById, type DemoProfileId } from "../demo-profiles";
import { ASSESSMENT_ORGS } from "../onboarding/assessment";
import { ORGS } from "./fixtures";

/** The same demo connections are used at sign-in and inside the workspace. */
export function orgsForProfile(profileId: DemoProfileId) {
  return demoProfileById(profileId).onboarding === "org-assessment" ? ASSESSMENT_ORGS : ORGS;
}

export function connectedOrgForProfile(profileId: DemoProfileId, preferred?: string | null) {
  const connected = orgsForProfile(profileId).filter(org => org.connection === "connected");
  return connected.find(org => org.id === preferred) ?? connected.find(org => org.id === "uat") ?? connected[0];
}
