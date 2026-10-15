# Paventech ERP — geliştirme rehberi

@AGENTS.md

Çok şirketli bulut ERP prototipi (Next.js 16 + PostgreSQL). Kurulum ve demo için
[README.md](README.md), kararların gerekçeleri için [docs/KARARLAR.md](docs/KARARLAR.md).

## Komutlar

```bash
pnpm dev          # geliştirme sunucusu (localhost:3000)
pnpm typecheck    # next typegen + tsc
pnpm lint
pnpm test         # vitest; entegrasyon testleri TEST_DATABASE_URL'i sıfırlar
pnpm build        # rota / önbellek değişikliklerinde mutlaka çalıştır
pnpm db:generate  # şema değişikliğinden göç üretir
pnpm db:reset     # geliştirme veritabanını baştan kurar + demo veri
```

Bir değişikliği bitirmeden önce: `pnpm typecheck && pnpm lint && pnpm test`.

## Mimari

**Next.js 16, Cache Components açık** (`cacheComponents: true`, `partialPrefetching: true`).
Bu sürüm eğitim verinizdekinden farklı; şüphede `node_modules/next/dist/docs/` okuyun.
- Oturum, veritabanı ve `searchParams` gibi çalışma anı verileri yalnızca `<Suspense>` içinde okunur.
  Her sayfa bu kalıpla yazılır:
  ```tsx
  export default suspensePage(async function XPage(props: PageProps<"/rota">) { ... });
  ```
- `params` ve `searchParams` Promise'tir (`await props.params`).
- Yetki yönlendirmesi `src/proxy.ts`'te (middleware değil).
- Server Action'lar `src/server/**/actions.ts` (`"use server"`). Gövde `runAction(...)` ile sarılır;
  yazdıktan sonra `refresh()` (`next/cache`) çağrılır. İstemcide `useAction()` hook'u kullanılır.

**Çok kiracılık (şirket = Better Auth organization).**
- Her iş tablosunda `tenant_id` var ve **her sorgu** `ctx.tenantId` ile filtrelenir.
- Bağlam:
  - Sayfada `getTenantContext()` ya da `requireModule("stok")`.
  - Action'da `assertModule("stok")`.
  - Super Admin işlemlerinde `requireSuperAdmin()`.
- Yazma işlemleri `tenantTx(ctx, tx => ...)` içinde yapılır ve `audit(tx, ctx, {...})` ile kaydedilir.
- Row Level Security henüz kapalı (yol haritasında); filtreyi unutmak veri sızıntısıdır.

**Modül kataloğu** `src/lib/modules.ts`: 13 standart + 5 Plus modül, bağımlılıklar, paketler.
Şirketin açık modülleri `tenant_module` tablosunda. Menü, komut paleti ve yetki bu katalogdan okunur.

**Belge motoru.** `src/lib/documents/types.ts` içindeki `DOC_TYPES` her belge türünün davranışını
tanımlar: cari / stok / kasa etkisi, satır tipi, dönüşüm, numara ön eki. Tür eklerken önce buraya bakın.
`src/server/documents/service.ts`:
- `saveDraft`: taslak kaydı
- `approveDocument`: numara alır, hareket üretir
- `cancelDocument`: ters kayıt atar
- `convertDocument`: teklif → sipariş → irsaliye → fatura
- `deleteDraft`: taslak siler

Servis "server-only" değildir; seed betiği de aynı kuralları kullanır.

**Hareket defteri kuralları (bozmayın):**
1. Bakiye ve stok, hareket tablolarının toplamıdır: `stock_movements`, `partner_movements`, `cash_movements`. Bakiye kolonu tutulmaz.
2. Hareketler değişmez. UPDATE ve DELETE yapılmaz; iptal ters kayıtla yapılır.
3. Onaylı belge değiştirilemez. Numara onayda `number_series` upsert'iyle alınır, boşluksuzdur (`SFT2026000000001`).
4. Maliyet:
   - Tedarikçiden girişte iskontolu net / miktar.
   - Diğer çıkışlarda hareketli ağırlıklı ortalama.
