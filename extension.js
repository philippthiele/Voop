// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
let customScripts = [];
let quickPickScriptList = [];

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const settings = vscode.workspace.getConfiguration("voop");
  if (settings.customScriptsFolderLocation) {
    //get files in customScriptsFolderLocation
    customScripts = fs.readdirSync(settings.customScriptsFolderLocation);
    for (let i = 0; i < customScripts.length; i++) {
      let item = customScripts[i];
      quickPickScriptList.push({
        label: item,
        description: item,
      });
    }
  }
  //settings.customScriptsFolderLocation => default === null

  let disposable = vscode.commands.registerCommand("voop", function () {
	vscode.window.showQuickPick(quickPickScriptList).then(selectedScript => {
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

		const scriptPath = path.join(settings.customScriptsFolderLocation, selectedScript.label);
		const script = fs.readFileSync(scriptPath, "utf8");
		eval(script);
		let inputObj = { text: textToEdit, selection: selectedText, fullText: wholeDocumentText };
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

		vscode.window.showInformationMessage(selectedScript.label);
	  });
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
