// 游戏常量
const SCREEN_WIDTH = 900;
const SCREEN_HEIGHT = 800;
const GRID_SIZE = 35;
const GRID_WIDTH = 12;
const GRID_HEIGHT = 20;

// 颜色定义
const COLORS = {
    BLACK: '#000000',
    WHITE: '#FFFFFF',
    RED: '#FF0000',
    GREEN: '#00FF00',
    BLUE: '#0078FF',
    YELLOW: '#FFFF00',
    PURPLE: '#B400FF',
    CYAN: '#00FFFF',
    ORANGE: '#FFA500',
    GRAY: '#808080',
    DARK_GRAY: '#323232'
};

// 方块形状定义
const SHAPES = [
    [[1, 1, 1, 1]],  // I
    [[1, 1], [1, 1]],  // O
    [[1, 1, 1], [0, 1, 0]],  // T
    [[1, 1, 1], [1, 0, 0]],  // L
    [[1, 1, 1], [0, 0, 1]],  // J
    [[0, 1, 1], [1, 1, 0]],  // S
    [[1, 1, 0], [0, 1, 1]]   // Z
];

// 方块颜色
const SHAPE_COLORS = [COLORS.CYAN, COLORS.YELLOW, COLORS.PURPLE, COLORS.ORANGE, COLORS.BLUE, COLORS.GREEN, COLORS.RED];

class Tetromino {
    constructor() {
        this.shapeIndex = Math.floor(Math.random() * SHAPES.length);
        this.shape = SHAPES[this.shapeIndex];
        this.color = SHAPE_COLORS[this.shapeIndex];
        this.x = Math.floor(GRID_WIDTH / 2) - Math.floor(this.shape[0].length / 2);
        this.y = 0;
    }

    rotate() {
        // 旋转方块 (转置然后反转每一行)
        const rotated = [];
        for (let x = 0; x < this.shape[0].length; x++) {
            const newRow = [];
            for (let y = this.shape.length - 1; y >= 0; y--) {
                newRow.push(this.shape[y][x]);
            }
            rotated.push(newRow);
        }
        return rotated;
    }

    draw(ctx, xOffset = 0, yOffset = 0) {
        for (let y = 0; y < this.shape.length; y++) {
            for (let x = 0; x < this.shape[y].length; x++) {
                if (this.shape[y][x]) {
                    const rectX = (this.x + x + xOffset) * GRID_SIZE;
                    const rectY = (this.y + y + yOffset) * GRID_SIZE;
                    ctx.fillStyle = this.color;
                    ctx.fillRect(rectX, rectY, GRID_SIZE, GRID_SIZE);
                    ctx.strokeStyle = COLORS.WHITE;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(rectX, rectY, GRID_SIZE, GRID_SIZE);
                }
            }
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.board = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));
        this.currentPiece = new Tetromino();
        this.nextPiece = new Tetromino();
        this.gameOver = false;
        this.score = 0;
        this.highScore = this.getHighScore(); // 获取最高分
        this.level = 1;
        this.linesCleared = 0;
        this.fallSpeed = 0.5;  // 方块下落的速度（秒）
        this.lastFallTime = Date.now();
        this.baseFallSpeed = 0.5;  // 基础下落速度
        this.clearEffect = [];  // 存储消除效果的位置
        this.clearEffectTime = 0;  // 消除效果的持续时间
        this.paused = false;

        this.setupEventListeners();
        this.createTouchControls();
        this.gameLoop();

        // 监听屏幕方向变化
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    // 处理屏幕方向变化
    handleOrientationChange() {
        setTimeout(() => {
            this.adjustForMobile();
        }, 100);
    }

    // 处理窗口大小变化
    handleResize() {
        this.adjustForMobile();
    }

    // 调整移动端显示
    adjustForMobile() {
        const isPortrait = window.innerHeight > window.innerWidth;
        const isMobile = window.innerWidth <= 1000;

        if (isMobile && isPortrait) {
            // 竖屏移动端 - 启用旋转
            document.body.style.transform = 'rotate(-90deg)';
            document.body.style.transformOrigin = 'left top';
            document.body.style.width = window.innerHeight + 'px';
            document.body.style.height = window.innerWidth + 'px';
            document.body.style.position = 'absolute';
            document.body.style.top = '100%';
            document.body.style.left = '0';
        } else {
            // 横屏或其他情况 - 恢复正常
            document.body.style.transform = '';
            document.body.style.transformOrigin = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
        }
    }

    // 获取存储的最高分 - 使用多种存储机制
    getHighScore() {
        // 尝试从多个存储源加载最高分
        const sources = [
            () => localStorage.getItem('tetrisHighScore'),
            () => sessionStorage.getItem('tetrisHighScore')
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

        // 尝试从IndexedDB加载
        this.loadHighScoreFromIndexedDB().then(indexedScore => {
            if (indexedScore > loadedScore) {
                this.highScore = indexedScore;
            }
        });

        return loadedScore;
    }

    // 保存最高分到多个存储源
    saveHighScore() {
        try {
            // 保存到多个存储源以提高持久性
            localStorage.setItem('tetrisHighScore', this.highScore.toString());
            sessionStorage.setItem('tetrisHighScore', this.highScore.toString());

            // 保存到IndexedDB
            this.saveHighScoreToIndexedDB();
        } catch (e) {
            console.log("保存最高分时出错:", e);
        }
    }

    // 保存最高分到IndexedDB
    saveHighScoreToIndexedDB() {
        if ('indexedDB' in window) {
            const request = indexedDB.open('TetrisDB', 1);

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
                store.put({ id: 'highScore', value: this.highScore });
            }.bind(this);
        }
    }

