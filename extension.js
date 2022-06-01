// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const https = require("https");
const yauzl = require("yauzl");
require("module-alias/register");
const authSettings = require("./AuthSettings");
let quickPickScriptList = [];

function addScriptsInPath(path) {
  let scripts = fs.readdirSync(path);
  for (let i = 0; i < scripts.length; i++) {
    const item = scripts[i];
    if (item.endsWith(".js")) {
      const scriptPath = (path + "/" + item).replace(/\\/g, "/");
      const scriptContent = fs.readFileSync(scriptPath, "utf8");
      try {
        const declaration = JSON.parse(scriptContent.substring(scriptContent.indexOf("{"), scriptContent.indexOf("}") + 1).replace(/,\s+}$/, "}"));
        if (!quickPickScriptList.find((s) => s.label === declaration.name)) {
          quickPickScriptList.push({
            label: `${declaration.name}${declaration.userInput ? " 👤" : ""}`,
            description: declaration.description,
            detail: declaration.tags,
            scriptPath: scriptPath,
            userInput: declaration.userInput,
            userInputPlaceHolder: declaration.userInputPlaceHolder,
          });
        } else {
          console.debug(`Voop: Script with name '${declaration.name}' exists twice, not adding second instance.`);
        }
      } catch (e) {
        console.error(`Voop: Couldn't load script ${item}`, e);
      }
    }
  }
}

function requestOptionsFromUrl(url, githubPersonalAccessToken) {
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
  if(githubPersonalAccessToken && githubPersonalAccessToken.trim().length > 0) {
    requestOptions.headers.Authorization = `token ${githubPersonalAccessToken}`
  }
  if(requestUrl.search){
    requestOptions.path += requestUrl.search;
  }
  return requestOptions;
}

async function downloadRepositoryAsZip(repoUrl) {
  const githubUrlWithoutHttps = repoUrl.substring(repoUrl.indexOf("//") + 2);
  const githubDomain = githubUrlWithoutHttps.substring(0, githubUrlWithoutHttps.indexOf("/"));
  const ownerAndRepo = githubUrlWithoutHttps.substring(githubUrlWithoutHttps.indexOf("/") + 1);
  const owner = ownerAndRepo.split("/")[0];
  const repo = ownerAndRepo.split("/")[1];
  const apiDownloadUrl = `https://api.${githubDomain}/repos/${ownerAndRepo}/zipball`;
  async function handleResponse(response) {
    if (response.statusCode === 401) {
      vscode.window.showInformationMessage(`Authentication necessary to download Voop custom scripts from '${repoUrl}', please input Personal Access Token.`);
      const tokenInput = await vscode.window.showInputBox({ placeHolder: `Personal Access Token for '${githubDomain}'.` });
      if (tokenInput === undefined) {
        //tokenInput was canceled, stop executing download from GitHub
        return;
      }
      await authSettings.instance.storeAuthData(githubDomain, tokenInput);
      const authToken = await authSettings.instance.getAuthData(githubDomain);
      const req = https.get(requestOptionsFromUrl(apiDownloadUrl, authToken), handleResponse);
      req.on('error', async (error) => {
        if(error.code && error.code === 'ENOTFOUND'){
          //try /api/v3 path for enterprise github
          const apiDownloadUrl = `https://${githubDomain}/api/v3/repos/${ownerAndRepo}/zipball`;
          const req = https.get(requestOptionsFromUrl(apiDownloadUrl, await authSettings.instance.getAuthData(githubDomain)), handleResponse);
          req.on('error', error => {
            console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
          });
          req.end();
        } else {
          console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
        }
      });
      req.end();
      return;
    } else if (response.statusCode === 302) {
      const req = https.get(requestOptionsFromUrl(response.headers.location), handleResponse);
      req.on('error', async (error) => {
          console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
      });
      req.end();
      return;
    } else if(response.statusCode !== 200) {
      console.error(`Voop: Couldn't download custom scripts from repository ${repoUrl}. HTTP status code: ${response.statusCode}`);
      return;
    }
    const voopExtDir = vscode.extensions.getExtension("PhilippT.voop").extensionPath;
    if (!fs.existsSync(`${voopExtDir}/githubCustomScripts`)) {
      fs.mkdirSync(`${voopExtDir}/githubCustomScripts`);
    }
    if (!fs.existsSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`)) {
      fs.mkdirSync(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`);
    }
    response
      .on("error", (e) => {
        console.error("Reponse read error during download of Voop custom scripts from github.", e.message);
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
                    var writePromise = new Promise(function(resolve){
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
                addScriptsInPath(`${voopExtDir}/githubCustomScripts/${githubDomain}-${owner}-${repo}`);
                console.log(`Loaded Voop custom scripts from github repository: ${repoUrl}.`);            
              });
            });
          });
        });
      });

    response.pipe(writer);
  }
  const req = https.get(requestOptionsFromUrl(apiDownloadUrl, await authSettings.instance.getAuthData(githubDomain)), handleResponse);
  req.on('error', async (error) => {
    if(error.code && error.code === 'ENOTFOUND'){
      //try /api/v3 path for enterprise github
      const apiDownloadUrl = `https://${githubDomain}/api/v3/repos/${ownerAndRepo}/zipball`;
      const req = https.get(requestOptionsFromUrl(apiDownloadUrl, await authSettings.instance.getAuthData(githubDomain)), handleResponse);
      req.on('error', error => {
        console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
      });
      req.end();
    } else {
      console.error(`An error occured during request to GitHub for adding custom voop scripts: ${error}`);
    }
  });
  req.end();
}

