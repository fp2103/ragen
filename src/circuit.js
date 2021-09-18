
class CircuitFactory {
    
    constructor (mainView, minimapView, physics) {
        this.mainScene = mainView.scene;
        this.minimapScene = minimapView.scene;
        this.phyWorld = physics.world;

        this.terrain = new Terrain();
        this.mainScene.add(this.terrain.mesh);
        this.phyWorld.addRigidBody(this.terrain.body);

        this.currSeed = undefined;
        this.currCircuit = undefined;

        this.MATERIALS = {
            matGrey: new THREE.MeshLambertMaterial({color: new THREE.Color().setHSL(0.1, 0.06, 0.33)}),
            matWhite: new THREE.MeshBasicMaterial({color: 0xffffff}),
            matBlue: new THREE.MeshBasicMaterial({color: 0x0000ff}),
            matLineBlue: new THREE.LineBasicMaterial({color: 0x0000ff}),
            matLineWhite: new THREE.LineBasicMaterial({color: 0xffffff})
        }

        // Trees
        this.TREES_COUNT = 200;
        const treeTruncGeo = new THREE.CylinderBufferGeometry(1, 1, 3, 8);
        treeTruncGeo.rotateX(Math.PI/2);
        const treesTrunc = new THREE.InstancedMesh(treeTruncGeo, new THREE.MeshLambertMaterial({color: 0x8B4513}), this.TREES_COUNT);
        const treeConeGeo = new THREE.ConeBufferGeometry(3, 5, 8);
        treeConeGeo.rotateX(Math.PI/2);
        const treesCone = new THREE.InstancedMesh(treeConeGeo, new THREE.MeshLambertMaterial({color: 0x6B8E23}), this.TREES_COUNT);
        const treesShadow = new THREE.InstancedMesh(new THREE.CircleBufferGeometry(3.1, 8),
                                new THREE.MeshPhongMaterial({color: 0x000000, opacity: 0.2, transparent: true}), this.TREES_COUNT);
        const treeShape = new Ammo.btCylinderShape(new Ammo.btVector3(1, 1.5, 1))
        
        this.trees = {truncs: treesTrunc, cones: treesCone, shadows: treesShadow,
                      shape: treeShape, bodies: new Array()};
        this.mainScene.add(treesTrunc, treesCone, treesShadow);

        this.centeredMsg = document.getElementById("centered_msg");
    }

    createCircuit (seed) {
        this.centeredMsg.textContent = `Creating circuit ${seed}...`;
        const CONF = {minPoints: 15,
                      maxPoints: 30,
                      minX: -300,
                      maxX: 300,
                      minY: -200,
                      maxY: 200,
                      width: 12.5,
                      margin: 0.5,
                      pointResolution: 200,
                      Z: 0.6,
                      terrainSide: 800,
                      treesCount: this.TREES_COUNT,
                      altitude: this.terrain.altitude};

        const circuitPromise = new Promise(resolve => {
            if (seed == this.currSeed) {
                resolve(this.currCircuit);
            } else {
                if (this.currCircuit != undefined) {
                    this.mainScene.remove(this.currCircuit.mesh);
                    this.minimapScene.remove(this.currCircuit.minimapMesh);
                    this.phyWorld.removeCollisionObject(this.currCircuit.body);
                    while(this.trees.bodies.length) {
                        this.phyWorld.removeCollisionObject(this.trees.bodies.pop());
                    }
                }
                resolve(new Circuit(this.MATERIALS, CONF, seed, this.trees));
            }
        });

        circuitPromise.then(value => {
            if (value.id != this.currSeed) {
                this.currSeed = seed;
                this.currCircuit = value;
                this.mainScene.add(value.mesh);
                this.minimapScene.add(value.minimapMesh);
                this.phyWorld.addRigidBody(value.body);
                this.trees.bodies.forEach(tb => this.phyWorld.addRigidBody(tb));
            }
            this.centeredMsg.textContent = "";
        });
        return circuitPromise;
    }

}

class Circuit {

