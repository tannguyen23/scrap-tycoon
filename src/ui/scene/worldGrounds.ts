import type { Container, Graphics } from 'pixi.js'
import type { TilePainter } from './tiles/painter'
import { drawDecor } from './textures'
import { CLEARINGS, CONNECTORS, WATER_AREAS, WORLD_HEIGHT, WORLD_WIDTH, ZONE_LAYOUTS, type ZoneRect } from './zoneLayout'

const WORLD = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }

/** Sàn khu lấy ĐÚNG rect của layout — chép tay hai nơi là mầm lệch sàn. */
function zoneRect(id: string): { x: number; y: number; width: number; height: number } {
  const layout = ZONE_LAYOUTS[id]
  if (!layout) throw new Error(`missing zone layout "${id}"`)
  return layout.rect
}

function inflate(rect: ZoneRect, pad: number): ZoneRect {
  return { x: rect.x - pad, y: rect.y - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
}

/**
 * Sàn ba khu vẽ bằng blob. `pad` phục vụ HAI việc nên khai một lần: vẽ sàn, và
 * làm vành cấm của lớp rải random (xem `SCATTER_SKIP_RECTS`).
 */
const ZONE_FLOORS = [
  { id: 'alley', kind: 'dirt', seed: 11, pad: 24 },
  { id: 'recycle', kind: 'dirt', seed: 16, pad: 24 },
  { id: 'depot', kind: 'dirt', seed: 13, pad: 24 },
  { id: 'gate', kind: 'gravel', seed: 14, pad: 28 },
] as const

/**
 * Vùng cấm của mọi lớp rải random trên nền map: lòng khu + vành blob sàn. Sàn nở
 * ra `pad` nên hoa cỏ mọc sát mép khu bị sàn che nửa — đọc ra như "cây mọc trong
 * bãi". Khu `route` là dải nhựa phủ kín rect nên chỉ cần đúng rect. Test bất biến
 * layout đọc chính danh sách này.
 */
export const SCATTER_SKIP_RECTS: readonly ZoneRect[] = [
  ...ZONE_FLOORS.map((floor) => inflate(zoneRect(floor.id), floor.pad)),
  zoneRect('route'),
]

/**
 * Paints the map grounds from the generated tile set: grass base, tonal
 * patches, flora, the dirt/gravel clearings, the asphalt connectors, the ponds,
 * debris and the hand-placed decor. Shared by the game scene and the asset
 * studio so both always show the same world.
 */
export function paintWorldGrounds(painter: TilePainter, ground: Container, decor: Graphics): void {
  painter.paint(ground, WORLD, 'grass', 7)
  painter.patchwork(ground, WORLD, 31)
  painter.scatter(ground, WORLD, 41, 'flora', 22, SCATTER_SKIP_RECTS)

  // Đường đất nối khu ve chai xuống đường ba gác: làn 72px rộng ĐỀU (đủ rộng để
  // không thành cổ chai), chỉ loe ở ĐẦU BÃI (`mouths: 'top'`) và loe ngay bên trong
  // mảng đất khu nên phần loe bị sàn khu phủ. Đầu dưới kết thúc ĐÚNG mép đường (y 380):
  // vành tile của làn vươn 16px lên mặt nhựa nhưng asphalt của khu `route` được vẽ
  // sau worldGrounds nên phủ mất phần đó — chỗ gặp chỉ còn vành cỏ phía trên.
  painter.paintPath(ground, { x: 206, y: 150, width: 72, height: 230 }, 'dirt', 12, 'grass', 44, 50, 'top')

  // Lối mòn đất khu ve chai → xưởng tái chế: làn 48px chạy ngang từ mép đông khu (x 384)
  // sang mép tây xưởng (x 608). Không loe (flare 0) vì hai đầu đều cắm vào sàn khu.
  painter.paintPath(ground, { x: 384, y: 100, width: 224, height: 48 }, 'dirt', 17, 'grass', 0)

  // Sàn của 5 khu (vẽ dưới scene chi tiết của từng khu). `outside` phải là nền THẬT
  // quanh sàn — ba sàn này nằm giữa CỎ, không phải trong bãi cùng loại nền. Khai
  // `outside` = chính nó làm `paintTiles` bỏ sạch bộ tile chuyển tiếp (`kind ===
  // outside` ⇒ `edges = []`), nên mép sàn chỉ còn là lát cắt trần: tile đất đứng
  // cạnh tile cỏ, lưới 16px cắt contour thành đoạn thẳng, sàn đọc ra như tấm dán
  // vuông vức. Hai cặp dùng ở đây đã có trong TERRAIN_PAIRS ("mảng đất, sàn khu").
  for (const floor of ZONE_FLOORS) {
    painter.paintBlob(ground, zoneRect(floor.id), floor.kind, floor.seed, floor.pad, 'grass')
  }

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

  painter.scatter(ground, WORLD, 42, 'debris', 22, SCATTER_SKIP_RECTS)
  // Ao nước vẽ sau debris để không có sỏi/cành rơi vào mặt nước.
  WATER_AREAS.forEach((area, index) =>
    painter.paintBlob(ground, area.rect, 'water', 21 + index * 3, 10, area.outside ?? 'grass'),
  )
  drawDecor(decor)
}