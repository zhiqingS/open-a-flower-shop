import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Graphics,
  Label,
  Node,
  ResolutionPolicy,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  UIOpacity,
  UITransform,
  Vec3,
  v3,
  view,
} from "cc";

import {
  BOUQUET_CUTOUT_V01_ART_IDS,
  BOUQUET_CUTOUT_V01_FLOWERS,
  BOUQUET_CUTOUT_V01_ROOT,
  BOUQUET_CUTOUT_V01_TEMPLATE,
  type BouquetCutoutV01ArtId,
  type BouquetCutoutV01FlowerId,
} from "./bouquetCutoutV01Config";

const { ccclass } = _decorator;

const DESIGN_WIDTH = 430;
const DESIGN_HEIGHT = 760;
const TEMPLATE_WIDTH = 392;
const TEMPLATE_CENTER_Y = 92;
const SNAP_DISTANCE = 92;

const COLORS = {
  background: new Color(246, 242, 232, 255),
  panel: new Color(255, 253, 247, 245),
  text: new Color(61, 65, 57, 255),
  muted: new Color(112, 110, 98, 255),
  accent: new Color(201, 103, 123, 255),
  success: new Color(92, 151, 105, 255),
  line: new Color(211, 190, 166, 210),
  slot: new Color(255, 244, 216, 150),
} as const;

type FlowerSpec = (typeof BOUQUET_CUTOUT_V01_FLOWERS)[number];

interface DragState {
  flower: FlowerSpec;
  home: Vec3;
}

@ccclass("BouquetPrototype")
export class BouquetPrototype extends Component {
  private root?: Node;
  private frames = new Map<BouquetCutoutV01ArtId, SpriteFrame>();
  private placed = new Set<BouquetCutoutV01FlowerId>();
  private flowerNodes = new Map<BouquetCutoutV01FlowerId, Node>();
  private statusLabel?: Label;
  private progressLabel?: Label;

  start(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
    this.root = new Node("BouquetCutoutMaker");
    this.root.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.node.addChild(this.root);
    this.loadArt();
    this.render();
  }

