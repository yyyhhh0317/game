import pygame
import random
import time
import math

# 初始化pygame
pygame.init()

# 游戏常量 - 调整了屏幕尺寸和网格尺寸
SCREEN_WIDTH = 900
SCREEN_HEIGHT = 800
GRID_SIZE = 35
GRID_WIDTH = 12
GRID_HEIGHT = 20
SIDEBAR_WIDTH = 150

# 颜色定义
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 120, 255)
YELLOW = (255, 255, 0)
PURPLE = (180, 0, 255)
CYAN = (0, 255, 255)
ORANGE = (255, 165, 0)
GRAY = (128, 128, 128)
DARK_GRAY = (50, 50, 50)

# 方块形状定义
SHAPES = [
    [[1, 1, 1, 1]],  # I
    [[1, 1], [1, 1]],  # O
    [[1, 1, 1], [0, 1, 0]],  # T
    [[1, 1, 1], [1, 0, 0]],  # L
    [[1, 1, 1], [0, 0, 1]],  # J
    [[0, 1, 1], [1, 1, 0]],  # S
    [[1, 1, 0], [0, 1, 1]]   # Z
]

# 方块颜色
SHAPE_COLORS = [CYAN, YELLOW, PURPLE, ORANGE, BLUE, GREEN, RED]

# 创建游戏窗口
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("square")

# 游戏时钟
clock = pygame.time.Clock()

# 创建"bling"音效
try:
    # 生成"bling"声音样本
    sample_rate = 22050
    duration = 0.3  # 0.3秒
    frames = int(sample_rate * duration)
    
    # 创建bling音效数据
    sound_data = bytearray()
    for i in range(frames):
        # 创建一个清脆的铃声效果
        t = float(i) / sample_rate
        # 混合多个频率产生bling效果
        frequency1 = 880  # A5
        frequency2 = 1320  # E6
        frequency3 = 1760  # A6
        wave1 = math.sin(2 * math.pi * frequency1 * t) * 0.3
        wave2 = math.sin(2 * math.pi * frequency2 * t) * 0.2
        wave3 = math.sin(2 * math.pi * frequency3 * t) * 0.1
        # 添加快速衰减包络线
        envelope = max(0, 1.0 - t/duration)
        sample = (wave1 + wave2 + wave3) * envelope
        # 转换为16位有符号整数
        value = int(sample * 32767)
        # 限制范围
        value = max(-32768, min(32767, value))
        # 添加到声音数据（小端序）
        sound_data.append(value & 0xff)
        sound_data.append((value >> 8) & 0xff)
    
    # 创建音效对象
    line_clear_sound = pygame.mixer.Sound(buffer=bytes(sound_data))
except Exception as e:
    print(f"无法创建音效: {e}")
    line_clear_sound = None

class Tetromino:
    def __init__(self):
        self.shape_index = random.randint(0, len(SHAPES) - 1)
        self.shape = SHAPES[self.shape_index]
        self.color = SHAPE_COLORS[self.shape_index]
        self.x = GRID_WIDTH // 2 - len(self.shape[0]) // 2
        self.y = 0
    
    def rotate(self):
        # 旋转方块 (转置然后反转每一行)
        rotated = [[self.shape[y][x] for y in range(len(self.shape)-1, -1, -1)] 
                for x in range(len(self.shape[0]))]
        return rotated
    
    def draw(self, x_offset=0, y_offset=0):
        for y, row in enumerate(self.shape):
            for x, cell in enumerate(row):
                if cell:
                    rect_x = (self.x + x + x_offset) * GRID_SIZE
                    rect_y = (self.y + y + y_offset) * GRID_SIZE
                    pygame.draw.rect(screen, self.color, 
                                    (rect_x, rect_y, GRID_SIZE, GRID_SIZE))
                    pygame.draw.rect(screen, WHITE, 
                                    (rect_x, rect_y, GRID_SIZE, GRID_SIZE), 1)

