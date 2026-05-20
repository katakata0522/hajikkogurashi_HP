const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const uiTitle = document.getElementById('title');
const uiInstruction = document.getElementById('instruction');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameClearScreen = document.getElementById('game-clear');
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('score-display');
const clearTimeDisplay = document.getElementById('clear-time');
const bestTimeDisplay = document.getElementById('best-time-display');
const newRecordDisplay = document.getElementById('new-record');
const pauseBtn = document.getElementById('pause-btn');
const pauseScreen = document.getElementById('pause-screen');
const resumeBtn = document.getElementById('resume-btn');
const quitBtn = document.getElementById('quit-btn');
const milestoneDisplay = document.getElementById('milestone-display');

let gameState = 'start'; // start, playing, dead, clear, paused
let currentDistance = 0;
let maxDistance = 0;
let cameraY = 0;
let highestY = 0;
let hasReachedGoal = false;
let isClearSoundPlayed = false;
let hasShownNewRecordPopup = false;
let nextMilestone = 50;

// Screen Shake
let screenShake = 0;

// Best Distance
let bestDistance = parseInt(localStorage.getItem('wallJumperBestDistance') || '0', 10);

// Audio Context
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
    scaleX: 1.0, 
    scaleY: 1.0,
    wasGrounded: false
};

let platforms = [];
let spikes = [];
let particles = [];
let jumpRings = [];
let stars = [];
let goalBlock = null;

function updateBestDistanceUI() {
    if (bestDistance > 0) {
        bestTimeDisplay.innerText = bestDistance + "m";
    } else {
        bestTimeDisplay.innerText = "--m";
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
    hasReachedGoal = false;
    isClearSoundPlayed = false;
    hasShownNewRecordPopup = false;
    nextMilestone = 50;
    newRecordDisplay.style.display = 'none';
    milestoneDisplay.style.display = 'none';
    
    platforms = [
        { x: 0, y: canvas.height - 20, width: canvas.width, height: 20 } 
    ];
    spikes = [];
    particles = [];
    jumpRings = [];
    goalBlock = null;
    screenShake = 0;
    
    // 星の生成
    stars = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: -Math.random() * 8500, 
            size: Math.random() * 2 + 1,
            opacity: Math.random()
        });
    }
    
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
        player.canDoubleJump = true;
        player.scaleX = 0.5;
        player.scaleY = 1.5;
        playSound('walljump');
    } else if (isWallRight) {
        player.vy = WALL_JUMP_FORCE_Y;
        player.vx = -WALL_JUMP_FORCE_X;
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

            if (p === goalBlock) {
                hasReachedGoal = true;
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
        if (maxDistance >= nextMilestone && nextMilestone <= 150) {
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
            localStorage.setItem('wallJumperBestDistance', bestDistance);
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
        setTimeout(() => {
            if (gameState === 'dead') {
                gameState = 'playing';
                pauseBtn.style.display = 'flex';
                initGame();
            }
        }, 500);
        return;
    }

    if (hasReachedGoal) {
        gameState = 'clear';
        pauseBtn.style.display = 'none';
        hud.style.display = 'none';
        if (!isClearSoundPlayed) {
            playSound('clear');
            isClearSoundPlayed = true;
            checkAndSaveRecord();
        }
        
        gameClearScreen.style.display = 'flex';
        clearTimeDisplay.innerText = maxDistance;
        return;
    }
    
    scoreDisplay.innerText = maxDistance + "m";
    
    let targetCameraY = player.y - canvas.height / 2;
    if (targetCameraY > 0) targetCameraY = 0; 
    cameraY += (targetCameraY - cameraY) * 0.1;
    
    if (cameraY < platforms[platforms.length-1].y + 1000 && !goalBlock) {
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
    
    ctx.restore(); 

    // Progress Bar
    if (gameState === 'playing' || gameState === 'paused') {
        const barWidth = 6;
        const barHeight = 200;
        const barX = canvas.width - 15;
        const barY = 80; // adjusted for new pause button
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        let progress = Math.max(0, Math.min(1, player.y / GOAL_Y));
        ctx.fillStyle = '#00ff00';
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

restartBtn.addEventListener('click', () => {
    gameState = 'playing';
    gameClearScreen.style.display = 'none';
    hud.style.display = 'flex';
    pauseBtn.style.display = 'flex';
    initGame();
});

initGame();
gameState = 'start';
draw();
requestAnimationFrame(gameLoop);
