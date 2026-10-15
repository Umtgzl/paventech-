// Modül kataloğu: Super Admin'den şirket bazında açılıp kapatılan modüller.
// Sol menü, yetki kontrolü ve paketler bu listeden türetilir.
// Yeni bir modül eklemek = buraya bir kayıt + sayfaları/varlıkları.

export type ModuleKey =
  | "cari"
  | "kasa"
  | "masraf"
  | "stok"
  | "satis"
  | "satinalma"
  | "uretim"
  | "maliyet"
  | "kalite"
  | "bakim"
  | "crm"
  | "ik"
  | "proje"
  | "ai"
  | "edonusum"
  | "b2b"
  | "eticaret"
  | "otomasyon";

export type ModuleTier = "standart" | "plus";

/**
 * Prototipteki derinlik seviyesi:
 * - cekirdek: gerçek iş kuralları (hareket defteri, onay, iptal)
 * - temel: ortak motorla kayıt/liste/form, iş kuralları sonra derinleşecek
 * - vitrin: örnek veriyle çalışan önizleme (entegrasyonlar bağlanacak)
 */
export type ModuleDepth = "cekirdek" | "temel" | "vitrin";

export type ModuleGroupKey = "finans" | "ticari" | "uretim" | "insan" | "plus";

export type IconName =
  | "layout-dashboard"
  | "users"
  | "landmark"
  | "receipt"
  | "package"
  | "shopping-cart"
  | "truck"
  | "factory"
  | "calculator"
  | "badge-check"
  | "wrench"
  | "target"
  | "id-card"
  | "kanban"
  | "sparkles"
  | "file-check"
  | "store"
  | "globe"
  | "zap"
  | "settings"
  | "shield";

export interface ModuleItem {
  label: string;
  href: string;
}

export interface ModuleDef {
  key: ModuleKey;
  name: string;
  short: string;
  group: ModuleGroupKey;
  tier: ModuleTier;
  depth: ModuleDepth;
  icon: IconName;
  description: string;
  features: string[];
  dependsOn: ModuleKey[];
  items: ModuleItem[];
}

export const MODULE_GROUPS: { key: ModuleGroupKey; label: string }[] = [
  { key: "finans", label: "Finans & Ön Muhasebe" },
  { key: "ticari", label: "Ticari & Tedarik" },
  { key: "uretim", label: "Üretim & Saha" },
  { key: "insan", label: "İK & Müşteri İlişkileri" },
  { key: "plus", label: "Plus" },
];

