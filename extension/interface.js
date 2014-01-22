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
 * UI controller.
 * @param {RadioController} fmRadio The FM radio controller object.
 * @constructor
 */
function Interface(fmRadio) {

  /**
   * Settings.
   */
  var settings = {
    'region': 'WW'
  };

  /**
   * Minimum frequency in Hz.
   */
  var minFreq = 87500000;

  /**
   * Maximum frequency in Hz.
   */
  var maxFreq = 108000000;

  /**
   * Minimum step between frequencies in Hz.
   */
  var freqStep = 100000;

  /**
   * The station presets. Maps from frequency to station name.
   */
  var presets = {};

  /**
   * Updates the UI.
   */
  function update() {
    setVisible(powerOffButton, fmRadio.isPlaying());
    setVisible(powerOnButton, !fmRadio.isPlaying());
    frequencyDisplay.textContent = getFrequencyMHz();

    if (!fmRadio.isStereoEnabled()) {
      stereoIndicator.classList.add('stereoDisabled');
    } else if (!fmRadio.isStereo()) {
      stereoIndicator.classList.add('stereoUnavailable');
    } else {
      stereoIndicator.classList.remove('stereoDisabled');
      stereoIndicator.classList.remove('stereoUnavailable');
    }
    if (fmRadio.isScanning()) {
      bandLabel.classList.add('scanning');
    } else {
      bandLabel.classList.remove('scanning');
    }

    selectCurrentPreset();
  }

  /**
   * Makes an element visible or invisible.
   */
  function setVisible(element, visible) {
    element.style.visibility = visible ? 'visible' : 'hidden';
  }

  /**
   * Turns the radio on.
   * Called when the 'Power On' button is pressed.
   */
  function powerOn() {
    setVisible(powerOffButton, true);
    setVisible(powerOnButton, false);
    fmRadio.start();
  }

  /**
   * Turns the radio off.
   * Called when the 'Power Off' button is pressed.
   */
  function powerOff() {
    setVisible(powerOffButton, false);
    setVisible(powerOnButton, true);
    if (fmRadio.isPlaying()) {
      fmRadio.stop();
    }
    saveCurrentStation();
  }

  /**
   * Shows the frequency edit box.
   * Called when the frequency display is clicked.
   */
  function showFrequencyEditor() {
    frequencyInput.value = frequencyDisplay.textContent;
    setVisible(frequencyDisplay, false);
    setVisible(frequencyInput, true);
    frequencyInput.focus();
    frequencyInput.select();
  }

  /**
   * Hides the frequency edit box.
   * Called when the frequency is changed or the user clicks outside.
   */
  function hideFrequencyEditor() {
    setVisible(frequencyDisplay, true);
    setVisible(frequencyInput, false);
  }  

  /**
   * Tunes to another frequency.
   */
  function changeFrequency() {
    hideFrequencyEditor();
    setFrequency(frequencyInput.value * 1e6, false);
  }

  /**
   * Tunes one step down.
   * Called when the '<' button is pressed.
   */
  function frequencyMinus() {
    var newFreq = fmRadio.getFrequency() - freqStep;
    if (newFreq < minFreq) {
      newFreq = maxFreq;
    }
    setFrequency(newFreq, true);
  }

  /**
   * Tunes one step up.
   * Called when the '>' button is pressed.
   */
  function frequencyPlus() {
    var newFreq = fmRadio.getFrequency() + freqStep;
    if (newFreq > maxFreq) {
      newFreq = minFreq;
    }
    setFrequency(newFreq, true);
  }

  /**
   * Scans the FM band downwards.
   * Called when the 'Scan <<' button is pressed.
   */
  function scanDown() {
    fmRadio.scan(minFreq, maxFreq, -freqStep);
  }

  /**
   * Scans the FM band upwards.
   * Called when the 'Scan >>' button is pressed.
   */
  function scanUp() {
    fmRadio.scan(minFreq, maxFreq, freqStep);
  }

  /**
   * Enables or disables stereo.
   * Called when the stereo icon is clicked.
   */
  function toggleStereo() {
    fmRadio.enableStereo(!fmRadio.isStereoEnabled());
  }

  /**
   * Loads the presets from the cloud.
   */
  function loadPresets() {
    chrome.storage.sync.get('presets', function(cfg) {
      presets = cfg['presets'] || {};
      displayPresets();
    });
  }

  /**
   * Saves the presets into the cloud.
   */
  function savePresets() {
    chrome.storage.sync.set({'presets': presets}, displayPresets);
  }

  /**
   * Updates the preset selection box.
   */
  function displayPresets() {
    var freqs = [];
    for (var freq in presets) {
      freqs.push(freq);
    }
    freqs.sort(function(a,b) { return Number(a) - Number(b) });
    while (presetsBox.options.length > 0) {
      presetsBox.options.remove(0);
    }
    presetsBox.options.add(createOption('', '\u2014 Saved stations \u2014'));
    for (var i = 0; i < freqs.length; ++i) {
      presetsBox.options.add(createOption(freqs[i], freqs[i] + ' - ' + presets[freqs[i]]));
    }
    selectCurrentPreset();
  }

  /**
   * Makes the preset for the current frequency selected.
   */
  function selectCurrentPreset() {
    var frequency = getFrequencyMHz();
    for (var i = 0; i < presetsBox.options.length; ++i) {
      presetsBox.options[i].selected = (presetsBox.options[i].value == frequency);
    }
  }

  /**
   * Creates an option for a select box.
   */
  function createOption(value, label) {
    var option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  /**
   * Tunes to a preset.
   * Called when a preset is selected by the user.
   */
  function selectPreset() {
    setFrequency(presetsBox.value * 1e6, false);
  }

  /**
   * Gets the name of the current station and saves it as a preset.
   * Called when the 'Save' button is pressed.
   */
  function savePreset() {
    chrome.app.window.create('savedialog.html', {
        'bounds': {
          'width': 400,
          'height': 100
        },
        'resizable': false
      }, function(win) {
        var frequency = getFrequencyMHz();
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
   * Deletes the preset for the current frequency.
   * Called when the 'Remove' button is pressed.
   */
  function deletePreset() {
    delete presets[getFrequencyMHz()];
    savePresets();
  }

  /**
   * Loads the last station to be tuned.
   */
  function loadCurrentStation() {
    chrome.storage.local.get('currentStation', function(cfg) {
      setFrequency(cfg['currentStation'], false);
    });
  }

  /**
   * Saves the current station to be loaded on the next restart.
   */
  function saveCurrentStation() {
    chrome.storage.local.set({'currentStation': fmRadio.getFrequency()});
  }

  /**
   * Loads the settings.
   */
  function loadSettings() {
    chrome.storage.local.get('settings', function(cfg) {
      if (cfg['settings']) {
        setSettings(cfg['settings']);
      }
    });
  }

  /**
   * Saves the settings.
   */
  function saveSettings() {
    chrome.storage.local.set({'settings': settings});
  }

  /**
   * Shows the settings dialog.
   */
  function showSettings() {
    chrome.app.window.create('settings.html', {
        'bounds': {
          'width': 400,
          'height': 100
        },
        'resizable': false
      }, function(win) {
        win.contentWindow['opener'] = window;
        win.contentWindow['settings'] = settings;
    });
  }

  /**
   * Sets the current settings.
   */
  function setSettings(newSettings) {
    settings = newSettings;
    if (settings['region'] == 'JP') {
      minFreq = 76000000;
      maxFreq = 90000000;
    } else {
      minFreq = 87500000;
      maxFreq = 108000000;
    }
    if (settings['region'] == 'IT') {
      freqStep = 50000;
    } else {
      freqStep = 100000;
    }
    setFrequency(fmRadio.getFrequency(), true);
  }

  /**
   * Internal function to change frequency.
   * @param {number} newFreq The new frequency, in Hz.
   * @param {boolean} bounding If the new frequency goes beyond the limits,
   *     whether to set the frequency to the limit that is exceeded (otherwise
   *     it doesn't set a new frequency).
   */
  function setFrequency(newFreq, bounding) {
    newFreq = freqStep * Math.round(newFreq / freqStep);
    if (newFreq >= minFreq && newFreq <= maxFreq) {
      fmRadio.setFrequency(newFreq);
    } else if (bounding && newFreq < minFreq) {
      fmRadio.setFrequency(minFreq);
    } else if (bounding && newFreq > maxFreq) {
      fmRadio.setFrequency(maxFreq);
    }
  }

  /**
   * Returns the current frequency in MHz.
   * @return {string} The frequency in MHz with 2 significant digits.
   */
  function getFrequencyMHz() {
    return (fmRadio.getFrequency() / 1e6).toFixed(2);
  }

  /**
   * Closes the window.
   */
  function close() {
    saveCurrentStation();
    fmRadio.stop(function() {
      chrome.app.window.current().close();
    });
  }

  /**
   * Shows an error window with the given message.
   * @param {string} msg The message to show.
   */
  function showErrorWindow(msg) {
    chrome.app.window.create('error.html', {
        'bounds': {
          'width': 500,
          'height': 100
        },
        'resizable': false
      }, function(win) {
        win.contentWindow['opener'] = window;
        win.contentWindow['errorMsg'] = msg;
    });
  }

  /**
   * Called when a message is received by the window.
   */
  function getMessage(event) {
    var type = event.data['type'];
    var data = event.data['data'];
    if (type == 'savepreset') {
      presets[data['frequency']] = data['name'];
      savePresets();
    } else if (type == 'setsettings') {
      setSettings(data);
      saveSettings(data);
    } else if (type == 'exit') {
      close();
    }
  }


  /**
   * Attaches all the event handlers, loads the presets, and updates the UI.
   */
  function attach() {
    powerOnButton.addEventListener('click', powerOn);
    powerOffButton.addEventListener('click', powerOff);
    settingsButton.addEventListener('click', showSettings);
    closeButton.addEventListener('click', close);
    frequencyDisplay.addEventListener('click', showFrequencyEditor);
    frequencyInput.addEventListener('change', changeFrequency);
    frequencyInput.addEventListener('blur', hideFrequencyEditor);
    stereoIndicator.addEventListener('click', toggleStereo);
    freqMinusButton.addEventListener('click', frequencyMinus);
    freqPlusButton.addEventListener('click', frequencyPlus);
    scanDownButton.addEventListener('click', scanDown);
    scanUpButton.addEventListener('click', scanUp);
    presetsBox.addEventListener('change', selectPreset);
    removePresetButton.addEventListener('click', deletePreset);
    savePresetButton.addEventListener('click', savePreset);
    window.addEventListener('message', getMessage);
    fmRadio.setInterface(this);
    fmRadio.setOnError(showErrorWindow);
    loadSettings();
    loadPresets();
    loadCurrentStation();
    update();
  }

  return {
    attach: attach,
    update: update
  };
}

window.addEventListener('load', function() {
  var radio = new RadioController();
  var interface = new Interface(radio);
  interface.attach();
});

