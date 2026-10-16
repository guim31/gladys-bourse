// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The manifest is validated by the store indexer, but nothing there can know
// which handlers the code actually registers — these tests keep both in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, LANGUAGES, MOVE_LEVELS, REFRESH_INTERVALS } from '../src/config.js';
import { CONFIG_ACTION, SCENE_ACTIONS } from '../src/actions.js';
import { TRIGGERS, WIDGET_KEY } from '../src/monitor.js';
import { WIDGETS } from '../src/widgets.js';
import { createApi, createWorld, cycle, deviceOf } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

// Every list of form fields the manifest can declare (same field grammar).
const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const { gladys: registered, app } = await createWorld({ connect: false });
await app.stop();
const handlerKeys = (prefix) =>
  Object.keys(registered.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);
const optionValues = (field) => field.options.map((option) => option.value);
const field = (list, key) => list.find((entry) => entry.key === key);

test('identity: name, image, cover, cloud transport, category', () => {
  assert.equal(manifest.name, 'Yahoo Finance');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-bourse:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-bourse/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['services']);
});

test('Gladys 5.1.0 at least: widgets, scene triggers and actions', () => {
  assert.equal(manifest.gladys_version, '>=5.1.0');
});

test('every manifest action, scene action and widget has its handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions), [CONFIG_ACTION]);
  assert.deepEqual(handlerKeys('action:'), [CONFIG_ACTION]);
  assert.deepEqual(keysOf(manifest.scene_actions), Object.values(SCENE_ACTIONS));
  assert.deepEqual(handlerKeys('sceneAction:'), Object.values(SCENE_ACTIONS));
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
});

test('the outputs of the scene actions are the declared ones', async (t) => {
  const world = await createWorld({ config: { symbols: 'BTC-EUR' } });
  t.after(() => world.app.stop());
  const fields = { [SCENE_ACTIONS.QUOTE]: { device: deviceOf(world, 'BTC-EUR').external_id } };
  for (const action of manifest.scene_actions) {
    const { data } = await world.fake.sceneAction(action.key, fields[action.key] ?? {});
    assert.deepEqual(Object.keys(data.outputs).sort(), keysOf(action.outputs).sort(), action.key);
    for (const output of action.outputs) {
      assert.equal(typeof data.outputs[output.key], output.type, `${action.key}.${output.key}`);
    }
  }
});

test('the scene triggers the monitor fires are declared, with their filters and variables', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers), Object.values(TRIGGERS));
  const api = createApi();
  const world = await createWorld({
    config: { symbols: 'BTC-EUR', price_alerts: 'BTC-EUR < 72000' },
    api,
  });
  t.after(() => world.app.stop());
  api.trade('BTC-EUR', 70000);
  await cycle(world);
  assert.deepEqual(
    [...new Set(world.fake.sceneEvents.map((e) => e.key))].sort(),
    Object.values(TRIGGERS).sort(),
  );
  const device = deviceOf(world, 'BTC-EUR').external_id;
  for (const event of world.fake.sceneEvents) {
    const trigger = field(manifest.scene_triggers, event.key);
    const keys = [...new Set([...keysOf(trigger.fields), ...keysOf(trigger.variables)])];
    assert.deepEqual(Object.keys(event.data).sort(), keys.sort(), `${event.key}: data keys`);
    for (const variable of trigger.variables) {
      assert.equal(typeof event.data[variable.key], variable.type, `${event.key}.${variable.key}`);
    }
    assert.equal(event.data.device, device);
    assert.ok(optionValues(field(trigger.fields, 'direction')).includes(event.data.direction));
  }
  const move = field(manifest.scene_triggers, TRIGGERS.MOVE);
  assert.deepEqual(optionValues(field(move.fields, 'threshold')), MOVE_LEVELS);
  // One event per level: a wildcard level would run a scene once per level.
  assert.equal(field(move.fields, 'threshold').required, true);
});

test('the symbol fields list the devices of the integration', () => {
  const symbolFields = allFields.filter((entry) => entry.key === 'device');
  assert.equal(symbolFields.length, 3);
  for (const entry of symbolFields) {
    assert.equal(entry.type, 'select');
    assert.equal(entry.source, 'devices');
  }
});

test('config_schema defaults and options are the ones of the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.deepEqual(DEFAULT_CONFIG[entry.key], entry.default, entry.key);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  assert.deepEqual(optionValues(field(manifest.config_schema, 'language')), LANGUAGES);
  assert.deepEqual(
    optionValues(field(manifest.config_schema, 'refresh_interval')),
    REFRESH_INTERVALS,
  );
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((entry) => entry.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('no number field (the form has no step): prices are parsed strings', () => {
  assert.deepEqual(
    allFields.filter((entry) => entry.type === 'number'),
    [],
  );
});

test('actions: no field at all (the core applies no default, #3154 and #3155)', () => {
  for (const action of manifest.actions) {
    assert.equal(action.fields, undefined, action.key);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
