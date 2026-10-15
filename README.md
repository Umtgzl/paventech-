# Paventech ERP Plus — Prototip

KOBİ'ler ve üretim yapan işletmeler için çok şirketli (multi-tenant) bulut ERP.
Her şirket yalnızca satın aldığı modülleri görür; modüller Super Admin panelinden
tek tıkla açılıp kapanır.

Bu depo **tüm modülleri içeren çalışan prototiptir**. Çekirdek akış (cari, kasa,
stok, satış, satın alma, üretim) gerçek iş kurallarıyla çalışır. Diğer modüller ortak
kayıt motoruyla, Plus modüller örnek veriyle çalışan önizlemelerle gelir
(ayrıntı: [Modüller](#modüller)).

> Demo verisindeki tüm şirketler, kişiler ve rakamlar kurgusaldır.

## Uygulamayı açmak

### A) Tarayıcıda, hiçbir şey kurmadan (önerilen)

GitHub Codespaces, uygulamayı GitHub'ın bulut makinesinde çalıştırır. Bilgisayara bir şey
kurmak gerekmez; bilgisayar tarayıcısı yeterli (telefonda zahmetli olur).

[![GitHub Codespaces'te aç](https://github.com/codespaces/badge.svg)](https://codespaces.new/Umtgzl/paventech-)

1. Yukarıdaki düğmeye tıklayın ve açılan sayfada **Create codespace** deyin.
   Ya da depo sayfasında yeşil **Code** düğmesi → **Codespaces** sekmesi → **Create codespace on …**
2. Tarayıcıda bir kod editörü (VS Code) açılır. Alttaki terminalde kurulum adımları akar
   (`==> ...`). İlk açılış **3-5 dakika** sürer; terminali kapatmayın.
3. Kurulum bitince uygulama yeni bir sekmede kendiliğinden açılır. Açılmazsa:
   1. Alttaki **PORTS** sekmesine geçin.
   2. **Paventech ERP (3000)** satırında dünya simgesine (**Open in Browser**) tıklayın.
4. Giriş sayfasında **Demo hesapları** kutusundan birine tıklayın, sonra **Giriş yap**.

Bilinmesi gerekenler:
- **Kullanılmayan codespace durur.** 30 dakika boyunca kullanılmazsa durur; veriler kaybolmaz. Tekrar açmak için [github.com/codespaces](https://github.com/codespaces) sayfasında codespace'in adına tıklayın. Uygulama kendiliğinden yeniden başlar.
- **Ücretsiz kota.** Kişisel GitHub hesaplarında aylık ücretsiz kullanım kotası var. İşiniz bitince aynı sayfadan **Stop codespace** diyebilirsiniz.
- **Demo veriyi baştan yüklemek** için terminalde `pnpm db:reset` çalıştırın.
- **Kod değiştirip anında görmek** için terminalde önce `pkill -f next-server` ile arka plandaki demo sunucusunu durdurun, sonra `pnpm dev` çalıştırın.

### B) Kendi bilgisayarında

Gereksinimler: Node.js 22+, pnpm 10+, Docker (veya yerel PostgreSQL 16).

```bash
cp .env.example .env
# .env içinde BETTER_AUTH_SECRET'ı doldurun:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

docker compose up -d     # PostgreSQL 16 (geliştirme + test veritabanı)
pnpm install
pnpm db:reset            # tabloları kurar ve demo veriyi yükler (~10 sn)
pnpm dev                 # http://localhost:3000
```

### Demo hesapları

Şifre hepsinde: `demo1234`

| E-posta | Rol | Ne görür |
| --- | --- | --- |
| `demo@paventech.local` | Şirket sahibi | İki şirket: **Demo Mobilya ve Yatak** (Kurumsal paket, 18 modül) ve **Demo Gıda Toptan** (Başlangıç paketi, 5 modül). Üst çubuktan şirket değiştirilir. |
| `muhasebe@paventech.local` | Kullanıcı | Demo Mobilya ve Yatak |
| `admin@paventech.local` | Super Admin | Tüm şirketler, paketler, modül anahtarları, kullanıcı ekleme |

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `pnpm dev` | Geliştirme sunucusu |
| `pnpm build` / `pnpm start` | Üretim derlemesi / çalıştırma |
| `pnpm test` | Birim ve entegrasyon testleri (`TEST_DATABASE_URL` veritabanını sıfırlar) |
| `pnpm typecheck` | Rota tiplerini üretir ve TypeScript kontrolü yapar |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Şema değişikliğinden göç (migration) dosyası üretir |
| `pnpm db:migrate` | Göçleri uygular |
| `pnpm db:seed` | Demo veriyi yükler |
| `pnpm db:reset` | Geliştirme veritabanını silip baştan kurar ve demo veriyi yükler |

## Modüller

**Prototip derinliği:**
- **Çekirdek:** gerçek iş kuralları (onay, iptal, hareket defteri) ve testleri var.
- **Temel:** ortak motorla kayıt/liste/form/pano; iş kuralları sonra derinleşecek.
- **Vitrin:** örnek veriyle çalışan önizleme; dış entegrasyon sonra bağlanacak.

| Modül | Tür | Prototip | İlk paket | Bağımlı olduğu |
| --- | --- | --- | --- | --- |
| Cari Hesaplar | Standart | Çekirdek | Başlangıç | — |
| Kasa & Banka | Standart | Çekirdek | Başlangıç | Cari Hesaplar |
| Masraflar | Standart | Çekirdek | Profesyonel | Kasa & Banka |
| Stok | Standart | Çekirdek | Başlangıç | — |
| Satış | Standart | Çekirdek | Başlangıç | Cari Hesaplar, Stok |
| Satın Alma | Standart | Çekirdek | Başlangıç | Cari Hesaplar, Stok |
| Üretim | Standart | Çekirdek | Profesyonel | Stok |
| Maliyet | Standart | Temel | Profesyonel | Üretim |
| Kalite | Standart | Temel | Profesyonel | — |
| Demirbaş & Bakım | Standart | Temel | Profesyonel | — |
| CRM | Standart | Temel | Profesyonel | — |
| İnsan Kaynakları | Standart | Temel | Profesyonel | — |
| Proje & Görev | Standart | Temel | Profesyonel | — |
| AI Asistan | Plus | Vitrin | Kurumsal | — |
| e-Dönüşüm | Plus | Vitrin | Kurumsal | Satış |
| B2B Portal | Plus | Vitrin | Kurumsal | Satış, Cari Hesaplar |
| E-Ticaret | Plus | Vitrin | Kurumsal | Satış, Stok |
| Otomasyon | Plus | Vitrin | Kurumsal | — |

Çekirdekte çalışan kurallardan bazıları:
- **Belge akışı:** teklif → sipariş → irsaliye → fatura. Stok yalnızca bir kez düşer, vade carinin vade gününden gelir.
- **Numaralama:** belge onaylanınca GİB biçiminde, boşluksuz numara alır (ör. `SFT2026000000001`). Onaylı belge değiştirilemez; iptal ters kayıt atar, numara korunur.
- **Maliyet:** alış maliyeti iskontolu net fiyattan, stok değeri hareketli ağırlıklı ortalamayla hesaplanır. Üretim, reçetedeki hammaddeyi fireyle düşer ve mamulü gerçekleşen maliyetle stoğa alır.
- **Cari takibi:** ekstre yürüyen bakiyeyle gelir, vadesi geçen tutar FIFO ile hesaplanır.
- **Kasa & Banka:** kasa eksiye düşemez; virmanla hesaplar arası para aktarılır.
- **Otomasyon:** kritik stok kuralı stok kritik seviyeye inince bildirim üretir.

## 5 dakikalık demo akışı

`demo@paventech.local` ile girin (Demo Mobilya ve Yatak):

1. **Ana Panel:** bu ayın satışı ve tahsilatı, açık ve vadesi geçen alacak, kasa, 6 aylık satış/alış grafiği, kritik stoklar.
2. **Satış → Faturalar → Yeni:** müşteri ve ürün seçip faturayı onaylayın. Belge detayında oluşan stok, cari ve kasa hareketlerini gösterin; "Yazdır / PDF" ile çıktısını açın.
3. **Cari Hesaplar → bir müşteri:** ekstre, yürüyen bakiye ve vadesi geçen tutar.
4. **Stok → Stok Durumu:** miktar, ortalama maliyet, kritik ürünler.
5. **Üretim → İş Emirleri:** reçete, malzeme ihtiyacı ve gerçekleşen birim maliyet.
6. **Plus → e-Dönüşüm → Gelen e-Faturalar:** tedarikçinin kendi ürün adları stok kartlarıyla otomatik eşleşir; tek tıkla alış faturası taslağı oluşur.
7. **Plus → AI Asistan:** "Vadesi geçen alacaklar kimlerde?" sorusunun cevabı tablo olarak gelir.
8. **Super Admin** (`admin@paventech.local`): Demo Gıda Toptan'da bir modülü açın; menüde anında belirir.

## Proje yapısı

```
src/
  app/            Sayfalar (Next.js App Router). (app)/ giriş yapılmış uygulama,
                  super-admin/, giris/, yazdir/ (çıktı), api/ (auth, CSV dışa aktarım)
  components/     Arayüz bileşenleri (ui/ temel parçalar, documents/, entity/, plus/ ...)
  lib/            Sunucu ve istemcide ortak kod: modül kataloğu, belge türleri,
                  para hesapları, varlık (entity) tanımları, eşleştirme
  server/         Yalnızca sunucu: veritabanı şeması, belge motoru, hareket defteri,
                  oturum ve yetki, Server Action'lar, demo veri
tests/            Entegrasyon testleri (gerçek PostgreSQL ile)
drizzle/          Veritabanı göçleri (elle değiştirilmez, pnpm db:generate üretir)
.devcontainer/    GitHub Codespaces ortamı: Node 22 + PostgreSQL 16, ilk kurulum ve başlatma
docs/KARARLAR.md  Mimari ve ürün kararları
```

Geliştirme kuralları ve mimari ayrıntılar için [CLAUDE.md](CLAUDE.md), alınan kararlar ve
gerekçeleri için [docs/KARARLAR.md](docs/KARARLAR.md).

## Bilinen sınırlar (prototip)

- e-Fatura / e-Arşiv / e-İrsaliye gönderimi simüle edilir; özel entegratör bağlantısı yok.
- AI Asistan soruları tanımlı raporlara anahtar kelimeyle eşler; dil modeli bağlı değil.
- Pazaryeri bağlantıları ve bildirim (e-posta/SMS/WhatsApp) sağlayıcıları bağlı değil.
- Ön muhasebe seviyesindedir: yevmiye/muavin, KDV beyannamesi ve resmi defterler yok.
- Para birimi alanı var, ancak kur farkı ve dövizli raporlama yok.
- Şirket verisi uygulama katmanında ayrılır; PostgreSQL Row Level Security pilot öncesi açılacak.
- Rol/yetki seviyesi: şirket sahibi, yönetici, kullanıcı. Ayrıntılı yetki matrisi yok.
