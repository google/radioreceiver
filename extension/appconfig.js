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
 * Application configuration.
 * @constructor
 */
function AppConfig() {

  var config = {
    version: 1,
    /** Application settings. */
    settings: {
      /** World region. */
      region: 'WW',
      /** Frequency correction factor, parts per million. */
      ppm: 0,
      /** Tuner gain. */
      gain: {
        auto: true,
        value: 0
      },
      /** Upconverter. */
      upconverter: {
        enable: false,
        frequency: 125000000
      },
      /** Whether free tuning is enabled. */
      freeTuning: false
    },
    /** Current state. */
    state: {
      /** Audio volume, from 0 to 1. */
      volume: 1,
      /** Currently active band name. */
      bandName: 'FM',
      /** Map from band name to selected frequency. */
      bandFrequencies: {},
      /** Current mode in free tuning. */
      modeName: 'WBFM',
      /** Map from mode name to settings. */
      modeConfigs: {}
    }
  };

  function getRegion() {
    return config.settings.region;
  }

  function getRegionBands() {
    return Bands[getRegion()] || Bands['WW'];
  }

  function selectRegion(region) {
    config.settings.region = region;
  }

  function getPpm() {
    return config.settings.ppm;
  }

  function setPpm(ppm) {
    config.settings.ppm = Number(ppm) || 0;
  }

  function isAutoGain() {
    return config.settings.gain.auto;
  }

  function setAutoGain(auto) {
    config.settings.gain.auto = !!auto;
  }

  function getGain() {
    return config.settings.gain.value;
  }

  function isUpconverterEnabled() {
    return config.settings.upconverter.enable;
  }

  function enableUpconverter(enabled) {
    config.settings.upconverter.enable = !!enabled;
  }

  function getUpconverterFrequency() {
    return config.settings.upconverter.frequency;
  }

  function setUpconverterFrequency(frequency) {
    config.settings.upconverter.frequency = Number(frequency) || 0;
  }

  function isFreeTuningEnabled() {
    return config.settings.freeTuning;
  }

  function enableFreeTuning(enabled) {
    config.settings.freeTuning = !!enabled;
  }

  function setGain(gain) {
    config.settings.gain.value = Math.max(0, gain) || 0;
  }

  function getBandName() {
    if (isFreeTuningEnabled()) {
      return config.state.bandName;
    } else {
      return config.state.bandName || 'FM';
    }
  }

  function getCurrentBand() {
    var bandName = getBandName();
    if (bandName) {
      return getRegionBands()[bandName] || getRegionBands()['FM'];
    } else {
      var modeConfig = getCurrentMode();
      return Band('', 0, 9999999999, modeConfig.step, modeConfig.params);
    }
  }

  function isAllowedBand(bandName) {
    var bands = getRegionBands();
    if (!bandName) {
      return isFreeTuningEnabled();
    }
    if (!bands[bandName]) {
      return false;
    }
    return !bands[bandName].getMode().upconvert || isUpconverterEnabled();
  }

  function selectBand(bandName) {
    config.state.bandName = bandName;
  }

  function setFrequency(frequency) {
    config.state.bandFrequencies[getBandName()] = (1 * frequency) || 0;
  }

  function getFrequency() {
    return config.state.bandFrequencies[getBandName()] || 0;
  }

  function getCurrentMode() {
    return config.state.modeConfigs[config.state.modeName] || {
      step: 10000,
      params: DefaultModes[config.state.modeName]
    };
  }

  function selectMode(modeName) {
    config.state.modeName = modeName;
  }

  function updateCurrentMode(settings) {
    config.state.modeConfigs[config.state.modeName] = settings;
  }

  function getVolume() {
    return config.state.volume;
  }

  function setVolume(volume) {
    config.state.volume = Math.min(1, Math.max(0, volume)) || 0;
  }

  function load(callback) {
    chrome.storage.local.get('AppConfig', function(cfg) {
      if (cfg['AppConfig']) {
        var newCfg = cfg['AppConfig'];
        if (newCfg.version >= 1) {
          config.settings.region = newCfg.settings.region;
          config.settings.ppm = newCfg.settings.ppm;
          config.settings.gain.auto = newCfg.settings.gain.auto;
          config.settings.gain.value = newCfg.settings.gain.value;
          config.settings.upconverter.enable =
              newCfg.settings.upconverter.enable;
          config.settings.upconverter.frequency =
              newCfg.settings.upconverter.frequency;
          config.settings.freeTuning = newCfg.settings.freeTuning;
          config.state.volume = newCfg.state.volume;
          config.state.bandName = newCfg.state.bandName;
          config.state.bandFrequencies = newCfg.state.bandFrequencies;
          config.state.modeName = newCfg.state.modeName;
          config.state.modeConfigs = newCfg.state.modeConfigs;
        }
        callback();
      } else {
        loadLegacy(callback);
      }
    });
  }

  function save() {
    chrome.storage.local.set({'AppConfig': config});
  }

  function loadLegacy(callback) {
    chrome.storage.local.get('currentStation', function(cfg) {
    var newCfg = cfg['currentStation'];
    if (newCfg) {
      if ('number' === typeof newCfg) {
        config.state.bandName = 'FM';
        config.state.bandFrequencies = {'FM': newCfg};
      } else {
        config.state.bandName = newCfg['currentBand'];
        config.state.bandFrequencies = newCfg['bands'];
      }
      chrome.storage.local.remove('currentStation');
    }

    chrome.storage.local.get('volume', function(cfg) {
    var newCfg = cfg['volume'];
    if (newCfg != null) {
      config.state.volume = newCfg;
      chrome.storage.local.remove('volume');
    }

    chrome.storage.local.get('settings', function(cfg) {
    var newCfg = cfg['settings'];
    if (newCfg) {
      config.settings.region = newCfg['region'];
      config.settings.ppm = newCfg['ppm'];
      config.settings.gain.auto = newCfg['autoGain'];
      config.settings.gain.value = newCfg['gain'];
      config.settings.upconverter.enable = newCfg['useUpconverter'];
      config.settings.upconverter.frequency = newCfg['upconverterFreq'];
      config.settings.freeTuning = newCfg['enableFreeTuning'];
      chrome.storage.local.remove('settings');
    }
    save();
    callback();
    })})});
  }

  return {
    load: load,
    save: save,
    settings: {
      region: {
        select: selectRegion,
        get: getRegion,
        getAvailableBands: getRegionBands
      },
      ppm: {
        set: setPpm,
        get: getPpm
      },
      gain: {
        setAuto: setAutoGain,
        isAuto: isAutoGain,
        set: setGain,
        get: getGain
      },
      upconverter: {
        enable: enableUpconverter,
        isEnabled: isUpconverterEnabled,
        set: setUpconverterFrequency,
        get: getUpconverterFrequency
      },
      freeTuning: {
        enable: enableFreeTuning,
        isEnabled: isFreeTuningEnabled
      }
    },
    state: {
      band: {
        isAllowed: isAllowedBand,
        select: selectBand,
        get: getCurrentBand
      },
      frequency: {
        set: setFrequency,
        get: getFrequency
      },
      mode: {
        select: selectMode,
        update: updateCurrentMode,
        get: getCurrentMode
      },
      volume: {
        set: setVolume,
        get: getVolume
      }
    }
  };
}

