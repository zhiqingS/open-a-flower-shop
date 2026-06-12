import Phaser from "phaser";

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
} from "./bouquetRules";

interface PlacedFlower {
  placement: Placement;
  visual: Phaser.GameObjects.Container;
}

interface TrayItem {
  materialId: MaterialId;
  visual: Phaser.GameObjects.Container;
  home: Phaser.Math.Vector2;
  countLabel: Phaser.GameObjects.Text;
}

const FONT_FAMILY =
  '"PingFang SC", "Microsoft YaHei", system-ui, -apple-system, sans-serif';

export class BouquetScene extends Phaser.Scene {
  private placements: Placement[] = [];
  private placedFlowers: PlacedFlower[] = [];
  private trayItems: TrayItem[] = [];
  private slotHints = new Map<string, Phaser.GameObjects.Arc>();
  private instruction!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private finishButton!: Phaser.GameObjects.Container;
  private frontWrap!: Phaser.GameObjects.Container;
  private completionOverlay?: Phaser.GameObjects.Container;

  constructor() {
    super("BouquetScene");
  }

  create(): void {
    this.drawBackground();
    this.drawHeader();
    this.drawBouquetWorkspace();
    this.createSlotHints();
    this.createTray();
    this.createFinishButton();
    this.updateState();
  }

  private drawBackground(): void {
    const background = this.add.graphics();
    background.fillGradientStyle(0xfdf9f4, 0xfdf9f4, 0xf4e5e2, 0xf4e5e2, 1);
    background.fillRect(0, 0, 430, 760);

    background.fillStyle(0xffffff, 0.5);
    background.fillCircle(65, 130, 90);
    background.fillStyle(0xf4d6d5, 0.22);
    background.fillCircle(390, 250, 120);

    const table = this.add.graphics();
    table.fillStyle(0xd6ad91, 0.3);
    table.fillRoundedRect(18, 495, 394, 245, 26);
    table.lineStyle(1, 0xb8836c, 0.13);
    for (let y = 520; y < 735; y += 28) {
      table.lineBetween(35, y, 395, y);
    }
  }

  private drawHeader(): void {
    this.add
      .text(24, 20, "开业第一单", {
        fontFamily: FONT_FAMILY,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#b47b84",
      })
      .setLetterSpacing(2);

    this.add.text(24, 42, "清晨花束", {
      fontFamily: FONT_FAMILY,
      fontSize: "27px",
      fontStyle: "bold",
      color: "#574943",
    });

    this.instruction = this.add
      .text(24, 79, "拖动花材到花束中", {
        fontFamily: FONT_FAMILY,
        fontSize: "14px",
        color: "#8d7770",
      })
      .setDepth(200);

    const progressTrack = this.add.rectangle(330, 41, 76, 8, 0xe9d7d3, 0.9);
    progressTrack.setOrigin(0, 0.5);
    this.progressFill = this.add.rectangle(330, 41, 0, 8, 0xc88391, 1);
    this.progressFill.setOrigin(0, 0.5);
  }

  private drawBouquetWorkspace(): void {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x8e6f65, 0.12);
    shadow.fillEllipse(215, 472, 230, 34);
    shadow.setDepth(0);

    const backWrap = this.add.graphics();
    backWrap.fillStyle(0xfff7e8, 0.96);
    backWrap.fillTriangle(75, 210, 210, 470, 177, 192);
    backWrap.fillTriangle(355, 210, 220, 470, 250, 190);
    backWrap.fillStyle(0xf8ded1, 0.86);
    backWrap.fillTriangle(105, 245, 215, 470, 205, 220);
    backWrap.fillTriangle(325, 245, 218, 470, 228, 220);
    backWrap.setDepth(2);

    const stems = this.add.graphics();
    stems.lineStyle(5, 0x719269, 0.5);
    [-38, -22, -9, 8, 22, 37].forEach((offset, index) => {
      stems.lineBetween(215 + offset, 300 + (index % 2) * 15, 215 + offset / 5, 478);
    });
    stems.setDepth(4);

