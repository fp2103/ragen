
function generate2DUniqueRandomPoints (rng, min, max, minX, maxX, minY, maxY) {
    const points = []
    const numberOfPoints = Math.floor((rng() * (max-min)) + min);
    for (var i = 0; i < numberOfPoints; i++) {
        const p = new THREE.Vector3(Math.floor((rng() * (maxX-minX)) + minX),
                                    Math.floor((rng() * (maxY-minY)) + minY),
                                    0);
        
        let exists = false;
        for (var j = 0; j < points.length; j++) {
            const op = points[j];
            if (op.x == p.x && op.y == p.y) {
                exists = true;
                break;
            }
        }

        if (exists) {
            i--;
        } else {
            points.push(p);
        }
    }
    return points;
}

function computeHull (points, maxx, miny) {
    const hull = [];

    // Find leftest point
    let leftestPoint;
    let mini = maxx+1;
    for (var i = 0; i < points.length; i++) {
        if (points[i].x < mini) {
            mini = points[i].x;
            leftestPoint = points[i];
        }
    }

    // Return closest next point
    function nextpoint (vector1, pbase, points) {
        let np;
        let maxAngle = -1;
        let minDest = 0;
        for (var i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.x == pbase.x && p.y == pbase.y) {
                continue;
            }
    
            const vector2 = new THREE.Vector3().subVectors(p, pbase);
            const a = vector1.angleTo(vector2); 
            if (a > maxAngle || (a == maxAngle && vector2.length() < minDest)) {
                maxAngle = a;
                minDest = vector2.length();
                np = p;
            }
        }
        return np;
    }
    
    // start with vertival vector
    let v = new THREE.Vector3().subVectors(new THREE.Vector3(leftestPoint.x, miny-1, 0), leftestPoint);
    let lastPoint = leftestPoint;
    let pointNext;
    hull.push(leftestPoint);
    do {
        pointNext = nextpoint(v, lastPoint, points);
        hull.push(pointNext);
        v = new THREE.Vector3().subVectors(lastPoint, pointNext);
        lastPoint = pointNext;
    } while (pointNext.x != leftestPoint.x || pointNext.y != leftestPoint.y);

    return hull;
}

function cutCorner (points, minSeg) {
    const newPoints = [];

    const allIndiceRemoved = [];
    for (var i = 0; i < points.length-1; i++) {
        const p = points[i];

        // Find previous and next point
        let li = i;
        do {
            li--;
            if (li < 0) {
                li = points.length - 2;
            }
        } while (allIndiceRemoved.includes(li));

        let ni = i;
        do {
            ni++;
            if (ni >= points.length) {
                ni = 1;
            }
        } while (allIndiceRemoved.includes(ni));
        
        const lp = points[li];
        const np = points[ni];

        const v1 = new THREE.Vector3().subVectors(lp, p);
        const v2 = new THREE.Vector3().subVectors(np, p);

        // Compute the angle for this point and determine if arc is long enough
        // create two new points otherwise (or remove point if not enough space)
        const theta = v1.angleTo(v2);
        function arcfun (r) {
            return 2*r*Math.sin(theta/2);
        }
        let ptremoved = false;

        let transv1x = 0;
        let transv1y = 0;
        let transv2x = 0;
        let transv2y = 0;

        let r = Math.floor(minSeg/2)+1;
        while (arcfun(r) < minSeg && !ptremoved) {
            if (v1.length()-r < minSeg || v2.length()-r < minSeg) {
                ptremoved = true;
            }
            transv1x = r*v1.x/v1.length();
            transv1y = r*v1.y/v1.length();
            transv2x = r*v2.x/v2.length();
            transv2y = r*v2.y/v2.length();
            r++;
        }

        if (ptremoved) {
            allIndiceRemoved.push(i);
            if (i == 0) {
                allIndiceRemoved.push(points.length-1);
            }
            if (points.length - allIndiceRemoved.length < 3) {
                throw "Not enough remaining points";
            }
            continue;
        }

        if (transv1x != 0 || transv1y != 0 || transv2x != 0 || transv2y != 0) {
            const p1 = new THREE.Vector3(p.x + transv1x, p.y + transv1y, 0);
            const p2 = new THREE.Vector3(p.x + transv2x, p.y + transv2y, 0)
            newPoints.push(p1);
            newPoints.push(p2);
            points[i] = p2;
        } else {
            newPoints.push(p);
        }
    }
    newPoints.push(newPoints[0].clone());

    return newPoints;
}