function loadScripts() {
  quickPickScriptList = [];
  addScriptsInPath(__dirname + "/scripts");
  addScriptsInPath(__dirname + "/Boop/Boop/Boop/scripts");
  const settings = vscode.workspace.getConfiguration("voop");
  if (settings.customScriptsFolderLocation && settings.customScriptsFolderLocation.trim().length > 0) {
    addScriptsInPath(settings.customScriptsFolderLocation);
  }
  if (settings.githubCustomScriptRepositories && settings.githubCustomScriptRepositories.trim().length > 0) {
    //addScriptsInPath(settings.customScriptsFolderLocation);
    const repositories = settings.githubCustomScriptRepositories.split(",");
    repositories.forEach(repository => {
      downloadRepositoryAsZip(repository);  
    });    
  }
}

// async function test(){
//   console.log(await authSettings.instance.getAuthData("test"));
//   await authSettings.instance.storeAuthData("test","verySecretSecret2");
//   console.log(await authSettings.instance.getAuthData("test"));
// }

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  authSettings.init(context);
  // test();
  loadScripts();
  let disposable = vscode.commands.registerCommand("voop.activate", function () {
    const quickPick = vscode.window.createQuickPick();
    quickPick.items = quickPickScriptList;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.onDidChangeSelection(async (selectedScripts) => {
      // the user canceled the selection
      if (!selectedScripts || selectedScripts.length === 0) {
        return;
      }
      const selectedScript = selectedScripts[0];

      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      const document = activeEditor.document;

      const wholeDocumentText = document.getText();
      const selectedText = document.getText(activeEditor.selection);

      let textToEdit = !selectedText || selectedText.length === 0 ? wholeDocumentText : selectedText;

      //additional input needed?
      let userInput = "";
      if (selectedScript.userInput) {
        userInput = await vscode.window.showInputBox({ placeHolder: selectedScript.userInputPlaceHolder ? selectedScript.userInputPlaceHolder : "" });
      }
      if (userInput === undefined) {
        //userInput was canceled, stop executing script
        return;
      }

      const script = fs.readFileSync(selectedScript.scriptPath, "utf8");
      let insertion = "";
      eval(script);
      let inputObj = {
        text: textToEdit,
        selection: selectedText,
        fullText: wholeDocumentText,
        userInput: userInput,
        postInfo: vscode.window.showInformationMessage,
        postError: vscode.window.showErrorMessage,
        insert: (text) => {
          insertion += text;
        },
      };
      main(inputObj);

      activeEditor.edit((editBuilder) => {
        if (insertion.length !== 0) {
          if (selectedText && selectedText.length > 0) {
            editBuilder.replace(activeEditor.selection, insertion);
          } else {
            editBuilder.insert(activeEditor.selection.start, insertion);
          }
        } else if (wholeDocumentText !== inputObj.fullText || !selectedText || selectedText.length === 0) {
          //fullText modified or no selection, replace whole document
          const textForReplacement = inputObj.text !== textToEdit ? inputObj.text : inputObj.fullText;
          editBuilder.replace(
            new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end),
            textForReplacement
          );
        } else {
          //text is selected, replace selection
          const textForReplacement = inputObj.text !== textToEdit ? inputObj.text : inputObj.selection;
          editBuilder.replace(activeEditor.selection, textForReplacement);
        }
      });
      quickPick.hide();
    });
    quickPick.show();
  });

  let disposable2 = vscode.commands.registerCommand("voop.reloadScripts", function () {
    loadScripts();
    vscode.window.showInformationMessage("Voop Scripts Reloaded");
  });

  let disposable3 = vscode.commands.registerCommand("voop.deleteGithubSecret", async function () {
    const secretKey = await vscode.window.showInputBox({placeHolder: "Input github domain for which to delete secret, e.g.: github.com"});
    if (secretKey === undefined) {
      //userInput was canceled, stop executing script
      return;
    }
    const successful = await authSettings.instance.deleteAuthData(secretKey);
    if(successful){
      vscode.window.showInformationMessage(`Secret stored under key '${secretKey}' deleted`);
    } else {
      vscode.window.showErrorMessage(`Secret stored under key '${secretKey}' could not be deleted.`);
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
  context.subscriptions.push(disposable3);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
