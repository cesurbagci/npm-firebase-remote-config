const fs = require('fs');
const path = require('path');

/**
 * Kullanıcının proje kök dizininde serviceAccountKey.json dosyasını kontrol eder
 * @returns {Object|null} serviceAccountKey.json içeriği veya null (dosya bulunamazsa)
 */
function checkServiceAccountKeyInUserProject() {
  try {
    // Paketi kullanan kişinin çalışma dizini (projenin kök dizini)
    const userProjectRoot = process.cwd();
    
    // serviceAccountKey.json dosya yolunu oluştur
    const serviceAccountPath = path.join(userProjectRoot, 'serviceAccountKey.json');
    
    // Dosya mevcut mu kontrol et
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️ Uyarı: Proje kök dizininde serviceAccountKey.json dosyası bulunamadı!');
      return null;
    }
    
    // Dosyayı oku ve JSON olarak parse et
    const serviceAccountData = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountData);
    
    // project_id kontrolü
    if (!serviceAccount.project_id || serviceAccount.project_id === '{project_id}') {
      console.warn('⚠️ Uyarı: serviceAccountKey.json dosyasında geçerli bir project_id bulunamadı!');
      return null;
    }
    
    return serviceAccount;
  } catch (error) {
    console.warn('⚠️ Uyarı: serviceAccountKey.json dosyası okunurken hata oluştu:', error.message);
    return null;
  }
}

module.exports = {
  checkServiceAccountKeyInUserProject
};