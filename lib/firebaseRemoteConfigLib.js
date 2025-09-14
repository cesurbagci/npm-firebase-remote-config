var admin = require("firebase-admin");
var fs = require('fs');
const path = require('path');
const { parse } = require("path");

// Kullanıcının proje kök dizinindeki configs dizinini elde eder
function getUserConfigsPath(relativePath = '') {
    const userProjectRoot = process.cwd();
    return path.join(userProjectRoot, 'configs', relativePath);
}

// ServiceAccountKey'in geçerliliğini kontrol eder ve Firebase ile bağlantı kurabildiğini doğrular
async function validateServiceAccount(serviceAccountObj) {
    try {
        // Önceki bağlantıları temizle (eğer varsa)
        if (admin.apps.length) {
            await admin.app().delete();
        }
        
        // Firebase ile bağlantı kurma denemesi
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccountObj)
        });
        
        // Remote Config API'ya erişim denemesi
        const config = admin.remoteConfig();
        
        // Burada sadece bağlantıyı test ediyoruz, fetch edilmese de olur
        await config.listVersions().catch(() => {});
        
        // Bağlantıyı kapat
        await admin.app().delete();
        
        return { success: true };
    } catch (error) {
        // Hata olması durumunda temizlik yap
        if (admin.apps.length) {
            try {
                await admin.app().delete();
            } catch (e) {
                // Cleanup hatalarını görmezden gel
            }
        }
        
        return { 
            success: false, 
            error: error.message || 'Bilinmeyen bir hata oluştu',
            code: error.code || 'unknown_error'
        };
    }
}

function initializeApp(serviceAccountObj, databaseURL) {
    // Önceki bağlantıları temizle (eğer varsa)
    if (admin.apps.length) {
        admin.app().delete();
    }
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountObj),
        // databaseURL: databaseURL
    });
}

async function getCurrentVersionInfo() {
    let config = admin.remoteConfig();
    const template = await config.getTemplate();

    return template.parameters['remoteConfigInfo']?.defaultValue?.value;
}

async function increaseVersion() {
    // update remote config
    let config = admin.remoteConfig();
    const template = await config.getTemplate();
    let defaultValueJSON = JSON.parse(template.parameters['remoteConfigInfo'].defaultValue.value);
    let currentVersionNumber = +defaultValueJSON.versionNumber ?? 0;
    console.log('current version number: ' + currentVersionNumber);
    defaultValueJSON.versionNumber = currentVersionNumber + 1;
    console.log('new version number: ' + defaultValueJSON.versionNumber);

    template.parameters['remoteConfigInfo'] = {
        defaultValue: {
            value: JSON.stringify(defaultValueJSON)
        }
    };

    try {
        const validatedTemplate = await config.validateTemplate(template);
        const publishedTemplate = await config.publishTemplate(validatedTemplate);
        console.log(`✅✅✅ remoteConfigInfo version is increased. new version is ${defaultValueJSON.versionNumber}`);
    } catch (err) {
        console.error('❌❌❌ Error publishing the template:', err);
    }
}

/*
  configs dizini altindaki config dosyalarini dogru mu kontrolu yapar.
*/
function validateConfigFiles() {
    __concateConfigs(function (template) {
        if (template) {
            console.info('template is valid');
        } else {
            console.error('template is not valid!!!');
        }
    });
}

