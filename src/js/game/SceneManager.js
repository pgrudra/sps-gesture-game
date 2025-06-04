import * as THREE from 'three';

export class SceneManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.clouds = [];
        this.ground = null;
        this.backgroundElements = [];
        
        // Animation properties
        this.time = 0;
        this.cloudSpeed = 0.005;
    }

    createEnvironment() {
        this.createGround();
        this.createSkybox();
        this.createClouds();
        this.createBackgroundElements();
    }

    createGround() {
        // Create a scrolling ground plane
        const groundGeometry = new THREE.PlaneGeometry(50, 200);
        const groundTexture = this.createGroundTexture();
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            map: groundTexture,
            transparent: true,
            opacity: 0.8
        });
        
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -1;
        this.ground.receiveShadow = true;
        
        this.scene.add(this.ground);
    }

    createGroundTexture() {
        // Create a procedural ground texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base grass color
        ctx.fillStyle = '#4a7c59';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add some texture with random grass patterns
        ctx.fillStyle = '#5d8a6b';
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const size = Math.random() * 4 + 1;
            ctx.fillRect(x, y, size, size * 2);
        }
        
        // Add path/track marks
        ctx.strokeStyle = '#3a5c47';
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.moveTo(canvas.width * 0.4, i * 50);
            ctx.lineTo(canvas.width * 0.6, i * 50 + 20);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 8);
        
        return texture;
    }

    createSkybox() {
        // Create a simple gradient sky
        const skyGeometry = new THREE.SphereGeometry(200, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.8
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
    }

    createClouds() {
        // Create simple cloud-like objects
        for (let i = 0; i < 8; i++) {
            const cloud = this.createCloud();
            cloud.position.set(
                (Math.random() - 0.5) * 100,
                Math.random() * 20 + 10,
                -Math.random() * 100 - 20
            );
            this.clouds.push(cloud);
            this.scene.add(cloud);
        }
    }

    createCloud() {
        const cloudGroup = new THREE.Group();
        
        // Create cloud from multiple spheres
        for (let i = 0; i < 5; i++) {
            const cloudGeometry = new THREE.SphereGeometry(
                Math.random() * 3 + 2,
                8,
                8
            );
            const cloudMaterial = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.7
            });
            
            const cloudPart = new THREE.Mesh(cloudGeometry, cloudMaterial);
            cloudPart.position.set(
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 6
            );
            
            cloudGroup.add(cloudPart);
        }
        
        return cloudGroup;
    }

    createBackgroundElements() {
        // Create some background trees/mountains
        for (let i = 0; i < 15; i++) {
            const element = this.createBackgroundTree();
            element.position.set(
                (Math.random() - 0.5) * 80,
                0,
                -Math.random() * 30 - 30
            );
            this.backgroundElements.push(element);
            this.scene.add(element);
        }
    }

    createBackgroundTree() {
        const treeGroup = new THREE.Group();
        
        // Tree trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 4);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1;
        treeGroup.add(trunk);
        
        // Tree crown
        const crownGeometry = new THREE.SphereGeometry(2, 8, 8);
        const crownMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const crown = new THREE.Mesh(crownGeometry, crownMaterial);
        crown.position.y = 4;
        crown.scale.y = 1.5;
        treeGroup.add(crown);
        
        // Random scale for variety
        const scale = 0.5 + Math.random() * 0.8;
        treeGroup.scale.setScalar(scale);
        
        return treeGroup;
    }

    createSuccessEffect(position) {
        // Create particle burst effect for successful hits
        const particleCount = 20;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.05, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random(), 1, 0.7),
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            
            // Random velocity
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                Math.random() * 0.3 + 0.1,
                (Math.random() - 0.5) * 0.2
            );
            
            particle.life = 1.0;
            particle.decay = 0.02;
            
            particles.push(particle);
            this.scene.add(particle);
        }
        
        this.particles.push(...particles);
    }

    createGameOverEffect() {
        // Create dramatic screen shake effect
        this.createScreenShake();
        
        // Add explosion-like particle effect
        this.createExplosionEffect();
    }

    createScreenShake() {
        // This would be handled by the camera in GameEngine
        // Just create some visual feedback here
        const flash = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.3
            })
        );
        
        flash.position.set(0, 0, 4);
        this.scene.add(flash);
        
        // Fade out the flash
        const fadeFlash = () => {
            flash.material.opacity -= 0.05;
            if (flash.material.opacity > 0) {
                requestAnimationFrame(fadeFlash);
            } else {
                this.scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
            }
        };
        
        fadeFlash();
    }

    createExplosionEffect() {
        // Large particle explosion
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xff4444 : 0xffaa44,
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.set(0, 1, 2);
            
            // Explosive velocity
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 0.3 + Math.random() * 0.4;
            particle.velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 0.5 + 0.2,
                Math.sin(angle) * speed
            );
            
            particle.life = 1.0;
            particle.decay = 0.015;
            
            this.particles.push(particle);
            this.scene.add(particle);
        }
    }

    update(deltaTime) {
        this.time += deltaTime * 0.001;
        
        // Update clouds
        this.updateClouds();
        
        // Update particles
        this.updateParticles();
        
        // Update ground scrolling
        this.updateGround();
        
        // Animate background elements
        this.animateBackground();
    }

    updateClouds() {
        this.clouds.forEach((cloud, index) => {
            // Move clouds slowly
            cloud.position.z += this.cloudSpeed;
            
            // Reset cloud position when it goes too far
            if (cloud.position.z > 50) {
                cloud.position.z = -100;
                cloud.position.x = (Math.random() - 0.5) * 100;
            }
            
            // Gentle floating animation
            cloud.position.y += Math.sin(this.time + index) * 0.01;
        });
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            // Update position
            particle.position.add(particle.velocity);
            
            // Apply gravity
            particle.velocity.y -= 0.005;
            
            // Update life
            particle.life -= particle.decay;
            particle.material.opacity = particle.life;
            
            if (particle.life <= 0) {
                this.scene.remove(particle);
                particle.geometry.dispose();
                particle.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    updateGround() {
        if (this.ground && this.ground.material.map) {
            // Scroll the ground texture
            this.ground.material.map.offset.y += 0.01;
        }
    }

    animateBackground() {
        // Gentle sway for trees
        this.backgroundElements.forEach((element, index) => {
            if (element.children.length > 1) { // Trees have crown
                const crown = element.children[1];
                crown.rotation.z = Math.sin(this.time * 0.5 + index) * 0.05;
            }
        });
    }

    dispose() {
        // Clean up all created objects
        [...this.particles, ...this.clouds, ...this.backgroundElements].forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        
        if (this.ground) {
            this.scene.remove(this.ground);
            this.ground.geometry.dispose();
            this.ground.material.dispose();
            if (this.ground.material.map) {
                this.ground.material.map.dispose();
            }
        }
    }
}