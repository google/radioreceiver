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
    'region': 'WW',
    'nerdSettings': false
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
      stereoIndicator.classList.remove('stereoUnavailable');
    } else if (!fmRadio.isStereo()) {
      stereoIndicator.classList.add('stereoUnavailable');
      stereoIndicator.classList.remove('stereoDisabled');
    } else {
      stereoIndicator.classList.remove('stereoDisabled');
      stereoIndicator.classList.remove('stereoUnavailable');
    }
    if (fmRadio.isScanning()) {
      bandLabel.classList.add('scanning');
    } else {
      bandLabel.classList.remove('scanning');
    }
    var volume = Math.round(fmRadio.getVolume() * 100);
    volumeLabel.textContent = volume;
    volumeSlider.value = volume;
    if (volume == 0) {
      volumeLabel.classList.add('volumeMuted');
    } else {
      volumeLabel.classList.remove('volumeMuted');
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
    saveVolume();
  }

  /**
   * Turns the radio on if it's off and off if it's on.
   * Called when the space bar shortcut is pressed.
   */
  function togglePower() {
    if (powerOnButton.style.visibility == 'hidden') {
      powerOff();
    } else {
      powerOn();
    }
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
   * Changes frequency with the mouse wheel.
   * @param {MouseWheelEvent} event The received event.
   */
  function changeFrequencyWheel(event) {
    if (event.wheelDelta < 0) {
      frequencyMinus();
    } else if (event.wheelDelta > 0) {
      frequencyPlus();
    }
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
   * Shows a control to change volume.
   */
  function changeVolume() {
    setVisible(volumeSliderBox, true);
    setVisible(volumeOccluder, true);
    volumeSlider.focus();
  }

  /**
   * Changes volume with the mouse wheel.
   * @param {MouseWheelEvent} event The received event.
   */
  function changeVolumeWheel(event) {
    if (event.wheelDelta < 0) {
      changeVolumeDown();
    } else if (event.wheelDelta > 0) {
      changeVolumeUp();
    }
  }

  /**
   * Changes the volume 1 notch down.
   */
  function changeVolumeDown() {
    setVolume(fmRadio.getVolume() - 0.1);
  }

  /**
   * Changes the volume 1 notch up.
   */
  function changeVolumeUp() {
    setVolume(fmRadio.getVolume() + 0.1);
  }

  /**
   * Changes volume with the mouse wheel.
   * @param {MouseWheelEvent} event The received event.
   */
  function changeVolumeSlider() {
    var volume = volumeSlider.value;
    setVolume(volume / 100);
  }

  /**
   * Makes the volume slider disappear when the user clicks outside it.
   */
  function blurVolumeSlider() {
    setVisible(volumeSliderBox, false);
    setVisible(volumeOccluder, false);
  }

  /**
   * Sets the audio volume.
   * @param {number} volume The new volume, between 0 and 1.
   */
  function setVolume(volume) {
    volume = volume < 0 ? 0 : volume > 1 ? 1 : volume;
    fmRadio.setVolume(volume);
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
    AuxWindows.savePreset(getFrequencyMHz(), presets);
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
   * Loads the previously-set volume.
   */
  function loadVolume() {
    chrome.storage.local.get('volume', function(cfg) {
      setVolume(cfg['volume'] || 1);
    });
  }

  /**
   * Saves the current volume.
   */
  function saveVolume() {
    chrome.storage.local.set({'volume': fmRadio.getVolume()});
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
    settings['ppm'] = fmRadio.getCorrectionPpm();
    settings['autoGain'] = fmRadio.isAutoGain();
    settings['gain'] = fmRadio.getManualGain();
    AuxWindows.settings(settings);
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
    if (settings['autoGain'] || null == settings['autoGain']) {
      fmRadio.setAutoGain();
    } else {
      fmRadio.setManualGain(settings['gain']);
    }
    fmRadio.setCorrectionPpm(settings['ppm'] || 0);
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
    saveVolume();
    fmRadio.stop(function() {
      AuxWindows.closeCurrent();
    });
  }

  /**
   * Shows an error window with the given message.
   * @param {string} msg The message to show.
   */
  function showErrorWindow(msg) {
    AuxWindows.error(msg);
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
   * Stops event propagation.
   * @param {Event} e The event to stop.
   */
  function stopEvent(e) {
    e.stopPropagation();
  }

  /**
   * Handle a keyboard shortcut.
   * @param {KeyboardEvent} e The keyboard event that was fired.
   */
  function handleShortcut(e) {
    if (document.activeElement != document.body) {
      if (e.type == 'keydown' && e.keyCode == 27) {
        document.activeElement.blur();
      }
      return;
    }
    if (e.type == 'keydown') {
      switch (e.keyCode) {
        case 37:
          frequencyMinus();
          break;
        case 39:
          frequencyPlus();
          break;
        case 38:
          changeVolumeUp();
          break;
        case 40:
          changeVolumeDown();
          break;
        default:
          return;
      }
    } else {
      switch (e.charCode) {
        case 33:  // !
          showSettings();
          break;
        case 60:  // <
          scanDown();
          break;
        case 62:  // >
          scanUp();
          break;
        case 63:  // ?
          AuxWindows.help();
          break;
        case 102: // f
          showFrequencyEditor();
          break;
        case 80:  // P
        case 112: // p
          presetsBox.focus();
          break;
        case 115: // s
          toggleStereo();
          break;
        case 83:  // S
          savePreset();
          break;
        case 82:  // R
          deletePreset();
          break;
        case 32:
          togglePower();
          break;
        default:
          return;
      }
    }
    e.stopPropagation();
    e.preventDefault();
  }

  /**
   * Attaches all the event handlers, loads the presets, and updates the UI.
   */
  function attach() {
    powerOnButton.addEventListener('click', powerOn);
    powerOffButton.addEventListener('click', powerOff);
    settingsButton.addEventListener('click', showSettings);
    closeButton.addEventListener('click', close);
    frequencyDisplay.addEventListener('focus', showFrequencyEditor);
    frequencyDisplay.addEventListener('mousewheel', changeFrequencyWheel);
    frequencyInput.addEventListener('change', changeFrequency);
    frequencyInput.addEventListener('blur', hideFrequencyEditor);
    stereoIndicatorBox.addEventListener('click', toggleStereo);
    volumeOccluder.addEventListener('click', stopEvent, true);
    volumeBox.addEventListener('click', changeVolume);
    volumeBox.addEventListener('mousewheel', changeVolumeWheel);
    volumeSlider.addEventListener('change', changeVolumeSlider);
    volumeSlider.addEventListener('blur', blurVolumeSlider);
    volumeSlider.addEventListener('mousewheel', changeVolumeWheel);
    freqMinusButton.addEventListener('click', frequencyMinus);
    freqPlusButton.addEventListener('click', frequencyPlus);
    scanDownButton.addEventListener('click', scanDown);
    scanUpButton.addEventListener('click', scanUp);
    presetsBox.addEventListener('change', selectPreset);
    removePresetButton.addEventListener('click', deletePreset);
    savePresetButton.addEventListener('click', savePreset);
    window.addEventListener('message', getMessage);
    window.addEventListener('keydown', handleShortcut);
    window.addEventListener('keypress', handleShortcut);
    fmRadio.setInterface(this);
    fmRadio.setOnError(showErrorWindow);
    loadSettings();
    loadPresets();
    loadCurrentStation();
    loadVolume();
    update();
  }

  return {
    attach: attach,
    update: update
  };
}

var radio = new RadioController();

window.addEventListener('load', function() {
  AuxWindows.resizeCurrentTo(500, 225);
  var interface = new Interface(radio);
  interface.attach();
});

