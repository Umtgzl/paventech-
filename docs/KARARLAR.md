# Karar günlüğü

Her karar için: ne seçildi, neden, bedeli ne ve ne zaman yeniden bakılır.
Yeni karar en alta eklenir; eski karar değişirse silinmez, "Değişti" notuyla güncellenir.

---

## K1 — Önce tüm modülleri içeren prototip

**Tarih:** 2026-10-15

**Karar.** Tek bir müşteriye özel geliştirme yerine önce 18 modülün hepsini içeren, çalışan bir prototip çıkarılır.
- Çekirdek akış (cari, kasa, stok, satış, satın alma, üretim) gerçek iş kurallarıyla yazılır.
- Diğer standart modüller ortak motorla, Plus modüller vitrin olarak gelir.

**Neden.**
- Yatırımcı ve ilk müşteriler ürünün tamamını görmek istiyor.
- Yatırım şartı ödeme yapmış ve kurulumu yapılmış 2 müşteri; ürün ortada olmadan satış konuşması zor.
- Prototip "sahte ekran" değil gerçek iskelet üzerine kurulursa geliştirme sıfırdan başlamaz, aynı kod derinleşir.

**Bedeli.** Temel ve vitrin modüller sığ. Müşteri sahada bunları derinlemesine kullanmaya kalkarsa eksik görür.

**Yeniden bakılacağı an.** İlk iki müşterinin ihtiyaç listesi netleşince hangi temel modüllerin çekirdeğe çıkacağına karar verilir.

## K2 — Teknoloji: Next.js 16 + TypeScript + PostgreSQL + Drizzle + Better Auth

**Karar.**
- Yönetilen bir arka uç platformuna (ör. Supabase) bağlanmak yerine standart PostgreSQL kullanılır.
- Veritabanı erişimi Drizzle ORM ile yapılır.
- Kimlik doğrulama uygulamanın içinde, Better Auth ile yapılır.

**Neden.**
- **Taşınabilirlik.** Uygulama herhangi bir sunucuda, Türkiye'deki bir veri merkezinde ya da müşterinin kendi sunucusunda çalışabilir (bkz. K10). Tek bir sağlayıcının bölge, fiyat ve kota kararlarına bağlı kalınmaz.
- **Tek dil, tek depo.** Arayüz, sunucu kodu ve veritabanı şeması TypeScript'te; küçük ekip için bakımı en ucuz yapı.
- **Kurumsal temeller hazır.** Better Auth'un organization eklentisi şirket, üye ve davet yapısını, admin eklentisi Super Admin rolünü veriyor.

**Bedeli.**
- Yedekleme, izleme ve ölçekleme işi bize kalır; yönetilen platform bunları hazır verirdi.
- Gerçek zamanlı abonelik gibi hazır özellikler yok; ihtiyaç olursa ayrıca kurulur.

## K3 — Çok kiracılık: tek veritabanı, her tabloda `tenant_id`

**Karar.**
- Bütün şirketler aynı veritabanında tutulur ve her iş tablosunda `tenant_id` bulunur.
- Şirket ayrımı şimdilik uygulama katmanında yapılır: her sorgu `ctx.tenantId` ile filtrelenir, yazmalar `tenantTx` içinde yapılır.
- Şirket, Better Auth'taki "organization" kaydıdır.

**Neden.**
- Şirket başına ayrı veritabanı yüzlerce KOBİ'de göç ve yedekleme işini katlar.
- Tek şema ile her yeni özellik herkese aynı anda gider.

**Bedeli ve yol haritası.**
- Sorguda filtreyi unutmak veri sızıntısıdır.
- **Pilot öncesi PostgreSQL Row Level Security açılacak.** `tenantTx` transaction başında `set_config('app.tenant_id', ...)` çağıracak, her tabloya `tenant_id = current_setting('app.tenant_id')` politikası yazılacak.
- Böylece uygulamadaki filtre ikinci emniyet kemeri olur.
- Entegrasyon testlerinde şirketler arası izolasyon testi zaten var; RLS ile birlikte genişletilecek.

## K4 — Hareket defteri (ledger) modeli

**Karar.** Belgeler (taslak → onay → iptal) değişmez hareketler üretir:
- stok, cari ve kasa hareketleri;
- bakiye ve stok miktarının bu hareketlerin toplamı olarak hesaplanması (ayrı bakiye kolonu tutulmaz);
- onaylı belgenin değiştirilememesi;
- iptalin hareketleri silmek yerine ters kayıt atması (belge numarası korunur).

