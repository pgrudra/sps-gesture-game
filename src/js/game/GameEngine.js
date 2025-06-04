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
        this.speed = 1.0;
        this.baseSpeed = 0.02;
        this.speedIncrement = 0.001;
        this.maxSpeed = 0.1;
        
        // Player state
        this.playerGesture = 'none';
        this.playerGestureObject = null;
        
        // Callbacks
        this.onGameOverCallback = null;
        this.onScoreUpdateCallback = null;
        
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
            'scissors': 0xC0C0C0   // silver
        };
    }

    async init() {
        this.initThreeJS();
        this.initManagers();
        this.setupEventListeners();
        this.startRenderLoop();
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
        this.camera.position.set(0, 2, 5);
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
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);
    }

    initManagers() {
        this.sceneManager = new SceneManager(this.scene);
        this.obstacleManager = new ObstacleManager(this.scene);
        this.collisionDetector = new CollisionDetector();
        
        this.sceneManager.createEnvironment();
        this.createPlayerGesture();
    }

    createPlayerGesture() {
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.2);
        const material = new THREE.MeshLambertMaterial({ color: 0x4ecdc4 });
        this.playerGestureObject = new THREE.Mesh(geometry, material);
        this.playerGestureObject.position.set(0, 1, 3);
        this.playerGestureObject.castShadow = true;
        this.scene.add(this.playerGestureObject);
        
        this.updatePlayerGestureVisual('none');
    }

    updatePlayerGestureVisual(gesture) {
        if (!this.playerGestureObject) return;
        
        // Remove existing geometry
        this.playerGestureObject.geometry.dispose();
        
        let newGeometry;
        let color = 0x4ecdc4;
        
        switch (gesture) {
            case 'rock':
                newGeometry = new THREE.SphereGeometry(0.5, 16, 16);
                color = this.gestureColors.rock;
                break;
            case 'paper':
                newGeometry = new THREE.PlaneGeometry(1, 1.2);
                color = this.gestureColors.paper;
                break;
            case 'scissors':
                newGeometry = new THREE.ConeGeometry(0.3, 1.2, 8);
                color = this.gestureColors.scissors;
                break;
            default:
                newGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.2);
                color = 0x4ecdc4;
        }
        
        this.playerGestureObject.geometry = newGeometry;
        this.playerGestureObject.material.color.setHex(color);
        
        // Add floating animation
        this.animatePlayerGesture();
    }

    animatePlayerGesture() {
        if (!this.playerGestureObject) return;
        
        const time = Date.now() * 0.005;
        this.playerGestureObject.position.y = 1 + Math.sin(time) * 0.1;
        this.playerGestureObject.rotation.y = Math.sin(time * 0.5) * 0.1;
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

    startGame(onGameOverCallback, onScoreUpdateCallback) {
        this.onGameOverCallback = onGameOverCallback;
        this.onScoreUpdateCallback = onScoreUpdateCallback;
        
        this.isRunning = true;
        this.score = 0;
        this.speed = 1.0;
        this.playerGesture = 'none';
        
        this.obstacleManager.reset();
        this.updateScore();
    }

    restartGame() {
        this.startGame(this.onGameOverCallback, this.onScoreUpdateCallback);
    }

    setPlayerGesture(gesture) {
        this.playerGesture = gesture;
        this.updatePlayerGestureVisual(gesture);
    }

    update(deltaTime) {
        if (!this.isRunning) return;
        
        // Update speed based on score
        this.speed = Math.min(1.0 + (this.score * 0.1), 3.0);
        const currentSpeed = this.baseSpeed * this.speed;
        
        // Update obstacles
        this.obstacleManager.update(currentSpeed);
        
        // Spawn new obstacles
        if (Math.random() < 0.02 * this.speed) {
            this.obstacleManager.spawnRandomObstacle();
        }
        
        // Check collisions
        const obstacles = this.obstacleManager.getActiveObstacles();
        for (let obstacle of obstacles) {
            if (this.collisionDetector.checkCollision(this.playerGestureObject, obstacle.mesh)) {
                this.handleCollision(obstacle);
                break;
            }
        }
        
        // Update scene effects
        this.sceneManager.update(deltaTime);
        
        // Animate player gesture
        this.animatePlayerGesture();
    }

    handleCollision(obstacle) {
        const obstacleType = obstacle.type;
        const requiredGesture = this.getRequiredGesture(obstacleType);
        
        if (this.playerGesture === requiredGesture) {
            // Correct gesture - score point
            this.score += Math.floor(this.speed * 10);
            this.audioManager.playSuccessSound();
            this.obstacleManager.removeObstacle(obstacle);
            this.updateScore();
            
            // Add particle effect
            this.sceneManager.createSuccessEffect(obstacle.mesh.position);
        } else {
            // Wrong gesture - game over
            this.gameOver();
        }
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

    gameOver() {
        this.isRunning = false;
        this.sceneManager.createGameOverEffect();
        
        if (this.onGameOverCallback) {
            this.onGameOverCallback(this.score);
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
}