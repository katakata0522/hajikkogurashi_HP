const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const uiTitle = document.getElementById('title');
const uiInstruction = document.getElementById('instruction');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameClearScreen = document.getElementById('game-clear');
const scoreDisplay = document.getElementById('score-display');
const clearTimeDisplay = document.getElementById('clear-time');
const bestTimeDisplay = document.getElementById('best-time-display');
const newRecordDisplay = document.getElementById('new-record');

let gameState = 'start'; // start, playing, dead, clear
let startTime = 0;
let currentTimeStr = "0.00";
let cameraY = 0;
let highestY = 0;
let hasReachedGoal = false;
let isClearSoundPlayed = false;

// Screen Shake
let screenShake = 0;

// Best Time
let bestTime = localStorage.getItem('wallJumperBestTime');

// Audio Context (Initialize on first user interaction)
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'walljump') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'death') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'clear') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now); // A4
        osc.frequency.setValueAtTime(554, now + 0.1); // C#5
        osc.frequency.setValueAtTime(659, now + 0.2); // E5
        osc.frequency.setValueAtTime(880, now + 0.3); // A5
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

// Physics settings
const GRAVITY = 0.4;
const TERMINAL_VELOCITY = 12;
const WALL_SLIDE_SPEED = 2.0;
const JUMP_FORCE = -10;
const WALL_JUMP_FORCE_X = 8;
const WALL_JUMP_FORCE_Y = -10;
const MOVE_SPEED = 5.5;

// Goal height
const GOAL_Y = -8000;

const player = {
    x: 200,
    y: 500,
    width: 20,
    height: 20,
    vx: 0,
    vy: 0,
    color: '#ff3333',
    trail: [],
    canDoubleJump: true,
    scaleX: 1.0, // For Squash and Stretch
    scaleY: 1.0,
    wasGrounded: false
};

let platforms = [];
let spikes = [];
let particles = [];
let jumpRings = [];
let goalBlock = null;

function updateBestTimeUI() {
    if (bestTime) {
        bestTimeDisplay.innerText = "Best: " + parseFloat(bestTime).toFixed(2);
    } else {
        bestTimeDisplay.innerText = "Best: --";
    }
}

function initGame() {
    initAudio();
    updateBestTimeUI();
    
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 50;
    player.vx = MOVE_SPEED; 
    player.vy = 0;
    player.trail = [];
    player.canDoubleJump = true;
    player.scaleX = 1.0;
    player.scaleY = 1.0;
    player.wasGrounded = true;
    
    startTime = Date.now();
    currentTimeStr = "0.00";
    cameraY = 0;
    highestY = player.y;
    hasReachedGoal = false;
    isClearSoundPlayed = false;
    newRecordDisplay.style.display = 'none';
    
    platforms = [
        { x: 0, y: canvas.height - 20, width: canvas.width, height: 20 } // Ground
    ];
    spikes = [];
    particles = [];
    jumpRings = [];
    goalBlock = null;
    screenShake = 0;
    
    generateLevel(-1500);
}

function generateLevel(targetY) {
    let currentY = platforms.length > 1 ? platforms[platforms.length-1].y : canvas.height - 150;
    
    if (targetY <= GOAL_Y && !goalBlock) {
        targetY = GOAL_Y;
    }
    
    while (currentY > targetY) {
        currentY -= Math.random() * 60 + 120; 
        
        if (Math.random() > 0.15) {
            let pw = Math.random() * 100 + 80;
            let px = Math.random() * (canvas.width - pw); 
            platforms.push({ x: px, y: currentY, width: pw, height: 10 });
        }
        
        if (Math.random() > 0.3) {
            let isLeft = Math.random() > 0.5;
            let sx = isLeft ? 0 : canvas.width - 15;
            spikes.push({ x: sx, y: currentY - 40, width: 15, height: 60 });
            
            let pw = 120;
            let px = (canvas.width - pw) / 2;
            platforms.push({ x: px, y: currentY - 10, width: pw, height: 10 });
        }
    }

    if (targetY <= GOAL_Y && !goalBlock) {
        goalBlock = { x: 0, y: GOAL_Y - 50, width: canvas.width, height: 50 };
        platforms.push(goalBlock);
    }
}

