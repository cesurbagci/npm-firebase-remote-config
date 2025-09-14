#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Command } = require('commander');

// FirebaseRemoteConfig kütüphanesini import et
const firebaseRemoteConfigLib = require('./lib/firebaseRemoteConfigLib');
const utils = require('./lib/utils');

// Ana program
const program = new Command();

// Program bilgilerini tanımla
program
  .name('@cesurbagci/npm-firebase-remote-config')
  .description('Firebase Remote Config yönetimi için CLI araçları')
  .version('1.3.0');

// Readline arayüzünü fonksiyon içinde oluşturacağız, bu sayede erken kapanmayı önleyeceğiz
let rl;

// Kullanıcıdan input almak için fonksiyon
async function promptUser(question) {
  // Eğer readline arayüzü henüz oluşturulmadıysa, oluştur
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// ServiceAccountKey'den project_id'yi al
function getProjectIdFromServiceAccount(projectRoot) {
  try {
    // userProjectRoot parametresini kullan (init fonksiyonundan geçirilecek)
    const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');
    // Dosyanın var olup olmadığını kontrol etmiyoruz çünkü init() fonksiyonunda zaten kontrol ediliyor
    
    // require yerine fs.readFileSync kullanarak dosyayı oku ve JSON.parse ile ayrıştır
    const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountData);

    if (!serviceAccount.project_id || serviceAccount.project_id === '{project_id}' || serviceAccount.project_id === '') {
      console.warn('⚠️ Uyarı: serviceAccountKey.json dosyasında geçerli bir project_id bulunamadı!');
      return null;
    }
    
    return serviceAccount.project_id;
  } catch (error) {
    console.warn('⚠️ Uyarı: serviceAccountKey.json dosyası okunurken hata oluştu:', error.message);
    return null;
  }
}

