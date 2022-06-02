// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
require("module-alias/register");
const authSettings = require("./AuthSettings");
const gitHubDownloadUtil = require("./GitHubDownloadUtil");
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