function createDeathParticles() {
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1.0,
            color: '#ff0000'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4;
        p.life -= 0.03;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    for (let i = jumpRings.length - 1; i >= 0; i--) {
        let r = jumpRings[i];
        r.radius += 2;
        r.life -= 0.05;
        if (r.life <= 0) {
            jumpRings.splice(i, 1);
        }
    }
}

function jump() {
    initAudio();
    if (gameState !== 'playing') return;
    
    let isGrounded = false;
    let isWallLeft = false;
    let isWallRight = false;
    
    for (let p of platforms) {
        if (player.x < p.x + p.width && player.x + player.width > p.x &&
            player.y + player.height >= p.y && player.y + player.height <= p.y + 10 && player.vy >= 0) {
            isGrounded = true;
            break;
        }
    }
    
    if (player.x <= 0) isWallLeft = true;
    if (player.x + player.width >= canvas.width) isWallRight = true;
    
    if (isGrounded) {
        player.vy = JUMP_FORCE;
        player.canDoubleJump = true;
        // Squash & Stretch (Jump)
        player.scaleX = 0.6;
        player.scaleY = 1.4;
        playSound('jump');
    } else if (isWallLeft) {
        player.vy = WALL_JUMP_FORCE_Y;
        player.vx = WALL_JUMP_FORCE_X;
        player.canDoubleJump = true;
        player.scaleX = 0.6;
        player.scaleY = 1.4;
        playSound('walljump');
    } else if (isWallRight) {
        player.vy = WALL_JUMP_FORCE_Y;
        player.vx = -WALL_JUMP_FORCE_X;
        player.canDoubleJump = true;
        player.scaleX = 0.6;
        player.scaleY = 1.4;
        playSound('walljump');
    } else if (player.canDoubleJump) {
        player.canDoubleJump = false;
        player.vy = JUMP_FORCE;
        player.scaleX = 0.6;
        player.scaleY = 1.4;
        playSound('jump');
        
        jumpRings.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            radius: 5,
            life: 1.0
        });
    }
}

