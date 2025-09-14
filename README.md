# Firebase Remote Config

Firebase Remote Config, uygulamalarınız için uzaktan yapılandırma ayarlarını yönetmenizi sağlayan bir npm paketidir. Bu paket, Firebase Remote Config servisi ile yerel yapılandırma dosyaları arasında senkronizasyon sağlar.

## Kurulum

Paketi kurmanın iki yolu vardır:

### 1. NPM ile Kurulum

```bash
npm install @cesurbagci/npm-firebase-remote-config --save
```

### 2. Doğrudan NPX ile Kurulum

Paketi önceden kurmadan doğrudan kullanabilirsiniz:

```bash
npx @cesurbagci/npm-firebase-remote-config setup
```

> Not: Bu yöntemle kurulum sırasında paketiniz yoksa otomatik olarak bağımlılıklara eklenecektir. Kurulum sırasında size npm install komutunu çalıştırmak isteyip istemediğiniz sorulacaktır.

## Başlangıç

Paketi kurduktan sonra, şu adımları izlemelisiniz:

1. Firebase konsolundan bir servis hesap anahtarı (serviceAccountKey.json) oluşturun
   - [Firebase Console](https://console.firebase.google.com/) adresine gidin
   - Projenizi seçin (veya yeni bir proje oluşturun)
   - Proje ayarlarına gidin (⚙️ simgesi)
   - "Service Accounts" sekmesini seçin
   - "Generate new private key" düğmesine tıklayın
   - İndirilen JSON dosyasını projenizin kök dizinine `serviceAccountKey.json` olarak kaydedin

2. Kurulum komutunu çalıştırın:

   ```bash
   npm run remote-config:setup
   ```

3. Kurulum sırasında, aşağıdaki bilgiler istenecektir:
   - Ana URL: Remote config'in kontrol edileceği endpoint URL'si (örn: `https://mydomain.com`)

## Kullanım

Kurulum tamamlandıktan sonra, aşağıdaki npm scriptleri otomatik olarak package.json dosyanıza eklenecektir:

```json
"scripts": {
  "remote-config:setup": "npm-firebase-remote-config setup",
  "remote-config:pull": "npm-firebase-remote-config pull",
  "remote-config:push": "npm-firebase-remote-config push",
  "remote-config:validate": "npm-firebase-remote-config validate",
  "remote-config:print": "npm-firebase-remote-config print-config",
  "remote-config:pull-meta": "npm-firebase-remote-config pull-meta",
  "remote-config:increase-version": "npm-firebase-remote-config increase-version",
  "remote-config:version": "npm-firebase-remote-config get-current-version-info"
}
```

### Komutlar

- `npm run remote-config:setup` - İlk kurulumu gerçekleştirir
- `npm run remote-config:pull` - Remote config'i yerel dosyalara çeker
- `npm run remote-config:push` - Yerel değişiklikleri remote config'e gönderir
- `npm run remote-config:validate` - Yerel config dosyalarının geçerliliğini kontrol eder
- `npm run remote-config:print` - Remote config'in tüm içeriğini konsola yazdırır
- `npm run remote-config:pull-meta` - Remote config meta verilerini çeker
- `npm run remote-config:increase-version` - Remote config versiyon numarasını artırır
- `npm run remote-config:version` - Güncel versiyon bilgilerini gösterir

## Dosya Yapısı

Kurulum tamamlandığında, projenizin kök dizininde aşağıdaki yapı oluşturulur:

```plaintext
configs/
  ├── conditions.json
  ├── eTag.json
  ├── version.json
  ├── parameters/
  │   └── remoteConfigInfo/
  │       ├── defaultValue.json
  │       └── valueType.txt
  └── parameterGroups/
      └── ...
```

## Firebase Remote Config Yapılandırması

Remote Config parametrelerini eklemek veya güncellemek için:

1. `configs/parameters/` dizini altında yeni bir klasör oluşturun (parametre adıyla)
2. Bu klasörün içinde:
   - `valueType.txt`: Parametrenin tipini içerir (string, json, boolean, number)
   - `defaultValue.json`: Parametrenin varsayılan değerini içerir
   - Koşullu değerler için: `[koşul adı].json` dosyası oluşturabilirsiniz

## Koşullar

Koşulları yapılandırmak için `configs/conditions.json` dosyasını düzenleyebilirsiniz.

## Örnek Kullanım

1. Remote config'i yerel ortamınıza çekin:

   ```bash
   npm run remote-config:pull
   ```

2. Yerel dosyaları düzenleyin (`configs/` dizini altında)

3. Değişiklikleri doğrulayın:

   ```bash
   npm run remote-config:validate
   ```

4. Değişiklikleri Firebase'e gönderin:

   ```bash
   npm run remote-config:push
   ```

## Sorun Giderme

- `serviceAccountKey.json` dosyasının projenizin kök dizininde olduğundan emin olun
- Firebase projenizde Remote Config API'nin etkinleştirildiğinden emin olun
- Servis hesabının (service account) yeterli izinlere sahip olduğundan emin olun

## Development

Bu bölüm, npm-firebase-remote-config paketini geliştirmek veya local olarak test etmek isteyenler için yazılmıştır.

### Local Linkli Geliştirme

Paketi local olarak linklemek ve geliştirme yapmak için:

1. Paket dizininde npm link komutunu çalıştırın:

   ```bash
   cd /path/to/npm-firebase-remote-config
   npm link
   ```

2. Kullanmak istediğiniz projede paket linkini oluşturun:

   ```bash
   cd /path/to/your/project
   npm link @cesurbagci/npm-firebase-remote-config
   ```

3. Local linkli geliştirme işlemini tamamladığınızda, global bağlantıyı kaldırmak için:

   ```bash
   npm unlink -g @cesurbagci/npm-firebase-remote-config
   ```

4. Projenizdeki link bağlantısını normal bağımlılık ile değiştirmek için:

   ```bash
   npm unlink @cesurbagci/npm-firebase-remote-config
   npm install @cesurbagci/npm-firebase-remote-config
   ```

### Registry'den Çekmeden Local Kullanım

Eğer geliştirdiğiniz paketi registry'den çekmeden doğrudan local dosyalardan kullanmak isterseniz:

```bash
# Local dosyalardan çalıştırır
npx --no-install npm-firebase-remote-config setup
```

Bu komut, global olarak veya node_modules içinde bulunan paketi kullanmak yerine, şu anda bulunduğunuz dizindeki kodu çalıştırır.

## Notlar

- Bu paket, Node.js ortamında çalışmaktadır ve sunucu tarafı uygulamaları içindir
- Firebase Remote Config'in mobil ve web uygulamalarında kullanımı için Firebase SDK'larını kullanmanız önerilir