async function setup() {
  try {
    console.log('Firebase Remote Config Uygulama Kurulum İşlemi Başlatılıyor...');
    
    // npm explore ile çalıştırıldığında INIT_CWD çevresel değişkeni kullanıcının proje dizinidir
    // Eğer doğrudan çalıştırılıyorsa, mevcut çalışma dizinini kullan
    const userProjectRoot = process.env.INIT_CWD || process.cwd();
    console.log(`Çalışma dizini: ${userProjectRoot}`);
    
    // serviceAccountKey.json dosyasının kullanıcının proje kök dizininde varlığını kontrol et
    const serviceAccountPath = path.join(userProjectRoot, 'serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('\n❌ HATA: Projenizin kök dizininde serviceAccountKey.json dosyası bulunamadı!');
      console.error('\nFirebase Remote Config kullanabilmek için bir serviceAccountKey.json dosyasına ihtiyacınız var.');
      console.error('\nServiceAccountKey.json dosyasını oluşturmak için:');
      console.error('1. Firebase konsoluna gidin: https://console.firebase.google.com/');
      console.error('2. Projenizi seçin (veya yeni bir proje oluşturun)');
      console.error('3. Proje ayarlarına gidin (⚙️ simgesi)');
      console.error('4. "Service Accounts" sekmesini seçin');
      console.error('5. "Generate new private key" düğmesine tıklayın');
      console.error('6. İndirilen JSON dosyasını projenizin kök dizinine "serviceAccountKey.json" olarak kaydedin');
      console.error('\nBu işlemi tamamladıktan sonra, npm run init komutunu tekrar çalıştırın.\n');
      process.exit(1);
    }
    
    console.log('✅ serviceAccountKey.json dosyası bulundu.');
    
    // serviceAccountKey.json dosyasını oku
    let serviceAccount;
    try {
      const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(serviceAccountData);
    } catch (error) {
      console.error(`❌ HATA: serviceAccountKey.json dosyası geçerli bir JSON değil: ${error.message}`);
      process.exit(1);
    }
    
    // Firebase ile bağlantı kurabildiğini doğrula
    console.log('Firebase bağlantısı test ediliyor...');
    const validationResult = await firebaseRemoteConfigLib.validateServiceAccount(serviceAccount);
    
    if (!validationResult.success) {
      console.error(`❌ HATA: serviceAccountKey.json dosyası geçerli değil veya Firebase ile bağlantı kurulamadı.`);
      console.error(`Hata detayı: ${validationResult.error}`);
      console.error(`Lütfen Firebase konsolundan yeni bir service account key indirin ve tekrar deneyin.`);
      process.exit(1);
    }
    
    console.log('✅ Firebase bağlantısı başarılı! serviceAccountKey.json dosyası geçerli.');
    
    // serviceAccountKey.json'dan project_id'yi al
    const projectId = getProjectIdFromServiceAccount(userProjectRoot);
    
    // Ana URL'yi kullanıcıdan al
    const baseUrl = await promptUser(`Ana URL adresini girin (örn: https://mydomain.com): `);
    
    if (!baseUrl || baseUrl.trim() === '') {
      console.warn('⚠️ Uyarı: Ana URL girilmedi! remoteConfigInfo/defaultValue.json dosyasına URL eklenmeyecek. Bu işlemi daha sonra manuel yapabilirsiniz.');
    }

    // Eğer serviceAccountKey.json'dan project_id okunamazsa, kullanıcıdan app adını iste
    let appName;
    if (!projectId) {
      appName = await promptUser('serviceAccountKey.json dosyasından project_id okunamadı. Uygulama adını manuel girin: ');
      if (!appName || appName.trim() === '') {
        console.error('Uygulama adı boş olamaz!');
        process.exit(1);
      }
    } else {
      appName = projectId;
      console.log(`serviceAccountKey.json dosyasından project_id okundu: ${appName}`);
    }
    
    // URL'yi birleştir, sondaki slash'ı kontrol et
    const baseUrlCleaned = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const versionCheckUrlText = (baseUrlCleaned && baseUrlCleaned.trim() !== '') ? `${baseUrlCleaned}/remoteconfigs/${appName}` : '';
    if (versionCheckUrlText === '') {
      console.warn('⚠️ Uyarı: versionCheckUrlText boş olacak çünkü ana URL girilmedi. Bu işlemi daha sonra manuel yapabilirsiniz. https://<your-domain>/remoteconfigs/<app-name> formatında olmalı.');
    }
    
    // Kullanıcının proje kök dizini üzerinden dizin yollarını oluştur
    // Not: userProjectRoot zaten yukarıda tanımlandı, tekrar tanımlamıyoruz
    const configsDir = path.join(userProjectRoot, 'configs');
    const parameterGroupsDir = path.join(configsDir, 'parameterGroups');
    const parametersDir = path.join(configsDir, 'parameters');
    const remoteConfigInfoDir = path.join(parametersDir, 'remoteConfigInfo');
    
    // Dizinleri oluştur
    console.log('Dizinler oluşturuluyor...');
    
    [configsDir, parameterGroupsDir, parametersDir, remoteConfigInfoDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`${dir} dizini oluşturuldu.`);
      } else {
        console.log(`${dir} dizini zaten mevcut.`);
      }
    });
    
    // conditions.json dosyasını oluştur (eğer yoksa)
    const conditionsPath = path.join(configsDir, 'conditions.json');
    if (!fs.existsSync(conditionsPath)) {
      const conditionsContent = [
        {
          "name": "development",
          "expression": "app.userProperty['appEnv'].exactlyMatches(['test'])",
          "tagColor": "GREEN"
        }
      ];
      
      fs.writeFileSync(
        conditionsPath,
        JSON.stringify(conditionsContent, null, 4),
        'utf8'
      );
      
      console.log(`${conditionsPath} dosyası oluşturuldu.`);
    } else {
      console.log(`${conditionsPath} dosyası zaten mevcut, değişiklik yapılmadı.`);
    }
    
    const defaultValuePath = path.join(remoteConfigInfoDir, 'defaultValue.json');
    
    // defaultValue.json dosyasının var olup olmadığını kontrol et
    if (fs.existsSync(defaultValuePath)) {
      try {
        // Mevcut dosyayı oku
        const existingContent = JSON.parse(fs.readFileSync(defaultValuePath, 'utf8'));
        const oldUrl = existingContent.versionCheckUrlText;
        
        if (oldUrl.trim() !== '' && (oldUrl === versionCheckUrlText || !baseUrl || baseUrl.trim() === '')) {
          console.log('URL zaten güncel, değişiklik yapılmadı.');
        } else {
          // Değiştirmeden önce kullanıcıya sor
          const answer = await promptUser(`Mevcut URL değiştirilecek:\nEski: ${oldUrl}\nYeni: ${versionCheckUrlText}\n\nDevam etmek istiyor musunuz? (y/n): `);

          if (answer.toLowerCase() === 'y') {
            existingContent.versionCheckUrlText = versionCheckUrlText;
            
            fs.writeFileSync(
              defaultValuePath, 
              JSON.stringify(existingContent, null, 4),
              'utf8'
            );
            
            console.log('URL başarıyla güncellendi:');
            console.log(`Eski: ${oldUrl}`);
            console.log(`Yeni: ${versionCheckUrlText}`);
          } else {
            console.log('İşlem iptal edildi, dosya değiştirilmedi.');
          }
        }
      } catch (error) {
        console.error('Mevcut defaultValue.json dosyası işlenirken hata oluştu:', error);
      }
    } else {
      // defaultValue.json yoksa, yeni oluştur
      const defaultValueContent = {
        versionNumber: 1,
        versionCheckUrlText: versionCheckUrlText,
        versionCheckHttpMethod: "POST"
      };
      
      fs.writeFileSync(
        defaultValuePath, 
        JSON.stringify(defaultValueContent, null, 4),
        'utf8'
      );
      
      console.log(`${defaultValuePath} dosyası oluşturuldu.`);
      
      // valueType.txt dosyasını oluştur
      const valueTypePath = path.join(remoteConfigInfoDir, 'valueType.txt');
      fs.writeFileSync(valueTypePath, 'json', 'utf8');
      console.log(`${valueTypePath} dosyası oluşturuldu.`);
    }
    
    // Örnek dosyaları kullanıcının projesine kopyala
    console.log('Örnek dosyalar kopyalanıyor...');
    
    // GitHub workflow dosyasını kullanıcının .github/workflows dizinine kopyala
    const workflowSource = path.join(__dirname, 'resources', 'remoteConfigInfoAddToCloudflareRepo.yml');
    const workflowsDir = path.join(userProjectRoot, '.github', 'workflows');
    const workflowDest = path.join(workflowsDir, 'remoteConfigInfoAddToCloudflareRepo.yml');
    
    try {
      if (fs.existsSync(workflowSource)) {
        // .github/workflows dizinini oluştur (yoksa)
        if (!fs.existsSync(workflowsDir)) {
          fs.mkdirSync(workflowsDir, { recursive: true });
        }
        
        fs.copyFileSync(workflowSource, workflowDest);
        console.log(`✅ GitHub workflow dosyası .github/workflows dizinine kopyalandı.`);
      } else {
        console.warn(`⚠️ Uyarı: Kaynak workflow dosyası bulunamadı: ${workflowSource}`);
      }
    } catch (err) {
      console.warn(`⚠️ Uyarı: GitHub workflow dosyası kopyalanırken hata oluştu: ${err.message}`);
    }
    
    // Kullanıcının package.json dosyasına script'leri ekleyelim
    const userPackageJsonPath = path.join(userProjectRoot, 'package.json');
    try {
      if (fs.existsSync(userPackageJsonPath)) {
        const userPackageJson = JSON.parse(fs.readFileSync(userPackageJsonPath, 'utf8'));
        
        // scripts kısmı yoksa oluşturalım
        if (!userPackageJson.scripts) {
          userPackageJson.scripts = {};
        }
        
        let packageJsonUpdated = false;
        
        // init script'ini ekleyelim (eğer yoksa)
        if (!userPackageJson.scripts.init) {
          // Hem local hem de registry'den yüklenen paketler için çalışan ortak çözüm
          userPackageJson.scripts.init = "npx @cesurbagci/npm-firebase-remote-config setup";
          console.log('✅ package.json dosyanıza "npm run init" komutu eklendi.');
          packageJsonUpdated = true;
        } else {
          console.log('package.json dosyanızda zaten "init" script\'i bulunuyor, değiştirilmedi.');
        }
        
        // remote-config komutlarını ekleyelim veya güncelleyelim
        userPackageJson.scripts["remote-config:setup"] = "npm-firebase-remote-config setup";
        userPackageJson.scripts["remote-config:pull"] = "npm-firebase-remote-config pull";
        userPackageJson.scripts["remote-config:push"] = "npm-firebase-remote-config push";
        userPackageJson.scripts["remote-config:validate"] = "npm-firebase-remote-config validate";
        userPackageJson.scripts["remote-config:print"] = "npm-firebase-remote-config print-config";
        userPackageJson.scripts["remote-config:pull-meta"] = "npm-firebase-remote-config pull-meta";
        userPackageJson.scripts["remote-config:increase-version"] = "npm-firebase-remote-config increase-version";
        userPackageJson.scripts["remote-config:version"] = "npm-firebase-remote-config get-current-version-info";
        
        console.log('✅ package.json dosyanıza "npm run remote-config:*" komutları eklendi.');
        packageJsonUpdated = true;
        
        // Değişiklik yapıldıysa package.json'ı güncelleyelim
        if (packageJsonUpdated) {
          fs.writeFileSync(
            userPackageJsonPath,
            JSON.stringify(userPackageJson, null, 2),
            'utf8'
          );
        }
      } else {
        console.warn('⚠️ Uyarı: Projenizde package.json dosyası bulunamadı.');
      }
    } catch (err) {
      console.warn(`⚠️ Uyarı: package.json güncellenirken hata oluştu: ${err.message}`);
    }

    console.log('Kurulum başarıyla tamamlandı!');
    console.log(`Ana URL: ${baseUrlCleaned}`);
    console.log(`Uygulama adı: ${appName}`);
    console.log(`Firebase Remote Config uygulama kurulumu için projenizin kök dizinindeki configs dizinini kontrol edin.`);
    
    rl.close();
  } catch (error) {
    console.error('Bir hata oluştu:', error);
    rl.close();
    process.exit(1);
  }
}

