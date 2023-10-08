
const firebaseRemoteConfigLib = require('./lib/firebaseRemoteConfigLib');

exports.firebaseRemoteConfig = {};
exports.firebaseRemoteConfig.initializeApp = firebaseRemoteConfigLib.initializeApp;
exports.firebaseRemoteConfig.getCurrentVersionInfo = firebaseRemoteConfigLib.getCurrentVersionInfo;
exports.firebaseRemoteConfig.increaseVersion = firebaseRemoteConfigLib.increaseVersion;
exports.firebaseRemoteConfig.validateConfig = firebaseRemoteConfigLib.validateConfig;
exports.firebaseRemoteConfig.printConfigInRemote = firebaseRemoteConfigLib.printConfigInRemote;
exports.firebaseRemoteConfig.pullConfigMeta = firebaseRemoteConfigLib.pullConfigMeta;
exports.firebaseRemoteConfig.pushConfig = firebaseRemoteConfigLib.pushConfig;
exports.firebaseRemoteConfig.pullConfig = firebaseRemoteConfigLib.pullConfig;