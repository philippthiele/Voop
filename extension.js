// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const https = require("https");
const yauzl = require("yauzl");
const { settings } = require("cluster");
require("module-alias/register");
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

function downloadRepositoryAsZip(repoUrl, githubPersonalAccessToken) {
  const githubUrlWithoutHttps = repoUrl.substring(repoUrl.indexOf("//") + 2);
  const githubDomain = githubUrlWithoutHttps.substring(0, githubUrlWithoutHttps.indexOf("/"));
  const ownerAndRepo = githubUrlWithoutHttps.substring(githubUrlWithoutHttps.indexOf("/") + 1);
  const apiDownloadUrl = `https://api.${githubDomain}/repos/${ownerAndRepo}/zipball`;
  function handleResponse(response) {
    if (response.statusCode === 302) {
      return https.get(requestOptionsFromUrl(response.headers.location), handleResponse);
    } else if(response.statusCode !== 200) {
      console.error(`Voop: Couldn't download custom scripts from repository ${repoUrl}. HTTP status code: ${response.statusCode}`);
      return;
    }
    const voopExtDir = vscode.extensions.getExtension("PhilippT.voop").extensionPath;
    if (!fs.existsSync(`${voopExtDir}/githubScripts`)) {
      fs.mkdirSync(`${voopExtDir}/githubScripts`);
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
      .createWriteStream(`${voopExtDir}/githubScripts/customScriptsFromGitHub.zip`)
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
        fs.readdir(`${voopExtDir}/githubScripts`, (err, files) => {
          if (err) {
            console.log(`An error occured while reading directory ${voopExtDir}/githubScripts: ${err}`);
            return;
          }
          for (const file of files) {
            if (file != "customScriptsFromGitHub.zip") {
              fs.unlink(path.join(`${voopExtDir}/githubScripts`, file), (err) => {
                if (err) {
                  console.log(`An error occured while deleting file ${voopExtDir}/githubScripts/${file}: ${err}`);
                }
              });
            }
          }
          yauzl.open(`${voopExtDir}/githubScripts/customScriptsFromGitHub.zip`, { lazyEntries: true }, function (err, zipfile) {
            if (err) {
              console.error(`An error occured while opening zip file ${voopExtDir}/githubScripts/customScriptsFromGitHub.zip: ${err}`);
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
                    var writeStream = fs.createWriteStream(`${voopExtDir}/githubScripts/${entry.fileName.substring(entry.fileName.lastIndexOf("/") + 1)}`);
                    readStream.pipe(writeStream);
                  });
                } else {
                  zipfile.readEntry();
                }
              }
            });
            zipfile.on("close", function () {
              addScriptsInPath(`${voopExtDir}/githubScripts`);
              console.log("Loaded Voop custom scripts from github repository.");
            });
          });
        });
      });

    response.pipe(writer);
  }
  const req = https.get(requestOptionsFromUrl(apiDownloadUrl, githubPersonalAccessToken), handleResponse);
  req.on('error', error => {
    if(error.code && error.code === 'ENOTFOUND'){
      //try /api/v3 path for enterprise github
      const apiDownloadUrl = `https://${githubDomain}/api/v3/repos/${ownerAndRepo}/zipball`;
      const req = https.get(requestOptionsFromUrl(apiDownloadUrl, githubPersonalAccessToken), handleResponse);
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
  if (settings.githubCustomScriptRepository && settings.githubCustomScriptRepository.trim().length > 0) {
    //addScriptsInPath(settings.customScriptsFolderLocation);
    downloadRepositoryAsZip(settings.githubCustomScriptRepository, settings.githubPersonalAccessToken);
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
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

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
