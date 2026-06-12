import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  ResolutionPolicy,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
  v3,
  view,
} from "cc";

import {
  BOUQUET_SLOTS,
  MATERIALS,
  canPlaceMore,
  findBestSlot,
  getMaterial,
  getPlacementCount,
  getProgress,
  isBouquetComplete,
  type BouquetSlot,
  type MaterialId,
  type Placement,
} from "../domain/bouquetRules";
import {
  OPENING_ORDER,
  accelerateAllPlots,
  acceptOpeningOrder,
  clearPlotPest,
  createOpeningOrderState,
  deliverOpeningOrder,
  fertilizePlot,
  getHarvestedCount,
  getPlantedCount,
  harvestPlot,
  makeOpeningBouquet,
  plantPlot,
  waterAllPlots,
  type OpeningOrderPhase,
  type OpeningOrderState,
  type PlotGrowth,
  type TutorialPlot,
} from "../domain/openingOrder";
import {
  SECOND_ROUND_BOUQUETS,
  SECOND_ROUND_FLOWERS,
  SECOND_ROUND_REWARD_COINS,
  acknowledgeFlowerDiscovery,
  claimSecondRoundReward,
  claimSecondRoundUpgrade,
  clearSecondRoundPest,
  createSecondRoundState,
  deliverSecondRoundBouquet,
  drawCoralRose,
  finishSecondRoundGrowth,
  getSecondRoundBouquet,
  harvestSecondRoundAll,
  makeSecondRoundBouquet,
  plantSecondRoundPlot,
  selectSecondRoundBouquet,
  waterSecondRoundPlots,
  type FlowerId,
  type SecondRoundBouquetId,
  type SecondRoundPhase,
  type SecondRoundPlot,
  type SecondRoundState,
} from "../domain/secondRound";

const { ccclass } = _decorator;

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 760;

const COLORS = {
  background: new Color(246, 242, 232, 255),
  panel: new Color(255, 253, 247, 255),
  soil: new Color(190, 148, 103, 255),
  soilDark: new Color(143, 101, 72, 255),
  leaf: new Color(111, 151, 111, 255),
  leafLight: new Color(157, 183, 139, 255),
  text: new Color(66, 70, 60, 255),
  muted: new Color(113, 113, 99, 255),
  accent: new Color(214, 123, 139, 255),
  accentDark: new Color(169, 91, 108, 255),
  blue: new Color(111, 161, 190, 255),
  gold: new Color(222, 169, 78, 255),
  success: new Color(94, 153, 110, 255),
} as const;

const MATERIAL_COLORS: Record<FlowerId, Color> = {
  dahlia: new Color(224, 137, 163, 255),
  ranunculus: new Color(235, 188, 119, 255),
  delphinium: new Color(118, 155, 207, 255),
  daisy: new Color(240, 237, 213, 255),
  "coral-rose": new Color(234, 132, 126, 255),
};

const PHASE_NAMES: Record<OpeningOrderPhase, string> = {
  order: "查看订单",
  planting: "种下花材",
  watering: "浇水",
  caring: "照料花朵",
  accelerating: "等待成长",
  harvesting: "收获花材",
  arranging: "制作花束",
  delivery: "交付订单",
  rebuying: "再次种植",
  complete: "首单完成",
};

const SECOND_ROUND_PHASE_NAMES: Record<SecondRoundPhase, string> = {
  reward: "成长奖励",
  draw: "免费发现",
  discovery: "发现新花",
  planting: "自主种植",
  watering: "一键浇水",
  caring: "轻松照料",
  inspiration: "花束灵感",
  growing: "等待成熟",
  harvesting: "一键收割",
  crafting: "快捷制作",
  delivery: "交付订单",
  upgrade: "升级解锁",
  complete: "自由种植",
};

@ccclass("BouquetPrototype")
export class BouquetPrototype extends Component {
  private state: OpeningOrderState = createOpeningOrderState();
  private secondRound?: SecondRoundState;
  private placements: Placement[] = [];
  private placedNodes: Node[] = [];
  private trayItems = new Map<MaterialId, Node>();
  private countLabels = new Map<MaterialId, Label>();
  private instruction?: Label;
  private progress?: Label;
  private finishButton?: Node;
  private root?: Node;

  start(): void {
    // Keep the full portrait play area visible on both phones and desktop browsers.
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
    this.root = new Node("OpeningOrderFlow");
    this.root.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.node.addChild(this.root);
    this.renderStage();
  }

  private renderStage(): void {
    if (!this.root) {
      return;
    }

    this.root.destroyAllChildren();
    this.trayItems.clear();
    this.countLabels.clear();
    this.placedNodes = [];
    this.finishButton = undefined;
    this.instruction = undefined;
    this.progress = undefined;

    this.createPanel("Background", 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLORS.background, undefined, this.root, 0);

    if (this.secondRound) {
      this.renderSecondRoundHeader();
      this.renderSecondRoundStage();
      return;
    }

    this.renderHeader();

    switch (this.state.phase) {
      case "order":
        this.renderOrder();
        break;
      case "planting":
      case "watering":
      case "caring":
      case "accelerating":
      case "harvesting":
        this.renderGarden();
        break;
      case "arranging":
        this.renderBouquetWorkshop();
        break;
      case "delivery":
        this.renderDelivery();
        break;
      case "rebuying":
        this.renderRebuying();
        break;
      case "complete":
        this.renderComplete();
        break;
    }
  }

