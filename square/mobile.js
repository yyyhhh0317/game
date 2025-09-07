// 游戏常量 - 调整为更适合手机屏幕的尺寸
const SCREEN_WIDTH = 300;
const SCREEN_HEIGHT = 600;
const GRID_SIZE = 30;
const GRID_WIDTH = 10;
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

    draw(ctx, xOffset = 0, yOffset = 0, cellSize = GRID_SIZE) {
        for (let y = 0; y < this.shape.length; y++) {
            for (let x = 0; x < this.shape[y].length; x++) {
                if (this.shape[y][x]) {
                    const rectX = (this.x + x + xOffset) * cellSize;
                    const rectY = (this.y + y + yOffset) * cellSize;
                    ctx.fillStyle = this.color;
                    ctx.fillRect(rectX, rectY, cellSize, cellSize);
                    ctx.strokeStyle = COLORS.WHITE;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(rectX, rectY, cellSize, cellSize);
                }
            }
        }
    }
}

class MobileGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextPieceCanvas = document.getElementById('nextPieceCanvas');
        this.nextCtx = this.nextPieceCanvas.getContext('2d');
        this.board = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));
        this.currentPiece = new Tetromino();
        this.nextPiece = new Tetromino();
        this.gameOver = false;
        this.score = 0;
        this.highScore = this.getHighScore();
        this.level = 1;
        this.linesCleared = 0;
        this.fallSpeed = 0.5;
        this.lastFallTime = Date.now();
        this.baseFallSpeed = 0.5;
        this.clearEffect = [];
        this.clearEffectTime = 0;
        this.paused = false;

        // UI元素
        this.scoreElement = document.getElementById('score');
        this.highScoreElement = document.getElementById('highScore');
        this.levelElement = document.getElementById('level');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.restartBtn = document.getElementById('restartBtn');

        this.setupEventListeners();
        this.setupTouchControls();
        this.gameLoop();

        // 初始调整画布大小
        this.adjustCanvasSize();
        window.addEventListener('resize', this.adjustCanvasSize.bind(this));
    }

    adjustCanvasSize() {
        // 确保画布保持正确的宽高比
        const containerWidth = this.canvas.parentElement.offsetWidth;
        const maxWidth = Math.min(containerWidth, 300);

        this.canvas.style.width = maxWidth + 'px';
        this.canvas.style.height = (maxWidth * 2) + 'px';
    }

    getHighScore() {
        try {
            return parseInt(localStorage.getItem('tetrisHighScore')) || 0;
        } catch (e) {
            return 0;
        }
    }

    saveHighScore() {
        try {
            localStorage.setItem('tetrisHighScore', this.highScore.toString());
        } catch (e) {
            console.log("无法保存最高分:", e);
        }
    }

    setupEventListeners() {
        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                this.reset();
                return;
            }

            if (e.key === 'p' || e.key === 'P') {
                this.togglePause();
                return;
            }

            if (this.gameOver || this.paused) return;

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
        });

        // 按钮控制
        this.pauseBtn.addEventListener('click', () => {
            this.togglePause();
        });

        this.restartBtn.addEventListener('click', () => {
            this.reset();
        });
    }

    setupTouchControls() {
        const leftBtn = document.querySelector('.left-btn');
        const rightBtn = document.querySelector('.right-btn');
        const rotateBtn = document.querySelector('.rotate-btn');
        const downBtn = document.querySelector('.down-btn');

        // 添加触摸和鼠标事件
        const addControlEvent = (element, action) => {
            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!this.gameOver && !this.paused) action();
            });

            element.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (!this.gameOver && !this.paused) action();
            });
        };

        addControlEvent(leftBtn, () => this.move(-1, 0));
        addControlEvent(rightBtn, () => this.move(1, 0));
        addControlEvent(rotateBtn, () => this.rotatePiece());
        addControlEvent(downBtn, () => this.dropPiece());
    }

    togglePause() {
        this.paused = !this.paused;
        this.pauseBtn.textContent = this.paused ? '继续' : '暂停';
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

    drawNextPiece() {
        // 清空下一个方块预览区域
        this.nextCtx.fillStyle = COLORS.BLACK;
        this.nextCtx.fillRect(0, 0, this.nextPieceCanvas.width, this.nextPieceCanvas.height);

        // 绘制下一个方块（缩小尺寸以适应预览区域）
        const previewSize = 20;
        const offsetX = (this.nextPieceCanvas.width - this.nextPiece.shape[0].length * previewSize) / 2;
        const offsetY = (this.nextPieceCanvas.height - this.nextPiece.shape.length * previewSize) / 2;

        for (let y = 0; y < this.nextPiece.shape.length; y++) {
            for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                if (this.nextPiece.shape[y][x]) {
                    this.nextCtx.fillStyle = this.nextPiece.color;
                    this.nextCtx.fillRect(offsetX + x * previewSize, offsetY + y * previewSize, previewSize, previewSize);
                    this.nextCtx.strokeStyle = COLORS.WHITE;
                    this.nextCtx.lineWidth = 1;
                    this.nextCtx.strokeRect(offsetX + x * previewSize, offsetY + y * previewSize, previewSize, previewSize);
                }
            }
        }
    }

    updateUI() {
        this.scoreElement.textContent = this.score;
        this.highScoreElement.textContent = this.highScore;
        this.levelElement.textContent = this.level;
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
            this.clearEffectTime = 0.4;

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
                this.saveHighScore();
            }

            // 每5行提升1级
            this.level = Math.floor(this.linesCleared / 5) + 1;
            // 修改下落速度计算方式
            this.fallSpeed = Math.max(0.05, this.baseFallSpeed * Math.pow(0.7, this.level - 1));
        }
    }

    newPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = new Tetromino();

        // 检查游戏是否结束
        if (this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.gameOver = true;
            this.saveHighScore();
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
            this.clearEffectTime -= 1 / 60;
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
        this.drawNextPiece();
        this.updateUI();

        // 游戏结束和暂停状态在CSS中通过叠加层处理
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
        this.pauseBtn.textContent = '暂停';

        // 更新最高分显示
        this.highScore = this.getHighScore();
        this.updateUI();
    }

    gameLoop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// 启动游戏
window.addEventListener('load', () => {
    new MobileGame();
});