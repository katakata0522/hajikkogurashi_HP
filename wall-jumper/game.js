const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const uiTitle = document.getElementById('title');
const uiInstruction = document.getElementById('instruction');
const startBtn = document.getElementById('start-btn');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('score-display');
const bestTimeDisplay = document.getElementById('best-time-display');
const pauseBtn = document.getElementById('pause-btn');
const pauseScreen = document.getElementById('pause-screen');
const resumeBtn = document.getElementById('resume-btn');
const quitBtn = document.getElementById('quit-btn');
const milestoneDisplay = document.getElementById('milestone-display');
const newRecordDisplay = document.getElementById('in-game-new-record');
const runFlash = document.getElementById('run-flash');

let gameState = 'start'; // start, playing, dead, paused
let currentDistance = 0;
let maxDistance = 0;
let cameraY = 0;
let highestY = 0;
let hasShownNewRecordPopup = false;
let nextMilestone = 50;

// Screen Shake
let screenShake = 0;

// Best Distance
function safeReadBestDistance() {
    try {
        const value = Number.parseInt(localStorage.getItem('wallJumperBestDistance') || '0', 10);
        return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_) {
        return 0;
    }
}

function safeWriteBestDistance(value) {
    try {
        localStorage.setItem('wallJumperBestDistance', String(value));
    } catch (_) {
        // 記録保存に失敗してもプレイは止めない。
    }
}

let bestDistance = safeReadBestDistance();

// Audio Context
let audioCtx;
function initAudio() {
    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        if (!audioCtx) {
            audioCtx = new AudioCtor();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } catch (_) {
        audioCtx = null;
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
    }
}

// Background Colors
const bgColors = [
    { m: 0,   c: {r: 92, g: 148, b: 252} },  // 青空
    { m: 50,  c: {r: 253, g: 127, b: 0} },   // 夕焼け
    { m: 100, c: {r: 30, g: 44, b: 90} },    // 夜空
    { m: 150, c: {r: 10, g: 10, b: 25} }     // 宇宙
];

function lerpColor(c1, c2, t) {
    t = Math.max(0, Math.min(1, t));
    return {
        r: Math.round(c1.r + (c2.r - c1.r) * t),
        g: Math.round(c1.g + (c2.g - c1.g) * t),
        b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
}

function getBackgroundColor(dist) {
    for (let i = 0; i < bgColors.length - 1; i++) {
        if (dist >= bgColors[i].m && dist <= bgColors[i+1].m) {
            let t = (dist - bgColors[i].m) / (bgColors[i+1].m - bgColors[i].m);
            let c = lerpColor(bgColors[i].c, bgColors[i+1].c, t);
            return `rgb(${c.r}, ${c.g}, ${c.b})`;
        }
    }
    let last = bgColors[bgColors.length - 1].c;
    return `rgb(${last.r}, ${last.g}, ${last.b})`;
}

// Physics settings
const GRAVITY = 0.4;
const TERMINAL_VELOCITY = 12;
const WALL_SLIDE_SPEED = 2.0;
const JUMP_FORCE = -10;
const WALL_JUMP_FORCE_X = 8;
const WALL_JUMP_FORCE_Y = -10;
const MOVE_SPEED = 5.5;
const WALL_KICK_LOCK_FRAMES = 10;

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
    scaleX: 1.0, 
    scaleY: 1.0,
    wasGrounded: false
};

let platforms = [];
let spikes = [];
let particles = [];
let jumpRings = [];
let stars = [];
let wallKickLockFrames = 0;

function updateBestDistanceUI() {
    if (bestDistance > 0) {
        bestTimeDisplay.innerText = "BEST " + bestDistance + "m";
    } else {
        bestTimeDisplay.innerText = "BEST --m";
    }
}

function initGame() {
    initAudio();
    updateBestDistanceUI();
    
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 50;
    player.vx = MOVE_SPEED; 
    player.vy = 0;
    player.trail = [];
    player.canDoubleJump = true;
    player.scaleX = 1.0;
    player.scaleY = 1.0;
    player.wasGrounded = true;
    
    currentDistance = 0;
    maxDistance = 0;
    cameraY = 0;
    highestY = player.y;
    hasShownNewRecordPopup = false;
    nextMilestone = 50;
    newRecordDisplay.style.display = 'none';
    milestoneDisplay.style.display = 'none';
    runFlash.classList.remove('show');
    
    platforms = [
        { x: 0, y: canvas.height - 20, width: canvas.width, height: 20 } 
    ];
    spikes = [];
    particles = [];
    jumpRings = [];
    wallKickLockFrames = 0;
    screenShake = 0;
    
    // 星の生成
    stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: -Math.random() * 12000,
            size: Math.random() * 2 + 1,
            opacity: Math.random()
        });
    }
    
    generateLevel(-1500);
}

