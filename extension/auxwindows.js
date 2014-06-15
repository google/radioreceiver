// Copyright 2013 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Functions for managing auxiliary windows.
 */
var AuxWindows = (function() {

  /**
   * Shows a window to save a preset.
   * @param {number} frequency The current frequency.
   * @param {Object} presets The current presets.
   */
  function savePreset(frequency, presets) {
    chrome.app.window.create('savedialog.html', {
        'bounds': {
          'width': 300,
          'height': 120
        },
        'resizable': false
      }, function(win) {
        win.contentWindow['opener'] = window;
        var stationData = {
          'frequency': frequency
        };
        if (frequency in presets) {
          stationData['name'] = presets[frequency];
        }
        win.contentWindow['station'] = stationData;
    });
  }

  /**
   * Shows a window to change the application settings.
   * @param {Object} settings The current settings.
   */
  function settings(settings) {
    chrome.app.window.create('settings.html', {
        'bounds': {
          'width': 350,
          'height': 220
        },
        'resizable': false
      }, function(win) {
        win.contentWindow['opener'] = window;
        win.contentWindow['settings'] = settings;
    });
  }

  /**
   * Shows a window for the frequency correction factor estimator.
   * @param {AppWindow} mainWindow The app's main window.
   */
  function estimatePpm(mainWindow) {
    chrome.app.window.create('estimateppm.html', {
        'bounds': {
          'width': 350,
          'height': 250
        },
        'resizable': false
      }, function(win) {
        win.contentWindow['opener'] = window;
        win.contentWindow['mainWindow'] = mainWindow;
    });  
  }

  /**
   * Shows an error window.
   * @param {string} msg The error message to show.
   */
  function error(msg) {
    chrome.app.window.create('error.html', {
        'bounds': {
          'width': 500,
          'height': 125
        },
        'resizable': false
      }, function(win) {
        win.contentWindow['opener'] = window;
        win.contentWindow['errorMsg'] = msg;
    });
  }

  /**
   * Shows the help window.
   */
  function help(msg) {
    chrome.app.window.create('help.html', {
        'bounds': {
          'width': 500,
          'height': 500
        },
        'resizable': false
      });
  }

  /**
   * Resizes the current window to the given dimensions, compensating for zoom.
   * @param {number} width The desired width.
   * @param {number} height The desired height.
   */
  function resizeCurrentTo(width, height) {
    // If the user has set a custom zoom level, resize the window to fit
    var zoom = chrome.app.window.current().getBounds().width / window.innerWidth;
    chrome.app.window.current().resizeTo(width * zoom, height * zoom);
  }

  /**
   * Closes the current window.
   */
  function closeCurrent() {
    chrome.app.window.current().close();
  }

  return {
    savePreset: savePreset,
    settings: settings,
    estimatePpm: estimatePpm,
    error: error,
    help: help,
    resizeCurrentTo: resizeCurrentTo,
    closeCurrent: closeCurrent
  };

})();