  private renderHeader(): void {
    this.createLabel("开个花店", -195, 346, 25, COLORS.text, 180);
    this.createLabel(`金币 ${this.state.coins}`, 95, 346, 15, COLORS.accentDark, 105);
    this.createPanel("Phase", 123, 305, 84, 30, COLORS.panel, COLORS.leafLight);
    this.createLabel(PHASE_NAMES[this.state.phase], 86, 305, 12, COLORS.muted, 75);
  }

  private renderSecondRoundHeader(): void {
    const state = this.secondRound!;
    this.createLabel("开个花店", -195, 346, 25, COLORS.text, 180);
    this.createLabel(`Lv.${state.storeLevel}`, 35, 346, 14, COLORS.success, 55);
    this.createLabel(`金币 ${state.coins}`, 95, 346, 15, COLORS.accentDark, 105);
    this.createPanel("Phase", 123, 305, 84, 30, COLORS.panel, COLORS.leafLight);
    this.createLabel(SECOND_ROUND_PHASE_NAMES[state.phase], 86, 305, 12, COLORS.muted, 75);
  }

  private renderSecondRoundStage(): void {
    switch (this.secondRound!.phase) {
      case "reward":
        this.renderSecondRoundReward();
        break;
      case "draw":
        this.renderFreeDiscovery();
        break;
      case "discovery":
        this.renderFlowerDiscovery();
        break;
      case "planting":
      case "watering":
      case "caring":
      case "growing":
      case "harvesting":
        this.renderSecondRoundGarden();
        break;
      case "inspiration":
        this.renderBouquetInspiration();
        break;
      case "crafting":
        this.renderSecondRoundCrafting();
        break;
      case "delivery":
        this.renderSecondRoundDelivery();
        break;
      case "upgrade":
        this.renderSecondRoundUpgrade();
        break;
      case "complete":
        this.renderSecondRoundComplete();
        break;
    }
  }

