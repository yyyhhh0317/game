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
        this.level = 1;
        this.linesCleared = 0;
        this.fallSpeed = 0.5;  // 方块下落的速度（秒）
        this.lastFallTime = Date.now();
        this.baseFallSpeed = 0.5;  // 基础下落速度
        this.clearEffect = [];  // 存储消除效果的位置
        this.clearEffectTime = 0;  // 消除效果的持续时间
        this.paused = false;

        this.setupEventListeners();
        this.gameLoop();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
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

            switch (e.key) {
                case 'r':
                case 'R':
                    this.reset();
                    break;
                case 'p':
                case 'P':
                    this.paused = !this.paused;
                    break;
            }
        });
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

        // 绘制等级
        this.ctx.fillText(`level: ${this.level}`, sidebarX, 290);

        // 绘制已消除行数
        this.ctx.fillText(`lines: ${this.linesCleared}`, sidebarX, 350);
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
            this.level = Math.floor(this.linesCleared / 10) + 1;
            // 修改下落速度计算方式，使其逐渐变快
            this.fallSpeed = Math.max(0.05, this.baseFallSpeed * Math.pow(0.85, this.level - 1));
        }
    }

    newPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = new Tetromino();

        // 检查游戏是否结束
        if (this.checkCollision(this.currentPiece.shape, this.currentPiece.x, this.currentPiece.y)) {
            this.gameOver = true;
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