const gameContainer = document.getElementById('gameContainer');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Add this line at the top with other initializations
let isGameInitialized = false;

// Game objects
const game = {
    isOver: false,
    score: 0,
    streak: 0,  // Add streak counter
    bestStreak: 0,  // Track best streak
    isMobile: false  // Add mobile detection
};

const car = {
    x: window.innerWidth / 2,
    y: window.innerHeight - 150,
    width: 100,  // Increased width for better detail
    height: 40,  // Increased height for better proportion
    speed: 8,    // Slightly increased speed
    rockets: [], // Array to store rocket particles
    isFlying: false // Track if car is off the road
};

const mountains = {
    offset: 0,
    speed: 2
};

// Update DAY_CYCLE to ensure sun/moon stays in view
const DAY_CYCLE = {
    DURATION: 30000,
    get SUN_START_Y() { return window.innerHeight * 0.8; }, // 80% down screen
    get SUN_PEAK_Y() { return window.innerHeight * 0.2; },  // 20% from top
    get PATH_RADIUS() { 
        // Calculate radius based on screen dimensions to keep sun/moon visible
        const minDimension = Math.min(window.innerWidth, window.innerHeight);
        return minDimension * 0.35; // 35% of smaller screen dimension
    },
    get CENTER_X() { 
        // Keep sun/moon path centered but not too close to edges
        const margin = window.innerWidth * 0.2;
        return margin + (window.innerWidth - margin * 2) * 0.5;
    }
};

// Update sun object with new properties
const sun = {
    x: DAY_CYCLE.CENTER_X,
    y: DAY_CYCLE.SUN_START_Y,
    radius: 40,
    rays: [],
    raySpeed: 5,
    shootTimer: 0,
    shootInterval: 180,
    isDay: true,
    cycleTime: 0,
    
    update(timestamp) {
        // Update cycle time
        this.cycleTime = (timestamp % DAY_CYCLE.DURATION) / DAY_CYCLE.DURATION;
        
        // Calculate position based on cycle time
        const angle = this.cycleTime * Math.PI * 2;
        this.x = DAY_CYCLE.CENTER_X + Math.cos(angle) * DAY_CYCLE.PATH_RADIUS;
        this.y = DAY_CYCLE.SUN_PEAK_Y + Math.sin(angle) * DAY_CYCLE.PATH_RADIUS;
        
        // Determine if it's day or night
        this.isDay = this.cycleTime < 0.5;
        
        // Update shooting interval based on time of day
        this.shootInterval = this.isDay ? 180 : 240; // Moon shoots slower
        
        // Update ray positions
        for (let ray of this.rays) {
            ray.progress += 0.01;
            ray.x = this.x + (ray.targetX - this.x) * ray.progress;
            ray.y = this.y + (ray.targetY - this.y) * ray.progress;
        }
        
        // Remove completed rays
        this.rays = this.rays.filter(ray => ray.progress < 1);
        
        // Add new rays
        this.shootTimer++;
        if (this.shootTimer >= this.shootInterval) {
            this.rays.push({
                x: this.x,
                y: this.y,
                targetX: car.x + Math.random() * 200 - 100,
                targetY: canvas.height - 150 + Math.random() * 100,
                progress: 0
            });
            this.shootTimer = 0;
        }
    }
};

const mathProblem = {
    num1: 0,
    num2: 0,
    operation: '+',
    answer: 0,
    userAnswer: '',
    isActive: false,
    generate() {
        // Generate numbers that will result in a sum between 10 and 20
        this.operation = Math.random() < 0.5 ? '+' : '-';
        
        if (this.operation === '+') {
            // For addition, ensure sum is between 10 and 20
            this.num1 = Math.floor(Math.random() * 9) + 5; // First number between 5 and 13
            this.num2 = Math.floor(Math.random() * (20 - this.num1 - 5)) + 5; // Second number to make sum between 10 and 20
        } else {
            // For subtraction, ensure result is between 10 and 20
            this.num2 = Math.floor(Math.random() * 9) + 1; // Second number between 1 and 9
            this.num1 = Math.floor(Math.random() * 9) + 10 + this.num2; // First number to make result between 10 and 20
        }
        
        this.answer = this.operation === '+' ? 
            this.num1 + this.num2 : 
            this.num1 - this.num2;
        
        this.userAnswer = '';
        this.isActive = true;
    }
};

