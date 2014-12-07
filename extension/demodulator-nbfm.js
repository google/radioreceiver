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
 * @fileoverview A demodulator for narrowband FM signals.
 */

/**
 * A class to implement a Narrowband FM demodulator.
 * @param {number} inRate The sample rate of the input samples.
 * @param {number} outRate The sample rate of the output audio.
 * @param {number} maxF The frequency shift for maximum amplitude.
 * @constructor
 */
function Demodulator_NBFM(inRate, outRate, maxF) {
  var multiple = 1 + Math.floor((maxF - 1) * 7 / 75000);
  var interRate = 48000 * multiple;
  var filterF = maxF * 0.8;
  var minRatio = 2.5e-6 * maxF;
  minRatio *= minRatio;

  var demodulator = new FMDemodulator(inRate, interRate, maxF, filterF, Math.floor(50 * 7 / multiple));
  var filterCoefs = getLowPassFIRCoeffs(interRate, 8000, 41);
  var downSampler = new Downsampler(interRate, outRate, filterCoefs);

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
            signalLevel: demodulator.getRelSignalPower() / minRatio};
  }

  return {
    demodulate: demodulate
  };
}

