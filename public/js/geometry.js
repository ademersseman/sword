//distance function
export function distance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.hypot(dx, dy)
}

export function getIntersectionPoint(p1, p2, p3, p4) {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (denom === 0) {
        return null; // Lines are parallel
    }

    const intersectX = ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) - (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) / denom;
    const intersectY = ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) / denom;

    const intersectionPoint = { x: intersectX, y: intersectY };

    // Check if the intersection point lies on both segments
    if (onSegment(p1, intersectionPoint, p2) && onSegment(p3, intersectionPoint, p4)) {
        return intersectionPoint;
    }

    return null; // If intersection point is not on both segments
}

export function doLineSegmentsIntersect(p1, p2, p3, p4) {
    // Compute the four orientations needed for the general and special cases
    const o1 = orientation(p1, p2, p3);
    const o2 = orientation(p1, p2, p4);
    const o3 = orientation(p3, p4, p1);
    const o4 = orientation(p3, p4, p2);
    
    // General case: the segments intersect if the orientations are different
    if (o1 !== o2 && o3 !== o4) {
        return true;
    }
    
    // Special case: check for collinearity and overlap
    if (o1 === 0 && onSegment(p1, p3, p2)) return true;
    if (o2 === 0 && onSegment(p1, p4, p2)) return true;
    if (o3 === 0 && onSegment(p3, p1, p4)) return true;
    if (o4 === 0 && onSegment(p3, p2, p4)) return true;
    
    return false;
}

// Helper function to calculate the orientation of three points
function orientation(p, q, r) {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val === 0) return 0;  // Collinear
    return (val > 0) ? 1 : 2;  // 1 -> Clockwise, 2 -> Counter-clockwise
}

// Helper function to check if point q lies on the segment pr
function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
           q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}
