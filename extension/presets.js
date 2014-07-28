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
 * @constructor
 */
function Presets() {

  /**
   * The station presets. Maps from frequency to a saved station's settings.
   */
  var presets = {};

  /**
   * Loads the presets from the cloud.
   * @param {function} callback A function to call after loading the presets.
   */
  function load(callback) {
    chrome.storage.sync.get('presets', function(cfg) {
      var info = cfg['presets'] || {};
      if (info['version'] != 1) {
        var band = Bands['WW']['FM'];
        presets = {};
        for (var key in info) {
          var freq = String(key * 1e6);
          presets[freq] = {
            name: info[key],
            display: band.toDisplayName(freq, true),
            band: band.getName(),
            mode: band.getMode()
          };
        }
      } else {
        presets = info['stations'];
      }
      callback && callback();
    });
  }

  /**
   * Saves the presets in the cloud.
   * @param {function} callback A function to call after saving the presets.
   */
  function save(callback) {
    chrome.storage.sync.set({
      presets: {
        version: 1,
        stations: presets
      }
    }, callback);
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

  return {
    load: load,
    save: save,
    get: get,
    set: set,
    remove: remove
  };
}