export const MODULES: ModuleDef[] = [
  // ---------------- Finans ----------------
  {
    key: "cari",
    name: "Cari Hesaplar & Ön Muhasebe",
    short: "Cari Hesaplar",
    group: "finans",
    tier: "standart",
    depth: "cekirdek",
    icon: "users",
    description: "Müşteri ve tedarikçi kartları, borç-alacak hareketleri, ekstre ve bakiyeler.",
    features: ["Cari kartlar", "Cari ekstre", "Bakiye ve vade takibi"],
    dependsOn: [],
    items: [
      { label: "Cari Kartlar", href: "/cari" },
      { label: "Cari Bakiyeler", href: "/cari/bakiyeler" },
    ],
  },
  {
    key: "kasa",
    name: "Kasa & Banka",
    short: "Kasa & Banka",
    group: "finans",
    tier: "standart",
    depth: "cekirdek",
    icon: "landmark",
    description: "Kasa, banka ve POS hesapları; tahsilat, ödeme ve hesap hareketleri.",
    features: ["Kasa/banka/POS hesapları", "Tahsilat ve ödeme", "Hesap hareketleri"],
    dependsOn: ["cari"],
    items: [
      { label: "Hesaplar", href: "/kasa-banka" },
      { label: "Tahsilatlar", href: "/belge/tahsilat" },
      { label: "Ödemeler", href: "/belge/odeme" },
    ],
  },
  {
    key: "masraf",
    name: "Masraf & Gider Yönetimi",
    short: "Masraflar",
    group: "finans",
    tier: "standart",
    depth: "cekirdek",
    icon: "receipt",
    description: "Şirket içi harcama fişleri, kategori bazlı gider takibi.",
    features: ["Masraf fişi", "Kasadan otomatik çıkış", "Kategori bazlı rapor"],
    dependsOn: ["kasa"],
    items: [{ label: "Masraf Fişleri", href: "/belge/masraf" }],
  },
  // ---------------- Ticari ----------------
  {
    key: "stok",
    name: "Stok & Çoklu Depo",
    short: "Stok",
    group: "ticari",
    tier: "standart",
    depth: "cekirdek",
    icon: "package",
    description: "Ürün kartları, depolar, stok hareketleri, depo transferleri ve kritik stok uyarıları.",
    features: ["Ürün kartları", "Çoklu depo", "Ortalama maliyet", "Kritik stok"],
    dependsOn: [],
    items: [
      { label: "Ürünler", href: "/stok/urunler" },
      { label: "Depolar", href: "/stok/depolar" },
      { label: "Stok Durumu", href: "/stok/durum" },
      { label: "Stok Hareketleri", href: "/stok/hareketler" },
      { label: "Depo Transferleri", href: "/belge/depo-transfer" },
    ],
  },
  {
    key: "satis",
    name: "Satış & Sipariş",
    short: "Satış",
    group: "ticari",
    tier: "standart",
    depth: "cekirdek",
    icon: "shopping-cart",
    description: "Tekliften siparişe, irsaliyeye ve faturaya tek tıkla dönüşen satış akışı.",
    features: ["Teklif", "Sipariş", "İrsaliye", "Fatura", "İade"],
    dependsOn: ["cari", "stok"],
    items: [
      { label: "Teklifler", href: "/belge/satis-teklifi" },
      { label: "Siparişler", href: "/belge/satis-siparisi" },
      { label: "İrsaliyeler", href: "/belge/satis-irsaliyesi" },
      { label: "Faturalar", href: "/belge/satis-faturasi" },
      { label: "İadeler", href: "/belge/satis-iadesi" },
    ],
  },
  {
    key: "satinalma",
    name: "Satın Alma & Tedarikçi",
    short: "Satın Alma",
    group: "ticari",
    tier: "standart",
    depth: "cekirdek",
    icon: "truck",
    description: "Satın alma siparişleri, mal kabul ve alış faturaları.",
    features: ["Satın alma siparişi", "Mal kabul", "Alış faturası", "İade"],
    dependsOn: ["cari", "stok"],
    items: [
      { label: "Siparişler", href: "/belge/alis-siparisi" },
      { label: "Mal Kabul", href: "/belge/alis-irsaliyesi" },
      { label: "Alış Faturaları", href: "/belge/alis-faturasi" },
      { label: "İadeler", href: "/belge/alis-iadesi" },
    ],
  },
  // ---------------- Üretim & Saha ----------------
  {
    key: "uretim",
    name: "Üretim & Reçete",
    short: "Üretim",
    group: "uretim",
    tier: "standart",
    depth: "temel",
    icon: "factory",
    description: "Ürün reçeteleri (BOM), iş emirleri ve hammadde sarfiyatı.",
    features: ["Reçete", "İş emri", "Hammadde düşümü"],
    dependsOn: ["stok"],
    items: [
      { label: "Reçeteler", href: "/kayit/recete" },
      { label: "İş Emirleri", href: "/kayit/is-emri" },
    ],
  },
  {
    key: "maliyet",
    name: "Maliyet Muhasebesi",
    short: "Maliyet",
    group: "uretim",
    tier: "standart",
    depth: "temel",
    icon: "calculator",
    description: "Reçete ve alış fiyatlarından ürün bazlı birim maliyet.",
    features: ["Reçeteye göre birim maliyet", "Ortalama alış maliyeti"],
    dependsOn: ["uretim"],
    items: [{ label: "Ürün Maliyetleri", href: "/maliyet" }],
  },
  {
    key: "kalite",
    name: "Kalite Kontrol",
    short: "Kalite",
    group: "uretim",
    tier: "standart",
    depth: "temel",
    icon: "badge-check",
    description: "Mal kabul, üretim ara kontrol ve sevkiyat öncesi kabul/ret kayıtları.",
    features: ["Giriş kontrol", "Ara kontrol", "Son kontrol"],
    dependsOn: [],
    items: [{ label: "Kontrol Kayıtları", href: "/kayit/kalite-kontrol" }],
  },
  {
    key: "bakim",
    name: "Demirbaş & Bakım (CMMS)",
    short: "Demirbaş & Bakım",
    group: "uretim",
    tier: "standart",
    depth: "temel",
    icon: "wrench",
    description: "Makine ve araçların periyodik bakım takvimi, arıza kayıtları.",
    features: ["Demirbaş kartı", "Bakım planı", "Arıza kaydı"],
    dependsOn: [],
    items: [
      { label: "Demirbaşlar", href: "/kayit/demirbas" },
      { label: "Bakım Kayıtları", href: "/kayit/bakim-kaydi" },
    ],
  },
  // ---------------- İK & CRM ----------------
  {
    key: "crm",
    name: "CRM & Satış Hunisi",
    short: "CRM",
    group: "insan",
    tier: "standart",
    depth: "temel",
    icon: "target",
    description: "Potansiyel müşteri takibi, fırsat aşamaları ve görüşme notları.",
    features: ["Fırsatlar", "Aşama takibi", "Tahmini ciro"],
    dependsOn: [],
    items: [{ label: "Fırsatlar", href: "/kayit/firsat" }],
  },
  {
    key: "ik",
    name: "İnsan Kaynakları & Özlük",
    short: "İnsan Kaynakları",
    group: "insan",
    tier: "standart",
    depth: "temel",
    icon: "id-card",
    description: "Personel kartları, izin talepleri ve zimmet takibi (bordro kapsam dışı).",
    features: ["Personel kartı", "İzin talebi", "Zimmet"],
    dependsOn: [],
    items: [
      { label: "Personel", href: "/kayit/personel" },
      { label: "İzinler", href: "/kayit/izin" },
      { label: "Zimmetler", href: "/kayit/zimmet" },
    ],
  },
  {
    key: "proje",
    name: "Görev & Proje Yönetimi",
    short: "Proje & Görev",
    group: "insan",
    tier: "standart",
    depth: "temel",
    icon: "kanban",
    description: "Departmanlar arası iş atama, görev durumları ve proje takibi.",
    features: ["Projeler", "Görevler", "Durum ve öncelik"],
    dependsOn: [],
    items: [
      { label: "Projeler", href: "/kayit/proje" },
      { label: "Görevler", href: "/kayit/gorev" },
    ],
  },
  // ---------------- Plus ----------------
  {
    key: "ai",
    name: "AI Belge Okuma & Akıllı Asistan",
    short: "AI Asistan",
    group: "plus",
    tier: "plus",
    depth: "vitrin",
    icon: "sparkles",
    description:
      "Fatura ve irsaliyeleri okuyup stok kartlarıyla eşleştirir; doğal dille rapor ve soru-cevap.",
    features: [
      "Gelen fatura satırlarını stok kartlarıyla otomatik eşleştirme",
      "PDF/fotoğraftan belge okuma",
      "Doğal dille rapor: \"Bu ay en çok satan 5 ürün?\"",
    ],
    dependsOn: [],
    items: [{ label: "AI Asistan", href: "/plus/ai" }],
  },
  {
    key: "edonusum",
    name: "e-Dönüşüm (e-Fatura / e-Arşiv / e-İrsaliye)",
    short: "e-Dönüşüm",
    group: "plus",
    tier: "plus",
    depth: "vitrin",
    icon: "file-check",
    description: "GİB uyumlu e-Fatura, e-Arşiv ve e-İrsaliye gönderimi; gelen e-faturaların alınması.",
    features: [
      "Özel entegratör API'si üzerinden gönderim",
      "Gelen e-faturalardan tek tıkla alış faturası",
      "Belge durum takibi",
    ],
    dependsOn: ["satis"],
    items: [
      { label: "Giden Belgeler", href: "/plus/e-donusum" },
      { label: "Gelen e-Faturalar", href: "/plus/e-donusum/gelen" },
    ],
  },
  {
    key: "b2b",
    name: "B2B Bayi & Müşteri Portalı",
    short: "B2B Portal",
    group: "plus",
    tier: "plus",
    depth: "vitrin",
    icon: "store",
    description: "Bayi ve müşterilerin kendi şifreleriyle girip ekstre gördüğü, sipariş verdiği portal.",
    features: ["Bayiye özel fiyat ve ekstre", "Portaldan sipariş", "Sipariş durumu takibi"],
    dependsOn: ["satis", "cari"],
    items: [{ label: "Portal Önizleme", href: "/plus/b2b" }],
  },
  {
    key: "eticaret",
    name: "E-Ticaret & Pazaryeri",
    short: "E-Ticaret",
    group: "plus",
    tier: "plus",
    depth: "vitrin",
    icon: "globe",
    description: "Trendyol, Hepsiburada, Shopify ve WooCommerce ile stok ve sipariş senkronu.",
    features: ["Stok senkronu", "Siparişleri otomatik çekme", "Fiyat güncelleme"],
    dependsOn: ["satis", "stok"],
    items: [{ label: "Bağlantılar", href: "/plus/e-ticaret" }],
  },
  {
    key: "otomasyon",
    name: "Olay Tabanlı Otomasyon",
    short: "Otomasyon",
    group: "plus",
    tier: "plus",
    depth: "vitrin",
    icon: "zap",
    description: "\"Stok kritik seviyeye düşünce bildir\" gibi şartlı kurallar ve tetikleyiciler.",
    features: ["Kritik stok bildirimi", "Vade hatırlatma", "Sipariş durum bildirimi"],
    dependsOn: [],
    items: [{ label: "Kurallar", href: "/plus/otomasyon" }],
  },
];

