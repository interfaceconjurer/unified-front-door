// Shared helpers for driving the workbench through the same UI users touch.
export const workbenchViews = page => page.getByRole('tablist', { name: 'Open views' });
export const workbenchTab = (page, name) => workbenchViews(page).getByRole('tab', { name, exact: true });
export const workbenchToggle = page => page.getByRole('button', { name: 'Workbench', exact: true });
export const overviewName = plugin => `${plugin} overview`;
/** Open a capability (or a plugin's overview) from the palette's Capabilities tab. */
export async function openCapability(page, name) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).fill(name);
  await dialog.getByRole('listbox').getByRole('option').filter({ has: page.locator('[data-result-label]', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first().getByRole('button').click();
  await dialog.waitFor({ state: 'detached' });
}
export const openOverview = (page, plugin) => openCapability(page, overviewName(plugin));
