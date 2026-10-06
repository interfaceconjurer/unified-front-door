// Shared helpers for driving the workbench through the same UI users touch.
export const workbenchViews = page => page.getByRole('tablist', { name: 'Open views' });
export const workbenchTab = (page, name) => workbenchViews(page).getByRole('tab', { name, exact: true });
export const workbenchToggle = page => page.getByRole('button', { name: 'Workbench', exact: true });
export const overviewName = plugin => `${plugin} overview`;
/** Today opens the matching plugin filter in Capabilities without navigating. */
export async function exploreToday(page, plugin) {
  await page.getByRole('group', { name: 'Today', exact: true })
    .getByRole('navigation', { name: 'Explore capabilities', exact: true })
    .getByRole('button', { name: plugin, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('group', { name: 'Capability plugin', exact: true })
    .getByRole('button', { name: plugin, exact: true }).waitFor();
  return dialog;
}
export async function openTodayOverview(page, plugin) {
  const dialog = await exploreToday(page, plugin);
  await dialog.getByRole('listbox').getByRole('option')
    .filter({ has: page.locator('[data-result-label]', { hasText: overviewName(plugin) }) })
    .first().click();
  await dialog.waitFor({ state: 'detached' });
}
/** Open a capability (or a plugin's overview) from the palette's Capabilities tab. */
export async function openCapability(page, name) {
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('tab', { name: 'Capabilities', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Search capabilities…', exact: true }).fill(name);
  await dialog.getByRole('listbox').getByRole('option').filter({ has: page.locator('[data-result-label]', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first().click();
  await dialog.waitFor({ state: 'detached' });
}
export const openOverview = (page, plugin) => openCapability(page, overviewName(plugin));