// Add audio context and engine sound setup after other constants
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const engineSound = {
    oscillators: [],
    gainNode: null,
    filterNode: null,
    isPlaying: false,
    
    start() {
        if (this.isPlaying) return;
        
        this.gainNode = audioContext.createGain();
        this.filterNode = audioContext.createBiquadFilter();
        
        // Lower the filter frequency for deeper sound
        this.filterNode.type = 'bandpass';
        this.filterNode.frequency.setValueAtTime(200, audioContext.currentTime);
        this.filterNode.Q.setValueAtTime(2, audioContext.currentTime);
        
        // Lower base frequencies for a deeper engine sound
        const frequencies = [30, 60, 90, 120];  // Much lower frequencies
        this.oscillators = frequencies.map(freq => {
            const osc = audioContext.createOscillator();
            const oscGain = audioContext.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, audioContext.currentTime);
            
            // Reduce individual oscillator volumes
            oscGain.gain.setValueAtTime(0.08, audioContext.currentTime);
            
            osc.connect(oscGain);
            oscGain.connect(this.filterNode);
            
            osc.start();
            return { osc, gain: oscGain };
        });
        
        // Reduce main volume slightly
        this.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 0.1);
        
        this.filterNode.connect(this.gainNode);
        this.gainNode.connect(audioContext.destination);
        
        this.isPlaying = true;
    },
    
    stop() {
        if (!this.isPlaying) return;
        
        // Fade out the sound
        this.gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
        
        setTimeout(() => {
            if (this.oscillators.length) {
                this.oscillators.forEach(({ osc, gain }) => {
                    osc.stop();
                    osc.disconnect();
                    gain.disconnect();
                });
                this.oscillators = [];
                this.filterNode.disconnect();
                this.gainNode.disconnect();
                this.isPlaying = false;
            }
        }, 100);
    },
    
    adjustPitch(speed) {
        if (!this.isPlaying) return;
        
        // Lower the filter frequency range
        const baseFreq = 200;
        const maxFreq = 800;
        const newFreq = baseFreq + (speed * 50);  // Reduced multiplier
        this.filterNode.frequency.setValueAtTime(
            Math.min(newFreq, maxFreq),
            audioContext.currentTime
        );
        
        // Adjust oscillator frequencies with lower multiplier
        this.oscillators.forEach(({ osc }, index) => {
            const baseOscFreq = [30, 60, 90, 120][index];
            const speedMultiplier = 1 + (speed * 0.2);  // Reduced multiplier
            osc.frequency.setValueAtTime(
                baseOscFreq * speedMultiplier,
                audioContext.currentTime
            );
        });
    }
};

