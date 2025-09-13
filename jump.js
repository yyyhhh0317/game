// 游戏常量
const WIDTH = 800;
const HEIGHT = 400;
const GROUND_HEIGHT = HEIGHT - 50;
const GRAVITY = 0.5; // 降低重力影响

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
let obstacleInterval = 2000; // 增大初始障碍物间隔(毫秒)
let minInterval = 1000; // 增大最小间隔
let obstacleSpeed = 7; // 初始速度
let maxSpeed = 25; // 最大速度
let score = 0;
let highScore = 0;
let gameRunning = true;
let lastTime = 0;
let obstacleCounter = 0;
let lastTimestamp = 0;

// 读取最高分
function loadHighScore() {
    // 尝试从多个存储源加载最高分
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
        // 保存到多个存储源以提高持久性
        localStorage.setItem('highScore', highScore.toString());
        sessionStorage.setItem('highScore', highScore.toString());

        // 尝试使用 IndexedDB 进行更持久的存储
        if ('indexedDB' in window) {
            const request = indexedDB.open('JumpGameDB', 1);

            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('scores')) {
                    db.createObjectStore('scores', { keyPath: 'id' });
                }
            };

            request.onsuccess = function (event) {
                const db = event.target.result;
                const transaction = db.transaction(['scores'], 'readwrite');
                const store = transaction.objectStore('scores');
                store.put({ id: 'highScore', value: highScore });
            };
        }
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
            // 第一次跳跃
            this.jumpVelocity = -12; // 降低跳跃初速度
            this.isJumping = true;
            this.hasDoubleJump = true;
        } else if (this.hasDoubleJump) {
            // 二连跳
            this.jumpVelocity = -10; // 降低二连跳初速度
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
        // 根据实际时间差调整移动速度，确保在不同设备上速度一致
        const baseFrameTime = 16; // 60FPS的标准帧时间(毫秒)
        this.x -= this.speed * (deltaTime / baseFrameTime);
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    isOffScreen() {
        return this.x < -this.width;
    }

    checkCollision(player) {
        return (
            player.x < this.x + this.width &&
            player.x + player.width > this.x &&
            player.y < this.y + this.height &&
            player.y + player.height > this.y
        );
    }
}

// 初始化游戏
function initGame() {
    player = new Player();
    obstacles = [];
    obstacleTimer = 0;
    obstacleInterval = 1500; // 重置为更大的初始间隔
    minInterval = 500; // 重置为更大的最小间隔
    obstacleSpeed = 5;
    score = 0;
    gameRunning = true;
    obstacleCounter = 0;
    gameOverElement.classList.remove('visible');
    newRecordElement.classList.add('hidden');
    scoreElement.textContent = score;
    lastTimestamp = 0;
}

// 生成障碍物
function spawnObstacle() {
    obstacleCounter++;
    // 随着时间增加难度，但调整参数使游戏更平衡
    obstacleInterval = Math.max(minInterval, obstacleInterval - 20); // 调整间隔减少量
    obstacleSpeed = Math.min(maxSpeed, obstacleSpeed + 0.05);

    // 创建新障碍物
    const newObstacle = new Obstacle(WIDTH, obstacleSpeed);
    newObstacle.scoreValue = 1 + Math.floor(obstacleCounter / 10);
    obstacles.push(newObstacle);
}

// 更新游戏状态
function updateGame(timestamp) {
    if (!gameRunning) return;

    // 计算时间差以确保在不同设备上速度一致
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // 更新玩家
    player.update();

    // 生成障碍物
    obstacleTimer += deltaTime;
    if (obstacleTimer >= obstacleInterval) {
        spawnObstacle();
        obstacleTimer = 0;
    }

    // 更新障碍物
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.update(deltaTime);

        // 检查碰撞
        if (obstacle.checkCollision(player)) {
            gameOver();
        }

        // 检查是否越过障碍物并计分
        if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
            obstacle.passed = true;
            score += obstacle.scoreValue;
            scoreElement.textContent = score;
        }

        // 移除屏幕外的障碍物
        if (obstacle.isOffScreen()) {
            obstacles.splice(i, 1);
        }
    }
}

// 绘制游戏画面
function drawGame() {
    // 绘制背景
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 绘制地面
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, GROUND_HEIGHT, WIDTH, HEIGHT - GROUND_HEIGHT);

    // 绘制玩家和障碍物
    player.draw();
    obstacles.forEach(obstacle => obstacle.draw());
}

// 添加重新开始游戏函数
function restartGame() {
    initGame();
    // 移除双击事件监听器
    canvas.removeEventListener('dblclick', restartGame);
}

// 游戏结束处理
function gameOver() {
    gameRunning = false;

    // 更新最高分
    if (score > highScore) {
        highScore = score;
        saveHighScore();
        highScoreElement.textContent = highScore;
        newRecordElement.classList.remove('hidden');
    }

    gameOverElement.classList.add('visible');
    // 添加双击重新开始功能
    canvas.addEventListener('dblclick', restartGame);
}

// 游戏主循环
function gameLoop(timestamp) {
    updateGame(timestamp);
    drawGame();

    requestAnimationFrame(gameLoop);
}

// 键盘事件处理
document.addEventListener('keydown', (event) => {
    if ((event.code === 'Space' || event.code === 'ArrowUp') && gameRunning) {
        player.jump();
        event.preventDefault();
    }

    if (event.code === 'KeyR' && !gameRunning) {
        restartGame();
        event.preventDefault();
    }
});

// 触摸事件处理（移动端支持）
canvas.addEventListener('touchstart', (event) => {
    if (gameRunning) {
        player.jump();
    } else {
        restartGame();
    }
    event.preventDefault();
});

// 触摸事件处理（移动端支持）
canvas.addEventListener('touchstart', (event) => {
    if (gameRunning) {
        player.jump();
    } else {
        initGame();
    }
    event.preventDefault();
});

// 从IndexedDB加载最高分（如果可用）
function loadHighScoreFromIndexedDB() {
    if ('indexedDB' in window) {
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
    }
}

// 初始化并开始游戏
loadHighScore();
loadHighScoreFromIndexedDB();
initGame();
requestAnimationFrame(gameLoop);