    constructor  (materials, conf, id, trees) {
        this.id = id;
        const rng = new Math.seedrandom(id);

        // Define direction
        this.clockwise = rng() < (1/2);

        // Get random points
        let points = generate2DUniqueRandomPoints(rng, conf.minPoints, conf.maxPoints, 
                                                  conf.minX, conf.maxX, 
                                                  conf.minY, conf.maxY);

        // Get points on convex hull
        const hull = computeHull(points, conf.maxX, conf.minY);

        // Associate remaining points to their closest hull segment
        function HullSegment (point1, point2) {
            this.pbase = point1;
            this.pend = point2;
            this.vector = new THREE.Vector3().subVectors(point2, point1);
            this.associated_points = [];
        }
        const hullSegs = [];
        for (i = 0; i < hull.length-1; i++) {
            hullSegs.push(new HullSegment(hull[i], hull[i+1]));
        }

        for (var i = 0; i < points.length; i++) {
            const p = points[i];
            if (hull.includes(p)) {
                continue;
            }

            let mind = 10000;
            let bestj = undefined;
            for (var j = 0; j < hullSegs.length; j++) {
                const seg = hullSegs[j];
                const vector2 = new THREE.Vector3().subVectors(p, seg.pbase);
                const angle = seg.vector.angleTo(vector2);

                const d = Math.sin(angle)*vector2.length();
                const proj = Math.cos(angle)*vector2.length();
                if (proj > 0 && proj < seg.vector.length() && d < mind) {
                    mind = d;
                    bestj = j;
                }
            }

            if (bestj != undefined) {
                hullSegs[bestj].associated_points.push(p);
            } else {
                console.log("solitary point, no hull seg found for", p);
            }
        }

        // Find for each hull segment its best(=higher angle) midpoint
        // & update circuit points
        points = [];
        for (var i = 0; i < hullSegs.length; i++) {
            const seg = hullSegs[i];
        
            let midpoint = undefined;
            let maxAngle = -1;
            for (var j = 0; j < seg.associated_points.length; j++) {
                const ap = seg.associated_points[j];
                
                const v1 = new THREE.Vector3().subVectors(seg.pbase, ap);
                const v2 = new THREE.Vector3().subVectors(seg.pend, ap);
        
                if (v1.angleTo(v2) > maxAngle) {
                    maxAngle = v1.angleTo(v2);
                    midpoint = ap;
                }
            }

            points.push(seg.pbase);
            if (midpoint != undefined) {
                points.push(midpoint);
            }
        }
        points.push(points[0].clone());

        // Cut corners
        points = cutCorner(points, conf.width+1);

        // Get the catmullrom for the points
        const chordal = new THREE.CatmullRomCurve3(points, false, 'centripetal');
        points = chordal.getPoints(conf.pointResolution);
        const spacedPoints = chordal.getSpacedPoints(conf.pointResolution);

        // Get the geometry && update points
        const cir = createWidthLineBufferGeo(points, conf.width, true, 1, conf.altitude);
        points = cir.origPoints;

        // Compute start/stop & checkpoints
        let totLength = 0;
        const segLength = [];
        const cumSegLength = [];
        let maxSegLength = 0;
        let maxSegLengthId = 0;
        for (var i = 0; i < points.length-1; i++) {
            cumSegLength.push(totLength);
            const segL = new THREE.Vector3().subVectors(points[i+1], points[i]).length();
            totLength = totLength + segL;
            segLength.push(segL);
            if (segL > maxSegLength) {
                maxSegLengthId = i;
                maxSegLength = segL;
            }
        }

        // Put start line BEFORE longest segment
        if (!this.clockwise) {
            maxSegLengthId++;
            if (maxSegLengthId >= cumSegLength.length) {
                maxSegLengthId = 0;
            }
        }

        // Search the sector checkpoint positions
        const sectorLength = totLength/3;
        const startLength = cumSegLength[maxSegLengthId];
        function getIdFromLength (length) {
            let mlength = length;
            while (mlength > totLength) {
                mlength = mlength - totLength;
            }
            let resId = 0;
            while (resId < cumSegLength.length && cumSegLength[resId] < mlength) {
                resId++;
            }
            return resId-1;
        }

        /* --UNUSED--
        // create spaced points list from the start
        this.spaced10Points = [];
        let closestToStart_SpacedPoint = undefined;
        let minDiff = 1000;
        for (let k = 0; k < spacedPoints.length; k++) {
            let diff = (new THREE.Vector3().subVectors(points[maxSegLengthId], spacedPoints[k])).lengthSq();
            if (diff < minDiff) {
                minDiff = diff;
                closestToStart_SpacedPoint = k;
            }
        }
        const nextk = Math.floor(conf.pointResolution/10);
        if (this.clockwise) {
            let k = 0;
            for (k = closestToStart_SpacedPoint; k < spacedPoints.length-1; k += nextk) {
                this.spaced10Points.push(spacedPoints[k]);
            }
            for (k = 1+k-spacedPoints.length; k < closestToStart_SpacedPoint; k += nextk) {
                this.spaced10Points.push(spacedPoints[k]);
            }
        } else {
            let k = 0;
            for (k = closestToStart_SpacedPoint; k > 0; k -= nextk) {
                this.spaced10Points.push(spacedPoints[k]);
            }
            for (k = spacedPoints.length+k-1; k > closestToStart_SpacedPoint; k -= nextk) {
                this.spaced10Points.push(spacedPoints[k]);
            }
        }
        */

        // Create margin geometry
        this._margin = conf.margin;
        const marginInVertices = [];
        const marginExtVertices = [];
        for (var i = 0; i < points.length-1; i++) {
            const vA = new THREE.Vector3().subVectors(cir.secPoints[i], points[i]);
            const vB = new THREE.Vector3().subVectors(cir.secPoints[i+1], points[i+1]);
            vA.normalize();
            vB.normalize();

            // Compute margin IN points
            vA.multiplyScalar(conf.margin);
            vB.multiplyScalar(conf.margin);
            const pmInA = points[i].clone();
            const pmInB = points[i+1].clone();
            pmInA.add(vA);
            pmInB.add(vB);

            marginInVertices.push(points[i]);
            marginInVertices.push(points[i+1]);
            marginInVertices.push(pmInB);
            marginInVertices.push(points[i]);
            marginInVertices.push(pmInB);
            marginInVertices.push(pmInA);

            // Compute margin EXT points
            vA.multiplyScalar(-1);
            vB.multiplyScalar(-1);
            const pmExtA = cir.secPoints[i].clone();
            const pmExtB = cir.secPoints[i+1].clone();
            pmExtA.add(vA);
            pmExtB.add(vB);
            
            marginExtVertices.push(pmExtA);
            marginExtVertices.push(pmExtB);
            marginExtVertices.push(cir.secPoints[i+1]);
            marginExtVertices.push(pmExtA);
            marginExtVertices.push(cir.secPoints[i+1]);
            marginExtVertices.push(cir.secPoints[i]);
        }

        // ----- THREE ------
        // MAIN VUE
        // margin mesh
        const inMaginGeo = new THREE.BufferGeometry().setFromPoints(marginInVertices);
        inMaginGeo.computeVertexNormals(); 
        const inMarginMesh = new THREE.Mesh(inMaginGeo, materials.matWhite);
        inMarginMesh.position.z += VERY_SMALL_GAP;

        const outMarginGeo = new THREE.BufferGeometry().setFromPoints(marginExtVertices);
        outMarginGeo.computeVertexNormals();
        const outMarginMesh = new THREE.Mesh(outMarginGeo, materials.matWhite);
        outMarginMesh.position.z += VERY_SMALL_GAP;

        // starting line mesh
        this.startingLinePoints = [points[maxSegLengthId], cir.secPoints[maxSegLengthId]];
        const startingLineMesh = new THREE.Mesh(createWidthLineBufferGeo(this.startingLinePoints, conf.margin,
                                                                         false, conf.width+1, conf.altitude).geo,
                                                materials.matWhite);
        this.slMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.startingLinePoints), materials.matLineWhite);
        this.slMesh.add(startingLineMesh);
        this.slMesh.position.z += VERY_SMALL_GAP;
                    
        // Checkpoints mesh
        let cp_id = getIdFromLength(startLength+(1 + Number(!this.clockwise))*sectorLength);
        this.checkpoint1LinePoints = [points[cp_id], cir.secPoints[cp_id]];
        this.cp1Mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.checkpoint1LinePoints), materials.matLineBlue);

        cp_id = getIdFromLength(startLength+(1 + Number(this.clockwise))*sectorLength);
        this.checkpoint2LinePoints = [points[cp_id], cir.secPoints[cp_id]];
        this.cp2Mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.checkpoint2LinePoints), materials.matLineBlue);

        // main mesh
        this.mesh = new THREE.Mesh(cir.geo, materials.matGrey);
        this.mesh.add(inMarginMesh, outMarginMesh, this.slMesh, this.cp1Mesh, this.cp2Mesh);
        this.mesh.position.z = SMALL_GAP;
        
        // MINIMAP VUE
        const startingLineMinimapMesh = new THREE.Mesh(createWidthLineBufferGeo(this.startingLinePoints, 10,
                                                                                false, conf.width+1).geo,
                                                       materials.matWhite);
        startingLineMinimapMesh.position.z += 1;
        this.minimapMesh = new THREE.Mesh(cir.geo, materials.matBlue);
        this.minimapMesh.add(startingLineMinimapMesh);

        // ------ AMMO -------
        const cirShape = cir.btShape;
        const mass = 0;

        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(0, 0, SMALL_GAP));
        t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        let motionState = new Ammo.btDefaultMotionState(t);

        let localInertia = new Ammo.btVector3(0, 0, 0);

        let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, cirShape, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        
        this.body.setFriction(1);

        // ----- TREES -----
        let tree_points = generate2DUniqueRandomPoints(rng, conf.treesCount, conf.treesCount, 
                                                       -conf.terrainSide/2, conf.terrainSide/2,
                                                       -conf.terrainSide/2, conf.terrainSide/2);
        let tree_points_cleaned = [];
        let treeInd = 0;
        let tempPos = new THREE.Object3D();
        const dstSq = conf.width*conf.width;
        const dstCircuitSq = 4*dstSq;
        for (var i = 0; i < tree_points.length; i++) {
            let treep = tree_points[i];

            // not close to circuit
            let bad = false;
            for (let trackp of spacedPoints) {
                let diff = new THREE.Vector3().subVectors(treep, trackp);
                if (diff.lengthSq() < dstCircuitSq) {
                    bad = true;
                    break;
                }
            }
            if (!bad) {

                // Larger area around starting points (for podium)
                let slp0 = this.startingLinePoints[0].clone();
                slp0.z = 0;
                let slp1 = this.startingLinePoints[1].clone();
                slp1.z = 0;
                let diffsl = new THREE.Vector3().subVectors(treep, slp0);
                if (diffsl.lengthSq() < 2*dstCircuitSq) continue;
                diffsl = new THREE.Vector3().subVectors(treep, slp1);
                if (diffsl.lengthSq() < 2*dstCircuitSq) continue;

                // not close to others
                let bad2 = false;
                for (let otreep of tree_points_cleaned) {
                    let diff = new THREE.Vector3().subVectors(treep, otreep);
                    if (diff.lengthSq() < dstSq) {
                        bad2 = true;
                        break;
                    }
                }

                if (!bad2) {
                    let tz = conf.altitude(treep.x, treep.y);

                    tempPos.position.set(treep.x, treep.y, tz+1.5);
                    tempPos.updateMatrix();
                    trees.truncs.setMatrixAt(treeInd, tempPos.matrix);

                    tempPos.position.set(treep.x, treep.y, tz+4);
                    tempPos.updateMatrix();
                    trees.cones.setMatrixAt(treeInd, tempPos.matrix);

                    tempPos.position.set(treep.x, treep.y-0.5, tz+SMALL_GAP);
                    tempPos.updateMatrix();
                    trees.shadows.setMatrixAt(treeInd, tempPos.matrix);

                    // Ammo
                    let tt = new Ammo.btTransform();
                    tt.setIdentity();
                    tt.setOrigin(new Ammo.btVector3(treep.x, treep.y, tz+1.5));
                    tt.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
                    let tmotionState = new Ammo.btDefaultMotionState(tt);
                    let tlocalInertia = new Ammo.btVector3(0, 0, 0);
                    let trbInfo = new Ammo.btRigidBodyConstructionInfo(0, tmotionState, trees.shape, tlocalInertia);
                    let tbody = new Ammo.btRigidBody(trbInfo);
                    tbody.setFriction(1);
                    trees.bodies.push(tbody);

                    tree_points_cleaned.push(treep);
                    treeInd++;
                }
            }
        }
        trees.truncs.count = treeInd;
        trees.cones.count = treeInd;
        trees.shadows.count = treeInd;
        trees.truncs.instanceMatrix.needsUpdate = true;
        trees.cones.instanceMatrix.needsUpdate = true;
        trees.shadows.instanceMatrix.needsUpdate = true;
    }

    getStartingPosition (lastSector) {
        // compute nose position && alignement vector
        let p = this.startingLinePoints;
        if (lastSector) {
            p = this.checkpoint2LinePoints;
        }
        const slv = new THREE.Vector3().subVectors(...p);
        slv.multiplyScalar(-1/2);

        const slvt = new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1), slv);
        slvt.normalize();
        slvt.multiplyScalar(this._margin);
        
        const nosePoint = p[0].clone();
        nosePoint.add(slv);
        if (this.clockwise) {
            nosePoint.add(slvt);
            slvt.multiplyScalar(-1);
        }

        return {nosePoint: nosePoint, directionVector: slvt, behindLine: !lastSector};
    }

    getPodiumPosition () {
        const slv = new THREE.Vector3().subVectors(...this.startingLinePoints);
        slv.multiplyScalar(-1.75);
        const point = this.startingLinePoints[0].clone();
        point.add(slv);

        const slvt = new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1), slv);
        slvt.normalize();

        return {p: point, d: slvt};
    }
}