/*
  remote taki butun configleri configs dizini altindaki dosyalara dagitir.
*/
function dispatchToConfigFiles() {
    var config = admin.remoteConfig();
    config.getTemplate()
        .then(function (template) {
            console.log('ETag from server: ' + template.etag);

            template = parseItems(template);

            var conditionsStr = JSON.stringify(template.conditions, null, 4);
            const configsDir = getUserConfigsPath();
            if (!fs.existsSync(configsDir)) {
                fs.mkdirSync(configsDir, { recursive: true });
            }
            fs.writeFileSync(getUserConfigsPath('conditions.json'), conditionsStr);

            writeParameters(template.parameters, 'parameters');

            const parameterGroupKeys = Object.keys(template.parameterGroups);
            for (let i = 0; i < parameterGroupKeys.length; i++) {
                const parameterGroupKey = parameterGroupKeys[i];
                const groupParameters = template.parameterGroups[parameterGroupKey]?.parameters;

                if (groupParameters) {
                    writeParameters(groupParameters, 'parameterGroups/' + parameterGroupKey);
                }
            }

            fs.writeFileSync(getUserConfigsPath('eTag.json'), JSON.stringify(template.etag, null, 4));
            fs.writeFileSync(getUserConfigsPath('version.json'), JSON.stringify(template.version, null, 4));

        })
        .catch(function (err) {
            console.error('Unable to dispaty to config files');
            console.error(err);
        });
}

/*
  configs dizini altindaki config dosyalarini birlestirip remote a yazar.
*/
function publishTemplateFromConfigFiles() {

    __concateConfigs(function (template) {

        var config = admin.remoteConfig();

        config.publishTemplate(template)
            .then(function (updatedTemplate) {
                console.log('Template has been published');
                console.log('ETag from server: ' + updatedTemplate.etag);

                try {
                    writeTemplateToConfigFile();
                } catch (err) {
                    console.error("Unable to write config file.");
                }

                dispatchToConfigFiles();

                console.info("isSucceed");
            })
            .catch(function (err) {
                console.error('Unable to publish template.');
                console.error(err);

                console.info("isFailed!!!");
            });

    });

}

/*
  console a remote taki butun config leri yazar.
*/
const printConfigInRemote = async () => {
    let config = admin.remoteConfig();
    const template = await config.getTemplate()
    //all parameters will be under template.parameters

    console.log(template);
}

/*
  config.json dosyasina butun configleri yazar.
*/
function writeTemplateToConfigFile() {
    var config = admin.remoteConfig();
    config.getTemplate()
        .then(function (template) {
            console.log('ETag from server: ' + template.etag);

            template = parseItems(template);

            var templateStr = JSON.stringify(template, null, 4);
            
            const userProjectRoot = process.cwd();
            fs.writeFileSync(path.join(userProjectRoot, 'config.json'), templateStr);
        })
        .catch(function (err) {
            console.error('Unable to get template');
            console.error(err);
        });
}

