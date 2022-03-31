// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
let quickPickScriptList = [];

function addScriptsInPath(path) {
    let scripts = fs.readdirSync(path);
    for (let i = 0; i < scripts.length; i++) {
      let item = scripts[i];
      quickPickScriptList.push({
        label: item,
        description: item,
		scriptPath: (path + "/" + item).replace(/\\/g, "/"),
      });
    }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  addScriptsInPath(__dirname + "/Boop/Boop/Boop/Scripts");
  const settings = vscode.workspace.getConfiguration("voop");
  if (settings.customScriptsFolderLocation) {
	addScriptsInPath(settings.customScriptsFolderLocation);
  }
  //settings.customScriptsFolderLocation => default === null

  let disposable = vscode.commands.registerCommand("voop", function () {
    vscode.window.showQuickPick(quickPickScriptList).then((selectedScript) => {
      // the user canceled the selection
      if (!selectedScript) {
        return;
      }

      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor) {
        return;
      }
      const document = activeEditor.document;

      const wholeDocumentText = document.getText();
      const selectedText = document.getText(activeEditor.selection);

      let textToEdit = !selectedText || selectedText.length === 0 ? wholeDocumentText : selectedText;

      const script = fs.readFileSync(selectedScript.scriptPath, "utf8");
      eval(script);
      let inputObj = {
        text: textToEdit,
        selection: selectedText,
        fullText: wholeDocumentText,
        postInfo: vscode.window.showInformationMessage,
        postError: vscode.window.showErrorMessage,
      };
      main(inputObj);

      activeEditor.edit((editBuilder) => {
        if (!selectedText || selectedText.length === 0) {
          //no selection, replace whole document
          editBuilder.replace(new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end), inputObj.text);
        } else {
          //text is selected, replace selection
          editBuilder.replace(activeEditor.selection, inputObj.text);
        }
      });
    });
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
