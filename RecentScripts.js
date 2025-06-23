const vscode = require("vscode");
const fs = require("fs");

let _extensionContext;
const RECENT_SCRIPTS_KEY = "voopRecentScripts";

module.exports = class RecentScripts {
  static init(context) {
    _extensionContext = context;
    
    // Initialize the recent scripts array if it doesn't exist
    if (!context.globalState.get(RECENT_SCRIPTS_KEY)) {
      context.globalState.update(RECENT_SCRIPTS_KEY, []);
    }
  }

  static async addToRecentScripts(scriptName) {
    const recentScripts = _extensionContext.globalState.get(RECENT_SCRIPTS_KEY) || [];
    
    // Remove the script if it's already in the list
    const updatedRecentScripts = recentScripts.filter(script => script !== scriptName);
    
    // Add the script to the beginning of the list
    updatedRecentScripts.unshift(scriptName);
    
    // Update the global state with the new list
    await _extensionContext.globalState.update(RECENT_SCRIPTS_KEY, updatedRecentScripts);
  }

  static getRecentScripts() {
    return _extensionContext.globalState.get(RECENT_SCRIPTS_KEY) || [];
  }

  static sortScriptsByRecentUsage(scriptList) {
    const settings = vscode.workspace.getConfiguration("voop");
    const sortByMostRecentlyUsed = settings.get("sortByMostRecentlyUsed", true);
    
    if (!sortByMostRecentlyUsed) {
      // Sort alphabetically if the setting is disabled
      return scriptList.sort((a, b) => {
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

    const recentScripts = this.getRecentScripts();
    
    // Sort the scripts by usage history
    return scriptList.sort((a, b) => {
      const aIndex = recentScripts.indexOf(a.scriptName);
      const bIndex = recentScripts.indexOf(b.scriptName);
      
      // If both scripts have been used before, sort by most recent
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If only one script has been used before, it should come first
      if (aIndex !== -1) {
        return -1;
      }
      if (bIndex !== -1) {
        return 1;
      }
      
      // If neither script has been used before, sort alphabetically
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
};
