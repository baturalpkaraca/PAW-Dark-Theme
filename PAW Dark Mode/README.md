# PAW Dark Mode — IBM Planning Analytics Workspace Koyu Tema Eklentisi

IBM Planning Analytics Workspace (`https://koctasprod.planning-analytics.cloud.ibm.com/` ve tüm `*.planning-analytics.cloud.ibm.com` adresleri) için beyaz ekran parlaklığını ortadan kaldıran, göz yormayan **Manifest V3** Chrome / Microsoft Edge koyu tema eklentisidir.

---

## Özellikler

- **Sıfır Beyaz Parlama (Anti-FOUC):** Sayfa ve iç çerçeveler (`iframe`) yüklenmeye başlarken anında koyu arka plan uygular.
- **IBM Carbon G100 Koyu Paleti:** `#161616` zemin, yumuşatılmış `#e8e8e8` metin ile uzun çalışma saatlerinde maksimum göz konforu.
- **Akıllı Koyu Tema + Yerel Carbon G100 & `<canvas>` Motoru:** PAW'ın yerleşik Carbon G100 tasarım tokenlarını (`--cds-*` / `--bx-*`) etkinleştirir; Küp / Boyut HTML5 `<canvas>` tablolarını yerel olarak yeniden boyar; Cube Viewer, Set Editor, Dimension / Attribute, CodeMirror 6 TI Script / Cube Rules ve dinamik stiller dahil tüm açık zeminleri otomatik koyulaştırır (koşullu biçimlendirme ve orijinal yerleşim ölçülerini korur).
- **Göz Konforu Ayarları:** Parlaklık (`%70 - %110`), Kontrast (`%80 - %120`) ve Mavi Işık Filtresi (`%0 - %40`) sürgüleri ile anlık ince ayar.
- **Özel Adres Desteği:** Eklenti penceresindeki **"Mevcut Sekmeye Uygula"** butonu ile farklı bir kurum içi PAW adresinde bile tek tıkla aktif edilebilir.

---

## Kurulum (Google Chrome & Microsoft Edge)

1. Tarayıcınızda uzantılar sayfasını açın:
   - **Google Chrome:** Adres çubuğuna `chrome://extensions` yazıp `Enter` tuşuna basın.
   - **Microsoft Edge:** Adres çubuğuna `edge://extensions` yazıp `Enter` tuşuna basın.
2. Sağ üstten (Edge'de sol alttan) **Geliştirici modu (Developer mode)** anahtarını **Açık** konuma getirin.
3. **Paketlenmemiş öğe yükle (Load unpacked)** butonuna tıklayın.
4. Bu klasörü (`PAW Dark Mode`) seçin ve onaylayın.
5. `https://koctasprod.planning-analytics.cloud.ibm.com/` sayfasını açın veya yenileyin — koyu tema otomatik aktif olacaktır.

---

## Kullanım İpuçları

- Tarayıcı araç çubuğundaki **PAW Dark Mode** ikonuna tıklayarak palet ve göz konforu ayarlarını sayfayı yenilemeden anlık değiştirebilirsiniz.
- Uzun çalışma saatlerinde **Mavi Işık Filtresi (Sıcaklık)** ayarını `%15 - %25` aralığına çekmek göz yorgunluğunu daha da azaltır.

---

## Opsiyonel: PAW Yönetici (Admin) Yerleşik Kabuk Teması

Eğer Planning Analytics Workspace üzerinde **Administrator** yetkiniz varsa, eklentiye ek olarak üst ve yan menü kabuğunu sunucu tarafında da koyulaştırmak için `paw-admin-theme/paw-dark-theme.zip` paketini kullanabilirsiniz:

1. PAW içinde **Administration > Excel and Customizations > Themes** bölümüne gidin.
2. `paw-admin-theme/paw-dark-theme.zip` dosyasını yükleyin ve aktif tema olarak seçin.