function writeParameters(parameters, directoryName) {
    
    fs.rmSync(getUserConfigsPath(directoryName), { recursive: true, force: true });

    const parameterKeys = Object.keys(parameters);

    for (let i = 0; i < parameterKeys.length; i++) {
        const parameterKey = parameterKeys[i];

        let valueType = parameters[parameterKey]?.valueType;
        if (valueType) {
            const paramPath = path.join(directoryName, parameterKey.trim());
            if (!fs.existsSync(getUserConfigsPath(paramPath))) {
                fs.mkdirSync(getUserConfigsPath(paramPath), { recursive: true });
            }
            fs.writeFileSync(getUserConfigsPath(path.join(paramPath, 'valueType.txt')), valueType);
        }

        let parameterValue = parameters[parameterKey]?.defaultValue?.value;

        // if (parameterValue) {
        if (parameters[parameterKey]?.valueType) {
            var parameterValueStr = `${parameterValue}`;
            if (parameters[parameterKey]?.valueType?.toUpperCase() == 'JSON') {
                if (parameterValue == null || parameterValue == undefined) {
                    parameterValueStr = '{}';
                } else {
                    parameterValueStr = JSON.stringify(parameterValue, null, 4);
                }
            } else if (parameters[parameterKey]?.valueType?.toUpperCase() == 'BOOLEAN') {
                if (parameterValue == null || parameterValue == undefined) {
                    parameterValueStr = 'false';
                } else {
                    parameterValueStr = `${+parameterValue}`;
                }
            } else if (parameters[parameterKey]?.valueType?.toUpperCase() == 'NUMBER') {
                if (parameterValue == null || parameterValue == undefined) {
                    parameterValueStr = '0';
                } else {
                    parameterValueStr = `${/^true$/i.test(parameterValue)}`;
                }
            } else {
                if (parameterValue == null || parameterValue == undefined) {
                    parameterValueStr = '';
                } else if (typeof parameterValue == 'object') {
                    parameterValueStr = JSON.stringify(parameterValue, null, 4);
                }
            }

            const paramPath = path.join(directoryName, parameterKey.trim());
            if (!fs.existsSync(getUserConfigsPath(paramPath))) {
                fs.mkdirSync(getUserConfigsPath(paramPath), { recursive: true });
            }

            fs.writeFileSync(getUserConfigsPath(path.join(paramPath, 'defaultValue.json')), parameterValueStr);

        }

        let conditionalValues = parameters[parameterKey]?.conditionalValues;
        if (conditionalValues) {
            let conditionKeys = Object.keys(conditionalValues);

            for (let j = 0; j < conditionKeys.length; j++) {
                const conditionKey = conditionKeys[j];
                const conditionValue = conditionalValues[conditionKey]?.value;

                // if (conditionValue) {
                if (parameters[parameterKey]?.valueType) {
                    const paramPath = path.join(directoryName, parameterKey.trim());
                    if (!fs.existsSync(getUserConfigsPath(paramPath))) {
                        fs.mkdirSync(getUserConfigsPath(paramPath), { recursive: true });
                    }

                    var parameterValueStr = `${conditionValue}`;
                    if (parameters[parameterKey]?.valueType?.toUpperCase() == 'JSON') {
                        if (conditionValue == null || conditionValue == undefined) {
                            parameterValueStr = '{}';
                        } else {
                            parameterValueStr = JSON.stringify(conditionValue, null, 4);
                        }
                    } else if (parameters[parameterKey]?.valueType?.toUpperCase() == 'BOOLEAN') {
                        if (conditionValue == null || conditionValue == undefined) {
                            parameterValueStr = 'false';
                        } else {
                            parameterValueStr = `${+conditionValue}`;
                        }
                    } else if (parameters[parameterKey]?.valueType?.toUpperCase() == 'NUMBER') {
                        if (conditionValue == null || conditionValue == undefined) {
                            parameterValueStr = '0';
                        } else {
                            parameterValueStr = `${/^true$/i.test(conditionValue)}`;
                        }
                    } else {
                        if (conditionValue == null || conditionValue == undefined) {
                            parameterValueStr = '';
                        } else if (typeof conditionValue == 'object') {
                            parameterValueStr = JSON.stringify(conditionValue, null, 4);
                        }
                    }
                    fs.writeFileSync(getUserConfigsPath(path.join(paramPath, conditionKey + '.json')), parameterValueStr);
                }
            }
        }
    }
}

