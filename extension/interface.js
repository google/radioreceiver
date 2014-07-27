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
    'ppm': 0,
    'autoGain': true,
    'gain': 0,
    'useUpconverter': false,
    'upconverterFreq': 125000000,
    'enableFreeTuning': false
  };

  /**
   * Current radio band.
   */
  var band = Bands[settings.region]['FM'];

  /**
   * The free-tuning pseudoband.
   */
  var freeTuningBand = new Band('', 0, 2400000000, 10000, {modulation: 'WBFM'}, null, null);

  /**
   * Last-selected stations in each band.
   */
  var selectedStations = {
    'currentBand': 'FM',
    'bands': {
      '': 90000000
    },
    'currentMode': 'WBFM',
    'modes': DefaultModes
  };

  /**
   * The station presets.
   */
  var presets = new Presets();

  /**
   * Updates the UI.
   */
  function update() {
    setVisible(powerOffButton, fmRadio.isPlaying());
    setVisible(powerOnButton, !fmRadio.isPlaying());
    frequencyDisplay.textContent = band.toDisplayName(getFrequency());

    if (fmRadio.isFrequencyTuned()) {
      frequencyDisplay.classList.remove('outOfTune');
    } else {
      frequencyDisplay.classList.add('outOfTune');
    }

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
      bandBox.classList.add('scanning');
    } else {
      bandBox.classList.remove('scanning');
    }

    if (isFreeTuning()) {
      bandBox.textContent = 'ft';
      bandBox.classList.add('freeTuning');
      frequencyDisplay.classList.add('freeTuning');
      frequencyInput.classList.add('freeTuning');
      freeTuningStuff.classList.add('freeTuning');
      var modulation = getMode().modulation;
      modulationDisplay.textContent = modulation;
      freqStepDisplay.textContent = band.getStep();
      setVisible(bandwidthBox, modulation == 'AM');
      bandwidthDisplay.textContent = Number(getMode().bandwidth);
      setVisible(maxfBox, modulation == 'NBFM');
      maxfDisplay.textContent = Number(getMode().maxF);
      upconverterDisplay.textContent = isUpconverterEnabled() ? 'On' : 'Off';
    } else {
      bandBox.textContent = band.getName();
      bandBox.classList.remove('freeTuning');
      frequencyDisplay.classList.remove('freeTuning');
      frequencyInput.classList.remove('freeTuning');
      freeTuningStuff.classList.remove('freeTuning');
    }
    
    var volume = Math.round(fmRadio.getVolume() * 100);
    volumeLabel.textContent = volume;
    volumeSlider.value = volume;
    if (volume == 0) {
      volumeLabel.classList.add('volumeMuted');
    } else {
      volumeLabel.classList.remove('volumeMuted');
    }

    setVisible(recordButton, !fmRadio.isRecording());
    setVisible(stopButton, fmRadio.isRecording());

    selectCurrentPreset();
  }

  /**
   * Makes an element visible or invisible.
   */
  function setVisible(element, visible) {
    if (visible) {
      element.classList.remove('invisible');
    } else {
      element.classList.add('invisible');
    }
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
   * Tunes to another frequency.
   */
  function changeFrequency(value) {
    setFrequency(band.fromDisplayName(value), false);
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
    var newFreq = getFrequency() - band.getStep();
    if (newFreq < band.getMin()) {
      newFreq = band.getMax();
    }
    setFrequency(newFreq, true);
  }

  /**
   * Tunes one step up.
   * Called when the '>' button is pressed.
   */
  function frequencyPlus() {
    var newFreq = getFrequency() + band.getStep();
    if (newFreq > band.getMax()) {
      newFreq = band.getMin();
    }
    setFrequency(newFreq, true);
  }

  /**
   * Scans the FM band downwards.
   * Called when the 'Scan <<' button is pressed.
   */
  function scanDown() {
    fmRadio.scan(
        upconvert(band.getMin()),
        upconvert(band.getMax()),
        -band.getStep());
  }

  /**
   * Scans the FM band upwards.
   * Called when the 'Scan >>' button is pressed.
   */
  function scanUp() {
    fmRadio.scan(
        upconvert(band.getMin()),
        upconvert(band.getMax()),
        band.getStep());
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
   * Switches the selected band.
   */
  function switchBand() {
    saveCurrentStation();
    var bands = Bands[settings['region']];
    var bandNames = [];
    for (var n in bands) {
      if (bands.hasOwnProperty(n)) {
        if (!bands[n].getMode()['upconvert']
            || settings['useUpconverter']
            || n == band.getName()) {
          bandNames.push(n);
        }
      }
    }
    if (settings['enableFreeTuning'] || !band.getName()) {
      bandNames.push('');
    }
    if (bandNames.length == 1) {
      return;
    }
    bandNames.sort();
    for (var i = 0; i < bandNames.length; ++i) {
      if (!band || bandNames[i] == band.getName()) {
        var nextName = bandNames[(i + 1) % bandNames.length];
        if (nextName) {
          selectBand(bands[nextName]);
        } else {
          selectBand(freeTuningBand);
        }
        return;
      }
    }
  }

  /**
   * Changes the radio's band.
   * @param {Band} newBand The new band.
   */
  function selectBand(newBand) {
    band = newBand;
    setMode(band.getMode());
    setFrequency(selectedStations['bands'][band.getName()] || 1, true);
    update();
  }

  /**
   * Updates the preset selection box.
   */
  function displayPresets() {
    var saved = presets.get();
    var freqs = [];
    for (var freq in saved) {
      freqs.push(freq);
    }
    freqs.sort(function(a,b) { return Number(a) - Number(b) });
    while (presetsBox.options.length > 0) {
      presetsBox.options.remove(0);
    }
    presetsBox.options.add(createOption('', '\u2014 Saved stations \u2014'));
    for (var i = 0; i < freqs.length; ++i) {
      var value = freqs[i];
      var preset = saved[value];
      var label = preset['display'] + ' - ' + preset['name'];
      presetsBox.options.add(createOption(value, label));
    }
    selectCurrentPreset();
  }

  /**
   * Makes the preset for the current frequency selected.
   */
  function selectCurrentPreset() {
    if (document.activeElement == presetsBox) {
      return;
    }
    var frequency = getFrequency();
    if (frequency in presets.get()) {
      presetsBox.value = frequency;
    } else {
      presetsBox.value = '';
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
    var preset = presets.get(presetsBox.value);
    if (preset) {
      if (preset['mode']) {
        freeTuningBand.setMode(preset['mode']);
      }
      var bandPreset = preset['band'];
      if (!bandPreset && settings['enableFreeTuning']) {
        var newBand = freeTuningBand;
      } else {
        var newBand = Bands[settings.region][bandPreset || 'FM'];
      }
      if (newBand) {
        selectBand(newBand);
      }
      setFrequency(presetsBox.value, false);
    }
  }

  /**
   * Gets the name of the current station and saves it as a preset.
   * Called when the 'Save' button is pressed.
   */
  function savePreset() {
    var freq = getFrequency();
    var preset = presets.get(freq);
    var name = preset ? preset['name'] : '';
    var display = band.toDisplayName(freq, true);
    AuxWindows.savePreset(freq, display, name, band.getName(), band.getMode());
  }

  /**
   * Deletes the preset for the current frequency.
   * Called when the 'Remove' button is pressed.
   */
  function deletePreset() {
    presets.remove(getFrequency());
    presets.save(displayPresets);
  }

  /**
   * Loads the last station to be tuned.
   */
  function loadCurrentStation() {
    chrome.storage.local.get('currentStation', function(cfg) {
      if ('number' === typeof cfg['currentStation']) {
        selectedStations = {
          'currentBand': 'FM',
          'bands': {
            'FM': cfg['currentStation']
          }
        };
      } else if (cfg['currentStation']) {
        selectedStations = cfg['currentStation'];
      }
      if (!selectedStations['modes']) {
        selectedStations['modes'] = DefaultModes;
      }
      if (!selectedStations['currentMode']) {
        selectedStations['currentMode'] = 'WBFM';
      }
      freeTuningBand.setMode(selectedStations['modes'][selectedStations['currentMode']]);
      var bandPreset = selectedStations['currentBand'];
      if (!bandPreset && settings['enableFreeTuning']) {
        var newBand = freeTuningBand;
      } else {
        var newBand = Bands[settings.region][bandPreset || 'FM'];
      }
      selectBand(newBand);
      var newFreq = selectedStations['bands'][band.getName()];
      if (newFreq) {
        setFrequency(newFreq, false);
      }
    });
  }

  /**
   * Saves the current station to be loaded on the next restart.
   */
  function saveCurrentStation() {
    if (band) {
      selectedStations['currentBand'] = band.getName();
      selectedStations['bands'][band.getName()] = getFrequency();
      if (isFreeTuning()) {
        selectedStations['currentMode'] = getMode().modulation;
      }
      chrome.storage.local.set({'currentStation': selectedStations});
    }
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
    if (!isFreeTuning()) {
      var availableBands = (Bands[settings['region']] || Bands['WW']);
      band = availableBands[band.getName()] || availableBands['FM'];
    }
    if (settings['autoGain'] || null == settings['autoGain']) {
      fmRadio.setAutoGain();
    } else {
      fmRadio.setManualGain(settings['gain']);
    }
    fmRadio.setCorrectionPpm(settings['ppm'] || 0);
    selectBand(band);
  }

  /**
   * Returns whether the upconverter is enabled.
   * @return {boolean} Whether the upconverter is enabled.
   */
  function isUpconverterEnabled() {
    return getMode()['upconvert'] && settings['useUpconverter'];
  }

  /**
   * Upconverts the given frequency, if warranted for the current mode.
   * @param {number} freq The original frequency.
   * @return {number} The upconverted frequency.
   */
  function upconvert(freq) {
    if (isUpconverterEnabled()) {
      return Number(freq) + Number(settings['upconverterFreq']);
    }
    return freq;
  }

  /**
   * Downconverts the given frequency, if warranted for the current mode.
   * @param {number} freq The original frequency.
   * @return {number} The downconverted frequency.
   */
  function downconvert(freq) {
    if (isUpconverterEnabled()) {
      return Number(freq) - Number(settings['upconverterFreq']);
    }
    return freq;
  }

  /**
   * Internal function to change frequency.
   * @param {number} newFreq The new frequency, in Hz.
   * @param {boolean} bounding If the new frequency goes beyond the limits,
   *     whether to set the frequency to the limit that is exceeded (otherwise
   *     it doesn't set a new frequency).
   */
  function setFrequency(newFreq, bounding) {
    newFreq = band.getMin() + band.getStep() * Math.round(
        (newFreq - band.getMin()) / band.getStep());
    if (newFreq >= band.getMin() && newFreq <= band.getMax()) {
      fmRadio.setFrequency(upconvert(newFreq));
    } else if (bounding && newFreq < band.getMin()) {
      fmRadio.setFrequency(upconvert(band.getMin()));
    } else if (bounding && newFreq > band.getMax()) {
      fmRadio.setFrequency(upconvert(band.getMax()));
    }
  }

  /**
   * Returns the current frequency.
   * @return {number} The current frequency.
   */
  function getFrequency() {
    return downconvert(fmRadio.getFrequency());
  }

  /**
   * Internal function to change mode.
   * @param {Object} mode The new mode.
   */
  function setMode(mode) {
    fmRadio.setMode(mode);
  }

  /**
   * Internal function to get the current mode.
   * @return {Object} The current mode.
   */
  function getMode() {
    return fmRadio.getMode();
  }

  /**
   * Changes modulation in free-tuning mode.
   */
  function switchModulation() {
    saveCurrentStation();
    var modes = selectedStations['modes'];
    var modeNames = [];
    for (var n in modes) {
      if (modes.hasOwnProperty(n)) {
        modeNames.push(n);
      }
    }
    if (modeNames.length == 1) {
      return;
    }
    modeNames.sort();
    var currentMode = modulationDisplay.textContent;
    for (var i = 0; i < modeNames.length; ++i) {
      if (modeNames[i] == currentMode) {
        var nextName = modeNames[(i + 1) % modeNames.length];
        freeTuningBand.setMode(modes[nextName]);
        setMode(modes[nextName]);
        update();
        return;
      }
    }
  }

  /**
   * Attaches events to a pair of display/input elements.
   * @param {Element} displayElem The display element.
   * @param {Element} inputElem The input element.
   * @param {Function} changeFn The change function.
   */
  function attachDisplayInputEvents(displayElem, inputElem, changeFn) {
    displayElem.addEventListener('click', function() {
      inputElem.value = displayElem.textContent;
      setVisible(displayElem, false);
      setVisible(inputElem, true);
      inputElem.focus();
      inputElem.select();
    });

    inputElem.addEventListener('blur', function() {
      setVisible(displayElem, true);
      setVisible(inputElem, false);
    });

    inputElem.addEventListener('change', function() {
      setVisible(displayElem, true);
      setVisible(inputElem, false);
      changeFn(inputElem.value);
    });
  }

  /**
   * Changes the frequency step.
   */
  function changeFreqStep(value) {
    var newStep = Math.floor(value);
    if (newStep >= 1 && newStep <= 999999) {
      band.setStep(newStep);
      update();
    }
  }

  /**
   * Changes the bandwidth.
   */
  function changeBandwidth(value) {
    var newBandwidth = Math.floor(value);
    if (newBandwidth >= 1 && newBandwidth <= 20000) {
      band.getMode().bandwidth = newBandwidth;
      setMode(band.getMode());
      update();
    }
  }

  /**
   * Changes the maximum frequency deviation in FM.
   */
  function changeMaxf(value) {
    var newMaxf = Math.floor(value);
    if (newMaxf >= 1 && newMaxf <= 10000) {
      band.getMode().maxF = newMaxf;
      setMode(band.getMode());
      update();
    }
  }

  /**
   * Toggles the upconverter on and off.
   */
  function toggleUpconverter() {
    band.getMode().upconvert = !band.getMode().upconvert;
    setMode(band.getMode());
    update();
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
   * Tells whether we are in free tuning mode.
   * @return {boolean} Whether we are in free tuning mode.
   */
  function isFreeTuning() {
    return band.getName() == '' && settings['enableFreeTuning'];
  }

  /**
   * Asks the user for the file to record audio into.
   */
  function startRecording() {
    var opt = {
      type: 'saveFile',
      suggestedName: (band.toDisplayName(getFrequency(), true)
                      + " - "
                      + new Date().toLocaleString() + ".wav")
                     .replace(/[:/\\]/g, '_'),
    };
    chrome.fileSystem.chooseEntry(opt, doRecord);
  }

  /**
   * Starts recording audio into a file.
   */
  function doRecord(entry) {
    fmRadio.startRecording(entry);
  }

  /**
   * Stops recording audio from the radio.
   */
  function stopRecording() {
    fmRadio.stopRecording();
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
      presets.set(data['frequency'], data['display'], data['name'], data['band'], data['mode']);
      presets.save(displayPresets);
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
   * Shows the help window.
   */
  function showHelp() {
    AuxWindows.help();
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
          AuxWindows.help('shortcuts');
          break;
        case 98:  // b
          switchBand();
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
        case 119: // w
          startRecording();
          break;
        case 87:  // W
          stopRecording();
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
    helpButton.addEventListener('click', showHelp);
    closeButton.addEventListener('click', close);
    attachDisplayInputEvents(
        frequencyDisplay, frequencyInput, changeFrequency);
    frequencyDisplay.addEventListener('mousewheel', changeFrequencyWheel);
    stereoIndicatorBox.addEventListener('click', toggleStereo);
    volumeOccluder.addEventListener('click', stopEvent, true);
    volumeBox.addEventListener('click', changeVolume);
    volumeBox.addEventListener('mousewheel', changeVolumeWheel);
    volumeSlider.addEventListener('change', changeVolumeSlider);
    volumeSlider.addEventListener('blur', blurVolumeSlider);
    volumeSlider.addEventListener('mousewheel', changeVolumeWheel);
    bandBox.addEventListener('click', switchBand);
    modulationDisplay.addEventListener('click', switchModulation);
    attachDisplayInputEvents(freqStepDisplay, freqStepInput, changeFreqStep);
    attachDisplayInputEvents(bandwidthDisplay, bandwidthInput, changeBandwidth);
    attachDisplayInputEvents(maxfDisplay, maxfInput, changeMaxf);
    upconverterDisplay.addEventListener('click', toggleUpconverter);
    freqMinusButton.addEventListener('click', frequencyMinus);
    freqPlusButton.addEventListener('click', frequencyPlus);
    scanDownButton.addEventListener('click', scanDown);
    scanUpButton.addEventListener('click', scanUp);
    presetsBox.addEventListener('change', selectPreset);
    removePresetButton.addEventListener('click', deletePreset);
    savePresetButton.addEventListener('click', savePreset);
    recordButton.addEventListener('click', startRecording);
    stopButton.addEventListener('click', stopRecording);
    window.addEventListener('message', getMessage);
    window.addEventListener('keydown', handleShortcut);
    window.addEventListener('keypress', handleShortcut);
    fmRadio.setInterface(this);
    fmRadio.setOnError(showErrorWindow);
    loadSettings();
    loadCurrentStation();
    loadVolume();
    presets.load(displayPresets);
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

