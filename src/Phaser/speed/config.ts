import Phaser from 'phaser'
import CpuLevelScene from '@/Phaser/common/CpuLevelScene'
import Speed from '@/Phaser/speed/SpeedScene'

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-speed-game',
  scale: {
    mode: Phaser.Scale.FIT,
    parent: 'game-content',
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: 720,
      height: 345,
    },
    max: {
      width: 1920,
      height: 920,
    },
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 200 },
    },
  },
  scene: [CpuLevelScene, Speed],
}

export default gameConfig
