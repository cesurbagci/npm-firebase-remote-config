var admin = require("firebase-admin");
var fs = require('fs');

function initializeApp(serviceAccountObj, databaseURL) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountObj),
        databaseURL: databaseURL
    });
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
            if (!fs.existsSync('./configs/')) {
                fs.mkdirSync('./configs/');
            }
            fs.writeFileSync('./configs/conditions.json', conditionsStr);

            writeParameters(template.parameters, 'parameters');

            const parameterGroupKeys = Object.keys(template.parameterGroups);
            for (let i = 0; i < parameterGroupKeys.length; i++) {
                const parameterGroupKey = parameterGroupKeys[i];
                const groupParameters = template.parameterGroups[parameterGroupKey]?.parameters;

                if (groupParameters) {
                    writeParameters(groupParameters, 'parameterGroups/' + parameterGroupKey);
                }
            }

            fs.writeFileSync('./configs/eTag.json', JSON.stringify(template.etag, null, 4));
            fs.writeFileSync('./configs/version.json', JSON.stringify(template.version, null, 4));

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

            fs.writeFileSync('config.json', templateStr);
        })
        .catch(function (err) {
            console.error('Unable to get template');
            console.error(err);
        });
}

function writeParameters(parameters, directoryName) {

    fs.rmSync('./configs/' + directoryName, { recursive: true, force: true });

    const parameterKeys = Object.keys(parameters);

    for (let i = 0; i < parameterKeys.length; i++) {
        const parameterKey = parameterKeys[i];

        let valueType = parameters[parameterKey]?.valueType;
        if (valueType) {
            if (!fs.existsSync('./configs/' + directoryName + '/' + parameterKey.trim())) {
                fs.mkdirSync('./configs/' + directoryName + '/' + parameterKey.trim(), { recursive: true });
            }
            fs.writeFileSync('./configs/' + directoryName + '/' + parameterKey.trim() + '/valueType.txt', valueType);
        }

        let parameterValue = parameters[parameterKey]?.defaultValue?.value;
        if (parameterValue) {
            var parameterValueStr = JSON.stringify(parameterValue, null, 4);
            if (!fs.existsSync('./configs/' + directoryName + '/' + parameterKey.trim())) {
                fs.mkdirSync('./configs/' + directoryName + '/' + parameterKey.trim(), { recursive: true });
            }
            fs.writeFileSync('./configs/' + directoryName + '/' + parameterKey.trim() + '/defaultValue.json', parameterValueStr);
        }

        let conditionalValues = parameters[parameterKey]?.conditionalValues;
        if (conditionalValues) {
            let conditionKeys = Object.keys(conditionalValues);

            for (let j = 0; j < conditionKeys.length; j++) {
                const conditionKey = conditionKeys[j];
                const conditionValue = conditionalValues[conditionKey]?.value;

                if (conditionValue) {
                    if (!fs.existsSync('./configs/' + directoryName + '/' + parameterKey.trim())) {
                        fs.mkdirSync('./configs/' + directoryName + '/' + parameterKey.trim(), { recursive: true });
                    }
                    var parameterValueStr = JSON.stringify(conditionValue, null, 4);
                    fs.writeFileSync('./configs/' + directoryName + '/' + parameterKey.trim() + '/' + conditionKey + '.json', parameterValueStr);
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

    var conditionsStr = fs.readFileSync('./configs/conditions.json', 'UTF8');
    var conditionsData = JSON.parse(conditionsStr);
    result.conditions = conditionsData;

    var parameterKeys = fs.readdirSync('./configs/parameters');
    parameterKeys = parameterKeys.filter(function (value, index, arr) {
        return value != ".DS_Store";
    });

    result.parameters = createParameterObject(parameterKeys, 'parameters');

    var parameterGroupKeys = [];
    try {
        parameterGroupKeys = fs.readdirSync('./configs/parameterGroups');
    } catch { }

    for (let i = 0; i < parameterGroupKeys.length; i++) {
        const parameterGroupKey = parameterGroupKeys[i];
        const groupParameterKeys = fs.readdirSync('./configs/parameterGroups/' + parameterGroupKey);

        result.parameterGroups[parameterGroupKey] = {};
        result.parameterGroups[parameterGroupKey].parameters = createParameterObject(groupParameterKeys, 'parameterGroups/' + parameterGroupKey);
    }

    var eTagStr = fs.readFileSync('./configs/eTag.json', 'UTF8');
    var eTagData = JSON.parse(eTagStr);
    result.etag = eTagData;

    var versionStr = fs.readFileSync('./configs/version.json', 'UTF8');
    var versionData = JSON.parse(versionStr);
    result.version = versionData;

    // result.parameters.extractConfig.valueType = "JSON";

    result.parameters.remoteConfigInfo.defaultValue.value.versionNumber = (result.parameters.remoteConfigInfo.defaultValue.value.versionNumber ?? -1) + 1;

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

        fs.readdirSync('./configs/' + filePath + '/' + parameterKey).forEach(parameterValueFile => {

            const parameterValueStr = fs.readFileSync('./configs/' + filePath + '/' + parameterKey + '/' + parameterValueFile, 'UTF8');

            if (parameterValueFile == 'valueType.txt') {
                result[parameterKey].valueType = parameterValueStr;

                return;
            }

            var parameterValueData = JSON.parse(parameterValueStr);

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

function stringifyValueKeys(jsonData) {
    var result = jsonData;

    var propertyItems = Object.keys(jsonData);

    if (propertyItems.length > 0) {
        for (var i = 0; i < propertyItems.length; i++) {
            let propertyKey = propertyItems[i];

            if (propertyKey == 'value') {
                result[propertyKey] = JSON.stringify(jsonData[propertyKey], null, 4);
            } else if (isJson(jsonData[propertyKey])) {
                result[propertyKey] = stringifyValueKeys(jsonData[propertyKey]);
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