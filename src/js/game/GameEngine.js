import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ObstacleManager } from './ObstacleManager.js';
import { CollisionDetector } from './CollisionDetector.js';

export class GameEngine {
    constructor(canvas, audioManager) {
        this.canvas = canvas;
        this.audioManager = audioManager;
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Game managers
        this.sceneManager = null;
        this.obstacleManager = null;
        this.collisionDetector = null;
        
        // Game state
        this.isRunning = false;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.speed = 1.0;
        this.baseSpeed = 0.015; // Slightly slower base speed
        this.speedIncrement = 0.0005; // More gradual speed increase
        this.maxSpeed = 0.08;
        
        // Player state
        this.playerGesture = 'none';
        this.playerGestureObject = null;
        this.gestureIndicator = null;
        
        // Spawn control
        this.lastSpawnTime = 0;
        this.minSpawnInterval = 2000; // Minimum 2 seconds between spawns
        this.spawnIntervalVariation = 1000; // +/- 1 second variation
        this.nextSpawnTime = 0;
        
        // Callbacks
        this.onGameOverCallback = null;
        this.onScoreUpdateCallback = null;
        this.onComboUpdateCallback = null;
        
        // Animation
        this.animationId = null;
        this.lastTime = 0;
        
        // Gesture to obstacle mapping
        this.gestureMap = {
            'rock': 'scissors',    // rock beats scissors
            'paper': 'rock',       // paper beats rock
            'scissors': 'paper'    // scissors beats paper
        };
        
        this.gestureColors = {
            'rock': 0x8B4513,      // brown
            'paper': 0xFFFFFF,     // white
            'scissors': 0xC0C0C0,  // silver
            'none': 0x4ecdc4       // teal
        };

        // Hint system
        this.hintObjects = [];
        this.showHints = true;
    }

    async init() {
        this.initThreeJS();
        await this.initManagers(); // Make this await
        this.setupEventListeners();
        this.createUI();
        this.startRenderLoop();
    }
    getLoadingStatus() {
        return this.obstacleManager ? this.obstacleManager.getModelLoadingStatus() : null;
    }
    
    initThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 100);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.canvas.offsetWidth / this.canvas.offsetHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 3, 6);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x87CEEB, 1);
        
        // Enhanced lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);

        // Add rim lighting
        const rimLight = new THREE.DirectionalLight(0x4ecdc4, 0.3);
        rimLight.position.set(-5, 5, -5);
        this.scene.add(rimLight);
    }

    initManagers() {
        this.sceneManager = new SceneManager(this.scene);
        this.obstacleManager = new ObstacleManager(this.scene);
        this.collisionDetector = new CollisionDetector();
        
        this.sceneManager.createEnvironment();
        this.createPlayerGesture();
        this.createGestureIndicator();
        this.scheduleNextSpawn();
    }

    createPlayerGesture() {
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.2);
        const material = new THREE.MeshLambertMaterial({ 
            color: 0x4ecdc4,
            transparent: true,
            opacity: 0.9
        });
        this.playerGestureObject = new THREE.Mesh(geometry, material);
        this.playerGestureObject.position.set(0, 1, 4);
        this.playerGestureObject.castShadow = true;
        this.scene.add(this.playerGestureObject);
        
        // Add glow effect
        const glowGeometry = new THREE.BoxGeometry(1, 1, 0.3);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x4ecdc4,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.playerGestureObject.add(glow);
        
        this.updatePlayerGestureVisual('none');
    }

    createGestureIndicator() {
        // Create a small indicator showing current gesture
        const geometry = new THREE.PlaneGeometry(0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        this.gestureIndicator = new THREE.Mesh(geometry, material);
        this.gestureIndicator.position.set(-3, 2, 4);
        this.gestureIndicator.lookAt(this.camera.position);
        this.scene.add(this.gestureIndicator);
    }

    updatePlayerGestureVisual(gesture) {
        if (!this.playerGestureObject) return;
        
        // Remove existing geometry
        this.playerGestureObject.geometry.dispose();
        
        let newGeometry;
        let color = this.gestureColors[gesture] || this.gestureColors.none;
        
        switch (gesture) {
            case 'rock':
                newGeometry = new THREE.SphereGeometry(0.6, 20, 20);
                break;
            case 'paper':
                newGeometry = new THREE.PlaneGeometry(1.2, 1.5);
                break;
            case 'scissors':
                // Create better scissors representation
                const scissorsGroup = new THREE.Group();
                
                // Create two cylindrical "blades"
                const bladeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
                const bladeMaterial = new THREE.MeshLambertMaterial({ color: color });
                
                const blade1 = new THREE.Mesh(bladeGeometry, bladeMaterial);
                blade1.position.set(-0.15, 0, 0);
                blade1.rotation.z = 0.2;
                
                const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
                blade2.position.set(0.15, 0, 0);
                blade2.rotation.z = -0.2;
                
                // Add handles
                const handleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
                const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
                
                const handle1 = new THREE.Mesh(handleGeometry, handleMaterial);
                handle1.position.set(-0.15, -0.5, 0);
                
                const handle2 = new THREE.Mesh(handleGeometry, handleMaterial);
                handle2.position.set(0.15, -0.5, 0);
                
                scissorsGroup.add(blade1, blade2, handle1, handle2);
                
                // Replace the mesh with the group
                this.scene.remove(this.playerGestureObject);
                this.playerGestureObject = scissorsGroup;
                this.playerGestureObject.position.set(0, 1, 4);
                this.playerGestureObject.castShadow = true;
                this.scene.add(this.playerGestureObject);
                return; // Skip the standard geometry update
                
            default:
                newGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.2);
                color = this.gestureColors.none;
        }
        
        this.playerGestureObject.geometry = newGeometry;
        this.playerGestureObject.material.color.setHex(color);
        
        // Add pulsing effect for active gestures
        if (gesture !== 'none') {
            this.playerGestureObject.material.opacity = 1.0;
        } else {
            this.playerGestureObject.material.opacity = 0.7;
        }
        
        // Add floating animation
        this.animatePlayerGesture();
    }

    animatePlayerGesture() {
        if (!this.playerGestureObject) return;
        
        const time = Date.now() * 0.005;
        this.playerGestureObject.position.y = 1 + Math.sin(time) * 0.15;
        
        // Add rotation for non-scissors gestures
        if (this.playerGesture !== 'scissors') {
            this.playerGestureObject.rotation.y = Math.sin(time * 0.5) * 0.1;
        }
        
        // Pulsing effect for active gestures
        if (this.playerGesture !== 'none') {
            const pulse = (Math.sin(time * 2) + 1) * 0.1 + 0.9;
            this.playerGestureObject.scale.setScalar(pulse);
        } else {
            this.playerGestureObject.scale.setScalar(1);
        }
    }

    createUI() {
        // Create hint system for upcoming obstacles
        this.createHintSystem();
    }

    createHintSystem() {
        // Create hint indicators on the sides of the screen
        const hintDistance = 8;
        const hintPositions = [
            { x: -2, z: -hintDistance },
            { x: 0, z: -hintDistance },
            { x: 2, z: -hintDistance }
        ];
        
        hintPositions.forEach((pos, index) => {
            const hintGeometry = new THREE.RingGeometry(0.3, 0.5, 8);
            const hintMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            const hint = new THREE.Mesh(hintGeometry, hintMaterial);
            hint.position.set(pos.x, 1.5, pos.z);
            hint.rotation.x = -Math.PI / 2;
            hint.visible = false;
            this.scene.add(hint);
            this.hintObjects.push(hint);
        });
    }

    scheduleNextSpawn() {
        const baseInterval = this.minSpawnInterval / this.speed;
        const variation = (Math.random() - 0.5) * this.spawnIntervalVariation;
        this.nextSpawnTime = Date.now() + baseInterval + variation;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    startGame(onGameOverCallback, onScoreUpdateCallback, onComboUpdateCallback) {
        this.onGameOverCallback = onGameOverCallback;
        this.onScoreUpdateCallback = onScoreUpdateCallback;
        this.onComboUpdateCallback = onComboUpdateCallback;
        
        this.isRunning = true;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.speed = 1.0;
        this.playerGesture = 'none';
        
        this.obstacleManager.reset();
        this.scheduleNextSpawn();
        this.updateScore();
        this.updateCombo();
    }

    restartGame() {
        this.startGame(this.onGameOverCallback, this.onScoreUpdateCallback, this.onComboUpdateCallback);
    }

    setPlayerGesture(gesture) {
        this.playerGesture = gesture;
        this.updatePlayerGestureVisual(gesture);
    }

    update(deltaTime) {
        if (!this.isRunning) return;
        
        // More gradual speed scaling
        this.speed = Math.min(1.0 + (this.score * 0.05), 2.5);
        const currentSpeed = this.baseSpeed * this.speed;
        
        // Update obstacles
        this.obstacleManager.update(currentSpeed);
        
        // Controlled obstacle spawning
        if (Date.now() >= this.nextSpawnTime) {
            this.obstacleManager.spawnRandomObstacle();
            this.scheduleNextSpawn();
        }
        
        // Update hints
        this.updateHints();
        
        // Check collisions
        const obstacles = this.obstacleManager.getActiveObstacles();
        for (let obstacle of obstacles) {
            // Check collision with player
            if (this.collisionDetector.checkCollision(this.playerGestureObject, obstacle.mesh)) {
                this.handleCollision(obstacle);
                break;
            }
            
            // Check if obstacle passed without interaction (game over)
            if (obstacle.mesh.position.z > 5) {
                this.gameOver();
                break;
            }
        }
        
        // Update scene effects
        this.sceneManager.update(deltaTime);
        
        // Animate player gesture
        this.animatePlayerGesture();
    }

    updateHints() {
        const obstacles = this.obstacleManager.getActiveObstacles();
        
        // Reset hint visibility
        this.hintObjects.forEach(hint => {
            hint.visible = false;
        });
        
        if (!this.showHints) return;
        
        // Show hints for obstacles in range
        obstacles.forEach(obstacle => {
            const distance = obstacle.mesh.position.z - this.playerGestureObject.position.z;
            
            // Show hint when obstacle is at medium distance
            if (distance < -3 && distance > -8) {
                const laneIndex = obstacle.lane + 1; // Convert -1,0,1 to 0,1,2
                if (laneIndex >= 0 && laneIndex < this.hintObjects.length) {
                    const hint = this.hintObjects[laneIndex];
                    hint.visible = true;
                    
                    // Set hint color based on required gesture
                    const requiredGesture = this.getRequiredGesture(obstacle.type);
                    const color = this.gestureColors[requiredGesture] || 0xffffff;
                    hint.material.color.setHex(color);
                    
                    // Animate hint
                    const time = Date.now() * 0.01;
                    hint.rotation.z = time;
                    hint.material.opacity = 0.5 + Math.sin(time * 2) * 0.2;
                }
            }
        });
    }

    handleCollision(obstacle) {
        const obstacleType = obstacle.type;
        const requiredGesture = this.getRequiredGesture(obstacleType);
        
        if (this.playerGesture === requiredGesture) {
            // Correct gesture - score point and increase combo
            const basePoints = 10;
            const speedBonus = Math.floor(this.speed * 5);
            const comboBonus = this.combo * 2;
            const points = basePoints + speedBonus + comboBonus;
            
            this.score += points;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);
            
            this.audioManager.playSuccessSound();
            this.obstacleManager.removeObstacle(obstacle);
            this.updateScore();
            this.updateCombo();
            
            // Enhanced success effect
            this.sceneManager.createSuccessEffect(obstacle.mesh.position, points);
            
            // Screen shake effect for high combos
            if (this.combo > 5) {
                this.createScreenShake();
            }
        } else {
            // Wrong gesture - game over
            this.gameOver();
        }
    }

    createScreenShake() {
        const originalPosition = this.camera.position.clone();
        const shakeIntensity = Math.min(0.1, this.combo * 0.01);
        
        // Quick shake animation
        let shakeTime = 0;
        const shakeInterval = setInterval(() => {
            this.camera.position.x = originalPosition.x + (Math.random() - 0.5) * shakeIntensity;
            this.camera.position.y = originalPosition.y + (Math.random() - 0.5) * shakeIntensity;
            
            shakeTime += 16;
            if (shakeTime > 200) {
                clearInterval(shakeInterval);
                this.camera.position.copy(originalPosition);
            }
        }, 16);
    }

    getRequiredGesture(obstacleType) {
        // Return the gesture that beats the obstacle
        switch (obstacleType) {
            case 'rock': return 'paper';     // paper beats rock
            case 'paper': return 'scissors'; // scissors beats paper
            case 'scissors': return 'rock';  // rock beats scissors
            default: return 'none';
        }
    }

    updateScore() {
        if (this.onScoreUpdateCallback) {
            this.onScoreUpdateCallback(this.score, this.speed.toFixed(1));
        }
    }

    updateCombo() {
        if (this.onComboUpdateCallback) {
            this.onComboUpdateCallback(this.combo, this.maxCombo);
        }
    }

    gameOver() {
        this.isRunning = false;
        this.combo = 0;
        this.sceneManager.createGameOverEffect();
        
        if (this.onGameOverCallback) {
            this.onGameOverCallback(this.score, this.maxCombo);
        }
    }

    startRenderLoop() {
        const animate = (currentTime) => {
            this.animationId = requestAnimationFrame(animate);
            
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            
            this.update(deltaTime);
            this.renderer.render(this.scene, this.camera);
        };
        
        animate(0);
    }

    // Settings
    toggleHints() {
        this.showHints = !this.showHints;
        if (!this.showHints) {
            this.hintObjects.forEach(hint => hint.visible = false);
        }
    }

    setDifficulty(level) {
        switch (level) {
            case 'easy':
                this.minSpawnInterval = 3000;
                this.baseSpeed = 0.01;
                this.speedIncrement = 0.0003;
                break;
            case 'normal':
                this.minSpawnInterval = 2000;
                this.baseSpeed = 0.015;
                this.speedIncrement = 0.0005;
                break;
            case 'hard':
                this.minSpawnInterval = 1500;
                this.baseSpeed = 0.02;
                this.speedIncrement = 0.0008;
                break;
        }
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clean up Three.js resources
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        this.renderer.dispose();
    }

    async initManagers() {
        this.sceneManager = new SceneManager(this.scene);
        this.obstacleManager = new ObstacleManager(this.scene);
        this.collisionDetector = new CollisionDetector();
        
        this.sceneManager.createEnvironment();
        this.createPlayerGesture();
        this.createGestureIndicator();
        
        // Wait for models to load before allowing gameplay
        console.log('Waiting for GLB models to load...');
        await this.obstacleManager.waitForModelsToLoad();
        console.log('GLB models loaded, game ready!');
        
        this.scheduleNextSpawn();
    }
}