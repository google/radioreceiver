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
   * The application state and configuration.
   */
  var appConfig = new AppConfig();

  /**
   * The station presets.
   */
  var presets = new Presets();

  /**
   * The current band configuration;
   */
  var currentBand = Bands['WW']['FM'];

  /**
   * Updates the UI.
   */
  function update() {
    setVisible(powerOffButton, fmRadio.isPlaying());
    setVisible(powerOnButton, !fmRadio.isPlaying());

    var frequency = getFrequency();
    appConfig.state.frequency.set(frequency);
    frequencyDisplay.textContent = currentBand.toDisplayName(frequency);

    if (fmRadio.isStereoEnabled()) {
      stereoEnabledIndicator.classList.remove('stereoDisabled');
      if (fmRadio.isStereo()) {
        stereoActiveIndicator.classList.remove('stereoUnavailable');
      } else {
        stereoActiveIndicator.classList.add('stereoUnavailable');
      }
    } else {
      stereoEnabledIndicator.classList.add('stereoDisabled');
      stereoActiveIndicator.classList.add('stereoUnavailable');
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
      var mode = currentBand.getMode();
      for (var i = 0; i < modulationDisplay.options.length; ++i) {
        var option = modulationDisplay.options[i];
        if (option.value == mode.modulation && !option.selected) {
          option.selected = true;
          break;
        }
      }
      freqStepDisplay.textContent = currentBand.getStep();
      setVisible(bandwidthBox, mode.modulation == 'AM'
                               || mode.modulation == 'USB'
                               || mode.modulation == 'LSB');
      bandwidthDisplay.textContent = Number(mode.bandwidth) || 0;
      setVisible(maxfBox, mode.modulation == 'NBFM');
      maxfDisplay.textContent = Number(mode.maxF) || 0;
      upconverterDisplay.textContent = isUpconverterEnabled() ? 'On' : 'Off';
      squelchDisplay.textContent = (mode.squelch || 0);
    } else {
      bandBox.textContent = currentBand.getName();
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
    
//    setVisible(signalDisplay, isFreeTuning());

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
    saveSettings();
    setVisible(powerOffButton, false);
    setVisible(powerOnButton, true);
    if (fmRadio.isPlaying()) {
      fmRadio.stop();
    }
  }

  /**
   * Turns the radio on if it's off and off if it's on.
   * Called when the space bar shortcut is pressed.
   */
  function togglePower() {
    if (powerOnButton.classList.contains('invisible')) {
      powerOff();
    } else {
      powerOn();
    }
  }

  /**
   * Tunes to another frequency.
   */
  function changeFrequency(value) {
    setFrequency(currentBand.fromDisplayName(value), false);
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
    var newFreq = getFrequency() - currentBand.getStep();
    if (newFreq < currentBand.getMin()) {
      newFreq = currentBand.getMax();
    }
    setFrequency(newFreq, true);
  }

  /**
   * Tunes one step up.
   * Called when the '>' button is pressed.
   */
  function frequencyPlus() {
    var newFreq = getFrequency() + currentBand.getStep();
    if (newFreq > currentBand.getMax()) {
      newFreq = currentBand.getMin();
    }
    setFrequency(newFreq, true);
  }

  /**
   * Scans the FM band downwards.
   * Called when the 'Scan <<' button is pressed.
   */
  function scanDown() {
    fmRadio.scan(
        upconvert(currentBand.getMin()),
        upconvert(currentBand.getMax()),
        -currentBand.getStep());
  }

  /**
   * Scans the FM band upwards.
   * Called when the 'Scan >>' button is pressed.
   */
  function scanUp() {
    fmRadio.scan(
        upconvert(currentBand.getMin()),
        upconvert(currentBand.getMax()),
        currentBand.getStep());
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
   * Mute volume (change to 0).
   */
  function muteVolume() {
    setVolume(0.0);
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
    appConfig.state.volume.set(volume);
    restoreVolume();
  }

  /**
   * Switches the selected band.
   */
  function switchBand() {
    var bands = appConfig.settings.region.getAvailableBands();
    var bandNames = [];
    for (var n in bands) {
      if (bands.hasOwnProperty(n)) {
        if (appConfig.state.band.isAllowed(n)
            || n == currentBand.getName()) {
          bandNames.push(n);
        }
      }
    }
    if (appConfig.settings.freeTuning.isEnabled() || !currentBand.getName()) {
      bandNames.push('');
    }
    if (bandNames.length == 1) {
      return;
    }
    bandNames.sort();
    for (var i = 0; i < bandNames.length; ++i) {
      if (bandNames[i] == currentBand.getName()) {
        selectBand(bandNames[(i + 1) % bandNames.length]);
        return;
      }
    }
  }

  /**
   * Changes the radio's band.
   * @param {string} bandName The new band's name.
   */
  function selectBand(bandName) {
    appConfig.state.band.select(bandName);
    restoreStation();
    saveSettings();
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
      if (appConfig.state.band.isAllowed(preset['band'])) {
        var label = preset['display'] + ' - ' + preset['name'];
        presetsBox.options.add(createOption(value, label));
      }
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
      var preset = presets.get(frequency);
      if (preset.band == currentBand.getName() &&
          preset.mode.modulation == currentBand.getMode().modulation) {
        presetsBox.value = frequency;
        return;
      }
    }
    presetsBox.value = '';
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
        var newMode = preset['mode'];
        appConfig.state.mode.select(newMode['modulation']);
        var currentMode = appConfig.state.mode.get();
        if (newMode['step']) {
          currentMode.step = newMode['step'];
          delete newMode['step'];
        }
        currentMode.params = newMode;
        appConfig.state.mode.update(currentMode);
      }
      selectBand(preset['band']);
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
    AuxWindows.savePreset(freq, name, currentBand);
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
  function restoreStation() {
    currentBand = appConfig.state.band.get();
    fmRadio.setMode(currentBand.getMode());
    fmRadio.setSquelch(currentBand.getMode().squelch || 0);
    setFrequency(appConfig.state.frequency.get(), true);
  }

  /**
   * Loads the previously-set volume.
   */
  function restoreVolume() {
    fmRadio.setVolume(appConfig.state.volume.get());
  }

  /**
   * Loads the settings.
   */
  function loadSettings(callback) {
    appConfig.load(function() {
    restoreSettings();
    restoreStation();
    restoreVolume();
    callback();
    });
  }

  /**
   * Saves the settings.
   */
  function saveSettings() {
    appConfig.save();
  }

  /**
   * Shows the settings dialog.
   */
  function showSettings() {
    var settings = {
      'region': appConfig.settings.region.get(),
      'ppm': appConfig.settings.ppm.get(),
      'autoGain': appConfig.settings.gain.isAuto(),
      'gain': appConfig.settings.gain.get(),
      'useUpconverter': appConfig.settings.upconverter.isEnabled(),
      'upconverterFreq': appConfig.settings.upconverter.get(),
      'enableFreeTuning': appConfig.settings.freeTuning.isEnabled()
    };
    AuxWindows.settings(settings);
  }

  /**
   * Sets the current settings.
   * @param {Object} newSettings The new settings.
   */
  function setSettings(newSettings) {
    appConfig.settings.region.select(newSettings['region']);
    appConfig.settings.ppm.set(newSettings['ppm']);
    appConfig.settings.gain.setAuto(newSettings['autoGain']);
    appConfig.settings.gain.set(newSettings['gain']);
    appConfig.settings.upconverter.enable(newSettings['useUpconverter']);
    appConfig.settings.upconverter.set(newSettings['upconverterFreq']);
    appConfig.settings.freeTuning.enable(newSettings['enableFreeTuning']);
    restoreSettings();
    restoreStation();
    displayPresets();
  }

  /**
   * Restores the radio settings.
   */
  function restoreSettings() {
    if (appConfig.settings.gain.isAuto()) {
      fmRadio.setAutoGain();
    } else {
      fmRadio.setManualGain(appConfig.settings.gain.get());
    }
    fmRadio.setCorrectionPpm(appConfig.settings.ppm.get());
  }
  
  /**
   * Returns whether the upconverter is enabled.
   * @return {boolean} Whether the upconverter is enabled.
   */
  function isUpconverterEnabled() {
    return currentBand.getMode().upconvert &&
        appConfig.settings.upconverter.isEnabled();
  }

  /**
   * Upconverts the given frequency, if warranted for the current mode.
   * @param {number} freq The original frequency.
   * @return {number} The upconverted frequency.
   */
  function upconvert(freq) {
    if (isUpconverterEnabled()) {
      return Number(freq) + appConfig.settings.upconverter.get();
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
      return Number(freq) - appConfig.settings.upconverter.get();
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
    newFreq = currentBand.getMin() + currentBand.getStep() * Math.round(
        (newFreq - currentBand.getMin()) / currentBand.getStep());
    if (!bounding &&
        (newFreq < currentBand.getMin() || newFreq > currentBand.getMax())) {
      return;
    }
    if (newFreq < currentBand.getMin()) {
      newFreq = currentBand.getMin();
    } else if (newFreq > currentBand.getMax()) {
      newFreq = currentBand.getMax();
    }
    appConfig.state.frequency.set(newFreq);
    fmRadio.setFrequency(upconvert(appConfig.state.frequency.get()));
    saveSettings();
  }

  /**
   * Returns the current frequency.
   * @return {number} The current frequency.
   */
  function getFrequency() {
    return downconvert(fmRadio.getFrequency());
  }

  /**
   * Tells whether we are in free tuning mode.
   * @return {boolean} Whether we are in free tuning mode.
   */
  function isFreeTuning() {
    return currentBand.getName() == '' &&
        appConfig.settings.freeTuning.isEnabled();
  }

  /**
   * Internal function to change mode.
   * @param {Object} mode The new mode.
   */
  function setMode(mode) {
    fmRadio.setMode(mode);
  }

  /**
   * Changes modulation in free-tuning mode.
   */
  function switchModulation() {
    appConfig.state.mode.select(modulationDisplay.selectedOptions[0].value);
    restoreStation();
    saveSettings();
  }

  /**
   * Changes the frequency step.
   */
  function changeFreqStep(value) {
    var newStep = Math.floor(value);
    if (newStep >= 1 && newStep <= 999999) {
      var mode = appConfig.state.mode.get();
      mode.step = newStep;
      appConfig.state.mode.update(mode);
      restoreStation();
      saveSettings();
    }
  }

  /**
   * Changes the bandwidth.
   */
  function changeBandwidth(value) {
    var newBandwidth = Math.floor(value);
    if (newBandwidth >= 1 && newBandwidth <= 20000) {
      var mode = appConfig.state.mode.get();
      mode.params.bandwidth = newBandwidth;
      appConfig.state.mode.update(mode);
      restoreStation();
      saveSettings();
    }
  }

  /**
   * Changes the maximum frequency deviation in FM.
   */
  function changeMaxf(value) {
    var newMaxf = Math.floor(value);
    if (newMaxf >= 1 && newMaxf <= 24000) {
      var mode = appConfig.state.mode.get();
      mode.params.maxF = newMaxf;
      appConfig.state.mode.update(mode);
      restoreStation();
      saveSettings();
    }
  }

  /**
   * Toggles the upconverter on and off.
   */
  function toggleUpconverter() {
    var mode = appConfig.state.mode.get();
    mode.params.upconvert = !mode.params.upconvert;
    appConfig.state.mode.update(mode);
    restoreStation();
    saveSettings();
  }

  /**
   * Changes the squelch level.
   */
  function changeSquelch(value) {
    var newSquelch = Math.floor(value);
    if (newSquelch >= 0 && newSquelch <= 100) {
      var mode = appConfig.state.mode.get();
      mode.params.squelch = newSquelch;
      appConfig.state.mode.update(mode);
      fmRadio.setSquelch(mode.params.squelch);
      saveSettings();
      update();
    }
  }

  /**
   * Changes the squelch level with the mouse wheel.
   * @param {MouseWheelEvent} event The received event.
   */
  function changeSquelchWheel(event) {
    var delta = 5;
    if (event.wheelDelta < 0) {
      delta = -5;
    }
    var mode = appConfig.state.mode.get();
    var newSquelch = (mode.params.squelch || 0) + delta;
    newSquelch = Math.min(100, Math.max(0, newSquelch));
    mode.params.squelch = newSquelch;
    appConfig.state.mode.update(mode);
    fmRadio.setSquelch(mode.params.squelch);
    saveSettings();
    update();
  }
  
  /**
   * Selects the next preset in the list.
   */
  
function nextPreset(){
    if ( presetsBox.length < 3 ) { return; }
    if ( presetsBox[presetsBox.length-1].selected ) {
       presetsBox[1].selected = "1";
       selectPreset();
    } else {
       for (i = 0; i < presetsBox.length; i++){
          if ( presetsBox[i].selected ){
             presetsBox[i+1].selected = "1";
             selectPreset();
             break;
          }
       }
    }
  }

  /**
   * Closes the window.
   */
  function close() {
    saveSettings();
    fmRadio.stop(function() {
      AuxWindows.closeCurrent();
    });
  }

  /**
   * Asks the user for the file to record audio into.
   */
  function startRecording() {
    var opt = {
      type: 'saveFile',
      suggestedName: (currentBand.toDisplayName(getFrequency(), true)
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
      presets.set(data['frequency'], data['display'], data['name'],
                  data['band'], data['mode']);
      presets.save(displayPresets);
    } else if (type == 'setsettings') {
      setSettings(data);
      saveSettings();
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
        case 34:   // PgDn
          nextPreset();
          break;
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
        case  70: // F
        case 102: // f
//          showFrequencyEditor();         not defined
//          frequencyDisplay.click();      but this causes crash
          break;
        case 77:  // M
        case 109: // m
          muteVolume();
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
   * Updates the preset list.
   */
  function updatePresets() {
    presets.load(displayPresets);
    update();
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
    modulationDisplay.addEventListener('change', switchModulation);
    attachDisplayInputEvents(freqStepDisplay, freqStepInput, changeFreqStep);
    attachDisplayInputEvents(
        bandwidthDisplay, bandwidthInput, changeBandwidth);
    attachDisplayInputEvents(maxfDisplay, maxfInput, changeMaxf);
    upconverterDisplay.addEventListener('click', toggleUpconverter);
    attachDisplayInputEvents(squelchDisplay, squelchInput, changeSquelch);
    squelchDisplay.addEventListener('mousewheel', changeSquelchWheel);
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
    loadSettings(function() {
      presets.load(displayPresets);
      presets.addListener(displayPresets);
      update();
    });
  }

  return {
    attach: attach,
    update: update
  };
}

var radio = new RadioController();
var interface = new Interface(radio);

window.addEventListener('load', function() {
  AuxWindows.resizeCurrentTo(500, 225);
  interface.attach();
});