function __concateConfigs(fn) {

    var result = {};
    result.conditions = [];
    result.parameters = {};
    result.parameterGroups = {};
    result.etag = '';
    result.version = {};

    var conditionsStr = fs.readFileSync(getUserConfigsPath('conditions.json'), 'UTF8');
    var conditionsData = JSON.parse(conditionsStr);
    result.conditions = conditionsData;

    var parameterKeys = fs.readdirSync(getUserConfigsPath('parameters'));
    parameterKeys = parameterKeys.filter(function (value, index, arr) {
        return value != ".DS_Store";
    });

    result.parameters = createParameterObject(parameterKeys, 'parameters');

    var parameterGroupKeys = [];
    try {
        parameterGroupKeys = fs.readdirSync(getUserConfigsPath('parameterGroups'));
    } catch { }

    for (let i = 0; i < parameterGroupKeys.length; i++) {
        const parameterGroupKey = parameterGroupKeys[i];
        const groupParameterKeys = fs.readdirSync(getUserConfigsPath(path.join('parameterGroups', parameterGroupKey)));

        result.parameterGroups[parameterGroupKey] = {};
        result.parameterGroups[parameterGroupKey].parameters = createParameterObject(groupParameterKeys, 'parameterGroups/' + parameterGroupKey);
    }

    var eTagStr = fs.readFileSync(getUserConfigsPath('eTag.json'), 'UTF8');
    var eTagData = JSON.parse(eTagStr);
    result.etag = eTagData;

    var versionStr = fs.readFileSync(getUserConfigsPath('version.json'), 'UTF8');
    var versionData = JSON.parse(versionStr);
    result.version = versionData;
    result.version.rollbackSource = `${result.version.rollbackSource}`;

    // result.parameters.extractConfig.valueType = "JSON";

    try {
        if (result.parameters.remoteConfigInfo.defaultValue.value?.versionNumber) {
            result.parameters.remoteConfigInfo.defaultValue.value.versionNumber = (+result.parameters.remoteConfigInfo.defaultValue.value.versionNumber) + 1;
        } else {
            let parsedRemoteConfigInfo = JSON.parse(result.parameters.remoteConfigInfo.defaultValue.value);
            parsedRemoteConfigInfo.versionNumber = (parsedRemoteConfigInfo.versionNumber ?? -1) + 1;
            result.parameters.remoteConfigInfo.defaultValue.value = JSON.stringify(parsedRemoteConfigInfo);
        }
        // result.parameters.remoteConfigInfo.defaultValue.value.versionNumber = (result.parameters.remoteConfigInfo.defaultValue.value.versionNumber ?? -1) + 1;
    } catch (err) {
        console.error(`version is not updated! error: ${err}`);
    }

    var config = admin.remoteConfig();
    let jsonData = stringifyValueKeys(result);
    jsonString = JSON.stringify(jsonData);

    var template = config.createTemplateFromJSON(jsonString);

    admin.remoteConfig().validateTemplate(template)
        .then(function (validatedTemplate) {
            // The template is valid and safe to use.
            if (fn) {
                fn(validatedTemplate);
            }
        })
        .catch(function (err) {
            console.error('Template is invalid and cannot be published');
            console.error(err);

            if (fn) {
                fn();
            }
        });

}

function createParameterObject(parameterKeys, filePath) {
    var result = {};

    for (let i = 0; i < parameterKeys.length; i++) {
        const parameterKey = parameterKeys[i];

        result[parameterKey] = {};
        result[parameterKey].defaultValue = {};
        result[parameterKey].defaultValue.value = {};
        // result[parameterKey].conditionalValues = { };

        const paramPath = path.join(filePath, parameterKey);
        fs.readdirSync(getUserConfigsPath(paramPath)).forEach(parameterValueFile => {

            const parameterValueStr = fs.readFileSync(getUserConfigsPath(path.join(paramPath, parameterValueFile)), 'UTF8');

            if (parameterValueFile == 'valueType.txt') {
                result[parameterKey].valueType = parameterValueStr;

                return;
            }

            const parameterValueType = fs.readFileSync(getUserConfigsPath(path.join(paramPath, 'valueType.txt')), 'UTF8');

            var parameterValueData = parameterValueStr;
            if (parameterValueType?.toUpperCase() == 'JSON') {
                parameterValueData = JSON.parse(parameterValueStr);
            } else if (parameterValueType?.toUpperCase() == 'NUMBER') {
                parameterValueData = +parameterValueStr;
            } else if (parameterValueType?.toUpperCase() == 'BOOLEAN') {
                parameterValueData = /^true$/i.test(parameterValueStr);
            }

            if (parameterValueFile == 'defaultValue.json') {
                result[parameterKey].defaultValue.value = parameterValueData;
            } else {
                if (!result[parameterKey].conditionalValues) {
                    result[parameterKey].conditionalValues = {};
                }
                result[parameterKey].conditionalValues[parameterValueFile.replace('.json', '').trim()] = {};
                result[parameterKey].conditionalValues[parameterValueFile.replace('.json', '').trim()].value = {};
                result[parameterKey].conditionalValues[parameterValueFile.replace('.json', '').trim()].value = parameterValueData;
            }
        });
    }

    return result;
}

