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

var IN_RATE = 1024000;
var INTER_RATE = 336000;
var OUT_RATE = 48000;
var MAX_F = 75000;
var PILOT_FREQ = 19000;

/**
 * A class to implement a worker that demodulates an FM broadcast station.
 * @constructor
 */
function Decoder() {
  var demodulator = new FMDemodulator(IN_RATE, INTER_RATE, MAX_F);
  var filterCoefs = getLowPassFIRCoeffs(INTER_RATE, 10, 61);
  var monoSampler = new Downsampler(INTER_RATE, OUT_RATE, filterCoefs);
  var stereoSampler = new Downsampler(INTER_RATE, OUT_RATE, filterCoefs);
  var stereoSeparator = new StereoSeparator(INTER_RATE, PILOT_FREQ);

  /**
   * Demodulates the tuner's output, producing mono or stereo sound, and
   * sends the demodulated audio back to the caller.
   * @param {ArrayBuffer} buffer A buffer containing the tuner's output.
   * @param {boolean} inStereo Whether to try decoding the stereo signal.
   * @param {*=} opt_data Additional data to echo back to the caller.
   */
  function process(buffer, inStereo, opt_data) {
    var samples = samplesFromUint8(buffer, IN_RATE);
    var demodulated = demodulator.demodulateTuned(samples);
    var leftAudio = monoSampler.downsample(demodulated);
    var rightAudio = leftAudio;

    if (inStereo) {
      var stereo = stereoSeparator.separate(demodulated);
      if (stereo.found) {
        var diffAudio = stereoSampler.downsample(stereo.diff);
        rightAudio = new Samples(new Float32Array(leftAudio.data), diffAudio.rate);
        for (var i = 0; i < diffAudio.data.length; ++i) {
          rightAudio.data[i] -= diffAudio.data[i];
          leftAudio.data[i] += diffAudio.data[i];
        }
      }
    }

    postMessage([leftAudio, rightAudio, opt_data], [leftAudio.data.buffer, rightAudio.data.buffer]);
  }

  return {
    process: process
  };
}

var decoder = new Decoder();

onmessage = function(event) {
  decoder.process(event.data[0], event.data[1], event.data[2]);
};