function rand(min, max) {
    return Math.random() * (max - min) + min;
}

function getDifficultyForDistance(distance) {
    const t = Math.min(1, distance / 500);
    return {
        minGap: 105 + t * 15,
        maxGap: 135 + t * 25,
        minWidth: 135 - t * 30,
        maxWidth: 170 - t * 25,
        maxShift: 95 + t * 35,
        spikeChance: 0.12 + t * 0.22
    };
}

function createPlatformCandidate(y, difficulty, previousPlatform) {
    const width = rand(difficulty.minWidth, difficulty.maxWidth);
    const previousCenter = previousPlatform
        ? previousPlatform.x + previousPlatform.width / 2
        : canvas.width / 2;
    const targetCenter = Math.max(
        width / 2 + 18,
        Math.min(canvas.width - width / 2 - 18, previousCenter + rand(-difficulty.maxShift, difficulty.maxShift))
    );
    return {
        x: targetCenter - width / 2,
        y,
        width,
        height: 10
    };
}

function generateLevel(targetY) {
    let lastPlatform = platforms[platforms.length - 1];
    let currentY = lastPlatform ? lastPlatform.y : canvas.height - 150;
    
    while (currentY > targetY) {
        const distanceAtY = Math.max(0, Math.floor((canvas.height - currentY) / 50));
        const difficulty = getDifficultyForDistance(distanceAtY);
        currentY -= rand(difficulty.minGap, difficulty.maxGap);

        const platform = createPlatformCandidate(currentY, difficulty, lastPlatform);
        platforms.push(platform);
        lastPlatform = platform;

        if (currentY < canvas.height - 280 && Math.random() < difficulty.spikeChance) {
            let isLeft = Math.random() > 0.5;
            const spikeHeight = 44 + Math.random() * 16;
            let sx = isLeft ? 0 : canvas.width - 14;
            spikes.push({ x: sx, y: currentY - spikeHeight - 12, width: 14, height: spikeHeight });
        }
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

let lastJumpTime = 0;

function jump() {
    initAudio();
    if (gameState !== 'playing') return;
    
    // 重複発火防止（50ms以内の連続ジャンプを無視）
    const now = performance.now();
    if (now - lastJumpTime < 50) return;
    lastJumpTime = now;
    
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
        player.scaleX = 0.5;
        player.scaleY = 1.5;
        playSound('jump');
    } else if (isWallLeft) {
        player.vy = WALL_JUMP_FORCE_Y;
        player.vx = WALL_JUMP_FORCE_X;
        wallKickLockFrames = WALL_KICK_LOCK_FRAMES;
        player.canDoubleJump = true;
        player.scaleX = 0.5;
        player.scaleY = 1.5;
        playSound('walljump');
    } else if (isWallRight) {
        player.vy = WALL_JUMP_FORCE_Y;
        player.vx = -WALL_JUMP_FORCE_X;
        wallKickLockFrames = WALL_KICK_LOCK_FRAMES;
        player.canDoubleJump = true;
        player.scaleX = 0.5;
        player.scaleY = 1.5;
        playSound('walljump');
    } else if (player.canDoubleJump) {
        player.canDoubleJump = false;
        player.vy = JUMP_FORCE;
        player.scaleX = 0.5;
        player.scaleY = 1.5;
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
    if (gameState === 'paused') return;

    updateParticles();
    
    if (screenShake > 0) {
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    if (gameState !== 'playing') return;
    
    player.scaleX += (1.0 - player.scaleX) * 0.15;
    player.scaleY += (1.0 - player.scaleY) * 0.15;
    
    if (wallKickLockFrames > 0) {
        wallKickLockFrames--;
    } else if (player.vx > 0) {
        player.vx = Math.max(MOVE_SPEED, player.vx * 0.94);
    } else if (player.vx < 0) {
        player.vx = Math.min(-MOVE_SPEED, player.vx * 0.94);
    } else {
        player.vx = MOVE_SPEED;
    }
    
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
        if (player.vy >= 0 && player.x < p.x + p.width && player.x + player.width > p.x &&
            player.y + player.height >= p.y && player.y + player.height - player.vy <= p.y + 0.1) {
            
            if (!player.wasGrounded && player.vy > 2) {
                player.scaleX = 1.5;
                player.scaleY = 0.5;
            }

            player.y = p.y - player.height;
            player.vy = 0;
            player.canDoubleJump = true;
            isGroundedCurrently = true;

            if (player.vx === 0) {
                player.vx = MOVE_SPEED;
            }

        }
    }
    
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
    
    // Update distance
    let startY = canvas.height - 50;
    currentDistance = Math.max(0, Math.floor((startY - player.y) / 50));
    if (currentDistance > maxDistance) {
        maxDistance = currentDistance;
        
        // NEW RECORD
        if (maxDistance > bestDistance && bestDistance > 0 && !hasShownNewRecordPopup) {
            hasShownNewRecordPopup = true;
            const popup = document.getElementById('in-game-new-record');
            if (popup) {
                popup.style.display = 'block';
                popup.style.animation = 'none';
                void popup.offsetWidth; 
                popup.style.animation = 'popUp 2s ease-out forwards';
                setTimeout(() => { popup.style.display = 'none'; }, 2000);
            }
        }
        
        // Milestone
        if (maxDistance >= nextMilestone) {
            milestoneDisplay.innerText = nextMilestone + "m 突破!!";
            milestoneDisplay.style.display = 'block';
            milestoneDisplay.style.animation = 'none';
            void milestoneDisplay.offsetWidth;
            milestoneDisplay.style.animation = 'popUp 2s ease-out forwards';
            setTimeout(() => { milestoneDisplay.style.display = 'none'; }, 2000);
            nextMilestone += 50;
        }
    }
    
    const checkAndSaveRecord = () => {
        if (maxDistance > bestDistance) {
            bestDistance = maxDistance;
            safeWriteBestDistance(bestDistance);
            updateBestDistanceUI();
            newRecordDisplay.style.display = 'block';
        }
    };

    if (dead) {
        checkAndSaveRecord();
        createDeathParticles();
        playSound('death');
        screenShake = 15;
        gameState = 'dead';
        pauseBtn.style.display = 'none';
        runFlash.classList.add('show');
        setTimeout(() => {
            if (gameState === 'dead') {
                gameState = 'playing';
                pauseBtn.style.display = 'flex';
                initGame();
            }
        }, 500);
        return;
    }
    
    scoreDisplay.innerText = maxDistance + "m";
    
    let targetCameraY = player.y - canvas.height / 2;
    if (targetCameraY > 0) targetCameraY = 0; 
    cameraY += (targetCameraY - cameraY) * 0.1;
    
    if (cameraY < platforms[platforms.length-1].y + 1000) {
        generateLevel(cameraY - 2000);
    }
    
    player.trail.push({x: player.x, y: player.y});
    if (player.trail.length > 8) player.trail.shift();
}

function draw() {
    // Dynamic Background
    ctx.fillStyle = getBackgroundColor(currentDistance);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw Parallax Stars
    let starAlpha = Math.max(0, Math.min(1, (currentDistance - 80) / 40)); 
    if (starAlpha > 0) {
        ctx.save();
        ctx.translate(0, -cameraY * 0.2); 
        for (let s of stars) {
            ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity * starAlpha})`;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.restore();
    }
    
    ctx.save();
    
    // Apply Screen Shake
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
    }
    
    ctx.translate(0, -cameraY);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    let startY = Math.floor(cameraY / 50) * 50;
    for (let i = startY; i < startY + canvas.height + 100; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }
    
    for (let p of platforms) {
        ctx.fillStyle = '#2b2b35';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = '#8b8b72';
        ctx.fillRect(p.x, p.y, p.width, 3);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
        for (let x = p.x + 6; x < p.x + p.width - 6; x += 18) {
            ctx.fillRect(x, p.y + 4, 8, 2);
        }
    }
    
    for (let s of spikes) {
        let isLeft = s.x === 0;
        let numSpikes = Math.floor(s.height / 20);
        let spikeW = s.width;
        let spikeH = s.height / numSpikes;

        for (let i = 0; i < numSpikes; i++) {
            let sy = s.y + (i * spikeH);
            
            let grad = ctx.createLinearGradient(isLeft ? 0 : canvas.width, sy, isLeft ? spikeW : canvas.width - spikeW, sy);
            grad.addColorStop(0, '#ff0044');
            grad.addColorStop(0.5, '#aa0022');
            grad.addColorStop(1, '#660011');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(isLeft ? 0 : canvas.width, sy);
            ctx.lineTo(isLeft ? spikeW : canvas.width - spikeW, sy + spikeH/2);
            ctx.lineTo(isLeft ? 0 : canvas.width, sy + spikeH);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(isLeft ? 0 : canvas.width, sy + 2);
            ctx.lineTo(isLeft ? spikeW - 2 : canvas.width - spikeW + 2, sy + spikeH/2);
            ctx.stroke();
        }
    }

    for (let r of jumpRings) {
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.life})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    if (gameState === 'playing' || gameState === 'paused') {
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
        
        ctx.save();
        let cx = player.x + player.width / 2;
        let cy = player.y + player.height; 
        ctx.translate(cx, cy);
        ctx.scale(player.scaleX, player.scaleY);
        
        ctx.fillStyle = '#7a120e';
        ctx.fillRect(-player.width / 2 - 2, -player.height + 2, player.width + 4, player.height);
        ctx.fillStyle = player.color;
        ctx.fillRect(-player.width / 2, -player.height, player.width, player.height);
        ctx.fillStyle = '#ff8a65';
        ctx.fillRect(-player.width / 2 + 3, -player.height + 3, player.width - 6, 4);
        
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
    
    ctx.restore(); 

    // Height marker
    if (gameState === 'playing' || gameState === 'paused') {
        const barWidth = 6;
        const barHeight = 200;
        const barX = canvas.width - 15;
        const barY = 80; // adjusted for new pause button
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const progress = (maxDistance % 100) / 100;
        ctx.fillStyle = '#ffd700';
        let markerY = barY + barHeight - (barHeight * progress);
        ctx.fillRect(barX - 4, markerY - 2, barWidth + 8, 4);
    }
}

let lastTimestamp = 0;
const TIME_STEP = 1000 / 60; 
let accumulatedTime = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    
    if (!lastTimestamp) {
        lastTimestamp = timestamp;
        return;
    }
    
    let dt = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    if (dt > 100) dt = 100;
    
    accumulatedTime += dt;
    while (accumulatedTime >= TIME_STEP) {
        update();
        accumulatedTime -= TIME_STEP;
    }
    
    draw();
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        pauseScreen.style.display = 'flex';
        pauseBtn.style.display = 'none';
        if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
    } else if (gameState === 'paused') {
        gameState = 'playing';
        pauseScreen.style.display = 'none';
        pauseBtn.style.display = 'flex';
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }
}

pauseBtn.addEventListener('click', togglePause);
resumeBtn.addEventListener('click', togglePause);
quitBtn.addEventListener('click', () => {
    gameState = 'start';
    pauseScreen.style.display = 'none';
    uiTitle.style.display = 'block';
    uiInstruction.style.display = 'block';
    startBtn.style.display = 'block';
    hud.style.display = 'none';
    pauseBtn.style.display = 'none';
    initGame();
    gameState = 'start'; 
});

const handleJump = (e) => {
    if (e.target.id === 'pause-btn' || e.target.closest('#pause-btn') || e.target.id === 'resume-btn' || e.target.id === 'quit-btn') return;
    
    // キーボード操作（スペースキーのみ）
    if (e.type === 'keydown') {
        if (e.code === 'Space') {
            e.preventDefault();
            jump();
        }
    } else {
        // マウス・タッチ操作
        e.preventDefault();
        jump();
    }
};

// 重複発火を防ぐため、pointerdownを使用（モダンブラウザ対応）
// pointerdown がサポートされていない環境のフォールバックとして mousedown/touchstart を使い分ける
if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', handleJump);
} else {
    canvas.addEventListener('mousedown', handleJump);
    canvas.addEventListener('touchstart', handleJump, {passive: false});
}
window.addEventListener('keydown', handleJump);

startBtn.addEventListener('click', () => {
    initAudio();
    gameState = 'playing';
    uiTitle.style.display = 'none';
    uiInstruction.style.display = 'none';
    startBtn.style.display = 'none';
    hud.style.display = 'flex';
    pauseBtn.style.display = 'flex';
    initGame();
});

initGame();
gameState = 'start';
hud.style.display = 'none';
pauseBtn.style.display = 'none';
draw();
requestAnimationFrame(gameLoop);