    // 从IndexedDB加载最高分
    async loadHighScoreFromIndexedDB() {
        return new Promise((resolve) => {
            if ('indexedDB' in window) {
                const request = indexedDB.open('TetrisDB', 1);

                request.onsuccess = function (event) {
                    const db = event.target.result;
                    const transaction = db.transaction(['scores'], 'readonly');
                    const store = transaction.objectStore('scores');
                    const getRequest = store.get('highScore');

                    getRequest.onsuccess = function (event) {
                        if (event.target.result) {
                            resolve(event.target.result.value);
                        } else {
                            resolve(0);
                        }
                    };

                    getRequest.onerror = function () {
                        resolve(0);
                    };
                };

                request.onerror = function () {
                    resolve(0);
                };
            } else {
                resolve(0);
            }
        });
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            // 处理游戏重置和暂停，即使在游戏结束时也应该可以执行
            switch (e.key) {
                case 'r':
                case 'R':
                    this.reset();
                    return; // 处理完后直接返回
                case 'p':
                case 'P':
                    this.paused = !this.paused;
                    return; // 处理完后直接返回
            }

            // 如果游戏结束或暂停，则不处理其他按键
            if (this.gameOver) return;
            if (!this.paused) {
                switch (e.key) {
                    case 'ArrowLeft':
                        this.move(-1, 0);
                        break;
                    case 'ArrowRight':
                        this.move(1, 0);
                        break;
                    case 'ArrowDown':
                        this.dropPiece();
                        break;
                    case 'ArrowUp':
                        this.rotatePiece();
                        break;
                }
            }
        });
    }

    createTouchControls() {
        // 创建触摸控制按钮
        const touchControls = document.createElement('div');
        touchControls.className = 'touch-controls';

        const leftBtn = document.createElement('div');
        leftBtn.className = 'touch-btn';
        leftBtn.innerHTML = '←';
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.move(-1, 0);
        });
        leftBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.move(-1, 0);
        });

        const rightBtn = document.createElement('div');
        rightBtn.className = 'touch-btn';
        rightBtn.innerHTML = '→';
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.move(1, 0);
        });
        rightBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.move(1, 0);
        });

        const rotateBtn = document.createElement('div');
        rotateBtn.className = 'touch-btn';
        rotateBtn.innerHTML = '↻';
        rotateBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.rotatePiece();
        });
        rotateBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.rotatePiece();
        });

        const downBtn = document.createElement('div');
        downBtn.className = 'touch-btn';
        downBtn.innerHTML = '↓';
        downBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.dropPiece();
        });
        downBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.paused) this.dropPiece();
        });

        touchControls.appendChild(leftBtn);
        touchControls.appendChild(rotateBtn);
        touchControls.appendChild(rightBtn);
        touchControls.appendChild(downBtn);

        document.body.appendChild(touchControls);
    }

    drawBoard() {
        // 绘制游戏区域背景
        this.ctx.fillStyle = COLORS.DARK_GRAY;
        this.ctx.fillRect(0, 0, GRID_WIDTH * GRID_SIZE, GRID_HEIGHT * GRID_SIZE);

        // 绘制已放置的方块
        for (let y = 0; y < this.board.length; y++) {
            for (let x = 0; x < this.board[y].length; x++) {
                if (this.board[y][x]) {
                    const colorIdx = this.board[y][x] - 1;
                    this.ctx.fillStyle = SHAPE_COLORS[colorIdx];
                    this.ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
                    this.ctx.strokeStyle = COLORS.WHITE;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
                }
            }
        }

        // 绘制消除行的效果
        if (this.clearEffect.length > 0 && this.clearEffectTime > 0) {
            for (const y of this.clearEffect) {
                // 绘制闪烁效果
                const alpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
                this.ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
                this.ctx.fillRect(0, y * GRID_SIZE, GRID_WIDTH * GRID_SIZE, GRID_SIZE);
            }
        }
    }

    drawSidebar() {
        const sidebarX = GRID_WIDTH * GRID_SIZE + 30;

        // 绘制下一个方块预览
        this.ctx.fillStyle = COLORS.WHITE;
        this.ctx.font = '36px Arial';
        this.ctx.fillText('next:', sidebarX, 50);

        // 绘制下一个方块
        this.nextPiece.draw(this.ctx, GRID_WIDTH + 4, 3);

        // 绘制分数
        this.ctx.fillText(`score: ${this.score}`, sidebarX, 230);

        // 绘制最高分
        this.ctx.fillText(`high score: ${this.highScore}`, sidebarX, 290);

        // 绘制等级
        this.ctx.fillText(`level: ${this.level}`, sidebarX, 350);

        // 绘制已消除行数
        this.ctx.fillText(`lines: ${this.linesCleared}`, sidebarX, 410);
    }

    checkCollision(shape, x, y) {
        for (let rowIdx = 0; rowIdx < shape.length; rowIdx++) {
            for (let colIdx = 0; colIdx < shape[rowIdx].length; colIdx++) {
                if (shape[rowIdx][colIdx]) {
                    // 检查是否超出边界
                    if (x + colIdx < 0 || x + colIdx >= GRID_WIDTH || y + rowIdx >= GRID_HEIGHT) {
                        return true;
                    }
                    // 检查是否与已放置的方块重叠
                    if (y + rowIdx >= 0 && this.board[y + rowIdx][x + colIdx]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    mergePiece() {
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x] && this.currentPiece.y + y >= 0) {
                    this.board[this.currentPiece.y + y][this.currentPiece.x + x] = this.currentPiece.shapeIndex + 1;
                }
            }
        }
    }

    clearLines() {
        const linesToClear = [];
        for (let y = 0; y < this.board.length; y++) {
            if (this.board[y].every(cell => cell !== 0)) {
                linesToClear.push(y);
            }
        }

        if (linesToClear.length > 0) {
            // 设置消除效果
            this.clearEffect = [...linesToClear];
            this.clearEffectTime = 0.4;  // 效果持续0.4秒

            // 执行消除行
            for (const line of linesToClear) {
                this.board.splice(line, 1);
                this.board.unshift(Array(GRID_WIDTH).fill(0));
            }
        }

        // 更新分数
        if (linesToClear.length > 0) {
            this.linesCleared += linesToClear.length;
            const points = [100, 300, 500, 800];
            this.score += points[Math.min(linesToClear.length - 1, 3)] * this.level;

            // 更新最高分
            if (this.score > this.highScore) {
                this.highScore = this.score;
            }

            // 修改等级提升速度，每5行提升1级（原来是每10行）
            this.level = Math.floor(this.linesCleared / 5) + 1;
            // 修改下落速度计算方式，使其变化更快
            this.fallSpeed = Math.max(0.05, this.baseFallSpeed * Math.pow(0.7, this.level - 1));
        }
    }

    newPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = new Tetromino();

        // 检查游戏是否结束
        if (this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.gameOver = true;
            this.saveHighScore(); // 游戏结束时保存最高分
        }
    }

    move(dx, dy) {
        if (!this.checkCollision(this.currentPiece.shape, this.currentPiece.x + dx, this.currentPiece.y + dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            return true;
        }
        return false;
    }

    rotatePiece() {
        const rotated = this.currentPiece.rotate();
        if (!this.checkCollision(rotated, this.currentPiece.x, this.currentPiece.y)) {
            this.currentPiece.shape = rotated;
            return true;
        }

        // 尝试墙踢（wall kick）
        for (const dx of [-1, 1, -2, 2]) {
            if (!this.checkCollision(rotated, this.currentPiece.x + dx, this.currentPiece.y)) {
                this.currentPiece.x += dx;
                this.currentPiece.shape = rotated;
                return true;
            }
        }
        return false;
    }

    dropPiece() {
        while (this.move(0, 1)) {
            // 继续下落
        }
        this.mergePiece();
        this.clearLines();
        this.newPiece();
    }

    update() {
        if (this.paused || this.gameOver) return;

        const currentTime = Date.now();

        // 更新消除效果时间
        if (this.clearEffectTime > 0) {
            this.clearEffectTime -= 1 / 60;  // 假设60FPS
            if (this.clearEffectTime <= 0) {
                this.clearEffect = [];
            }
        }

        if (currentTime - this.lastFallTime > this.fallSpeed * 1000) {
            if (!this.move(0, 1)) {
                this.mergePiece();
                this.clearLines();
                this.newPiece();
            }
            this.lastFallTime = currentTime;
        }
    }

    draw() {
        // 清空画布
        this.ctx.fillStyle = COLORS.BLACK;
        this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

        this.drawBoard();
        this.currentPiece.draw(this.ctx);
        this.drawSidebar();

        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

            this.ctx.fillStyle = COLORS.RED;
            this.ctx.font = '72px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('game over!', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);

            this.ctx.fillStyle = COLORS.WHITE;
            this.ctx.font = '36px Arial';
            this.ctx.fillText('press R to restart', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 50);
            this.ctx.textAlign = 'left';
        }

        if (this.paused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

            this.ctx.fillStyle = COLORS.YELLOW;
            this.ctx.font = '72px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('stop', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
            this.ctx.textAlign = 'left';
        }
    }

    reset() {
        this.board = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));
        this.currentPiece = new Tetromino();
        this.nextPiece = new Tetromino();
        this.gameOver = false;
        this.score = 0;
        this.level = 1;
        this.linesCleared = 0;
        this.fallSpeed = 0.5;
        this.lastFallTime = Date.now();
        this.clearEffect = [];
        this.clearEffectTime = 0;
        this.paused = false;
        // 保留最高分记录
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 启动游戏
window.addEventListener('load', () => {
    new Game();
});