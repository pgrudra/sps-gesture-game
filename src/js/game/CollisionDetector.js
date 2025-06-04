import * as THREE from 'three';

export class CollisionDetector {
    constructor() {
        this.boundingBoxHelper = new THREE.BoxHelper();
    }

    checkCollision(playerObject, obstacleObject) {
        // Get bounding boxes
        const playerBox = new THREE.Box3().setFromObject(playerObject);
        const obstacleBox = new THREE.Box3().setFromObject(obstacleObject);
        
        // Check if boxes intersect
        return playerBox.intersectsBox(obstacleBox);
    }

    checkSphereCollision(playerObject, obstacleObject, playerRadius = 0.5, obstacleRadius = 0.8) {
        const distance = playerObject.position.distanceTo(obstacleObject.position);
        return distance < (playerRadius + obstacleRadius);
    }

    getDistance(obj1, obj2) {
        return obj1.position.distanceTo(obj2.position);
    }

    isInCollisionZone(playerObject, obstacles, zoneDistance = 2) {
        return obstacles.some(obstacle => {
            const distance = this.getDistance(playerObject, obstacle.mesh);
            return distance <= zoneDistance && obstacle.mesh.position.z > playerObject.position.z - 1;
        });
    }
}