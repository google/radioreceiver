// Copyright 2014 Google Inc. All rights reserved.
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
 * Presets and saved stations.
 * @param {Object} opt_presets The optional initial set of presets.
 * @constructor
 */
function Presets(opt_presets) {

  /**
   * The station presets. Maps from frequency to a saved station's settings.
   */
  var presets = opt_presets || {};

  /**
   * The functions that listen for changes in the presets.
   */
  var listeners = [];

  /**
   * Loads the presets from the cloud.
   * @param {function} callback A function to call after loading the presets.
   */
  function load(callback) {
    chrome.storage.local.get('presets', function(cfg) {
      if (cfg['presets']) {
        importPresets(cfg['presets']);
        chrome.storage.onChanged.addListener(reload);
        callback && callback();
      } else {
        chrome.storage.sync.get('presets', function(cfg) {
          var info = cfg['presets'] || {};
          importPresets(info);
          save(function() {
            chrome.storage.onChanged.addListener(reload);
            callback && callback();
          });
        });
      }
    });
  }

  /**
   * Saves the presets in the cloud.
   * @param {function} callback A function to call after saving the presets.
   */
  function save(callback) {
    chrome.storage.local.set(exportPresets(), callback);
  }

  /**
   * Reloads the presets when someone has modified them.
   * @param {Object} changes The changes made in the storage area.
   * @param {string} areaName The area the changes were made in.
   */
  function reload(changes, areaName) {
    if (areaName != 'local') {
      return;
    }
    var presetChange = changes['presets'];
    if (!presetChange) {
      return;
    }
    importPresets(presetChange['newValue']);
    for (var i = 0; i < listeners.length; ++i) {
      listeners[i]();
    }
  }

  /**
   * Adds a function to listen for changes in the presets.
   * @param {Function} fun The function to call when there's a change.
   */
  function addListener(fun) {
    listeners.push(fun);
  }

  /**
   * Imports the presets from the given object.
   * @param {Object} obj The object to import the presets from.
   */
  function importPresets(obj) {
    if (obj['version'] != 1) {
      var band = Bands['WW']['FM'];
      presets = {};
      for (var key in obj) {
        var freq = String(key * 1e6);
        presets[freq] = {
          name: obj[key],
          display: band.toDisplayName(freq, true),
          band: band.getName(),
          mode: band.getMode()
        };
      }
    } else {
      presets = obj['stations'];
    }    
  }

  /**
   * Exports the presets to the given object.
   * @return {Object} The exported presets.
   */
  function exportPresets(obj) {
    return {
      presets: {
        version: 1,
        stations: presets
      }
    };
  }

  /**
   * Gets a preset, or a list of all presets.
   * @param {number=} opt_frequency The frequency to get, or undefined to
   *     get all presets.
   * @return {Object} The presets.
   */
  function get(opt_frequency) {
    if (opt_frequency != null) {
      return presets[opt_frequency];
    } else {
      return presets;
    }
  }

  /**
   * Sets the value of a preset.
   * @param {number} frequency The preset's frequency.
   * @param {string} display The preset frequency's display name.
   * @param {string} name The station's name.
   * @param {string} band The name of the band.
   * @param {Object} mode A description of the modulation scheme.
   */
  function set(frequency, display, name, band, mode) {
    presets[frequency] = {
      name: name,
      display: display,
      band: band,
      mode: mode
    };
  }

  /**
   * Removes a preset.
   * @param {number} frequency The preset's frequency.
   */
  function remove(frequency) {
    delete presets[frequency];
  }

  /**
   * Calculates the difference between the current presets and a different
   * set of presets.
   * @param {Presets} other The presets object to get the difference.
   * @return {add:Presets,del:Presets,changeAdd:Presets,changeDel:Presets}
   *     An object containing four sets of presets: 'add' with the presets that
   *     appear in "other" but not in the current set, 'del' with the presets
   *     that appear in the current set but not in "other", and finally
   *     'changeAdd' and 'changeDel' with the presets that changed from one
   *     set to the other.
   */
  function diff(other) {
    var these = get();
    var those = other.get();
    var add = {};
    var del = {};
    var changeAdd = {};
    var changeDel = {};
    for (var freq in these) {
      var myPreset = these[freq];
      var theirPreset = those[freq];
      if (theirPreset) {
        if (!areEqual(myPreset, theirPreset)) {
          changeDel[freq] = myPreset;
          changeAdd[freq] = theirPreset;
        }
      } else {
        del[freq] = myPreset;
      }
    }
    for (var freq in those) {
      var myPreset = these[freq];
      var theirPreset = those[freq];
      if (!myPreset) {
        add[freq] = theirPreset;
      }
    }
    return {
      add: new Presets(add),
      del: new Presets(del),
      changeAdd: new Presets(changeAdd),
      changeDel: new Presets(changeDel)
    };
  }

  /**
   * Checks if two objects have the same contents.
   */
  function areEqual(a, b) {
    if (typeof a !== typeof b) {
      return false;
    }
    if ("string" === typeof a || "number" === typeof a
        || "undefined" === typeof a || a === null) {
      return a === b;
    }
    if ("function" === typeof a) {
      return false;
    }
    for (var k in a) {
      if (!areEqual(a[k], b[k])) {
        return false;
      }
    }
    for (var k in b) {
      if (!areEqual(a[k], b[k])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Bulk-adds and removes presets from the current set.
   * @param {Presets} del The presets to remove.
   * @param {Presets} add The presets to add.
   */
  function change(del, add) {
    var these = get();
    var toDelete = del.get();
    var toAdd = add.get();
    for (var freq in toDelete) {
      remove(freq);
    }
    for (var freq in toAdd) {
      var preset = toAdd[freq];
      set(freq, preset.display, preset.name, preset.band, preset.mode);
    }
  }

  return {
    load: load,
    save: save,
    addListener: addListener,
    get: get,
    set: set,
    remove: remove,
    diff: diff,
    change: change,
    importPresets: importPresets,
    exportPresets: exportPresets
  };
}