  private renderOrder(): void {
    this.createLabel("今天，一位顾客想为朋友准备一份清晨般的花束。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("OrderCard", 0, 50, 370, 390, COLORS.panel, new Color(231, 219, 201, 255));
    this.createLabel(OPENING_ORDER.title, -155, 218, 23, COLORS.text, 310);
    this.createLabel(`目标：${OPENING_ORDER.bouquetName}`, -155, 182, 15, COLORS.accentDark, 310);
    this.createBouquetPreview(0, 45, 1);
    this.createLabel("需要种植四类花材，完成后获得", -140, -95, 13, COLORS.muted, 280);
    this.createLabel(`金币 ${OPENING_ORDER.rewardCoins}`, -70, -130, 18, COLORS.gold, 140);
    this.createButton(
      "接取订单，领取种子",
      0,
      -285,
      250,
      () => this.updateState(acceptOpeningOrder(this.state)),
    );
  }

  private renderGarden(): void {
    this.createLabel(this.getGardenInstruction(), -185, 276, 14, COLORS.muted, 370);
    this.renderOrderProgress();

    this.state.plots.forEach((plot, index) => this.createPlot(plot, index));

    if (this.state.phase === "watering") {
      this.createButton(
        "给全部花苗浇水",
        0,
        -310,
        250,
        () => this.updateState(waterAllPlots(this.state)),
        COLORS.blue,
      );
    } else if (this.state.phase === "accelerating") {
      this.createButton(
        "免费加速，见证开花",
        0,
        -310,
        250,
        () => this.updateState(accelerateAllPlots(this.state)),
        COLORS.accent,
      );
    } else {
      const text =
        this.state.phase === "planting"
          ? `已种植 ${getPlantedCount(this.state)} / ${this.state.plots.length}`
          : this.state.phase === "harvesting"
            ? `已收获 ${getHarvestedCount(this.state)} / ${this.state.plots.length}`
            : "完成两处闪烁的照料需求";
      this.createPanel("ProgressHint", 0, -310, 250, 46, new Color(236, 232, 219, 255));
      this.createLabel(text, -110, -310, 14, COLORS.muted, 220);
    }
  }

  private renderOrderProgress(): void {
    this.createPanel("OrderProgress", 0, 215, 370, 70, COLORS.panel);
    this.createLabel(OPENING_ORDER.bouquetName, -165, 229, 15, COLORS.text, 150);
    MATERIALS.forEach((material, index) => {
      const x = -80 + index * 68;
      this.createCircle(this.root!, x, 205, 11, MATERIAL_COLORS[material.id]);
      this.createLabel(`${material.targetCount}`, x + 15, 205, 12, COLORS.muted, 30);
    });
  }

  private createPlot(plot: TutorialPlot, index: number): void {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = -120 + column * 120;
    const y = 70 - row * 155;
    const isActionable = this.isPlotActionable(plot);
    const fill = isActionable
      ? new Color(255, 249, 220, 255)
      : new Color(230, 210, 180, 255);
    const panel = this.createPanel(
      plot.id,
      x,
      y,
      106,
      130,
      fill,
      isActionable ? COLORS.gold : COLORS.soil,
    );

    this.drawPlotState(panel, plot);
    panel.on(Node.EventType.TOUCH_END, () => this.handlePlotTouch(plot));
  }

  private drawPlotState(panel: Node, plot: TutorialPlot): void {
    const material = getMaterial(plot.materialId);
    this.createPanel("Soil", 0, -38, 86, 34, COLORS.soil, COLORS.soilDark, panel, 12);

    if (plot.growth === "empty") {
      this.createLabel("＋", -18, 12, 30, COLORS.soilDark, 36, panel);
    } else if (plot.growth === "harvested") {
      this.createLabel("已收获", -35, 10, 13, COLORS.success, 70, panel);
    } else {
      const mature = plot.growth === "mature";
      this.createFlowerSymbol(panel, plot.materialId, 0, 8, mature ? 1 : 0.62);
      if (plot.growth === "watered") {
        this.createCircle(panel, 34, 34, 6, COLORS.blue);
      }
    }

    const status = this.getPlotStatus(plot);
    this.createLabel(material.shortName, -43, -58, 11, COLORS.text, 86, panel);
    this.createLabel(status, -43, 48, 11, this.isPlotActionable(plot) ? COLORS.accentDark : COLORS.muted, 86, panel);
  }

  private isPlotActionable(plot: TutorialPlot): boolean {
    if (this.state.phase === "planting") {
      return plot.growth === "empty";
    }
    if (this.state.phase === "caring") {
      return plot.careTask !== undefined && !plot.careComplete;
    }
    if (this.state.phase === "harvesting") {
      return plot.growth === "mature";
    }
    return false;
  }

  private getPlotStatus(plot: TutorialPlot): string {
    if (this.state.phase === "planting" && plot.growth === "empty") {
      return "点击种植";
    }
    if (this.state.phase === "caring" && plot.careTask && !plot.careComplete) {
      return plot.careTask === "fertilize" ? "需要施肥" : "发现小虫";
    }
    if (this.state.phase === "harvesting" && plot.growth === "mature") {
      return `点击收获 +${plot.harvestCount}`;
    }

    const labels: Record<PlotGrowth, string> = {
      empty: "空地",
      planted: "幼苗",
      watered: plot.careComplete ? "照料完成" : "生长中",
      mature: "已成熟",
      harvested: "土地休息中",
    };
    return labels[plot.growth];
  }

  private handlePlotTouch(plot: TutorialPlot): void {
    if (!this.isPlotActionable(plot)) {
      return;
    }

    if (this.state.phase === "planting") {
      this.updateState(plantPlot(this.state, plot.id));
    } else if (this.state.phase === "caring" && plot.careTask === "fertilize") {
      this.updateState(fertilizePlot(this.state, plot.id));
    } else if (this.state.phase === "caring" && plot.careTask === "clear-pest") {
      this.updateState(clearPlotPest(this.state, plot.id));
    } else if (this.state.phase === "harvesting") {
      this.updateState(harvestPlot(this.state, plot.id));
    }
  }

  private getGardenInstruction(): string {
    switch (this.state.phase) {
      case "planting":
        return "点击发光土地，种下系统赠送的订单花材。";
      case "watering":
        return "幼苗已经种好，一次浇水照顾全部花苗。";
      case "caring":
        return "花朵会清楚告诉你需要什么，没有时间压力。";
      case "accelerating":
        return "新手首单可以免费跳过等待，亲眼见证开花。";
      case "harvesting":
        return "点击每块成熟土地，收获制作花束所需的花材。";
      default:
        return "";
    }
  }

  private renderBouquetWorkshop(): void {
    this.createLabel("将四类花材拖入花束，系统会辅助摆放。", -185, 276, 14, COLORS.muted, 370);
    this.instruction = this.createLabel(
      "每类放入 2 枝",
      -185,
      245,
      13,
      COLORS.accentDark,
      220,
    );
    this.progress = this.createLabel("完成度 0 / 8", 80, 245, 13, COLORS.muted, 120);

    this.createPanel("Workspace", 0, 25, 380, 430, COLORS.panel);
    BOUQUET_SLOTS.forEach((slot) => this.createSlotHint(slot));
    this.createTray();
    this.createFinishButton();
    this.updateBouquetState();
  }

  private createTray(): void {
    const xPositions = [-154, -51, 51, 154];

    MATERIALS.forEach((material, index) => {
      const item = this.createPanel(
        material.name,
        xPositions[index]!,
        -300,
        90,
        104,
        COLORS.panel,
        MATERIAL_COLORS[material.id],
      );
      this.createFlowerSymbol(item, material.id, 0, 14, 0.72);
      this.createLabel(material.shortName, -40, -31, 11, COLORS.text, 80, item);
      const count = this.createLabel("2", 15, 35, 11, Color.WHITE, 22, item);
      this.createCircle(item, 25, 35, 13, MATERIAL_COLORS[material.id], 0);

      const home = item.position.clone();
      item.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
        if (canPlaceMore(material.id, this.placements)) {
          item.setPosition(this.touchToLocal(event));
        }
      });
      item.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
        this.finishDrag(material.id, item, home, event);
      });
      item.on(Node.EventType.TOUCH_CANCEL, () => item.setPosition(home));