function stringifyValueKeys(jsonData, convertType) {
    var result = jsonData;

    var propertyItems = Object.keys(jsonData);

    if (propertyItems.length > 0) {
        for (var i = 0; i < propertyItems.length; i++) {
            let propertyKey = propertyItems[i];

            if (propertyKey == 'value') {
                if (convertType && convertType.toUpperCase() == 'STRING') {
                    result[propertyKey] = jsonData[propertyKey];
                } else if (convertType && convertType.toUpperCase() == 'NUMBER') {
                    result[propertyKey] = +jsonData[propertyKey];
                } else if (convertType && convertType.toUpperCase() == 'BOOLEAN') {
                    result[propertyKey] = /^true$/i.test(jsonData[propertyKey]);
                } else {
                    result[propertyKey] = JSON.stringify(jsonData[propertyKey], null, 4);
                }

            } else if (isJson(jsonData[propertyKey])) {
                if (jsonData[propertyKey].valueType && ["STRING", "NUMBER", "BOOLEAN"].indexOf(jsonData[propertyKey].valueType) > -1) {
                    result[propertyKey] = stringifyValueKeys(jsonData[propertyKey], jsonData[propertyKey].valueType);
                } else {
                    result[propertyKey] = stringifyValueKeys(jsonData[propertyKey], convertType);
                }
            } else {
                result[propertyKey] = jsonData[propertyKey];
            }
        }
    }

    return result;
}

function parseItems(objectToParse) {
    var result = objectToParse;

    var propertyItems = Object.keys(objectToParse);

    if (propertyItems.length > 0) {
        for (var i = 0; i < propertyItems.length; i++) {
            let propertyKey = propertyItems[i];
            if (!isNaN(parseInt(propertyKey))) {
                continue;
            }

            try {
                if (IsJsonString(objectToParse[propertyKey]) && !isJson(objectToParse[propertyKey])) {
                    result[propertyKey] = JSON.parse(objectToParse[propertyKey])

                    result[propertyKey] = parseItems(result[propertyKey]);
                } else if (IsJsonString(objectToParse[propertyKey])) {
                    result[propertyKey] = JSON.parse(objectToParse[propertyKey])

                    // result[propertyKey] = parseItems(result[propertyKey]);
                } else if (isJson(objectToParse[propertyKey])) {
                    result[propertyKey] = parseItems(objectToParse[propertyKey]);
                } else {
                    result[propertyKey] = objectToParse[propertyKey];
                }
            } catch (err) {
                result[propertyKey] = objectToParse[propertyKey];
            }
        }
    } else {
        result = objectToParse;
    }

    return result;
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function isJson(item) {
    item = typeof item !== "string"
        ? JSON.stringify(item)
        : item;

    try {
        item = JSON.parse(item);
    } catch (e) {
        return false;
    }

    if (typeof item === "object" && item !== null) {
        return true;
    }

    return false;
}

module.exports.initializeApp = initializeApp;
module.exports.validateServiceAccount = validateServiceAccount;
module.exports.getCurrentVersionInfo = getCurrentVersionInfo;
module.exports.increaseVersion = increaseVersion;
module.exports.validateConfig = validateConfigFiles;
module.exports.printConfigInRemote = printConfigInRemote;
module.exports.pullConfigMeta = writeTemplateToConfigFile;
module.exports.pushConfig = publishTemplateFromConfigFiles;
module.exports.pullConfig = dispatchToConfigFiles;

/*
  islemlerden once firebase account json objesi ile register olunmasi gerekiyor.
*/
// initializeApp(serviceAccountObj, databaseURL);

/*
  console a remote taki butun config leri yazar.
*/
// printConfigInRemote();

/*
  config.json dosyasina butun configleri yazar.
*/
// writeTemplateToConfigFile();  

/*
  remote taki butun configleri configs dizini altindaki dosyalara dagitir.
*/
// dispatchToConfigFiles();

/*
  configs dizini altindaki config dosyalarini dogru mu kontrolu yapar.
*/
// validateConfigFiles();

/*
  configs dizini altindaki config dosyalarini birlestirip remote a yazar.
*/
// publishTemplateFromConfigFiles();