// Add confetti celebration system
const confetti = {
    gl: null,
    program: null,
    particles: [],
    maxParticles: 300,
    
    init() {
        // Create WebGL canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '1'; // Make sure confetti appears above game
        gameContainer.appendChild(this.canvas);
        
        // Initialize WebGL
        this.gl = this.canvas.getContext('webgl', {
            premultipliedAlpha: false,
            alpha: true
        });
        if (!this.gl) {
            console.error('WebGL not supported');
            return false;
        }
        
        // Create shader program
        this.program = this.createShaderProgram();
        if (!this.program) {
            console.error('Failed to create shader program');
            return false;
        }
        
        // Initialize buffers and attributes
        this.initBuffers();
        
        // Set canvas size
        this.resize();
        return true;
    },
    
    createShaderProgram() {
        const gl = this.gl;
        
        // Get shader source from HTML
        const vertexSource = document.getElementById('vertexShader').textContent;
        const fragmentSource = document.getElementById('fragmentShader').textContent;
        
        // Create shaders
        const vs = gl.createShader(gl.VERTEX_SHADER);
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        
        gl.shaderSource(vs, vertexSource);
        gl.shaderSource(fs, fragmentSource);
        
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            console.error('Vertex shader compile error:', gl.getShaderInfoLog(vs));
        }
        
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            console.error('Fragment shader compile error:', gl.getShaderInfoLog(fs));
        }
        
        // Create program
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
        }
        
        return program;
    },
    
    initBuffers() {
        const gl = this.gl;
        
        // Create particle data
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                position: [0, 0],
                velocity: [0, 0],
                color: [
                    Math.random(),
                    Math.random(),
                    Math.random()
                ],
                size: Math.random() * 10 + 5,
                rotation: Math.random() * Math.PI * 2,
                life: 0
            });
        }
        
        // Create buffers
        this.positionBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();
        this.sizeBuffer = gl.createBuffer();
        this.rotationBuffer = gl.createBuffer();
    },
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    },
    
    celebrate() {
        // Reset particles for new celebration
        for (let i = 0; i < this.maxParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 10 + 5;
            this.particles[i] = {
                position: [window.innerWidth / 2, window.innerHeight / 2],
                velocity: [
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed - 10
                ],
                color: [
                    Math.random(),
                    Math.random(),
                    Math.random()
                ],
                size: Math.random() * 10 + 5,
                rotation: Math.random() * Math.PI * 2,
                life: 1.0
            };
        }
    },
    
    update() {
        const gl = this.gl;
        
        // Update particles
        for (let particle of this.particles) {
            if (particle.life <= 0) continue;
            
            particle.position[0] += particle.velocity[0];
            particle.position[1] += particle.velocity[1];
            particle.velocity[1] += 0.3; // gravity
            particle.life -= 0.01;
            particle.rotation += 0.1;
        }
        
        // Update buffers
        const positions = [];
        const colors = [];
        const sizes = [];
        const rotations = [];
        
        for (let particle of this.particles) {
            if (particle.life <= 0) continue;
            positions.push(...particle.position);
            colors.push(...particle.color);
            sizes.push(particle.size);
            rotations.push(particle.rotation);
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.STATIC_DRAW);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rotations), gl.STATIC_DRAW);
    },
    
    render() {
        const gl = this.gl;
        
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        // Clear with transparency
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.useProgram(this.program);
        
        // Set uniforms
        const projectionMatrix = [
            2 / this.canvas.width, 0, 0, 0,
            0, -2 / this.canvas.height, 0, 0,
            0, 0, 1, 0,
            -1, 1, 0, 1
        ];
        
        const projectionLocation = gl.getUniformLocation(this.program, 'projection');
        gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);
        
        const timeLocation = gl.getUniformLocation(this.program, 'time');
        gl.uniform1f(timeLocation, performance.now() / 1000);
        
        // Draw particles
        const positionLocation = gl.getAttribLocation(this.program, 'position');
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        const colorLocation = gl.getAttribLocation(this.program, 'color');
        gl.enableVertexAttribArray(colorLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
        
        const sizeLocation = gl.getAttribLocation(this.program, 'size');
        gl.enableVertexAttribArray(sizeLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
        gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);
        
        const rotationLocation = gl.getAttribLocation(this.program, 'rotation');
        gl.enableVertexAttribArray(rotationLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.rotationBuffer);
        gl.vertexAttribPointer(rotationLocation, 1, gl.FLOAT, false, 0, 0);
        
        gl.drawArrays(gl.POINTS, 0, this.particles.length);
    }
};

// Add rocket particle system
const rocketParticles = {
    particles: [],
    maxParticles: 50,
    
    addParticle(x, y) {
        if (this.particles.length >= this.maxParticles) return;
        
        this.particles.push({
            x: x,
            y: y,
            size: Math.random() * 8 + 4,
            speed: Math.random() * 2 + 1,
            life: 1,
            color: Math.random() < 0.5 ? '#FF4500' : '#FFA500'
        });
    },
    
    update() {
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => {
            p.y += p.speed;
            p.life -= 0.02;
            p.size *= 0.98;
        });
    },
    
    draw() {
        this.particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Add glow effect
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
            gradient.addColorStop(0, p.color);
            gradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
};

