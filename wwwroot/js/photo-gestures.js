export function clampTransform(scale, x, y, width, height, imageWidth, imageHeight) {
    scale = Math.min(5, Math.max(1, scale));
    const maxX = Math.max(0, (imageWidth * scale - width) / 2);
    const maxY = Math.max(0, (imageHeight * scale - height) / 2);
    return { scale, x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
}

export function pinchTransform(start, midpointX, midpointY, distance) {
    const scale = Math.max(1, Math.min(5, start.scale * distance / Math.max(1, start.distance)));
    return { scale, x: midpointX - (start.cx - start.x) * scale / start.scale, y: midpointY - (start.cy - start.y) * scale / start.scale };
}

export function swipeDirection(dx, dy, elapsed, scale, multiTouch, width) {
    if (multiTouch || scale > 1.05 || elapsed > 800) return 0;
    if (Math.abs(dx) < Math.max(40, Math.min(80, width * .12)) || Math.abs(dx) <= Math.abs(dy) * 1.3) return 0;
    return dx < 0 ? 1 : -1;
}