// Setup komutu
program
  .command('setup')
  .description('Firebase Remote Config için gerekli dosya ve dizinleri oluşturur')
  .action(async () => {
    try {
      // npm explore ile çalıştırıldığında INIT_CWD çevresel değişkeni kullanıcının proje dizinidir
      // Eğer doğrudan çalıştırılıyorsa, mevcut çalışma dizinini kullan
      process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
      await setup();
      // Burada rl.close() çağrılmıyor, setup fonksiyonu içinde çağrılacak
    } catch (error) {
      console.error('Setup işlemi sırasında hata oluştu:', error);
      rl.close();
      process.exit(1);
    }
  });

// Pull komutu - Remote configleri çeker
program
  .command('pull')
  .description('Remote configleri lokal dosyalara çeker')
  .action(() => {
    // Kullanıcı dizinini ayarla
    process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
    process.chdir(process.env.INIT_CWD);
    
    // ServiceAccountKey kontrol et
    const serviceAccount = utils.checkServiceAccountKeyInUserProject();
    if (!serviceAccount) {
      console.error('ServiceAccountKey.json dosyası bulunamadı veya geçersiz!');
      process.exit(1);
    }
    
    // Firebase'i initialize et
    firebaseRemoteConfigLib.initializeApp(serviceAccount);
    
    // Pull işlemini gerçekleştir
    firebaseRemoteConfigLib.pullConfig();
  });

