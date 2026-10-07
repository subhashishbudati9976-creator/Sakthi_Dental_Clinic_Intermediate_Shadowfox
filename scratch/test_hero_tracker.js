const assert = require('assert');
const { InteractiveCharacterHero } = require('../hero-tracker.js');

let now = 1000;
const rafCallbacks = [];
const pendingDecodes = [];
const imageUrls = [];
const listeners = new Map();

global.performance = { now: () => now };
global.requestAnimationFrame = callback => {
  rafCallbacks.push(callback);
  return rafCallbacks.length;
};
global.cancelAnimationFrame = () => {};
global.Image = class MockImage {
  set src(url) { this.url = url; imageUrls.push(url); }
  decode() { return new Promise(resolve => pendingDecodes.push(resolve)); }
};
global.window = {
  innerWidth: 1920,
  innerHeight: 1080,
  addEventListener: (name, callback) => listeners.set(`window:${name}`, callback),
  removeEventListener: name => listeners.delete(`window:${name}`)
};
global.document = {
  addEventListener: (name, callback) => listeners.set(`document:${name}`, callback),
  removeEventListener: name => listeners.delete(`document:${name}`)
};

const drawCalls = [];
const canvas = {
  width: 0,
  height: 0,
  getContext: () => ({ drawImage: image => drawCalls.push(image.url) })
};
const classNames = new Set();
const container = { classList: {
  add: name => classNames.add(name),
  contains: name => classNames.has(name)
} };
const hero = new InteractiveCharacterHero({ canvas, container, responseSpeed: 32 });

const cases = [
  ['CENTER', 0.5, 0.5], ['UP', 0.5, 0.05], ['TOP-RIGHT', 0.95, 0.05],
  ['RIGHT', 0.95, 0.5], ['BOTTOM-RIGHT', 0.95, 0.95], ['DOWN', 0.5, 0.95],
  ['BOTTOM-LEFT', 0.05, 0.95], ['LEFT', 0.05, 0.5], ['TOP-LEFT', 0.05, 0.05]
];
for (const [expected, x, y] of cases) {
  const gaze = hero.resolveGaze(x, y);
  assert.strictEqual(gaze.directionName, expected);
  assert(gaze.frame >= 0 && gaze.frame < 2400);
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve));
}

async function run() {
  assert.strictEqual(canvas.width, 1920);
  assert.strictEqual(canvas.height, 1080);
  assert.strictEqual(pendingDecodes.length, 1, 'Only the neutral frame starts during initialization.');

  // Complete the neutral frame, then steer to the upper-right.
  pendingDecodes.shift()();
  await flush();
  assert.deepStrictEqual(drawCalls, ['assets/character_frames/frame_0000.webp']);
  assert(classNames.has('is-ready'));

  hero._handlePointerMove({ clientX: 1824, clientY: 54 });
  now += 16;
  rafCallbacks.shift()(now);
  assert(hero.cacheManager.activeDecodes <= 4);
  assert(imageUrls.some(url => /frame_\d{4}\.webp$/.test(url)));

  // A newer pointer position supersedes pending work without starting a request storm.
  hero._handlePointerMove({ clientX: 1824, clientY: 1026 });
  now += 16;
  rafCallbacks.shift()(now);
  assert(hero.cacheManager.activeDecodes <= 2);
  assert(imageUrls.length <= 3);

  // Let outstanding decodes drain. The final decoded frame must match the latest target.
  let guard = 0;
  while ((pendingDecodes.length || hero.cacheManager.activeDecodes) && guard++ < 40) {
    if (pendingDecodes.length) pendingDecodes.shift()();
    await flush();
  }
  assert(guard < 40, 'Decode queue should drain after pointer input stops.');
  assert.strictEqual(hero._lastDrawnFrame, hero._lastRequestedFrame);
  assert(hero.cacheManager.cache.size <= 16);
  assert.strictEqual(hero.cacheManager.activeDecodes, 0);

  hero.destroy();
  console.log('All hero gaze mapping and latest-target frame scheduling checks passed.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
