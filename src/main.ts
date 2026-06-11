import Phaser from "phaser";

import { BouquetScene } from "./game/BouquetScene";
import "./styles.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: 430,
  height: 760,
  backgroundColor: "#f7eee8",
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BouquetScene],
};

new Phaser.Game(config);
