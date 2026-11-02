import test from 'node:test';
import assert from 'node:assert/strict';
import { swipeDirection } from '../wwwroot/js/photo-gestures.js';

test('horizontal swipes select the next or previous image on phones and tablets', () => {
    for (const width of [360, 390, 768, 1024]) {
        assert.equal(swipeDirection(-130, 12, 300, 1, false, width), 1);
        assert.equal(swipeDirection(130, -12, 300, 1, false, width), -1);
    }
});
test('vertical page scrolling, taps and small or slow drags never change photos', () => {
    for (const args of [[20, 1, 100], [45, 60, 200], [150, 0, 1200], [1, 1, 30]]) {
        assert.equal(swipeDirection(...args, 1, false, 390), 0);
    }
});
test('pinching and panning a zoomed photo cannot trigger image navigation', () => {
    assert.equal(swipeDirection(-250, 0, 300, 2.5, false, 390), 0);
    assert.equal(swipeDirection(-250, 0, 300, 1, true, 390), 0);
    assert.equal(swipeDirection(-250, 0, 300, 1.4, true, 1024), 0);
});
