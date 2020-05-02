
class CircuitFactory {
    
    constructor (mainView, minimapView, physics) {
        this.mainScene = mainView.scene;
        this.minimapScene = minimapView.scene;
        this.phyWorld = physics.world;

        const terrain = new Terrain();
        this.mainScene.add(terrain.mesh);
        this.phyWorld.addRigidBody(terrain.body);

        this.currSeed = undefined;
        this.currCircuit = undefined;
    }

    createCircuit (seed) {
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
                      colorHSL: [0.1, 0.06, 0.33],
                      colorMargin: 0xffffff,
                      colorCP: 0x0000ff,
                      colorMinimap: 0x0000ff};

        const circuitPromise = new Promise(resolve => {
            if (seed == this.currSeed) {
                resolve(this.currCircuit);
            } else {
                if (this.currCircuit != undefined) {
                    this.mainScene.remove(this.currCircuit.mesh);
                    this.minimapScene.remove(this.currCircuit.minimapMesh);
                    this.phyWorld.removeCollisionObject(this.currCircuit.body);
                }
                resolve(new Circuit(CONF, seed));
            }
        });

        circuitPromise.then(value => {
            if (value.id != this.currSeed) {
                this.currSeed = seed;
                this.currCircuit = value;
                this.mainScene.add(value.mesh);
                this.minimapScene.add(value.minimapMesh);
                this.phyWorld.addRigidBody(value.body);
            }
        });
        return circuitPromise;
    }

}

class Circuit {

    constructor  (conf, id) {
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

        // Get the geometry && update points
        const cir = createWidthLineBufferGeo(points, conf.width, true, 1);
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

        // Create margin geometry (three & ammo)
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
        const matGrey = new THREE.MeshLambertMaterial({color: 0xffffff});
        matGrey.color.setHSL(conf.colorHSL[0], conf.colorHSL[1], conf.colorHSL[2]);
        const matWhite = new THREE.MeshLambertMaterial({color: conf.colorMargin});
        const matLineBlue = new THREE.LineBasicMaterial({color: conf.colorCP});
        const matLineWhite = new THREE.LineBasicMaterial({color: conf.colorMargin});

        // margin mesh
        const inMaginGeo = new THREE.BufferGeometry().setFromPoints(marginInVertices);
        inMaginGeo.computeVertexNormals(); 
        const inMarginMesh = new THREE.Mesh(inMaginGeo, matWhite);
        inMarginMesh.position.z += VERY_SMALL_GAP;

        const outMarginGeo = new THREE.BufferGeometry().setFromPoints(marginExtVertices);
        outMarginGeo.computeVertexNormals();
        const outMarginMesh = new THREE.Mesh(outMarginGeo, matWhite);
        outMarginMesh.position.z += VERY_SMALL_GAP;

        // starting line mesh
        this.startingLinePoints = [points[maxSegLengthId], cir.secPoints[maxSegLengthId]];
        const startingLineMesh = new THREE.Mesh(createWidthLineBufferGeo(this.startingLinePoints, conf.margin,
                                                                         false, conf.width+1).geo,
                                                matWhite);
        this.slMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.startingLinePoints), matLineWhite);
        this.slMesh.add(startingLineMesh);
        this.slMesh.position.z += VERY_SMALL_GAP;
                    
        // Checkpoints mesh
        let cp_id = getIdFromLength(startLength+(1 + Number(!this.clockwise))*sectorLength);
        this.checkpoint1LinePoints = [points[cp_id], cir.secPoints[cp_id]];
        this.cp1Mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.checkpoint1LinePoints), matLineBlue);

        cp_id = getIdFromLength(startLength+(1 + Number(this.clockwise))*sectorLength);
        this.checkpoint2LinePoints = [points[cp_id], cir.secPoints[cp_id]];
        this.cp2Mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.checkpoint2LinePoints), matLineBlue);

        // main mesh
        this.mesh = new THREE.Mesh(cir.geo, matGrey);
        this.mesh.add(inMarginMesh, outMarginMesh, this.slMesh, this.cp1Mesh, this.cp2Mesh);
        this.mesh.receiveShadow = true;
        this.mesh.position.z = conf.Z;
        
        // MINIMAP VUE
        const matBlue = new THREE.MeshBasicMaterial({color: conf.colorMinimap});
        const matWhite_minimap = new THREE.MeshBasicMaterial({color: conf.colorMargin});
        const startingLineMinimapMesh = new THREE.Mesh(createWidthLineBufferGeo(this.startingLinePoints, 10,
                                                                                false, conf.width+1).geo,
                                                       matWhite_minimap);
        startingLineMinimapMesh.position.z += SMALL_GAP;
        this.minimapMesh = new THREE.Mesh(cir.geo, matBlue);
        this.minimapMesh.add(startingLineMinimapMesh);

        // ------ AMMO -------
        const cirShape = cir.btShape;
        const mass = 0;

        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(0, 0, conf.Z));
        t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        let motionState = new Ammo.btDefaultMotionState(t);

        let localInertia = new Ammo.btVector3(0, 0, 0);

        let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, cirShape, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        
        this.body.setFriction(1);
    }

    getStartingPosition () {
        // compute nose position && alignement vector
        const slv = new THREE.Vector3().subVectors(...this.startingLinePoints);
        slv.multiplyScalar(-1/2);

        const slvt = new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1), slv);
        slvt.normalize();
        slvt.multiplyScalar(this._margin);
        
        const nosePoint = this.startingLinePoints[0].clone();
        nosePoint.add(slv);
        if (this.clockwise) {
            nosePoint.add(slvt);
            slvt.multiplyScalar(-1);
        }

        return {nosePoint: nosePoint, directionVector: slvt};
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
