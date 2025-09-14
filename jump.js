// 游戏常量
const WIDTH = 800;
const HEIGHT = 400;
const GROUND_HEIGHT = HEIGHT - 50;
const GRAVITY = 0.5;

// 颜色定义
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const RED = "#FF0000";
const BLUE = "#0000FF";

// 获取canvas和上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 获取UI元素
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const gameOverElement = document.getElementById('gameOver');
const newRecordElement = document.getElementById('newRecord');

// 游戏变量
let player;
let obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = 2000;
let minInterval = 1000;
let obstacleSpeed = 7;
let maxSpeed = 25;
let score = 0;
let highScore = 0;
let gameRunning = true;
let lastTimestamp = 0;
let obstacleCounter = 0;
let isFullscreen = false;
let fullscreenRequested = false;

// 性能优化变量
let lastFrameTime = 0;
let frameRate = 60;
let frameInterval = 1000 / frameRate;
let lastFpsCheck = 0;
let framesThisSecond = 0;
let currentFps = frameRate;

// 读取最高分
function loadHighScore() {
    const sources = [
        () => localStorage.getItem('highScore'),
        () => sessionStorage.getItem('highScore')
    ];

    let loadedScore = 0;

    for (const source of sources) {
        try {
            const savedScore = source();
            if (savedScore !== null) {
                const parsedScore = parseInt(savedScore);
                if (parsedScore > loadedScore) {
                    loadedScore = parsedScore;
                }
            }
        } catch (e) {
            console.log("无法从存储源加载最高分:", e);
        }
    }

    highScore = loadedScore;
    highScoreElement.textContent = highScore;
}

// 保存最高分
function saveHighScore() {
    try {
        localStorage.setItem('highScore', highScore.toString());
        sessionStorage.setItem('highScore', highScore.toString());
    } catch (e) {
        console.log("保存最高分时出错:", e);
    }
}

// 玩家类
class Player {
    constructor() {
        this.width = 30;
        this.height = 50;
        this.x = 50;
        this.y = GROUND_HEIGHT - this.height;
        this.jumpVelocity = 0;
        this.isJumping = false;
        this.hasDoubleJump = false;
        this.color = BLUE;
    }

    jump() {
        if (!this.isJumping) {
            this.jumpVelocity = -12;
            this.isJumping = true;
            this.hasDoubleJump = true;
        } else if (this.hasDoubleJump) {
            this.jumpVelocity = -10;
            this.hasDoubleJump = false;
        }
    }

    update() {
        // 应用重力
        this.y += this.jumpVelocity;
        this.jumpVelocity += 0.7 * GRAVITY;

        // 检查是否落地
        if (this.y >= GROUND_HEIGHT - this.height) {
            this.y = GROUND_HEIGHT - this.height;
            this.isJumping = false;
            this.jumpVelocity = 0;
            this.hasDoubleJump = false;
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// 障碍物类
class Obstacle {
    constructor(x, speed) {
        this.width = 30;
        this.height = Math.floor(Math.random() * 31) + 20; // 20-50之间
        this.x = x;
        this.y = GROUND_HEIGHT - this.height;
        this.speed = speed;
        this.color = RED;
        this.passed = false;
        this.scoreValue = 1;
    }

    update(deltaTime) {
        // 使用更简单的速度计算
        this.x -= this.speed * (deltaTime / 16);
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    isOffScreen() {
        return this.x < -this.width;
    }

    // 优化的碰撞检测
    checkCollision(player) {
        return player.x < this.x + this.width &&
            player.x + player.width > this.x &&
            player.y < this.y + this.height &&
            player.y + player.height > this.y;
    }
}

// 初始化游戏
function initGame() {
    player = new Player();
    obstacles = [];
    obstacleTimer = 0;
    obstacleInterval = 1500;
    minInterval = 500;
    obstacleSpeed = 5;
    score = 0;
    gameRunning = true;
    obstacleCounter = 0;
    gameOverElement.classList.remove('visible');
    newRecordElement.classList.add('hidden');
    scoreElement.textContent = score;
    lastTimestamp = 0;

    // 优化：只在初始化时进入全屏
    if (!isFullscreen) {
        enterFullscreen();
    }
}

// 生成障碍物
function spawnObstacle() {
    obstacleCounter++;
    obstacleInterval = Math.max(minInterval, obstacleInterval - 20);
    obstacleSpeed = Math.min(maxSpeed, obstacleSpeed + 0.05);

    const newObstacle = new Obstacle(WIDTH, obstacleSpeed);
    newObstacle.scoreValue = 1 + Math.floor(obstacleCounter / 10);
    obstacles.push(newObstacle);
}

// 更新游戏状态
function updateGame(timestamp) {
    if (!gameRunning) return;

    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // FPS计算优化
    framesThisSecond++;
    if (timestamp >= lastFpsCheck + 1000) {
        currentFps = framesThisSecond;
        framesThisSecond = 0;
        lastFpsCheck = timestamp;

        // 动态调整帧率以优化性能
        if (currentFps < 30 && frameRate > 30) {
            frameRate = 30;
            frameInterval = 1000 / frameRate;
        }
    }

    player.update();

    obstacleTimer += deltaTime;
    if (obstacleTimer >= obstacleInterval) {
        spawnObstacle();
        obstacleTimer = 0;
    }

    // 优化障碍物更新循环
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.update(deltaTime);

        if (obstacle.checkCollision(player)) {
            gameOver();
            return;
        }

        if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
            obstacle.passed = true;
            score += obstacle.scoreValue;
            // 减少DOM操作频率
            if (score % 5 === 0) { // 每5分更新一次显示
                scoreElement.textContent = score;
            }
        }

        if (obstacle.isOffScreen()) {
            obstacles.splice(i, 1);
        }
    }
}

// 绘制游戏画面
function drawGame() {
    // 使用clearRect替代fillRect提高性能
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 绘制背景
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 绘制地面
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, GROUND_HEIGHT, WIDTH, HEIGHT - GROUND_HEIGHT);

    // 绘制玩家和障碍物
    player.draw();
    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].draw();
    }

    // 实时更新分数显示
    scoreElement.textContent = score;
}

