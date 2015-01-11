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
 * @fileoverview A demodulator for amplitude modulated signals.
 */

/**
 * A class to implement an AM demodulator.
 * @param {number} inRate The sample rate of the input samples.
 * @param {number} outRate The sample rate of the output audio.
 * @param {number} bandwidth The bandwidth of the input signal.
 * @constructor
 */
function Demodulator_AM(inRate, outRate, bandwidth) {
  var INTER_RATE = 48000;
  var filterF = bandwidth / 2;

  var demodulator = new AMDemodulator(inRate, INTER_RATE, filterF, 351);
  var filterCoefs = getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
  var downSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);

  /**
   * Demodulates the signal.
   * @param {Float32Array} samplesI The I components of the samples.
   * @param {Float32Array} samplesQ The Q components of the samples.
   * @return {{left:ArrayBuffer,right:ArrayBuffer,stereo:boolean,carrier:boolean}}
   *     The demodulated audio signal.
   */
  function demodulate(samplesI, samplesQ) {
    var demodulated = demodulator.demodulateTuned(samplesI, samplesQ);
    var audio = downSampler.downsample(demodulated);
    return {left: audio.buffer,
            right: new Float32Array(audio).buffer,
            stereo: false,
            signalLevel: 3.5 * Math.sqrt(demodulator.getRelSignalPower())};
  }

  return {
    demodulate: demodulate
  };
}