// Add touch controls
const touchControls = {
    buttons: {
        left: { x: 0, y: 0, width: 80, height: 80, active: false },
        right: { x: 0, y: 0, width: 80, height: 80, active: false },
        up: { x: 0, y: 0, width: 80, height: 80, active: false },
        down: { x: 0, y: 0, width: 80, height: 80, active: false }
    },
    
    init() {
        // Position buttons for mobile
        const buttonSpacing = 20;
        const bottomMargin = 40;
        const sideMargin = 40;
        
        // Left/Right buttons
        this.buttons.left.x = sideMargin;
        this.buttons.left.y = canvas.height - this.buttons.left.height - bottomMargin;
        this.buttons.right.x = sideMargin + this.buttons.left.width + buttonSpacing;
        this.buttons.right.y = this.buttons.left.y;
        
        // Up/Down buttons
        this.buttons.up.x = canvas.width - sideMargin - this.buttons.up.width * 2 - buttonSpacing;
        this.buttons.up.y = canvas.height - this.buttons.up.height - bottomMargin;
        this.buttons.down.x = canvas.width - sideMargin - this.buttons.down.width;
        this.buttons.down.y = this.buttons.up.y;
    },
    
    draw() {
        if (!game.isMobile) return;
        
        // Draw control buttons
        ctx.save();
        ctx.globalAlpha = 0.6;
        
        // Draw button backgrounds
        for (let key in this.buttons) {
            const btn = this.buttons[key];
            ctx.fillStyle = btn.active ? '#FFD700' : '#555555';
            ctx.beginPath();
            ctx.arc(
                btn.x + btn.width/2,
                btn.y + btn.height/2,
                btn.width/2,
                0,
                Math.PI * 2
            );
            ctx.fill();
            
            // Draw arrow indicators
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            switch(key) {
                case 'left':
                    ctx.moveTo(btn.x + btn.width * 0.7, btn.y + btn.height * 0.5);
                    ctx.lineTo(btn.x + btn.width * 0.3, btn.y + btn.height * 0.3);
                    ctx.lineTo(btn.x + btn.width * 0.3, btn.y + btn.height * 0.7);
                    break;
                case 'right':
                    ctx.moveTo(btn.x + btn.width * 0.3, btn.y + btn.height * 0.5);
                    ctx.lineTo(btn.x + btn.width * 0.7, btn.y + btn.height * 0.3);
                    ctx.lineTo(btn.x + btn.width * 0.7, btn.y + btn.height * 0.7);
                    break;
                case 'up':
                    ctx.moveTo(btn.x + btn.width * 0.5, btn.y + btn.height * 0.3);
                    ctx.lineTo(btn.x + btn.width * 0.3, btn.y + btn.height * 0.7);
                    ctx.lineTo(btn.x + btn.width * 0.7, btn.y + btn.height * 0.7);
                    break;
                case 'down':
                    ctx.moveTo(btn.x + btn.width * 0.5, btn.y + btn.height * 0.7);
                    ctx.lineTo(btn.x + btn.width * 0.3, btn.y + btn.height * 0.3);
                    ctx.lineTo(btn.x + btn.width * 0.7, btn.y + btn.height * 0.3);
                    break;
            }
            ctx.fill();
        }
        
        ctx.restore();
    },
    
    handleTouchStart(e) {
        if (!game.isMobile) return;
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        for (let key in this.buttons) {
            const btn = this.buttons[key];
            if (this.isPointInButton(x, y, btn)) {
                btn.active = true;
                keys[`Arrow${key.charAt(0).toUpperCase() + key.slice(1)}`] = true;
            }
        }
    },
    
    handleTouchEnd(e) {
        if (!game.isMobile) return;
        for (let key in this.buttons) {
            this.buttons[key].active = false;
            keys[`Arrow${key.charAt(0).toUpperCase() + key.slice(1)}`] = false;
        }
    },
    
    isPointInButton(x, y, btn) {
        const dx = x - (btn.x + btn.width/2);
        const dy = y - (btn.y + btn.height/2);
        return Math.sqrt(dx * dx + dy * dy) <= btn.width/2;
    }
};

// Update resizeCanvas function
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    car.y = canvas.height - 150;
    
    // Check if we're on mobile
    game.isMobile = window.innerWidth <= 768;
    
    // Update touch controls if on mobile
    if (game.isMobile) {
        touchControls.init();
    }
    
    // Update road position
    drawRoad();
}

// Initial setup
resizeCanvas();
gameContainer.appendChild(canvas);

// Event listeners
window.addEventListener('resize', resizeCanvas);

const keys = {};