class Game:
    def __init__(self):
        self.board = [[0 for _ in range(GRID_WIDTH)] for _ in range(GRID_HEIGHT)]
        self.current_piece = Tetromino()
        self.next_piece = Tetromino()
        self.game_over = False
        self.score = 0
        self.level = 1
        self.lines_cleared = 0
        self.fall_speed = 0.5  # 方块下落的速度（秒）
        self.last_fall_time = time.time()
        self.base_fall_speed = 0.5  # 基础下落速度
        self.clear_effect = []  # 存储消除效果的位置
        self.clear_effect_time = 0  # 消除效果的持续时间
    
    def draw_board(self):
        # 绘制游戏区域背景
        pygame.draw.rect(screen, DARK_GRAY, (0, 0, GRID_WIDTH * GRID_SIZE, GRID_HEIGHT * GRID_SIZE))

        # 绘制已放置的方块
        for y, row in enumerate(self.board):
            for x, cell in enumerate(row):
                if cell:
                    color_idx = cell - 1
                    pygame.draw.rect(screen, SHAPE_COLORS[color_idx], 
                                    (x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE))
                    pygame.draw.rect(screen, WHITE, 
                                    (x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE), 1)
        
        # 绘制消除行的效果
        if self.clear_effect and self.clear_effect_time > 0:
            for y in self.clear_effect:
                # 绘制闪烁效果
                alpha = 128 + int(127 * math.sin(time.time()*10))
                s = pygame.Surface((GRID_WIDTH * GRID_SIZE, GRID_SIZE), pygame.SRCALPHA)
                s.fill((255, 255, 200, alpha//2))  # 使用淡黄色替代白色
                screen.blit(s, (0, y * GRID_SIZE))
    
    def draw_sidebar(self):
        sidebar_x = GRID_WIDTH * GRID_SIZE + 30  # 增加边距
        
        # 绘制下一个方块预览
        font = pygame.font.SysFont(None, 36)
        next_text = font.render("next:", True, WHITE)
        screen.blit(next_text, (sidebar_x, 30))
        
        # 绘制下一个方块 - 调整位置避免重叠
        self.next_piece.draw(x_offset=GRID_WIDTH + 4, y_offset=3)
        
        # 绘制分数
        score_text = font.render(f"score: {self.score}", True, WHITE)
        screen.blit(score_text, (sidebar_x, 200))
        
        # 绘制等级
        level_text = font.render(f"level: {self.level}", True, WHITE)
        screen.blit(level_text, (sidebar_x, 260))
        
        # 绘制已消除行数
        lines_text = font.render(f"lines: {self.lines_cleared}", True, WHITE)
        screen.blit(lines_text, (sidebar_x, 320))

    def check_collision(self, shape, x, y):
        for row_idx, row in enumerate(shape):
            for col_idx, cell in enumerate(row):
                if cell:
                    # 检查是否超出边界
                    if (x + col_idx < 0 or x + col_idx >= GRID_WIDTH or 
                        y + row_idx >= GRID_HEIGHT):
                        return True
                    # 检查是否与已放置的方块重叠
                    if y + row_idx >= 0 and self.board[y + row_idx][x + col_idx]:
                        return True
        return False
    
    def merge_piece(self):
        for y, row in enumerate(self.current_piece.shape):
            for x, cell in enumerate(row):
                if cell and self.current_piece.y + y >= 0:
                    self.board[self.current_piece.y + y][self.current_piece.x + x] = self.current_piece.shape_index + 1
    
    def clear_lines(self):
        lines_to_clear = []
        for y, row in enumerate(self.board):
            if all(row):
                lines_to_clear.append(y)
        
        if lines_to_clear:
            # 播放"bling"音效
            if line_clear_sound:
                line_clear_sound.play()
            
            # 设置消除效果
            self.clear_effect = lines_to_clear[:]
            self.clear_effect_time = 0.4  # 效果持续0.4秒
            
            # 执行消除行
            for line in lines_to_clear:
                del self.board[line]
                self.board.insert(0, [0 for _ in range(GRID_WIDTH)])
        
        # 更新分数
        if lines_to_clear:
            self.lines_cleared += len(lines_to_clear)
            self.score += [100, 300, 500, 800][min(len(lines_to_clear) - 1, 3)] * self.level
            self.level = self.lines_cleared // 10 + 1
            # 修改下落速度计算方式，使其逐渐变快
            self.fall_speed = max(0.05, self.base_fall_speed * (0.85 ** (self.level - 1)))
    
    def new_piece(self):
        self.current_piece = self.next_piece
        self.next_piece = Tetromino()
        
        # 检查游戏是否结束
        if self.check_collision(self.current_piece.shape, self.current_piece.x, self.current_piece.y):
            self.game_over = True
    
    def move(self, dx, dy):
        if not self.check_collision(self.current_piece.shape, self.current_piece.x + dx, self.current_piece.y + dy):
            self.current_piece.x += dx
            self.current_piece.y += dy
            return True
        return False
    
    def rotate_piece(self):
        rotated = self.current_piece.rotate()
        if not self.check_collision(rotated, self.current_piece.x, self.current_piece.y):
            self.current_piece.shape = rotated
            return True
        
        # 尝试墙踢（wall kick）
        for dx in [-1, 1, -2, 2]:
            if not self.check_collision(rotated, self.current_piece.x + dx, self.current_piece.y):
                self.current_piece.x += dx
                self.current_piece.shape = rotated
                return True
        return False
    
    def drop_piece(self):
        while self.move(0, 1):
            pass
        self.merge_piece()
        self.clear_lines()
        self.new_piece()
    
    def update(self):
        current_time = time.time()
        
        # 更新消除效果时间
        if self.clear_effect_time > 0:
            self.clear_effect_time -= 1/60  # 假设60FPS
            if self.clear_effect_time <= 0:
                self.clear_effect = []
        
        if current_time - self.last_fall_time > self.fall_speed:
            if not self.move(0, 1):
                self.merge_piece()
                self.clear_lines()
                self.new_piece()
            self.last_fall_time = current_time
    
    def draw(self):
        screen.fill(BLACK)
        self.draw_board()
        self.current_piece.draw()
        self.draw_sidebar()
        
        if self.game_over:
            font = pygame.font.SysFont(None, 72)
            game_over_text = font.render("game over!", True, RED)
            screen.blit(game_over_text, (SCREEN_WIDTH // 2 - game_over_text.get_width() // 2, 
                                        SCREEN_HEIGHT // 2 - game_over_text.get_height() // 2))
            
            restart_font = pygame.font.SysFont(None, 36)
            restart_text = restart_font.render("press R to restart", True, WHITE)
            screen.blit(restart_text, (SCREEN_WIDTH // 2 - restart_text.get_width() // 2, 
                                      SCREEN_HEIGHT // 2 + 70))

    def reset(self):
        self.__init__()

# 创建游戏实例
game = Game()
paused = False

# 游戏主循环
running = True
while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        
        if event.type == pygame.KEYDOWN:
            if not game.game_over and not paused:
                if event.key == pygame.K_LEFT:
                    game.move(-1, 0)
                elif event.key == pygame.K_RIGHT:
                    game.move(1, 0)
                elif event.key == pygame.K_UP:
                    game.rotate_piece()
                elif event.key == pygame.K_DOWN:
                    game.drop_piece()
            
            if event.key == pygame.K_r:
                game.reset()
                paused = False
            elif event.key == pygame.K_p:
                paused = not paused
    
    if not game.game_over and not paused:
        game.update()
    
    game.draw()
    
    if paused:
        font = pygame.font.SysFont(None, 72)
        pause_text = font.render("stop", True, YELLOW)
        screen.blit(pause_text, (SCREEN_WIDTH // 2 - pause_text.get_width() // 2, 
                                SCREEN_HEIGHT // 2 - pause_text.get_height() // 2))
    
    pygame.display.flip()
    clock.tick(60)

pygame.quit()