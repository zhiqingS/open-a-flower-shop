# 第八轮：AI 资产板验证

## 目的

验证新的花束资产生产思路：

```text
先让 AI 生成完整、独立、可切分的花材资产板
→ 使用纯洋红背景本地去底
→ 自动切成透明 PNG
→ 放入 Cocos resources 目录作为可用资产候选
```

这个路线不追求从参考图中像素级原封不动抠出每一朵花，而是生成同风格、同主题、可商用前再人工筛选修正的独立花材。

## 主要文件

- `ai-asset-board-v01-magenta.png`：第一版，上半部分是花束预览，下半部分是素材。
- `ai-asset-sheet-v02-magenta.png`：第二版，纯 4 x 4 花材资产板。
- `ai-asset-sheet-v02-transparent.png`：去掉洋红背景后的整张透明资产板。
- `ai-asset-sheet-v02-cutouts-contact.png`：16 个透明 PNG 的检查图。
- `cutouts-v02/`：视觉验证用透明 PNG。
- `../../assets/resources/art/bouquet-ai-v01/`：Cocos 可读取的候选花材资产。

## v02 生成 prompt 摘要

```text
Generate a pure flower-material sprite sheet for a mobile Cocos bouquet game.
Use the colorful hand-drawn bouquet as style and subject reference.
No completed bouquet preview, gameplay UI, title, labels, or text.
Use a flat #ff00ff chroma-key background across the full canvas.
Arrange 16 isolated sprites in a clean 4-column by 4-row grid:
large pink peony variants, pink round flower, peach ranunculus, peach rose variants,
blue delphinium variants, cream sweet pea variants, white daisy cluster,
white filler blossom, eucalyptus, fern, green filler leaves, mixed greenery.
Keep all sprites complete, separated, with crisp edges and consistent hand-drawn style.
```

完整后处理脚本：

```bash
python3 tools/split-ai-bouquet-asset-sheet.py
```

## 当前结论

这条路线明显优于直接从花束成图中硬抠：

- 生成的花材是完整枝材，不会因为原图遮挡导致缺瓣、断梗。
- 资产天然适合后续模板式插花和 Cocos 分层。
- 可以通过 prompt 控制花材数量、朝向、风格和命名。

主要风险：

- AI 生成不是像素级抠图，会重绘花材。
- 商用前仍需确认版权、做人工修边、统一锚点和规格。
- 洋红去底对粉色花瓣边缘有潜在色边风险，正式资产最好进一步人工清边。