**Neden.**
- Muhasebeci ve mali müşavirin beklediği denetlenebilirlik budur: "bu bakiye nereden geldi" sorusunun cevabı her zaman hareket listesidir.
- Bakiye kolonu ile hareketlerin birbirinden kayması imkânsız olur.

**Bedeli.**
- Büyük şirketlerde bakiye sorgusu pahalılaşabilir.
- Gerekirse dönem sonu "açılış bakiyesi" özetleri ya da materialized view eklenir. Hareketlerin kendisi değişmez.

## K5 — Belge numarası onayda, boşluksuz, GİB biçiminde

**Karar.**
- Numara taslakta değil onay anında verilir.
- Numara yıl bazında bir seriden alınır ve biçimi `ÖNEK + YIL + 9 hane`dir (ör. `SFT2026000000001`, 16 karakter).
- Seri satırı upsert ile kilitlenir.

**Neden.**
- Silinen taslaklar seride boşluk bırakmaz.
- Eşzamanlı onaylarda bile numara tekildir.
- e-Fatura numara biçimiyle uyumludur; e-Dönüşüm bağlandığında dönüştürme gerekmez.

## K6 — Maliyet ve para hesapları

**Karar.**
- **Stok maliyeti:**
  - Hareketli ağırlıklı ortalama kullanılır.
  - Tedarikçiden gelen malın maliyeti iskontolu net fiyattır.
  - Üretimde mamul maliyeti, tüketilen hammaddelerin gerçek ortalama maliyetidir (fire dahil).
- **Vadesi geçen alacak:** FIFO ile hesaplanır; tahsilat en eski borcu kapatır.
- **Para hesapları:** decimal.js ile yapılır.
  - Yuvarlama satır bazında, ROUND_HALF_UP.
  - Veritabanında tutar `numeric(18,2)`, miktar ve birim fiyat `numeric(18,4)`.

**Neden.**
- Ağırlıklı ortalama yaygın kullanılan bir yöntemdir ve hesabı müşteriye kolay açıklanır.
- Float hatası olan bir fatura toplamı güveni bir kerede bitirir.

**Yeniden bakılacağı an.** FIFO/LIFO stok maliyeti isteyen müşteri çıkarsa yöntem şirket ayarı olur.

## K7 — Kasa eksiye düşemez, banka düşebilir; hesaplar arası virman

**Karar.**
- Kasa türündeki hesaptan, bakiyeyi aşan çıkış onaylanmaz.
- Kasaya giren parayı geri alan iptal de (ör. tahsilat iptali) bakiyeyi aşıyorsa yapılamaz.
- Banka ve POS hesaplarında bu kontrol yoktur (KMH, bloke).
- Kontrol sırasında hesap satırı kilitlenir; eşzamanlı iki çıkış birbirini görmeden geçemez.
- Kasa, banka ve POS arasında para "virman" belgesiyle aktarılır: bankaya para yatırma, bankadan nakit çekme, POS blokesinin bankaya geçmesi.

**Neden.** Fiziki kasa eksiye düşemez. Eksi kasa ya kayıt hatasıdır ya kayıt dışı paradır; ikisini de kullanıcıya hemen göstermek gerekir.

## K8 — Modül derinlik seviyeleri

**Karar.** Her modülün prototipteki derinliği katalogda açıkça yazar (`depth`). Super Admin'de ve ekranlarda görünür.

| Seviye | Anlamı | Modüller |
| --- | --- | --- |
| Çekirdek | Gerçek iş kuralları ve testleri var | Cari, Kasa & Banka, Masraflar, Stok, Satış, Satın Alma, Üretim |
| Temel | Ortak motorla kayıt, liste, form, pano | Maliyet, Kalite, Demirbaş & Bakım, CRM, İK, Proje & Görev |
| Vitrin | Gerçek veriyle önizleme, dış bağlantı yok | AI Asistan, e-Dönüşüm, B2B Portal, E-Ticaret, Otomasyon |

**Neden.** Müşteriye ya da yatırımcıya ne gösterildiği konusunda dürüst olmak. Vitrin ekranların hepsinde "Prototip notu" var.

