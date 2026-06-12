import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
  v3,
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
  buyNextSeedPack,
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

const MATERIAL_COLORS: Record<MaterialId, Color> = {
  dahlia: new Color(224, 137, 163, 255),
  ranunculus: new Color(235, 188, 119, 255),
  delphinium: new Color(118, 155, 207, 255),
  daisy: new Color(240, 237, 213, 255),
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

@ccclass("BouquetPrototype")
export class BouquetPrototype extends Component {
  private state: OpeningOrderState = createOpeningOrderState();
  private placements: Placement[] = [];
  private placedNodes: Node[] = [];
  private trayItems = new Map<MaterialId, Node>();
  private countLabels = new Map<MaterialId, Label>();
  private instruction?: Label;
  private progress?: Label;
  private finishButton?: Node;
  private root?: Node;

  start(): void {
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
      () => this.updateState(deliverOpeningOrder(this.state)),
      COLORS.success,
    );
  }

  private renderRebuying(): void {
    this.createLabel("订单完成，但循环还没有结束。", -185, 276, 14, COLORS.muted, 370);
    this.createPanel("RewardCard", 0, 65, 350, 390, COLORS.panel, new Color(231, 219, 201, 255));
    this.createCircle(this.root!, 0, 125, 52, COLORS.gold);
    this.createLabel(`${this.state.coins}`, -65, 125, 28, Color.WHITE, 130);
    this.createLabel("首单奖励已到账", -130, 45, 20, COLORS.text, 260);
    this.createLabel("购买下一批种子后，就可以继续种花、制作与交付。", -145, -10, 13, COLORS.muted, 290);
    this.createButton(
      `购买下一批种子  -${OPENING_ORDER.nextSeedPackCost}`,
      0,
      -285,
      290,
      () => this.updateState(buyNextSeedPack(this.state)),
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
    materialId: MaterialId,
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