function drawCar() {
    const x = car.x;
    const y = car.y;
    
    // Car shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 50, y + 38, 45, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw rocket effects if car is flying
    if (car.isFlying) {
        // Add new rocket particles
        rocketParticles.addParticle(x + 25, y + 25);
        rocketParticles.addParticle(x + 75, y + 25);
        
        // Draw rocket flames
        const flameGradient = ctx.createLinearGradient(x, y + 25, x, y + 45);
        flameGradient.addColorStop(0, '#FF4500');
        flameGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        
        ctx.fillStyle = flameGradient;
        ctx.beginPath();
        ctx.moveTo(x + 20, y + 25);
        ctx.lineTo(x + 30, y + 45);
        ctx.lineTo(x + 20, y + 45);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(x + 70, y + 25);
        ctx.lineTo(x + 80, y + 45);
        ctx.lineTo(x + 70, y + 45);
        ctx.closePath();
        ctx.fill();
    }

    // Main body
    ctx.fillStyle = '#FF0000'; // Ferrari Red
    ctx.beginPath();
    ctx.moveTo(x, y + 25);              // Front bottom
    ctx.lineTo(x + 20, y + 25);         // Bottom line
    ctx.lineTo(x + 25, y + 20);         // Front wheel well
    ctx.lineTo(x + 40, y + 20);         // Lower body line
    ctx.lineTo(x + 45, y + 15);         // Door bottom
    ctx.lineTo(x + 75, y + 15);         // Rear bottom
    ctx.lineTo(x + 90, y + 20);         // Rear slope
    ctx.lineTo(x + 95, y + 25);         // Rear end
    ctx.lineTo(x + 95, y + 15);         // Rear top
    ctx.lineTo(x + 75, y + 10);         // Roof line
    ctx.lineTo(x + 50, y + 8);          // Middle roof
    ctx.lineTo(x + 30, y + 8);          // Windshield top
    ctx.lineTo(x + 15, y + 15);         // Hood
    ctx.lineTo(x, y + 20);              // Front nose
    ctx.closePath();
    ctx.fill();

    // Windows
    ctx.fillStyle = '#87CEEB';
    ctx.beginPath();
    ctx.moveTo(x + 32, y + 10);         // Windshield
    ctx.lineTo(x + 50, y + 10);         // Top frame
    ctx.lineTo(x + 70, y + 12);         // Rear window
    ctx.lineTo(x + 45, y + 17);         // Bottom frame
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#1a1a1a';
    // Front wheel
    ctx.beginPath();
    ctx.arc(x + 25, y + 25, 8, 0, Math.PI * 2);
    ctx.fill();
    // Rear wheel
    ctx.beginPath();
    ctx.arc(x + 75, y + 25, 8, 0, Math.PI * 2);
    ctx.fill();

    // Wheel rims
    ctx.fillStyle = '#DDD';
    ctx.beginPath();
    ctx.arc(x + 25, y + 25, 5, 0, Math.PI * 2);
    ctx.arc(x + 75, y + 25, 5, 0, Math.PI * 2);
    ctx.fill();

    // Headlight
    ctx.fillStyle = '#FFFF99';
    ctx.beginPath();
    ctx.ellipse(x + 5, y + 18, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Taillight
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.ellipse(x + 92, y + 18, 3, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ferrari logo
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x + 50, y + 15, 3, 0, Math.PI * 2);
    ctx.fill();
}

// Add star field
const stars = Array.from({length: 200}, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * (window.innerHeight * 0.7), // Stars only in upper part
    size: Math.random() * 2 + 1,
    twinkle: Math.random()
}));

// Update drawMountains function
function drawMountains() {
    const mountainHeight = window.innerHeight * 0.4;
    const mountainWidth = window.innerWidth * 0.4;
    const baseY = window.innerHeight - 200;
    
    // Draw mountains
    for (let i = 0; i < 4; i++) {
        const x = ((i * mountainWidth) + mountains.offset) % (mountainWidth * 4) - mountainWidth;
        
        // Main mountain body
        ctx.fillStyle = '#4a7325';
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + mountainWidth/2, baseY - mountainHeight);
        ctx.lineTo(x + mountainWidth, baseY);
        ctx.fill();
        
        // Snow caps
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + mountainWidth/2, baseY - mountainHeight);
        ctx.lineTo(x + mountainWidth/2 - mountainWidth/6, baseY - mountainHeight * 0.8);
        ctx.lineTo(x + mountainWidth/2 + mountainWidth/6, baseY - mountainHeight * 0.8);
        ctx.fill();
    }
}

// Update drawRoad function
function drawRoad() {
    const roadHeight = 200;
    const baseY = window.innerHeight - roadHeight;
    
    // Draw road
    ctx.fillStyle = '#555555';
    ctx.fillRect(0, baseY, canvas.width, roadHeight);
    
    // Draw road lines
    ctx.fillStyle = '#ffffff';
    const lineWidth = 50;
    const lineSpacing = 100;
    const lineY = baseY + (roadHeight/2) - 10;
    
    for (let i = 0; i < canvas.width; i += lineSpacing) {
        ctx.fillRect(
            i + mountains.offset % lineSpacing, 
            lineY, 
            lineWidth, 
            10
        );
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 50);
    ctx.font = '24px Arial';
    ctx.fillText('Score: ' + game.score, canvas.width/2, canvas.height/2);
    
    if (mathProblem.isActive) {
        ctx.fillText(
            `Solve: ${mathProblem.num1} ${mathProblem.operation} ${mathProblem.num2} = ${mathProblem.userAnswer}_`, 
            canvas.width/2, 
            canvas.height/2 + 50
        );
        ctx.font = '20px Arial';
        ctx.fillText('Use number keys to answer, Enter to submit', 
            canvas.width/2, 
            canvas.height/2 + 90
        );
    }
}