function update() {
    updateParticles();
    
    if (screenShake > 0) {
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    if (gameState !== 'playing') return;
    
    // Smoothly return scale to 1.0
    player.scaleX += (1.0 - player.scaleX) * 0.2;
    player.scaleY += (1.0 - player.scaleY) * 0.2;
    
    if (player.vx > 0) player.vx = MOVE_SPEED;
    if (player.vx < 0) player.vx = -MOVE_SPEED;
    if (player.vx === 0) player.vx = MOVE_SPEED;
    
    let isGroundedCurrently = false;
    
    if (player.vy === 0) {
        let currentPlatform = null;
        for (let p of platforms) {
            if (player.x < p.x + p.width && player.x + player.width > p.x &&
                Math.abs(player.y + player.height - p.y) < 0.1) {
                currentPlatform = p;
                isGroundedCurrently = true;
                break;
            }
        }
        
        if (currentPlatform) {
            if (player.x + player.vx < currentPlatform.x) {
                player.x = currentPlatform.x;
                player.vx = Math.abs(MOVE_SPEED);
            } else if (player.x + player.width + player.vx > currentPlatform.x + currentPlatform.width) {
                player.x = currentPlatform.x + currentPlatform.width - player.width;
                player.vx = -Math.abs(MOVE_SPEED);
            }
        }
    }
    
    player.x += player.vx;
    
    let isWallSliding = false;
    if (player.x <= 0) {
        player.x = 0;
        player.vx = -1;
        isWallSliding = true;
        player.canDoubleJump = true;
    } else if (player.x + player.width >= canvas.width) {
        player.x = canvas.width - player.width;
        player.vx = 1;
        isWallSliding = true;
        player.canDoubleJump = true;
    }
    
    player.vy += GRAVITY;
    if (isWallSliding && player.vy > WALL_SLIDE_SPEED) {
        player.vy = WALL_SLIDE_SPEED;
    } else if (player.vy > TERMINAL_VELOCITY) {
        player.vy = TERMINAL_VELOCITY;
    }
    
    player.y += player.vy;
    
    for (let p of platforms) {
        if (player.x < p.x + p.width && player.x + player.width > p.x &&
            player.y + player.height >= p.y && player.y + player.height - player.vy <= p.y) {
            
            player.y = p.y - player.height;
            player.vy = 0;
            player.canDoubleJump = true;
            isGroundedCurrently = true;

            if (player.vx === 0) {
                player.vx = MOVE_SPEED;
            }

            if (p === goalBlock) {
                hasReachedGoal = true;
            }
        }
    }
    
    // Squash & Stretch on landing
    if (!player.wasGrounded && isGroundedCurrently) {
        player.scaleX = 1.4;
        player.scaleY = 0.6;
    }
    player.wasGrounded = isGroundedCurrently;
    
    let dead = false;
    for (let s of spikes) {
        if (player.x < s.x + s.width && player.x + player.width > s.x &&
            player.y < s.y + s.height && player.y + player.height > s.y) {
            dead = true;
            break;
        }
    }
    
    if (player.y > cameraY + canvas.height + 150) {
        dead = true;
    }
    
    if (dead) {
        createDeathParticles();
        playSound('death');
        screenShake = 15; // Trigger screen shake
        gameState = 'dead';
        setTimeout(() => {
            if (gameState === 'dead') {
                gameState = 'playing';
                initGame();
            }
        }, 500);
        return;
    }

    if (hasReachedGoal) {
        gameState = 'clear';
        if (!isClearSoundPlayed) {
            playSound('clear');
            isClearSoundPlayed = true;
            
            let elapsed = (Date.now() - startTime) / 1000;
            if (!bestTime || elapsed < parseFloat(bestTime)) {
                bestTime = elapsed.toFixed(2);
                localStorage.setItem('wallJumperBestTime', bestTime);
                updateBestTimeUI();
                newRecordDisplay.style.display = 'block';
            }
        }
        
        gameClearScreen.style.display = 'flex';
        clearTimeDisplay.innerText = currentTimeStr;
        return;
    }
    
    let elapsed = (Date.now() - startTime) / 1000;
    currentTimeStr = elapsed.toFixed(2);
    scoreDisplay.innerText = "Time: " + currentTimeStr;
    
    let targetCameraY = player.y - canvas.height / 2;
    if (targetCameraY < cameraY) {
        cameraY += (targetCameraY - cameraY) * 0.1;
    }
    
    if (cameraY < platforms[platforms.length-1].y + 1000 && !goalBlock) {
        generateLevel(cameraY - 2000);
    }
    
    player.trail.push({x: player.x, y: player.y});
    if (player.trail.length > 8) player.trail.shift();
}

function draw() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    
    // Apply Screen Shake
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
    }
    
    ctx.translate(0, -cameraY);
    
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    let startY = Math.floor(cameraY / 50) * 50;
    for (let i = startY; i < startY + canvas.height + 100; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    
    for (let p of platforms) {
        if (p === goalBlock) {
            ctx.fillStyle = '#00aa00';
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(p.x, p.y, p.width, 3);
            
            ctx.fillStyle = '#fff';
            ctx.fillRect(canvas.width/2, p.y - 80, 4, 80);
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.moveTo(canvas.width/2 + 4, p.y - 80);
            ctx.lineTo(canvas.width/2 + 40, p.y - 65);
            ctx.lineTo(canvas.width/2 + 4, p.y - 50);
            ctx.fill();
        } else {
            ctx.fillStyle = '#444';
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = '#666';
            ctx.fillRect(p.x, p.y, p.width, 3);
        }
    }
    
    ctx.fillStyle = '#ff0044';
    for (let s of spikes) {
        ctx.beginPath();
        let numSpikes = Math.max(1, Math.floor((s.width > s.height ? s.width : s.height) / 15));
        
        if (s.width < s.height) {
            let isLeft = s.x === 0;
            for (let i = 0; i < numSpikes; i++) {
                let sy = s.y + (i * s.height / numSpikes);
                let nextSy = s.y + ((i+1) * s.height / numSpikes);
                ctx.moveTo(isLeft ? 0 : canvas.width, sy);
                ctx.lineTo(isLeft ? s.width : canvas.width - s.width, (sy + nextSy)/2);
                ctx.lineTo(isLeft ? 0 : canvas.width, nextSy);
            }
        }
        ctx.fill();
    }

    for (let r of jumpRings) {
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.life})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    if (gameState === 'playing') {
        ctx.beginPath();
        for (let i = 0; i < player.trail.length; i++) {
            let t = player.trail[i];
            let alpha = (i / player.trail.length) * 0.4;
            ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
            ctx.fillRect(t.x, t.y, player.width, player.height);
        }
    }
    
    if (gameState !== 'dead') {
        if (player.canDoubleJump && !player.wasGrounded) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffff00';
        }
        
        // Apply Squash & Stretch matrix
        ctx.save();
        let cx = player.x + player.width / 2;
        let cy = player.y + player.height; // scale from bottom
        ctx.translate(cx, cy);
        ctx.scale(player.scaleX, player.scaleY);
        
        ctx.fillStyle = player.color;
        ctx.fillRect(-player.width / 2, -player.height, player.width, player.height);
        
        ctx.shadowBlur = 0; 
        
        ctx.fillStyle = 'black';
        let lookDir = player.vx > 0 ? 1 : -1;
        ctx.fillRect(-player.width/2 + player.width/2 + lookDir*4 - 2, -player.height + 4, 4, 4);
        ctx.fillRect(-player.width/2 + player.width/2 + lookDir*4 + 4, -player.height + 4, 4, 4);
        
        ctx.restore();
    }
    
    for (let p of particles) {
        ctx.fillStyle = `rgba(255, 0, 0, ${p.life})`;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    
    ctx.restore(); // Restore camera and screen shake

    // Draw UI overlay on canvas (Progress Bar)
    if (gameState === 'playing') {
        const barWidth = 6;
        const barHeight = 200;
        const barX = canvas.width - 15;
        const barY = 15;
        
        // Background track
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Progress marker
        // player.y starts near 0 and goes down to GOAL_Y (-8000). 
        // 0% progress at y=0, 100% at y=GOAL_Y
        let progress = Math.max(0, Math.min(1, player.y / GOAL_Y));
        
        ctx.fillStyle = '#00ff00';
        let markerY = barY + barHeight - (barHeight * progress);
        ctx.fillRect(barX - 4, markerY - 2, barWidth + 8, 4);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

const handleJump = (e) => {
    if(e.type !== 'keydown' || e.code === 'Space') {
        e.preventDefault();
        jump();
    }
};

canvas.addEventListener('mousedown', handleJump);
canvas.addEventListener('touchstart', handleJump, {passive: false});
window.addEventListener('keydown', handleJump);

startBtn.addEventListener('click', () => {
    initAudio();
    gameState = 'playing';
    uiTitle.style.display = 'none';
    uiInstruction.style.display = 'none';
    startBtn.style.display = 'none';
    scoreDisplay.style.display = 'block';
    bestTimeDisplay.style.display = 'block';
    initGame();
});

restartBtn.addEventListener('click', () => {
    gameState = 'playing';
    gameClearScreen.style.display = 'none';
    initGame();
});

initGame();
gameState = 'start';
draw();
requestAnimationFrame(gameLoop);