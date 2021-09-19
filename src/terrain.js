// ----- Perlin Noise Utils function ---------
const PERLINW = 64;

function getConstantPerlinVector(v){
    //v is the value from the permutation table
    let h = v & 3;
    if(h == 0)
        return new THREE.Vector2(1.0, 1.0);
    else if(h == 1)
        return new THREE.Vector2(-1.0, 1.0);
    else if(h == 2)
        return new THREE.Vector2(-1.0, -1.0);
    else
        return new THREE.Vector2(1.0, -1.0);
}

function perlinFade(t){
    return ((6*t - 15)*t + 10)*t*t*t;
}

function perlinLerp(t, a1, a2){
    return a1 + t*(a2-a1);
}

function perlinNoise(P, x, y){
    let X = Math.floor(x) & (PERLINW-1);
    let Y = Math.floor(y) & (PERLINW-1);

    let xf = x-Math.floor(x);
    let yf = y-Math.floor(y);

    let topRight = new THREE.Vector2(xf-1.0, yf-1.0);
    let topLeft = new THREE.Vector2(xf, yf-1.0);
    let bottomRight = new THREE.Vector2(xf-1.0, yf);
    let bottomLeft = new THREE.Vector2(xf, yf);
    
    //Select a value in the array for each of the 4 corners
    let valueTopRight = P[P[X+1]+Y+1];
    let valueTopLeft = P[P[X]+Y+1];
    let valueBottomRight = P[P[X+1]+Y];
    let valueBottomLeft = P[P[X]+Y];
    
    let dotTopRight = topRight.dot(getConstantPerlinVector(valueTopRight));
    let dotTopLeft = topLeft.dot(getConstantPerlinVector(valueTopLeft));
    let dotBottomRight = bottomRight.dot(getConstantPerlinVector(valueBottomRight));
    let dotBottomLeft = bottomLeft.dot(getConstantPerlinVector(valueBottomLeft));
    
    let u = perlinFade(xf);
    let v = perlinFade(yf);
    
    return perlinLerp(u,
                perlinLerp(v, dotBottomLeft, dotTopLeft),
                perlinLerp(v, dotBottomRight, dotTopRight)
            );

}
//-------------------------

class Terrain {
    constructor (rng) {
        const N = 40;
		this.blockSize = 25;
        this.size = N*this.blockSize;

        // Create Perlin permutation table
        this._perlinP = [];
        for(let i = 0; i < PERLINW; i++){
            this._perlinP.push(i);
        }
        // shuffle
        for(let e = PERLINW-1; e > 0; e--){
            let index = Math.round(rng()*(e-1));
            let temp  = this._perlinP[e];
            
            this._perlinP[e] = this._perlinP[index];
            this._perlinP[index] = temp;
        }
        // double it
        for(let i = 0; i < PERLINW; i++){
            this._perlinP.push(this._perlinP[i]);
        }

        // Points
		const terrainPoints = new Array();
        const hN = Math.round(N/2);
		for (let x = -hN; x < hN; x+=1) {
		    let xl = new Array();
			for (let y = -hN; y < hN; y+=1) {
				let z = this.altitude(x*this.blockSize, y*this.blockSize);
				xl.push(new THREE.Vector3(x*this.blockSize, y*this.blockSize, z));
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
        //const edges = new THREE.LineSegments(new THREE.WireframeGeometry(terrainGeo), new THREE.LineBasicMaterial({color: 0x000000}));
        //this.mesh.add(edges);

        // Ammo
        const ground = new Ammo.btBvhTriangleMeshShape(ammoTMesh, true, true);
        const mass = 0;

        let t = new Ammo.btTransform();
        t.setIdentity();
        t.setOrigin(new Ammo.btVector3(0, 0, 0));
        t.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        let motionState = new Ammo.btDefaultMotionState(t);

        let localInertia = new Ammo.btVector3(0, 0, 0);
        let rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, ground, localInertia);
        this.body = new Ammo.btRigidBody(rbInfo);
        
        this.body.setFriction(1);
    }

    altitude (x, y) {
        let z = 50*perlinNoise(this._perlinP, x*0.001, y*0.001);
        return z;
    }
    
}