const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const https = require("https");
const yauzl = require("yauzl");
let _authSettingsInstance;
module.exports = class GitHubDownloadUtil {

    static init(authSettings) {
        _authSettingsInstance = authSettings.instance;
    }

    static requestOptionsFromUrl(url, githubPersonalAccessToken) {
        const requestUrl = new URL(url);
        const requestOptions = {
            hostname: requestUrl.hostname,
            port: requestUrl.port,
            path: requestUrl.pathname,
            headers: {
                "User-Agent": "NodeJs",
                accept: "application/vnd.github.v3+json",
            },
        };
        if (githubPersonalAccessToken && githubPersonalAccessToken.trim().length > 0) {
            requestOptions.headers.Authorization = `token ${githubPersonalAccessToken}`
        }
        if (requestUrl.search) {
            requestOptions.path += requestUrl.search;
        }
        return requestOptions;
    }

    static async askForToken(repoUrl, githubDomain) {
        vscode.window.showInformationMessage(`Authentication necessary to download Voop custom scripts from '${repoUrl}', please input Personal Access Token.`);
        const tokenInput = await vscode.window.showInputBox({ placeHolder: `Personal Access Token for '${githubDomain}'.` });
        if (tokenInput === undefined) {
            //tokenInput was canceled, stop executing download from GitHub
            return false;
        }
        await _authSettingsInstance.storeAuthData(githubDomain, tokenInput);
        return tokenInput;
    }

    static async checkDownloadNecessary(repoUrl, githubDomain, ownerAndRepo, owner, repo) {
        let resolveCheck;
        let rejectCheck;
        let checkPromise = new Promise(function (resolve, reject) {
            resolveCheck = resolve;
            rejectCheck = reject;
        });
        const apiCommitUrl = `https://api.${githubDomain}/repos/${ownerAndRepo}/commits?per_page=1`;
        const handleResponse = async function (response) {
            if (response.statusCode === 401) {
                const authToken = await this.askForToken(repoUrl, githubDomain);
                if (!authToken) {
                    rejectCheck();
                    return;
                }
                const req = https.get(this.requestOptionsFromUrl(apiCommitUrl, authToken), handleResponse);
                req.on('error', async (error) => {
                    if (error.code && error.code === 'ENOTFOUND') {
                        //try /api/v3 path for enterprise github
                        const apiCommitUrl = `https://${githubDomain}/api/v3/repos/${ownerAndRepo}/commits?per_page=1`;
                        const req = https.get(this.requestOptionsFromUrl(apiCommitUrl, await _authSettingsInstance.getAuthData(githubDomain)), handleResponse);
                        req.on('error', error => {
                            console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
                            rejectCheck();
                        });
                        req.end();
                    } else {
                        console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
                        rejectCheck();
                    }
                });
                req.end();
                return;
            } else if (response.statusCode !== 200) {
                console.error(`Voop: Couldn't download custom scripts from repository ${repoUrl}. HTTP status code: ${response.statusCode}`);
                rejectCheck();
                return;
            }
            var body = '';
            response.on('data', function (chunk) {
                body += chunk;
            });
            response.on('end', function () {
                const voopExtDir = vscode.extensions.getExtension("PhilippT.voop").extensionPath;
                if (!fs.existsSync(`${voopExtDir}/githubCustomScripts`)) {
                    fs.mkdirSync(`${voopExtDir}/githubCustomScripts`);
                }
                if (!fs.existsSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`)) {
                    fs.mkdirSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`);
                }
                const latestSha = JSON.parse(body)[0].sha;
                if (fs.existsSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/latestCommit`)) {
                    const currentSha = fs.readFileSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/latestCommit`);
                    if (currentSha == latestSha) {
                        resolveCheck(false);
                    } else {
                        resolveCheck(latestSha);
                    }
                } else {
                    resolveCheck(latestSha);
                }
            });
        }.bind(this);
        const req = https.get(this.requestOptionsFromUrl(apiCommitUrl, await _authSettingsInstance.getAuthData(githubDomain)), handleResponse);
        req.on('error', async (error) => {
            if (error.code && error.code === 'ENOTFOUND') {
                //try /api/v3 path for enterprise github
                const apiCommitUrl = `https://${githubDomain}/api/v3/repos/${ownerAndRepo}/commits`;
                const req = https.get(this.requestOptionsFromUrl(apiCommitUrl, await _authSettingsInstance.getAuthData(githubDomain)), handleResponse);
                req.on('error', error => {
                    console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
                    rejectCheck();
                });
                req.end();
            } else {
                console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
                rejectCheck();
            }
        });
        req.end();
        return checkPromise;
    }

    static async downloadRepositoryAsZip(repoUrl) {
        let resolveDownload;
        let rejectDownload;
        var downloadPromise = new Promise(function (resolve, reject) {
            resolveDownload = resolve;
            rejectDownload = reject;
        });
        const githubUrlWithoutHttps = repoUrl.substring(repoUrl.indexOf("//") + 2);
        const githubDomain = githubUrlWithoutHttps.substring(0, githubUrlWithoutHttps.indexOf("/"));
        const ownerAndRepo = githubUrlWithoutHttps.substring(githubUrlWithoutHttps.indexOf("/") + 1);
        const owner = ownerAndRepo.split("/")[0];
        const repo = ownerAndRepo.split("/")[1];
        const apiDownloadUrl = `https://api.${githubDomain}/repos/${ownerAndRepo}/zipball`;
        const voopExtDir = vscode.extensions.getExtension("PhilippT.voop").extensionPath;

        setTimeout(async function () {
            let latestShaOrFalse;
            try {
                latestShaOrFalse = await this.checkDownloadNecessary(repoUrl, githubDomain, ownerAndRepo, owner, repo)
            } catch (error) {
                console.error("Couldn't check whether script download is necessary, authentication missing?");
                if (fs.existsSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`)) {
                    console.info("Target folder already existed, since download of newest scripts failed, loading existing one.")
                    resolveDownload(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`);
                } else {
                    rejectDownload();
                }
                return;
            }
            if (latestShaOrFalse == false) {
                resolveDownload(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`);
                console.log(`Already downloaded Voop custom scripts from github repository: ${repoUrl}.`);
                return downloadPromise;
            };

            const handleResponse = async function (response) {
                if (response.statusCode === 302) {
                    const req = https.get(this.requestOptionsFromUrl(response.headers.location), handleResponse);
                    req.on('error', async (error) => {
                        console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
                        rejectDownload();
                    });
                    req.end();
                    return;
                } else if (response.statusCode !== 200) {
                    console.error(`Voop: Couldn't download newest custom scripts from repository ${repoUrl}. Loading old ones. HTTP status code: ${response.statusCode}`);
                    resolveDownload(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`);
                    return;
                }
                response
                    .on("error", (e) => {
                        console.error("Response read error during download of Voop custom scripts from github.", e.message);
                        rejectDownload();
                    })
                    .on("end", () => {
                        //1
                        // if (response.destroyed) {
                        //   console.error("Download of Voop custom scripts from github failed.");
                        // } else {
                        //   console.log("Download of Voop custom scripts from github finished.");
                        // }
                    })
                    .on("close", () => {
                        //2
                        // console.log("READER CLOSE");
                    });

                const writer = fs
                    .createWriteStream(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/customScriptsFromGitHub.zip`)
                    .on("finish", () => {
                        //3
                        // console.log("WRITER FINISH");
                    })
                    .on("error", (e) => {
                        console.error("Write error during download of Voop custom scripts from github.", e.message);
                        rejectDownload();
                    })
                    .on("end", () => {
                        // console.log("WRITER END");
                    })
                    .on("close", () => {
                        //4
                        // console.log("WRITER CLOSE");
                        //delete old scripts after download of new ones
                        fs.readdir(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`, (err, files) => {
                            if (err) {
                                console.log(`An error occured while reading directory ${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}: ${err}`);
                                return;
                            }
                            for (const file of files) {
                                if (file != "customScriptsFromGitHub.zip") {
                                    fs.unlink(path.join(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`, file), (err) => {
                                        if (err) {
                                            console.log(`An error occured while deleting file ${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/${file}: ${err}`);
                                        }
                                    });
                                }
                            }
                            const writePromises = [];
                            yauzl.open(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/customScriptsFromGitHub.zip`, { lazyEntries: true }, function (err, zipfile) {
                                if (err) {
                                    console.error(`An error occured while opening zip file ${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/customScriptsFromGitHub.zip: ${err}`);
                                    rejectDownload();
                                    return;
                                }
                                zipfile.readEntry();
                                zipfile.on("entry", function (entry) {
                                    if (/\/$/.test(entry.fileName)) {
                                        // directory, go on
                                        zipfile.readEntry();
                                    } else {
                                        // file entry
                                        if (entry.fileName.endsWith(".js")) {
                                            zipfile.openReadStream(entry, function (err, readStream) {
                                                if (err) throw err;
                                                readStream.on("end", function () {
                                                    zipfile.readEntry();
                                                });
                                                var writeStream = fs.createWriteStream(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/${entry.fileName.substring(entry.fileName.lastIndexOf("/") + 1)}`);
                                                readStream.pipe(writeStream);
                                                var promiseResolve, promiseReject;
                                                var writePromise = new Promise(function (resolve) {
                                                    promiseResolve = resolve;
                                                });
                                                writePromises.push(writePromise);
                                                writeStream.on('finish', () => {
                                                    promiseResolve();
                                                });
                                            });
                                        } else {
                                            zipfile.readEntry();
                                        }
                                    }
                                });
                                zipfile.on("close", function () {
                                    Promise.all(writePromises).then(() => {
                                        fs.writeFileSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/latestCommit`, latestShaOrFalse);
                                        fs.unlink(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/customScriptsFromGitHub.zip`, (err) => {
                                            if (err) {
                                                console.log(`An error occured while deleting file ${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}/${file}: ${err}`);
                                            }
                                        });
                                        resolveDownload(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`);
                                        console.log(`Downloaded Voop custom scripts from github repository: ${repoUrl}.`);
                                    });
                                });
                            });
                        });
                    });

                response.pipe(writer);
            }.bind(this);
            const req = https.get(this.requestOptionsFromUrl(apiDownloadUrl, await _authSettingsInstance.getAuthData(githubDomain)), handleResponse);
            req.on('error', async (error) => {
                if (error.code && error.code === 'ENOTFOUND') {
                    //try /api/v3 path for enterprise github
                    const apiDownloadUrl = `https://${githubDomain}/api/v3/repos/${ownerAndRepo}/zipball`;
                    const req = https.get(this.requestOptionsFromUrl(apiDownloadUrl, await _authSettingsInstance.getAuthData(githubDomain)), handleResponse);
                    req.on('error', error => {
                        console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
                    });
                    req.end();
                } else {
                    console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
                }
            });
            req.end();
        }.bind(this), 0);

        return downloadPromise;
    }
}