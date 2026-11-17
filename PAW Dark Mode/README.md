# PAW Dark Mode — IBM Planning Analytics Workspace Koyu Tema Eklentisi

IBM Planning Analytics Workspace (`https://koctasprod.planning-analytics.cloud.ibm.com/` ve tüm `*.planning-analytics.cloud.ibm.com` adresleri) için beyaz ekran parlaklığını ortadan kaldıran, göz yormayan **Manifest V3** Chrome / Microsoft Edge koyu tema eklentisidir.

---

## Özellikler

- **Sıfır Beyaz Parlama (Anti-FOUC):** Sayfa ve iç çerçeveler (`iframe`) yüklenmeye başlarken anında koyu arka plan uygular.
- **3 Farklı Koyu Tema Paleti:**
  - **Tam Siyah (OLED):** `#0a0a0a` saf siyah zemin ile maksimum göz konforu.
  - **IBM Carbon (G100):** `#161616` resmi IBM Carbon Design System koyu paleti.
  - **Gece Mavisi (Midnight):** `#0b0f17` düşük yansımalı koyu lacivert tonlar.
- **3 Farklı Çalışma Modu:**
  - **Akıllı Koyu Tema (Önerilen):** IBM Carbon (`--cds-*` / `--bx-*`) tokenlarını koyuya çevirir, Cube Viewer / Set Editor / Dimension / Monaco TI kod editörü arayüzlerini ve satır içi (`inline`) beyaz arka planları otomatik temizler (koşullu biçimlendirme renklerini korur).
  - **Hibrit (+Tablo / Canvas Ters Çevir):** Akıllı koyu temaya ek olarak `<canvas>` üzerinde çizilen beyaz grafik ve grid bileşenlerini de karartır.
  - **Tam Ters Çevirme (%100 Siyah Garanti):** Herhangi bir PAW güncellemesinde beyaz kalan özel bir bileşen olursa tüm arayüzü kesin olarak siyaha çevirir (görselleri ve logoları korur).
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

- Tarayıcı araç çubuğundaki **PAW Dark Mode** ikonuna tıklayarak palet, çalışma modu ve göz konforu ayarlarını sayfayı yenilemeden anlık değiştirebilirsiniz.
- Eğer küp tablolarında veya grafiklerde beyaz kalan bir alan görürseniz çalışma modunu **Hibrit** veya **Tam Ters Çevirme (%100 Siyah Garanti)** seçeneğine getirin.
- Uzun çalışma saatlerinde **Mavi Işık Filtresi (Sıcaklık)** ayarını `%15 - %25` aralığına çekmek göz yorgunluğunu daha da azaltır.

---

## Opsiyonel: PAW Yönetici (Admin) Yerleşik Kabuk Teması

Eğer Planning Analytics Workspace üzerinde **Administrator** yetkiniz varsa, eklentiye ek olarak üst ve yan menü kabuğunu sunucu tarafında da koyulaştırmak için `paw-admin-theme/paw-dark-theme.zip` paketini kullanabilirsiniz:

1. PAW içinde **Administration > Excel and Customizations > Themes** bölümüne gidin.
2. `paw-admin-theme/paw-dark-theme.zip` dosyasını yükleyin ve aktif tema olarak seçin.
