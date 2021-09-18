
class Terrain {
    constructor () {
        const N = 50;
		const blockSize = 20;
        const offset = N*blockSize/2;

        // Points
		const terrainPoints = new Array();
		for (let x = 0; x < N; x+=1) {
		    let xl = new Array();
			for (let y = 0; y < N; y+=1) {
				xl.push(new THREE.Vector3(x*blockSize, y*blockSize, this.altitude(x*blockSize, y*blockSize)));
			}
			terrainPoints.push(xl);
		}

        const threeVertices = new Array();
        const ammoTMesh = new Ammo.btTriangleMesh();
        for (let x = 0; x < N-1; x++) {
            for (let y = 0; y < N-1; y++) {

                threeVertices.push(terrainPoints[x][y]);
                threeVertices.push(terrainPoints[x+1][y]);
                threeVertices.push(terrainPoints[x][y+1]);
                threeVertices.push(terrainPoints[x+1][y]);
                threeVertices.push(terrainPoints[x+1][y+1]);
                threeVertices.push(terrainPoints[x][y+1]);

                // convert points to btVector
                let btVert1 = new Ammo.btVector3(terrainPoints[x][y].x, terrainPoints[x][y].y, terrainPoints[x][y].z);
                let btVert2 = new Ammo.btVector3(terrainPoints[x+1][y].x, terrainPoints[x+1][y].y, terrainPoints[x+1][y].z);
                let btVert3 = new Ammo.btVector3(terrainPoints[x][y+1].x, terrainPoints[x][y+1].y, terrainPoints[x][y+1].z);
                let btVert4 = new Ammo.btVector3(terrainPoints[x+1][y+1].x, terrainPoints[x+1][y+1].y, terrainPoints[x+1][y+1].z);

                ammoTMesh.addTriangle(btVert1, btVert2, btVert3, true);
                ammoTMesh.addTriangle(btVert2, btVert4, btVert3, true);
            }
        }

        // Three
        const mapMaterial = new THREE.MeshLambertMaterial();
        mapMaterial.color.setHSL(0.38, 0.50, 0.25);

        const terrainGeo = new THREE.BufferGeometry().setFromPoints(threeVertices);
        terrainGeo.computeVertexNormals();

        this.mesh = new THREE.Mesh(terrainGeo, mapMaterial);
        this.mesh.position.copy(new THREE.Vector3(-offset, -offset, 0));

        // Ammo
        const ground = new Ammo.btBvhTriangleMeshShape(ammoTMesh, true, true);
        const mass = 0;

        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(-offset, -offset, 0));
        t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        let motionState = new Ammo.btDefaultMotionState(t);

        let localInertia = new Ammo.btVector3(0, 0, 0);
        let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, ground, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        
        this.body.setFriction(1);
    }

    altitude (x, y) {
        return 0;
    }
}