    this.frontWrap = this.createFrontWrap();
    this.frontWrap.setAlpha(0.2);
  }

  private createFrontWrap(): Phaser.GameObjects.Container {
    const container = this.add.container(0, 0).setDepth(100);
    const wrap = this.add.graphics();
    wrap.fillStyle(0xfff7e8, 0.98);
    wrap.fillTriangle(95, 390, 215, 505, 335, 390);
    wrap.fillStyle(0xf5d7cc, 0.88);
    wrap.fillTriangle(118, 405, 215, 510, 215, 440);
    wrap.fillTriangle(312, 405, 215, 510, 215, 440);

    const ribbon = this.add.graphics();
    ribbon.fillStyle(0xc98b98, 1);
    ribbon.fillEllipse(190, 500, 58, 28);
    ribbon.fillEllipse(240, 500, 58, 28);
    ribbon.fillRoundedRect(207, 490, 17, 24, 8);
    ribbon.fillTriangle(209, 505, 184, 555, 215, 515);
    ribbon.fillTriangle(220, 505, 247, 555, 216, 515);
    container.add([wrap, ribbon]);
    return container;
  }

  private createSlotHints(): void {
    BOUQUET_SLOTS.forEach((slot) => {
      const hint = this.add.circle(slot.x, slot.y, slot.role === "line" ? 24 : 31);
      hint.setStrokeStyle(1.5, 0xb7838d, 0.22);
      hint.setFillStyle(0xffffff, 0.06);
      hint.setDepth(5);
      this.slotHints.set(slot.id, hint);
    });
  }

  private createTray(): void {
    const xPositions = [61, 164, 267, 370];
    MATERIALS.forEach((material, index) => {
      const x = xPositions[index]!;
      const y = 647;
      const item = this.createTrayItem(material.id, x, y);
      this.trayItems.push(item);
    });

    this.input.on(
      "dragstart",
      (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
        const item = this.trayItems.find((candidate) => candidate.visual === gameObject);
        if (!item || !canPlaceMore(item.materialId, this.placements)) {
          return;
        }

        gameObject.setDepth(300);
        gameObject.setScale(1.04);
        this.showCompatibleSlots(getMaterial(item.materialId).role);
      },
    );

    this.input.on(
      "drag",
      (
        _pointer: Phaser.Input.Pointer,
        gameObject: Phaser.GameObjects.Container,
        dragX: number,
        dragY: number,
      ) => {
        gameObject.setPosition(dragX, dragY);
      },
    );

    this.input.on(
      "dragend",
      (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
        const item = this.trayItems.find((candidate) => candidate.visual === gameObject);
        if (!item) {
          return;
        }

        const slot = findBestSlot(item.materialId, pointer, this.placements);
        if (slot && canPlaceMore(item.materialId, this.placements)) {
          this.placeFlower(item.materialId, slot);
        } else {
          this.cameras.main.shake(80, 0.002);
        }

        gameObject.setDepth(210);
        this.tweens.add({
          targets: gameObject,
          x: item.home.x,
          y: item.home.y,
          scale: 1,
          duration: 180,
          ease: "Back.Out",
        });
        this.hideSlotHints();
        this.updateState();
      },
    );
  }

  private createTrayItem(materialId: MaterialId, x: number, y: number): TrayItem {
    const material = getMaterial(materialId);
    const container = this.add.container(x, y).setDepth(210);
    const panel = this.add.graphics();
    panel.fillStyle(0xfffbf6, 0.96);
    panel.fillRoundedRect(-42, -50, 84, 100, 20);
    panel.lineStyle(1.5, material.color, 0.5);
    panel.strokeRoundedRect(-42, -50, 84, 100, 20);

    const icon = this.createFlowerVisual(materialId, 0, -17, 0.38, 0);
    icon.removeFromDisplayList();
    icon.setDepth(0);

    const label = this.add
      .text(0, 27, material.name.replace(/色|白色|蓝色|香槟/g, ""), {
        fontFamily: FONT_FAMILY,
        fontSize: "11px",
        fontStyle: "bold",
        color: "#67554f",
        align: "center",
      })
      .setOrigin(0.5);

    const countLabel = this.add
      .text(31, -39, `${material.targetCount}`, {
        fontFamily: FONT_FAMILY,
        fontSize: "11px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const badge = this.add.circle(31, -39, 11, material.color, 1);

    container.add([panel, icon, label, badge, countLabel]);
    container.setSize(84, 100);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-42, -50, 84, 100),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input.setDraggable(container);

    return {
      materialId,
      visual: container,
      home: new Phaser.Math.Vector2(x, y),
      countLabel,
    };
  }

  private createFlowerVisual(
    materialId: MaterialId,
    x: number,
    y: number,
    scale: number,
    rotation: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const graphics = this.add.graphics();

    if (materialId === "dahlia") {
      this.drawStem(graphics, 80);
      this.drawLeaves(graphics, 26, 65);
      this.drawLayeredFlower(graphics, 0xf4b4c0, 0xe58da3, 0xd87590, 24, 15, 3);
    } else if (materialId === "ranunculus") {
      this.drawStem(graphics, 82);
      this.drawLeaves(graphics, 22, 66);
      this.drawRanunculus(graphics);
    } else if (materialId === "delphinium") {
      this.drawDelphinium(graphics);
    } else {
      this.drawDaisies(graphics);
    }

    container.add(graphics);
    container.setScale(scale);
    container.setRotation(rotation);
    return container;
  }

  private drawStem(graphics: Phaser.GameObjects.Graphics, length: number): void {
    graphics.lineStyle(4, 0x6f9568, 1);
    graphics.lineBetween(0, 18, 0, length);
  }

  private drawLeaves(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(0x7ea774, 1);
    graphics.fillEllipse(-x, y, 30, 14);
    graphics.fillEllipse(x, y - 10, 30, 14);
  }

  private drawLayeredFlower(
    graphics: Phaser.GameObjects.Graphics,
    outer: number,
    middle: number,
    inner: number,
    radius: number,
    petals: number,
    layers: number,
  ): void {
    const colors = [outer, middle, inner];
    for (let layer = 0; layer < layers; layer += 1) {
      const layerRadius = radius - layer * 6;
      const petalLength = 18 - layer * 3;
      graphics.fillStyle(colors[layer]!, 1);
      for (let index = 0; index < petals; index += 1) {
        const angle = (Math.PI * 2 * index) / petals + layer * 0.18;
        graphics.save();
        graphics.translateCanvas(
          Math.cos(angle) * layerRadius,
          Math.sin(angle) * layerRadius,
        );
        graphics.rotateCanvas(angle);
        graphics.fillEllipse(0, 0, petalLength, 9 - layer);
        graphics.restore();
      }
    }
    graphics.fillStyle(0xd98772, 1);
    graphics.fillCircle(0, 0, 7);
  }

  private drawRanunculus(graphics: Phaser.GameObjects.Graphics): void {
    const colors = [0xf6d59f, 0xf2c489, 0xeeb777, 0xe3a763];
    colors.forEach((color, index) => {
      graphics.lineStyle(6, color, 1);
      graphics.strokeCircle(0, 0, 29 - index * 6);
    });
    graphics.fillStyle(0xe4a45f, 1);
    graphics.fillCircle(0, 0, 7);
  }

  private drawDelphinium(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(4, 0x72936f, 1);
    graphics.lineBetween(0, -42, 0, 92);
    graphics.fillStyle(0x7da4d8, 1);
    const flowers = [
      [-3, -38],
      [-16, -20],
      [13, -10],
      [-11, 6],
      [15, 22],
      [-9, 38],
      [11, 53],
    ];
    flowers.forEach(([flowerX, flowerY], index) => {
      graphics.lineStyle(2, 0x72936f, 1);
      graphics.lineBetween(0, flowerY! + 5, flowerX!, flowerY!);
      graphics.fillStyle(index % 2 === 0 ? 0x9bbce5 : 0x86abe0, 1);
      for (let petal = 0; petal < 5; petal += 1) {
        const angle = (Math.PI * 2 * petal) / 5;
        graphics.fillCircle(
          flowerX! + Math.cos(angle) * 7,
          flowerY! + Math.sin(angle) * 7,
          5,
        );
      }
      graphics.fillStyle(0xf1de9d, 1);
      graphics.fillCircle(flowerX!, flowerY!, 3);
    });
  }

  private drawDaisies(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(3, 0x73946e, 1);
    graphics.lineBetween(0, -12, 0, 90);
    const flowers = [
      [-18, 2],
      [14, -10],
      [21, 22],
      [-13, 35],
    ];
    flowers.forEach(([flowerX, flowerY]) => {
      graphics.lineBetween(0, flowerY! + 18, flowerX!, flowerY!);
      graphics.fillStyle(0xfffbeb, 1);
      for (let petal = 0; petal < 8; petal += 1) {
        const angle = (Math.PI * 2 * petal) / 8;
        graphics.fillEllipse(
          flowerX! + Math.cos(angle) * 8,
          flowerY! + Math.sin(angle) * 8,
          7,
          4,
        );
      }
      graphics.fillStyle(0xe7b84d, 1);
      graphics.fillCircle(flowerX!, flowerY!, 4);
    });
  }

  private showCompatibleSlots(role: string): void {
    BOUQUET_SLOTS.forEach((slot) => {
      const hint = this.slotHints.get(slot.id);
      if (!hint || this.placements.some((placement) => placement.slotId === slot.id)) {
        return;
      }
      hint.setStrokeStyle(3, slot.role === role ? 0xc06f82 : 0xb5a29b, slot.role === role ? 0.9 : 0.1);
      hint.setFillStyle(0xffffff, slot.role === role ? 0.35 : 0.03);
    });
  }

  private hideSlotHints(): void {
    BOUQUET_SLOTS.forEach((slot) => {
      const hint = this.slotHints.get(slot.id);
      if (!hint || this.placements.some((placement) => placement.slotId === slot.id)) {
        return;
      }
      hint.setStrokeStyle(1.5, 0xb7838d, 0.22);
      hint.setFillStyle(0xffffff, 0.06);
    });
  }

  private placeFlower(materialId: MaterialId, slot: BouquetSlot): void {
    const placement = { materialId, slotId: slot.id };
    const visual = this.createFlowerVisual(
      materialId,
      slot.x,
      slot.y,
      slot.scale,
      slot.rotation,
    );
    visual.setDepth(slot.depth);
    visual.setAlpha(0);
    visual.setScale(slot.scale * 0.7);

    this.placements.push(placement);
    this.placedFlowers.push({ placement, visual });
    this.slotHints.get(slot.id)?.setVisible(false);

    this.tweens.add({
      targets: visual,
      alpha: 1,
      scale: slot.scale,
      duration: 260,
      ease: "Back.Out",
    });
  }

  private createFinishButton(): void {
    const button = this.add.container(215, 545).setDepth(250).setVisible(false);
    const background = this.add.graphics();
    background.fillStyle(0xb66f7d, 1);
    background.fillRoundedRect(-88, -22, 176, 44, 22);
    const label = this.add
      .text(0, 0, "整理并完成花束", {
        fontFamily: FONT_FAMILY,
        fontSize: "15px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    button.add([background, label]);
    button.setSize(176, 44);
    button.setInteractive(
      new Phaser.Geom.Rectangle(-88, -22, 176, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    button.on("pointerdown", () => this.finishBouquet());
    this.finishButton = button;
  }

  private finishBouquet(): void {
    if (!isBouquetComplete(this.placements) || this.completionOverlay) {
      return;
    }

    this.finishButton.disableInteractive();
    this.finishButton.setVisible(false);
    this.instruction.setText("系统正在轻轻整理花束…");

    this.placedFlowers.forEach(({ visual }, index) => {
      this.tweens.add({
        targets: visual,
        x: visual.x + (index % 2 === 0 ? -3 : 3),
        y: visual.y - 4 - (index % 3) * 2,
        rotation: visual.rotation + (index % 2 === 0 ? -0.025 : 0.025),
        duration: 480,
        delay: index * 35,
        ease: "Sine.InOut",
      });
    });

    this.tweens.add({
      targets: this.frontWrap,
      alpha: 1,
      duration: 520,
      ease: "Sine.Out",
      onComplete: () => this.showCompletion(),
    });
  }

  private showCompletion(): void {
    this.instruction.setText("一束温柔的清晨花束完成了");
    const overlay = this.add.container(215, 565).setDepth(400);
    const card = this.add.graphics();
    card.fillStyle(0xfffbf7, 0.98);
    card.fillRoundedRect(-165, -48, 330, 96, 24);
    card.lineStyle(1.5, 0xd8a7b0, 0.45);
    card.strokeRoundedRect(-165, -48, 330, 96, 24);
    const title = this.add
      .text(0, -18, "清晨花束 · 制作完成", {
        fontFamily: FONT_FAMILY,
        fontSize: "17px",
        fontStyle: "bold",
        color: "#614d48",
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, 15, "你选择花材，系统只帮你整理构图", {
        fontFamily: FONT_FAMILY,
        fontSize: "12px",
        color: "#957a73",
      })
      .setOrigin(0.5);
    overlay.add([card, title, subtitle]);
    overlay.setAlpha(0);
    overlay.setScale(0.92);
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      scale: 1,
      duration: 320,
      ease: "Back.Out",
    });
    this.completionOverlay = overlay;
  }

  private updateState(): void {
    const progress = getProgress(this.placements);
    this.progressFill.width = 76 * progress;

    this.trayItems.forEach((item) => {
      const material = getMaterial(item.materialId);
      const remaining = material.targetCount - getPlacementCount(item.materialId, this.placements);
      item.countLabel.setText(`${remaining}`);
      item.visual.setAlpha(remaining > 0 ? 1 : 0.38);
      if (remaining > 0) {
        item.visual.setInteractive(
          new Phaser.Geom.Rectangle(-42, -50, 84, 100),
          Phaser.Geom.Rectangle.Contains,
        );
        this.input.setDraggable(item.visual);
      } else {
        item.visual.disableInteractive();
      }
    });

    const complete = isBouquetComplete(this.placements);
    this.finishButton.setVisible(complete);
    if (!complete) {
      const nextMaterial = MATERIALS.find((material) => canPlaceMore(material.id, this.placements));
      this.instruction.setText(
        nextMaterial ? `继续加入${nextMaterial.name}` : "拖动花材到花束中",
      );
    }
  }
}
