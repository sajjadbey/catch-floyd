// Game variables
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreDisplay = document.getElementById('scoreDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const finalScore = document.getElementById('finalScore');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

// Game state
let gameActive = false;
let score = 0;
let lives = 3;
let playerX = canvas.width / 2;
const playerSpeed = 7;
const playerWidth = 60.75;
const playerHeight = 93.5;

// Items array
let items = [];
const itemSize = 40;
let itemSpawnTimer = 0;
const itemSpawnInterval = 120; // frames


let audioCtx = new (window.AudioContext || window.webkitAudioContext)();


function unlockAudio() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    // 0.1 s silence just to consume the gesture
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
    startBtn.removeEventListener('click', unlockAudio);   // only first time
}


// 1.  Put this at the TOP of your script (before any other code):
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
    });
}

function loadAudio(src) {
        return fetch(src)
            .then(r => r.arrayBuffer())
            .then(buf => audioCtx.decodeAudioData(buf));
    }

let bgBuffer, loseBuffer, bgSource = null;

/* ----------  LAZY ASSET LOADER  ---------- */
let assetsReady = null;                       // Promise once we start
const loadingScreen = document.getElementById('loadingScreen');

function loadAllAssets() {
    if (assetsReady) return assetsReady;
    loadingScreen.style.display = 'flex';

    assetsReady = (async () => {
        const [playerImg, goodItemImg, badItemImg] = await Promise.all([
            loadImage('./assets/images/base.png'),
            loadImage('./assets/images/chicken.png'),
            loadImage('./assets/images/cop.png')
        ]);
        window.playerImg   = playerImg;
        window.goodItemImg = goodItemImg;
        window.badItemImg  = badItemImg;

        const [bg, lose] = await Promise.all([
            loadAudio('./assets/sfx/background.mp3'),
            loadAudio('./assets/sfx/game_over.mp3')
        ]);
        bgBuffer   = bg;
        loseBuffer = lose;

        loadingScreen.style.display = 'none';
    })();
    return assetsReady;
}

function startBackground() {
    if (bgSource) return;                 // already running
    bgSource = audioCtx.createBufferSource();
    bgSource.buffer = bgBuffer;
    bgSource.loop = true;
    bgSource.connect(audioCtx.destination);
    bgSource.start();
}

function playLossSound() {
    if (bgSource) {          // stop background
        bgSource.stop();
        bgSource = null;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = loseBuffer;
    src.connect(audioCtx.destination);
    src.start();
}


// Item class
class Item {
    constructor(x, y, isGood) {
        this.x = x;
        this.y = y;
        this.isGood = isGood;
        this.width  = isGood ? 40 : 75.5;   // good = 40×40, bad = 60×60
        this.height = isGood ? 40 : 150.5;
        this.speed = 2;
        this.image = isGood ? goodItemImg : badItemImg;
    }
    
    update() {
        this.y += this.speed;
    }
    
    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    }
    
    isOffScreen() {
        return this.y > canvas.height;
    }
}

// Simple collision detection using bounding boxes
function checkCollision(player, item) {
    return player.x < item.x + item.width &&
            player.x + player.width > item.x &&
            player.y < item.y + item.height &&
            player.y + player.height > item.y;
}

// Input handling
let leftPressed = false;
let rightPressed = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = true;
    if (e.key === 'ArrowRight') rightPressed = true;
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') leftPressed = false;
    if (e.key === 'ArrowRight') rightPressed = false;
});

// Mobile controls
leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    leftPressed = true;
});

leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    leftPressed = false;
});

rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    rightPressed = true;
});

rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    rightPressed = false;
});

function startGame() {
    gameActive = true;
    score = 0;
    lives = 3;
    items = [];
    playerX = canvas.width / 2;
    updateScore();
    updateLives();
    startScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameLoop();
}

function endGame() {
    gameActive = false;
    playLossSound();   
    finalScore.textContent = `Your score: ${score}`;
    gameOverScreen.style.display = 'flex';
}

function updateScore() {
    scoreDisplay.textContent = `Score: ${score}`;
}

function updateLives() {
    livesDisplay.textContent = `Lives: ${lives}`;
}

function spawnItem() {
    const x = Math.random() * (canvas.width - itemSize);
    const isGood = Math.random() < 0.8; // 80% chance of good item
    items.push(new Item(x, -itemSize, isGood));
}

function gameLoop() {
    if (!gameActive) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars
    ctx.fillStyle = 'white';
    for (let i = 0; i < 100; i++) {
        const x = Math.sin(i * 123.45) * canvas.width / 2 + canvas.width / 2;
        const y = Math.cos(i * 67.89) * canvas.height / 2 + canvas.height / 2;
        ctx.fillRect(x, y, 1, 1);
    }
    
    // Move player
    if (leftPressed && playerX > 0) {
        playerX -= playerSpeed;
    }
    if (rightPressed && playerX < canvas.width - playerWidth) {
        playerX += playerSpeed;
    }
    
    // Draw player
    if (window.playerImg) {
    ctx.drawImage(playerImg, playerX, canvas.height - playerHeight - 10,
                  playerWidth, playerHeight);
    }
    
    // Spawn items
    itemSpawnTimer++;
    if (itemSpawnTimer >= itemSpawnInterval) {
        spawnItem();
        itemSpawnTimer = 0;
    }
    
    // Update and draw items
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.update();
        item.draw();
        
        // Check for collision
        const playerRect = {
            x: playerX,
            y: canvas.height - playerHeight - 10,
            width: playerWidth,
            height: playerHeight
        };
        
        const itemRect = {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height
        };
        
        if (checkCollision(playerRect, itemRect)) {
            if (item.isGood) {
                score += 10;
                updateScore();
            } else {
                lives--;
                updateLives();
                if (lives <= 0) {
                    endGame();
                    return;
                }
            }
            items.splice(i, 1);
        } else if (item.isOffScreen()) {
            items.splice(i, 1);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Event listeners for buttons
startBtn.addEventListener('click', async () => {
    unlockAudio();
    await loadAllAssets();
    startBackground();
    startGame();
});
restartBtn.addEventListener('click', () => {
    startBackground();
    startGame();
});

/* ----------  PAUSE / RESUME ON TAB SWITCH  ---------- */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {          // user left
        gameActive = false;         // stop game loop
        if (bgSource) {             // stop music
            bgSource.stop();
            bgSource = null;
        }
    } else {                        // user came back
        if (bgBuffer && !bgSource) startBackground(); // resume music
        if (lives > 0 && !gameActive) {               // resume game
            gameActive = true;
            requestAnimationFrame(gameLoop);
        }
    }
});