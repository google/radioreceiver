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
 * @fileoverview Functions to convert frequencies to human-readable strings.
 */
var Frequencies = (function() {

  /**
   * Converts a frequency to a human-readable format.
   * @param {number} frequency The frequency to convert.
   * @param {boolean} showUnits Whether to show the units (Hz, kHz, MHz, etc.)
   * @param {number=} opt_digits If specified, use a fixed number of digits.
   */
  function humanReadable(frequency, showUnits, opt_digits) {
    var units;
    var suffix;
    if (frequency < 2e3) {
      units = 1;
      suffix = '';
    } else if (frequency < 2e6) {
      units = 1e3;
      suffix = 'k';
    } else if (frequency < 2e9) {
      units = 1e6;
      suffix = 'M';
    } else {
      units = 1e9;
      suffix = 'G';
    }
    if (opt_digits) {
      var number = (frequency / units).toFixed(opt_digits);
    } else {
      var number = String(frequency / units);
    }
    if (showUnits) {
      return number + ' ' + suffix + 'Hz';
    } else {
      return number;
    }
  }

  /**
   * Shows the human-readable frequency and its band.
   * @param {number} frequency The frequency to convert.
   * @param {string} band The band's name. If empty, shows the unit instead.
   */
  function withBand(frequency, band) {
    var freq = humanReadable(frequency, !band);
    if (band) {
      return freq + ' ' + band;
    } else {
      return freq;
    }
  }

  return {
    humanReadable: humanReadable,
    withBand: withBand
  };

})();