      this.trayItems.set(material.id, item);
      this.countLabels.set(material.id, count);
    });
  }

  private finishDrag(
    materialId: MaterialId,
    item: Node,
    home: Vec3,
    event: EventTouch,
  ): void {
    const local = this.touchToLocal(event);
    const slot = findBestSlot(materialId, this.localToLogical(local), this.placements);

    if (slot && canPlaceMore(materialId, this.placements)) {
      this.placeMaterial(materialId, slot);
    }

    item.setPosition(home);
    this.updateBouquetState();
  }

  private placeMaterial(materialId: MaterialId, slot: BouquetSlot): void {
    if (!this.root) {
      return;
    }

    const placed = new Node(`${getMaterial(materialId).name}-${slot.id}`);
    placed.addComponent(UITransform).setContentSize(74, 74);
    placed.setPosition(this.logicalToLocal(slot.x, slot.y));
    placed.setScale(slot.scale, slot.scale, 1);
    placed.angle = (slot.rotation * 180) / Math.PI;
    this.root.addChild(placed);
    this.createFlowerSymbol(placed, materialId, 0, 0, 1);
    this.placements.push({ materialId, slotId: slot.id });
    this.placedNodes.push(placed);
  }

  private createSlotHint(slot: BouquetSlot): void {
    if (!this.root) {
      return;
    }

    const hint = new Node(`Slot-${slot.id}`);
    hint.addComponent(UITransform).setContentSize(70, 54);
    hint.setPosition(this.logicalToLocal(slot.x, slot.y));
    const graphics = hint.addComponent(Graphics);
    graphics.lineWidth = 2;
    graphics.strokeColor = new Color(190, 176, 169, 150);
    graphics.circle(0, 0, slot.role === "line" ? 22 : 28);
    graphics.stroke();
    this.root.addChild(hint);
  }

  private createFinishButton(): void {
    this.finishButton = this.createButton(
      "完成花束",
      0,
      -220,
      190,
      () => this.finishBouquet(),
      COLORS.accent,
      false,
    );
  }

  private finishBouquet(): void {
    if (!isBouquetComplete(this.placements) || !this.finishButton) {
      return;
    }

    this.finishButton.active = false;
    this.placedNodes.forEach((node, index) => {
      const target = node.position.clone();
      target.y += 4 + (index % 3) * 2;
      target.x += index % 2 === 0 ? -3 : 3;
      tween(node).to(0.28, { position: target }).start();
    });
    if (this.instruction) {
      this.instruction.string = "系统正在做最后整理…";
    }

    this.scheduleOnce(() => {
      this.state = makeOpeningBouquet(this.state);
      this.renderStage();
    }, 0.5);
  }

  private updateBouquetState(): void {
    const total = MATERIALS.reduce((sum, material) => sum + material.targetCount, 0);
    if (this.progress) {
      this.progress.string = `完成度 ${Math.round(getProgress(this.placements) * total)} / ${total}`;
    }

    MATERIALS.forEach((material) => {
      const remaining = material.targetCount - getPlacementCount(material.id, this.placements);
      const label = this.countLabels.get(material.id);
      const item = this.trayItems.get(material.id);
      if (label) {
        label.string = `${remaining}`;
      }
      if (item) {
        const opacity = item.getComponent(UIOpacity) ?? item.addComponent(UIOpacity);
        opacity.opacity = remaining > 0 ? 255 : 100;
      }
    });

    if (this.finishButton) {
      this.finishButton.active = isBouquetComplete(this.placements);
    }
  }

  private renderDelivery(): void {
    this.createLabel("你完成了第一束花，现在把它交给等待的顾客。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("BouquetCard", 0, 55, 340, 400, COLORS.panel, new Color(231, 219, 201, 255));
    this.createBouquetPreview(0, 70, 1.35);
    this.createLabel(OPENING_ORDER.bouquetName, -130, -95, 23, COLORS.text, 260);
    this.createLabel("由你亲手种植并制作", -130, -130, 13, COLORS.muted, 260);
    this.createButton(
      `交付订单，获得 ${OPENING_ORDER.rewardCoins} 金币`,
      0,
      -285,
      290,
      () => this.startSecondRound(),
      COLORS.success,
    );
  }

  private renderRebuying(): void {
    this.createLabel("首单完成，新的成长目标已经出现。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("RewardCard", 0, 65, 350, 390, COLORS.panel, new Color(231, 219, 201, 255));
    this.createCircle(this.root!, 0, 125, 52, COLORS.gold);
    this.createLabel(`${this.state.coins}`, -65, 125, 28, Color.WHITE, 130);
    this.createLabel("继续进入第二轮体验", -130, 45, 20, COLORS.text, 260);
    this.createLabel("获得新花种、选择花束，并解锁一键收割。", -145, -10, 13, COLORS.muted, 290);
    this.createButton(
      "进入第二轮",
      0,
      -285,
      240,
      () => {
        this.secondRound = createSecondRoundState(this.state.coins);
        this.renderStage();
      },
      COLORS.accent,
    );
  }

  private renderComplete(): void {
    this.createLabel("第一单闭环完成", -185, 276, 14, COLORS.success, 370);
    this.createPanel("CompleteCard", 0, 55, 350, 400, COLORS.panel, COLORS.leafLight);
    this.createCircle(this.root!, 0, 135, 58, COLORS.success);
    this.createLabel("✓", -30, 135, 42, Color.WHITE, 60);
    this.createLabel("花店正式开业", -130, 40, 25, COLORS.text, 260);
    this.createLabel(
      "玩家已经体验：订单 → 种植 → 照料 → 收获 → DIY → 交付 → 再次种植",
      -145,
      -25,
      13,
      COLORS.muted,
      290,
    );
    this.createLabel(`剩余金币 ${this.state.coins} · 下一批种子已入库`, -145, -90, 13, COLORS.accentDark, 290);
    this.createButton(
      "重新体验第一单",
      0,
      -285,
      240,
      () => {
        this.state = createOpeningOrderState();
        this.placements = [];
        this.renderStage();
      },
      COLORS.success,
    );
  }

  private startSecondRound(): void {
    const delivered = deliverOpeningOrder(this.state);
    this.state = delivered;
    this.secondRound = createSecondRoundState(delivered.coins);
    this.placements = [];
    this.renderStage();
  }

  private renderSecondRoundReward(): void {
    this.createLabel("首单完成！奖励集中出现，不打断你的种花节奏。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("SecondRoundReward", 0, 55, 360, 420, COLORS.panel, COLORS.gold);

    this.createCircle(this.root!, -85, 100, 48, COLORS.gold);
    this.createLabel(`+${SECOND_ROUND_REWARD_COINS}`, -125, 100, 22, Color.WHITE, 80);
    this.createLabel("成长金币", -130, 35, 14, COLORS.text, 90);

    this.createCircle(this.root!, 85, 100, 48, COLORS.accent);
    this.createLabel("?", 66, 100, 32, Color.WHITE, 38);
    this.createLabel("免费发现", 40, 35, 14, COLORS.text, 90);

    this.createLabel("店铺升级至 Lv.2", -115, -45, 22, COLORS.success, 230);
    this.createLabel("下一步将必定发现一款未拥有的新花", -145, -88, 13, COLORS.muted, 290);
    this.createButton(
      "领取全部奖励",
      0,
      -285,
      240,
      () => this.updateSecondRoundState(claimSecondRoundReward(this.secondRound!)),
      COLORS.success,
    );
  }

  private renderFreeDiscovery(): void {
    this.createLabel("每天都有一次免费发现机会，首次必得新花。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("DiscoveryCard", 0, 55, 350, 420, COLORS.panel, COLORS.accent);
    this.createCircle(this.root!, 0, 105, 74, new Color(251, 224, 213, 255));
    this.createLabel("?", -35, 105, 58, COLORS.accentDark, 70);
    this.createLabel("今日免费发现", -120, 0, 24, COLORS.text, 240);
    this.createLabel("不会抽到重复花种", -105, -45, 14, COLORS.success, 210);
    this.createButton(
      "免费发现新花",
      0,
      -285,
      240,
      () => this.updateSecondRoundState(drawCoralRose(this.secondRound!)),
    );
  }

  private renderFlowerDiscovery(): void {
    this.createLabel("新花会以成熟期形态首次亮相。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("NewFlowerCard", 0, 55, 350, 430, new Color(255, 247, 239, 255), COLORS.accent);
    this.createCircle(this.root!, 0, 80, 110, new Color(252, 226, 219, 255));
    this.createFlowerSymbol(this.root!, "coral-rose", 0, 78, 2.15);
    this.createLabel("发现新花", -70, -55, 14, COLORS.accentDark, 140);
    this.createLabel(SECOND_ROUND_FLOWERS["coral-rose"].name, -110, -92, 27, COLORS.text, 220);
    this.createLabel("花语：温柔而坚定的期待", -125, -132, 13, COLORS.muted, 250);
    this.createButton(
      "收下种子，去种植",
      0,
      -285,
      250,
      () => this.updateSecondRoundState(acknowledgeFlowerDiscovery(this.secondRound!)),
      COLORS.accent,
    );
  }

  private renderSecondRoundGarden(): void {
    const state = this.secondRound!;
    const instructions: Record<
      "planting" | "watering" | "caring" | "growing" | "harvesting",
      string
    > = {
      planting: "这次由你亲手种下新旧花种，不再逐步讲解。",
      watering: "一次浇水照顾全部幼苗。",
      caring: "清除唯一一处虫害，然后去寻找花束灵感。",
      growing: "花束目标已经选好，返回花圃时花朵恰好成熟。",
      harvesting: "你已经学会逐块收割，现在解锁第一次一键收割。",
    };
    this.createLabel(
      instructions[state.phase as keyof typeof instructions],
      -185,
      276,
      14,
      COLORS.muted,
      370,
    );
    this.createPanel("SecondRoundGoal", 0, 220, 370, 60, COLORS.panel);
    this.createLabel(
      state.selectedBouquetId
        ? `本轮目标：${getSecondRoundBouquet(state.selectedBouquetId).name}`
        : "新花种：珊瑚玫瑰 · 已加入种子袋",
      -165,
      220,
      14,
      COLORS.text,
      330,
    );

    state.plots.forEach((plot, index) => this.createSecondRoundPlot(plot, index));

    if (state.phase === "watering") {
      this.createButton(
        "一键浇水",
        0,
        -310,
        230,
        () => this.updateSecondRoundState(waterSecondRoundPlots(state)),
        COLORS.blue,
      );
    } else if (state.phase === "growing") {
      this.createButton(
        "回到花圃，见证成熟",
        0,
        -310,
        260,
        () => this.updateSecondRoundState(finishSecondRoundGrowth(state)),
        COLORS.accent,
      );
    } else if (state.phase === "harvesting") {
      this.createButton(
        "一键收割全部花材",
        0,
        -310,
        270,
        () => this.updateSecondRoundState(harvestSecondRoundAll(state)),
        COLORS.success,
      );
    } else {
      const planted = state.plots.filter((plot) => plot.growth !== "empty").length;
      const text =
        state.phase === "planting"
          ? `已种植 ${planted} / ${state.plots.length}`
          : "点击闪烁土地清除小虫";
      this.createPanel("SecondRoundHint", 0, -310, 250, 46, new Color(236, 232, 219, 255));
      this.createLabel(text, -110, -310, 14, COLORS.muted, 220);
    }
  }

  private createSecondRoundPlot(plot: SecondRoundPlot, index: number): void {
    const state = this.secondRound!;
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = -120 + column * 120;
    const y = 70 - row * 155;
    const actionable =
      (state.phase === "planting" && plot.growth === "empty") ||
      (state.phase === "caring" && plot.hasPest && !plot.pestCleared);
    const panel = this.createPanel(
      plot.id,
      x,
      y,
      106,
      130,
      actionable ? new Color(255, 249, 220, 255) : new Color(230, 210, 180, 255),
      actionable ? COLORS.gold : COLORS.soil,
    );
    this.createPanel("Soil", 0, -38, 86, 34, COLORS.soil, COLORS.soilDark, panel, 12);

    if (plot.growth === "empty") {
      this.createLabel("＋", -18, 12, 30, COLORS.soilDark, 36, panel);
    } else if (plot.growth === "harvested") {
      this.createLabel("已收割", -35, 10, 13, COLORS.success, 70, panel);
    } else {
      this.createFlowerSymbol(panel, plot.flowerId, 0, 8, plot.growth === "mature" ? 1 : 0.62);
      if (plot.growth === "watered") {
        this.createCircle(panel, 34, 34, 6, COLORS.blue);
      }
    }

    let status = plot.growth === "mature" ? `成熟 +${plot.harvestCount}` : "生长中";
    if (state.phase === "planting" && plot.growth === "empty") {
      status = "点击种植";
    } else if (state.phase === "caring" && plot.hasPest && !plot.pestCleared) {
      status = "发现小虫";
    } else if (plot.growth === "empty") {
      status = "空地";
    } else if (plot.growth === "harvested") {
      status = "库存已增加";
    }
    this.createLabel(SECOND_ROUND_FLOWERS[plot.flowerId].shortName, -43, -58, 10, COLORS.text, 86, panel);
    this.createLabel(status, -43, 48, 11, actionable ? COLORS.accentDark : COLORS.muted, 86, panel);

    panel.on(Node.EventType.TOUCH_END, () => {
      if (state.phase === "planting" && plot.growth === "empty") {
        this.updateSecondRoundState(plantSecondRoundPlot(state, plot.id));
      } else if (state.phase === "caring" && plot.hasPest && !plot.pestCleared) {
        this.updateSecondRoundState(clearSecondRoundPest(state, plot.id));
      }
    });
  }

  private renderBouquetInspiration(): void {
    this.createLabel("选一束你真正想制作的花，选择会成为本轮目标。", -185, 276, 14, COLORS.muted, 370);
    SECOND_ROUND_BOUQUETS.forEach((bouquet, index) => {
      const x = index === 0 ? -95 : 95;
      this.createPanel(bouquet.id, x, 45, 178, 420, COLORS.panel, index === 0 ? COLORS.gold : COLORS.leafLight);
      this.createSecondRoundBouquetPreview(bouquet.id, x, 105, 0.7);
      this.createLabel(bouquet.name, x - 75, -55, 18, COLORS.text, 150);
      this.createLabel(bouquet.description, x - 75, -92, 11, COLORS.muted, 150);
      this.createLabel(`订单奖励 ${bouquet.rewardCoins}`, x - 75, -140, 12, COLORS.accentDark, 150);
      this.createButton(
        "选择这束",
        x,
        -190,
        130,
        () => this.updateSecondRoundState(selectSecondRoundBouquet(this.secondRound!, bouquet.id)),
        index === 0 ? COLORS.gold : COLORS.success,
      );
    });
  }

  private renderSecondRoundCrafting(): void {
    const state = this.secondRound!;
    const bouquet = getSecondRoundBouquet(state.selectedBouquetId!);
    this.createLabel("一键收割完成，库存足够制作两种候选花束。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("CraftingCard", 0, 55, 360, 420, COLORS.panel, COLORS.leafLight);
    this.createSecondRoundBouquetPreview(bouquet.id, 0, 100, 1);
    this.createLabel(`已选择：${bouquet.name}`, -135, -65, 22, COLORS.text, 270);
    this.createLabel("你可以制作的花束", -135, -110, 13, COLORS.muted, 270);
    this.createLabel(
      SECOND_ROUND_BOUQUETS.map((candidate) => `✓ ${candidate.name}`).join("    "),
      -145,
      -145,
      12,
      COLORS.success,
      290,
    );
    this.createButton(
      `快捷制作「${bouquet.name}」`,
      0,
      -285,
      290,
      () => this.updateSecondRoundState(makeSecondRoundBouquet(state)),
      COLORS.accent,
    );
  }

  private renderSecondRoundDelivery(): void {
    const state = this.secondRound!;
    const bouquet = getSecondRoundBouquet(state.selectedBouquetId!);
    this.createLabel("第二束花已经完成，现在交付你亲自选择的订单。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("SecondDeliveryCard", 0, 55, 350, 420, COLORS.panel, COLORS.accent);
    this.createSecondRoundBouquetPreview(bouquet.id, 0, 95, 1.1);
    this.createLabel(bouquet.name, -120, -90, 25, COLORS.text, 240);
    this.createLabel(`交付奖励 ${bouquet.rewardCoins} 金币`, -120, -132, 14, COLORS.gold, 240);
    this.createButton(
      "交付第二束花",
      0,
      -285,
      250,
      () => this.updateSecondRoundState(deliverSecondRoundBouquet(state)),
      COLORS.success,
    );
  }

  private renderSecondRoundUpgrade(): void {
    const state = this.secondRound!;
    this.createLabel("第二轮目标完成，成长反馈集中结算。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("UpgradeCard", 0, 55, 350, 420, COLORS.panel, COLORS.gold);
    this.createCircle(this.root!, 0, 120, 68, COLORS.success);
    this.createLabel("Lv.3", -42, 120, 30, Color.WHITE, 84);
    this.createLabel("店铺升级", -85, 25, 24, COLORS.text, 170);
    this.createLabel("解锁 2 块新土地", -105, -28, 18, COLORS.accentDark, 210);
    this.createLabel(`当前金币 ${state.coins}`, -105, -72, 14, COLORS.gold, 210);
    this.createButton(
      "领取升级奖励",
      0,
      -285,
      250,
      () => this.updateSecondRoundState(claimSecondRoundUpgrade(state)),
      COLORS.success,
    );
  }

  private renderSecondRoundComplete(): void {
    const state = this.secondRound!;
    this.createLabel("强制引导结束，接下来由玩家决定种什么、做哪束花。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("SecondCompleteCard", 0, 55, 360, 430, COLORS.panel, COLORS.leafLight);
    this.createCircle(this.root!, 0, 130, 62, COLORS.success);
    this.createLabel("✓", -31, 130, 44, Color.WHITE, 62);
    this.createLabel("你已经可以自由经营", -135, 35, 24, COLORS.text, 270);
    this.createLabel("发现新花 · 选择目标 · 一键收割", -135, -15, 14, COLORS.accentDark, 270);
    this.createLabel(`Lv.${state.storeLevel} · 已开放 ${state.unlockedPlotCount} 块土地`, -135, -62, 15, COLORS.success, 270);
    this.createLabel("下一步：用正式美术与反馈验证这些爽点是否成立", -145, -110, 12, COLORS.muted, 290);
    this.createButton(
      "重新体验完整引导",
      0,
      -285,
      270,
      () => {
        this.state = createOpeningOrderState();
        this.secondRound = undefined;
        this.placements = [];
        this.renderStage();
      },
      COLORS.success,
    );
  }

  private createSecondRoundBouquetPreview(
    bouquetId: SecondRoundBouquetId,
    x: number,
    y: number,
    scale: number,
  ): void {
    const preview = new Node(`SecondBouquet-${bouquetId}`);
    preview.addComponent(UITransform).setContentSize(220, 250);
    preview.setPosition(x, y);
    preview.setScale(scale, scale, 1);
    this.root!.addChild(preview);

    const spring = bouquetId === "spring-letter";
    this.createPanel(
      "WrapperBack",
      0,
      -45,
      130,
      155,
      spring ? new Color(221, 234, 220, 255) : new Color(244, 222, 194, 255),
      undefined,
      preview,
      28,
    );
    if (spring) {
      this.createFlowerSymbol(preview, "delphinium", -50, 60, 0.88);
      this.createFlowerSymbol(preview, "delphinium", 50, 55, 0.82);
    } else {
      this.createFlowerSymbol(preview, "daisy", -48, 50, 0.85);
      this.createFlowerSymbol(preview, "daisy", 48, 48, 0.8);
    }
    this.createFlowerSymbol(preview, "coral-rose", -26, 22, 1.05);
    this.createFlowerSymbol(preview, "coral-rose", 30, 15, 0.98);
    this.createFlowerSymbol(preview, "dahlia", 0, 45, 0.92);
    this.createPanel(
      "WrapperFront",
      0,
      -70,
      115,
      88,
      spring ? new Color(235, 242, 226, 255) : new Color(250, 233, 210, 255),
      undefined,
      preview,
      24,
    );
    this.createPanel("Ribbon", 0, -78, 74, 15, spring ? COLORS.leaf : COLORS.accent, undefined, preview, 8);
  }

  private createBouquetPreview(x: number, y: number, scale: number): void {
    const preview = new Node("BouquetPreview");
    preview.addComponent(UITransform).setContentSize(220, 250);
    preview.setPosition(x, y);
    preview.setScale(scale, scale, 1);
    this.root!.addChild(preview);

    this.createPanel("WrapperBack", 0, -45, 130, 155, new Color(236, 218, 187, 255), undefined, preview, 28);
    this.createFlowerSymbol(preview, "delphinium", -48, 60, 0.85);
    this.createFlowerSymbol(preview, "delphinium", 48, 55, 0.8);
    this.createFlowerSymbol(preview, "ranunculus", -43, 8, 0.9);
    this.createFlowerSymbol(preview, "ranunculus", 45, 12, 0.85);
    this.createFlowerSymbol(preview, "dahlia", -18, 30, 1);
    this.createFlowerSymbol(preview, "dahlia", 27, 20, 0.95);
    this.createFlowerSymbol(preview, "daisy", -35, -14, 0.72);
    this.createFlowerSymbol(preview, "daisy", 38, -18, 0.7);
    this.createPanel("WrapperFront", 0, -70, 115, 88, new Color(248, 232, 207, 255), undefined, preview, 24);
    this.createPanel("Ribbon", 0, -78, 74, 15, COLORS.accent, undefined, preview, 8);
  }

  private createFlowerSymbol(
    parent: Node,
    materialId: FlowerId,
    x: number,
    y: number,
    scale: number,
  ): void {
    const flower = new Node(`Flower-${materialId}`);
    flower.addComponent(UITransform).setContentSize(70, 90);
    flower.setPosition(x, y);
    flower.setScale(scale, scale, 1);
    parent.addChild(flower);

    const graphics = flower.addComponent(Graphics);
    graphics.lineWidth = 4;
    graphics.strokeColor = COLORS.leaf;
    graphics.moveTo(0, -32);
    graphics.lineTo(0, 12);
    graphics.stroke();

    const petalColor = MATERIAL_COLORS[materialId];
    const petalCount = materialId === "delphinium" ? 3 : materialId === "daisy" ? 7 : 6;
    const radius = materialId === "daisy" ? 15 : 21;
    for (let index = 0; index < petalCount; index += 1) {
      const angle = (Math.PI * 2 * index) / petalCount;
      const distance = materialId === "delphinium" ? 10 : radius * 0.55;
      const offsetY = materialId === "delphinium" ? index * 16 - 2 : Math.sin(angle) * distance + 17;
      const offsetX = materialId === "delphinium" ? (index % 2 === 0 ? -7 : 7) : Math.cos(angle) * distance;
      this.createCircle(flower, offsetX, offsetY, materialId === "daisy" ? 6 : 9, petalColor);
    }
    this.createCircle(flower, 0, materialId === "delphinium" ? 12 : 17, materialId === "daisy" ? 6 : 9, new Color(245, 205, 102, 255));
  }

  private updateState(state: OpeningOrderState): void {
    this.state = state;
    this.renderStage();
  }

  private updateSecondRoundState(state: SecondRoundState): void {
    this.secondRound = state;
    this.renderStage();
  }

  private createButton(
    text: string,
    x: number,
    y: number,
    width: number,
    onTouch: () => void,
    color = COLORS.accent,
    visible = true,
  ): Node {
    const button = this.createPanel("Button", x, y, width, 48, color);
    this.createLabel(text, -width / 2 + 12, 0, 15, Color.WHITE, width - 24, button);
    // Visibility can change later, so the callback must not capture its initial value.
    button.on(Node.EventType.TOUCH_END, onTouch);
    button.active = visible;
    return button;
  }

  private createPanel(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
    stroke?: Color,
    parent = this.root,
    radius = 18,
  ): Node {
    if (!parent) {
      throw new Error("Interaction root has not been created");
    }

    const panel = new Node(name);
    panel.addComponent(UITransform).setContentSize(width, height);
    panel.setPosition(x, y);
    const graphics = panel.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill();
    if (stroke) {
      graphics.lineWidth = 2;
      graphics.strokeColor = stroke;
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
      graphics.stroke();
    }
    parent.addChild(panel);
    return panel;
  }

  private createCircle(
    parent: Node,
    x: number,
    y: number,
    radius: number,
    color: Color,
    siblingIndex?: number,
  ): Node {
    const circle = new Node("Circle");
    circle.addComponent(UITransform).setContentSize(radius * 2, radius * 2);
    circle.setPosition(x, y);
    const graphics = circle.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.circle(0, 0, radius);
    graphics.fill();
    parent.addChild(circle);
    if (siblingIndex !== undefined) {
      circle.setSiblingIndex(Math.max(0, siblingIndex));
    }
    return circle;
  }

  private createLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    parent = this.root,
  ): Label {
    if (!parent) {
      throw new Error("Label parent has not been created");
    }

    const node = new Node(`Label-${text}`);
    node.addComponent(UITransform).setContentSize(width, fontSize * 3);
    node.setPosition(x + width / 2, y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.5;
    label.color = color;
    label.overflow = Label.Overflow.SHRINK;
    parent.addChild(node);
    return label;
  }

  private touchToLocal(event: EventTouch): Vec3 {
    if (!this.root) {
      return v3();
    }
    const location = event.getUILocation();
    return this.root
      .getComponent(UITransform)!
      .convertToNodeSpaceAR(v3(location.x, location.y, 0));
  }

  private localToLogical(local: Vec3): { x: number; y: number } {
    return {
      x: local.x + DESIGN_WIDTH / 2,
      y: DESIGN_HEIGHT / 2 - local.y,
    };
  }

  private logicalToLocal(x: number, y: number): Vec3 {
    return v3(x - DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - y, 0);
  }
}