// Update drawSun function with better sky colors and transitions
function drawSun() {
    const timeOfDay = sun.cycleTime;
    const skyProgress = Math.sin(timeOfDay * Math.PI);
    
    // Create gradient for sky
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    
    if (sun.isDay) {
        // Day colors (deep blue to light blue)
        const skyBlue = `rgb(135, 206, ${Math.floor(237 * skyProgress)})`;
        const horizonBlue = `rgb(173, 216, ${Math.floor(230 * skyProgress)})`;
        gradient.addColorStop(0, '#1e90ff');   // Deep blue at top
        gradient.addColorStop(0.6, skyBlue);    // Sky blue
        gradient.addColorStop(1, horizonBlue);  // Lighter blue at horizon
    } else {
        // Night colors (dark blue to navy with purple hints)
        const nightBlue = `rgb(10, 10, ${Math.floor(40 + 20 * skyProgress)})`;
        const horizonPurple = `rgb(${Math.floor(30 + 20 * skyProgress)}, 10, ${Math.floor(50 + 20 * skyProgress)})`;
        gradient.addColorStop(0, '#000033');    // Dark blue at top
        gradient.addColorStop(0.6, nightBlue);   // Night blue
        gradient.addColorStop(1, horizonPurple); // Purple-ish horizon
    }
    
    // Fill sky with gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars at night with improved twinkling
    if (!sun.isDay) {
        stars.forEach(star => {
            const twinkle = 0.3 + Math.sin(Date.now() * 0.001 + star.twinkle * 10) * 0.7;
            const starGradient = ctx.createRadialGradient(
                star.x, star.y, 0,
                star.x, star.y, star.size * 2
            );
            starGradient.addColorStop(0, `rgba(255, 255, 255, ${twinkle})`);
            starGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.fillStyle = starGradient;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    // Draw celestial body (sun or moon)
    if (sun.isDay) {
        // Draw sun
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Sun rays
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 4;
        
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI / 4) + (Date.now() / 1000);
            const innerRadius = sun.radius + 10;
            const outerRadius = sun.radius + 30;
            
            ctx.beginPath();
            ctx.moveTo(
                sun.x + Math.cos(angle) * innerRadius,
                sun.y + Math.sin(angle) * innerRadius
            );
            ctx.lineTo(
                sun.x + Math.cos(angle) * outerRadius,
                sun.y + Math.sin(angle) * outerRadius
            );
            ctx.stroke();
        }
    } else {
        // Draw moon
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, sun.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Moon craters
        ctx.fillStyle = '#E0E0E0';
        const craters = [
            { x: -15, y: -10, r: 8 },
            { x: 10, y: 5, r: 6 },
            { x: -5, y: 15, r: 7 }
        ];
        
        craters.forEach(crater => {
            ctx.beginPath();
            ctx.arc(
                sun.x + crater.x, 
                sun.y + crater.y, 
                crater.r, 
                0, 
                Math.PI * 2
            );
            ctx.fill();
        });
    }
    
    // Draw attack rays
    ctx.fillStyle = sun.isDay ? 
        'rgba(255, 165, 0, 0.6)' : // Sun rays
        'rgba(200, 200, 255, 0.6)'; // Moon rays
    
    for (let ray of sun.rays) {
        ctx.beginPath();
        ctx.arc(ray.x, ray.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        const gradient = ctx.createRadialGradient(ray.x, ray.y, 0, ray.x, ray.y, 30);
        gradient.addColorStop(0, sun.isDay ? 
            'rgba(255, 165, 0, 0.4)' : 
            'rgba(200, 200, 255, 0.4)'
        );
        gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ray.x, ray.y, 30, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Update checkCollisions function
function checkCollisions() {
    if (game.isOver) return;
    
    for (let ray of sun.rays) {
        const dx = (car.x + car.width/2) - ray.x;
        const dy = (car.y + car.height/2) - ray.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 40) {
            game.isOver = true;
            break;
        }
    }
}

// Update scoreDisplay for bigger, more prominent display
const scoreDisplay = {
    value: 0,
    targetValue: 0,
    multiplier: 1,
    combo: 0,
    particles: [],
    
    update() {
        // Smooth score animation
        this.value += (this.targetValue - this.value) * 0.1;
        
        // Update particles
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => {
            p.y += p.vy;
            p.x += p.vx;
            p.life -= 0.02;
            p.rotation += p.rotationSpeed;
        });
    },
    
    draw() {
        // Draw main score with enhanced glow effect
        ctx.save();
        ctx.shadowColor = sun.isDay ? '#FFD700' : '#87CEEB';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${Math.floor(this.value)}`, 30, 60);
        
        // Draw streak counter
        if (game.streak > 0) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '36px Arial';
            ctx.fillText(`Streak: ${game.streak}`, 30, 110);
            
            // Draw best streak
            if (game.bestStreak > 0) {
                ctx.fillStyle = '#FF4500';
                ctx.font = '28px Arial';
                ctx.fillText(`Best: ${game.bestStreak}`, 30, 150);
            }
        }
        
        // Draw multiplier if active
        if (this.multiplier > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '36px Arial';
            ctx.fillText(`x${this.multiplier}`, 250, 60);
        }
        
        // Draw combo counter if active
        if (this.combo > 0) {
            ctx.fillStyle = '#FF4500';
            ctx.font = '28px Arial';
            ctx.fillText(`Combo: ${this.combo}`, 30, 100);
        }
        
        // Draw score particles with larger text
        this.particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.font = '24px Arial';
            ctx.fillStyle = `rgba(255, 215, 0, ${p.life})`;
            ctx.fillText(`+${p.value}`, 0, 0);
            ctx.restore();
        });
        
        ctx.restore();
    },
    
    addPoints(points) {
        this.targetValue += points * this.multiplier;
        this.combo++;
        if (this.combo > 5) this.multiplier = 2;
        if (this.combo > 10) this.multiplier = 3;
        
        // Add floating score particle
        this.particles.push({
            value: points * this.multiplier,
            x: 150,
            y: 35,
            vx: Math.random() * 2 - 1,
            vy: -2,
            life: 1,
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.2
        });
    },
    
    reset() {
        this.value = 0;
        this.targetValue = 0;
        this.multiplier = 1;
        this.combo = 0;
        this.particles = [];
        game.streak = 0;  // Reset streak when score is reset
    }
};

// Add title display object after scoreDisplay
const titleDisplay = {
    draw() {
        ctx.save();
        
        // Position in top right
        const x = canvas.width - 40;
        const y = 60;
        
        // Create fiery gradient for text
        const gradient = ctx.createLinearGradient(x - 300, y - 30, x - 300, y + 10);
        gradient.addColorStop(0, '#FF4500');   // Orange-red
        gradient.addColorStop(0.5, '#FFD700');  // Gold
        gradient.addColorStop(1, '#FF0000');    // Red
        
        // Main title
        ctx.font = 'bold 36px "Arial Black", Gadget, sans-serif';
        ctx.textAlign = 'right';
        
        // Glow effect
        ctx.shadowColor = sun.isDay ? 'rgba(255, 69, 0, 0.8)' : 'rgba(255, 150, 0, 0.8)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // Draw the text with gradient
        ctx.fillStyle = gradient;
        ctx.fillText('FIREBALL', x, y - 15);
        ctx.fillText('ATTACK', x, y + 20);
        
        // Add floating fire particles
        const time = Date.now() / 1000;
        for (let i = 0; i < 10; i++) {
            const offset = Math.sin(time + i) * 5;
            const alpha = (Math.sin(time * 2 + i) + 1) / 2;
            const particleX = x - 150 + (i * 30) + offset;
            
            ctx.fillStyle = `rgba(255, ${Math.floor(165 * alpha)}, 0, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(particleX, y + Math.sin(time + i * 0.5) * 5, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
};

// Update updateGame function to use new scoring system
function updateGame() {
    if (game.isOver) {
        engineSound.stop();
        if (!mathProblem.isActive) {
            mathProblem.generate();
        }
        scoreDisplay.reset();
        return;
    }
    
    // Track if car is moving
    let isMoving = false;
    let speed = 0;
    
    // Move car based on keyboard input with bounds checking
    if (keys['ArrowLeft'] && car.x > 0) {
        car.x -= car.speed;
        isMoving = true;
        speed = car.speed;
    }
    if (keys['ArrowRight'] && car.x < canvas.width - car.width) {
        car.x += car.speed;
        isMoving = true;
        speed = car.speed;
    }
    
    // Add vertical movement
    const roadY = canvas.height - 150;
    if (keys['ArrowUp'] && car.y > roadY - 100) {
        car.y -= car.speed;
        isMoving = true;
        speed = car.speed;
    }
    if (keys['ArrowDown'] && car.y < roadY) {
        car.y += car.speed;
        isMoving = true;
        speed = car.speed;
    }
    
    // Check if car is off the road
    car.isFlying = car.y < roadY;
    
    // Handle engine sound
    if (isMoving) {
        engineSound.start();
        engineSound.adjustPitch(speed);
    } else {
        engineSound.stop();
    }
    
    // Update rocket particles
    rocketParticles.update();
    
    // Update mountain scroll
    mountains.offset -= mountains.speed;
    
    // Update sun rays
    sun.update(Date.now());
    
    // Update score
    scoreDisplay.addPoints(1);
    scoreDisplay.update();
    
    // Check for collisions
    checkCollisions();
}

// Update gameLoop function to use new score display
function gameLoop(timestamp) {
    // Clear game canvas with sky color
    sun.update(timestamp);
    
    // Clear game canvas
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update game state
    updateGame();
    
    // Draw game elements
    drawSun();
    drawMountains();
    drawRoad();
    drawCar();
    
    // Draw rocket particles
    rocketParticles.draw();
    
    // Draw touch controls if on mobile
    if (game.isMobile) {
        touchControls.draw();
    }
    
    // Draw rays
    ctx.fillStyle = 'rgba(255, 165, 0, 0.6)';
    for (let ray of sun.rays) {
        ctx.beginPath();
        ctx.arc(ray.x, ray.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Add glow effect
        const gradient = ctx.createRadialGradient(ray.x, ray.y, 0, ray.x, ray.y, 30);
        gradient.addColorStop(0, 'rgba(255, 165, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(ray.x, ray.y, 30, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw title after score but before game over screen
    titleDisplay.draw();
    
    // Draw game over screen if needed
    if (game.isOver) {
        drawGameOver();
    }
    
    // Update and render confetti
    if (confetti.gl) {
        confetti.update();
        confetti.render();
    }
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Move the game canvas setup to a separate function
function initializeGame() {
    if (isGameInitialized) return;
    
    // Setup game canvas
    canvas.style.zIndex = '0';
    gameContainer.appendChild(canvas);
    resizeCanvas();
    
    // Initialize confetti
    if (!confetti.init()) {
        console.error('Failed to initialize confetti');
    }
    
    // Add event listeners
    window.addEventListener('resize', () => {
        resizeCanvas();
        confetti.resize();
    });
    
    // Add touch event listeners
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchControls.handleTouchStart(e);
    }, { passive: false });
    
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        touchControls.handleTouchEnd(e);
    }, { passive: false });
    
    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        touchControls.handleTouchEnd(e);
    }, { passive: false });
    
    // Single keyboard event listeners
    document.addEventListener('keydown', (e) => {
        if (!keys[e.key]) {  // Only handle key if it's not already pressed
            keys[e.key] = true;
            
            if (game.isOver && mathProblem.isActive) {
                if (e.key >= '0' && e.key <= '9' && mathProblem.userAnswer.length < 2) {
                    mathProblem.userAnswer += e.key;
                } else if (e.key === 'Backspace') {
                    mathProblem.userAnswer = mathProblem.userAnswer.slice(0, -1);
                } else if (e.key === 'Enter' && mathProblem.userAnswer !== '') {
                    if (parseInt(mathProblem.userAnswer) === mathProblem.answer) {
                        game.isOver = false;
                        game.score = 0;
                        car.x = canvas.width / 2;
                        sun.rays = [];
                        mathProblem.isActive = false;
                        confetti.celebrate();
                        
                        // Update streak
                        game.streak++;
                        if (game.streak > game.bestStreak) {
                            game.bestStreak = game.streak;
                        }
                    } else {
                        mathProblem.userAnswer = '';
                        game.streak = 0;  // Reset streak on wrong answer
                    }
                    e.preventDefault();
                }
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    
    // Start the game loop
    requestAnimationFrame(gameLoop);
    isGameInitialized = true;
}

// Initialize the game when the document is ready
document.addEventListener('DOMContentLoaded', initializeGame);

// Add click handler to start audio context
document.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}, { once: true });

// Add viewport meta tag to HTML
document.head.innerHTML += '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">'; 