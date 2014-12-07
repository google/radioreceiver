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
 * @fileoverview A demodulator for wideband FM signals.
 */

/**
 * A class to implement a Wideband FM demodulator.
 * @param {number} inRate The sample rate of the input samples.
 * @param {number} outRate The sample rate of the output audio.
 * @constructor
 */
function Demodulator_WBFM(inRate, outRate) {
  var INTER_RATE = 336000;
  var MAX_F = 75000;
  var FILTER = MAX_F * 0.8;
  var PILOT_FREQ = 19000;
  var DEEMPH_TC = 50;

  var demodulator = new FMDemodulator(inRate, INTER_RATE, MAX_F, FILTER, 51);
  var filterCoefs = getLowPassFIRCoeffs(INTER_RATE, 10000, 41);
  var monoSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);
  var stereoSampler = new Downsampler(INTER_RATE, outRate, filterCoefs);
  var stereoSeparator = new StereoSeparator(INTER_RATE, PILOT_FREQ);
  var leftDeemph = new Deemphasizer(outRate, DEEMPH_TC);
  var rightDeemph = new Deemphasizer(outRate, DEEMPH_TC);

  /**
   * Demodulates the signal.
   * @param {Float32Array} samplesI The I components of the samples.
   * @param {Float32Array} samplesQ The Q components of the samples.
   * @param {boolean} inStereo Whether to try decoding the stereo signal.
   * @return {{left:ArrayBuffer,right:ArrayBuffer,stereo:boolean,carrier:boolean}}
   *     The demodulated audio signal.
   */
  function demodulate(samplesI, samplesQ, inStereo) {
    var demodulated = demodulator.demodulateTuned(samplesI, samplesQ);
    var leftAudio = monoSampler.downsample(demodulated);
    var rightAudio = new Float32Array(leftAudio);
    var stereoOut = false;

    if (inStereo) {
      var stereo = stereoSeparator.separate(demodulated);
      if (stereo.found) {
        stereoOut = true;
        var diffAudio = stereoSampler.downsample(stereo.diff);
        for (var i = 0; i < diffAudio.length; ++i) {
          rightAudio[i] -= diffAudio[i];
          leftAudio[i] += diffAudio[i];
        }
      }
    }

    leftDeemph.inPlace(leftAudio);
    rightDeemph.inPlace(rightAudio);
    return {left: leftAudio.buffer,
            right: rightAudio.buffer,
            stereo: stereoOut,
            signalLevel: demodulator.getRelSignalPower() / 0.02};
  }

  return {
    demodulate: demodulate
  };
}