// Validate komutu - Configleri doğrular
program
  .command('validate')
  .description('Lokal configleri doğrular')
  .action(() => {
    // Kullanıcı dizinini ayarla
    process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
    process.chdir(process.env.INIT_CWD);
    
    // ServiceAccountKey kontrol et
    const serviceAccount = utils.checkServiceAccountKeyInUserProject();
    if (!serviceAccount) {
      console.error('ServiceAccountKey.json dosyası bulunamadı veya geçersiz!');
      process.exit(1);
    }
    
    // Firebase'i initialize et
    firebaseRemoteConfigLib.initializeApp(serviceAccount);
    
    // Validate işlemini gerçekleştir
    firebaseRemoteConfigLib.validateConfig();
  });

// Push komutu - Configleri remote'a gönderir
program
  .command('push')
  .description('Lokal configleri remote sunucuya gönderir')
  .action(() => {
    // Kullanıcı dizinini ayarla
    process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
    process.chdir(process.env.INIT_CWD);
    
    // ServiceAccountKey kontrol et
    const serviceAccount = utils.checkServiceAccountKeyInUserProject();
    if (!serviceAccount) {
      console.error('ServiceAccountKey.json dosyası bulunamadı veya geçersiz!');
      process.exit(1);
    }
    
    // Firebase'i initialize et
    firebaseRemoteConfigLib.initializeApp(serviceAccount);
    
    // Push işlemini gerçekleştir
    firebaseRemoteConfigLib.pushConfig();
  });

