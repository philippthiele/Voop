// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
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
        quickPickScriptList.push({
          label: declaration.name,
          description: declaration.description,
          detail: declaration.tags,
          scriptPath: scriptPath,
        });
      } catch (e) {
        console.log(`Voop: Couldn't load script ${item}`, e);
      }
    }
  }
}

function loadScripts() {
  quickPickScriptList = [];
  addScriptsInPath(__dirname + "/Boop/Boop/Boop/scripts");
  const settings = vscode.workspace.getConfiguration("voop");
  if (settings.customScriptsFolderLocation) {
    addScriptsInPath(settings.customScriptsFolderLocation);
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  loadScripts();
  let disposable = vscode.commands.registerCommand("voop", function () {
    const quickPick = vscode.window.createQuickPick();
    quickPick.items = quickPickScriptList;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.onDidChangeSelection((selectedScripts) => {
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

      const script = fs.readFileSync(selectedScript.scriptPath, "utf8");
      let insertion = "";
      eval(script);
      let inputObj = {
        text: textToEdit,
        selection: selectedText,
        fullText: wholeDocumentText,
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
        } else if (!selectedText || selectedText.length === 0) {
          //no selection, replace whole document
          editBuilder.replace(new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end), inputObj.text);
        } else {
          //text is selected, replace selection
          editBuilder.replace(activeEditor.selection, inputObj.text);
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
