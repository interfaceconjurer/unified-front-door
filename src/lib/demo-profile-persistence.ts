import { BrowserPersistenceStore } from "./browser-persistence";
import { isDemoProfileId, type DemoProfileId } from "./demo-profiles";

export class DemoProfileStore extends BrowserPersistenceStore<DemoProfileId | null | undefined> {
  constructor() {
    super("ufd.demo-user.v1", null, (value) =>
      value === null || (typeof value === "string" && isDemoProfileId(value))
        ? { value } : { error: "invalid" }, {
      // An unresolved hydration snapshot is distinct from signed out.
      serverState: undefined,
      legacyText: (raw) => isDemoProfileId(raw) ? raw : undefined,
    });
  }

  setProfile = (profileId: DemoProfileId | null): void => {
    this.update(() => profileId, true);
  };
}

export const demoProfileStore = new DemoProfileStore();
