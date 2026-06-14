# 像素风办公室设计文档

**日期**: 2026-06-14
**关联 PRD**: [prd/2026-06-14_pixel-office.md](../prd/2026-06-14_pixel-office.md)

## 1. 架构设计

```
┌──────────────────────────────────────────────────┐
│                    App                            │
│  ┌──────────┬────────────────────────────────────┐│
│  │ Sidebar  │         ChatArea                   ││
│  │          │  ┌──────────────────────────────┐  ││
│  │          │  │         Header               │  ││
│  │          │  ├──────────────────────────────┤  ││
│  │          │  │      MessageList             │  ││
│  │          │  ├──────────────────────────────┤  ││
│  │          │  │  PixelOffice (新增)           │  ││
│  │          │  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌──┐│  ││
│  │          │  │  │404│ │老财│ │铁壳│ │小K │ │裁││  ││
│  │          │  │  └───┘ └───┘ └───┘ └───┘ └──┘│  ││
│  │          │  ├──────────────────────────────┤  ││
│  │          │  │      MessageInput            │  ││
│  └──────────┴────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

## 2. 组件树

```
PixelOffice
├── OfficeGrid (网格布局容器)
│   ├── Workstation × 5 (每个员工一个工位)
│   │   ├── DeskSprite (桌子像素图)
│   │   ├── ChairSprite (椅子像素图)
│   │   ├── CharacterSprite (角色像素图，在线时显示)
│   │   └── NameLabel (员工名标签)
│   └── SpeechBubble (悬停气泡，条件渲染)
```

## 3. 数据模型

```typescript
// 布局定义 (officeLayout.ts)
interface WorkstationDef {
  id: string;           // 员工名
  gridX: number;        // 网格列
  gridY: number;        // 网格行
  characterSprite: string;  // 角色精灵数据 key
}

// 精灵数据 (sprites.ts)
// 16×16 像素矩阵，每像素一个颜色值
type SpriteGrid = (string | null)[][];

// 角色状态
interface CharacterState {
  isOnline: boolean;
  task?: string;
  startedAt?: string;
}
```

## 4. 精灵设计

### 4.1 角色精灵 (16×16)

每个员工有独特的配色方案：

| 员工 | 主色 | 发型/特征 |
|------|------|-----------|
| 404 | 蓝色连帽衫 | 短发，耳机 |
| 老财 | 深蓝西装 | 金丝眼镜 |
| 铁壳 | 橙色工装 | 安全帽 |
| 小K | 紫色卫衣 | 耳机，猫耳 |
| 裁判君 | 黑色法袍 | 假发 |

### 4.2 家具精灵

- **桌子**: 16×8 棕色木桌
- **椅子**: 8×8 灰色转椅
- **显示器**: 8×8 绿屏 CRT

## 5. 动画设计

```css
/* Idle 呼吸动画 */
@keyframes pixel-idle {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-2px); }
}

.character-sprite {
  animation: pixel-idle 2s ease-in-out infinite;
}

/* 离线时无动画，角色隐藏 */
.character-sprite.offline {
  animation: none;
  opacity: 0;
}
```

## 6. 响应式设计

```
Desktop (≥1024px):
┌───┬───┬───┬───┬───┐
│404│老财│铁壳│小K│裁判│
└───┴───┴───┴───┴───┘
(横向一行排列)

Mobile (<1024px):
┌───┐
│404│
├───┤
│老财│
├───┤
│铁壳│
├───┤
│小K│
├───┤
│裁判│
└───┘
(纵向排列，2列网格)
```

## 7. 测试策略

| 测试 | 说明 |
|------|------|
| 渲染测试 | 5 个工位全部渲染 |
| 在线/离线 | 在线显示角色，离线隐藏 |
| 气泡显示 | 悬停时显示 SpeechBubble |
| 精灵数据 | sprites.ts 数据完整性 |
| 布局测试 | officeLayout 正确分配位置 |
| 像素渲染 | pixelArt 函数正确生成 CSS |

## 8. 文件清单

| 文件 | 说明 |
|------|------|
| `src/components/Office/PixelOffice.tsx` | 主组件 |
| `src/components/Office/SpeechBubble.tsx` | 气泡对话框 |
| `src/components/Office/sprites.ts` | 像素精灵数据 |
| `src/components/Office/officeLayout.ts` | 布局定义 |
| `src/components/Office/pixelArt.ts` | 像素渲染工具 |
| `src/components/Office/__tests__/` | 测试文件 |
