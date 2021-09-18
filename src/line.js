
function getPseudoDerivativeVector(points, i, loop) {
    const precision = 0.1;

    let previ = i;
    let pprevi = points[i];
    do {
        previ--;
        if (previ < 0 && !loop) {
            break;
        } else if (previ < 0 && loop) {
            previ = points.length - 1;
        }
        pprevi = points[previ];
    } while (points[i].distanceTo(pprevi) < precision);
    
    let nexti = i;
    let pnexti = points[i];
    do {
        nexti++;
        if (nexti > points.length-1 && !loop) {
            break;
        } else if (nexti > points.length-1 && loop) {
            nexti = 0;
        }
        pnexti = points[nexti];
    } while (points[i].distanceTo(pnexti) < precision);
    
    // Take the vector between previous point and next point (at same dist from point)
    const pA = points[i].clone();
    const vA = new THREE.Vector3().subVectors(pprevi, points[i]);
    vA.normalize();
    pA.add(vA);
    const pB = points[i].clone();
    const vB = new THREE.Vector3().subVectors(pnexti, points[i]);
    vB.normalize();
    pB.add(vB);
    return new THREE.Vector3().subVectors(pB, pA);
}

function createWidthLineBufferGeo (points, width, loop, step, z_function) {

    // Create intermediate points
    const morePoints = [];
    for (var i = 0; i < points.length-1; i++) {
        const v = new THREE.Vector3().subVectors(points[i+1], points[i]);
        const vlength = v.length();

        if (vlength <= step) {
            morePoints.push(points[i]);
        } else {
            v.normalize();
            v.multiplyScalar(step);
            
            morePoints.push(points[i]);
            let lastPoint = points[i];
            let cumLength = step;
            while (cumLength < vlength) {
                const newPoint = lastPoint.clone();
                newPoint.add(v);
                morePoints.push(newPoint);
                lastPoint = newPoint;
                cumLength = cumLength + step;
            }
        }
    }
    morePoints.push(points[points.length-1]);

    // For each new points take ortho to derivative at this point and add width
    // and verify it's not too close to another point
    let atLeastOneGoodPoint = false;
    const exterPointsStatus = [];
    var i = 0;
    while (i < morePoints.length) {
        // Compute derivative
        const d = getPseudoDerivativeVector(morePoints, i, loop);

        // Take orthogonal and multiply it by width
        const t = new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1), d);
        t.normalize();
        t.multiplyScalar(width);

        // Create points
        const np = morePoints[i].clone();
        np.add(t);

        // Check distance to all other points
        let goodPoint = true;
        for(var j = 0; j < morePoints.length; j++) {
            if (i != j && np.distanceTo(morePoints[j]) < (Math.abs(width)*0.99)) {
                goodPoint = false;
                break;
            }
        }
        if (!atLeastOneGoodPoint && goodPoint) {
            atLeastOneGoodPoint = true;
        }
        exterPointsStatus.push([np, goodPoint]);
        i++;
    }
    if (!atLeastOneGoodPoint) {
        throw "Can't find any good points to create width line";
    }

    // Keep only good points, associate bad ones with the closest good point
    const exterPoints = [];
    for (var i = 0; i < exterPointsStatus.length; i++) {
        const ep = exterPointsStatus[i][0];
        const good = exterPointsStatus[i][1];
        if (good) {
            exterPoints.push(ep);
        } else {

            // search for closest good point
            let dprev = 0;
            let previ = i;
            do {
                dprev++;
                previ--;
                if (previ < 0 && loop) {
                    previ = exterPointsStatus.length-1;
                }
            } while (previ >= 0 && !exterPointsStatus[previ][1]);
            if (previ < 0) {
                dprev = exterPointsStatus.length+1;
            }

            let dnext = 0;
            let nexti = i;
            do {
                dnext++;
                nexti++;
                if (nexti >= exterPointsStatus.length && loop) {
                    nexti = 0;
                }
            } while (nexti < exterPointsStatus.length && !exterPointsStatus[nexti][1]);
            if (nexti >= exterPointsStatus) {
                dnext = exterPointsStatus.length+1;
            }

            if (dprev < dnext) {
                exterPoints.push(exterPointsStatus[previ][0]);
            } else if (dprev > dnext) {
                exterPoints.push(exterPointsStatus[nexti][0]);
            } else {
                const gpp = exterPointsStatus[previ][0];
                const gpn = exterPointsStatus[nexti][0];
                if (gpn == undefined || gpp == undefined) {
                    throw "NO good previous or next point";
                }

                if (ep.distanceTo(gpp) < ep.distanceTo(gpn)) {
                    exterPoints.push(gpp);
                } else {
                    exterPoints.push(gpn);
                }
            }
        }
    }
    //console.log("More Points: ", morePoints.length, exterPoints.length);

    // Compute z for all points
    if (z_function != undefined) {
        for (var i = 0; i < morePoints.length; i++) {
            morePoints[i].z = z_function(morePoints[i].x, morePoints[i].y);
        }
        for (var i = 0; i < exterPoints.length; i++) {
            exterPoints[i].z = z_function(exterPoints[i].x, exterPoints[i].y);
        }
    }

    // Clean to don't have too much points and create a nice geometry
    const origPoints = [];
    const secPoints = [];
    const vertices = [];
    const btTMesh = new Ammo.btTriangleMesh();
    var i = 0;
    while (i < morePoints.length-1) {
        const d = getPseudoDerivativeVector(morePoints, i, loop);

        // Search next point that is before a turn
        let nexti = i+1;
        while (nexti < morePoints.length &&
               d.angleTo(getPseudoDerivativeVector(morePoints, nexti, loop)) < 0.01) {
            nexti++;
        }
        if (nexti > i+1 || nexti >= morePoints.length) {
            nexti--;
        }

        origPoints.push(morePoints[i]);
        secPoints.push(exterPoints[i]);

        // convert points to btVector
        let btVert1 = new Ammo.btVector3(morePoints[i].x, morePoints[i].y, morePoints[i].z);
        let btVert2 = new Ammo.btVector3(morePoints[nexti].x, morePoints[nexti].y, morePoints[nexti].z);
        let btVert3 = new Ammo.btVector3(exterPoints[i].x, exterPoints[i].y, exterPoints[i].z);
        let btVert4 = new Ammo.btVector3(exterPoints[nexti].x, exterPoints[nexti].y, exterPoints[nexti].z);

        if (width >= 0) {
            vertices.push(morePoints[i]);
            vertices.push(morePoints[nexti]);
            vertices.push(exterPoints[nexti]);
            vertices.push(morePoints[i]);
            vertices.push(exterPoints[nexti]);
            vertices.push(exterPoints[i]);

            // Ammo tringle mesh
            btTMesh.addTriangle(btVert1, btVert2, btVert4, true);
            btTMesh.addTriangle(btVert1, btVert4, btVert3, true);
        } else {
            vertices.push(morePoints[i]);
            vertices.push(exterPoints[i]);
            vertices.push(exterPoints[nexti]);
            vertices.push(morePoints[i]);
            vertices.push(exterPoints[nexti]);
            vertices.push(morePoints[nexti]);

            // Ammo triangle mesh
            btTMesh.addTriangle(btVert1, btVert3, btVert4, true);
            btTMesh.addTriangle(btVert1, btVert4, btVert2, true);
        }

        i = nexti;
    }

    // Last triangle
    if (loop) {
        origPoints.push(morePoints[0]);
        secPoints.push(exterPoints[0]);

        let btVert1 = new Ammo.btVector3(morePoints[morePoints.length-1].x,
                                         morePoints[morePoints.length-1].y,
                                         morePoints[morePoints.length-1].z);
        let btVert2 = new Ammo.btVector3(exterPoints[i].x, exterPoints[i].y, exterPoints[i].z);
        let btVert3 = new Ammo.btVector3(exterPoints[exterPoints.length-1].x,
                                         exterPoints[exterPoints.length-1].y,
                                         exterPoints[exterPoints.length-1].z);

        if (width >= 0) {
            vertices.push(morePoints[morePoints.length-1]);
            vertices.push(exterPoints[0]);
            vertices.push(exterPoints[exterPoints.length-1]);

            btTMesh.addTriangle(btVert1, btVert2, btVert3);
        } else {
            vertices.push(morePoints[morePoints.length-1]);
            vertices.push(exterPoints[exterPoints.length-1]);
            vertices.push(exterPoints[0]);

            btTMesh.addTriangle(btVert1, btVert3, btVert2);
        }
    }

    //console.log("Cleaned Points:", origPoints.length, secPoints.length);
    const geo = new THREE.BufferGeometry().setFromPoints(vertices);
    geo.computeVertexNormals();

    return {
        origPoints: origPoints,
        secPoints: secPoints,
        geo: geo,
        btShape: new Ammo.btBvhTriangleMeshShape(btTMesh, true, true)
    }
}
