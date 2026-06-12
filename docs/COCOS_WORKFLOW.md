# Cocos Creator 开发工作流

## 技术决策

正式主工程使用 Cocos Creator 3.8.8 与 TypeScript。

选择 Cocos 的主要原因：

- 一套工程可以构建 Web、微信小游戏和抖音小游戏。
- 自带适合 2D 游戏的场景、触屏输入、动画、资源管理和平台构建流程。
- 后续接入小游戏平台 SDK、广告和本地存档时，改造成本低于继续扩展 Web 原型。

旧 Phaser 原型保留在 `prototypes/phaser-bouquet/`，只用于记录已经验证过的花束拖放方案，不继续开发。

## 目录边界

```text
assets/
  scenes/       Cocos 场景
  scripts/
    domain/     不依赖 Cocos 的纯业务规则与配置
    prototype/  当前第一单可玩线框，后续会被正式场景与资产替换
prototypes/
  phaser-bouquet/  已归档的首个 Web 原型
tools/
  domain-tests/    纯业务规则自动化测试
```

`assets/scripts/domain/` 不得导入 `cc`。种植状态、库存、订单、配方和奖励规则应优先放在该目录，Cocos 组件只负责输入、生命周期和视觉表现。

## 打开项目

本机当前安装路径：

```bash
open -n /Users/bytedance/Applications/CocosCreator-3.8.8/CocosCreator.app \
  --args --project /Users/bytedance/Games/First_Mini_Game
```

在 Creator 中打开 `assets/scenes/Main.scene` 后点击预览，即可运行当前迁移验证场景。

## 自动化测试

项目使用 Node.js 24 测试纯业务规则：

```bash
cd /Users/bytedance/Games/First_Mini_Game
nvm use
npm --prefix tools/domain-tests run test
```

## 平台构建

以下命令适合本机验证，Creator 在 macOS 上会通过后台进程完成构建，应以 `temp/logs/project.log` 和 `build/` 产物为准：

```bash
COCOS=/Users/bytedance/Applications/CocosCreator-3.8.8/CocosCreator.app

open -n "$COCOS" --args \
  --project /Users/bytedance/Games/First_Mini_Game \
  --build 'platform=web-mobile;debug=true'

open -n "$COCOS" --args \
  --project /Users/bytedance/Games/First_Mini_Game \
  --build 'platform=wechatgame;debug=true'

open -n "$COCOS" --args \
  --project /Users/bytedance/Games/First_Mini_Game \
  --build 'platform=bytedance-mini-game;debug=true'
```

`debug=true` 用于本地验证，会显示性能面板；公开试玩与正式平台包应改为 `debug=false`。Web 构建可以直接用于静态试玩。微信和抖音构建完成后，还需要各自的开发者工具、平台账号和 App ID 才能预览、调试与上传。

## 提交规则

需要提交：

- `assets/` 及其 `.meta` 文件。
- `settings/`、`.creator/`、根目录 `package.json` 和 `tsconfig.json`。
- 纯业务规则测试与项目文档。

不得提交：

- `library/`、`temp/`、`build/`、`local/`、`profiles/`。
- 可能包含平台 App ID 的 `settings/v2/packages/cocos-service.json`。
- 本地竞品截图、参考图或未经授权的第三方素材。

## 当前边界

`assets/scripts/prototype/BouquetPrototype.ts` 当前承载“开业第一单”的完整可玩线框：订单、种植、照料、收获、DIY、交付和再次购买均已接入纯领域状态流。它用于验证流程节奏和交互，不代表正式视觉方案，后续应拆分为正式场景并接入花圃和花材资产。

`assets/scripts/domain/openingOrder.ts` 是第一单状态流的唯一业务规则来源。修改订单阶段、库存、奖励或种植规则时，应同步补充 `tools/domain-tests/tests/openingOrder.test.ts`，避免将规则写回 Cocos 场景组件。
