import type { Container, Graphics } from 'pixi.js'
import type { TilePainter } from './tiles/painter'
import { drawDecor } from './textures'
import { CLEARINGS, CONNECTORS, WATER_AREAS, WORLD_HEIGHT, WORLD_WIDTH } from './zoneLayout'

const WORLD = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }

/**
 * Paints the map grounds from the generated tile set: grass base, tonal
 * patches, flora, the dirt/gravel clearings, the asphalt connectors, the ponds,
 * debris and the hand-placed decor. Shared by the game scene and the asset
 * studio so both always show the same world.
 */
export function paintWorldGrounds(painter: TilePainter, ground: Container, decor: Graphics): void {
  painter.paint(ground, WORLD, 'grass', 7)
  painter.patchwork(ground, WORLD, 31)
  painter.scatter(ground, WORLD, 41, 'flora')

  // Đường đất nối ngõ xuống đường ba gác: làn 72px rộng ĐỀU (đủ rộng để không
  // thành cổ chai), chỉ loe ở ĐẦU NGÕ (`mouths: 'top'`) và loe ngay bên trong mảng
  // đất ngõ nên phần loe bị sàn khu phủ. Đầu dưới kết thúc ĐÚNG mép đường (y 380):
  // vành tile của làn vươn 16px lên mặt nhựa nhưng asphalt của khu `route` được vẽ
  // sau worldGrounds nên phủ mất phần đó — chỗ gặp chỉ còn vành cỏ phía trên.
  painter.paintPath(ground, { x: 206, y: 150, width: 72, height: 230 }, 'dirt', 12, 'grass', 44, 50, 'top')

  // Sàn của 4 khu (vẽ dưới scene chi tiết của từng khu). Sàn nằm trong bãi cùng
// loại nền nên dùng outside = chính nó: mép thành gờ đất/sỏi chứ không phải cỏ.
  painter.paintBlob(ground, { x: 80, y: 70, width: 224, height: 124 }, 'dirt', 11, 24, 'dirt')
  painter.paintBlob(ground, { x: 80, y: 560, width: 264, height: 88 }, 'dirt', 13, 24, 'dirt')
  painter.paintBlob(ground, { x: 860, y: 548, width: 256, height: 92 }, 'gravel', 14, 28, 'gravel')

  CLEARINGS.forEach((patch, index) =>
    painter.paintBlob(
      ground,
      patch.rect,
      patch.kind ?? 'dirt',
      18 + index,
      16,
      patch.outside ?? 'grass',
      patch.elevation ?? 0,
    ),
  )

  CONNECTORS.forEach((rect, index) => painter.paint(ground, rect, 'asphalt', 15 + index))

  // CHỖ NỐI: **`outside` phải là nền THẬT xung quanh**, không phải nền bên kia
  // ranh giới — tile chuyển tiếp kéo theo một vành rộng 1 ô theo đúng tông của
  // `outside`, nên `outside: 'asphalt'` giữa đồng cỏ chính là "cái nêm xám" từng
  // làm bản đồ rối. Vành phải rơi lên chính loại nền đó (hoặc cùng tông) mới vô hình.
  // (a) Lối vào nhà khu dưới-trái nằm trong bãi đất của kho nên môi là ĐẤT.
  painter.paintPath(ground, { x: 196, y: 498, width: 76, height: 88 }, 'dirt', 33, 'dirt', 30, 34)
  // (b) Lối vào sân công nghiệp phía tây: vành rơi lên chính bãi sỏi của sân.
  painter.paintPath(ground, { x: 900, y: 498, width: 84, height: 84 }, 'gravel', 34, 'gravel', 30, 32)
  // (c) Miệng làn xuất hàng hoà vào sỏi sân.
  painter.paintPath(ground, { x: 1086, y: 568, width: 72, height: 50 }, 'gravel', 35, 'gravel', 24, 22)

  painter.scatter(ground, WORLD, 42, 'debris')
  // Ao nước vẽ sau debris để không có sỏi/cành rơi vào mặt nước.
  WATER_AREAS.forEach((area, index) =>
    painter.paintBlob(ground, area.rect, 'water', 21 + index * 3, 10, area.outside ?? 'grass'),
  )
  drawDecor(decor)
}