5. Kasa (`kind = "kasa"`) eksiye düşemez; banka ve POS düşebilir.
6. Para hesapları `@/lib/money` ile yapılır (`dec`, `round2`, `toMoneyString`), JavaScript float ile asla.
   - Yuvarlama satır bazındadır (ROUND_HALF_UP).
   - PostgreSQL `numeric` değerleri string döner.

**Varlık motoru.** `src/lib/entities/registry.ts` alan tanımlarından liste, form, pano ve CSV dışa
aktarımı otomatik üretir (`/kayit/[varlik]`). Basit kayıt ekranı için yeni sayfa yazmak yerine
buraya varlık ekleyin.

**Plus modüller** (`src/server/plus`, `src/app/(app)/plus`) vitrindir: gerçek veriyle çalışır
ama dış entegrasyon (entegratör, pazaryeri, dil modeli) bağlı değildir. Bunu ekranda "Prototip notu"
ile dürüstçe belirtin.

## Kod kuralları

- Arayüz metinleri Türkçe.
  - Kod adları İngilizce.
  - Alan değerleri mevcut Türkçe sabitleri kullanır (`taslak`, `onayli`, `iptal`, `musteri`...).
- Kullanıcıya gösterilecek hata: `throw new UserError(mesaj, alanHataları)`. Beklenmeyen hatalar loglanır, kullanıcıya genel mesaj gider.
- Biçimlendirme `@/lib/format` ile yapılır (`formatMoney`, `formatDate`, `todayIso` Europe/Istanbul).
- Sayı girdisi `parseDecimalInput` ile okunur ("1.234,56", "1.500" = 1500, "1234.56").
- Şema değişikliği:
  1. `src/server/db/schema/*.ts` düzenlenir.
  2. `pnpm db:generate` çalıştırılır.
  3. Üretilen SQL `drizzle/` altında commit'lenir. Uygulanmış göç elle değiştirilmez.
- Testler:
  - Belge veya hareket kuralını değiştiren her iş `tests/integration/` altında test ister.
  - Saf fonksiyonların testi yanındaki `*.test.ts` dosyasında durur.
- Arayüz parçaları `src/components/ui`'dedir (radix-ui üzerinde shadcn tarzı, elle yazıldı).
  - Renkler tema değişkenleriyle verilir (`bg-primary`, `text-muted-foreground`, `text-plus`).
  - Grafikler `--chart-1..5` sırasını kullanır; sıra renk körlüğü güvenliği için sabittir.
- Demo veri `src/server/seed/demo.ts`:
  - Belge motorundan geçer.
  - Rastgelelik sabit tohumludur.
  - Tüm şirket/kişi verisi kurgusaldır, gerçek müşteri verisi konmaz.

## Sözlük

| Terim | Anlamı |
| --- | --- |
| Cari | Müşteri / tedarikçi hesabı; borç-alacak takibi |
| Tahsilat / Tediye (Ödeme) | Gelen / giden para |
| Virman | Kasa, banka, POS arasında para aktarımı |
| Teklif → Sipariş → İrsaliye → Fatura | Satış akışı; stok irsaliyede (yoksa faturada), cari faturada hareket eder |
| Mamul / Yarı mamul / Hammadde / Ticari mal | Üretilen / ara ürün / üretim girdisi / alınıp satılan mal |
| Reçete (BOM), İş emri, Fire | Ürün ağacı, üretim emri, kayıp oranı |
| Vade, Vadesi geçen | Ödeme tarihi; FIFO ile hesaplanan gecikmiş tutar |
| KDV, VKN, ETTN | Katma değer vergisi, vergi no, e-faturanın tekil kimliği |
| GİB, Özel entegratör | Gelir İdaresi; e-belgeyi GİB'e ileten lisanslı firma |
| KMH | Kredili mevduat hesabı (bankanın eksiye düşebilmesi) |
