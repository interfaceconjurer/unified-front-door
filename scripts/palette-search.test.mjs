import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { testModules } from './test-modules.mjs';
const modules = testModules(); after(modules.cleanup);
const { matchesPaletteQuery, paletteSearchRank, rankPaletteGroups } = modules.load('lib/navigation/palette-search');

test('search terms span fields and normalize branch/API separators', () => {
  assert(matchesPaletteQuery('trailblazer lead routing', 'Trailblazer CRM', 'feature/lead-routing'));
  assert(matchesPaletteQuery('  LEAD_Routing  ', 'Lead Routing'));
  assert(!matchesPaletteQuery('lead approval', 'Lead routing', 'Saved'));
  assert(matchesPaletteQuery('', 'Account'));
});

test('exact names and API aliases outrank prefix, partial and descriptive matches', () => {
  const items = [{ label: 'Customer report', description: 'Account analysis' }, { label: 'Account Health' }, { label: 'Customer Account' }, { label: 'Account' }];
  assert.deepEqual(rankPaletteGroups(items, 'Account').map(item => item.label), ['Account', 'Account Health', 'Customer Account', 'Customer report']);
  assert.equal(paletteSearchRank({ label: 'Opportunity Trigger Handler', searchNames: ['OpportunityTriggerHandler'] }, 'OpportunityTriggerHandler'), 0);
});

test('ranking keeps whole project trees intact and does not mutate the source', () => {
  const items = [
    { label: 'Lead routing report' },
    { label: 'Trailblazer CRM' },
    { label: 'lead-routing', indent: true },
    { label: 'hotfix-9821', indent: true },
    { label: 'Lead Routing', searchNames: ['Lead_Routing'] },
  ];
  const original = structuredClone(items);
  assert.deepEqual(rankPaletteGroups(items, 'lead routing').map(item => item.label), ['Trailblazer CRM', 'lead-routing', 'hotfix-9821', 'Lead Routing', 'Lead routing report']);
  assert.deepEqual(items, original);
  assert.deepEqual(rankPaletteGroups(items, ''), items);
  assert.deepEqual(rankPaletteGroups([], 'anything'), []);
});
