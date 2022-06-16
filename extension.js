// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
require("module-alias/register");
const authSettings = require("./AuthSettings");
const gitHubDownloadUtil = require("./GitHubDownloadUtil");
const utils = require("./Utils");
let quickPickScriptList = [];
const undoStack = [];
const voopExtDir = vscode.extensions.getExtension("PhilippT.voop").extensionPath;
let importedScripts = {};
const requireFromString = require('require-from-memory').requireFromString;

/**
 * @param {vscode.ExtensionContext} context
 */
 async function activate(context) {
  authSettings.init(context);
  gitHubDownloadUtil.init(authSettings);
  quickPickScriptList = await utils.loadScripts(quickPickScriptList, gitHubDownloadUtil);

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

      if (!importedScripts[selectedScript.scriptName] || process.env.VOOP_DEBUG === "true") { //when debug always re-read the script, because there could be changes
        let script = fs.readFileSync(selectedScript.scriptPath, "utf8");
        const voopScript = requireFromString(script + '\n\nfunction debug(input) {\n\tdebugger;\n\tmain(input);\n}\n\nmodule.exports = { "main": main, "debug": debug }', selectedScript.scriptPath.substring(selectedScript.scriptPath.lastIndexOf("/") + 1));
        importedScripts[selectedScript.scriptName] = voopScript;
      }

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
        if (process.env.VOOP_DEBUG === "true") {
          importedScripts[selectedScript.scriptName].debug(inputObj);
        }
        else {
          importedScripts[selectedScript.scriptName].main(inputObj);
        }
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
          if (process.env.VOOP_DEBUG === "true") {
            importedScripts[selectedScript.scriptName].debug(inputObj);
          }
          else {
            importedScripts[selectedScript.scriptName].main(inputObj);
          }
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
          if (process.env.VOOP_DEBUG === "true") {
            importedScripts[selectedScript.scriptName].debug(fileInputObj);
          }
          else {
            importedScripts[selectedScript.scriptName].main(fileInputObj);
          }
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
    importedScripts = [];
    utils.loadScripts(quickPickScriptList, gitHubDownloadUtil);
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
      folderToOpen = vscode.workspace.workspaceFolders[0].uri.fsPath + "/";
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
        `--extensionDevelopmentPath=${voopExtDir}`,
        "--disable-extensions"
      ],
      env: env
    });

  });

  let disposable6 = vscode.commands.registerCommand("voop.openCustomScriptFolder", async function () {
    const settings = vscode.workspace.getConfiguration("voop");
    if(process.env.VOOP_DEBUG === "true"){
      vscode.window.showWarningMessage(`Can't open custom script folder in debugging session because of VSCode issue: https://github.com/microsoft/vscode/issues/78740`);
      return;
    }
    if (!settings.customScriptsFolderLocation || settings.customScriptsFolderLocation.trim().length === 0) {
      vscode.window.showInformationMessage(`Can't open custom script folder since none is defined in Voop Settings.`);
      return;
    }
    if(vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.some(folder => utils.pathEqual(folder.uri.fsPath, settings.customScriptsFolderLocation))){
      vscode.window.showInformationMessage(`Custom script folder already open in current workspace.`);
      return;
    }
    const indexToAddInWorkspace = !vscode.workspace.workspaceFolders ? 0 : vscode.workspace.workspaceFolders.length;
    const successful = await vscode.workspace.updateWorkspaceFolders(indexToAddInWorkspace, 0, {
      uri: vscode.Uri.file(settings.customScriptsFolderLocation),
    });
    if (successful) {
      vscode.window.showInformationMessage(`Successfully opened custom script folder in current workspace.`);
    } else {
      vscode.window.showErrorMessage(`Failed to open '${settings.customScriptsFolderLocation}' in current workspace.`);
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
  context.subscriptions.push(disposable3);
  context.subscriptions.push(disposable4);
  context.subscriptions.push(disposable5);
  context.subscriptions.push(disposable6);
}

function deactivate() { }

module.exports = {
  activate,
  deactivate,
};
