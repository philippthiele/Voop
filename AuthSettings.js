const { ExtensionContext, SecretStorage } = require("vscode");

let _instance;
let _secretStorage;
module.exports = class AuthSettings {

    constructor(secretStorage) {
        _secretStorage = secretStorage;
    }

    static init(context) {
        _instance = new AuthSettings(context.secrets)
    }

    static get instance(){
        return _instance
    }

    async storeAuthData(key, secret){
        if (key && secret) {
            await _secretStorage.store(key, secret);
        }
    }

    async getAuthData(key) {
        return await _secretStorage.get(key);
    }

    async deleteAuthData(key) {
        try {
            await _secretStorage.delete(key);            
        } catch (error) {
            //ignore, usually still worked, testing if it did below
        }
        var authData = await _instance.getAuthData(key);
        return authData === undefined || authData === null || authData === '';
    }
}