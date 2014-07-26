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
 * @fileoverview A worker that receives samples captured by the tuner,
 * demodulates them, extracts the audio signals, and sends them back.
 */

importScripts('dsp.js');
importScripts('demodulator-am.js');
importScripts('demodulator-nbfm.js');
importScripts('demodulator-wbfm.js');

var IN_RATE = 1024000;
var OUT_RATE = 48000;

/**
 * A class to implement a worker that demodulates an FM broadcast station.
 * @constructor
 */
function Decoder() {
  var demodulator = new Demodulator_WBFM(IN_RATE, OUT_RATE);

  /**
   * Demodulates the tuner's output, producing mono or stereo sound, and
   * sends the demodulated audio back to the caller.
   * @param {ArrayBuffer} buffer A buffer containing the tuner's output.
   * @param {boolean} inStereo Whether to try decoding the stereo signal.
   * @param {Object=} opt_data Additional data to echo back to the caller.
   */
  function process(buffer, inStereo, opt_data) {
    var data = opt_data || {};
    var samples = samplesFromUint8(buffer, IN_RATE);
    var out = demodulator.demodulate(samples, inStereo);
    data['stereo'] = out['stereo'];
    data['carrier'] = out['carrier'];
    postMessage([out.left, out.right, data], [out.left, out.right]);
  }

  /**
   * Changes the modulation scheme.
   * @param {Object} mode The new mode.
   */
  function setMode(mode) {
    switch (mode.modulation) {
      case 'AM':
        demodulator = new Demodulator_AM(IN_RATE, OUT_RATE, mode.bandwidth);
        break;
      case 'NBFM':
        demodulator = new Demodulator_NBFM(IN_RATE, OUT_RATE, mode.maxF);
        break;
      default:
        demodulator = new Demodulator_WBFM(IN_RATE, OUT_RATE);
        break;
    }
  }

  return {
    process: process,
    setMode: setMode
  };
}

var decoder = new Decoder();

onmessage = function(event) {
  switch (event.data[0]) {
    case 1:
      decoder.setMode(event.data[1]);
      break;
    default:
      decoder.process(event.data[1], event.data[2], event.data[3]);
      break;
  }
};

