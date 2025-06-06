import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ObstacleManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.obstaclePool = {
            rock: [],
            paper: [],
            scissors: []
        };
        this.spawnDistance = -15;
        this.despawnDistance = 8;
        this.minObstacleDistance = 8; // Minimum distance between obstacles
        
        // GLB Model paths
        this.modelPaths = {
            rock: 'src/assets/models/rock.glb',
            paper: 'src/assets/models/paper.glb',
            scissors: 'src/assets/models/scissors.glb'
        };
        
        // Loaded models cache
        this.loadedModels = {
            rock: null,
            paper: null,
            scissors: null
        };
        
        // Loading state
        this.modelsLoaded = false;
        this.loadingPromise = null;
        
        // GLB Loader
        this.gltfLoader = new GLTFLoader();
        
        // Visual enhancement materials (fallback and enhancement)
        this.materials = this.createMaterials();
        
        // Initialize models
        this.loadingPromise = this.loadModels();
    }

    createMaterials() {
        return {
            rock: new THREE.MeshPhongMaterial({ 
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9,
                shininess: 30,
                specular: 0x111111
            }),
            paper: new THREE.MeshPhongMaterial({ 
                color: 0xFFFFFF,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.85,
                shininess: 100,
                specular: 0x222222
            }),
            scissors: new THREE.MeshPhongMaterial({ 
                color: 0xC0C0C0,
                transparent: true,
                opacity: 0.9,
                shininess: 100,
                specular: 0x444444,
                metalness: 0.8
            })
        };
    }

    async loadModels() {
        console.log('Loading GLB models...');
        
        const loadPromises = Object.keys(this.modelPaths).map(async (type) => {
            try {
                const gltf = await this.loadGLTF(this.modelPaths[type]);
                this.loadedModels[type] = gltf;
                console.log(`Loaded ${type} model successfully`);
                return { type, success: true };
            } catch (error) {
                console.warn(`Failed to load ${type} model:`, error);
                console.log(`Will use fallback geometry for ${type}`);
                return { type, success: false, error };
            }
        });

        const results = await Promise.all(loadPromises);
        
        // Check which models loaded successfully
        const loadedCount = results.filter(r => r.success).length;
        console.log(`Successfully loaded ${loadedCount}/3 GLB models`);
        
        this.modelsLoaded = true;
        
        // Initialize pool after models are loaded
        this.initializePool();
        
        return results;
    }

    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                path,
                (gltf) => {
                    // Process the loaded model
                    const model = gltf.scene;
                    
                    // Ensure all meshes can cast and receive shadows
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Enhance materials if needed
                            if (child.material) {
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                    
                    resolve(gltf);
                },
                (progress) => {
                    // Optional: Handle loading progress
                    console.log(`Loading progress: ${(progress.loaded / progress.total * 100)}%`);
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    initializePool() {
        // Pre-create obstacles for better performance
        const poolSize = 15;
        
        for (let i = 0; i < poolSize; i++) {
            this.obstaclePool.rock.push(this.createObstacle('rock'));
            this.obstaclePool.paper.push(this.createObstacle('paper'));
            this.obstaclePool.scissors.push(this.createObstacle('scissors'));
        }
        
        console.log('Obstacle pool initialized');
    }

    createObstacle(type) {
        let mesh;
        
        // Try to use loaded GLB model first
        if (this.loadedModels[type] && this.loadedModels[type].scene) {
            mesh = this.createMeshFromGLB(type);
        } else {
            // Fallback to procedural geometry
            console.log(`Using fallback geometry for ${type}`);
            mesh = this.createFallbackMesh(type);
        }
        
        // Common setup for all obstacles
        this.setupObstacleMesh(mesh, type);

        // BoxHelper for debugging collisions
        mesh.userData.boxHelper = new THREE.BoxHelper(mesh, 0xff0000); // Red color
        mesh.userData.boxHelper.visible = false; // Initially hidden
        // this.scene.add(mesh.userData.boxHelper); // Add to scene once
        
        return mesh;
    }

    createMeshFromGLB(type) {
        const gltf = this.loadedModels[type];
        const model = gltf.scene.clone();
        
        // Normalize model scale and position
        this.normalizeModel(model, type);
        
        // Ensure proper materials and shadows
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Optionally enhance materials
                if (child.material) {
                    // Material properties can be modified here if needed
                    // child.material.transparent = true; // Removed forced transparency
                    // child.material.opacity = 0.9;    // Removed forced opacity
                }
            }
        });
        
        return model;
    }

    normalizeModel(model, type) {
        // Calculate bounding box to normalize size
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // Target size for obstacles (adjust as needed)
        const commonTargetSize = 1.0; // Standardized size for all obstacles
        
        const scale = commonTargetSize / maxDimension;
        model.scale.setScalar(scale);
        
        // Center the model
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center.multiplyScalar(scale));
    }

    createFallbackMesh(type) {
        // Original procedural geometry creation (unchanged from your original code)
        let geometry, mesh;
        const material = this.materials[type].clone();
        
        switch (type) {
            case 'rock':
                const rockGroup = new THREE.Group();
                
                const mainRockGeometry = new THREE.SphereGeometry(0.8, 16, 12);
                const mainRock = new THREE.Mesh(mainRockGeometry, material);
                mainRock.scale.set(1, 0.8, 1.1);
                
                const smallRockGeometry = new THREE.SphereGeometry(0.3, 8, 6);
                const smallRock1 = new THREE.Mesh(smallRockGeometry, material);
                smallRock1.position.set(0.4, 0.3, 0.2);
                smallRock1.scale.set(0.7, 0.6, 0.8);
                
                const smallRock2 = new THREE.Mesh(smallRockGeometry, material);
                smallRock2.position.set(-0.3, -0.2, 0.3);
                smallRock2.scale.set(0.5, 0.7, 0.6);
                
                rockGroup.add(mainRock, smallRock1, smallRock2);
                mesh = rockGroup;
                break;
                
            case 'paper':
                geometry = new THREE.PlaneGeometry(1.8, 2.4, 4, 4);
                
                const positions = geometry.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const z = Math.sin(x * 2) * 0.1 + Math.sin(y * 1.5) * 0.05;
                    positions.setZ(i, z);
                }
                geometry.computeVertexNormals();
                
                mesh = new THREE.Mesh(geometry, material);
                
                const paperEdgeGeometry = new THREE.EdgesGeometry(geometry);
                const paperEdgeMaterial = new THREE.LineBasicMaterial({ 
                    color: 0xcccccc,
                    transparent: true,
                    opacity: 0.5
                });
                const paperEdges = new THREE.LineSegments(paperEdgeGeometry, paperEdgeMaterial);
                mesh.add(paperEdges);
                break;
                
            case 'scissors':
                const scissorsGroup = new THREE.Group();
                
                const bladeGeometry = new THREE.CylinderGeometry(0.08, 0.04, 1.5, 12);
                
                const blade1 = new THREE.Mesh(bladeGeometry, material);
                blade1.position.set(-0.2, 0.1, 0);
                blade1.rotation.z = 0.3;
                blade1.scale.set(1, 1, 0.3);
                
                const blade2 = new THREE.Mesh(bladeGeometry, material);
                blade2.position.set(0.2, 0.1, 0);
                blade2.rotation.z = -0.3;
                blade2.scale.set(1, 1, 0.3);
                
                const holeGeometry = new THREE.TorusGeometry(0.15, 0.04, 8, 16);
                const holeMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0x444444,
                    transparent: true,
                    opacity: 0.8
                });
                
                const hole1 = new THREE.Mesh(holeGeometry, holeMaterial);
                hole1.position.set(-0.2, -0.6, 0);
                hole1.rotation.x = Math.PI / 2;
                
                const hole2 = new THREE.Mesh(holeGeometry, holeMaterial);
                hole2.position.set(0.2, -0.6, 0);
                hole2.rotation.x = Math.PI / 2;
                
                const pivotGeometry = new THREE.SphereGeometry(0.06, 8, 8);
                const pivot = new THREE.Mesh(pivotGeometry, holeMaterial);
                pivot.position.set(0, -0.3, 0);
                
                scissorsGroup.add(blade1, blade2, hole1, hole2, pivot);
                mesh = scissorsGroup;
                break;
                
            default:
                geometry = new THREE.BoxGeometry(1, 1, 1);
                mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0xff0000 }));
        }
        
        return mesh;
    }

    setupObstacleMesh(mesh, type) {
        // Common setup for all obstacle meshes
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { 
            type: type,
            active: false,
            speed: 0,
            rotationSpeed: {
                x: 0,
                y: 0,
                z: 0
            },
            originalScale: mesh.scale.clone(),
            pulsePhase: Math.random() * Math.PI * 2,
            isGLBModel: this.loadedModels[type] !== null
        };
        
        // Add glow effect for better visibility
        // this.addGlowEffect(mesh, type); // Glow effect removed
    }

    // addGlowEffect(mesh, type) { // Method removed
    //     // ... (content of removed method)
    // }

    // Method to check if models are ready
    async waitForModelsToLoad() {
        if (this.loadingPromise) {
            await this.loadingPromise;
        }
        return this.modelsLoaded;
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

    canSpawnObstacle() {
        // Check if there's enough distance from the last spawned obstacle
        if (this.obstacles.length === 0) return true;
        
        const lastObstacle = this.obstacles[this.obstacles.length - 1];
        const distance = Math.abs(lastObstacle.mesh.position.z - this.spawnDistance);
        
        return distance >= this.minObstacleDistance;
    }

    spawnObstacle(type, lane = 0) {
        // Don't spawn if too close to existing obstacles
        if (!this.canSpawnObstacle()) {
            return null;
        }
        
        const obstacle = this.getObstacleFromPool(type);
        
        // Reset obstacle properties
        obstacle.position.set(
            0, // Force center lane (x=0)
            1.0, // Adjusted Y-position to 1.0 to match player gesture (prev 0.5)
            this.spawnDistance
        );
        
        obstacle.rotation.set(0, 0, 0);
        obstacle.scale.copy(obstacle.userData.originalScale);
        obstacle.userData.active = true;
        obstacle.userData.speed = 0;
        obstacle.userData.lane = lane;
        
        // Add slight random variations
        const scaleVariation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2 scale
        obstacle.scale.multiplyScalar(scaleVariation);
        
        // Set rotation to face the player (assuming player is along positive Z from obstacle's perspective)
        obstacle.rotation.y = 0; // Rotate 180 degrees to face forward if model's front is +Z
        
        // Add floating animation with unique phase
        obstacle.userData.floatOffset = Math.random() * Math.PI * 2;
        
        // Update and show BoxHelper for the spawned obstacle
        if (obstacle.userData.boxHelper) {
            obstacle.userData.boxHelper.update(); // Update to reflect obstacle's new transform
            // obstacle.userData.boxHelper.visible = true;
        }

        this.scene.add(obstacle);
        this.obstacles.push({
            mesh: obstacle,
            type: type,
            lane: lane,
            spawnTime: Date.now()
        });
        
        return obstacle;
    }

    spawnRandomObstacle() {
        const types = ['rock', 'paper', 'scissors'];
        const lanes = [-1, 0, 1]; // left, center, right
        
        // Avoid spawning the same type consecutively in the same lane
        const availableCombinations = [];
        types.forEach(type => {
            lanes.forEach(lane => {
                // Check if this combination was used recently
                const recentObstacle = this.getRecentObstacleInLane(lane);
                if (!recentObstacle || recentObstacle.type !== type) {
                    availableCombinations.push({ type, lane });
                }
            });
        });
        
        if (availableCombinations.length === 0) {
            // Fallback to any combination
            const randomType = types[Math.floor(Math.random() * types.length)];
            // const randomLane = lanes[Math.floor(Math.random() * lanes.length)]; // Keep obstacles in center lane
            return this.spawnObstacle(randomType, 0); // Force lane 0
        }
        
        const combination = availableCombinations[Math.floor(Math.random() * availableCombinations.length)];
        return this.spawnObstacle(combination.type, 0); // Force lane 0
    }

    getRecentObstacleInLane(lane) {
        // Find the most recent obstacle in the specified lane
        const laneObstacles = this.obstacles
            .filter(obs => obs.lane === lane && obs.mesh.userData.active)
            .sort((a, b) => b.spawnTime - a.spawnTime);
        
        return laneObstacles.length > 0 ? laneObstacles[0] : null;
    }

    update(speed) {
        // Update all active obstacles
        this.obstacles = this.obstacles.filter(obstacle => {
            const mesh = obstacle.mesh;
            
            if (!mesh.userData.active) return false;
            
            // Move obstacle forward
            mesh.position.z += speed;
            mesh.position.y = 1.0; // Clamp Y-position to spawn height (1.0) to prevent oscillations
            
            // Enhanced floating animation (Y-component removed for clamping)
            const time = Date.now() * 0.003;
            const floatTime = time + mesh.userData.floatOffset;
            
            // More interesting rotation (adjust for GLB models) - Rotation removed
            // if (mesh.userData.isGLBModel) {
            //     // Gentler rotation for detailed GLB models
            //     mesh.rotation.y += mesh.userData.rotationSpeed.y * 0.5;
            // } else {
            //     // Original rotation for procedural geometry
            //     mesh.rotation.x += mesh.userData.rotationSpeed.x;
            //     mesh.rotation.y += mesh.userData.rotationSpeed.y;
            //     mesh.rotation.z += mesh.userData.rotationSpeed.z;
            // }
            
            // Add subtle pulsing effect
            const pulseTime = time * 2 + mesh.userData.pulsePhase;
            const pulseScale = 1 + Math.sin(pulseTime) * 0.05;
            mesh.scale.copy(mesh.userData.originalScale);
            mesh.scale.multiplyScalar(pulseScale);
            
            // Update glow effect - Glow effect removed
            // this.updateGlowEffect(mesh, time);
            
            // Remove obstacle if it's too far forward
            if (mesh.position.z > this.despawnDistance) {
                this.removeObstacle(obstacle);
                return false;
            }
            
            return true;
        });
    }

    // updateGlowEffect(mesh, time) { // Method removed
    //     // ... (content of removed method)
    // }

    removeObstacle(obstacle) {
        const mesh = obstacle.mesh;
        
        // Remove from scene
        this.scene.remove(mesh);
        
        // Mark as inactive for reuse
        mesh.userData.active = false;

        // Hide BoxHelper when obstacle is returned to pool or deactivated
        if (mesh.userData.boxHelper) {
            mesh.userData.boxHelper.visible = false;
        }
        
        // Reset transformations for reuse
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.copy(mesh.userData.originalScale);
        
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

    getUpcomingObstacles(count = 3) {
        // Get the next few obstacles approaching the player
        return this.obstacles
            .filter(obs => obs.mesh.userData.active && obs.mesh.position.z < 0)
            .sort((a, b) => b.mesh.position.z - a.mesh.position.z)
            .slice(0, count);
    }

    reset() {
        // Remove all active obstacles
        this.obstacles.forEach(obstacle => {
            this.removeObstacle(obstacle);
        });
        
        this.obstacles = [];
    }

    // Difficulty scaling
    updateDifficulty(level) {
        switch (level) {
            case 'easy':
                this.minObstacleDistance = 10;
                this.spawnDistance = -12;
                break;
            case 'normal':
                this.minObstacleDistance = 8;
                this.spawnDistance = -15;
                break;
            case 'hard':
                this.minObstacleDistance = 6;
                this.spawnDistance = -18;
                break;
        }
    }

    // Visual effects
    createDestroyEffect(position, type) {
        // Create particle explosion when obstacle is destroyed
        const particleCount = 20;
        const particles = new THREE.Group();
        
        const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: this.materials[type].color,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
            particle.position.copy(position);
            
            // Random velocity
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4
            );
            particle.userData.velocity = velocity;
            particle.userData.life = 1.0;
            
            particles.add(particle);
        }
        
        this.scene.add(particles);
        
        // Animate particles
        const animateParticles = () => {
            let aliveParticles = 0;
            
            particles.children.forEach(particle => {
                if (particle.userData.life > 0) {
                    particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.02));
                    particle.userData.velocity.multiplyScalar(0.98); // Friction
                    particle.userData.life -= 0.02;
                    particle.material.opacity = particle.userData.life;
                    aliveParticles++;
                }
            });
            
            if (aliveParticles > 0) {
                requestAnimationFrame(animateParticles);
            } else {
                // Clean up
                particles.children.forEach(particle => {
                    particle.geometry.dispose();
                    particle.material.dispose();
                });
                this.scene.remove(particles);
            }
        };
        
        animateParticles();
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

    getModelLoadingStatus() {
        return {
            modelsLoaded: this.modelsLoaded,
            loadedModels: Object.keys(this.loadedModels).reduce((acc, key) => {
                acc[key] = this.loadedModels[key] !== null;
                return acc;
            }, {})
        };
    }

    dispose() {
        // Dispose BoxHelpers from active obstacles
        this.obstacles.forEach(obstacleData => {
            if (obstacleData.mesh && obstacleData.mesh.userData.boxHelper) {
                this.scene.remove(obstacleData.mesh.userData.boxHelper);
                obstacleData.mesh.userData.boxHelper.dispose();
                obstacleData.mesh.userData.boxHelper = null;
            }
        });

        // Dispose BoxHelpers from pooled obstacles
        Object.values(this.obstaclePool).forEach(pool => {
            pool.forEach(mesh => {
                if (mesh.userData.boxHelper) {
                    this.scene.remove(mesh.userData.boxHelper);
                    mesh.userData.boxHelper.dispose();
                    mesh.userData.boxHelper = null;
                }
            });
        });

        this.reset(); // This will move active obstacles back to pool and deactivate them
        
        // Dispose of all pooled obstacles' geometries and materials
        Object.values(this.obstaclePool).forEach(pool => {
            pool.forEach(obstacleMesh => {
                if (obstacleMesh.geometry) obstacleMesh.geometry.dispose();
                if (obstacleMesh.material) {
                    if (Array.isArray(obstacleMesh.material)) {
                        obstacleMesh.material.forEach(material => material.dispose());
                    } else {
                        obstacleMesh.material.dispose();
                    }
                }
            });
        });
        
        // Dispose of the template materials stored in this.materials
        Object.values(this.materials).forEach(material => {
            material.dispose();
        });
        
        // Clean up loaded GLB models
        Object.values(this.loadedModels).forEach(gltf => {
            if (gltf && gltf.scene) {
                gltf.scene.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }
        });
        
        // Clear pools and references
        this.obstaclePool = { rock: [], paper: [], scissors: [] };
        this.loadedModels = { rock: null, paper: null, scissors: null };
        this.obstacles = [];
        console.log("ObstacleManager disposed.");
    }
}