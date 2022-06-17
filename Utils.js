const fs = require("fs");
const vscode = require("vscode");

module.exports = class Utils {
  static pathEqual(actual, expected) {
    return actual === expected || this.normalizePath(actual) === this.normalizePath(expected);
  }

  static normalizePath(path) {
    const replace = [
      [/\\/g, "/"],
      [/(\w):/, "/$1"],
      [/(\w+)\/\.\.\/?/g, ""],
      [/^\.\//, ""],
      [/\/\.\//, "/"],
      [/\/\.$/, ""],
      [/\/$/, ""],
    ];

    replace.forEach((array) => {
      while (array[0].test(path)) {
        path = path.replace(array[0], array[1]);
      }
    });

    return path.toLowerCase();
  }

  static async loadScripts(quickPickScriptList, gitHubDownloadUtil) {
    quickPickScriptList = [];
    const settings = vscode.workspace.getConfiguration("voop");
    if (settings.customScriptsFolderLocation && settings.customScriptsFolderLocation.trim().length > 0) {
      quickPickScriptList = this.addScriptsInPath(settings.customScriptsFolderLocation, quickPickScriptList);
    }
    if (settings.githubCustomScriptRepositories && settings.githubCustomScriptRepositories.trim().length > 0) {
      const repositories = settings.githubCustomScriptRepositories.split(",");
      for (let i = 0; i < repositories.length; i++) {
        const repository = repositories[i];
        try {
          const downloadPath = await gitHubDownloadUtil.downloadRepositoryAsZip(repository);
          quickPickScriptList = this.addScriptsInPath(downloadPath, quickPickScriptList);
        } catch (error) {
          vscode.window.showErrorMessage(`Voop: Couldn't download custom scripts from repository: ${repository}`);
        }
      }
    }
    quickPickScriptList = this.addScriptsInPath(__dirname + "/scripts", quickPickScriptList);
    quickPickScriptList = this.addScriptsInPath(__dirname + "/Boop/Boop/Boop/scripts", quickPickScriptList);
    return quickPickScriptList;
  }

  static addScriptsInPath(path, quickPickScriptList) {
    let scripts = fs.readdirSync(path);
    for (let i = 0; i < scripts.length; i++) {
      const item = scripts[i];
      if (item.endsWith(".js")) {
        const scriptPath = (path + "/" + item).replace(/\\/g, "/");
        const scriptContent = fs.readFileSync(scriptPath, "utf8");
        try {
          const declaration = JSON.parse(scriptContent.substring(scriptContent.indexOf("{"), scriptContent.indexOf("}") + 1).replace(/,\s+}$/, "}"));
          if (!quickPickScriptList.find((s) => s.scriptName === declaration.name)) {
            quickPickScriptList.push({
              scriptName: declaration.name,
              label: `${declaration.name}${declaration.userInput ? " 👤" : ""}${declaration.multiFile ? " 📚" : ""}`,
              description: declaration.description,
              detail: declaration.tags,
              scriptPath: scriptPath,
              scriptFileName: scriptPath.substring(scriptPath.lastIndexOf("/") + 1),
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
    return quickPickScriptList;
  }
};
