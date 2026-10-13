# Scrap Tycoon

Idle game thu gom phế liệu: nhân công thu sắt vụn → bán tự động → nâng cấp. Phase 1 là walking
skeleton với 1 nhánh "Đồng nát"; các nhánh tiếp theo (Điện tử → Xe cộ → Xe hơi, chi nhánh...)
chỉ cần **thêm content/data**, không sửa engine.

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Dev server → http://localhost:5173 |
| `npm run check` | Cổng chất lượng: `tsc` + `oxlint` + dependency-cruiser + vitest |
| `npm run test` / `npm run test:watch` | Unit tests (vitest) |
| `npm run depcheck` | Kiểm tra ranh giới layer (dependency-cruiser) |
| `npm run build` / `npm run preview` | Build production |

## Kiến trúc

```
src/
  core/      # engine game-agnostic: Decimal (break_eternity), format số, clock, store, save + migrations
  i18n/      # type L10n (VI/EN compile-time), locale store, UI strings
  domain/    # luật chơi THUẦN: modifiers, production/recipes, offline, commands, selectors
  content/   # toàn bộ balance là DATA: items, branches/, upgrades, curves — chỉ app + tests import
  ui/        # HUD React + scene Pixi (chỉ ĐỌC state, không mutate)
  platform/  # StoragePort adapters (localStorage / memory)
  app/       # composition root: bootstrap, engine (EngineApi), loop (ticks + autosave + offline)
```

Ranh giới layer được **enforce tự động** bằng dependency-cruiser (`.dependency-cruiser.cjs`):

- `core` không import gì của repo; `domain` chỉ `core` + `i18n`; `ui` không được import `content`/`app`.
- `content` được inject từ `app` qua React context (`useContent()`) — UI render data-driven.
- `core`/`domain`/`i18n`/`content` cấm import `react`/`pixi.js`.
- Thêm import sai tầng → `npm run depcheck` fail ngay.

Các pattern trục chính:

- **Modifier pipeline**: `final = (base + Σflat) × Πmult × Πglobal` — mọi upgrade/prestige/bonus đổ vào đây qua `statKeys`.
- **Command → State → Event(store) → UI**: UI chỉ đọc state qua selectors + `useSyncExternalStore`; mọi thay đổi đi qua `domain/commands` hoặc `domain/tick`.
- **Offline = cùng code path với online**: `applyOfflineProgress` dùng chung `computeNetRates`/`applyRates`; hiện tại rates không đổi khi vắng nên 1 bước lớn là chính xác.
- **Save**: chỉ chứa state (ids + counts, Decimal dạng string), có `schemaVersion` + migrations; load xong prune id lạ / fill id thiếu nên content đổi không phá save cũ.

## Thêm nội dung mới (Phase 2+)

1. Tạo `src/content/branches/<tên>.ts` theo `BranchDef` (workers, recipes, upgrades).
2. Đăng ký vào `src/content/index.ts`.
3. Unlock nhánh mới → thêm `Condition` + unlock system trong `domain/` (chưa có ở Phase 1).
4. Chạy `npm run check` — golden balance test (`tests/golden.balance.test.ts`) sẽ nhắc nếu economy lệch khỏi baseline đã khóa.

## Quy ước

- Tài nguyên/giá là `Decimal`; số lượng worker là `number`.
- Text hiển thị luôn là `L10n = { vi, en }` — thêm ngôn ngữ mới thì TypeScript chỉ ra mọi chỗ thiếu.
- Balance chỉ nằm trong `src/content/` — không hard-code hệ số trong systems.
