import * as THREE from 'three';

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.obstaclePool = {
            rock: [],
            paper: [],
            scissors: []
        };
        this.spawnDistance = -20;
        this.despawnDistance = 10;
        
        this.initializePool();
    }

    initializePool() {
        // Pre-create obstacles for better performance
        const poolSize = 10;
        
        for (let i = 0; i < poolSize; i++) {
            this.obstaclePool.rock.push(this.createObstacle('rock'));
            this.obstaclePool.paper.push(this.createObstacle('paper'));
            this.obstaclePool.scissors.push(this.createObstacle('scissors'));
        }
    }

    createObstacle(type) {
        let geometry, material, mesh;
        
        switch (type) {
            case 'rock':
                geometry = new THREE.SphereGeometry(0.8, 12, 12);
                material = new THREE.MeshLambertMaterial({ 
                    color: 0x8B4513,
                    transparent: true,
                    opacity: 0.9
                });
                break;
                
            case 'paper':
                geometry = new THREE.PlaneGeometry(1.5, 2);
                material = new THREE.MeshLambertMaterial({ 
                    color: 0xFFFFFF,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.8
                });
                break;
                
            case 'scissors':
                // Create scissors using two cones
                const coneGeometry = new THREE.ConeGeometry(0.15, 1.5, 8);
                const coneMaterial = new THREE.MeshLambertMaterial({ 
                    color: 0xC0C0C0,
                    transparent: true,
                    opacity: 0.9
                });
                
                const group = new THREE.Group();
                
                const blade1 = new THREE.Mesh(coneGeometry, coneMaterial);
                blade1.position.set(-0.2, 0, 0);
                blade1.rotation.z = 0.3;
                
                const blade2 = new THREE.Mesh(coneGeometry, coneMaterial);
                blade2.position.set(0.2, 0, 0);
                blade2.rotation.z = -0.3;
                
                group.add(blade1);
                group.add(blade2);
                
                mesh = group;
                break;
                
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
                material = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        }
        
        if (!mesh) {
            mesh = new THREE.Mesh(geometry, material);
        }
        
        mesh.castShadow = true;
        mesh.userData = { 
            type: type,
            active: false,
            speed: 0,
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.02,
                y: (Math.random() - 0.5) * 0.02,
                z: (Math.random() - 0.5) * 0.02
            }
        };
        
        return mesh;
    }

    getObstacleFromPool(type) {
        const pool = this.obstaclePool[type];
        const obstacle = pool.find(obs => !obs.userData.active);
        
        if (obstacle) {
            return obstacle;
        } else {
            // Create new obstacle if pool is empty
            const newObstacle = this.createObstacle(type);
            pool.push(newObstacle);
            return newObstacle;
        }
    }

    spawnObstacle(type, lane = 0) {
        const obstacle = this.getObstacleFromPool(type);
        
        // Reset obstacle properties
        obstacle.position.set(
            lane * 2, // lanes: -2, 0, 2
            1.5,
            this.spawnDistance
        );
        
        obstacle.rotation.set(0, 0, 0);
        obstacle.userData.active = true;
        obstacle.userData.speed = 0;
        
        // Add floating animation
        obstacle.userData.floatOffset = Math.random() * Math.PI * 2;
        
        this.scene.add(obstacle);
        this.obstacles.push({
            mesh: obstacle,
            type: type,
            lane: lane
        });
        
        return obstacle;
    }

    spawnRandomObstacle() {
        const types = ['rock', 'paper', 'scissors'];
        const lanes = [-1, 0, 1]; // left, center, right
        
        const randomType = types[Math.floor(Math.random() * types.length)];
        const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
        
        return this.spawnObstacle(randomType, randomLane);
    }

    update(speed) {
        // Update all active obstacles
        this.obstacles = this.obstacles.filter(obstacle => {
            const mesh = obstacle.mesh;
            
            if (!mesh.userData.active) return false;
            
            // Move obstacle forward
            mesh.position.z += speed;
            
            // Add floating animation
            const time = Date.now() * 0.003;
            mesh.position.y = 1.5 + Math.sin(time + mesh.userData.floatOffset) * 0.2;
            
            // Rotate obstacle
            mesh.rotation.x += mesh.userData.rotationSpeed.x;
            mesh.rotation.y += mesh.userData.rotationSpeed.y;
            mesh.rotation.z += mesh.userData.rotationSpeed.z;
            
            // Remove obstacle if it's too far forward
            if (mesh.position.z > this.despawnDistance) {
                this.removeObstacle(obstacle);
                return false;
            }
            
            return true;
        });
    }

    removeObstacle(obstacle) {
        const mesh = obstacle.mesh;
        
        // Remove from scene
        this.scene.remove(mesh);
        
        // Mark as inactive for reuse
        mesh.userData.active = false;
        
        // Remove from active obstacles array
        const index = this.obstacles.indexOf(obstacle);
        if (index > -1) {
            this.obstacles.splice(index, 1);
        }
    }

    getActiveObstacles() {
        return this.obstacles.filter(obs => obs.mesh.userData.active);
    }

    getNearestObstacle(playerPosition) {
        let nearest = null;
        let minDistance = Infinity;
        
        this.obstacles.forEach(obstacle => {
            if (!obstacle.mesh.userData.active) return;
            
            const distance = playerPosition.distanceTo(obstacle.mesh.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = obstacle;
            }
        });
        
        return nearest;
    }

    getObstaclesInRange(position, range) {
        return this.obstacles.filter(obstacle => {
            if (!obstacle.mesh.userData.active) return false;
            
            const distance = position.distanceTo(obstacle.mesh.position);
            return distance <= range;
        });
    }

    reset() {
        // Remove all active obstacles
        this.obstacles.forEach(obstacle => {
            this.removeObstacle(obstacle);
        });
        
        this.obstacles = [];
    }

    // Difficulty scaling
    updateSpawnParameters(difficulty) {
        // Adjust spawn distance based on difficulty
        this.spawnDistance = -15 - (difficulty * 5);
    }

    // Debug methods
    getObstacleCount() {
        return this.obstacles.length;
    }

    getPoolStatus() {
        return {
            rock: {
                total: this.obstaclePool.rock.length,
                active: this.obstaclePool.rock.filter(obs => obs.userData.active).length
            },
            paper: {
                total: this.obstaclePool.paper.length,
                active: this.obstaclePool.paper.filter(obs => obs.userData.active).length
            },
            scissors: {
                total: this.obstaclePool.scissors.length,
                active: this.obstaclePool.scissors.filter(obs => obs.userData.active).length
            }
        };
    }

    dispose() {
        this.reset();
        
        // Dispose of all pooled obstacles
        Object.values(this.obstaclePool).forEach(pool => {
            pool.forEach(obstacle => {
                if (obstacle.geometry) obstacle.geometry.dispose();
                if (obstacle.material) {
                    if (Array.isArray(obstacle.material)) {
                        obstacle.material.forEach(material => material.dispose());
                    } else {
                        obstacle.material.dispose();
                    }
                }
            });
        });
        
        this.obstaclePool = { rock: [], paper: [], scissors: [] };
    }
}