## K9 — Plus modüllerin canlı sürüm yaklaşımı

**e-Dönüşüm.**
- Belgeler UBL-TR olarak üretilip **bir özel entegratörün API'si** üzerinden GİB'e iletilecek.
- Kendimiz özel entegratör olmayacağız: bu GİB izni ve ciddi teknik ve mali şartlar ister, ilk müşteriler için gereksiz yük.
- Entegratör seçimi fiyat, API kalitesi ve test ortamına göre yapılacak.

**AI.**
- Dil modeli soruyu yorumlayacak, ama yalnızca tanımlı rapor fonksiyonlarını çağırabilecek. Ham SQL yazmayacak ve şirket filtresi her zaman sunucuda uygulanacak.
- Gelen e-fatura satırı eşleştirmede önce açıklanabilir benzerlik algoritması ve öğrenilmiş eşleşmeler kullanılır; dil modeline yalnızca düşük güvenli satırlar sorulur.

**E-Ticaret.**
- Pazaryerlerinin resmi API'leri kullanılacak.
- Ürünler barkodla eşleşecek.
- Kanala gönderilen miktar = stok − açık siparişler − emniyet payı.

**Otomasyon.**
- Olay → şart → aksiyon kuralları.
- Prototipte yalnızca kritik stok kuralı çalışır; e-posta, SMS ve WhatsApp sağlayıcıları sonra bağlanacak.

## K10 — "Veriler Türkiye'de kalsın" seçeneği

**Karar.** Ürün, Türkiye'de barındırma seçeneğiyle konumlanabilir. Yığın taşınabilir olduğu için (K2) bu tercihin geliştirmeye ek bedeli yok; karar canlıya geçişte barındırma seçimiyle verilir.

**Neden.** KVKK hassasiyeti olan ve yerli çözüm tercih eden üreticiler için satış argümanı.

**Bedeli.** Yurt içi barındırma, büyük bulut sağlayıcılara göre bazı hazır servislerden (yönetilen yedek, bölgeler arası çoğaltma) vazgeçmek demek olabilir; sağlayıcı seçerken kontrol edilecek.

## K11 — Next.js Cache Components kalıpları

**Karar.**
- `cacheComponents` ve `partialPrefetching` açık.
- Sayfaların statik iskeleti önceden çizilir. Oturum ve veritabanı okuyan kısım `<Suspense>` içinde akar.
- Her sayfa `suspensePage(...)` yardımcısıyla yazılır.
- Yetki yönlendirmesi `src/proxy.ts`'te yapılır.
- Yazma sonrası ekranı yenilemek için Server Action içinden `refresh()` çağrılır.

**Neden.** Menü ve başlık anında gelir, veri akarak dolar; ERP'de sayfalar arası geçiş hızlı hissettirir.

**Bedeli.** Suspense dışında çalışma anı verisi okumak derleme hatası verir; yeni sayfa yazarken kalıba uymak gerekir.

## K12 — Arayüz

**Karar.**
- shadcn tarzı bileşenler radix-ui üzerinde **elle** yazıldı; kurulum ortamında bileşen kayıt sunucusuna erişim yoktu.
- Türkçe öncelikli: tarih, para ve sayı biçimleri `tr-TR`, saat dilimi Europe/Istanbul.
- Tutar kolonları sağa hizalı, tabular rakamlarla.
- Grafik paleti renk körlüğü testinden geçmiş sabit sırayla kullanılır.

---

## Sıradaki adımlar (öncelik sırasıyla öneri)

1. **Excel/CSV'den veri aktarımı:** cari kartları, stok kartları, açılış bakiyeleri. Her yeni müşterinin ilk günü budur.
2. **Row Level Security** (K3) ve şirketler arası izolasyon testlerinin genişletilmesi.
3. **Rol ve yetki matrisi:** örneğin muhasebe kullanıcısı fatura iptal edemesin, depo kullanıcısı fiyat görmesin.
4. **e-Dönüşüm:** özel entegratör seçimi, test ortamında e-Fatura ve e-Arşiv gönderimi.
5. **Muhasebe aktarımı:** mali müşavirin kullandığı programa yevmiye/fiş aktarımı.
6. **Canlı ortam:** barındırma (K10), otomatik yedek, hata izleme, KVKK aydınlatma metni ve sözleşmeler.
