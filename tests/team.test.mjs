import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { clampTransform, pinchTransform, markerSize } from '../wwwroot/js/team-viewer.js';

const catalog = JSON.parse(await readFile(new URL('../wwwroot/data/mannschaft.json', import.meta.url)));
test('every person has one central, unique identity; both photos reference it', async () => {
    const ids = new Set(catalog.members.map(m => m.id));
    assert.equal(ids.size, catalog.members.length);
    assert.ok(catalog.members.some(m => !m.placeholder), 'at least one named member');
    assert.equal(catalog.photos.length, 2);
    assert.equal(catalog.photos[1].label, 'Funktionsträger');
    assert.ok(catalog.members.some(m => m.name === 'Richard Kröpfl'));
    for (const photo of catalog.photos) {
        assert.equal(new Set(photo.spots.map(s => s.memberId)).size, photo.spots.length);
        await access(new URL(`../wwwroot${photo.src}`, import.meta.url));
        await access(new URL(`../wwwroot${photo.original}`, import.meta.url));
        if (photo.detailSrc) await access(new URL(`../wwwroot${photo.detailSrc}`, import.meta.url));
        for (const spot of photo.spots) {
            assert.ok(ids.has(spot.memberId));
            assert.ok(spot.x >= 0 && spot.x <= 1 && spot.y >= 0 && spot.y <= 1);
            const [x, y, w, h] = spot.crop;
            assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= photo.width && y + h <= photo.height);
        }
    }
    assert.ok(catalog.photos[1].spots.every(s => catalog.photos[0].spots.some(a => a.memberId === s.memberId)));
});
test('confirmed photo assignments no longer show the demo notice; unnamed members remain placeholders', () => {
    assert.equal(catalog.demoAssignments, false);
    assert.ok(catalog.members.filter(m => m.placeholder).every(m => m.since === null && m.rank === '' && m.role === ''));
});
test('the inline crop keeps all markers inside the visible photo and preserves their original coordinates', () => {
    for (const photo of catalog.photos) {
        const top = photo.trimTop ?? 0, bottom = photo.trimBottom ?? 0;
        const height = photo.height - top - bottom;
        assert.ok(top >= 0 && bottom >= 0 && height > 0);
        for (const spot of photo.spots) {
            const inlineY = (spot.y * photo.height - top) / height;
            assert.ok(inlineY >= 0 && inlineY <= 1, `${photo.id}/${spot.id} outside crop`);
            assert.ok(Math.abs((inlineY * height + top) / photo.height - spot.y) < 1e-9);
        }
    }
});
test('pan stays bounded at all zoom levels, in portrait and landscape', () => {
    for (const [width, height, iw, ih] of [[390, 650, 390, 260], [1200, 800, 1200, 800], [800, 250, 375, 250]]) {
        for (const scale of [.1, 1, 2, 5, 100]) {
            const r = clampTransform(scale, 99999, -99999, width, height, iw, ih);
            assert.ok(r.scale >= 1 && r.scale <= 5);
            assert.ok(Math.abs(r.x) <= Math.max(0, (iw * r.scale - width) / 2));
            assert.ok(Math.abs(r.y) <= Math.max(0, (ih * r.scale - height) / 2));
            if (r.scale === 1) { assert.equal(r.x, 0); assert.equal(Math.abs(r.y), 0); }
        }
    }
});
test('pinch keeps the image point under the moving two-finger midpoint', () => {
    const start = { scale: 1.5, x: 23, y: -42, cx: -75, cy: 85, distance: 100 };
    const imagePoint = { x: (start.cx - start.x) / start.scale, y: (start.cy - start.y) / start.scale };
    for (const distance of [10, 100, 200, 1000]) {
        const result = pinchTransform(start, -30, 120, distance);
        assert.ok(Math.abs(imagePoint.x * result.scale + result.x - (-30)) < 1e-9);
        assert.ok(Math.abs(imagePoint.y * result.scale + result.y - 120) < 1e-9);
        assert.ok(result.scale >= 1 && result.scale <= 5);
    }
});
test('phone markers start discreetly and grow with zoom without reducing the touch area', () => {
    assert.equal(markerSize(1, true), 5);
    assert.equal(markerSize(5, true), 15);
    assert.ok(markerSize(1, false) > markerSize(1, true));
    assert.ok(markerSize(2.5, true) > markerSize(1, true));
    assert.equal(markerSize(99, true), 15);
});