function enterFullscreen() {
    if (fullscreenRequested || isFullscreen) return;

    fullscreenRequested = true;
    const elem = document.documentElement;

    const promises = [
        elem.requestFullscreen ? elem.requestFullscreen() : Promise.reject(),
        elem.webkitRequestFullscreen ? elem.webkitRequestFullscreen() : Promise.reject(),
        elem.msRequestFullscreen ? elem.msRequestFullscreen() : Promise.reject()
    ];

    Promise.any(promises)
        .then(() => {
            isFullscreen = true;
        })
        .catch(() => {
            console.log('无法进入全屏模式');
        })
        .finally(() => {
            fullscreenRequested = false;
        });
}

function exitFullscreen() {
    if (!isFullscreen) return;

    const promises = [
        document.exitFullscreen ? document.exitFullscreen() : Promise.reject(),
        document.webkitExitFullscreen ? document.webkitExitFullscreen() : Promise.reject(),
        document.msExitFullscreen ? document.msExitFullscreen() : Promise.reject()
    ];

    Promise.any(promises)
        .then(() => {
            isFullscreen = false;
        })
        .catch(() => {
            console.log('无法退出全屏模式');
        });
}

// 游戏结束处理
function gameOver() {
    if (!gameRunning) return; // 防止重复调用

    gameRunning = false;

    if (score > highScore) {
        highScore = score;
        saveHighScore();
        highScoreElement.textContent = highScore;
        newRecordElement.classList.remove('hidden');
    }

    gameOverElement.classList.add('visible');
}

// 游戏主循环
function gameLoop(timestamp) {
    // 优化帧率控制
    if (timestamp - lastFrameTime < frameInterval) {
        requestAnimationFrame(gameLoop);
        return;
    }

    lastFrameTime = timestamp;

    updateGame(timestamp);
    drawGame();

    requestAnimationFrame(gameLoop);
}

// 键盘事件处理
document.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'Space':
        case 'ArrowUp':
            if (gameRunning) {
                player.jump();
            }
            event.preventDefault();
            break;

        case 'KeyR':
            if (!gameRunning) {
                initGame();
            }
            event.preventDefault();
            break;

        case 'KeyF':
            if (isFullscreen) {
                exitFullscreen();
            } else {
                enterFullscreen();
            }
            event.preventDefault();
            break;
    }
});

// 优化移动端触摸体验
let touchStartY = 0;
canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    touchStartY = touch.clientY;

    if (gameRunning) {
        player.jump();
    } else {
        initGame();
    }
    event.preventDefault();
}, { passive: false });

// 添加触摸移动事件防止页面滚动
canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
}, { passive: false });

// 优化按钮点击事件
document.getElementById('restartButton').addEventListener('click', () => {
    if (!gameRunning) {
        initGame();
    }
});

// 从IndexedDB加载最高分（如果可用）
function loadHighScoreFromIndexedDB() {
    // 简化IndexedDB操作以提高性能
    if ('indexedDB' in window) {
        try {
            const request = indexedDB.open('JumpGameDB', 1);

            request.onsuccess = function (event) {
                const db = event.target.result;
                const transaction = db.transaction(['scores'], 'readonly');
                const store = transaction.objectStore('scores');
                const getRequest = store.get('highScore');

                getRequest.onsuccess = function (event) {
                    if (event.target.result) {
                        const indexedScore = event.target.result.value;
                        if (indexedScore > highScore) {
                            highScore = indexedScore;
                            highScoreElement.textContent = highScore;
                        }
                    }
                };
            };
        } catch (e) {
            console.log("IndexedDB加载失败:", e);
        }
    }
}

// 初始化并开始游戏
loadHighScore();
loadHighScoreFromIndexedDB();
initGame();
requestAnimationFrame(gameLoop);
