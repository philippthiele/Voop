// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
require("module-alias/register");
const authSettings = require("./AuthSettings");
const gitHubDownloadUtil = require("./GitHubDownloadUtil");
let quickPickScriptList = [];
const undoStack = [];
const voopExtDir = vscode.extensions.getExtension("PhilippT.voop").extensionPath;

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
            label: `${declaration.name}${declaration.userInput ? " 👤" : ""}${declaration.multiFile ? " 📚" : ""}`,
            description: declaration.description,
            detail: declaration.tags,
            scriptPath: scriptPath,
            userInput: declaration.userInput,
            userInputPlaceHolder: declaration.userInputPlaceHolder,
            multiFile: declaration.multiFile,
          });
        } else {
          console.debug(`Voop: Script with name '${declaration.name}' exists twice, not adding second instance.`);
        }
      } catch (e) {
        console.error(`Voop: Couldn't load script ${item}`, e);
      }
    }
  }
  quickPickScriptList.sort(function (a, b) {
    let x = a.label.toLowerCase();
    let y = b.label.toLowerCase();
    if (x < y) {
      return -1;
    }
    if (x > y) {
      return 1;
    }
    return 0;
  });
}

async function loadScripts() {
  quickPickScriptList = [];
  addScriptsInPath(__dirname + "/scripts");
  addScriptsInPath(__dirname + "/Boop/Boop/Boop/scripts");
  const settings = vscode.workspace.getConfiguration("voop");
  if (settings.customScriptsFolderLocation && settings.customScriptsFolderLocation.trim().length > 0) {
    addScriptsInPath(settings.customScriptsFolderLocation);
  }
  if (settings.githubCustomScriptRepositories && settings.githubCustomScriptRepositories.trim().length > 0) {
    const repositories = settings.githubCustomScriptRepositories.split(",");
    for (let i = 0; i < repositories.length; i++) {
      const repository = repositories[i];
      try {
        const downloadPath = await gitHubDownloadUtil.downloadRepositoryAsZip(repository);
        addScriptsInPath(downloadPath);
      } catch (error) {
        vscode.window.showErrorMessage(`Voop: Couldn't download custom scripts from repository: ${repository}`);
      }
    }
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  authSettings.init(context);
  gitHubDownloadUtil.init(authSettings);
  loadScripts();

  if (process.env.VOOP_DEBUG_WORKSPACE) {
    vscode.workspace.updateWorkspaceFolders(0, 0, {
      uri: vscode.Uri.file(process.env.VOOP_DEBUG_WORKSPACE),
    });
  }

  let disposable = vscode.commands.registerCommand("voop.activate", function (clickedFile, allSelectedFiles) {
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

      let script = fs.readFileSync(selectedScript.scriptPath, "utf8");
      if (process.env.VOOP_DEBUG === "true") {
        const declarationPart = script.substring(0, script.indexOf("**/") + 3);
        const functionPart = script.substring(script.indexOf("**/") + 3);
        const functionStart = functionPart.substring(0, functionPart.indexOf("{") + 1);
        const functionBody = functionPart.substring(functionPart.indexOf("{") + 1);
        script = declarationPart + functionStart + "\ndebugger;" + functionBody;
      }
      eval(script);

      let insertion = "";
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

      if (allSelectedFiles !== undefined) {
        //triggered via explorer right click menu item
        const selectedFiles = [];
        const ignoredSelections = [];
        allSelectedFiles.map((file) => {
          const fileName = file.path.substring(file.path.lastIndexOf("/") + 1);
          if (fs.lstatSync(file.fsPath).isFile()) {
            selectedFiles.push({
              name: fileName,
              path: file.fsPath, //not to be used by scripts, only for voop write-back purposes
              text: fs.readFileSync(file.fsPath, "utf8"),
            });
          } else {
            ignoredSelections.push(fileName);
          }
        });
        inputObj.files = selectedFiles;
        if (ignoredSelections.length > 0) vscode.window.showWarningMessage(`Voop: Ignoring directories in selection: ${ignoredSelections.join()}.`);
      }

      if (!inputObj.files && !selectedScript.multiFile) {
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
      } else if (selectedScript.multiFile) {
        if (inputObj.files && inputObj.files.length > 1) {
          inputObj.text = "";
          inputObj.fullText = "";
          inputObj.selection = "";
          main(inputObj);
          const newFileText = insertion.length > 0 ? insertion : inputObj.text.length > 0 ? inputObj.text : inputObj.fullText;
          vscode.workspace.openTextDocument({ content: newFileText }).then((document) => {
            vscode.window.showTextDocument(document);
          });
        } else {
          vscode.window.showErrorMessage("Voop: Selected script functions only with multiple files selected via context menu.");
        }
      } else {
        const lastFileState = [];
        for (const file of inputObj.files) {
          const originalText = file.text;
          let insertion = "";
          let fileInputObj = {
            text: file.text,
            selection: "",
            fullText: file.text,
            userInput: inputObj.userInput,
            postInfo: vscode.window.showInformationMessage,
            postError: vscode.window.showErrorMessage,
            insert: (text) => {
              insertion += text;
            },
          };
          main(fileInputObj);
          if (insertion.length !== 0) {
            try {
              fs.appendFileSync(file.path, `\n${insertion}`);
            } catch (e) {
              vscode.window.showErrorMessage(`Voop: Couldn't append insertions to file: ${file.path}`);
            }
          } else if (originalText !== fileInputObj.text || originalText !== fileInputObj.fullText) {
            //fullText or text modified, replace whole document
            const textForReplacement = fileInputObj.text !== originalText ? fileInputObj.text : fileInputObj.fullText;
            try {
              fs.writeFileSync(file.path, textForReplacement);
            } catch (e) {
              vscode.window.showErrorMessage(`Voop: Couldn't write changes to file: ${file.path}`);
            }
          } else {
            continue;
          }
          lastFileState.push({
            path: file.path,
            text: originalText,
          });
        }
        if (lastFileState.length > 0) {
          undoStack.push(lastFileState);
        }
        if (undoStack.length > 5) {
          undoStack.shift();
        }
      }
      quickPick.hide();
    });
    quickPick.show();
  });

  let disposable2 = vscode.commands.registerCommand("voop.reloadScripts", function () {
    loadScripts();
    vscode.window.showInformationMessage("Voop Scripts Reloaded");
  });

  let disposable3 = vscode.commands.registerCommand("voop.deleteGithubSecret", async function () {
    const secretKey = await vscode.window.showInputBox({ placeHolder: "Input github domain for which to delete secret, e.g.: github.com" });
    if (secretKey === undefined) {
      //userInput was canceled, stop executing script
      return;
    }
    const successful = await authSettings.instance.deleteAuthData(secretKey);
    if (successful) {
      vscode.window.showInformationMessage(`Secret stored under key '${secretKey}' deleted`);
    } else {
      vscode.window.showErrorMessage(`Secret stored under key '${secretKey}' could not be deleted.`);
    }
  });

  let disposable4 = vscode.commands.registerCommand("voop.undo", async function () {
    if (undoStack.length === 0) {
      vscode.window.showInformationMessage("Voop: Nothing saved to undo");
      return;
    }
    const lastFileState = undoStack.pop();
    const backupOfFailedUndos = [];
    for (const file of lastFileState) {
      try {
        fs.writeFileSync(file.path, file.text);
      } catch (e) {
        console.error(`Voop: Couldn't write changes to file: ${file.path}. Error: ${e}`);
        backupOfFailedUndos.push(file);
      }
    }
    if (backupOfFailedUndos.length > 0) {
      vscode.window.showErrorMessage(
        `Voop: Couldn't undo changes to files (write failed), putting them back on undo stack: ${backupOfFailedUndos.map((file) => file.path).join()}`
      );
      undoStack.push(backupOfFailedUndos);
    }
    vscode.window.showInformationMessage("Voop: Undo successful");
  });

  let disposable5 = vscode.commands.registerCommand("voop.startDebugging", function (clickedFile, allSelectedFiles) {
    let fileToOpen = "";
    let folderToOpen = undefined;
    const env = {
      VOOP_DEBUG: "true"
    }
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      folderToOpen =  vscode.workspace.workspaceFolders[0].uri.fsPath + "/";
      folderToOpen = folderToOpen.replace(/\\/g, "/");
      env.VOOP_DEBUG_WORKSPACE = folderToOpen;
    }
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document && vscode.window.activeTextEditor.document.uri) {
      fileToOpen = vscode.window.activeTextEditor.document.uri.fsPath;
      fileToOpen = fileToOpen.replace(/\\/g, "/");
    }
    if (process.env.VOOP_DEBUG === "true") {
      vscode.window.showInformationMessage("Voop: Debug session already started");
      return;
    }
    vscode.debug.startDebugging(undefined, {
      name: "voop",
      type: "extensionHost",
      request: "launch",
      args: [
        fileToOpen,
        `--extensionDevelopmentPath=${voopExtDir}`
      ],
      env: env
    });
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
  context.subscriptions.push(disposable3);
  context.subscriptions.push(disposable4);
  context.subscriptions.push(disposable5);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