  private loadArt(): void {
    let remaining = BOUQUET_CUTOUT_V01_ART_IDS.length;
    const completeOne = (): void => {
      remaining -= 1;
      if (remaining === 0) {
        this.render();
      }
    };

    BOUQUET_CUTOUT_V01_ART_IDS.forEach((artId) => {
      resources.load(`${BOUQUET_CUTOUT_V01_ROOT}/${artId}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (error || !frame) {
          console.warn(`Unable to load bouquet cutout art: ${artId}`, error);
          completeOne();
          return;
        }
        this.frames.set(artId, frame);
        completeOne();
      });
    });
  }

  private render(): void {
    if (!this.root) {
      return;
    }

    this.root.destroyAllChildren();
    this.flowerNodes.clear();
    this.createPanel("Background", 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, COLORS.background);

    this.createLabel("花束制作验证", -190, 346, 23, COLORS.text, 190);
    this.createLabel("拖动 4 朵花头回到固定位置，验证能否还原原型图。", -190, 315, 13, COLORS.muted, 380);
    this.statusLabel = this.createLabel("只验证花束制作，暂时不管种植、订单和奖励。", -190, 289, 12, COLORS.accent, 380);
    this.progressLabel = this.createLabel("完成 0 / 4", 112, 346, 14, COLORS.accent, 100);

    this.createTemplate();
    this.createSlotHints();
    this.createTray();
    this.createButton("重置", 0, -348, 130, () => this.resetBouquet(), COLORS.muted);
    this.refreshProgress();
  }

  private createTemplate(): void {
    const height = this.templateHeight();
    this.createPanel("TemplateCard", 0, TEMPLATE_CENTER_Y, 404, height + 18, COLORS.panel, COLORS.line, 18);
    const template = this.createArtNode(
      "TemplateBase",
      BOUQUET_CUTOUT_V01_TEMPLATE.artId,
      0,
      TEMPLATE_CENTER_Y,
      TEMPLATE_WIDTH,
      height,
    );

    if (!template) {
      this.createLabel("模板加载中…", -70, TEMPLATE_CENTER_Y, 15, COLORS.muted, 140);
    }
  }

  private createSlotHints(): void {
    BOUQUET_CUTOUT_V01_FLOWERS.forEach((flower) => {
      if (this.placed.has(flower.id)) {
        return;
      }
      const position = this.sourceToLocal(flower.sourceX, flower.sourceY);
      const width = flower.sourceWidth * this.templateScale();
      const height = flower.sourceHeight * this.templateScale();
      const ghost = this.createArtNode(`SlotGhost-${flower.id}`, flower.artId, position.x, position.y, width, height);
      if (ghost) {
        ghost.addComponent(UIOpacity).opacity = 70;
      }

      const hint = new Node(`SlotHint-${flower.id}`);
      hint.addComponent(UITransform).setContentSize(width, height);
      hint.setPosition(position.x, position.y);
      const graphics = hint.addComponent(Graphics);
      graphics.lineWidth = 2.2;
      graphics.strokeColor = COLORS.slot;
      graphics.roundRect(-width / 2, -height / 2, width, height, Math.min(24, width * 0.18));
      graphics.stroke();
      this.root!.addChild(hint);
    });
  }

  private createTray(): void {
    const xPositions = [-150, -50, 50, 150];
    BOUQUET_CUTOUT_V01_FLOWERS.forEach((flower, index) => {
      const home = v3(xPositions[index]!, -279, 0);
      const node = this.createDraggableFlower(flower, home);
      this.root!.addChild(node);
      this.flowerNodes.set(flower.id, node);
    });
  }

  private createDraggableFlower(flower: FlowerSpec, home: Vec3): Node {
    const node = new Node(`Flower-${flower.id}`);
    const transform = node.addComponent(UITransform);
    const traySize = this.traySize(flower);
    transform.setContentSize(traySize.width, traySize.height);
    node.setPosition(home);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.frames.get(flower.artId) ?? null;

    if (this.placed.has(flower.id)) {
      node.active = false;
      return node;
    }

    const dragState: DragState = { flower, home: home.clone() };
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.handleDragMove(node, event));
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.handleDragEnd(node, dragState, event));
    node.on(Node.EventType.TOUCH_CANCEL, () => this.returnHome(node, dragState.home));
    return node;
  }

  private handleDragMove(node: Node, event: EventTouch): void {
    node.setPosition(this.touchToLocal(event));
  }

  private handleDragEnd(node: Node, dragState: DragState, event: EventTouch): void {
    const target = this.sourceToLocal(dragState.flower.sourceX, dragState.flower.sourceY);
    const local = this.touchToLocal(event);
    const distance = Math.hypot(local.x - target.x, local.y - target.y);

    if (distance <= SNAP_DISTANCE) {
      this.placeFlower(node, dragState.flower, target);
      return;
    }

    this.returnHome(node, dragState.home);
  }

  private placeFlower(node: Node, flower: FlowerSpec, target: Vec3): void {
    this.placed.add(flower.id);
    const transform = node.getComponent(UITransform)!;
    const scale = this.templateScale();
    transform.setContentSize(flower.sourceWidth * scale, flower.sourceHeight * scale);
    node.off(Node.EventType.TOUCH_MOVE);
    node.off(Node.EventType.TOUCH_END);
    node.off(Node.EventType.TOUCH_CANCEL);
    node.setSiblingIndex(30 + flower.depth);
    tween(node)
      .to(0.18, { position: target, scale: v3(1.05, 1.05, 1) })
      .to(0.12, { scale: v3(1, 1, 1) })
      .call(() => {
        this.render();
        this.restorePlacedFlowers();
      })
      .start();
  }

  private restorePlacedFlowers(): void {
    BOUQUET_CUTOUT_V01_FLOWERS
      .filter((flower) => this.placed.has(flower.id))
      .sort((a, b) => a.depth - b.depth)
      .forEach((flower) => {
        const position = this.sourceToLocal(flower.sourceX, flower.sourceY);
        const scale = this.templateScale();
        const node = this.createArtNode(
          `Placed-${flower.id}`,
          flower.artId,
          position.x,
          position.y,
          flower.sourceWidth * scale,
          flower.sourceHeight * scale,
        );
        if (node) {
          node.setSiblingIndex(30 + flower.depth);
        }
      });
    this.refreshProgress();
  }

  private returnHome(node: Node, home: Vec3): void {
    tween(node).to(0.18, { position: home }).start();
  }

  private resetBouquet(): void {
    this.placed.clear();
    this.render();
  }

  private refreshProgress(): void {
    const count = this.placed.size;
    if (this.progressLabel) {
      this.progressLabel.string = `完成 ${count} / ${BOUQUET_CUTOUT_V01_FLOWERS.length}`;
    }
    if (this.statusLabel) {
      this.statusLabel.string =
        count === BOUQUET_CUTOUT_V01_FLOWERS.length
          ? "还原完成：现在看到的是模板 + 4 个花头重新拼回原图。"
          : "只验证花束制作，暂时不管种植、订单和奖励。";
      this.statusLabel.color = count === BOUQUET_CUTOUT_V01_FLOWERS.length ? COLORS.success : COLORS.accent;
    }
  }

  private createArtNode(
    name: string,
    artId: BouquetCutoutV01ArtId,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Node | undefined {
    const frame = this.frames.get(artId);
    if (!frame) {
      return undefined;
    }
    const node = new Node(name);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    node.setPosition(x, y);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    this.root!.addChild(node);
    return node;
  }

  private createPanel(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
    stroke?: Color,
    radius = 0,
  ): Node {
    const node = new Node(name);
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x, y);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    if (stroke) {
      graphics.strokeColor = stroke;
      graphics.lineWidth = 2;
    }
    if (radius > 0) {
      graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    } else {
      graphics.rect(-width / 2, -height / 2, width, height);
    }
    graphics.fill();
    if (stroke) {
      graphics.stroke();
    }
    this.root!.addChild(node);
    return node;
  }

  private createButton(
    text: string,
    x: number,
    y: number,
    width: number,
    onClick: () => void,
    fill: Color,
  ): Node {
    const node = this.createPanel(`Button-${text}`, x, y, width, 42, fill, undefined, 21);
    this.createLabel(text, x - width / 2, y - 8, 15, Color.WHITE, width);
    node.on(Node.EventType.TOUCH_END, onClick);
    return node;
  }

  private createLabel(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
  ): Label {
    const node = new Node(`Label-${text}`);
    node.addComponent(UITransform).setContentSize(width, fontSize + 8);
    node.setPosition(x + width / 2, y, 0);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 5;
    label.color = color;
    this.root!.addChild(node);
    return label;
  }

  private touchToLocal(event: EventTouch): Vec3 {
    const transform = this.root!.getComponent(UITransform)!;
    const location = event.getUILocation();
    return transform.convertToNodeSpaceAR(v3(location.x, location.y, 0));
  }

  private sourceToLocal(sourceX: number, sourceY: number): Vec3 {
    const scale = this.templateScale();
    const x = (sourceX - BOUQUET_CUTOUT_V01_TEMPLATE.sourceWidth / 2) * scale;
    const y = TEMPLATE_CENTER_Y + (BOUQUET_CUTOUT_V01_TEMPLATE.sourceHeight / 2 - sourceY) * scale;
    return v3(x, y, 0);
  }

  private templateScale(): number {
    return TEMPLATE_WIDTH / BOUQUET_CUTOUT_V01_TEMPLATE.sourceWidth;
  }

  private templateHeight(): number {
    return BOUQUET_CUTOUT_V01_TEMPLATE.sourceHeight * this.templateScale();
  }

  private traySize(flower: FlowerSpec): { width: number; height: number } {
    const maxSize = 76;
    const ratio = flower.sourceWidth / flower.sourceHeight;
    if (ratio >= 1) {
      return { width: maxSize, height: maxSize / ratio };
    }
    return { width: maxSize * ratio, height: maxSize };
  }
}