// Print-config komutu - Remottaki configleri yazdırır
program
  .command('print-config')
  .description('Remote configleri konsola yazdırır')
  .action(() => {
    // Kullanıcı dizinini ayarla
    process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
    process.chdir(process.env.INIT_CWD);
    
    // ServiceAccountKey kontrol et
    const serviceAccount = utils.checkServiceAccountKeyInUserProject();
    if (!serviceAccount) {
      console.error('ServiceAccountKey.json dosyası bulunamadı veya geçersiz!');
      process.exit(1);
    }
    
    // Firebase'i initialize et
    firebaseRemoteConfigLib.initializeApp(serviceAccount);
    
    // Print işlemini gerçekleştir
    firebaseRemoteConfigLib.printConfigInRemote();
  });

// Pull-meta komutu - Metadata dosyasını çeker
program
  .command('pull-meta')
  .description('Remote config metadata bilgilerini çeker')
  .action(() => {
    // Kullanıcı dizinini ayarla
    process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
    process.chdir(process.env.INIT_CWD);
    
    // ServiceAccountKey kontrol et
    const serviceAccount = utils.checkServiceAccountKeyInUserProject();
    if (!serviceAccount) {
      console.error('ServiceAccountKey.json dosyası bulunamadı veya geçersiz!');
      process.exit(1);
    }
    
    // Firebase'i initialize et
    firebaseRemoteConfigLib.initializeApp(serviceAccount);
    
    // Pull-meta işlemini gerçekleştir
    firebaseRemoteConfigLib.pullConfigMeta();
  });

// Increase-version komutu - Versiyon numarasını artırır
program
  .command('increase-version')
  .description('Remote config versiyon numarasını artırır')
  .action(() => {
    // Kullanıcı dizinini ayarla
    process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
    process.chdir(process.env.INIT_CWD);
    
    // ServiceAccountKey kontrol et
    const serviceAccount = utils.checkServiceAccountKeyInUserProject();
    if (!serviceAccount) {
      console.error('ServiceAccountKey.json dosyası bulunamadı veya geçersiz!');
      process.exit(1);
    }
    
    // Firebase'i initialize et
    firebaseRemoteConfigLib.initializeApp(serviceAccount);
    
    // Increase-version işlemini gerçekleştir
    firebaseRemoteConfigLib.increaseVersion();
  });

// Get-current-version-info komutu - Güncel versiyon bilgisini getirir
program
  .command('get-current-version-info')
  .description('Remote config güncel versiyon bilgilerini getirir')
  .action(() => {
    // Kullanıcı dizinini ayarla
    process.env.INIT_CWD = process.env.INIT_CWD || process.cwd();
    process.chdir(process.env.INIT_CWD);
    
    // ServiceAccountKey kontrol et
    const serviceAccount = utils.checkServiceAccountKeyInUserProject();
    if (!serviceAccount) {
      console.error('ServiceAccountKey.json dosyası bulunamadı veya geçersiz!');
      process.exit(1);
    }
    
    // Firebase'i initialize et
    firebaseRemoteConfigLib.initializeApp(serviceAccount);
    
    // Get-current-version-info işlemini gerçekleştir
    firebaseRemoteConfigLib.getCurrentVersionInfo()
      .then(info => {
        console.log(info);
      })
      .catch(err => {
        console.error('Hata:', err);
        process.exit(1);
      });
  });

// Eğer hiçbir komut belirtilmezse, yardım göster
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// Programı çalıştır
program.parse();