export const MODULE_MAP = Object.fromEntries(MODULES.map((m) => [m.key, m])) as Record<
  ModuleKey,
  ModuleDef
>;

export function isModuleKey(value: string): value is ModuleKey {
  return value in MODULE_MAP;
}

/** Hazır paketler. Super Admin bir paketi seçip üstüne modül ekleyip çıkarabilir. */
export const PLANS = {
  baslangic: {
    label: "Başlangıç",
    modules: ["cari", "kasa", "stok", "satis", "satinalma"] as ModuleKey[],
  },
  profesyonel: {
    label: "Profesyonel",
    modules: MODULES.filter((m) => m.tier === "standart").map((m) => m.key),
  },
  kurumsal: {
    label: "Kurumsal",
    modules: MODULES.map((m) => m.key),
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Bir modülü açmak için gereken modüller (zincirleme). */
export function requiredModules(key: ModuleKey, seen = new Set<ModuleKey>()): ModuleKey[] {
  for (const dep of MODULE_MAP[key].dependsOn) {
    if (!seen.has(dep)) {
      seen.add(dep);
      requiredModules(dep, seen);
    }
  }
  return [...seen];
}

/** Bu modül kapatılırsa etkilenecek (ona bağlı) açık modüller. */
export function dependentModules(key: ModuleKey, enabled: Iterable<ModuleKey>): ModuleKey[] {
  const enabledSet = new Set(enabled);
  return MODULES.filter(
    (m) => enabledSet.has(m.key) && m.key !== key && requiredModules(m.key).includes(key),
  ).map((m) => m.key);
}

/** URL yolundan modülü bulur (menü vurgusu ve yetki kontrolü için). */
export function moduleForPath(pathname: string): ModuleKey | null {
  let best: { key: ModuleKey; len: number } | null = null;
  for (const m of MODULES) {
    for (const item of m.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        if (!best || item.href.length > best.len) best = { key: m.key, len: item.href.length };
      }
    }
  }
  return best?.key ?? null;
}
