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

const { ccclass } = _decorator;

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 760;

const COLORS: Record<MaterialId, Color> = {
  dahlia: new Color(219, 139, 160, 255),
  ranunculus: new Color(228, 183, 117, 255),
  delphinium: new Color(116, 151, 196, 255),
  daisy: new Color(183, 188, 168, 255),
};

@ccclass("BouquetPrototype")
export class BouquetPrototype extends Component {
  private placements: Placement[] = [];
  private placedNodes: Node[] = [];
  private trayItems = new Map<MaterialId, Node>();
  private countLabels = new Map<MaterialId, Label>();
  private instruction?: Label;
  private progress?: Label;
  private finishButton?: Node;
  private root?: Node;

  start(): void {
    this.buildInteractionScaffold();
  }

  private buildInteractionScaffold(): void {
    this.root = new Node("InteractionScaffold");
    this.root.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.node.addChild(this.root);

    this.createPanel("Background", 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, new Color(248, 246, 241, 255));
    this.createLabel("Cocos 迁移技术验证", -190, 340, 24, new Color(64, 59, 55, 255), 380);
    this.instruction = this.createLabel(
      "拖动下方角色块到对应插槽",
      -190,
      305,
      14,
      new Color(108, 99, 92, 255),
      380,
    );
    this.progress = this.createLabel("完成度 0 / 8", 95, 340, 13, new Color(139, 94, 105, 255), 110);

    this.createPanel("Workspace", 0, 30, 380, 460, new Color(255, 255, 255, 235));
    BOUQUET_SLOTS.forEach((slot) => this.createSlotHint(slot));
    this.createTray();
    this.createFinishButton();
    this.updateState();
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
        new Color(255, 255, 255, 255),
        COLORS[material.id],
      );
      this.createToken(item, material.id, 0, 13, 25);
      this.createLabel(material.shortName, -40, -31, 12, new Color(75, 69, 65, 255), 80, item);
      const count = this.createLabel("2", 25, 34, 12, Color.WHITE, 24, item);
      this.createCircle(item, 25, 34, 13, COLORS[material.id], -1);

      const home = item.position.clone();
      item.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
        if (!canPlaceMore(material.id, this.placements)) {
          return;
        }
        item.setPosition(this.touchToLocal(event));
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
    this.updateState();
  }

  private placeMaterial(materialId: MaterialId, slot: BouquetSlot): void {
    if (!this.root) {
      return;
    }

    const placed = new Node(`${getMaterial(materialId).name}-${slot.id}`);
    placed.addComponent(UITransform).setContentSize(74, 50);
    placed.setPosition(this.logicalToLocal(slot.x, slot.y));
    placed.setScale(slot.scale, slot.scale, 1);
    placed.angle = (slot.rotation * 180) / Math.PI;
    this.root.addChild(placed);
    this.createToken(placed, materialId, 0, 0, 32);
    this.createLabel(
      getMaterial(materialId).shortName,
      -32,
      -5,
      11,
      new Color(74, 66, 61, 255),
      64,
      placed,
    );

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
    graphics.strokeColor = new Color(190, 176, 169, 180);
    graphics.circle(0, 0, slot.role === "line" ? 22 : 28);
    graphics.stroke();
    this.root.addChild(hint);
  }

  private createFinishButton(): void {
    const button = this.createPanel(
      "Finish",
      0,
      -215,
      190,
      46,
      new Color(163, 104, 119, 255),
    );
    this.createLabel("验证自动整理接口", -85, -8, 15, Color.WHITE, 170, button);
    button.on(Node.EventType.TOUCH_END, () => this.finishBouquet());
    button.active = false;
    this.finishButton = button;
  }

  private finishBouquet(): void {
    if (!isBouquetComplete(this.placements)) {
      return;
    }

    this.placedNodes.forEach((node, index) => {
      const target = node.position.clone();
      target.y += 4 + (index % 3) * 2;
      target.x += index % 2 === 0 ? -3 : 3;
      tween(node).to(0.28, { position: target }).start();
    });

    if (this.instruction) {
      this.instruction.string = "Cocos 场景、拖放规则和自动整理接口已打通";
    }
  }

  private updateState(): void {
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

  private createPanel(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
    stroke?: Color,
  ): Node {
    if (!this.root) {
      throw new Error("Interaction root has not been created");
    }

    const panel = new Node(name);
    panel.addComponent(UITransform).setContentSize(width, height);
    panel.setPosition(x, y);
    const graphics = panel.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.roundRect(-width / 2, -height / 2, width, height, 18);
    graphics.fill();
    if (stroke) {
      graphics.lineWidth = 2;
      graphics.strokeColor = stroke;
      graphics.roundRect(-width / 2, -height / 2, width, height, 18);
      graphics.stroke();
    }
    this.root.addChild(panel);
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

  private createToken(
    parent: Node,
    materialId: MaterialId,
    x: number,
    y: number,
    radius: number,
  ): void {
    this.createCircle(parent, x, y, radius, COLORS[materialId]);
    this.createCircle(parent, x, y, Math.max(6, radius * 0.35), new Color(255, 248, 230, 255));
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
    node.addComponent(UITransform).setContentSize(width, fontSize * 2);
    node.setPosition(x + width / 2, y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize * 1.5;
    label.color = color;
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
